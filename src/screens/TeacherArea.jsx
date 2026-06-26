import { useState } from "react";
import { C } from "../theme";
import Dashboard from "./Dashboard";
import ContentSettings from "./ContentSettings";
import StudentManager from "./StudentManager";
import TeacherManager from "./TeacherManager";

/* Shared ghost-button style, also reused by the review banner in App. */
export const ghostBtn = {
  minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `2px solid ${C.border}`,
  background: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

/* ===================================================================
   Teacher / Admin area (tabs: progress / content / students / teachers)
   =================================================================== */
export default function TeacherArea({ role, className, roster, meta, students, getStudent, onSave, onSaveAudio, onStartNewWeek, onOpenArchive, onLogout, onSaveClasses, activeClassId, pushToast }) {
  const [view, setView] = useState("dashboard");
  const isAdmin = role === "admin";
  const tabs = [{ k: "dashboard", t: "📊 进度" }, { k: "content", t: "✏️ 内容" }];
  if (isAdmin) tabs.push({ k: "students", t: "👧 学生" });
  if (isAdmin) tabs.push({ k: "teachers", t: "🧑‍🏫 老师" });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          🏫 {className || "班级"}
          <span style={{ fontSize: 13, color: "#8A8276", marginLeft: 8, fontWeight: 600 }}>
            {isAdmin ? "教务老师" : "授课老师"} · {meta.label} · {meta.chars.join("")}
          </span>
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onOpenArchive} style={ghostBtn}>📚 历史</button>
          <button onClick={onLogout} style={ghostBtn}>退出</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "14px 0", background: "#F1E9DC", padding: 6, borderRadius: 14 }}>
        {tabs.map((tb) => (
          <button key={tb.k} onClick={() => setView(tb.k)} style={{
            flex: 1, minHeight: 48, borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700,
            background: view === tb.k ? "#fff" : "transparent", color: view === tb.k ? C.ink : "#8A8276",
          }}>{tb.t}</button>
        ))}
      </div>

      {view === "dashboard" && <Dashboard roster={roster} students={students} getStudent={getStudent} />}
      {view === "content" && (
        <ContentSettings meta={meta} isAdmin={isAdmin} onSave={onSave} onSaveAudio={onSaveAudio} onStartNewWeek={onStartNewWeek} pushToast={pushToast} />
      )}
      {view === "students" && isAdmin && (
        <StudentManager activeClassId={activeClassId} onSaveClasses={onSaveClasses} pushToast={pushToast} />
      )}
      {view === "teachers" && isAdmin && (
        <TeacherManager pushToast={pushToast} />
      )}
    </div>
  );
}
