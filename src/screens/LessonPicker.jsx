import { useMemo } from "react";
import { C } from "../theme";
import { BigButton } from "../components/ui";
import LessonList from "../components/LessonList";

/* ===================================================================
   选课弹窗 —— 给当前所在的班选一节课。
   列表部分与「课程库」页签共用 LessonList。
   =================================================================== */
export default function LessonPicker({ curriculum, classLessons, onPick, onClose, busy }) {
  /* lesson_id -> {active, done}，用来标「正在上 / 已上」 */
  const taken = useMemo(() => {
    const m = new Map();
    (classLessons || []).forEach((cl) => {
      if (cl.lesson_id == null) return;
      const cur = m.get(cl.lesson_id) || { active: false, done: 0 };
      if (cl.status === "active") cur.active = true;
      else cur.done += 1;
      m.set(cl.lesson_id, cur);
    });
    return m;
  }, [classLessons]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <div style={{
        position: "relative", width: "min(560px, 96vw)", height: "100%", background: C.bg,
        overflowY: "auto", padding: 16, boxSizing: "border-box", animation: "pa-slidein .25s ease",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12, position: "sticky", top: -16, background: C.bg, padding: "8px 0", zIndex: 2,
        }}>
          <h2 style={{ margin: 0, fontSize: 21 }}>📚 选择本周课程</h2>
          <button onClick={onClose} style={{
            minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.border}`,
            background: "#fff", fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>

        <LessonList curriculum={curriculum} taken={taken} busy={busy} onPick={onPick} />

        <p style={{ fontSize: 12, color: "#9C9382", marginTop: 16, lineHeight: 1.6 }}>
          选用后会把这课的字（连同拼音、词语、句子）拷进本班，之后可以在「内容」里加字、删字、改拼音、录音——
          改动只影响本班，不会动课程库。上一节课会自动标记为已完成。
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 8, marginBottom: 24 }}>
          <BigButton color={C.bamboo} light onClick={onClose}>关闭</BigButton>
        </div>
      </div>
    </div>
  );
}
