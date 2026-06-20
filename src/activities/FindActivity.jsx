import { useState, useEffect, useCallback } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";

/* ===================================================================
   ACTIVITY 2 — 找一找 (Find the character)
   =================================================================== */
export default function FindActivity({ meta, onDone }) {
  const targets = meta.chars;
  const [targetIdx, setTargetIdx] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [shakeId, setShakeId] = useState(null);

  useEffect(() => {
    // build 20 bubbles: each week char once, fill with distractors
    const pool = [];
    targets.forEach((ch) => pool.push(ch));
    const fillers = meta.distractors.length ? meta.distractors : ["大", "小", "上", "下"];
    let fi = 0;
    while (pool.length < 20) {
      pool.push(fillers[fi % fillers.length]);
      fi++;
    }
    const arranged = shuffled(pool).map((ch, i) => ({
      id: "b" + i + "_" + Math.random().toString(36).slice(2, 6),
      ch,
      top: 8 + Math.random() * 78,
      left: 6 + Math.random() * 80,
      dur: 3 + Math.random() * 3,
      delay: Math.random() * 2,
      gone: false,
    }));
    setBubbles(arranged);
  }, [meta, targets]);

  const current = targets[targetIdx];

  const onTap = useCallback((b) => {
    if (b.gone) return;
    if (b.ch === current) {
      setBubbles((list) => list.map((x) => (x.id === b.id ? { ...x, gone: true } : x)));
      setTimeout(() => {
        setTargetIdx((t) => {
          if (t + 1 >= targets.length) {
            onDone();
            return t;
          }
          return t + 1;
        });
      }, 350);
    } else {
      setShakeId(b.id);
      setTimeout(() => setShakeId(null), 450);
    }
  }, [current, targets.length, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 18, color: "#6B6356", fontWeight: 700 }}>找一找：</span>
        <span style={{ fontSize: 48, fontWeight: 800, color: C.red, lineHeight: 1 }}>{current}</span>
        <span style={{ fontSize: 15, color: "#8A8276" }}>（{targetIdx + 1}/{targets.length}）</span>
      </div>
      <div style={{
        position: "relative", width: "100%", maxWidth: 720, height: 440,
        background: "linear-gradient(135deg,#FFE9F1 0%,#FFF3DE 30%,#E7F6FF 62%,#E6F8EC 100%)",
        border: `2px solid ${C.border}`, borderRadius: 20, overflow: "hidden",
      }}>
        {/* soft decorative color blobs */}
        <div style={{ position: "absolute", width: 220, height: 220, top: -60, left: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,200,66,0.25), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 260, height: 260, bottom: -80, right: -50, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,175,114,0.22), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 180, height: 180, top: 110, left: "55%", borderRadius: "50%", background: "radial-gradient(circle, rgba(127,178,240,0.20), transparent 70%)", pointerEvents: "none" }} />

        {bubbles.map((b) => (
          b.gone ? (
            <div key={b.id} style={{
              position: "absolute", top: b.top + "%", left: b.left + "%", fontSize: 36,
              animation: "pa-pop .4s ease forwards", pointerEvents: "none",
            }}>💥</div>
          ) : (
            <button
              key={b.id}
              onClick={() => onTap(b)}
              style={{
                position: "absolute", top: b.top + "%", left: b.left + "%",
                width: 66, height: 66, minWidth: 56, minHeight: 56, borderRadius: "50%",
                border: "1.5px solid rgba(255,255,255,0.85)", cursor: "pointer",
                background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.96), rgba(214,236,255,0.6) 45%, rgba(180,216,248,0.5) 72%, rgba(255,255,255,0.22))",
                boxShadow: "0 6px 14px rgba(90,130,180,0.20), inset 0 -4px 8px rgba(120,160,210,0.18), inset 0 4px 8px rgba(255,255,255,0.7)",
                fontSize: 30, fontWeight: 800, color: C.ink,
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: `pa-float ${b.dur}s ease-in-out ${b.delay}s infinite${shakeId === b.id ? ", pa-shake .4s" : ""}`,
              }}
            >
              <span style={{ position: "absolute", top: 9, left: 13, width: 16, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.9)", transform: "rotate(-18deg)", pointerEvents: "none" }} />
              <span style={{ position: "relative" }}>{b.ch}</span>
            </button>
          )
        ))}
      </div>
      <p style={{ color: "#8A8276", fontSize: 14 }}>点对了会“爆开”，点错了会摇一摇～</p>
    </div>
  );
}
