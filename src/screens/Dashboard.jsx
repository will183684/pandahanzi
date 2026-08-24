import { useMemo } from "react";
import { C, ACTIVITIES } from "../theme";
import { Card } from "../components/ui";

/* ===================================================================
   进度看板 —— 本班当前这节课，每个学生完成了哪些活动。
   数据来自 lesson_progress（每个学生/每节课/每个活动一行）。
   =================================================================== */
export default function Dashboard({ roster, progressRows, lesson, profiles, onOpenContent }) {
  const rows = useMemo(
    () => (progressRows || []).filter((r) => lesson && r.class_lesson_id === lesson.id),
    [progressRows, lesson]
  );

  /* 名单为主；名单外但有记录的学生也列出来（比如名册还没加） */
  const names = useMemo(() => {
    const set = new Set(roster && roster.length ? roster : []);
    rows.forEach((r) => set.add(r.student_name));
    return [...set];
  }, [roster, rows]);

  const doneOf = (name, key) => rows.some((r) => r.student_name === name && r.activity_key === key);

  if (!lesson) {
    return (
      <Card>
        <h3 style={{ marginTop: 0 }}>📊 学习进度</h3>
        <p style={{ color: "#8A8276" }}>还没安排本周课程，先去「内容」里选一课。</p>
      </Card>
    );
  }

  return (
    <Card style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>
          📊 学习进度
          <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 600, marginLeft: 8 }}>
            {lesson.title}
          </span>
        </h3>
        {lesson.status === "active" && onOpenContent && (
          <button onClick={onOpenContent} style={{
            minHeight: 40, padding: "0 12px", borderRadius: 10, border: "none",
            background: C.gold, color: C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer",
          }}>✏️ 继续编辑</button>
        )}
      </div>
      {names.length === 0 ? (
        <p style={{ color: "#8A8276" }}>这个班还没有学生。请教务老师在「👧 学生」里添加。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr style={{ textAlign: "center" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: `2px solid ${C.border}` }}>学生</th>
              {ACTIVITIES.map((a) => (
                <th key={a.key} style={{ padding: 8, borderBottom: `2px solid ${C.border}`, fontSize: 13 }}>
                  {a.emoji}<br />{a.name}
                </th>
              ))}
              <th style={{ padding: 8, borderBottom: `2px solid ${C.border}` }}>完成度</th>
            </tr>
          </thead>
          <tbody>
            {names.map((nm) => {
              const done = ACTIVITIES.filter((a) => doneOf(nm, a.key)).length;
              const ratio = done / ACTIVITIES.length;
              return (
                <tr key={nm}>
                  <td style={{ padding: 8, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 20, marginRight: 6 }}>
                      {(profiles && profiles[nm] && profiles[nm].avatar) || "🐼"}
                    </span>
                    {nm}
                  </td>
                  {ACTIVITIES.map((a) => (
                    <td key={a.key} style={{
                      textAlign: "center", padding: 8, borderBottom: `1px solid ${C.border}`, fontSize: 18,
                    }}>
                      {doneOf(nm, a.key) ? "✅" : "⬜"}
                    </td>
                  ))}
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, minWidth: 120 }}>
                    <div style={{ background: "#EEE7DA", borderRadius: 999, height: 12, overflow: "hidden" }}>
                      <div style={{ width: ratio * 100 + "%", height: "100%", background: C.bamboo }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#8A8276" }}>{done}/{ACTIVITIES.length}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
