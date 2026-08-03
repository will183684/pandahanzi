import { useState, useCallback, useEffect } from "react";
import { C } from "../theme";
import { BigButton } from "../components/ui";
import { playChar, stopAudio } from "../audio";

/* ===================================================================
   ACTIVITY 1 — 认一认 (Flashcards)

   要求孩子翻开卡片、听读音、然后大声跟读一遍。跟读不录音也不判分，
   靠界面提示 + 家长/老师在旁边监督。

   「读过」以翻开卡片为准：原来只要点「下一个」翻页就算数，
   不翻卡片也能通关；现在必须每张都翻开才出现完成按钮。
   =================================================================== */
export default function FlashcardActivity({ meta, onDone }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [read, setRead] = useState(() => new Set());   // 翻开过的卡片下标
  const chars = meta.chars;
  const allRead = read.size >= chars.length;
  const thisRead = read.has(idx);

  const go = useCallback((dir) => {
    setFlipped(false);
    stopAudio();
    setIdx((prev) => (prev + dir + chars.length) % chars.length);
  }, [chars.length]);

  /* 翻到背面时读一遍这个字：有老师录音放录音，否则 TTS。
     必须由点击直接触发，否则会被浏览器的自动播放策略拦掉。 */
  const toggle = useCallback(() => {
    const next = !flipped;
    setFlipped(next);
    if (next) {
      playChar(chars[idx], meta.audioMap);
      setRead((s) => (s.has(idx) ? s : new Set(s).add(idx)));
    }
  }, [flipped, chars, idx, meta.audioMap]);

  useEffect(() => stopAudio, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 16, color: "#6B6356", margin: "0 0 6px" }}>
          轻触卡片翻面，听清楚读音
        </p>
        <p style={{
          fontSize: 17, fontWeight: 800, color: C.red, margin: 0,
        }}>
          🗣️ 然后大声跟读一遍！
        </p>
      </div>

      <div
        onClick={toggle}
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
            border: `3px solid ${thisRead ? C.bamboo : C.border}`, borderRadius: 24,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
          }}>
            <span style={{ fontSize: 140, fontWeight: 800, lineHeight: 1 }}>{chars[idx]}</span>
            <span style={{ fontSize: 14, color: "#B7AE9F", marginTop: 10 }}>
              {thisRead ? "✅ 读过了，可以再读一遍" : "轻触翻面 →"}
            </span>
          </div>
          {/* back */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)",
            background: "#FFFBF2", border: `3px solid ${C.gold}`, borderRadius: 24, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{chars[idx]}</span>
            <span style={{ fontSize: 30, color: C.bamboo, fontWeight: 700 }}>{meta.pinyins[idx] || ""}</span>
            <span style={{ fontSize: 36 }}>{meta.emojiMap[chars[idx]] || "✨"}</span>
            <div style={{
              marginTop: 6, background: "#FFF1F0", border: `2px solid ${C.red}44`,
              borderRadius: 999, padding: "5px 14px", fontSize: 15, fontWeight: 800, color: C.red,
            }}>
              🗣️ 大声跟读一遍
            </div>
            <button
              onClick={(ev) => { ev.stopPropagation(); playChar(chars[idx], meta.audioMap); }}
              aria-label="再听一次"
              style={{
                marginTop: 6, minHeight: 44, minWidth: 44, padding: "6px 16px", borderRadius: 999,
                border: `2px solid ${C.bamboo}`, background: "#fff", color: C.bamboo,
                fontSize: 17, fontWeight: 800, cursor: "pointer",
              }}
            >🔊 再听</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <BigButton color={C.bamboo} light onClick={() => go(-1)}>← 上一个</BigButton>
        <span style={{ fontWeight: 800, color: "#8A8276" }}>{idx + 1} / {chars.length}</span>
        <BigButton color={C.bamboo} light onClick={() => go(1)}>下一个 →</BigButton>
      </div>

      {/* 进度：必须每张都翻开跟读过 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {chars.map((ch, i) => (
          <span key={i} style={{
            width: 30, height: 34, borderRadius: 8, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 17, fontWeight: 800,
            background: read.has(i) ? "#EAF6EC" : "#F4EEE3",
            border: `2px solid ${i === idx ? C.gold : read.has(i) ? C.bamboo : C.border}`,
            color: read.has(i) ? C.ink : "#C4BCAD",
          }}>{ch}</span>
        ))}
      </div>

      {allRead ? (
        <BigButton color={C.gold} onClick={onDone}>全部跟读完了！⭐</BigButton>
      ) : (
        <p style={{ fontSize: 14, color: "#9C9382", margin: 0 }}>
          还有 {chars.length - read.size} 个字没跟读
        </p>
      )}
    </div>
  );
}
