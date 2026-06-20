import { useMemo } from "react";
import { C } from "../theme";
import Panda from "./Panda";

/* ============================ Confetti ============================ */
export function Confetti({ count = 80 }) {
  const palette = [C.gold, C.bamboo, C.red, "#7FB2F0", "#F19CC2"];
  const pieces = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2 + Math.random() * 1.8,
        color: palette[i % palette.length],
        size: 7 + Math.random() * 8,
        rot: Math.random() * 360,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "-20px",
            left: p.left + "%",
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `pa-fall ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ===================== Small celebration overlay ===================== */
export function CelebrationOverlay({ text, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 30, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(253,246,236,0.94)", textAlign: "center", padding: 24, cursor: "pointer",
      }}
    >
      <Confetti count={70} />
      <div style={{ animation: "pa-jump 0.7s ease-in-out infinite" }}>
        <Panda sz={150} ex="excited" />
      </div>
      <div style={{ fontSize: 40, letterSpacing: 6, marginTop: 8 }}>⭐⭐⭐</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 10 }}>{text}</div>
      <div style={{ marginTop: 16, fontSize: 15, color: "#8A8276" }}>轻触任意处继续</div>
    </div>
  );
}

/* ============================== Toast ============================== */
export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: C.ink, color: "#fff", padding: "12px 20px", borderRadius: 14,
      fontSize: 15, fontWeight: 600, zIndex: 999, maxWidth: "88%",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "pa-toast 0.25s ease",
    }}>
      {msg}
    </div>
  );
}

/* ============================ Big button ============================ */
export function BigButton({ children, onClick, color = C.bamboo, light, style, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 56, padding: "14px 26px", borderRadius: 18, fontSize: 19, fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer", border: light ? `2px solid ${color}` : "none",
        background: disabled ? "#D8D2C6" : light ? "#fff" : color,
        color: light ? color : "#fff", transition: "transform .08s, filter .15s",
        boxShadow: light ? "none" : "0 4px 0 rgba(0,0,0,0.12)", ...style,
      }}
      onMouseDown={(ev) => { ev.currentTarget.style.transform = "translateY(2px)"; }}
      onMouseUp={(ev) => { ev.currentTarget.style.transform = "translateY(0)"; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

/* ============================== Shell ============================== */
export function Shell({ children, banner }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "flex", flexDirection: "column",
      fontFamily: "'PingFang SC','Microsoft YaHei','Hiragino Sans GB',system-ui,sans-serif" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        background: C.card, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20,
      }}>
        <Panda sz={38} ex="neutral" />
        <span style={{ fontWeight: 800, fontSize: 17 }}>熊猫画画班</span>
        <span style={{ color: "#B7AE9F" }}>｜</span>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#6B6356" }}>汉字练习</span>
      </header>
      {banner}
      <main style={{ flex: 1, width: "100%", maxWidth: 920, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
        {children}
      </main>
      <footer style={{ textAlign: "center", padding: "14px", color: "#9C9382", fontSize: 14 }}>
        画画写字，一起进步 🐼
      </footer>
    </div>
  );
}

/* =========================== Card helper =========================== */
export function Card({ children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, ...style }}>
      {children}
    </div>
  );
}

/* ============================ Confirm dialog ============================ */
export function ConfirmDialog({ text, onCancel, onConfirm }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <Panda sz={80} ex="focused" />
        </div>
        <p style={{ fontSize: 17, textAlign: "center", color: C.ink, lineHeight: 1.6 }}>{text}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <BigButton color={C.bamboo} light onClick={onCancel} style={{ flex: 1 }}>再想想</BigButton>
          <BigButton color={C.red} onClick={onConfirm} style={{ flex: 1 }}>确定开始</BigButton>
        </div>
      </div>
    </div>
  );
}
