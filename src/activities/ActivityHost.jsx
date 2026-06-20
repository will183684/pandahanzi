import { useState, useCallback } from "react";
import { ACTIVITIES, C } from "../theme";
import { Card, CelebrationOverlay } from "../components/ui";
import FlashcardActivity from "./FlashcardActivity";
import FindActivity from "./FindActivity";
import TraceActivity from "./TraceActivity";
import BuildActivity from "./BuildActivity";

/* ===================================================================
   Activity host — wraps a single activity with header + celebration.

   To wire a new game into the rotation: add it to ACTIVITIES (theme.js)
   and add a matching branch below.
   =================================================================== */
export default function ActivityHost({ activityIndex, meta, readOnly, onComplete, onBack }) {
  const [celebrate, setCelebrate] = useState(false);
  const def = ACTIVITIES[activityIndex];

  const finish = useCallback(() => {
    setCelebrate(true);
  }, []);

  const closeCelebrate = useCallback(() => {
    setCelebrate(false);
    if (!readOnly) onComplete(activityIndex);
    onBack();
  }, [readOnly, onComplete, activityIndex, onBack]);

  let inner = null;
  if (def.key === "flash") inner = <FlashcardActivity meta={meta} onDone={finish} />;
  else if (def.key === "find") inner = <FindActivity meta={meta} onDone={finish} />;
  else if (def.key === "trace") inner = <TraceActivity meta={meta} onDone={finish} />;
  else if (def.key === "build") inner = <BuildActivity meta={meta} onDone={finish} />;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `2px solid ${C.border}`,
          background: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>← 返回</button>
        <h2 style={{ margin: 0, fontSize: 22 }}>{def.emoji} {def.name}</h2>
      </div>
      <Card>{inner}</Card>
      {celebrate && <CelebrationOverlay text="太棒了！🎉" onClose={closeCelebrate} />}
    </div>
  );
}
