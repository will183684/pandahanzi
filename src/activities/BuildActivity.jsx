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
  const [tiles, setTiles] = useState([]); // {id, ch}
  const [slots, setSlots] = useState([]); // tileId | null
  const [shake, setShake] = useState(false);
  const [okFlash, setOkFlash] = useState(false);

  const reset = useCallback(() => {
    setTiles(shuffled(target.map((ch, i) => ({ id: "t" + i, ch }))));
    setSlots(new Array(target.length).fill(null));
    setShake(false);
    setOkFlash(false);
  }, [target]);
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
    setSlots((prev) => {
      if (!prev[slotIndex]) return prev;
      const ns = prev.slice();
      ns[slotIndex] = null;
      return ns;
    });
  }, []);

  const tileById = (id) => tiles.find((t) => t.id === id);
  const trayTiles = tiles.filter((t) => !slots.includes(t.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>点字把它放进句子里，点放好的字可以收回来</p>

      {/* slots */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {slots.map((tid, i) => {
          const tl = tid ? tileById(tid) : null;
          const border = okFlash ? C.bamboo : shake ? C.red : tl ? C.bamboo : "#CFC7B8";
          return (
            <button
              key={i}
              onClick={() => tl && returnTile(i)}
              style={{
                width: 64, height: 78, minWidth: 56, borderRadius: 14,
                border: `3px ${tl ? "solid" : "dashed"} ${border}`,
                background: okFlash ? "#EAF6EC" : tl ? "#F2FAF3" : "#FFFDF8",
                fontSize: 42, fontWeight: 800, color: C.ink, cursor: tl ? "pointer" : "default",
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
