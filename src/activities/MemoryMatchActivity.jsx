import { useState, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";

/* ===================================================================
   翻翻配对 (Memory match) — alternate game, not currently wired into
   ACTIVITIES. Pure tap, no audio. Flip two cards; match a character to
   its picture.
   =================================================================== */
export default function MemoryMatchActivity({ meta, onDone }) {
  const chars = meta.chars;
  const deck = useMemo(() => {
    const cards = [];
    chars.forEach((ch, i) => {
      cards.push({ id: "c" + i, key: ch, kind: "char", label: ch });
      cards.push({ id: "e" + i, key: ch, kind: "emoji", label: meta.emojiMap[ch] || "✨" });
    });
    return shuffled(cards);
  }, [chars, meta.emojiMap]);

  const [flipped, setFlipped] = useState([]); // indices currently face-up (max 2)
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
      const a = nf[0];
      const b = nf[1];
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

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>翻开两张卡片，把字和它的图配成一对！</p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(68px, 1fr))",
        gap: 10, width: "min(94vw, 420px)",
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
                aspectRatio: "1 / 1", minHeight: 68, borderRadius: 16,
                cursor: isMatched ? "default" : "pointer",
                border: "3px solid " + (isMatched ? C.bamboo : C.border),
                background: isUp
                  ? (isMatched ? "#EAF6EC" : "#FFFFFF")
                  : "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
                fontSize: card.kind === "emoji" ? 38 : 36, fontWeight: 800, color: C.ink,
                display: "flex", alignItems: "center", justifyContent: "center",
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
