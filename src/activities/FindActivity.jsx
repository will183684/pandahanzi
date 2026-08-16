import { useState, useEffect, useCallback, useRef } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";

/* ===================================================================
   ACTIVITY 2 — 找一找 (Find the character)
   =================================================================== */
const COUNT = 20;
const BOARD_H = 440;
const FLOAT = 5;        // 漂浮动画的最大位移，算间距时要把它算进去

/* 随机撒点，但拒绝离已有气泡太近的位置（Poisson-disk 的简化版）。
   以前是纯 random 的 top/left，两个气泡经常压在一起，孩子点不中下面那个；
   改成规整网格又太死板。这里保持看上去毫无规律，同时保证圆和圆不相碰。
   撒不下时退而求其次：选离别人最远的那个候选点，绝不硬塞。 */
function scatter(count, w, h, size) {
  const r = size / 2 + FLOAT;
  const minDist = size + FLOAT * 2 + 10;
  const pts = [];
  for (let i = 0; i < count; i++) {
    let best = null, bestD = -1;
    for (let t = 0; t < 400; t++) {
      const x = r + Math.random() * Math.max(1, w - 2 * r);
      const y = r + Math.random() * Math.max(1, h - 2 * r);
      let d = Infinity;
      for (const p of pts) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
      if (d >= minDist) { best = { x, y }; break; }
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    pts.push(best);
  }
  return pts;
}

export default function FindActivity({ meta, onDone }) {
  const targets = meta.chars;
  const [targetIdx, setTargetIdx] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [shakeId, setShakeId] = useState(null);
  /* 撒点要按真实像素算才能保证不重叠，所以得先量出板子多宽 */
  const boardRef = useRef(null);
  const [boardW, setBoardW] = useState(0);

  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setBoardW(el.clientWidth));
    ro.observe(el);
    setBoardW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!boardW) return;
    // build 20 bubbles: each week char once, fill with distractors
    const pool = [];
    targets.forEach((ch) => pool.push(ch));
    const fillers = meta.distractors.length ? meta.distractors : ["大", "小", "上", "下"];
    let fi = 0;
    while (pool.length < COUNT) {
      pool.push(fillers[fi % fillers.length]);
      fi++;
    }
    // 窄屏放不下 20 个 62px 的圆，缩一点，别挤成一团
    const size = boardW >= 420 ? 62 : 54;
    const pts = scatter(COUNT, boardW, BOARD_H, size);
    const arranged = shuffled(pool).slice(0, COUNT).map((ch, i) => ({
      id: "b" + i + "_" + Math.random().toString(36).slice(2, 6),
      ch,
      size,
      x: pts[i].x,
      y: pts[i].y,
      dur: 3 + Math.random() * 3,
      delay: Math.random() * 2,
      gone: false,
    }));
    setBubbles(arranged);
  }, [meta, targets, boardW]);

  const current = targets[targetIdx];

  const onTap = useCallback((b) => {
    if (b.gone) return;
    if (b.ch === current) {
      setBubbles((list) => list.map((x) => (x.id === b.id ? { ...x, gone: true } : x)));
      // onDone 会改父组件的 state，不能放进 setTargetIdx 的 updater 里
      // （React 会在 render 阶段跑 updater，导致「在渲染别的组件时更新组件」警告）
      setTimeout(() => {
        if (targetIdx + 1 >= targets.length) onDone();
        else setTargetIdx((t) => t + 1);
      }, 350);
    } else {
      setShakeId(b.id);
      setTimeout(() => setShakeId(null), 450);
    }
  }, [current, targetIdx, targets.length, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 18, color: "#6B6356", fontWeight: 700 }}>找一找：</span>
        <span style={{ fontSize: 48, fontWeight: 800, color: C.red, lineHeight: 1 }}>{current}</span>
        <span style={{ fontSize: 15, color: "#8A8276" }}>（{targetIdx + 1}/{targets.length}）</span>
      </div>
      <div ref={boardRef} style={{
        position: "relative", width: "100%", maxWidth: 720, height: BOARD_H,
        background: "linear-gradient(135deg,#FFE9F1 0%,#FFF3DE 30%,#E7F6FF 62%,#E6F8EC 100%)",
        border: `2px solid ${C.border}`, borderRadius: 20, overflow: "hidden",
      }}>
        {/* soft decorative color blobs */}
        <div style={{ position: "absolute", width: 220, height: 220, top: -60, left: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,200,66,0.25), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 260, height: 260, bottom: -80, right: -50, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,175,114,0.22), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 180, height: 180, top: 110, left: "55%", borderRadius: "50%", background: "radial-gradient(circle, rgba(127,178,240,0.20), transparent 70%)", pointerEvents: "none" }} />

        {/* 外层只管定位（translate 居中），漂浮/摇晃放在内层，
            否则动画的 transform 会把居中的 translate 覆盖掉，气泡瞬间跳位。 */}
        {bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute", top: b.y, left: b.x,
              transform: "translate(-50%,-50%)",
              pointerEvents: b.gone ? "none" : "auto",
            }}
          >
            {b.gone ? (
              <div style={{ fontSize: 36, animation: "pa-pop .4s ease forwards" }}>💥</div>
            ) : (
              <button
                onClick={() => onTap(b)}
                style={{
                  width: b.size, height: b.size, borderRadius: "50%", display: "block",
                  border: "1.5px solid rgba(255,255,255,0.85)", cursor: "pointer", padding: 0,
                  position: "relative",
                  background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.96), rgba(214,236,255,0.6) 45%, rgba(180,216,248,0.5) 72%, rgba(255,255,255,0.22))",
                  boxShadow: "0 6px 14px rgba(90,130,180,0.20), inset 0 -4px 8px rgba(120,160,210,0.18), inset 0 4px 8px rgba(255,255,255,0.7)",
                  fontSize: Math.round(b.size * 0.48), fontWeight: 800, color: C.ink,
                  animation: shakeId === b.id
                    ? "pa-shake .4s"
                    : `pa-float-sm ${b.dur}s ease-in-out ${b.delay}s infinite`,
                }}
              >
                <span style={{ position: "absolute", top: 9, left: 13, width: 16, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.9)", transform: "rotate(-18deg)", pointerEvents: "none" }} />
                <span style={{ position: "relative" }}>{b.ch}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <p style={{ color: "#8A8276", fontSize: 14 }}>点对了会“爆开”，点错了会摇一摇～</p>
    </div>
  );
}
