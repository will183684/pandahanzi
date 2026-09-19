import { useState, useEffect } from "react";
import { C, ACTIVITIES, LEVEL_BY_NO } from "../theme";
import Panda from "../components/Panda";
import { Confetti, BigButton } from "../components/ui";
import { speak, stopAudio } from "../audio";

/* ===================================================================
   Student Home
   =================================================================== */
export default function StudentHome({ studentName, meta, progress, readOnly, avatar, onChangeAvatar, onOpenActivity, onOpenArchive, onOpenAssessment, onLogout }) {
  const doneCount = ACTIVITIES.filter((_, i) => progress[i]).length;
  const allDone = doneCount === ACTIVITIES.length;
  const [showFinale, setShowFinale] = useState(false);

  /* 「本周全部完成」这一屏是全屏遮罩，一课只该庆祝一次。

     以前的写法是「只要全做完了就弹」，而每次从活动返回首页都是一次重新
     挂载 —— 于是第二遍练习时，每做完一个活动回到首页就被它盖住一次。
     孩子照着卡片点，点的全是遮罩，看起来就是「练习卡住了、点了没反应」。

     用 localStorage 记住这一课庆祝过了。换一课（meta.id 变）自然会再庆祝。 */
  const finaleKey = `panda_finale:${studentName}:${meta && meta.id}`;
  useEffect(() => {
    if (!allDone || readOnly || !meta || !meta.id) return;
    let seen = false;
    try { seen = localStorage.getItem(finaleKey) === "1"; } catch (e) { /* 隐私模式下读不到就当没庆祝过 */ }
    if (seen) return;
    try { localStorage.setItem(finaleKey, "1"); } catch (e) { /* ignore */ }
    setShowFinale(true);
  }, [allDone, readOnly, meta, finaleKey]);

  /* 本周全部做完时也念一句 */
  useEffect(() => {
    if (!showFinale) return undefined;
    speak("本周全部完成，你真棒", { rate: 0.8 });
    return stopAudio;
  }, [showFinale]);

  const messages = ["继续加油，PanPan陪着你！", "你做得真好！", "再来一个就更厉害啦！", "了不起，快完成啦！", "全部完成，太厉害啦！"];
  const lv = meta.level ? LEVEL_BY_NO[meta.level] : null;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
        <button
          onClick={onChangeAvatar}
          title="换一个头像"
          style={{
            border: "none", background: "none", padding: 0, cursor: "pointer", lineHeight: 0,
            animation: "pa-jump 1.4s ease-in-out infinite",
          }}
        >
          <Panda sz={120} avatar={avatar} />
        </button>
        <button
          onClick={onChangeAvatar}
          style={{
            border: "none", background: "none", padding: "2px 6px", cursor: "pointer",
            fontSize: 13, color: "#9C9382", textDecoration: "underline",
          }}
        >换个小动物 🔄</button>
        <h1 style={{ margin: "6px 0 0", fontSize: 26 }}>你好，{studentName}！👋</h1>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center",
          background: "#EAF6EC", color: C.bamboo, fontWeight: 700,
          borderRadius: 999, padding: "6px 14px", fontSize: 15, border: `1px solid ${C.bamboo}33`,
        }}>
          {lv && (
            <span style={{
              background: lv.color, color: "#fff", fontSize: 12, fontWeight: 800,
              borderRadius: 6, padding: "2px 7px",
            }}>{lv.name} {lv.sub}</span>
          )}
          <span>{meta.label} · {meta.chars.join("")}</span>
        </span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 22,
      }} className="pa-tile-grid">
        {ACTIVITIES.map((a, i) => (
          <button
            key={a.key}
            onClick={() => onOpenActivity(i)}
            style={{
              textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: 16,
              borderRadius: 18, border: `2px solid ${progress[i] ? C.gold : C.border}`,
              background: progress[i] ? "#FFFBF2" : C.card, cursor: "pointer", minHeight: 56,
            }}
          >
            <span style={{ fontSize: 38 }}>{a.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 19, fontWeight: 800 }}>{a.name}</span>
              <span style={{
                display: "block", fontSize: 14,
                color: progress[i] ? C.bamboo : "#8A8276",
                fontWeight: progress[i] ? 700 : 400,
              }}>
                {progress[i] ? "✅ 已完成 · 点一下再做一遍" : a.desc}
              </span>
            </span>
            <span style={{ fontSize: 26 }}>{progress[i] ? "⭐" : ""}</span>
          </button>
        ))}
      </div>

      {/* progress paws */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
        {ACTIVITIES.map((_, i) => (
          <span key={i} style={{ fontSize: 30, filter: progress[i] ? "none" : "grayscale(1)", opacity: progress[i] ? 1 : 0.4 }}>🐾</span>
        ))}
      </div>
      <p style={{ textAlign: "center", color: C.bamboo, fontWeight: 700, marginTop: 8 }}>
        {messages[Math.min(doneCount, messages.length - 1)]}
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
        <BigButton color={C.bamboo} light onClick={onOpenArchive}>📚 历史记录</BigButton>
        {onOpenAssessment && (
          <BigButton color={C.gold} light onClick={onOpenAssessment}>📋 测一测</BigButton>
        )}
        <button onClick={onLogout} style={{
          minHeight: 56, padding: "0 18px", background: "none", border: "none", color: "#9C9382",
          fontSize: 15, textDecoration: "underline", cursor: "pointer",
        }}>退出登录</button>
      </div>

      {showFinale && (
        /* 点哪儿都能关掉 —— 五六岁的孩子不会去找那个「继续看看」，
           挡在前面又点不动，就以为是坏了。 */
        <div
          onClick={() => setShowFinale(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 60, background: "rgba(253,246,236,0.97)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: 24, cursor: "pointer",
          }}
        >
          <Confetti count={120} />
          <div style={{ animation: "pa-jump 0.7s ease-in-out infinite" }}>
            <Panda sz={170} avatar={avatar} />
          </div>
          <div style={{ fontSize: 44, letterSpacing: 8, marginTop: 6 }}>🎓</div>
          <h2 style={{ fontSize: 26, margin: "8px 0" }}>本周全部完成！</h2>
          <p style={{ fontSize: 18, color: "#6B6356" }}>PanPan为你鼓掌！👏</p>
          <div
            onClick={(ev) => ev.stopPropagation()}
            style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap", justifyContent: "center", position: "relative", zIndex: 1 }}
          >
            <BigButton color={C.gold} onClick={() => { setShowFinale(false); onOpenArchive(); }}>查看历史记录 📚</BigButton>
            <BigButton color={C.bamboo} light onClick={() => setShowFinale(false)}>继续看看</BigButton>
          </div>
          <p style={{ fontSize: 13, color: "#9C9382", marginTop: 14 }}>点任意地方继续</p>
        </div>
      )}
    </div>
  );
}
