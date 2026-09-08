import { useState, useEffect, useCallback } from "react";
import { C } from "../theme";
import { Card } from "../components/ui";
import { getAllAssessments } from "../supabaseClient";
import { SECTIONS, describeLevel } from "../assessment";

/* ===================================================================
   测评记录（教务）—— 招生分班时看孩子的水平，据此决定分到哪个班。

   这里只看不测。测评是孩子在家长端做的：教务先把孩子加进班级，
   家长用邀请码登录，首页点「📋 测一测」。
   =================================================================== */
export default function AssessmentAdmin() {
  const [rows, setRows] = useState(null);

  const reload = useCallback(() => {
    getAllAssessments().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>📋 测评记录</h3>
        <button onClick={reload} style={{
          minHeight: 40, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.border}`,
          background: "#fff", color: "#8A8276", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>🔄 刷新</button>
      </div>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 6 }}>
        识字量 / 阅读 / 书写三项各自定级，招生分班时参考。
        测评由孩子在家长端做：把孩子加进班级后，家长用邀请码登录，首页点「📋 测一测」。
      </p>

      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
        全部记录
        {rows && <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 600 }}> · 共 {rows.length} 次</span>}
      </div>

      {rows === null && <p style={{ color: "#9C9382" }}>正在加载…</p>}
      {rows && rows.length === 0 && (
        <p style={{ color: "#9C9382", fontSize: 14 }}>
          还没有测评记录。如果一直是空的，可能是 assessments 这张表还没建。
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(rows || []).map((r) => (
          <div key={r.id} style={{
            border: `2px solid ${C.border}`, borderRadius: 14, padding: "10px 14px", background: "#fff",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 16 }}>{r.student_name}</b>
              <span style={{ fontSize: 12, color: "#9C9382" }}>
                {r.taken_at ? new Date(r.taken_at).toLocaleString("zh-CN") : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }}>
              {SECTIONS.map((s) => {
                const v = (r.results || {})[s.key] || {};
                const d = v.unavailable
                  ? { label: "没测成" }
                  : describeLevel(v.passed, v.capped);
                return (
                  <span key={s.key} style={{ fontSize: 14 }}>
                    <span style={{ color: "#8A8276" }}>{s.emoji} {s.name} </span>
                    <b style={{ color: v.unavailable ? "#9C9382" : C.bamboo }}>{d.label}</b>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
