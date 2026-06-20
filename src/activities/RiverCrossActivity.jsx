import { useState, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import Panda from "../components/Panda";

/* ===================================================================
   过河踩石 (Cross the river) — alternate game, not currently wired into
   ACTIVITIES. Tap the next character of the week's sentence to hop the
   panda across.
   =================================================================== */
export default function RiverCrossActivity({ meta, onDone }) {
  const seq = useMemo(() => (meta.sentence || "").split("").filter((c) => c.trim()), [meta.sentence]);
  const [step, setStep] = useState(0);
  const [splashId, setSplashId] = useState(null);

  // pre-build the choice pads for each step so they don't reshuffle on render
  const pads = useMemo(() => {
    return seq.map((correct, i) => {
      const pool = [...(meta.chars || []), ...(meta.distractors || [])].filter((c) => c !== correct);
      const others = shuffled(pool).slice(0, 2);
      return shuffled([correct, ...others]).map((ch, j) => ({ id: "p" + i + "_" + j, ch }));
    });
  }, [seq, meta.chars, meta.distractors]);

  const total = seq.length;
  const onTapPad = useCallback((pad) => {
    if (pad.ch === seq[step]) {
      setStep((prev) => {
        const next = prev + 1;
        if (next >= total) setTimeout(onDone, 450);
        return next;
      });
    } else {
      setSplashId(pad.id);
      setTimeout(() => setSplashId(null), 500);
    }
  }, [seq, step, total, onDone]);

  if (total === 0) {
    return <p style={{ color: "#9C9382", textAlign: "center" }}>老师还没设置“练习句子”，先去内容设置里填一句吧。</p>;
  }

  const pandaLeft = total > 0 ? ((step + 0.5) / total) * 100 : 0;
  const crossed = step >= total;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>按句子的顺序踩石头，帮胖胖过河回家！</p>

      {/* sentence progress with blank for the current spot */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {seq.map((ch, i) => (
          <span key={i} style={{
            width: 42, height: 50, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 800,
            background: i < step ? "#EAF6EC" : i === step ? "#FFFBF2" : "#F4EEE3",
            border: `2px solid ${i === step ? C.gold : i < step ? C.bamboo : C.border}`,
            color: i < step ? C.ink : i === step ? "#C9B36A" : "transparent",
          }}>
            {i < step ? ch : i === step ? "？" : ch}
          </span>
        ))}
      </div>

      {/* river scene */}
      <div style={{
        position: "relative", width: "min(94vw, 460px)", height: 120, borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(180deg,#BFE3F5,#7FC3E8)", border: `2px solid ${C.border}`,
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.4,
          background: "repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,.5) 18px 22px)",
          animation: "pa-water 3s linear infinite" }} />
        {/* far bank home */}
        <div style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 46, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🎋</div>
        {/* panda hopping across */}
        <div style={{
          position: "absolute", bottom: 8, left: `calc(${crossed ? 100 : pandaLeft}% - 26px)`,
          transition: "left .35s cubic-bezier(.34,1.56,.64,1)", animation: "pa-jump 1s ease-in-out infinite",
        }}>
          <Panda sz={52} ex={crossed ? "excited" : "focused"} />
        </div>
      </div>

      {/* stepping-stone choices for the current step */}
      {!crossed && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {pads[step].map((pad) => (
            <button
              key={pad.id}
              onClick={() => onTapPad(pad)}
              style={{
                position: "relative", width: 84, height: 84, minWidth: 56, borderRadius: "46% 46% 50% 50%",
                border: "3px solid #9aa17f", cursor: "pointer",
                background: "radial-gradient(circle at 40% 30%, #C8CBA6, #8E9472)",
                fontSize: 38, fontWeight: 800, color: C.ink,
                boxShadow: "0 5px 0 rgba(80,90,60,0.35)",
                animation: splashId === pad.id ? "pa-shake .4s" : "none",
              }}
            >
              {pad.ch}
              {splashId === pad.id && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>💦</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 800, color: "#8A8276" }}>已过 {Math.min(step, total)} / {total} 步</div>
    </div>
  );
}
