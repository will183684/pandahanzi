import { useState, useRef, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";

/* ===================================================================
   连一连 (Matching) — alternate game, not currently wired into ACTIVITIES.
   Kept available for future use. Replaced in the default set by 听一听.
   =================================================================== */
export default function MatchActivity({ meta, onDone }) {
  const chars = meta.chars;
  const rightItems = useMemo(
    () => shuffled(chars.map((ch) => ({ ch, emoji: meta.emojiMap[ch] || "✨" }))),
    [chars, meta.emojiMap]
  );
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState({}); // ch -> true
  const [lines, setLines] = useState([]); // {x1,y1,x2,y2,color,id}
  const wrapRef = useRef(null);
  const leftRefs = useRef({});
  const rightRefs = useRef({});

  const center = (el) => {
    const wrap = wrapRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top + r.height / 2 };
  };

  const onRight = useCallback((emojiChar) => {
    if (!selected) return;
    const leftEl = leftRefs.current[selected];
    const rightEl = rightRefs.current[emojiChar];
    if (!leftEl || !rightEl) return;
    const a = center(leftEl);
    const b = center(rightEl);
    if (emojiChar === selected) {
      const lid = "ln_" + selected;
      setLines((ls) => [...ls, { id: lid, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: C.bamboo }]);
      setMatched((m) => {
        const nm = { ...m, [selected]: true };
        if (Object.keys(nm).length >= chars.length) setTimeout(onDone, 350);
        return nm;
      });
      setSelected(null);
    } else {
      const wid = "wrong_" + Math.random().toString(36).slice(2, 6);
      setLines((ls) => [...ls, { id: wid, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: C.red, temp: true }]);
      setTimeout(() => setLines((ls) => ls.filter((l) => l.id !== wid)), 600);
      setSelected(null);
    }
  }, [selected, chars.length, onDone]);

  const cellStyle = (active, done) => ({
    width: "100%", minHeight: 56, padding: "10px 8px", borderRadius: 14, fontSize: 38, fontWeight: 800,
    border: `3px solid ${done ? C.gold : active ? C.bamboo : C.border}`,
    background: done ? "#FFFBF2" : active ? "#EAF6EC" : C.card,
    cursor: done ? "default" : "pointer", color: C.ink, opacity: done ? 0.55 : 1,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>先点左边的字，再点右边对应的图</p>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 440 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}>
          {lines.map((l) => (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.color} strokeWidth="5" strokeLinecap="round" opacity={l.temp ? 0.85 : 1} />
          ))}
        </svg>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chars.map((ch) => (
              <button
                key={ch}
                ref={(el) => { if (el) leftRefs.current[ch] = el; }}
                onClick={() => !matched[ch] && setSelected(ch)}
                style={cellStyle(selected === ch, matched[ch])}
              >
                {ch}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rightItems.map((it) => (
              <button
                key={it.ch}
                ref={(el) => { if (el) rightRefs.current[it.ch] = el; }}
                onClick={() => !matched[it.ch] && onRight(it.ch)}
                style={cellStyle(false, matched[it.ch])}
              >
                {it.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ color: "#8A8276", fontSize: 14 }}>已连对 {Object.keys(matched).length} / {chars.length}</div>
    </div>
  );
}
