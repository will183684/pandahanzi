import { useState, useEffect, useCallback, useMemo } from "react";
import { C } from "../theme";
import { shuffled } from "../utils";
import { BigButton } from "../components/ui";

/* ===================================================================
   ACTIVITY 4 — 拼句子 (Build sentence by TAPPING tiles into order)
   Tap a tray tile to drop it into the next slot; tap a placed tile to
   send it back to its spot in the tray.
   =================================================================== */
export default function BuildActivity({ meta, onDone }) {
  const target = useMemo(() => meta.sentence.split("").filter((c) => c.trim()), [meta.sentence]);

  /* 整句空着排对小小孩太难，按级别送一个字：
       L1  送第一个 —— 刚认字的孩子最难的是「这句话从哪个字起头」，
           给了开头就能顺着往下接。固定位置，好上手。
       L2  随机送一个 —— 已经有语序概念了，位置不定反而是个挑战，
           也不至于每次都一样排腻了。
       L3+ 全空。
     三个字以内的句子本来就不难，不送。 */
  const level = meta.level || 1;
  const pickGivenIdx = useCallback(() => {
    if (target.length <= 3) return -1;
    if (level <= 1) return 0;
    if (level === 2) return Math.floor(Math.random() * target.length);
    return -1;
  }, [target.length, level]);

  const [tiles, setTiles] = useState([]);   // {id, ch}
  const [slots, setSlots] = useState([]);   // tileId | null
  const [givenIdx, setGivenIdx] = useState(-1);   // 送的那个字在第几格，-1 = 没送
  const [shake, setShake] = useState(false);
  const [okFlash, setOkFlash] = useState(false);

  const reset = useCallback(() => {
    const all = target.map((ch, i) => ({ id: "t" + i, ch }));
    const idx = pickGivenIdx();
    const fixed = idx >= 0 ? all[idx] : null;
    setGivenIdx(idx);
    setTiles(shuffled(all.filter((t) => t !== fixed)).concat(fixed ? [fixed] : []));
    const ns = new Array(target.length).fill(null);
    if (fixed) ns[idx] = fixed.id;
    setSlots(ns);
    setShake(false);
    setOkFlash(false);
  }, [target, pickGivenIdx]);
  useEffect(() => { reset(); }, [reset]);

  const check = useCallback((arr) => {
    setTiles((cur) => {
      const ok = arr.every((tid, i) => {
        const t = cur.find((x) => x.id === tid);
        return t && t.ch === target[i];
      });
      if (ok) {
        setOkFlash(true);
        setTimeout(onDone, 450);
      } else {
        setShake(true);
        setTimeout(reset, 750);
      }
      return cur;
    });
  }, [target, onDone, reset]);

  const placeTile = useCallback((tileId) => {
    setSlots((prev) => {
      if (prev.includes(tileId)) return prev;
      const firstEmpty = prev.indexOf(null);
      if (firstEmpty === -1) return prev;
      const ns = prev.slice();
      ns[firstEmpty] = tileId;
      if (!ns.includes(null)) setTimeout(() => check(ns), 180);
      return ns;
    });
  }, [check]);

  const returnTile = useCallback((slotIndex) => {
    if (slotIndex === givenIdx) return;         // 送的那个字收不回来
    setSlots((prev) => {
      if (!prev[slotIndex]) return prev;
      const ns = prev.slice();
      ns[slotIndex] = null;
      return ns;
    });
  }, [givenIdx]);

  const tileById = (id) => tiles.find((t) => t.id === id);
  const trayTiles = tiles.filter((t) => !slots.includes(t.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <p style={{ fontSize: 16, color: "#6B6356", textAlign: "center", margin: 0 }}>
        点字把它放进句子里，点放好的字可以收回来
        {givenIdx >= 0 && (
          <span style={{ display: "block", fontSize: 15, color: C.bamboo, fontWeight: 800, marginTop: 4 }}>
            {givenIdx === 0
              ? "第一个字已经帮你放好啦，接着往下排 👇"
              : "有一个字已经帮你放好啦，其他的排进去 👇"}
          </span>
        )}
      </p>

      {/* slots */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {slots.map((tid, i) => {
          const tl = tid ? tileById(tid) : null;
          const given = i === givenIdx;                 // 送的那个字：固定住，不能收回
          const border = okFlash ? C.bamboo : shake ? C.red : tl ? C.bamboo : "#CFC7B8";
          return (
            <button
              key={i}
              onClick={() => tl && returnTile(i)}
              style={{
                width: 64, height: 78, minWidth: 56, borderRadius: 14,
                border: `3px ${tl ? "solid" : "dashed"} ${given ? C.gold : border}`,
                background: okFlash ? "#EAF6EC" : given ? "#FFFBF2" : tl ? "#F2FAF3" : "#FFFDF8",
                fontSize: 42, fontWeight: 800, color: C.ink,
                cursor: tl && !given ? "pointer" : "default",
                animation: shake ? "pa-shake .4s" : "none",
              }}
            >
              {tl ? tl.ch : ""}
            </button>
          );
        })}
      </div>

      {/* tray */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 520,
        minHeight: 94, padding: 8, borderRadius: 16, background: "#FBF5EA", border: `2px dashed ${C.border}`,
      }}>
        {trayTiles.length === 0 && <span style={{ color: "#B7AE9F", fontSize: 14, alignSelf: "center" }}>都放上去啦</span>}
        {trayTiles.map((t) => (
          <button
            key={t.id}
            onClick={() => placeTile(t.id)}
            style={{
              width: 64, height: 78, minWidth: 56, borderRadius: 14, border: "none",
              background: C.gold, fontSize: 42, fontWeight: 800, color: C.ink, cursor: "pointer",
              boxShadow: "0 4px 0 rgba(0,0,0,0.12)",
            }}
          >
            {t.ch}
          </button>
        ))}
      </div>

      <BigButton color={C.bamboo} light onClick={reset}>重新打乱 🔀</BigButton>
    </div>
  );
}
