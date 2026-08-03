import { C, AVATARS } from "../theme";
import { BigButton } from "./ui";

/* ===================================================================
   选头像 —— 小朋友从一组动物里挑一个当自己的头像。
   只存 emoji，不上传照片，所以没有隐私问题。
   =================================================================== */
export default function AvatarPicker({ current, onPick, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: C.card, borderRadius: 22, padding: 20,
        width: "min(420px, 94vw)", maxHeight: "88vh", overflowY: "auto",
      }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 21, textAlign: "center" }}>选一个你喜欢的小动物</h3>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#9C9382", textAlign: "center" }}>
          它会变成你的头像
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 10,
        }}>
          {AVATARS.map((a) => {
            const active = a === current;
            return (
              <button
                key={a}
                onClick={() => onPick(a)}
                aria-label={a}
                style={{
                  aspectRatio: "1 / 1", minHeight: 64, borderRadius: "50%", cursor: "pointer",
                  border: `3px solid ${active ? C.bamboo : C.border}`,
                  background: active ? "#EAF6EC" : "#FED820",
                  fontSize: 34, lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform .08s",
                }}
              >
                {a}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <BigButton color={C.bamboo} light onClick={onClose}>关闭</BigButton>
        </div>
      </div>
    </div>
  );
}
