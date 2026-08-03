import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import { BigButton } from "../components/ui";
import Panda from "../components/Panda";

/* ===================================================================
   抢一抢 —— 限时快速识字。看汉字，在倒计时内点出正确读音。
   对应马立平的「限時搶答 / 快速識字」。

   方向特意选「字 → 拼音」：
     认一认 = 自己翻卡片（自定进度）
     听一听 = 音 → 字
     抢一抢 = 字 → 音，且有时间压力
   三者不重复。

   干扰项取自本课其他字的读音（去重），所以难度天然贴合当前课。
   =================================================================== */

const ROUND_MS = 6000;   // 每个字的作答时间，想调难度改这里

export default function SpeedActivity({ meta, onDone }) {
  const chars = meta.chars;
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);      // [{ch, ok}]
  const [left, setLeft] = useState(ROUND_MS);
  const [phase, setPhase] = useState("play");      // play | feedback | done

  const target = chars[idx];
  const correct = meta.pinyins[idx] || "";

  const options = useMemo(() => {
    const others = [...new Set(meta.pinyins.filter((p, i) => p && i !== idx && p !== correct))];
    return shuffled([correct, ...shuffled(others).slice(0, 3)].filter(Boolean));
  }, [idx, correct, meta.pinyins]);

  /* answer 会被计时器调用，用 ref 避免把它塞进计时器的依赖里反复重启 */
  const answerRef = useRef(null);

  const answer = useCallback((p) => {
    if (phase !== "play") return;
    const ok = p === correct;
    setPicked(p);
    setResults((r) => [...r, { ch: target, ok }]);
    setPhase("feedback");
    setTimeout(() => {
      if (idx + 1 >= chars.length) {
        setPhase("done");
      } else {
        setIdx((i) => i + 1);
        setPicked(null);
        setPhase("play");
      }
    }, ok ? 550 : 1200);
  }, [phase, correct, target, idx, chars.length]);

  answerRef.current = answer;

  /* 倒计时：每换一个字重开 */
  useEffect(() => {
    if (phase !== "play") return undefined;
    setLeft(ROUND_MS);
    const start = Date.now();
    const t = setInterval(() => {
      const remain = ROUND_MS - (Date.now() - start);
      if (remain <= 0) {
        clearInterval(t);
        answerRef.current(null);       // 超时算答错
      } else {
        setLeft(remain);
      }
    }, 80);
    return () => clearInterval(t);
  }, [idx, phase]);

  /* ---------------- 成绩单 ---------------- */
  if (phase === "done") {
    const right = results.filter((r) => r.ok).length;
    const ratio = right / chars.length;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.4 ? 1 : 0;
    const wrong = results.filter((r) => !r.ok).map((r) => r.ch);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
        <Panda sz={110} ex={stars >= 2 ? "excited" : "focused"} />
        <div style={{ fontSize: 34, letterSpacing: 4 }}>
          {"⭐".repeat(stars)}{"☆".repeat(3 - stars)}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          答对 {right} / {chars.length}
        </div>
        {wrong.length > 0 && (
          <div style={{
            background: "#FFFBF2", border: `2px solid ${C.gold}55`, borderRadius: 14,
            padding: "10px 16px", maxWidth: 340,
          }}>
            <div style={{ fontSize: 13, color: "#9C9382", marginBottom: 4 }}>这几个再练练：</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 6 }}>{wrong.join("")}</div>
          </div>
        )}
        <BigButton color={C.gold} onClick={onDone} style={{ marginTop: 6 }}>完成 ⭐</BigButton>
      </div>
    );
  }

  /* ---------------- 答题中 ---------------- */
  const pct = Math.max(0, (left / ROUND_MS) * 100);
  const urgent = left < 2000;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ fontSize: 16, color: "#6B6356", margin: 0 }}>这个字读什么？快点出来！</p>

      {/* 倒计时条 */}
      <div style={{
        width: "min(92vw, 420px)", height: 14, borderRadius: 999,
        background: "#EEE7DA", overflow: "hidden",
      }}>
        <div style={{
          width: pct + "%", height: "100%",
          background: urgent ? C.red : C.bamboo,
          transition: "width .1s linear",
        }} />
      </div>

      <div style={{
        fontSize: "min(140px, 34vw)", fontWeight: 800, lineHeight: 1.1,
        color: phase === "feedback" ? (picked === correct ? C.bamboo : C.red) : C.ink,
        animation: phase === "feedback" && picked !== correct ? "pa-shake .4s" : "none",
      }}>
        {target}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "min(92vw, 380px)" }}>
        {options.map((p) => {
          const isCorrect = phase === "feedback" && p === correct;
          const isWrongPick = phase === "feedback" && p === picked && p !== correct;
          return (
            <button
              key={p}
              onClick={() => answer(p)}
              disabled={phase !== "play"}
              style={{
                minHeight: 68, borderRadius: 16, fontSize: 24, fontWeight: 800,
                cursor: phase === "play" ? "pointer" : "default",
                border: "3px solid " + (isCorrect ? C.bamboo : isWrongPick ? C.red : C.border),
                background: isCorrect ? "#EAF6EC" : isWrongPick ? "#FDECEA" : C.card,
                color: isCorrect ? C.bamboo : isWrongPick ? C.red : C.ink,
                animation: isWrongPick ? "pa-shake .4s" : "none",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>

      {phase === "feedback" && picked === null && (
        <p style={{ color: C.red, fontWeight: 700, margin: 0 }}>时间到！这个字读「{correct}」</p>
      )}

      <div style={{ fontWeight: 800, color: "#8A8276" }}>
        第 {idx + 1} / {chars.length} 个　·　已答对 {results.filter((r) => r.ok).length}
      </div>
    </div>
  );
}
