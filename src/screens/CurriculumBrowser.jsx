import { useState, useEffect, useCallback, useMemo } from "react";
import { C, LEVELS } from "../theme";
import { getClasses, getClassLessons, startClassLesson, deleteClassLesson } from "../supabaseClient";
import { Card, ConfirmDialog } from "../components/ui";
import LessonList from "../components/LessonList";

/* ===================================================================
   课程库 —— 浏览全部 1200 字 / 120 课，并把某一课布置给某个班。

   教务能布置给所有班；授课老师只能布置给自己名下的班（myClassIds）。
   「已上」标记跟着上面选的目标班走，所以换班时要重新拉那个班的排课。
   =================================================================== */
export default function CurriculumBrowser({ curriculum, myClassIds, activeClassId, pushToast }) {
  const [classes, setClasses] = useState(null);
  const [targetId, setTargetId] = useState(activeClassId || "");
  const [targetLessons, setTargetLessons] = useState([]);
  const [busy, setBusy] = useState(false);

  /* 可布置的班级 */
  useEffect(() => {
    let alive = true;
    getClasses().then((all) => {
      if (!alive) return;
      const mine = myClassIds ? all.filter((c) => myClassIds.includes(c.id)) : all;
      setClasses(mine);
      if (!mine.some((c) => c.id === targetId)) setTargetId(mine[0] ? mine[0].id : "");
    }).catch(() => pushToast("读取班级失败 ⚠️"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 目标班已上过哪些课 */
  const loadTarget = useCallback(async (id) => {
    if (!id) { setTargetLessons([]); return; }
    try { setTargetLessons(await getClassLessons(id)); }
    catch (e) { setTargetLessons([]); }
  }, []);

  useEffect(() => { loadTarget(targetId); }, [targetId, loadTarget]);

  const taken = useMemo(() => {
    const m = new Map();
    targetLessons.forEach((cl) => {
      if (cl.lesson_id == null) return;
      const cur = m.get(cl.lesson_id) || { active: false, done: 0 };
      if (cl.status === "active") cur.active = true;
      else cur.done += 1;
      m.set(cl.lesson_id, cur);
    });
    return m;
  }, [targetLessons]);

  const target = (classes || []).find((c) => c.id === targetId);

  const assign = useCallback(async (lesson) => {
    if (!targetId) { pushToast("先选一个班级"); return; }
    setBusy(true);
    try {
      const existing = await getClassLessons(targetId);
      await startClassLesson(targetId, lesson, existing);
      await loadTarget(targetId);
      pushToast(`已把第${lesson.lesson_no}课布置给「${target ? target.name : ""}」📚`);
    } catch (e) {
      pushToast("布置失败 ⚠️");
    }
    setBusy(false);
  }, [targetId, target, loadTarget, pushToast]);

  /* 撤回布置：删掉目标班里这一课最近的那次。
     一课可能被上过多次（「再上一次」），所以按 seq 取最新的一条。 */
  const [pending, setPending] = useState(null);   // {victim, times}

  const unassign = useCallback((lesson) => {
    const mine = targetLessons
      .filter((cl) => cl.lesson_id === lesson.id)
      .sort((a, b) => b.seq - a.seq);
    if (mine.length === 0) return;
    setPending({ victim: mine[0], times: mine.length });
  }, [targetLessons]);

  const doUnassign = useCallback(async () => {
    const victim = pending && pending.victim;
    setPending(null);
    if (!victim) return;
    setBusy(true);
    try {
      await deleteClassLesson(victim.id);
      await loadTarget(targetId);
      pushToast(`已撤回「${victim.title}」↩️`);
    } catch (e) {
      pushToast("撤回失败 ⚠️");
    }
    setBusy(false);
  }, [pending, targetId, loadTarget, pushToast]);

  if (!curriculum) return <Card><p style={{ color: "#9C9382" }}>正在加载课程库…</p></Card>;
  if (!classes) return <Card><p style={{ color: "#9C9382" }}>正在加载班级…</p></Card>;

  const totalChars = LEVELS.reduce((a, l) => a + l.chars, 0);

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>📖 课程库</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
        全部 {totalChars} 字 · {curriculum.lessons.length} 课，分 {LEVELS.length} 级。
        选好班级后点「布置」，这一课的字（连同拼音、词语、句子）就会拷进那个班。
      </p>

      {/* 目标班级 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: "#FFFBF2", border: `2px solid ${C.gold}55`, borderRadius: 14,
        padding: 12, marginBottom: 14,
      }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>布置给</span>
        <select
          value={targetId}
          onChange={(ev) => setTargetId(ev.target.value)}
          style={{
            minHeight: 48, padding: "8px 12px", borderRadius: 12, fontSize: 16, fontWeight: 700,
            border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
          }}
        >
          {classes.length === 0 && <option value="">（没有可布置的班级）</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {target && (
          <span style={{ fontSize: 13, color: "#8A8276" }}>
            已上 {targetLessons.length} 次课
            {target.id === activeClassId && "　·　当前所在的班"}
          </span>
        )}
      </div>

      <LessonList
        curriculum={curriculum} taken={taken} busy={busy}
        onPick={assign} pickLabel="布置" onUnpick={unassign}
      />

      {pending && (
        <ConfirmDialog
          text={
            `从「${target ? target.name : ""}」撤回「${pending.victim.title}」？\n\n`
            + `这次课的字表和学生进度会一起删掉，无法撤销。\n`
            + (pending.times > 1 ? `这一课布置过 ${pending.times} 次，只撤回最近的一次。\n` : "")
            + `课程库不受影响，以后还能重新布置。`
          }
          confirmLabel="确定撤回"
          cancelLabel="不撤了"
          onCancel={() => setPending(null)}
          onConfirm={doUnassign}
        />
      )}
    </Card>
  );
}
