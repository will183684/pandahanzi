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

/* ===================== Small celebration overlay =====================
   做完一个活动后弹出。给出「再做一遍」和「回去」两个明确出口，
   不再用「轻触任意处」——免得孩子想重玩却被误关掉。 */
export function CelebrationOverlay({ text, avatar, onReplay, onClose }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 30, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(253,246,236,0.94)", textAlign: "center", padding: 24,
      }}
    >
      <Confetti count={70} />
      <div style={{ animation: "pa-jump 0.7s ease-in-out infinite" }}>
        <Panda sz={150} avatar={avatar} />
      </div>
      <div style={{ fontSize: 40, letterSpacing: 6, marginTop: 8 }}>⭐⭐⭐</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 10 }}>{text}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <BigButton color={C.gold} onClick={onReplay}>再做一遍 🔄</BigButton>
        <BigButton color={C.bamboo} onClick={onClose}>回去 →</BigButton>
      </div>
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
        {/* 表头用矢量熊猫而不是 logo 图：完整 logo 含两行英文和橙色横幅，
            缩到 38px 会糊成噪点。品牌名由旁边的文字承载。 */}
        <Panda sz={38} ex="neutral" />
        <span style={{ fontWeight: 800, fontSize: 17 }}>Panda Chinese</span>
        <span style={{ color: "#B7AE9F" }}>｜</span>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#6B6356" }}>中文识字</span>
      </header>
      {banner}
      <main style={{ flex: 1, width: "100%", maxWidth: 920, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
        {children}
      </main>
      <footer style={{ textAlign: "center", padding: "14px", color: "#9C9382", fontSize: 14 }}>
        一起学中文，天天有进步 🐼
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

/* ============================ Confirm dialog ============================
   自带的确认弹窗，别用原生 window.confirm —— 浏览器在连续弹几次之后会给
   用户「阻止此页面创建更多对话框」的选项，勾上以后 confirm() 直接返回
   false，操作静默失效、没有任何提示，看起来就像功能坏了。 */
export function ConfirmDialog({ text, onCancel, onConfirm, confirmLabel = "确定开始", cancelLabel = "再想想" }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 400, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <Panda sz={80} />
        </div>
        <p style={{ fontSize: 16, textAlign: "center", color: C.ink, lineHeight: 1.7, whiteSpace: "pre-line" }}>{text}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <BigButton color={C.bamboo} light onClick={onCancel} style={{ flex: "1 1 120px" }}>{cancelLabel}</BigButton>
          <BigButton color={C.red} onClick={onConfirm} style={{ flex: "1 1 120px" }}>{confirmLabel}</BigButton>
        </div>
      </div>
    </div>
  );
}
