import { C, ACTIVITIES } from "../theme";
import { Card } from "../components/ui";

/* ===================================================================
   Progress Dashboard (teacher view of the week's per-student progress)
   =================================================================== */
export default function Dashboard({ roster, students, getStudent }) {
  const names = (roster && roster.length > 0) ? roster : Object.keys(students);
  return (
    <Card style={{ overflowX: "auto" }}>
      <h3 style={{ marginTop: 0 }}>📊 本周学习进度</h3>
      {names.length === 0 ? (
        <p style={{ color: "#8A8276" }}>这个班还没有学生。请教务老师在“👧 学生”里添加。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr style={{ textAlign: "center" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: `2px solid ${C.border}` }}>学生</th>
              {ACTIVITIES.map((a) => (
                <th key={a.key} style={{ padding: 8, borderBottom: `2px solid ${C.border}`, fontSize: 13 }}>{a.emoji}<br />{a.name}</th>
              ))}
              <th style={{ padding: 8, borderBottom: `2px solid ${C.border}` }}>完成度</th>
            </tr>
          </thead>
          <tbody>
            {names.map((nm) => {
              const rec = getStudent(nm) || { completed: [] };
              const comp = rec.completed || [];
              const ratio = comp.length / ACTIVITIES.length;
              return (
                <tr key={nm}>
                  <td style={{ padding: 8, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{nm}</td>
                  {ACTIVITIES.map((_, i) => (
                    <td key={i} style={{ textAlign: "center", padding: 8, borderBottom: `1px solid ${C.border}`, fontSize: 18 }}>
                      {comp.includes(i) ? "✅" : "⬜"}
                    </td>
                  ))}
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, minWidth: 120 }}>
                    <div style={{ background: "#EEE7DA", borderRadius: 999, height: 12, overflow: "hidden" }}>
                      <div style={{ width: ratio * 100 + "%", height: "100%", background: C.bamboo }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#8A8276" }}>{comp.length}/{ACTIVITIES.length}</span>
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
