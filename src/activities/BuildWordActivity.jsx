import { useState, useEffect, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import { BigButton } from "../components/ui";
import { playChar, playSequence, stopAudio } from "../audio";

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
        /* 分两拍：先把刚点的那个字念完整，停一下，再把整个词连起来念。
           不能一上来就念整词 —— 孩子点的是「羊」，先听到「小」会懵。
           中间这一停也是必要的，不然两拍会黏成一句听不出分隔。
           念完再翻页；保底 700ms，免得放不出声时一闪而过。 */
        const lastCh = targetChars[targetChars.length - 1];
        const readAloud = (async () => {
          await playSequence([lastCh], meta.audioMap);           // 你点的这个字
          await new Promise((r) => setTimeout(r, 320));
          await playSequence(targetChars, meta.audioMap);        // 连起来就是这个词
        })();
        Promise.all([readAloud, new Promise((r) => setTimeout(r, 700))]).then(() => {
          setOkFlash(false);
          if (wi + 1 >= words.length) onDone();
          else setWi((p) => p + 1);
        });
      } else {
        setShake(true);
        setTimeout(buildTiles, 700);
      }
      return cur;
    });
  }, [targetChars, wi, words.length, onDone, buildTiles, meta.audioMap]);

  /* 换到下一个词时先念一遍，孩子知道自己在拼什么。
     用老师录的单字连起来念，缺哪个字才用机器音补。 */
  useEffect(() => {
    if (word) playSequence(word.split(""), meta.audioMap);
    return stopAudio;
  }, [word, meta.audioMap]);

  const place = useCallback((tileId) => {
    const tl = tiles.find((t) => t.id === tileId);
    /* 点一个字就念这个字 —— 但填满最后一格时不念。
       紧接着要把整个词连起来念一遍，这时再念单字，那个字刚起头就被
       整词的读音接管，听着像「羊…小羊」这样结巴了一下。
       直接交给整词那一遍，孩子照样听得到这个字。 */
    const completes = slots.filter((s) => s === null).length === 1;
    if (tl && !completes) playChar(tl.ch, meta.audioMap);
    setSlots((prev) => {
      const firstEmpty = prev.indexOf(null);
      if (firstEmpty === -1) return prev;
      const ns = prev.slice();
      ns[firstEmpty] = tileId;
      setTiles((pt) => pt.map((t) => (t.id === tileId ? { ...t, placed: firstEmpty } : t)));
      if (!ns.includes(null)) setTimeout(() => check(ns), 180);
      return ns;
    });
  }, [check, tiles, slots, meta.audioMap]);

  const returnTile = useCallback((slotIndex) => {
    setSlots((prev) => {
      const tid = prev[slotIndex];
      if (!tid) return prev;
      const back = tiles.find((t) => t.id === tid);
      if (back) playChar(back.ch, meta.audioMap);
      const ns = prev.slice();
      ns[slotIndex] = null;
      setTiles((pt) => pt.map((t) => (t.id === tid ? { ...t, placed: null } : t)));
      return ns;
    });
  }, [tiles, meta.audioMap]);

  if (words.length === 0) {
    return <p style={{ color: "#9C9382", textAlign: "center" }}>老师还没设置“词汇”，先去内容设置里填几个词语吧（例如 山水、火山）。</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>看上面的词，把字按顺序拼出来</p>
      <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
        <span>拼出：<span style={{ color: C.bamboo, fontSize: 30 }}>{word}</span></span>
        <button
          onClick={() => playSequence(word.split(""), meta.audioMap)}
          title="再听一遍"
          style={{
            minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.bamboo}`,
            background: "#fff", fontSize: 22, cursor: "pointer", lineHeight: 1,
          }}
        >🔊</button>
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
