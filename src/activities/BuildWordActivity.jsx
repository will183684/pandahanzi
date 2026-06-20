import { useState, useEffect, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import { BigButton } from "../components/ui";

/* ===================================================================
   拼词语 (Build the week's vocab words) — alternate game, not currently
   wired into ACTIVITIES. Uses the "vocab" field. Tap tiles into slots
   to spell each word.
   =================================================================== */
export default function BuildWordActivity({ meta, onDone }) {
  const words = useMemo(() => (meta.vocab || []).filter((w) => w && w.length), [meta.vocab]);
  const [wi, setWi] = useState(0);
  const word = words[wi] || "";
  const targetChars = useMemo(() => word.split(""), [word]);

  const [tiles, setTiles] = useState([]);
  const [slots, setSlots] = useState([]);
  const [shake, setShake] = useState(false);
  const [okFlash, setOkFlash] = useState(false);

  const buildTiles = useCallback(() => {
    const base = targetChars.map((ch, i) => ({ id: "w" + i, ch }));
    const extraPool = [...(meta.chars || []), ...(meta.distractors || [])].filter((c) => !targetChars.includes(c));
    const extras = shuffled(extraPool).slice(0, Math.min(2, extraPool.length)).map((ch, i) => ({ id: "x" + i, ch }));
    setTiles(shuffled([...base, ...extras]).map((t) => ({ ...t, placed: null })));
    setSlots(new Array(targetChars.length).fill(null));
    setShake(false);
  }, [targetChars, meta.chars, meta.distractors]);

  useEffect(() => { buildTiles(); }, [buildTiles]);

  const check = useCallback((arr) => {
    setTiles((cur) => {
      const ok = arr.every((tid, i) => {
        const tl = cur.find((t) => t.id === tid);
        return tl && tl.ch === targetChars[i];
      });
      if (ok) {
        setOkFlash(true);
        setTimeout(() => {
          setOkFlash(false);
          if (wi + 1 >= words.length) onDone();
          else setWi((p) => p + 1);
        }, 700);
      } else {
        setShake(true);
        setTimeout(buildTiles, 700);
      }
      return cur;
    });
  }, [targetChars, wi, words.length, onDone, buildTiles]);

  const place = useCallback((tileId) => {
    setSlots((prev) => {
      const firstEmpty = prev.indexOf(null);
      if (firstEmpty === -1) return prev;
      const ns = prev.slice();
      ns[firstEmpty] = tileId;
      setTiles((pt) => pt.map((t) => (t.id === tileId ? { ...t, placed: firstEmpty } : t)));
      if (!ns.includes(null)) setTimeout(() => check(ns), 180);
      return ns;
    });
  }, [check]);

  const returnTile = useCallback((slotIndex) => {
    setSlots((prev) => {
      const tid = prev[slotIndex];
      if (!tid) return prev;
      const ns = prev.slice();
      ns[slotIndex] = null;
      setTiles((pt) => pt.map((t) => (t.id === tid ? { ...t, placed: null } : t)));
      return ns;
    });
  }, []);

  if (words.length === 0) {
    return <p style={{ color: "#9C9382", textAlign: "center" }}>老师还没设置“词汇”，先去内容设置里填几个词语吧（例如 山水、火山）。</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>看上面的词，把字按顺序拼出来</p>
      <div style={{ fontSize: 20, fontWeight: 800 }}>
        拼出：<span style={{ color: C.bamboo, fontSize: 30 }}>{word}</span>
      </div>

      {/* slots */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {slots.map((tid, i) => {
          const tl = tid ? tiles.find((t) => t.id === tid) : null;
          const border = okFlash ? C.bamboo : shake ? C.red : tl ? C.bamboo : "#CFC7B8";
          return (
            <button key={i} onClick={() => tl && returnTile(i)} style={{
              width: 72, height: 84, minWidth: 56, borderRadius: 14,
              border: `3px ${tl ? "solid" : "dashed"} ${border}`,
              background: okFlash ? "#EAF6EC" : tl ? "#F2FAF3" : "#FFFDF8",
              fontSize: 44, fontWeight: 800, color: C.ink, cursor: tl ? "pointer" : "default",
              animation: shake ? "pa-shake .4s" : "none",
            }}>
              {tl ? tl.ch : ""}
            </button>
          );
        })}
      </div>

      {/* tray */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 420 }}>
        {tiles.filter((t) => t.placed === null).map((t) => (
          <button key={t.id} onClick={() => place(t.id)} style={{
            width: 72, height: 84, minWidth: 56, borderRadius: 14, border: "none",
            background: C.gold, fontSize: 44, fontWeight: 800, color: C.ink, cursor: "pointer",
            boxShadow: "0 4px 0 rgba(0,0,0,0.12)",
          }}>
            {t.ch}
          </button>
        ))}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>第 {wi + 1} / {words.length} 个词</div>
      <BigButton color={C.bamboo} light onClick={buildTiles}>重新打乱 🔀</BigButton>
    </div>
  );
}
