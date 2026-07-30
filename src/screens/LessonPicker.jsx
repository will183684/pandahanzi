import { useState, useMemo } from "react";
import { C, LEVELS } from "../theme";
import { BigButton } from "../components/ui";

/* ===================================================================
   选课面板 —— 240 课按级别折叠，标出本班已上/在上的课。
   老师点「选用」→ 把这课的 5 个字拷进本班，成为「正在上」的课。
   =================================================================== */
export default function LessonPicker({ curriculum, classLessons, onPick, onClose, busy }) {
  const [openLevel, setOpenLevel] = useState(1);
  const [query, setQuery] = useState("");

  /* lesson_id -> {active?, doneCount} */
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

  const q = query.trim();
  const matches = (l) =>
    !q ||
    String(l.lesson_no) === q ||
    String(l.level_seq) === q ||
    l.chars.some((c) => q.includes(c.hanzi) || c.hanzi === q) ||
    (l.chars.some((c) => (c.pinyin || "").startsWith(q.toLowerCase())));

  const lessonsOf = (level) =>
    curriculum.lessons.filter((l) => l.level === level && matches(l));

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

        <input
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder="搜汉字、拼音或课号，例如：山 / shan / 12"
          style={{
            width: "100%", minHeight: 48, padding: "0 14px", borderRadius: 12, fontSize: 16,
            border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box", marginBottom: 12,
          }}
        />

        {LEVELS.map((lv) => {
          const list = lessonsOf(lv.level);
          const total = curriculum.lessons.filter((l) => l.level === lv.level).length;
          const doneCount = curriculum.lessons.filter(
            (l) => l.level === lv.level && taken.get(l.id) && taken.get(l.id).done > 0
          ).length;
          const isOpen = q ? list.length > 0 : openLevel === lv.level;

          return (
            <div key={lv.level} style={{ marginBottom: 12 }}>
              <button
                onClick={() => setOpenLevel(openLevel === lv.level ? 0 : lv.level)}
                style={{
                  width: "100%", textAlign: "left", minHeight: 56, padding: "10px 14px", borderRadius: 14,
                  border: `2px solid ${isOpen ? lv.color : C.border}`, background: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                }}
              >
                <span>
                  <span style={{ fontWeight: 800, fontSize: 17 }}>{lv.name}</span>
                  <span style={{ fontSize: 13, color: "#9C9382", marginLeft: 8 }}>{lv.sub}</span>
                </span>
                <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 700 }}>
                  {doneCount}/{total} 已上　{isOpen ? "▾" : "▸"}
                </span>
              </button>

              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {list.length === 0 && (
                    <span style={{ color: "#9C9382", fontSize: 14, padding: "6px 4px" }}>没有匹配的课</span>
                  )}
                  {list.map((l) => {
                    const st = taken.get(l.id);
                    const isActive = st && st.active;
                    const isDone = st && st.done > 0;
                    return (
                      <div
                        key={l.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                          borderRadius: 12, background: isActive ? "#EAF6EC" : "#fff",
                          border: `2px solid ${isActive ? C.bamboo : isDone ? C.gold + "66" : C.border}`,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 700, minWidth: 52 }}>
                          第{l.level_seq}课
                        </span>
                        <span style={{ flex: 1, fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>
                          {l.chars.map((c) => c.hanzi).join("")}
                        </span>
                        {isActive ? (
                          <span style={{ fontSize: 13, color: C.bamboo, fontWeight: 800 }}>🔵 正在上</span>
                        ) : (
                          <>
                            {isDone && (
                              <span style={{ fontSize: 13, color: "#B79A2E", fontWeight: 700 }}>
                                ✅{st.done > 1 ? `×${st.done}` : ""}
                              </span>
                            )}
                            <button
                              onClick={() => onPick(l)}
                              disabled={busy}
                              style={{
                                minHeight: 40, padding: "0 12px", borderRadius: 10, border: "none",
                                background: busy ? "#D8D2C6" : C.bamboo, color: "#fff",
                                fontWeight: 800, fontSize: 14, cursor: busy ? "not-allowed" : "pointer",
                              }}
                            >
                              {isDone ? "再上一次" : "选用"}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

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
