import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import { BigButton } from "../components/ui";

/* ===================================================================
   听一听 (Listen & Choose) — alternate game, not currently wired into
   ACTIVITIES. Plays the character's sound via browser SpeechSynthesis
   (or a teacher recording); the child taps the matching character.
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
    const picks = shuffled(fillers).slice(0, 3);
    return shuffled([target, ...picks]);
  }, [target, meta.distractors]);

  const speak = useCallback((text) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) { setAudioOk(false); return; }
      // Only clear the queue if something is actually playing/pending —
      // calling cancel() every time is what tends to wedge the engine.
      // Speak SYNCHRONOUSLY so it stays tied to the user gesture (a
      // deferred speak gets blocked by the browser's autoplay policy).
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = 0.8;
      const voices = synth.getVoices() || [];
      const zh = voices.find((v) => /zh|cmn|chinese/i.test(v.lang) || /chinese|中文|普通话/i.test(v.name));
      if (zh) u.voice = zh;
      u.onerror = () => { /* swallow transient engine errors */ };
      synth.speak(u);
    } catch (err) {
      setAudioOk(false);
    }
  }, []);

  // Keep-alive: resume() while speaking defeats the "stops after ~15s"
  // bug; cancel any lingering speech when leaving the activity.
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return undefined;
    const keepAlive = setInterval(() => {
      try { if (synth.speaking) synth.resume(); } catch (e) { /* ignore */ }
    }, 8000);
    return () => {
      clearInterval(keepAlive);
      try { synth.cancel(); } catch (e) { /* ignore */ }
    };
  }, []);

  // Play the teacher's recording if one exists, else fall back to TTS.
  const audioElRef = useRef(null);
  const playSound = useCallback((ch) => {
    const url = meta.audioMap && meta.audioMap[ch];
    if (url) {
      try {
        if (!audioElRef.current) audioElRef.current = new window.Audio();
        const el = audioElRef.current;
        el.src = url;
        el.currentTime = 0;
        const p = el.play();
        if (p && p.catch) p.catch(() => speak(ch));
        return;
      } catch (e) { /* fall through to TTS */ }
    }
    speak(ch);
  }, [meta.audioMap, speak]);

  // play whenever the target character changes
  useEffect(() => {
    const t = setTimeout(() => playSound(target), 250);
    return () => clearTimeout(t);
  }, [target, playSound]);

  const onPick = useCallback((ch) => {
    if (solved) return;
    if (ch === target) {
      setSolved(true);
      setTimeout(() => {
        if (idx + 1 >= chars.length) {
          onDone();
        } else {
          setIdx((i) => i + 1);
          setSolved(false);
        }
      }, 650);
    } else {
      setShakeCh(ch);
      setTimeout(() => setShakeCh(null), 450);
    }
  }, [solved, target, idx, chars.length, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>听一听胖胖读的是哪个字，点出来！</p>

      <button
        onClick={() => playSound(target)}
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
      <BigButton color={C.bamboo} light onClick={() => playSound(target)}>再听一次 🔁</BigButton>

      {!audioOk && !(meta.audioMap && meta.audioMap[target]) && (
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
