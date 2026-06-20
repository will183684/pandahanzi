import { C, ACTIVITIES } from "../theme";
import Panda from "../components/Panda";
import { BigButton } from "../components/ui";

/* ===================================================================
   Review Home (read-only week — shows the activities to replay)
   =================================================================== */
export default function ReviewHome({ meta, onOpenActivity, onExit }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
        <Panda sz={100} ex="focused" />
        <h1 style={{ fontSize: 24, margin: "6px 0 0" }}>{meta.label} 回顾</h1>
        <span style={{
          display: "inline-block", background: "#FBEFCB", color: "#8a6d12", fontWeight: 700,
          borderRadius: 999, padding: "6px 14px", fontSize: 15,
        }}>{meta.chars.join("")}</span>
        <p style={{ color: "#9C9382", fontSize: 14, margin: "6px 0 0" }}>回顾模式不会记录进度</p>
      </div>
      <div className="pa-tile-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 20 }}>
        {ACTIVITIES.map((a, i) => (
          <button key={a.key} onClick={() => onOpenActivity(i)} style={{
            textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 18,
            border: `2px solid ${C.border}`, background: C.card, cursor: "pointer", minHeight: 56,
          }}>
            <span style={{ fontSize: 38 }}>{a.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 19, fontWeight: 800 }}>{a.name}</span>
              <span style={{ display: "block", fontSize: 14, color: "#8A8276" }}>{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
        <BigButton color={C.gold} onClick={onExit}>返回本周 ↩</BigButton>
      </div>
    </div>
  );
}
