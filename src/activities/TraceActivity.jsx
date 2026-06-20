import { useState, useRef, useEffect, useCallback } from "react";
import { C } from "../theme";
import { BigButton } from "../components/ui";

/* ===================================================================
   ACTIVITY 3 — 描一描 (Stroke-order tracing)
   Uses Hanzi Writer (loaded at runtime from jsDelivr) for stroke-order
   demo + per-stroke quiz. Falls back to freehand canvas when the
   library or a character's stroke data isn't available.
   =================================================================== */
let hwLoaderPromise = null;
function loadHanziWriter() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  if (hwLoaderPromise) return hwLoaderPromise;
  hwLoaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js";
    s.async = true;
    s.onload = () => (window.HanziWriter ? resolve(window.HanziWriter) : reject(new Error("no global")));
    s.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(s);
  });
  return hwLoaderPromise;
}

const TRACE_SIZE = 300;

export default function TraceActivity({ meta, onDone }) {
  const chars = meta.chars;
  const [idx, setIdx] = useState(0);
  const [scriptState, setScriptState] = useState("loading"); // loading | ready | failed
  const [charFallback, setCharFallback] = useState(false);
  const [done, setDone] = useState(false);

  const hwRef = useRef(null);       // Hanzi Writer container
  const writerRef = useRef(null);
  const canvasRef = useRef(null);   // freehand fallback canvas
  const drawing = useRef(false);
  const last = useRef(null);

  const isLast = idx >= chars.length - 1;

  // load the library once
  useEffect(() => {
    let alive = true;
    loadHanziWriter()
      .then(() => { if (alive) setScriptState("ready"); })
      .catch(() => { if (alive) setScriptState("failed"); });
    return () => { alive = false; };
  }, []);

  // when moving to a new character, give Hanzi Writer another chance
  useEffect(() => { setCharFallback(false); setDone(false); }, [idx]);

  const startQuiz = useCallback((w) => {
    try {
      w.quiz({
        leniency: 1.4,
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        onComplete: () => {
          setDone(true);
          setTimeout(() => {
            setIdx((prev) => {
              if (prev + 1 >= chars.length) { onDone(); return prev; }
              return prev + 1;
            });
          }, 900);
        },
      });
    } catch (e) { /* ignore */ }
  }, [chars.length, onDone]);

  // build the Hanzi Writer instance for the current character
  useEffect(() => {
    if (scriptState !== "ready" || charFallback) return undefined;
    const node = hwRef.current;
    if (!node) return undefined;
    node.innerHTML = "";
    let writer;
    try {
      writer = window.HanziWriter.create(node, chars[idx], {
        width: TRACE_SIZE, height: TRACE_SIZE, padding: 8,
        showCharacter: false, showOutline: true,
        strokeColor: "#1A1A1A", outlineColor: "#E8E0D5",
        drawingColor: "#6BAF72", highlightColor: "#F5C842",
        drawingWidth: 26, strokeAnimationSpeed: 1, delayBetweenStrokes: 180,
        onLoadCharDataError: () => setCharFallback(true),
      });
      writerRef.current = writer;
      startQuiz(writer);
    } catch (e) {
      setCharFallback(true);
    }
    return () => {
      try { if (writer && writer.cancelQuiz) writer.cancelQuiz(); } catch (e) { /* ignore */ }
    };
  }, [scriptState, charFallback, idx, chars, startQuiz]);

  const showStrokeOrder = useCallback(() => {
    const w = writerRef.current;
    if (!w) return;
    try {
      if (w.cancelQuiz) w.cancelQuiz();
      w.animateCharacter({ onComplete: () => startQuiz(w) });
    } catch (e) { /* ignore */ }
  }, [startQuiz]);

  const restartChar = useCallback(() => {
    const w = writerRef.current;
    if (w) startQuiz(w);
  }, [startQuiz]);

  // ---- freehand fallback ----
  const clearCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }, []);
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }, [idx, charFallback]);
  const posOf = (ev) => {
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) * (cv.width / rect.width), y: (ev.clientY - rect.top) * (cv.height / rect.height) };
  };
  const fStart = (ev) => { ev.preventDefault(); drawing.current = true; last.current = posOf(ev); };
  const fMove = (ev) => {
    if (!drawing.current) return;
    ev.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = posOf(ev);
    ctx.strokeStyle = "rgba(26,26,26,0.55)"; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const fEnd = () => { drawing.current = false; last.current = null; };

  const useFreehand = scriptState === "failed" || charFallback;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>
        {useFreehand ? "照着灰色的字，用手指描一描" : "按照笔顺，一笔一笔描出来（点错会有提示）"}
      </p>

      <div style={{
        position: "relative", width: TRACE_SIZE, maxWidth: "86vw", height: TRACE_SIZE, maxHeight: "86vw",
        background: C.card, border: `2px solid ${done ? C.bamboo : C.border}`, borderRadius: 20, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* light guide grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed #EFE8DB" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px dashed #EFE8DB" }} />
        </div>

        {!useFreehand && scriptState === "loading" && (
          <span style={{ color: "#9C9382", fontSize: 15 }}>正在加载笔顺…</span>
        )}

        {!useFreehand && (
          <div ref={hwRef} style={{ width: TRACE_SIZE, height: TRACE_SIZE, touchAction: "none" }} />
        )}

        {useFreehand && (
          <>
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 240, fontWeight: 800, color: "#ECE6DB", userSelect: "none", pointerEvents: "none",
            }}>{chars[idx]}</div>
            <canvas
              ref={canvasRef} width={TRACE_SIZE} height={TRACE_SIZE}
              onPointerDown={fStart} onPointerMove={fMove} onPointerUp={fEnd} onPointerLeave={fEnd}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
            />
          </>
        )}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>
        {idx + 1} / {chars.length}（{meta.pinyins[idx] || ""}）
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {!useFreehand && (
          <>
            <BigButton color={C.bamboo} light onClick={showStrokeOrder}>👀 看笔顺</BigButton>
            <BigButton color={C.red} light onClick={restartChar}>重描这个字 🔄</BigButton>
          </>
        )}
        {useFreehand && (
          <>
            <BigButton color={C.red} light onClick={clearCanvas}>清空 🧽</BigButton>
            {isLast ? (
              <BigButton color={C.gold} onClick={onDone}>全部写完了！⭐</BigButton>
            ) : (
              <BigButton color={C.bamboo} onClick={() => setIdx((i) => i + 1)}>下一个字 →</BigButton>
            )}
          </>
        )}
      </div>

      {!useFreehand && (
        <p style={{ color: "#9C9382", fontSize: 13, margin: 0, textAlign: "center" }}>
          描完一个字会自动跳到下一个。笔顺数据来自网络，离线时会自动切换成自由描红。
        </p>
      )}
    </div>
  );
}
