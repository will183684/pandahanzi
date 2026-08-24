import { useState } from "react";
import { C, LEVEL_BY_NO } from "../theme";
import Dashboard from "./Dashboard";
import ContentSettings from "./ContentSettings";
import StudentManager from "./StudentManager";
import TeacherManager from "./TeacherManager";
import ClassManager from "./ClassManager";
import CurriculumBrowser from "./CurriculumBrowser";

/* Shared ghost-button style, also reused by the review banner in App. */
export const ghostBtn = {
  minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `2px solid ${C.border}`,
  background: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

/* ===================================================================
   Teacher / Admin area (tabs: progress / content / students / teachers)
   =================================================================== */
export default function TeacherArea({
  role, className, roster, activeClassId,
  lesson, chars, charsFor, progressRows, profiles, level, curriculum, myClassIds,
  onOpenPicker, onSaveLesson, onSaveChars, onCompleteLesson,
  onOpenArchive, onLogout, onLeaveClass, onSaveClasses, pushToast, busy,
}) {
  const [view, setView] = useState("dashboard");
  const isAdmin = role === "admin";
  /* 教务管班级/老师/学生；备课（选课、改字表）是授课老师的事，
     所以「内容」只给授课老师看。 */
  const tabs = [{ k: "dashboard", t: "📊 进度" }];
  if (!isAdmin) tabs.push({ k: "content", t: "✏️ 内容" });
  tabs.push({ k: "curriculum", t: "📖 课程库" });   // 教务和老师都能布置课程
  if (isAdmin) {
    tabs.push(
      { k: "classes", t: "🏫 班级" },
      { k: "students", t: "👧 学生" },
      { k: "teachers", t: "🧑‍🏫 老师" },
    );
  }

  const charsPreview = (chars || []).map((c) => c.hanzi).join("");
  const lv = level ? LEVEL_BY_NO[level] : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 24, margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>🏫 {className || "班级"}</span>
          {lv && (
            <span style={{
              background: lv.color, color: "#fff", fontSize: 12, fontWeight: 800,
              borderRadius: 6, padding: "3px 8px",
            }}>{lv.name} {lv.sub}</span>
          )}
          <span style={{ fontSize: 13, color: "#8A8276", fontWeight: 600 }}>
            {isAdmin ? "教务老师" : "授课老师"}
            {lesson ? ` · ${lesson.title} · ${charsPreview}` : " · 未安排课程"}
          </span>
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onOpenArchive} style={ghostBtn}>📚 历史</button>
          {/* 只退出这个班，身份保留 —— 回到选班级那一屏，不用重新输口令 */}
          <button onClick={onLeaveClass} style={ghostBtn}>← 换班级</button>
          <button onClick={onLogout} style={{ ...ghostBtn, color: "#9C9382" }}>退出登录</button>
        </div>
      </div>

      <div style={{
        display: "flex", gap: 6, margin: "14px 0", background: "#F1E9DC",
        padding: 6, borderRadius: 14, flexWrap: "wrap",
      }}>
        {tabs.map((tb) => (
          <button key={tb.k} onClick={() => setView(tb.k)} style={{
            flex: "1 1 100px", minHeight: 48, borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 15, whiteSpace: "nowrap",
            background: view === tb.k ? "#fff" : "transparent", color: view === tb.k ? C.ink : "#8A8276",
            boxShadow: view === tb.k ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
          }}>{tb.t}</button>
        ))}
      </div>

      {view === "dashboard" && (
        <Dashboard roster={roster} progressRows={progressRows} lesson={lesson} profiles={profiles} />
      )}
      {view === "content" && !isAdmin && (
        <ContentSettings
          lesson={lesson} chars={chars} charsFor={charsFor} busy={busy} pushToast={pushToast}
          onOpenPicker={onOpenPicker} onSaveLesson={onSaveLesson}
          onSaveChars={onSaveChars} onCompleteLesson={onCompleteLesson}
          onBack={() => setView("dashboard")}
        />
      )}
      {view === "curriculum" && (
        <CurriculumBrowser
          curriculum={curriculum}
          myClassIds={isAdmin ? null : myClassIds}
          activeClassId={activeClassId}
          pushToast={pushToast}
        />
      )}
      {view === "classes" && isAdmin && (
        <ClassManager
          activeClassId={activeClassId} onSaveClasses={onSaveClasses}
          onLeaveClass={onLeaveClass} pushToast={pushToast}
        />
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
