import { useState, useCallback } from "react";
import { C } from "../theme";
import { BigButton } from "../components/ui";

/* ===================================================================
   ACTIVITY 1 — 认一认 (Flashcards)
   =================================================================== */
export default function FlashcardActivity({ meta, onDone }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(() => new Set([0]));
  const chars = meta.chars;
  const allSeen = seen.size >= chars.length;

  const go = useCallback((dir) => {
    setFlipped(false);
    setIdx((prev) => {
      const next = (prev + dir + chars.length) % chars.length;
      setSeen((s) => new Set(s).add(next));
      return next;
    });
  }, [chars.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>轻触卡片翻面，看看它读什么</p>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          width: "min(86vw, 320px)", height: 320, cursor: "pointer", perspective: 1000,
        }}
      >
        <div style={{
          position: "relative", width: "100%", height: "100%", transition: "transform .5s",
          transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none",
        }}>
          {/* front */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", background: C.card,
            border: `3px solid ${C.border}`, borderRadius: 24, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
          }}>
            <span style={{ fontSize: 150, fontWeight: 800 }}>{chars[idx]}</span>
          </div>
          {/* back */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)",
            background: "#FFFBF2", border: `3px solid ${C.gold}`, borderRadius: 24, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 96, fontWeight: 800 }}>{chars[idx]}</span>
            <span style={{ fontSize: 30, color: C.bamboo, fontWeight: 700 }}>{meta.pinyins[idx] || ""}</span>
            <span style={{ fontSize: 56 }}>{meta.emojiMap[chars[idx]] || "✨"}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <BigButton color={C.bamboo} light onClick={() => go(-1)}>← 上一个</BigButton>
        <span style={{ fontWeight: 800, color: "#8A8276" }}>{idx + 1} / {chars.length}</span>
        <BigButton color={C.bamboo} light onClick={() => go(1)}>下一个 →</BigButton>
      </div>

      {allSeen && (
        <BigButton color={C.gold} onClick={onDone} style={{ marginTop: 6 }}>全部认识了！⭐</BigButton>
      )}
    </div>
  );
}
