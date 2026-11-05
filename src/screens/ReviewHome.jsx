import { C, ACTIVITIES } from "../theme";
import Panda from "../components/Panda";
import { BigButton } from "../components/ui";

/* ===================================================================
   Review Home (read-only week — shows the activities to replay)
   =================================================================== */
export default function ReviewHome({ meta, progress, avatar, onOpenActivity, onExit }) {
  /* 老师端也用这个组件回顾，那边不传 progress —— 星星整排不显示。
     老师看的是「这一课长什么样」，显示一排空星会让人以为学生没做。 */
  const pr = progress || {};
  const stars = !!progress;
  const doneCount = ACTIVITIES.filter((_, i) => pr[i]).length;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
        <Panda sz={100} avatar={avatar} />
        <h1 style={{ fontSize: 24, margin: "6px 0 0" }}>{meta.label} 回顾</h1>
        <span style={{
          display: "inline-block", background: "#FBEFCB", color: "#8a6d12", fontWeight: 700,
          borderRadius: 999, padding: "6px 14px", fontSize: 15,
        }}>{meta.chars.join("")}</span>
        {/* 以前这里写「回顾模式不会记录进度」—— 早就不是这样了，孩子重做
            旧课一样记在那节课名下。写着不记，孩子做完了也不知道补上了没有。 */}
        {stars && (
          <>
            <div style={{ fontSize: 22, letterSpacing: 2, marginTop: 4 }}>
              {"⭐".repeat(doneCount)}
              <span style={{ color: "#C4BCAD" }}>{"☆".repeat(ACTIVITIES.length - doneCount)}</span>
            </div>
            <p style={{ color: "#9C9382", fontSize: 14, margin: "2px 0 0" }}>
              {doneCount === ACTIVITIES.length
                ? "这一课全做完了，想再做一遍也可以"
                : `还差 ${ACTIVITIES.length - doneCount} 个就能把这一课的星星全点亮`}
            </p>
          </>
        )}
      </div>
      <div className="pa-tile-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 20 }}>
        {ACTIVITIES.map((a, i) => (
          <button key={a.key} onClick={() => onOpenActivity(i)} style={{
            textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 18,
            border: `2px solid ${pr[i] ? C.gold : C.border}`,
            background: pr[i] ? "#FFFBF2" : C.card, cursor: "pointer", minHeight: 56,
          }}>
            <span style={{ fontSize: 38 }}>{a.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 19, fontWeight: 800 }}>{a.name}</span>
              <span style={{
                display: "block", fontSize: 14,
                color: pr[i] ? C.bamboo : "#8A8276", fontWeight: pr[i] ? 700 : 400,
              }}>
                {pr[i] ? "✅ 已完成 · 点一下再做一遍" : a.desc}
              </span>
            </span>
            {stars && (
              <span style={{ fontSize: 26, color: pr[i] ? undefined : "#C4BCAD" }}>{pr[i] ? "⭐" : "☆"}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <BigButton color={C.gold} onClick={onExit}>返回本周 ↩</BigButton>
      </div>
    </div>
  );
}
