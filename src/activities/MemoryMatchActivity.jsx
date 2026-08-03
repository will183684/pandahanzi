import { useState, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";

/* ===================================================================
   翻翻配对 —— 翻开两张卡，把「字」和它的「读音/图」配成一对。
   对应马立平的「图字匹配」。

   配对面优先用 emoji，没有就用拼音 —— 字库里绝大多数字没有配图，
   全用 emoji 的话每张背面都是 ✨，游戏就废了。
   =================================================================== */
export default function MemoryMatchActivity({ meta, onDone }) {
  const chars = meta.chars;

  const deck = useMemo(() => {
    const cards = [];
    chars.forEach((ch, i) => {
      const face = meta.emojiMap[ch] || meta.pinyins[i] || ch;
      cards.push({ id: "c" + i, key: ch, kind: "char", label: ch });
      cards.push({ id: "f" + i, key: ch, kind: "face", label: face });
    });
    return shuffled(cards);
  }, [chars, meta.emojiMap, meta.pinyins]);

  const [flipped, setFlipped] = useState([]);        // 当前正面朝上的下标（最多 2）
  const [matched, setMatched] = useState(() => new Set());
  const [lock, setLock] = useState(false);
  const total = deck.length;
  const pairsDone = matched.size / 2;

  const onFlip = useCallback((i) => {
    if (lock) return;
    if (matched.has(deck[i].id)) return;
    if (flipped.includes(i)) return;
    const nf = [...flipped, i];
    setFlipped(nf);
    if (nf.length === 2) {
      setLock(true);
      const [a, b] = nf;
      if (deck[a].key === deck[b].key) {
        setTimeout(() => {
          setMatched((prev) => {
            const ns = new Set(prev);
            ns.add(deck[a].id);
            ns.add(deck[b].id);
            if (ns.size >= total) setTimeout(onDone, 350);
            return ns;
          });
          setFlipped([]);
          setLock(false);
        }, 380);
      } else {
        setTimeout(() => { setFlipped([]); setLock(false); }, 850);
      }
    }
  }, [lock, matched, flipped, deck, total, onDone]);

  /* 拼音比汉字/emoji 长，字号要小一些才放得下 */
  const faceSize = (card) => {
    if (card.kind === "char") return 34;
    const n = String(card.label).length;
    if (n <= 2) return 34;
    if (n <= 4) return 20;
    return 16;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>翻开两张卡片，把字和它的读音配成一对！</p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
        gap: 8, width: "min(94vw, 440px)",
      }}>
        {deck.map((card, i) => {
          const isMatched = matched.has(card.id);
          const isUp = isMatched || flipped.includes(i);
          return (
            <button
              key={card.id}
              onClick={() => onFlip(i)}
              disabled={isMatched}
              style={{
                aspectRatio: "1 / 1", minHeight: 64, borderRadius: 16, padding: 2,
                cursor: isMatched ? "default" : "pointer",
                border: "3px solid " + (isMatched ? C.bamboo : C.border),
                background: isUp
                  ? (isMatched ? "#EAF6EC" : "#FFFFFF")
                  : "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
                fontSize: isUp ? faceSize(card) : 30,
                fontWeight: 800, color: card.kind === "face" ? C.bamboo : C.ink,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", wordBreak: "break-all", lineHeight: 1.1,
                opacity: isMatched ? 0.6 : 1, transition: "background .2s, opacity .2s",
                animation: isUp ? "pa-pop .25s ease" : "none",
              }}
            >
              {isUp ? card.label : "🐼"}
            </button>
          );
        })}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>已配对 {pairsDone} / {chars.length} 对</div>
    </div>
  );
}
