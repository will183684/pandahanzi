import { useState, useEffect, useCallback } from "react";
import { C } from "../theme";
import { Card, BigButton } from "../components/ui";
import {
  getClassLessonChars, saveClassLessonChars, updateClassLesson, saveSharedAudio,
} from "../supabaseClient";
import ContentSettings from "./ContentSettings";

/* ===================================================================
   课程编辑 —— 挑本班的任意一节课改内容（字 / 拼音 / 表情 / 录音 / 词句）。

   和「进度」里的布置分开：这里只改内容，不动 active 状态，也不会
   新建排课记录。以前老师想回去改第 1 课，只能点「再上一次」，那会
   插一条新记录、字表是空白副本，之前录的音看上去就丢了。
   =================================================================== */
export default function LessonEditor({
  classLessons, charsOf, curriculum, session, pushToast, onAfterSave, onOpenPicker,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [chars, setChars] = useState([]);
  const [charsFor, setCharsFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const selected = classLessons.find((l) => l.id === selectedId) || null;

  /* 选中哪节课就拉哪节课的完整字表（含录音） */
  useEffect(() => {
    if (!selectedId) { setChars([]); setCharsFor(null); return undefined; }
    let alive = true;
    setCharsFor(null);
    getClassLessonChars(selectedId)
      .then((cs) => { if (alive) { setChars(cs); setCharsFor(selectedId); } })
      .catch(() => { if (alive) { setCharsFor(selectedId); pushToast("字表加载失败 ⚠️"); } });
    return () => { alive = false; };
  }, [selectedId, pushToast]);

  const saveChars = useCallback(async (rows) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await saveClassLessonChars(selectedId, rows);
      /* 录了音就同时进共享库，别的老师选同一课能直接用。
         这一步失败不该挡住字表保存，但也别闷着 —— 之前 RLS 拦掉写入，
         界面照样报「已保存」，老师换个班就发现录音没共享过去。 */
      let sharedFailed = false;
      if (curriculum && session && session.role === "teacher" && session.name) {
        const charMap = new Map(curriculum.characters.map((c) => [c.hanzi, c]));
        for (const row of rows) {
          const ch = charMap.get(row.hanzi);
          if (!row.audio_url || !ch) continue;
          try { await saveSharedAudio(ch.id, session.name, row.audio_url); }
          catch (e) { sharedFailed = true; }
        }
      }
      const fresh = await getClassLessonChars(selectedId);
      setChars(fresh);
      pushToast(sharedFailed ? "本班已保存 ✅　但录音没能共享给其他班 ⚠️" : "已保存 ✅");
      if (onAfterSave) onAfterSave();
    } catch (e) {
      pushToast("字表保存失败 ⚠️");
    }
    setBusy(false);
  }, [selectedId, curriculum, session, pushToast, onAfterSave]);

  const saveLesson = useCallback(async (patch) => {
    if (!selectedId) return;
    try {
      await updateClassLesson(selectedId, patch);
      if (onAfterSave) onAfterSave();
    } catch (e) {
      pushToast("保存失败 ⚠️");
    }
  }, [selectedId, pushToast, onAfterSave]);

  /* ---------------- 选中了某节课：直接进编辑 ---------------- */
  if (selected) {
    return (
      <ContentSettings
        editMode
        lesson={selected} chars={chars} charsFor={charsFor}
        busy={busy} pushToast={pushToast}
        onSaveLesson={saveLesson} onSaveChars={saveChars}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  /* ---------------- 课程列表 ----------------
     按课程库的顺序排（L1第1课、L1第2课…），不是按上课先后 ——
     老师是照着课号找课的，按 seq 排看着就是乱的。
     自建的课（没有 lesson_id）排在最后，按上课先后。 */
  const lessonNoOf = (l) => {
    const src = curriculum && l.lesson_id != null ? curriculum.lessonById.get(l.lesson_id) : null;
    return src ? src.lesson_no : Infinity;
  };
  const list = classLessons.slice().sort((a, b) => {
    const na = lessonNoOf(a), nb = lessonNoOf(b);
    if (na !== nb) return na - nb;      // Infinity 相等时落到 seq
    return a.seq - b.seq;
  });

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>📚 课程编辑</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
        挑一节课改内容：加字删字、改拼音表情、录音。改完直接保存，不会影响这个班正在上哪一课。
      </p>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 8px" }}>
          <div style={{ fontSize: 48 }}>📖</div>
          <p style={{ color: "#8A8276", fontSize: 15 }}>
            这个班还没有课程。先去「📊 进度」里布置一节课，再回来编辑内容。
          </p>
          {onOpenPicker && (
            <BigButton color={C.bamboo} onClick={onOpenPicker}>📚 去布置课程</BigButton>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              style={{
                textAlign: "left", minHeight: 60, padding: "10px 14px", borderRadius: 14,
                border: `2px solid ${l.status === "active" ? C.bamboo : C.border}`,
                background: l.status === "active" ? "#F2FAF3" : "#fff",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 10,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{l.title}</span>
                <span style={{
                  display: "block", fontSize: 20, fontWeight: 700, color: "#6B6356",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {charsOf(l.id) || "（还没有字）"}
                </span>
              </span>
              <span style={{ fontSize: 13, color: "#9C9382", whiteSpace: "nowrap", fontWeight: 700 }}>
                {l.status === "active" ? "🔵 正在上" : "已上过"}　✏️
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
