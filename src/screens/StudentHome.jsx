import { useState, useEffect } from "react";
import { C, ACTIVITIES } from "../theme";
import Panda from "../components/Panda";
import { Confetti, BigButton } from "../components/ui";

/* ===================================================================
   Student Home
   =================================================================== */
export default function StudentHome({ studentName, meta, progress, readOnly, onOpenActivity, onOpenArchive, onLogout }) {
  const doneCount = ACTIVITIES.filter((_, i) => progress[i]).length;
  const allDone = doneCount === ACTIVITIES.length;
  const [showFinale, setShowFinale] = useState(false);

  useEffect(() => {
    if (allDone && !readOnly) setShowFinale(true);
  }, [allDone, readOnly]);

  const messages = ["继续加油，胖胖陪着你！", "你做得真好！", "再来一个就更厉害啦！", "了不起，快完成啦！", "全部完成，太厉害啦！"];

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
        <div style={{ animation: "pa-jump 1.4s ease-in-out infinite" }}>
          <Panda sz={120} ex="excited" />
        </div>
        <h1 style={{ margin: "6px 0 0", fontSize: 26 }}>你好，{studentName}！👋</h1>
        <span style={{
          display: "inline-block", background: "#EAF6EC", color: C.bamboo, fontWeight: 700,
          borderRadius: 999, padding: "6px 14px", fontSize: 15, border: `1px solid ${C.bamboo}33`,
        }}>
          {meta.label} · {meta.chars.join("")}
        </span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 22,
      }} className="pa-tile-grid">
        {ACTIVITIES.map((a, i) => (
          <button
            key={a.key}
            onClick={() => onOpenActivity(i)}
            style={{
              textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: 16,
              borderRadius: 18, border: `2px solid ${progress[i] ? C.gold : C.border}`,
              background: progress[i] ? "#FFFBF2" : C.card, cursor: "pointer", minHeight: 56,
            }}
          >
            <span style={{ fontSize: 38 }}>{a.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 19, fontWeight: 800 }}>{a.name}</span>
              <span style={{ display: "block", fontSize: 14, color: "#8A8276" }}>{a.desc}</span>
            </span>
            <span style={{ fontSize: 26 }}>{progress[i] ? "⭐" : ""}</span>
          </button>
        ))}
      </div>

      {/* progress paws */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
        {ACTIVITIES.map((_, i) => (
          <span key={i} style={{ fontSize: 30, filter: progress[i] ? "none" : "grayscale(1)", opacity: progress[i] ? 1 : 0.4 }}>🐾</span>
        ))}
      </div>
      <p style={{ textAlign: "center", color: C.bamboo, fontWeight: 700, marginTop: 8 }}>
        {messages[Math.min(doneCount, messages.length - 1)]}
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        <BigButton color={C.bamboo} light onClick={onOpenArchive}>📚 历史记录</BigButton>
        <button onClick={onLogout} style={{
          minHeight: 56, padding: "0 18px", background: "none", border: "none", color: "#9C9382",
          fontSize: 15, textDecoration: "underline", cursor: "pointer",
        }}>退出登录</button>
      </div>

      {showFinale && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(253,246,236,0.97)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: 24,
        }}>
          <Confetti count={120} />
          <div style={{ animation: "pa-jump 0.7s ease-in-out infinite" }}>
            <Panda sz={170} ex="excited" />
          </div>
          <div style={{ fontSize: 44, letterSpacing: 8, marginTop: 6 }}>🎓</div>
          <h2 style={{ fontSize: 26, margin: "8px 0" }}>本周全部完成！</h2>
          <p style={{ fontSize: 18, color: "#6B6356" }}>胖胖为你鼓掌！👏</p>
          <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
            <BigButton color={C.gold} onClick={() => { setShowFinale(false); onOpenArchive(); }}>查看历史记录 📚</BigButton>
            <BigButton color={C.bamboo} light onClick={() => setShowFinale(false)}>继续看看</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
