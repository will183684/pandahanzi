import { useState } from "react";
import { C, LEVEL_BY_NO } from "../theme";
import { Card } from "../components/ui";
import Dashboard from "./Dashboard";
import LessonEditor from "./LessonEditor";
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
   Teacher / Admin area

   授课老师这边分成两件事，别混在一起：
     · 「📊 进度」  —— 布置课程给这个班 + 看孩子完成情况
     · 「📚 课程编辑」—— 改任意一节课的内容（字 / 录音 / 词句）
   以前只有一个「内容」页，只能改「正在上」的那节课，想回去改上一课
   得点「再上一次」，那会新建一条排课记录、录音看着就丢了。
   =================================================================== */
export default function TeacherArea({
  role, className, roster, activeClassId, classLessons, charsOf, session,
  lesson, chars, charsFor, progressRows, profiles, level, curriculum, myClassIds,
  onOpenPicker, onSaveLesson, onSaveChars, onCompleteLesson, onAfterSave,
  onOpenArchive, onLogout, onLeaveClass, onSaveClasses, pushToast, busy,
}) {
  const [view, setView] = useState("dashboard");
  const isAdmin = role === "admin";
  /* 教务管班级/老师/学生；授课老师有两个编辑界面：
     - 进度：布置课程给班级
     - 课程编辑：自由编辑任何课程的内容（不涉及班级） */
  const tabs = [{ k: "dashboard", t: "📊 进度" }];
  if (!isAdmin) tabs.push({ k: "editor", t: "📚 课程编辑" });
  tabs.push({ k: "curriculum", t: "📖 课程库" });   // 教务和老师都能查看课程库
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
        <>
          {!isAdmin && (
            <Card>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 10,
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {lesson ? `🔵 正在上：${lesson.title}` : "还没安排课程"}
                  </div>
                  <div style={{ fontSize: 13, color: "#9C9382" }}>
                    {lesson ? "换一节课后，这一节会记为已上过，内容和录音都留着。" : "先布置一节课，孩子那边才有练习。"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={onOpenPicker} style={{
                    minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none",
                    background: C.bamboo, color: "#fff", fontWeight: 800, cursor: "pointer",
                  }}>📚 布置课程</button>
                  {lesson && lesson.status === "active" && (
                    <button onClick={onCompleteLesson} disabled={busy} style={{
                      minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none",
                      background: C.gold, color: C.ink, fontWeight: 800, cursor: "pointer",
                    }}>✅ 完成本课</button>
                  )}
                </div>
              </div>
            </Card>
          )}
          <Dashboard roster={roster} progressRows={progressRows} lesson={lesson} profiles={profiles} />
        </>
      )}
      {view === "editor" && !isAdmin && (
        <LessonEditor
          classLessons={classLessons} charsOf={charsOf} curriculum={curriculum}
          session={session} pushToast={pushToast}
          onAfterSave={onAfterSave} onOpenPicker={onOpenPicker}
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
