import { useState } from "react";
import { C, LEVELS } from "../theme";

/* ===================================================================
   课程列表 —— 12 级折叠 + 搜索，每课显示字表和「已上」标记。

   由两处共用：
     · LessonPicker    弹窗，给当前所在的班选课
     · CurriculumBrowser  独立页签，浏览全部字表并布置给任意班级
   =================================================================== */
export default function LessonList({ curriculum, taken, busy, onPick, pickLabel, onUnpick }) {
  const [openLevel, setOpenLevel] = useState(1);
  const [query, setQuery] = useState("");

  const q = query.trim();
  const matches = (l) =>
    !q ||
    String(l.lesson_no) === q ||
    String(l.level_seq) === q ||
    l.chars.some((c) => q.includes(c.hanzi) || c.hanzi === q) ||
    l.chars.some((c) => (c.pinyin || "").startsWith(q.toLowerCase()));

  return (
    <>
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
        const all = curriculum.lessons.filter((l) => l.level === lv.level);
        const list = all.filter(matches);
        const doneCount = all.filter((l) => taken.get(l.id) && taken.get(l.id).done > 0).length;
        const isOpen = q ? list.length > 0 : openLevel === lv.level;

        return (
          <div key={lv.level} style={{ marginBottom: 10 }}>
            <button
              onClick={() => setOpenLevel(openLevel === lv.level ? 0 : lv.level)}
              style={{
                width: "100%", textAlign: "left", minHeight: 56, padding: "10px 12px", borderRadius: 14,
                border: `2px solid ${isOpen ? lv.color : C.border}`, background: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <span style={{
                background: lv.color, color: "#fff", fontWeight: 800, fontSize: 13,
                borderRadius: 8, padding: "4px 8px", minWidth: 38, textAlign: "center", flexShrink: 0,
              }}>{lv.name}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 16, display: "block" }}>{lv.sub}</span>
                <span style={{ fontSize: 12, color: "#9C9382" }}>{lv.chars} 字 · {all.length} 课</span>
              </span>
              <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 700, flexShrink: 0 }}>
                {doneCount}/{all.length} 已上　{isOpen ? "▾" : "▸"}
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
                    <div key={l.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      borderRadius: 12, background: isActive ? "#EAF6EC" : "#fff",
                      border: `2px solid ${isActive ? C.bamboo : isDone ? C.gold + "66" : C.border}`,
                      flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 74, whiteSpace: "nowrap" }}>
                        <span style={{ color: lv.color }}>{lv.name}</span>
                        <span style={{ color: "#9C9382" }}> 第{l.level_seq}课</span>
                      </span>
                      <span style={{ flex: 1, minWidth: 140, fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>
                        {l.chars.map((c) => c.hanzi).join("")}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 13, color: C.bamboo, fontWeight: 800 }}>🔵 正在上</span>
                      )}
                      {!isActive && isDone && (
                        <span style={{ fontSize: 13, color: "#B79A2E", fontWeight: 700 }}>
                          ✅{st.done > 1 ? `×${st.done}` : ""}
                        </span>
                      )}
                      {/* 布置过的（正在上或已上）可以撤回，给老师反悔的机会 */}
                      {onUnpick && (isActive || isDone) && (
                        <button
                          onClick={() => onUnpick(l, st)}
                          disabled={busy}
                          style={{
                            minHeight: 40, padding: "0 10px", borderRadius: 10,
                            border: `2px solid ${C.red}44`, background: "#fff", color: C.red,
                            fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >取消布置</button>
                      )}
                      {!isActive && (
                        <button
                          onClick={() => onPick(l)}
                          disabled={busy}
                          style={{
                            minHeight: 40, padding: "0 12px", borderRadius: 10, border: "none",
                            background: busy ? "#D8D2C6" : C.bamboo, color: "#fff",
                            fontWeight: 800, fontSize: 14, cursor: busy ? "not-allowed" : "pointer",
                          }}
                        >
                          {isDone ? "再上一次" : (pickLabel || "选用")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
