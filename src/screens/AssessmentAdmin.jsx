import { useState, useEffect, useCallback } from "react";
import { C } from "../theme";
import { Card, BigButton } from "../components/ui";
import { getAllAssessments, saveAssessmentResult } from "../supabaseClient";
import { SECTIONS, describeLevel } from "../assessment";
import Assessment from "./Assessment";

/* ===================================================================
   测评（教务）—— 招生时给孩子测一下水平，据此分班。

   为什么发起入口在教务这边而不是学生首页：招生时孩子还没入学，
   家长登录要求邀请码匹配且名字在班级名单里，新生根本登不进去。
   =================================================================== */
export default function AssessmentAdmin({ curriculum, classId, pushToast }) {
  const [rows, setRows] = useState(null);
  const [name, setName] = useState("");
  const [running, setRunning] = useState(null);   // 正在测的孩子名字

  const reload = useCallback(() => {
    getAllAssessments().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const begin = () => {
    const nm = name.trim();
    if (!nm) { pushToast("先填孩子的名字"); return; }
    setRunning(nm);
  };

  const onFinish = (results) => {
    saveAssessmentResult(classId, running, results)
      .then(() => { pushToast(`${running} 的测评已存档 ✅`); reload(); })
      .catch(() => pushToast("测评结果没能保存，报告仍然有效 ⚠️"));
  };

  if (running) {
    return (
      <Assessment
        curriculum={curriculum}
        currentLevel={1}                 /* 招生的孩子没有在学的课，从 L1 起考 */
        studentName={running}
        onExit={() => { setRunning(null); setName(""); reload(); }}
        onFinish={onFinish}
      />
    );
  }

  const inputStyle = {
    minHeight: 52, padding: "10px 14px", borderRadius: 12, fontSize: 16,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>📋 水平测评</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
        招生时给孩子测一测，识字量 / 阅读 / 书写三项各自定级，据此决定分到哪个班。
        题目自动出，大约 5 分钟。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <input
          style={{ ...inputStyle, flex: "1 1 160px" }}
          value={name}
          placeholder="孩子的名字（可以还没入学）"
          onChange={(ev) => setName(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && begin()}
        />
        <button onClick={begin} style={{
          minHeight: 52, padding: "0 18px", borderRadius: 12, border: "none",
          background: C.bamboo, color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
        }}>开始测评 🚀</button>
      </div>

      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
        测评记录
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
