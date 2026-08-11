import { useState } from "react";
import { C, ACTIVITIES } from "../theme";
import { ConfirmDialog } from "../components/ui";

/* ===================================================================
   历史记录 —— 本班上过的课，倒序排列，可进入回顾模式重玩。
   =================================================================== */
export default function ArchivePanel({ lessons, currentId, charsOf, getProgress, onClose, onReview, canDelete, onDelete }) {
  const [pending, setPending] = useState(null);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
      <div style={{
        position: "relative", width: "min(420px, 92vw)", height: "100%", background: C.bg,
        borderLeft: `1px solid ${C.border}`, overflowY: "auto", animation: "pa-slidein .3s ease",
        padding: 18, boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>📚 历史记录</h2>
          <button onClick={onClose} style={{
            minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.border}`,
            background: "#fff", fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>

        {(!lessons || lessons.length === 0) && (
          <p style={{ color: "#9C9382", fontSize: 15 }}>还没有上过的课。</p>
        )}

        {(lessons || []).map((l) => {
          const pr = getProgress(l.id);
          const stars = ACTIVITIES.filter((_, i) => pr[i]).length;
          const isCur = l.id === currentId;
          return (
            <div key={l.id} style={{
              background: isCur ? "#EAF6EC" : C.card, border: `2px solid ${isCur ? C.bamboo : C.border}`,
              borderRadius: 16, padding: 16, marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 19, fontWeight: 800 }}>{l.title}</span>
                {isCur && (
                  <span style={{ fontSize: 13, color: C.bamboo, fontWeight: 700 }}>
                    {l.status === "active" ? "正在上" : "刚上完"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#9C9382", margin: "2px 0 6px" }}>
                第 {l.seq} 次课 · {new Date(l.started_at).toLocaleDateString("zh-CN")}
              </div>
              <div style={{ fontSize: 22, letterSpacing: 2, marginBottom: 6 }}>
                {"⭐".repeat(stars)}{"☆".repeat(ACTIVITIES.length - stars)}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4 }}>{charsOf(l.id)}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {!isCur && (
                  <button onClick={() => onReview(l.id)} style={{
                    minHeight: 48, padding: "0 16px", borderRadius: 12, border: "none",
                    background: C.gold, fontWeight: 800, fontSize: 15, cursor: "pointer", color: C.ink,
                  }}>查看回顾 →</button>
                )}
                {canDelete && (
                  <button onClick={() => setPending(l)} style={{
                    minHeight: 48, padding: "0 14px", borderRadius: 12,
                    border: `2px solid ${C.red}44`, background: "#fff", color: C.red,
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}>删除这次课</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pending && (
        <ConfirmDialog
          text={
            `确定删除「${pending.title}」这次课吗？\n\n`
            + `字表和所有学生在这次课的进度都会一起删掉，无法撤销。\n`
            + `课程库不受影响，以后还能重新选这一课。`
          }
          confirmLabel="确定删除"
          cancelLabel="不删了"
          onCancel={() => setPending(null)}
          onConfirm={() => { const id = pending.id; setPending(null); onDelete(id); }}
        />
      )}
    </div>
  );
}
