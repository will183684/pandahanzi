import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase, kvFetchAll, kvSet, kvSetMany, getClasses, saveClasses } from "./supabaseClient";
import { C, DEFAULTS, ACTIVITIES } from "./theme";
import { cnNumber } from "./utils";
import Panda from "./components/Panda";
import { Toast, Shell, ConfirmDialog } from "./components/ui";
import ActivityHost from "./activities/ActivityHost";
import Landing from "./screens/Landing";
import StudentHome from "./screens/StudentHome";
import ReviewHome from "./screens/ReviewHome";
import ArchivePanel from "./screens/ArchivePanel";
import TeacherArea, { ghostBtn } from "./screens/TeacherArea";

/* ============================================================
   熊猫画画班 · 汉字练习  (Panda Art — Chinese Character Practice)
   Root component: owns the active class + week state, persists it to
   Supabase, and routes between the landing / student / teacher views.
   UI building blocks live under components/, activities/, and screens/.
   ============================================================ */
export default function PandaHanziApp() {
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const pushToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  // ---- store (mirrored in React state, persisted to Supabase) ----
  const [index, setIndex] = useState([]);
  const [currentId, setCurrentId] = useState("");
  const [metas, setMetas] = useState({}); // id -> meta
  const [progresses, setProgresses] = useState({}); // id -> progress
  const [students, setStudents] = useState({}); // name -> record
  const [loaded, setLoaded] = useState(false); // active class data loaded
  const [activeClass, setActiveClass] = useState(null); // {id,name,invite_code}

  const blankProgress = () => ({ 0: false, 1: false, 2: false, 3: false, 4: false, completedAt: null });

  const persistMeta = useCallback((id, meta) => {
    if (!activeClass) return;
    kvSet(activeClass.id, `week:${id}:meta`, meta).catch(() => pushToast("保存失败，请检查网络 ⚠️"));
  }, [pushToast, activeClass]);
  const persistProgress = useCallback((id, pr) => {
    if (!activeClass) return;
    kvSet(activeClass.id, `week:${id}:progress`, pr).catch(() => pushToast("进度保存失败，请稍后再试 ⚠️"));
  }, [pushToast, activeClass]);
  const persistStudent = useCallback((rec) => {
    if (!activeClass) return;
    kvSet(activeClass.id, `student:${rec.name}`, rec).catch(() => pushToast("学生记录保存失败 ⚠️"));
  }, [pushToast, activeClass]);
  const persistIndex = useCallback((arr, cur) => {
    if (!activeClass) return;
    kvSetMany(activeClass.id, [["weeks:index", arr], ["weeks:current", cur]]).catch(() => pushToast("保存失败 ⚠️"));
  }, [pushToast, activeClass]);

  // rebuild React state from a full KV snapshot
  const applySnapshot = useCallback((kv) => {
    const idx = Array.isArray(kv["weeks:index"]) ? kv["weeks:index"] : [];
    const cur = kv["weeks:current"] || idx[idx.length - 1] || "";
    const ms = {}; const ps = {}; const stu = {};
    idx.forEach((wid) => {
      if (kv[`week:${wid}:meta`]) ms[wid] = kv[`week:${wid}:meta`];
      ps[wid] = kv[`week:${wid}:progress`] || blankProgress();
    });
    Object.keys(kv).forEach((k) => {
      if (k.indexOf("student:") === 0) { const r = kv[k]; if (r && r.name) stu[r.name] = r; }
    });
    setIndex(idx); setCurrentId(cur); setMetas(ms); setProgresses(ps); setStudents(stu);
  }, []);

  // ---- load the active class from Supabase (+ bootstrap its first week) ----
  useEffect(() => {
    if (!activeClass) return undefined;
    let alive = true;
    (async () => {
      try {
        const kv = await kvFetchAll(activeClass.id);
        if (!alive) return;
        const idx = kv["weeks:index"];
        if (!Array.isArray(idx) || idx.length === 0) {
          const id = "week_001";
          const meta = {
            id, label: "第一周", createdAt: new Date().toISOString(),
            chars: DEFAULTS.chars, pinyins: DEFAULTS.pinyins, vocab: DEFAULTS.vocab,
            sentence: DEFAULTS.sentence, emojiMap: DEFAULTS.emojiMap,
            inviteCode: activeClass.invite_code || DEFAULTS.inviteCode,
            students: DEFAULTS.students, distractors: DEFAULTS.distractors, audioMap: {},
          };
          const pr = blankProgress();
          await kvSetMany(activeClass.id, [
            [`week:${id}:meta`, meta],
            [`week:${id}:progress`, pr],
            ["weeks:index", [id]],
            ["weeks:current", id],
          ]);
          if (!alive) return;
          setIndex([id]); setCurrentId(id);
          setMetas({ [id]: meta }); setProgresses({ [id]: pr }); setStudents({});
          setLoaded(true);
          return;
        }
        applySnapshot(kv);
        setLoaded(true);
      } catch (err) {
        if (!alive) return;
        pushToast("连接数据库失败，请检查 Supabase 配置或网络 ⚠️");
        const id = "week_001";
        const meta = {
          id, label: "第一周", createdAt: new Date().toISOString(),
          chars: DEFAULTS.chars, pinyins: DEFAULTS.pinyins, vocab: DEFAULTS.vocab,
          sentence: DEFAULTS.sentence, emojiMap: DEFAULTS.emojiMap,
          inviteCode: (activeClass && activeClass.invite_code) || DEFAULTS.inviteCode,
          students: DEFAULTS.students, distractors: DEFAULTS.distractors, audioMap: {},
        };
        setIndex([id]); setCurrentId(id); setMetas({ [id]: meta }); setProgresses({ [id]: blankProgress() });
        setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [activeClass, pushToast, applySnapshot]);

  // ---- realtime: sync this class when anyone (e.g. the teacher) saves ----
  useEffect(() => {
    if (!activeClass) return undefined;
    let alive = true;
    let timer = null;
    const refetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        kvFetchAll(activeClass.id).then((kv) => { if (alive) applySnapshot(kv); }).catch(() => {});
      }, 250);
    };
    const channel = supabase
      .channel("kv-sync-" + activeClass.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "kv", filter: `class_id=eq.${activeClass.id}` }, refetch)
      .subscribe();
    return () => { alive = false; if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [activeClass, applySnapshot]);

  // ---- session ----
  const [session, setSession] = useState(null); // {role:'parent'|'teacher'|'admin', name?}
  const [screen, setScreen] = useState("home"); // 'home' | activity index handled separately
  const [activeActivity, setActiveActivity] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reviewId, setReviewId] = useState(null); // weekId being reviewed (read-only)

  const currentMeta = metas[currentId];
  const reviewing = reviewId != null;
  const viewMeta = reviewing ? metas[reviewId] : currentMeta;
  const viewProgress = reviewing ? blankProgress() : (progresses[currentId] || blankProgress());

  const getProgressFor = useCallback((wid) => progresses[wid] || blankProgress(), [progresses]);
  const getStudent = useCallback((nm) => students[nm], [students]);

  // ---- save content (teacher/admin) ----
  const saveContent = useCallback((nextMeta) => {
    setMetas((prev) => ({ ...prev, [nextMeta.id]: nextMeta }));
    persistMeta(nextMeta.id, nextMeta);
    // keep the class invite code (used by parents to join) in sync with the registry
    if (activeClass && nextMeta.inviteCode && nextMeta.inviteCode !== activeClass.invite_code) {
      const code = nextMeta.inviteCode;
      getClasses().then((list) => {
        const nlist = list.map((c) => (c.id === activeClass.id ? { ...c, invite_code: code } : c));
        return saveClasses(nlist);
      }).then(() => setActiveClass((a) => (a ? { ...a, invite_code: code } : a))).catch(() => {});
    }
    pushToast("已保存 ✅");
  }, [persistMeta, pushToast, activeClass]);

  // ---- save a single character's teacher recording (or clear it) ----
  const saveAudio = useCallback((char, dataUrl) => {
    setMetas((prev) => {
      const m = prev[currentId];
      if (!m) return prev;
      const am = { ...(m.audioMap || {}) };
      if (dataUrl) am[char] = dataUrl; else delete am[char];
      const nm = { ...m, audioMap: am };
      persistMeta(currentId, nm);
      return { ...prev, [currentId]: nm };
    });
  }, [currentId, persistMeta]);

  // ---- start new week (admin) ----
  const doStartNewWeek = useCallback(() => {
    const num = index.length + 1;
    const newId = "week_" + String(num).padStart(3, "0");
    const newMeta = {
      id: newId, label: "第" + cnNumber(num) + "周", createdAt: new Date().toISOString(),
      chars: [], pinyins: [], vocab: [], sentence: "", emojiMap: {}, audioMap: {},
      inviteCode: currentMeta ? currentMeta.inviteCode : DEFAULTS.inviteCode,
      students: currentMeta ? currentMeta.students : [], distractors: DEFAULTS.distractors,
    };
    const newIdx = [...index, newId];
    const newPr = blankProgress();
    setIndex(newIdx);
    setCurrentId(newId);
    setMetas((prev) => ({ ...prev, [newId]: newMeta }));
    setProgresses((prev) => ({ ...prev, [newId]: newPr }));
    // reset students' completed for the new week
    setStudents((prev) => {
      const ns = {};
      Object.keys(prev).forEach((nm) => {
        const rec = { ...prev[nm], completed: [] };
        ns[nm] = rec;
        persistStudent(rec);
      });
      return ns;
    });
    persistMeta(newId, newMeta);
    persistProgress(newId, newPr);
    persistIndex(newIdx, newId);
    pushToast("新的一周开始啦！🗓️");
  }, [index, currentMeta, persistMeta, persistProgress, persistIndex, persistStudent, pushToast]);

  const [confirmNewWeek, setConfirmNewWeek] = useState(false);
  const handleStartNewWeek = useCallback(() => {
    const pr = progresses[currentId] || blankProgress();
    const complete = ACTIVITIES.every((_, i) => pr[i]);
    if (!complete) { setConfirmNewWeek(true); return; }
    doStartNewWeek();
  }, [progresses, currentId, doStartNewWeek]);

  // ---- mark activity complete (student) ----
  const markComplete = useCallback((activityIndex) => {
    if (reviewing) return;
    // week progress
    setProgresses((prev) => {
      const cur = prev[currentId] || blankProgress();
      const np = { ...cur, [activityIndex]: true };
      const allDone = ACTIVITIES.every((_, i) => np[i]);
      np.completedAt = allDone ? new Date().toISOString() : cur.completedAt;
      persistProgress(currentId, np);
      return { ...prev, [currentId]: np };
    });
    // student record
    if (session && session.role === "parent" && session.name) {
      setStudents((prev) => {
        const rec = prev[session.name] || { name: session.name, completed: [] };
        const comp = rec.completed.includes(activityIndex) ? rec.completed : [...rec.completed, activityIndex];
        const nrec = { ...rec, name: session.name, completed: comp };
        persistStudent(nrec);
        return { ...prev, [session.name]: nrec };
      });
    }
  }, [reviewing, currentId, session, persistProgress, persistStudent]);

  // ---- enter / leave a class ----
  const enterClass = useCallback((cls, sess) => {
    setLoaded(false);
    setIndex([]); setCurrentId(""); setMetas({}); setProgresses({}); setStudents({});
    setActiveClass(cls);
    setSession(sess);
    setScreen("home"); setReviewId(null); setActiveActivity(null); setArchiveOpen(false);
  }, []);

  const logout = useCallback(() => {
    setSession(null); setActiveClass(null); setLoaded(false);
    setScreen("home"); setActiveActivity(null); setReviewId(null); setArchiveOpen(false);
    setIndex([]); setCurrentId(""); setMetas({}); setProgresses({}); setStudents({});
  }, []);

  // admin: save the class registry (rosters etc.) and refresh the active class
  const saveAllClasses = useCallback((nlist) => {
    saveClasses(nlist).catch(() => pushToast("班级保存失败 ⚠️"));
    setActiveClass((a) => {
      if (!a) return a;
      const mine = nlist.find((c) => c.id === a.id);
      return mine ? { ...a, ...mine } : a;
    });
  }, [pushToast]);

  // seed the student record (so the teacher dashboard lists them) after load
  useEffect(() => {
    if (!loaded || !session || session.role !== "parent" || !session.name) return;
    if (students[session.name]) return;
    const rec = { name: session.name, completed: [] };
    setStudents((prev) => ({ ...prev, [session.name]: rec }));
    persistStudent(rec);
  }, [loaded, session, students, persistStudent]);

  // ---- archive / review ----
  const openReview = useCallback((wid) => {
    setReviewId(wid); setArchiveOpen(false); setActiveActivity(null);
  }, []);
  const exitReview = useCallback(() => { setReviewId(null); setActiveActivity(null); }, []);

  const weeksList = useMemo(
    () => index.map((wid) => metas[wid]).filter(Boolean).slice().reverse(),
    [index, metas]
  );

  /* --------------------------- RENDER --------------------------- */

  // no class chosen yet -> landing (login / pick class)
  if (!activeClass) {
    return (
      <Shell>
        <Landing onEnter={enterClass} pushToast={pushToast} />
        <Toast msg={toast} />
      </Shell>
    );
  }

  // class chosen but its data still loading
  if (!loaded) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 0" }}>
          <div style={{ animation: "pa-jump 1.2s ease-in-out infinite" }}><Panda sz={110} ex="curious" /></div>
          <p style={{ color: "#8A8276" }}>正在加载…</p>
        </div>
        <Toast msg={toast} />
      </Shell>
    );
  }

  // review banner
  const reviewBanner = reviewing ? (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      background: "#FBEFCB", borderBottom: `2px solid ${C.gold}`, padding: "10px 16px", flexWrap: "wrap",
    }}>
      <span style={{ fontWeight: 800, color: "#8a6d12" }}>🔒 回顾模式 · {viewMeta ? viewMeta.label : ""}</span>
      <button onClick={exitReview} style={ghostBtn}>返回本周 ↩</button>
    </div>
  ) : null;

  // TEACHER / ADMIN
  if (session.role === "teacher" || session.role === "admin") {
    return (
      <Shell banner={reviewBanner}>
        {reviewing && viewMeta ? (
          activeActivity == null ? (
            <ReviewHome meta={viewMeta} onOpenActivity={setActiveActivity} onExit={exitReview} />
          ) : (
            <ActivityHost activityIndex={activeActivity} meta={viewMeta} readOnly
              onComplete={() => {}} onBack={() => setActiveActivity(null)} />
          )
        ) : (
          <TeacherArea
            role={session.role} className={activeClass ? activeClass.name : ""} roster={activeClass ? activeClass.students : []} meta={currentMeta} students={students} getStudent={getStudent}
            onSaveClasses={saveAllClasses} activeClassId={activeClass ? activeClass.id : ""}
            onSave={saveContent} onSaveAudio={saveAudio} onStartNewWeek={handleStartNewWeek}
            onOpenArchive={() => setArchiveOpen(true)} onLogout={logout} pushToast={pushToast}
          />
        )}
        {archiveOpen && (
          <ArchivePanel weeks={weeksList} currentId={currentId} getProgress={getProgressFor}
            onClose={() => setArchiveOpen(false)} onReview={openReview} />
        )}
        {confirmNewWeek && (
          <ConfirmDialog
            text="本周还没全部完成，确定要开始新的一周吗？当前这一周会存进历史记录。"
            onCancel={() => setConfirmNewWeek(false)}
            onConfirm={() => { setConfirmNewWeek(false); doStartNewWeek(); }}
          />
        )}
        <Toast msg={toast} />
      </Shell>
    );
  }

  // PARENT / STUDENT
  return (
    <Shell banner={reviewBanner}>
      {activeActivity == null ? (
        reviewing && viewMeta ? (
          <ReviewHome meta={viewMeta} onOpenActivity={setActiveActivity} onExit={exitReview} />
        ) : (
          <StudentHome
            studentName={session.name} meta={currentMeta} progress={viewProgress} readOnly={false}
            onOpenActivity={setActiveActivity} onOpenArchive={() => setArchiveOpen(true)} onLogout={logout}
          />
        )
      ) : (
        <ActivityHost
          activityIndex={activeActivity} meta={viewMeta} readOnly={reviewing}
          onComplete={markComplete} onBack={() => setActiveActivity(null)}
        />
      )}
      {archiveOpen && (
        <ArchivePanel weeks={weeksList} currentId={currentId} getProgress={getProgressFor}
          onClose={() => setArchiveOpen(false)} onReview={openReview} />
      )}
      <Toast msg={toast} />
    </Shell>
  );
}
