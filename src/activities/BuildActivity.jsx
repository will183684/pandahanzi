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

  /* L1 的孩子刚认字，整句空着排太难了 —— 先把第一个字放好，
     他们照着往下接就行。第一个字最有用：知道句子从哪儿起头。
     L2 以上照旧全空。 */
  const giveFirst = (meta.level || 1) <= 1 && target.length > 2;

  const [tiles, setTiles] = useState([]); // {id, ch}
  const [slots, setSlots] = useState([]); // tileId | null
  const [shake, setShake] = useState(false);
  const [okFlash, setOkFlash] = useState(false);

  const reset = useCallback(() => {
    const all = target.map((ch, i) => ({ id: "t" + i, ch }));
    const fixed = giveFirst ? all[0] : null;
    setTiles(shuffled(fixed ? all.slice(1) : all).concat(fixed ? [fixed] : []));
    const ns = new Array(target.length).fill(null);
    if (fixed) ns[0] = fixed.id;
    setSlots(ns);
    setShake(false);
    setOkFlash(false);
  }, [target, giveFirst]);
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
    if (giveFirst && slotIndex === 0) return;   // 送的那个字收不回来
    setSlots((prev) => {
      if (!prev[slotIndex]) return prev;
      const ns = prev.slice();
      ns[slotIndex] = null;
      return ns;
    });
  }, [giveFirst]);

  const tileById = (id) => tiles.find((t) => t.id === id);
  const trayTiles = tiles.filter((t) => !slots.includes(t.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <p style={{ fontSize: 16, color: "#6B6356", textAlign: "center", margin: 0 }}>
        点字把它放进句子里，点放好的字可以收回来
        {giveFirst && (
          <span style={{ display: "block", fontSize: 15, color: C.bamboo, fontWeight: 800, marginTop: 4 }}>
            第一个字已经帮你放好啦，接着往下排 👇
          </span>
        )}
      </p>

      {/* slots */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {slots.map((tid, i) => {
          const tl = tid ? tileById(tid) : null;
          const given = giveFirst && i === 0;           // 送的那个字：固定住，不能收回
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
                position: "relative",
              }}
            >
              {tl ? tl.ch : ""}
              {given && (
                <span style={{
                  position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
                  background: C.gold, color: C.ink, fontSize: 11, fontWeight: 800,
                  borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap",
                }}>送你的</span>
              )}
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
