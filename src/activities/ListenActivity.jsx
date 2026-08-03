import { useState, useEffect, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import { BigButton } from "../components/ui";
import { playChar, stopAudio } from "../audio";

/* ===================================================================
   听一听 —— 放字音（老师录音优先，否则 TTS），孩子从四个字里点出来。
   对应马立平的「听音辨字」。
   =================================================================== */
export default function ListenActivity({ meta, onDone }) {
  const chars = meta.chars;
  const [idx, setIdx] = useState(0);
  const [shakeCh, setShakeCh] = useState(null);
  const [solved, setSolved] = useState(false);
  const [audioOk, setAudioOk] = useState(true);
  const target = chars[idx];

  const options = useMemo(() => {
    const fillers = (meta.distractors && meta.distractors.length ? meta.distractors : ["大", "小", "上", "下"])
      .filter((d) => d !== target);
    return shuffled([target, ...shuffled(fillers).slice(0, 3)]);
  }, [target, meta.distractors]);

  const play = useCallback(() => {
    setAudioOk(playChar(target, meta.audioMap));
  }, [target, meta.audioMap]);

  /* 换到下一个字时自动播一次 */
  useEffect(() => {
    const t = setTimeout(play, 250);
    return () => clearTimeout(t);
  }, [play]);

  useEffect(() => stopAudio, []);

  const onPick = useCallback((ch) => {
    if (solved) return;
    if (ch === target) {
      setSolved(true);
      setTimeout(() => {
        if (idx + 1 >= chars.length) onDone();
        else { setIdx((i) => i + 1); setSolved(false); }
      }, 650);
    } else {
      setShakeCh(ch);
      setTimeout(() => setShakeCh(null), 450);
    }
  }, [solved, target, idx, chars.length, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>听一听读的是哪个字，点出来！</p>

      <button
        onClick={play}
        aria-label="播放字音"
        style={{
          width: 130, height: 130, minWidth: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
          boxShadow: "0 6px 0 rgba(0,0,0,0.12)", fontSize: 60, color: C.ink,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: solved ? "none" : "pa-pulse 1.6s ease-in-out infinite",
        }}
      >
        🔊
      </button>
      <BigButton color={C.bamboo} light onClick={play}>再听一次 🔁</BigButton>

      {!audioOk && (
        <p style={{ color: C.red, fontSize: 13, margin: 0, textAlign: "center" }}>
          这个设备暂时放不出声音，小提示：这个字读「{meta.pinyins[idx] || ""}」
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "min(92vw, 360px)" }}>
        {options.map((ch) => {
          const isCorrect = solved && ch === target;
          return (
            <button
              key={ch}
              onClick={() => onPick(ch)}
              style={{
                minHeight: 92, borderRadius: 18, fontSize: 56, fontWeight: 800, color: C.ink, cursor: "pointer",
                border: "3px solid " + (isCorrect ? C.bamboo : C.border),
                background: isCorrect ? "#EAF6EC" : C.card,
                animation: shakeCh === ch ? "pa-shake .4s" : "none",
              }}
            >
              {ch}
            </button>
          );
        })}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>第 {idx + 1} / {chars.length} 个</div>
    </div>
  );
}
