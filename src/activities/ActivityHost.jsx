import { useState, useCallback } from "react";
import { ACTIVITIES, C } from "../theme";
import { Card, CelebrationOverlay } from "../components/ui";
import FlashcardActivity from "./FlashcardActivity";
import FindActivity from "./FindActivity";
import TraceActivity from "./TraceActivity";
import BuildActivity from "./BuildActivity";
import BuildWordActivity from "./BuildWordActivity";

/* ===================================================================
   Activity host — wraps a single activity with header + celebration.

   要接入新游戏：在 theme.js 的 ACTIVITIES 里加一条，再在下面加一个分支。
   =================================================================== */
export default function ActivityHost({ activityIndex, meta, readOnly, done, onComplete, onBack }) {
  const [celebrate, setCelebrate] = useState(false);
  /* 每次「再做一遍」就 +1，用作子组件的 key —— 重新挂载即重新出题 */
  const [round, setRound] = useState(0);
  const def = ACTIVITIES[activityIndex];

  /* 完成即记录，不等孩子点关闭 —— 中途关掉页面也不会丢进度 */
  const finish = useCallback(() => {
    if (!readOnly) onComplete(activityIndex);
    setCelebrate(true);
  }, [readOnly, onComplete, activityIndex]);

  const replay = useCallback(() => {
    setCelebrate(false);
    setRound((r) => r + 1);
  }, []);

  const closeCelebrate = useCallback(() => {
    setCelebrate(false);
    onBack();
  }, [onBack]);

  let inner = null;
  if (def.key === "flash") inner = <FlashcardActivity meta={meta} onDone={finish} />;
  else if (def.key === "find") inner = <FindActivity meta={meta} onDone={finish} />;
  else if (def.key === "trace") inner = <TraceActivity meta={meta} onDone={finish} />;
  else if (def.key === "word") inner = <BuildWordActivity meta={meta} onDone={finish} />;
  else if (def.key === "build") inner = <BuildActivity meta={meta} onDone={finish} />;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{
          minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `2px solid ${C.border}`,
          background: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>← 返回</button>
        <h2 style={{ margin: 0, fontSize: 22 }}>{def.emoji} {def.name}</h2>
        {done && (
          <span style={{
            background: "#FFFBF2", border: `2px solid ${C.gold}`, color: "#8a6d12",
            borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 800,
          }}>⭐ 之前完成过</span>
        )}
        {round > 0 && (
          <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 700 }}>第 {round + 1} 遍</span>
        )}
      </div>
      <Card>
        {/* key 变化 -> 整个活动重新挂载 -> 题目重新随机 */}
        <div key={round}>{inner}</div>
      </Card>
      {celebrate && (
        <CelebrationOverlay text="太棒了！🎉" onReplay={replay} onClose={closeCelebrate} />
      )}
    </div>
  );
}
