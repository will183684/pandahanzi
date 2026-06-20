import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase, kvFetchAll, kvSet, kvSetMany, getClasses, saveClasses, kvGet, getLibraryLessons, addLibraryLesson } from "./supabaseClient";

/* ============================================================
   熊猫画画班 · 汉字练习  (Panda Art — Chinese Character Practice)
   Single-file React app. Persistence via synchronous localStorage
   with a graceful in-memory fallback when storage is unavailable.
   ============================================================ */

const C = {
  bg: "#FDF6EC",
  ink: "#1A1A1A",
  bamboo: "#6BAF72",
  red: "#E8453C",
  gold: "#F5C842",
  card: "#FFFFFF",
  border: "#E8E0D5",
};

const DEFAULTS = {
  chars: ["山", "水", "火", "木", "土"],
  pinyins: ["shān", "shuǐ", "huǒ", "mù", "tǔ"],
  vocab: ["山水", "木土", "火山"],
  sentence: "山上有大树",
  emojiMap: { 山: "⛰️", 水: "💧", 火: "🔥", 木: "🌲", 土: "🟫" },
  distractors: ["大", "小", "上", "下", "日", "月", "云", "人", "手", "左", "右", "中"],
  inviteCode: "PANDA2026",
  students: [],
};

const TEACHER_CODE = "panda@teacher"; // 授课老师口令（可改）
const ADMIN_CODE = "panda@admin";     // 教务老师口令（可改）

const ACTIVITIES = [
  { key: "flash", emoji: "🃏", name: "认一认", desc: "翻卡片认识汉字" },
  { key: "find", emoji: "🔍", name: "找一找", desc: "在泡泡里找到汉字" },
  { key: "trace", emoji: "✏️", name: "描一描", desc: "看笔顺，照着描" },
  { key: "build", emoji: "🧩", name: "拼句子", desc: "把字拼成一句话" },
];

const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
function cnNumber(num) {
  if (num <= 0) return "零";
  if (num < 10) return CN_DIGITS[num];
  if (num === 10) return "十";
  if (num < 20) return "十" + CN_DIGITS[num % 10];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return CN_DIGITS[tens] + "十" + (ones ? CN_DIGITS[ones] : "");
  }
  return String(num);
}

/* ----------------------------- storage ----------------------------- */
function rawGet(key) {
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? null : v;
  } catch (err) {
    return null;
  }
}
function rawSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    return false;
  }
}
function jsonGet(key, fallback) {
  const v = rawGet(key);
  if (v == null) return fallback;
  try {
    return JSON.parse(v);
  } catch (err) {
    return fallback;
  }
}

/* ----------------------------- shuffle ----------------------------- */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/* Normalize an invite code so full-width chars, stray spaces, and case
   differences don't cause false "wrong code" errors. */
function normCode(s) {
  return String(s == null ? "" : s)
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[\s\u3000]+/g, "")
    .toUpperCase();
}

/* ============================== Panda ============================== */
function Panda({ sz = 120, ex = "neutral" }) {
  const tilt = ex === "curious" ? -10 : 0;
  const excited = ex === "excited";
  const focused = ex === "focused";
  const curious = ex === "curious";
  const blushOp = excited ? 0.85 : 0.5;

  let mouth;
  if (excited) {
    mouth = (
      <g>
        <path d="M85 122 Q100 150 115 122 Z" fill={C.ink} />
        <path d="M94 133 Q100 145 106 133 Z" fill="#F2867C" />
      </g>
    );
  } else if (focused) {
    mouth = <path d="M91 130 Q100 125 109 130" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />;
  } else if (curious) {
    mouth = <ellipse cx="100" cy="130" rx="5" ry="6" fill={C.ink} />;
  } else {
    mouth = <path d="M87 124 Q100 137 113 124" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />;
  }

  const Eye = ({ x }) => (
    <g>
      <circle cx={x} cy="98" r="9.5" fill="#FFFFFF" />
      <circle cx={x} cy="99" r="7" fill={C.ink} />
      <circle cx={x - 2.5} cy="96" r="2.8" fill="#FFFFFF" />
      <circle cx={x + 2} cy="101" r="1.3" fill="#FFFFFF" />
    </g>
  );

  return (
    <svg width={sz} height={sz} viewBox="0 0 200 212" style={{ display: "block", transform: `rotate(${tilt}deg)`, transformOrigin: "50% 50%", overflow: "visible" }}>
      {/* chibi body */}
      <ellipse cx="100" cy="178" rx="44" ry="31" fill="#FFFFFF" stroke={C.ink} strokeWidth="3" />
      <ellipse cx="100" cy="182" rx="24" ry="18" fill="#FBF4E8" />
      {/* paws */}
      <circle cx="60" cy="172" r="14" fill={C.ink} />
      <circle cx="150" cy="174" r="14" fill={C.ink} />
      {/* ears with pink inner */}
      <circle cx="56" cy="42" r="23" fill={C.ink} />
      <circle cx="144" cy="42" r="23" fill={C.ink} />
      <circle cx="56" cy="44" r="10" fill="#F0AEA8" />
      <circle cx="144" cy="44" r="10" fill="#F0AEA8" />
      {/* head */}
      <circle cx="100" cy="98" r="64" fill="#FFFFFF" stroke={C.ink} strokeWidth="3" />
      <ellipse cx="100" cy="150" rx="40" ry="14" fill="#000000" opacity="0.04" />
      {/* eye patches */}
      <ellipse cx="78" cy="94" rx="17" ry="22" fill={C.ink} transform="rotate(-16 78 94)" />
      <ellipse cx="122" cy="94" rx="17" ry="22" fill={C.ink} transform="rotate(16 122 94)" />
      {/* eyes */}
      <Eye x={80} />
      <Eye x={120} />
      {/* brows */}
      {focused && <path d="M64 74 L86 80" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />}
      {focused && <path d="M136 74 L114 80" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />}
      {curious && <path d="M112 70 Q123 63 134 70" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />}
      {/* nose */}
      <path d="M93 110 Q100 120 107 110 Z" fill={C.ink} />
      <ellipse cx="97" cy="111" rx="1.6" ry="1.1" fill="#FFFFFF" opacity="0.7" />
      {mouth}
      {/* blush */}
      <ellipse cx="60" cy="112" rx="9" ry="6" fill="#F7A7A0" opacity={blushOp} />
      <ellipse cx="140" cy="112" rx="9" ry="6" fill="#F7A7A0" opacity={blushOp} />
      {/* artist beret */}
      <g transform="rotate(-14 96 34)">
        <ellipse cx="96" cy="36" rx="27" ry="12" fill={C.bamboo} />
        <path d="M69 38 Q96 50 123 38 Q96 44 69 38 Z" fill="#4F9258" />
        <circle cx="96" cy="25" r="4.5" fill={C.bamboo} />
      </g>
      {/* paintbrush, fully in front, held up by the right paw */}
      <g transform="rotate(15 172 150)">
        <rect x="167" y="118" width="9" height="66" rx="4" fill="#C9882E" />
        <rect x="167" y="111" width="9" height="9" rx="2" fill="#B7B0A2" />
        <path d="M166 96 q5.5 -7 11 0 l-1 17 q-4.5 3 -9 0 z" fill={C.bamboo} />
        <path d="M171 99 l4 2 -1.5 9 z" fill={C.gold} />
      </g>
      {/* sparkles when excited */}
      {excited && <path d="M171 58 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill={C.gold} />}
      {excited && <path d="M150 38 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill={C.gold} />}
    </svg>
  );
}

/* ============================ Confetti ============================ */
function Confetti({ count = 80 }) {
  const palette = [C.gold, C.bamboo, C.red, "#7FB2F0", "#F19CC2"];
  const pieces = useMemo(() => {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2 + Math.random() * 1.8,
        color: palette[i % palette.length],
        size: 7 + Math.random() * 8,
        rot: Math.random() * 360,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "-20px",
            left: p.left + "%",
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `pa-fall ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ===================== Small celebration overlay ===================== */
function CelebrationOverlay({ text, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 30, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "rgba(253,246,236,0.94)", textAlign: "center", padding: 24, cursor: "pointer",
      }}
    >
      <Confetti count={70} />
      <div style={{ animation: "pa-jump 0.7s ease-in-out infinite" }}>
        <Panda sz={150} ex="excited" />
      </div>
      <div style={{ fontSize: 40, letterSpacing: 6, marginTop: 8 }}>⭐⭐⭐</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 10 }}>{text}</div>
      <div style={{ marginTop: 16, fontSize: 15, color: "#8A8276" }}>轻触任意处继续</div>
    </div>
  );
}

/* ============================== Toast ============================== */
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: C.ink, color: "#fff", padding: "12px 20px", borderRadius: 14,
      fontSize: 15, fontWeight: 600, zIndex: 999, maxWidth: "88%",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "pa-toast 0.25s ease",
    }}>
      {msg}
    </div>
  );
}

/* ============================ Big button ============================ */
function BigButton({ children, onClick, color = C.bamboo, light, style, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 56, padding: "14px 26px", borderRadius: 18, fontSize: 19, fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer", border: light ? `2px solid ${color}` : "none",
        background: disabled ? "#D8D2C6" : light ? "#fff" : color,
        color: light ? color : "#fff", transition: "transform .08s, filter .15s",
        boxShadow: light ? "none" : "0 4px 0 rgba(0,0,0,0.12)", ...style,
      }}
      onMouseDown={(ev) => { ev.currentTarget.style.transform = "translateY(2px)"; }}
      onMouseUp={(ev) => { ev.currentTarget.style.transform = "translateY(0)"; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

/* ============================== Shell ============================== */
function Shell({ children, banner }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.ink, display: "flex", flexDirection: "column",
      fontFamily: "'PingFang SC','Microsoft YaHei','Hiragino Sans GB',system-ui,sans-serif" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        background: C.card, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20,
      }}>
        <Panda sz={38} ex="neutral" />
        <span style={{ fontWeight: 800, fontSize: 17 }}>熊猫画画班</span>
        <span style={{ color: "#B7AE9F" }}>｜</span>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#6B6356" }}>汉字练习</span>
      </header>
      {banner}
      <main style={{ flex: 1, width: "100%", maxWidth: 920, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
        {children}
      </main>
      <footer style={{ textAlign: "center", padding: "14px", color: "#9C9382", fontSize: 14 }}>
        画画写字，一起进步 🐼
      </footer>
    </div>
  );
}

/* =========================== Card helper =========================== */
function Card({ children, style }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, ...style }}>
      {children}
    </div>
  );
}

/* ===================================================================
   ACTIVITY 1 — 认一认 (Flashcards)
   =================================================================== */
function FlashcardActivity({ meta, onDone }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState(() => new Set([0]));
  const chars = meta.chars;
  const allSeen = seen.size >= chars.length;

  const go = useCallback((dir) => {
    setFlipped(false);
    setIdx((prev) => {
      const next = (prev + dir + chars.length) % chars.length;
      setSeen((s) => new Set(s).add(next));
      return next;
    });
  }, [chars.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>轻触卡片翻面，看看它读什么</p>
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{
          width: "min(86vw, 320px)", height: 320, cursor: "pointer", perspective: 1000,
        }}
      >
        <div style={{
          position: "relative", width: "100%", height: "100%", transition: "transform .5s",
          transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none",
        }}>
          {/* front */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", background: C.card,
            border: `3px solid ${C.border}`, borderRadius: 24, display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
          }}>
            <span style={{ fontSize: 150, fontWeight: 800 }}>{chars[idx]}</span>
          </div>
          {/* back */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)",
            background: "#FFFBF2", border: `3px solid ${C.gold}`, borderRadius: 24, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <span style={{ fontSize: 96, fontWeight: 800 }}>{chars[idx]}</span>
            <span style={{ fontSize: 30, color: C.bamboo, fontWeight: 700 }}>{meta.pinyins[idx] || ""}</span>
            <span style={{ fontSize: 56 }}>{meta.emojiMap[chars[idx]] || "✨"}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <BigButton color={C.bamboo} light onClick={() => go(-1)}>← 上一个</BigButton>
        <span style={{ fontWeight: 800, color: "#8A8276" }}>{idx + 1} / {chars.length}</span>
        <BigButton color={C.bamboo} light onClick={() => go(1)}>下一个 →</BigButton>
      </div>

      {allSeen && (
        <BigButton color={C.gold} onClick={onDone} style={{ marginTop: 6 }}>全部认识了！⭐</BigButton>
      )}
    </div>
  );
}

/* ===================================================================
   ACTIVITY 2 — 找一找 (Find the character)
   =================================================================== */
function FindActivity({ meta, onDone }) {
  const targets = meta.chars;
  const [targetIdx, setTargetIdx] = useState(0);
  const [bubbles, setBubbles] = useState([]);
  const [shakeId, setShakeId] = useState(null);

  useEffect(() => {
    // build 20 bubbles: each week char once, fill with distractors
    const pool = [];
    targets.forEach((ch) => pool.push(ch));
    const fillers = meta.distractors.length ? meta.distractors : ["大", "小", "上", "下"];
    let fi = 0;
    while (pool.length < 20) {
      pool.push(fillers[fi % fillers.length]);
      fi++;
    }
    const arranged = shuffled(pool).map((ch, i) => ({
      id: "b" + i + "_" + Math.random().toString(36).slice(2, 6),
      ch,
      top: 8 + Math.random() * 78,
      left: 6 + Math.random() * 80,
      dur: 3 + Math.random() * 3,
      delay: Math.random() * 2,
      gone: false,
    }));
    setBubbles(arranged);
  }, [meta, targets]);

  const current = targets[targetIdx];

  const onTap = useCallback((b) => {
    if (b.gone) return;
    if (b.ch === current) {
      setBubbles((list) => list.map((x) => (x.id === b.id ? { ...x, gone: true } : x)));
      setTimeout(() => {
        setTargetIdx((t) => {
          if (t + 1 >= targets.length) {
            onDone();
            return t;
          }
          return t + 1;
        });
      }, 350);
    } else {
      setShakeId(b.id);
      setTimeout(() => setShakeId(null), 450);
    }
  }, [current, targets.length, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 18, color: "#6B6356", fontWeight: 700 }}>找一找：</span>
        <span style={{ fontSize: 48, fontWeight: 800, color: C.red, lineHeight: 1 }}>{current}</span>
        <span style={{ fontSize: 15, color: "#8A8276" }}>（{targetIdx + 1}/{targets.length}）</span>
      </div>
      <div style={{
        position: "relative", width: "100%", maxWidth: 720, height: 440,
        background: "linear-gradient(135deg,#FFE9F1 0%,#FFF3DE 30%,#E7F6FF 62%,#E6F8EC 100%)",
        border: `2px solid ${C.border}`, borderRadius: 20, overflow: "hidden",
      }}>
        {/* soft decorative color blobs */}
        <div style={{ position: "absolute", width: 220, height: 220, top: -60, left: -40, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,200,66,0.25), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 260, height: 260, bottom: -80, right: -50, borderRadius: "50%", background: "radial-gradient(circle, rgba(107,175,114,0.22), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 180, height: 180, top: 110, left: "55%", borderRadius: "50%", background: "radial-gradient(circle, rgba(127,178,240,0.20), transparent 70%)", pointerEvents: "none" }} />

        {bubbles.map((b) => (
          b.gone ? (
            <div key={b.id} style={{
              position: "absolute", top: b.top + "%", left: b.left + "%", fontSize: 36,
              animation: "pa-pop .4s ease forwards", pointerEvents: "none",
            }}>💥</div>
          ) : (
            <button
              key={b.id}
              onClick={() => onTap(b)}
              style={{
                position: "absolute", top: b.top + "%", left: b.left + "%",
                width: 66, height: 66, minWidth: 56, minHeight: 56, borderRadius: "50%",
                border: "1.5px solid rgba(255,255,255,0.85)", cursor: "pointer",
                background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.96), rgba(214,236,255,0.6) 45%, rgba(180,216,248,0.5) 72%, rgba(255,255,255,0.22))",
                boxShadow: "0 6px 14px rgba(90,130,180,0.20), inset 0 -4px 8px rgba(120,160,210,0.18), inset 0 4px 8px rgba(255,255,255,0.7)",
                fontSize: 30, fontWeight: 800, color: C.ink,
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: `pa-float ${b.dur}s ease-in-out ${b.delay}s infinite${shakeId === b.id ? ", pa-shake .4s" : ""}`,
              }}
            >
              <span style={{ position: "absolute", top: 9, left: 13, width: 16, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.9)", transform: "rotate(-18deg)", pointerEvents: "none" }} />
              <span style={{ position: "relative" }}>{b.ch}</span>
            </button>
          )
        ))}
      </div>
      <p style={{ color: "#8A8276", fontSize: 14 }}>点对了会“爆开”，点错了会摇一摇～</p>
    </div>
  );
}

/* ===================================================================
   ACTIVITY 5 — 拼句子 (Build sentence by TAPPING tiles into order)
   Tap a tray tile to drop it into the next slot; tap a placed tile to
   send it back to its spot in the tray.
   =================================================================== */
function BuildActivity({ meta, onDone }) {
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

/* ===================================================================
   ACTIVITY 4 — 描一描 (Stroke-order tracing)
   Uses Hanzi Writer (loaded at runtime from jsDelivr) for stroke-order
   demo + per-stroke quiz. Falls back to freehand canvas when the
   library or a character's stroke data isn't available.
   =================================================================== */
let hwLoaderPromise = null;
function loadHanziWriter() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  if (hwLoaderPromise) return hwLoaderPromise;
  hwLoaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js";
    s.async = true;
    s.onload = () => (window.HanziWriter ? resolve(window.HanziWriter) : reject(new Error("no global")));
    s.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(s);
  });
  return hwLoaderPromise;
}

const TRACE_SIZE = 300;

function TraceActivity({ meta, onDone }) {
  const chars = meta.chars;
  const [idx, setIdx] = useState(0);
  const [scriptState, setScriptState] = useState("loading"); // loading | ready | failed
  const [charFallback, setCharFallback] = useState(false);
  const [done, setDone] = useState(false);

  const hwRef = useRef(null);       // Hanzi Writer container
  const writerRef = useRef(null);
  const canvasRef = useRef(null);   // freehand fallback canvas
  const drawing = useRef(false);
  const last = useRef(null);

  const isLast = idx >= chars.length - 1;

  // load the library once
  useEffect(() => {
    let alive = true;
    loadHanziWriter()
      .then(() => { if (alive) setScriptState("ready"); })
      .catch(() => { if (alive) setScriptState("failed"); });
    return () => { alive = false; };
  }, []);

  // when moving to a new character, give Hanzi Writer another chance
  useEffect(() => { setCharFallback(false); setDone(false); }, [idx]);

  const startQuiz = useCallback((w) => {
    try {
      w.quiz({
        leniency: 1.4,
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        onComplete: () => {
          setDone(true);
          setTimeout(() => {
            setIdx((prev) => {
              if (prev + 1 >= chars.length) { onDone(); return prev; }
              return prev + 1;
            });
          }, 900);
        },
      });
    } catch (e) { /* ignore */ }
  }, [chars.length, onDone]);

  // build the Hanzi Writer instance for the current character
  useEffect(() => {
    if (scriptState !== "ready" || charFallback) return undefined;
    const node = hwRef.current;
    if (!node) return undefined;
    node.innerHTML = "";
    let writer;
    try {
      writer = window.HanziWriter.create(node, chars[idx], {
        width: TRACE_SIZE, height: TRACE_SIZE, padding: 8,
        showCharacter: false, showOutline: true,
        strokeColor: "#1A1A1A", outlineColor: "#E8E0D5",
        drawingColor: "#6BAF72", highlightColor: "#F5C842",
        drawingWidth: 26, strokeAnimationSpeed: 1, delayBetweenStrokes: 180,
        onLoadCharDataError: () => setCharFallback(true),
      });
      writerRef.current = writer;
      startQuiz(writer);
    } catch (e) {
      setCharFallback(true);
    }
    return () => {
      try { if (writer && writer.cancelQuiz) writer.cancelQuiz(); } catch (e) { /* ignore */ }
    };
  }, [scriptState, charFallback, idx, chars, startQuiz]);

  const showStrokeOrder = useCallback(() => {
    const w = writerRef.current;
    if (!w) return;
    try {
      if (w.cancelQuiz) w.cancelQuiz();
      w.animateCharacter({ onComplete: () => startQuiz(w) });
    } catch (e) { /* ignore */ }
  }, [startQuiz]);

  const restartChar = useCallback(() => {
    const w = writerRef.current;
    if (w) startQuiz(w);
  }, [startQuiz]);

  // ---- freehand fallback ----
  const clearCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }, []);
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }, [idx, charFallback]);
  const posOf = (ev) => {
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) * (cv.width / rect.width), y: (ev.clientY - rect.top) * (cv.height / rect.height) };
  };
  const fStart = (ev) => { ev.preventDefault(); drawing.current = true; last.current = posOf(ev); };
  const fMove = (ev) => {
    if (!drawing.current) return;
    ev.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = posOf(ev);
    ctx.strokeStyle = "rgba(26,26,26,0.55)"; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const fEnd = () => { drawing.current = false; last.current = null; };

  const useFreehand = scriptState === "failed" || charFallback;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>
        {useFreehand ? "照着灰色的字，用手指描一描" : "按照笔顺，一笔一笔描出来（点错会有提示）"}
      </p>

      <div style={{
        position: "relative", width: TRACE_SIZE, maxWidth: "86vw", height: TRACE_SIZE, maxHeight: "86vw",
        background: C.card, border: `2px solid ${done ? C.bamboo : C.border}`, borderRadius: 20, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* light guide grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed #EFE8DB" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px dashed #EFE8DB" }} />
        </div>

        {!useFreehand && scriptState === "loading" && (
          <span style={{ color: "#9C9382", fontSize: 15 }}>正在加载笔顺…</span>
        )}

        {!useFreehand && (
          <div ref={hwRef} style={{ width: TRACE_SIZE, height: TRACE_SIZE, touchAction: "none" }} />
        )}

        {useFreehand && (
          <>
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 240, fontWeight: 800, color: "#ECE6DB", userSelect: "none", pointerEvents: "none",
            }}>{chars[idx]}</div>
            <canvas
              ref={canvasRef} width={TRACE_SIZE} height={TRACE_SIZE}
              onPointerDown={fStart} onPointerMove={fMove} onPointerUp={fEnd} onPointerLeave={fEnd}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" }}
            />
          </>
        )}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>
        {idx + 1} / {chars.length}（{meta.pinyins[idx] || ""}）
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {!useFreehand && (
          <>
            <BigButton color={C.bamboo} light onClick={showStrokeOrder}>👀 看笔顺</BigButton>
            <BigButton color={C.red} light onClick={restartChar}>重描这个字 🔄</BigButton>
          </>
        )}
        {useFreehand && (
          <>
            <BigButton color={C.red} light onClick={clearCanvas}>清空 🧽</BigButton>
            {isLast ? (
              <BigButton color={C.gold} onClick={onDone}>全部写完了！⭐</BigButton>
            ) : (
              <BigButton color={C.bamboo} onClick={() => setIdx((i) => i + 1)}>下一个字 →</BigButton>
            )}
          </>
        )}
      </div>

      {!useFreehand && (
        <p style={{ color: "#9C9382", fontSize: 13, margin: 0, textAlign: "center" }}>
          描完一个字会自动跳到下一个。笔顺数据来自网络，离线时会自动切换成自由描红。
        </p>
      )}
    </div>
  );
}

/* ===================================================================
   连一连 (Matching) — kept for reference, no longer wired up.
   Replaced by 听一听 (ListenActivity) below.
   =================================================================== */
function MatchActivity({ meta, onDone }) {
  const chars = meta.chars;
  const rightItems = useMemo(
    () => shuffled(chars.map((ch) => ({ ch, emoji: meta.emojiMap[ch] || "✨" }))),
    [chars, meta.emojiMap]
  );
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState({}); // ch -> true
  const [lines, setLines] = useState([]); // {x1,y1,x2,y2,color,id}
  const wrapRef = useRef(null);
  const leftRefs = useRef({});
  const rightRefs = useRef({});

  const center = (el) => {
    const wrap = wrapRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top + r.height / 2 };
  };

  const onRight = useCallback((emojiChar) => {
    if (!selected) return;
    const leftEl = leftRefs.current[selected];
    const rightEl = rightRefs.current[emojiChar];
    if (!leftEl || !rightEl) return;
    const a = center(leftEl);
    const b = center(rightEl);
    if (emojiChar === selected) {
      const lid = "ln_" + selected;
      setLines((ls) => [...ls, { id: lid, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: C.bamboo }]);
      setMatched((m) => {
        const nm = { ...m, [selected]: true };
        if (Object.keys(nm).length >= chars.length) setTimeout(onDone, 350);
        return nm;
      });
      setSelected(null);
    } else {
      const wid = "wrong_" + Math.random().toString(36).slice(2, 6);
      setLines((ls) => [...ls, { id: wid, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: C.red, temp: true }]);
      setTimeout(() => setLines((ls) => ls.filter((l) => l.id !== wid)), 600);
      setSelected(null);
    }
  }, [selected, chars.length, onDone]);

  const cellStyle = (active, done) => ({
    width: "100%", minHeight: 56, padding: "10px 8px", borderRadius: 14, fontSize: 38, fontWeight: 800,
    border: `3px solid ${done ? C.gold : active ? C.bamboo : C.border}`,
    background: done ? "#FFFBF2" : active ? "#EAF6EC" : C.card,
    cursor: done ? "default" : "pointer", color: C.ink, opacity: done ? 0.55 : 1,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>先点左边的字，再点右边对应的图</p>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 440 }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 4 }}>
          {lines.map((l) => (
            <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.color} strokeWidth="5" strokeLinecap="round" opacity={l.temp ? 0.85 : 1} />
          ))}
        </svg>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {chars.map((ch) => (
              <button
                key={ch}
                ref={(el) => { if (el) leftRefs.current[ch] = el; }}
                onClick={() => !matched[ch] && setSelected(ch)}
                style={cellStyle(selected === ch, matched[ch])}
              >
                {ch}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rightItems.map((it) => (
              <button
                key={it.ch}
                ref={(el) => { if (el) rightRefs.current[it.ch] = el; }}
                onClick={() => !matched[it.ch] && onRight(it.ch)}
                style={cellStyle(false, matched[it.ch])}
              >
                {it.emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ color: "#8A8276", fontSize: 14 }}>已连对 {Object.keys(matched).length} / {chars.length}</div>
    </div>
  );
}

/* ===================================================================
   ACTIVITY 5 — 听一听 (Listen & Choose)
   Plays the character's sound via browser SpeechSynthesis (no library);
   the child taps the matching character among options.
   =================================================================== */
function ListenActivity({ meta, onDone }) {
  const chars = meta.chars;
  const [idx, setIdx] = useState(0);
  const [shakeCh, setShakeCh] = useState(null);
  const [solved, setSolved] = useState(false);
  const [audioOk, setAudioOk] = useState(true);
  const target = chars[idx];

  const options = useMemo(() => {
    const fillers = (meta.distractors && meta.distractors.length ? meta.distractors : ["大", "小", "上", "下"])
      .filter((d) => d !== target);
    const picks = shuffled(fillers).slice(0, 3);
    return shuffled([target, ...picks]);
  }, [target, meta.distractors]);

  const speak = useCallback((text) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) { setAudioOk(false); return; }
      // Only clear the queue if something is actually playing/pending —
      // calling cancel() every time is what tends to wedge the engine.
      // Speak SYNCHRONOUSLY so it stays tied to the user gesture (a
      // deferred speak gets blocked by the browser's autoplay policy).
      if (synth.speaking || synth.pending) synth.cancel();
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = 0.8;
      const voices = synth.getVoices() || [];
      const zh = voices.find((v) => /zh|cmn|chinese/i.test(v.lang) || /chinese|中文|普通话/i.test(v.name));
      if (zh) u.voice = zh;
      u.onerror = () => { /* swallow transient engine errors */ };
      synth.speak(u);
    } catch (err) {
      setAudioOk(false);
    }
  }, []);

  // Keep-alive: resume() while speaking defeats the "stops after ~15s"
  // bug; cancel any lingering speech when leaving the activity.
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return undefined;
    const keepAlive = setInterval(() => {
      try { if (synth.speaking) synth.resume(); } catch (e) { /* ignore */ }
    }, 8000);
    return () => {
      clearInterval(keepAlive);
      try { synth.cancel(); } catch (e) { /* ignore */ }
    };
  }, []);

  // Play the teacher's recording if one exists, else fall back to TTS.
  const audioElRef = useRef(null);
  const playSound = useCallback((ch) => {
    const url = meta.audioMap && meta.audioMap[ch];
    if (url) {
      try {
        if (!audioElRef.current) audioElRef.current = new window.Audio();
        const el = audioElRef.current;
        el.src = url;
        el.currentTime = 0;
        const p = el.play();
        if (p && p.catch) p.catch(() => speak(ch));
        return;
      } catch (e) { /* fall through to TTS */ }
    }
    speak(ch);
  }, [meta.audioMap, speak]);

  // play whenever the target character changes
  useEffect(() => {
    const t = setTimeout(() => playSound(target), 250);
    return () => clearTimeout(t);
  }, [target, playSound]);

  const onPick = useCallback((ch) => {
    if (solved) return;
    if (ch === target) {
      setSolved(true);
      setTimeout(() => {
        if (idx + 1 >= chars.length) {
          onDone();
        } else {
          setIdx((i) => i + 1);
          setSolved(false);
        }
      }, 650);
    } else {
      setShakeCh(ch);
      setTimeout(() => setShakeCh(null), 450);
    }
  }, [solved, target, idx, chars.length, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>听一听胖胖读的是哪个字，点出来！</p>

      <button
        onClick={() => playSound(target)}
        aria-label="播放字音"
        style={{
          width: 130, height: 130, minWidth: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
          boxShadow: "0 6px 0 rgba(0,0,0,0.12)", fontSize: 60, color: C.ink,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: solved ? "none" : "pa-pulse 1.6s ease-in-out infinite",
        }}
      >
        🔊
      </button>
      <BigButton color={C.bamboo} light onClick={() => playSound(target)}>再听一次 🔁</BigButton>

      {!audioOk && !(meta.audioMap && meta.audioMap[target]) && (
        <p style={{ color: C.red, fontSize: 13, margin: 0, textAlign: "center" }}>
          这个设备暂时放不出声音，小提示：这个字读「{meta.pinyins[idx] || ""}」
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "min(92vw, 360px)" }}>
        {options.map((ch) => {
          const isCorrect = solved && ch === target;
          return (
            <button
              key={ch}
              onClick={() => onPick(ch)}
              style={{
                minHeight: 92, borderRadius: 18, fontSize: 56, fontWeight: 800, color: C.ink, cursor: "pointer",
                border: "3px solid " + (isCorrect ? C.bamboo : C.border),
                background: isCorrect ? "#EAF6EC" : C.card,
                animation: shakeCh === ch ? "pa-shake .4s" : "none",
              }}
            >
              {ch}
            </button>
          );
        })}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>第 {idx + 1} / {chars.length} 个</div>
    </div>
  );
}

/* ===================================================================
   ACTIVITY 5 — 翻翻配对 (Memory match): pure tap, no audio.
   Flip two cards; match a character to its picture.
   =================================================================== */
function MemoryMatchActivity({ meta, onDone }) {
  const chars = meta.chars;
  const deck = useMemo(() => {
    const cards = [];
    chars.forEach((ch, i) => {
      cards.push({ id: "c" + i, key: ch, kind: "char", label: ch });
      cards.push({ id: "e" + i, key: ch, kind: "emoji", label: meta.emojiMap[ch] || "✨" });
    });
    return shuffled(cards);
  }, [chars, meta.emojiMap]);

  const [flipped, setFlipped] = useState([]); // indices currently face-up (max 2)
  const [matched, setMatched] = useState(() => new Set());
  const [lock, setLock] = useState(false);
  const total = deck.length;
  const pairsDone = matched.size / 2;

  const onFlip = useCallback((i) => {
    if (lock) return;
    if (matched.has(deck[i].id)) return;
    if (flipped.includes(i)) return;
    const nf = [...flipped, i];
    setFlipped(nf);
    if (nf.length === 2) {
      setLock(true);
      const a = nf[0];
      const b = nf[1];
      if (deck[a].key === deck[b].key) {
        setTimeout(() => {
          setMatched((prev) => {
            const ns = new Set(prev);
            ns.add(deck[a].id);
            ns.add(deck[b].id);
            if (ns.size >= total) setTimeout(onDone, 350);
            return ns;
          });
          setFlipped([]);
          setLock(false);
        }, 380);
      } else {
        setTimeout(() => { setFlipped([]); setLock(false); }, 850);
      }
    }
  }, [lock, matched, flipped, deck, total, onDone]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>翻开两张卡片，把字和它的图配成一对！</p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(68px, 1fr))",
        gap: 10, width: "min(94vw, 420px)",
      }}>
        {deck.map((card, i) => {
          const isMatched = matched.has(card.id);
          const isUp = isMatched || flipped.includes(i);
          return (
            <button
              key={card.id}
              onClick={() => onFlip(i)}
              disabled={isMatched}
              style={{
                aspectRatio: "1 / 1", minHeight: 68, borderRadius: 16,
                cursor: isMatched ? "default" : "pointer",
                border: "3px solid " + (isMatched ? C.bamboo : C.border),
                background: isUp
                  ? (isMatched ? "#EAF6EC" : "#FFFFFF")
                  : "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
                fontSize: card.kind === "emoji" ? 38 : 36, fontWeight: 800, color: C.ink,
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: isMatched ? 0.6 : 1, transition: "background .2s, opacity .2s",
                animation: isUp ? "pa-pop .25s ease" : "none",
              }}
            >
              {isUp ? card.label : "🐼"}
            </button>
          );
        })}
      </div>

      <div style={{ fontWeight: 800, color: "#8A8276" }}>已配对 {pairsDone} / {chars.length} 对</div>
    </div>
  );
}

/* ===================================================================
   ACTIVITY 3 — 过河踩石 (Cross the river by reading the sentence)
   Tap the next character of the week's sentence to hop the panda across.
   =================================================================== */
function RiverCrossActivity({ meta, onDone }) {
  const seq = useMemo(() => (meta.sentence || "").split("").filter((c) => c.trim()), [meta.sentence]);
  const [step, setStep] = useState(0);
  const [splashId, setSplashId] = useState(null);

  // pre-build the choice pads for each step so they don't reshuffle on render
  const pads = useMemo(() => {
    return seq.map((correct, i) => {
      const pool = [...(meta.chars || []), ...(meta.distractors || [])].filter((c) => c !== correct);
      const others = shuffled(pool).slice(0, 2);
      return shuffled([correct, ...others]).map((ch, j) => ({ id: "p" + i + "_" + j, ch }));
    });
  }, [seq, meta.chars, meta.distractors]);

  const total = seq.length;
  const onTapPad = useCallback((pad) => {
    if (pad.ch === seq[step]) {
      setStep((prev) => {
        const next = prev + 1;
        if (next >= total) setTimeout(onDone, 450);
        return next;
      });
    } else {
      setSplashId(pad.id);
      setTimeout(() => setSplashId(null), 500);
    }
  }, [seq, step, total, onDone]);

  if (total === 0) {
    return <p style={{ color: "#9C9382", textAlign: "center" }}>老师还没设置“练习句子”，先去内容设置里填一句吧。</p>;
  }

  const pandaLeft = total > 0 ? ((step + 0.5) / total) * 100 : 0;
  const crossed = step >= total;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>按句子的顺序踩石头，帮胖胖过河回家！</p>

      {/* sentence progress with blank for the current spot */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {seq.map((ch, i) => (
          <span key={i} style={{
            width: 42, height: 50, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 800,
            background: i < step ? "#EAF6EC" : i === step ? "#FFFBF2" : "#F4EEE3",
            border: `2px solid ${i === step ? C.gold : i < step ? C.bamboo : C.border}`,
            color: i < step ? C.ink : i === step ? "#C9B36A" : "transparent",
          }}>
            {i < step ? ch : i === step ? "？" : ch}
          </span>
        ))}
      </div>

      {/* river scene */}
      <div style={{
        position: "relative", width: "min(94vw, 460px)", height: 120, borderRadius: 16, overflow: "hidden",
        background: "linear-gradient(180deg,#BFE3F5,#7FC3E8)", border: `2px solid ${C.border}`,
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.4,
          background: "repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,.5) 18px 22px)",
          animation: "pa-water 3s linear infinite" }} />
        {/* far bank home */}
        <div style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 46, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🎋</div>
        {/* panda hopping across */}
        <div style={{
          position: "absolute", bottom: 8, left: `calc(${crossed ? 100 : pandaLeft}% - 26px)`,
          transition: "left .35s cubic-bezier(.34,1.56,.64,1)", animation: "pa-jump 1s ease-in-out infinite",
        }}>
          <Panda sz={52} ex={crossed ? "excited" : "focused"} />
        </div>
      </div>

      {/* stepping-stone choices for the current step */}
      {!crossed && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {pads[step].map((pad) => (
            <button
              key={pad.id}
              onClick={() => onTapPad(pad)}
              style={{
                position: "relative", width: 84, height: 84, minWidth: 56, borderRadius: "46% 46% 50% 50%",
                border: "3px solid #9aa17f", cursor: "pointer",
                background: "radial-gradient(circle at 40% 30%, #C8CBA6, #8E9472)",
                fontSize: 38, fontWeight: 800, color: C.ink,
                boxShadow: "0 5px 0 rgba(80,90,60,0.35)",
                animation: splashId === pad.id ? "pa-shake .4s" : "none",
              }}
            >
              {pad.ch}
              {splashId === pad.id && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>💦</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ fontWeight: 800, color: "#8A8276" }}>已过 {Math.min(step, total)} / {total} 步</div>
    </div>
  );
}

/* ===================================================================
   ACTIVITY 5 — 拼词语 (Build the week's vocab words)
   Uses the "vocab" field. Tap tiles into slots to spell each word.
   =================================================================== */
function BuildWordActivity({ meta, onDone }) {
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
        setTimeout(() => {
          setOkFlash(false);
          if (wi + 1 >= words.length) onDone();
          else setWi((p) => p + 1);
        }, 700);
      } else {
        setShake(true);
        setTimeout(buildTiles, 700);
      }
      return cur;
    });
  }, [targetChars, wi, words.length, onDone, buildTiles]);

  const place = useCallback((tileId) => {
    setSlots((prev) => {
      const firstEmpty = prev.indexOf(null);
      if (firstEmpty === -1) return prev;
      const ns = prev.slice();
      ns[firstEmpty] = tileId;
      setTiles((pt) => pt.map((t) => (t.id === tileId ? { ...t, placed: firstEmpty } : t)));
      if (!ns.includes(null)) setTimeout(() => check(ns), 180);
      return ns;
    });
  }, [check]);

  const returnTile = useCallback((slotIndex) => {
    setSlots((prev) => {
      const tid = prev[slotIndex];
      if (!tid) return prev;
      const ns = prev.slice();
      ns[slotIndex] = null;
      setTiles((pt) => pt.map((t) => (t.id === tid ? { ...t, placed: null } : t)));
      return ns;
    });
  }, []);

  if (words.length === 0) {
    return <p style={{ color: "#9C9382", textAlign: "center" }}>老师还没设置“词汇”，先去内容设置里填几个词语吧（例如 山水、火山）。</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <p style={{ fontSize: 16, color: "#6B6356" }}>看上面的词，把字按顺序拼出来</p>
      <div style={{ fontSize: 20, fontWeight: 800 }}>
        拼出：<span style={{ color: C.bamboo, fontSize: 30 }}>{word}</span>
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

/* ===================================================================
   Activity host — wraps a single activity with header + celebration
   =================================================================== */
function ActivityHost({ activityIndex, meta, readOnly, onComplete, onBack }) {
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

/* ===================================================================
   Student Home
   =================================================================== */
function StudentHome({ studentName, meta, progress, readOnly, onOpenActivity, onOpenArchive, onLogout }) {
  const doneCount = ACTIVITIES.filter((_, i) => progress[i]).length;
  const allDone = doneCount === ACTIVITIES.length;
  const [showFinale, setShowFinale] = useState(false);

  useEffect(() => {
    if (allDone && !readOnly) setShowFinale(true);
  }, [allDone, readOnly]);

  const messages = ["继续加油，胖胖陪着你！", "你做得真好！", "再来一个就更厉害啦！", "了不起，快完成啦！", "全部完成，太厉害啦！"];

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6 }}>
        <div style={{ animation: "pa-jump 1.4s ease-in-out infinite" }}>
          <Panda sz={120} ex="excited" />
        </div>
        <h1 style={{ margin: "6px 0 0", fontSize: 26 }}>你好，{studentName}！👋</h1>
        <span style={{
          display: "inline-block", background: "#EAF6EC", color: C.bamboo, fontWeight: 700,
          borderRadius: 999, padding: "6px 14px", fontSize: 15, border: `1px solid ${C.bamboo}33`,
        }}>
          {meta.label} · {meta.chars.join("")}
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
              <span style={{ display: "block", fontSize: 14, color: "#8A8276" }}>{a.desc}</span>
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
        <button onClick={onLogout} style={{
          minHeight: 56, padding: "0 18px", background: "none", border: "none", color: "#9C9382",
          fontSize: 15, textDecoration: "underline", cursor: "pointer",
        }}>退出登录</button>
      </div>

      {showFinale && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(253,246,236,0.97)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: 24,
        }}>
          <Confetti count={120} />
          <div style={{ animation: "pa-jump 0.7s ease-in-out infinite" }}>
            <Panda sz={170} ex="excited" />
          </div>
          <div style={{ fontSize: 44, letterSpacing: 8, marginTop: 6 }}>🎓</div>
          <h2 style={{ fontSize: 26, margin: "8px 0" }}>本周全部完成！</h2>
          <p style={{ fontSize: 18, color: "#6B6356" }}>胖胖为你鼓掌！👏</p>
          <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
            <BigButton color={C.gold} onClick={() => { setShowFinale(false); onOpenArchive(); }}>查看历史记录 📚</BigButton>
            <BigButton color={C.bamboo} light onClick={() => setShowFinale(false)}>继续看看</BigButton>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   Archive Panel
   =================================================================== */
function ArchivePanel({ weeks, currentId, getProgress, onClose, onReview }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />
      <div style={{
        position: "relative", width: "min(420px, 92vw)", height: "100%", background: C.bg,
        borderLeft: `1px solid ${C.border}`, overflowY: "auto", animation: "pa-slidein .3s ease",
        padding: 18, boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>📚 历史记录</h2>
          <button onClick={onClose} style={{
            minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.border}`,
            background: "#fff", fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>
        {weeks.map((w) => {
          const pr = getProgress(w.id);
          const stars = ACTIVITIES.filter((_, i) => pr[i]).length;
          const isCur = w.id === currentId;
          return (
            <div key={w.id} style={{
              background: isCur ? "#EAF6EC" : C.card, border: `2px solid ${isCur ? C.bamboo : C.border}`,
              borderRadius: 16, padding: 16, marginBottom: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 19, fontWeight: 800 }}>{w.label}</span>
                {isCur && <span style={{ fontSize: 13, color: C.bamboo, fontWeight: 700 }}>本周</span>}
              </div>
              <div style={{ fontSize: 13, color: "#9C9382", margin: "2px 0 6px" }}>
                {new Date(w.createdAt).toLocaleDateString("zh-CN")}
              </div>
              <div style={{ fontSize: 22, letterSpacing: 2, marginBottom: 6 }}>
                {"⭐".repeat(stars)}{"☆".repeat(ACTIVITIES.length - stars)}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4 }}>{w.chars.join("")}</div>
              {!isCur && (
                <button onClick={() => onReview(w.id)} style={{
                  marginTop: 10, minHeight: 48, padding: "0 16px", borderRadius: 12, border: "none",
                  background: C.gold, fontWeight: 800, fontSize: 15, cursor: "pointer", color: C.ink,
                }}>查看回顾 →</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================================================================
   Landing — single teacher passcode + class list/create; parent join
   =================================================================== */
function Landing({ onEnter, pushToast }) {
  const [tab, setTab] = useState("parent");
  const [childName, setChildName] = useState("");
  const [invite, setInvite] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [teacherRole, setTeacherRole] = useState("teacher");
  const [classes, setClasses] = useState([]);
  const [newName, setNewName] = useState("");
  const [newInvite, setNewInvite] = useState("");

  const inputStyle = {
    width: "100%", minHeight: 56, padding: "0 16px", borderRadius: 14, fontSize: 17,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };
  const lbl = { fontWeight: 700, fontSize: 15 };

  const submitParent = async () => {
    setErr("");
    const nm = childName.trim();
    if (!nm) { setErr("请输入小朋友的名字"); return; }
    if (!invite.trim()) { setErr("请输入班级邀请码"); return; }
    setBusy(true);
    try {
      const list = await getClasses();
      const cls = list.find((c) => normCode(c.invite_code) === normCode(invite));
      if (!cls) { setErr("邀请码不对，请联系老师确认 🐼"); setBusy(false); return; }
      const roster = Array.isArray(cls.students) ? cls.students : [];
      if (roster.length > 0 && !roster.includes(nm)) {
        setErr("找不到这个名字，请联系老师确认 🐼"); setBusy(false); return;
      }
      onEnter(cls, { role: "parent", name: nm });
    } catch (e) {
      setErr("连接失败，请检查网络 ⚠️"); setBusy(false);
    }
  };

  const submitTeacher = async () => {
    setErr("");
    let role = null;
    if (pw === ADMIN_CODE) role = "admin";
    else if (pw === TEACHER_CODE) role = "teacher";
    if (!role) { setErr("口令不对，请再试一次"); return; }
    setTeacherRole(role);
    setBusy(true);
    try {
      const list = await getClasses();
      setClasses(list); setAuthed(true);
    } catch (e) { setErr("连接失败，请检查网络 ⚠️"); }
    setBusy(false);
  };

  const createClass = async () => {
    setErr("");
    const nm = newName.trim(); const code = newInvite.trim();
    if (!nm) { setErr("请输入班级名称"); return; }
    if (!code) { setErr("请设置家长邀请码"); return; }
    setBusy(true);
    try {
      const list = await getClasses();
      if (list.some((c) => normCode(c.invite_code) === normCode(code))) {
        setErr("这个邀请码已被别的班级用了，换一个"); setBusy(false); return;
      }
      const cls = { id: "cls_" + Math.random().toString(36).slice(2, 9), name: nm, invite_code: code, students: [] };
      await saveClasses([...list, cls]);
      onEnter(cls, { role: teacherRole });
    } catch (e) { setErr("建班失败，请检查网络 ⚠️"); setBusy(false); }
  };

  const tabs = [{ k: "parent", label: "🏠 家长" }, { k: "teacher", label: "👩‍🏫 老师" }];

  return (
    <div style={{ maxWidth: 460, margin: "10px auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
        <Panda sz={110} ex="curious" />
        <h1 style={{ fontSize: 24, margin: "8px 0 2px" }}>熊猫画画班</h1>
        <p style={{ color: "#8A8276", margin: 0 }}>欢迎回来，一起练汉字吧！</p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#F1E9DC", padding: 6, borderRadius: 14 }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => { setTab(t.k); setErr(""); }} style={{
            flex: 1, minHeight: 48, borderRadius: 10, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700,
            background: tab === t.k ? "#fff" : "transparent", color: tab === t.k ? C.ink : "#8A8276",
            boxShadow: tab === t.k ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      <Card>
        {tab === "parent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={lbl}>小朋友的名字</label>
            <input style={inputStyle} value={childName} placeholder="例如：小明"
              onChange={(ev) => setChildName(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submitParent()} />
            <label style={lbl}>班级邀请码</label>
            <input style={inputStyle} value={invite} placeholder="老师给的邀请码"
              onChange={(ev) => setInvite(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submitParent()} />
            <BigButton color={C.bamboo} onClick={submitParent} disabled={busy} style={{ marginTop: 4 }}>
              {busy ? "请稍候…" : "开始练习 🚀"}
            </BigButton>
          </div>
        )}

        {tab === "teacher" && !authed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={lbl}>老师口令</label>
            <input style={inputStyle} type="password" value={pw} placeholder="请输入老师口令"
              onChange={(ev) => setPw(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submitTeacher()} />
            <p style={{ fontSize: 13, color: "#9C9382", margin: 0 }}>授课老师 / 教务老师各用各的口令，进去后选/建自己的班</p>
            <BigButton color={C.bamboo} onClick={submitTeacher} disabled={busy}>{busy ? "请稍候…" : "进入 →"}</BigButton>
          </div>
        )}

        {tab === "teacher" && authed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>选择班级</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {classes.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>还没有班级，下面新建一个吧。</span>}
                {classes.map((c) => (
                  <button key={c.id} onClick={() => onEnter(c, { role: teacherRole })} style={{
                    textAlign: "left", minHeight: 56, padding: "10px 16px", borderRadius: 14,
                    border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <span style={{ fontWeight: 800, fontSize: 17 }}>{c.name}</span>
                    <span style={{ fontSize: 13, color: "#9C9382" }}>邀请码 {c.invite_code} →</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
              <label style={lbl}>＋ 新建班级</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                <input style={inputStyle} value={newName} placeholder="班级名称，例如：周六中班"
                  onChange={(ev) => setNewName(ev.target.value)} />
                <input style={inputStyle} value={newInvite} placeholder="家长邀请码，例如：PANDA2026"
                  onChange={(ev) => setNewInvite(ev.target.value)} />
                <BigButton color={C.gold} onClick={createClass} disabled={busy}>{busy ? "请稍候…" : "建好并进入 🏫"}</BigButton>
              </div>
            </div>
          </div>
        )}

        {err && <p style={{ color: C.red, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>{err}</p>}
      </Card>
    </div>
  );
}

/* ===================================================================
   Progress Dashboard
   =================================================================== */
function Dashboard({ roster, students, getStudent }) {
  const names = (roster && roster.length > 0) ? roster : Object.keys(students);
  return (
    <Card style={{ overflowX: "auto" }}>
      <h3 style={{ marginTop: 0 }}>📊 本周学习进度</h3>
      {names.length === 0 ? (
        <p style={{ color: "#8A8276" }}>这个班还没有学生。请教务老师在“👧 学生”里添加。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr style={{ textAlign: "center" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: `2px solid ${C.border}` }}>学生</th>
              {ACTIVITIES.map((a) => (
                <th key={a.key} style={{ padding: 8, borderBottom: `2px solid ${C.border}`, fontSize: 13 }}>{a.emoji}<br />{a.name}</th>
              ))}
              <th style={{ padding: 8, borderBottom: `2px solid ${C.border}` }}>完成度</th>
            </tr>
          </thead>
          <tbody>
            {names.map((nm) => {
              const rec = getStudent(nm) || { completed: [] };
              const comp = rec.completed || [];
              const ratio = comp.length / ACTIVITIES.length;
              return (
                <tr key={nm}>
                  <td style={{ padding: 8, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{nm}</td>
                  {ACTIVITIES.map((_, i) => (
                    <td key={i} style={{ textAlign: "center", padding: 8, borderBottom: `1px solid ${C.border}`, fontSize: 18 }}>
                      {comp.includes(i) ? "✅" : "⬜"}
                    </td>
                  ))}
                  <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, minWidth: 120 }}>
                    <div style={{ background: "#EEE7DA", borderRadius: 999, height: 12, overflow: "hidden" }}>
                      <div style={{ width: ratio * 100 + "%", height: "100%", background: C.bamboo }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#8A8276" }}>{comp.length}/{ACTIVITIES.length}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ===================================================================
   Content Settings form
   =================================================================== */
function ContentSettings({ meta, isAdmin, onSave, onSaveAudio, onStartNewWeek, pushToast }) {
  const [label, setLabel] = useState(meta.label);
  const [charsStr, setCharsStr] = useState(meta.chars.join(" "));
  const [pinyinStr, setPinyinStr] = useState(meta.pinyins.join(" "));
  const [vocabStr, setVocabStr] = useState(meta.vocab.join(" "));
  const [sentence, setSentence] = useState(meta.sentence);
  const [emojiStr, setEmojiStr] = useState(
    Object.entries(meta.emojiMap).map(([k, v]) => k + "→" + v).join(" ")
  );
  const [distractorStr, setDistractorStr] = useState(meta.distractors.join(" "));
  const [inviteCode, setInviteCode] = useState(meta.inviteCode);

  // ---- per-character teacher recordings ----
  const [audioMap, setAudioMap] = useState(meta.audioMap || {});
  const [recChar, setRecChar] = useState(null); // char currently recording
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const autoStopRef = useRef(null);

  const stopTracks = () => {
    try { if (streamRef.current) streamRef.current.getTracks().forEach((tk) => tk.stop()); } catch (e) { /* ignore */ }
    streamRef.current = null;
  };

  const startRec = async (ch) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === "undefined") {
        pushToast("这个浏览器/环境不支持录音 🎤"); return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new window.MediaRecorder(stream);
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          setAudioMap((prev) => ({ ...prev, [ch]: dataUrl }));
          onSaveAudio(ch, dataUrl);
          pushToast("录好了：" + ch + " ✅");
        };
        reader.onerror = () => pushToast("录音保存失败 ⚠️");
        reader.readAsDataURL(blob);
        stopTracks();
        setRecChar(null);
      };
      recorderRef.current = mr;
      mr.start();
      setRecChar(ch);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => {
        try { if (mr.state === "recording") mr.stop(); } catch (e) { /* ignore */ }
      }, 3000);
    } catch (err) {
      stopTracks();
      setRecChar(null);
      pushToast("没法录音，请允许使用麦克风 🎤");
    }
  };

  const stopRec = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    try { if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop(); }
    catch (e) { setRecChar(null); }
  };

  const playPreview = (ch) => {
    const url = audioMap[ch];
    if (!url) return;
    try {
      if (!previewRef.current) previewRef.current = new Audio();
      previewRef.current.src = url;
      previewRef.current.currentTime = 0;
      const p = previewRef.current.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  };

  const clearRec = (ch) => {
    setAudioMap((prev) => {
      const np = { ...prev };
      delete np[ch];
      return np;
    });
    onSaveAudio(ch, null);
    pushToast("已删除：" + ch);
  };

  // cleanup on unmount
  useEffect(() => () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    stopTracks();
  }, []);

  const inputStyle = {
    width: "100%", minHeight: 52, padding: "10px 14px", borderRadius: 12, fontSize: 16,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };
  const labelStyle = { fontWeight: 700, fontSize: 15, marginBottom: 4, display: "block" };

  const parseEmoji = (str) => {
    const map = {};
    str.split(/\s+/).filter(Boolean).forEach((pair) => {
      const parts = pair.split("→");
      if (parts.length === 2) map[parts[0]] = parts[1];
    });
    return map;
  };

  const save = () => {
    const next = {
      ...meta,
      label: label.trim() || meta.label,
      chars: charsStr.split(/\s+/).filter(Boolean),
      pinyins: pinyinStr.split(/\s+/).filter(Boolean),
      vocab: vocabStr.split(/\s+/).filter(Boolean),
      sentence: sentence.trim(),
      emojiMap: parseEmoji(emojiStr),
      distractors: distractorStr.split(/\s+/).filter(Boolean),
      inviteCode: inviteCode.trim(),
      students: meta.students,
      audioMap,
    };
    onSave(next);
  };

  // ---- shared lesson library (copy in / contribute) ----
  const [libOpen, setLibOpen] = useState(false);
  const [lib, setLib] = useState([]);
  const [libBusy, setLibBusy] = useState(false);

  const openLibrary = async () => {
    setLibBusy(true);
    try { setLib(await getLibraryLessons()); setLibOpen(true); }
    catch (e) { pushToast("课程库读取失败 ⚠️"); }
    setLibBusy(false);
  };
  const useLesson = (ls) => {
    // copy a library lesson's content into the form (independent copy)
    setLabel(ls.label || label);
    setCharsStr((ls.chars || []).join(" "));
    setPinyinStr((ls.pinyins || []).join(" "));
    setVocabStr((ls.vocab || []).join(" "));
    setSentence(ls.sentence || "");
    setEmojiStr(Object.entries(ls.emojiMap || {}).map(([k, v]) => k + "→" + v).join(" "));
    setDistractorStr((ls.distractors || []).join(" "));
    setLibOpen(false);
    pushToast("已填入：" + (ls.label || "课程") + "，记得点保存");
  };
  const contribute = async () => {
    const chars = charsStr.split(/\s+/).filter(Boolean);
    if (chars.length === 0) { pushToast("先填好汉字再存入课程库"); return; }
    setLibBusy(true);
    try {
      await addLibraryLesson({
        id: "lib_" + Date.now().toString(36),
        label: label.trim() || "未命名",
        chars, pinyins: pinyinStr.split(/\s+/).filter(Boolean),
        vocab: vocabStr.split(/\s+/).filter(Boolean), sentence: sentence.trim(),
        emojiMap: parseEmoji(emojiStr), distractors: distractorStr.split(/\s+/).filter(Boolean),
      });
      pushToast("已存入课程库，别的班也能用啦 📚");
    } catch (e) { pushToast("存入失败 ⚠️"); }
    setLibBusy(false);
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>✏️ 本周内容设置</h3>

      {/* shared lesson library */}
      <div style={{ background: "#FFFBF2", border: `2px solid ${C.gold}55`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📚 课程库</span>
          <button onClick={openLibrary} disabled={libBusy} style={{
            minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.bamboo}`,
            background: "#fff", color: C.bamboo, fontWeight: 700, cursor: "pointer",
          }}>从课程库选用</button>
          <button onClick={contribute} disabled={libBusy} style={{
            minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.border}`,
            background: "#fff", fontWeight: 700, cursor: "pointer",
          }}>⬆️ 存入课程库</button>
        </div>
        <p style={{ fontSize: 12, color: "#9C9382", margin: "8px 0 0" }}>
          “选用”会把课程内容填进下面的表单（拷贝一份，之后随便改、不影响别人）；改完点“保存内容”才生效。
        </p>
        {libOpen && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {lib.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>课程库还是空的，先“存入课程库”贡献一周吧。</span>}
            {lib.map((ls) => (
              <button key={ls.id} onClick={() => useLesson(ls)} style={{
                textAlign: "left", minHeight: 48, padding: "8px 12px", borderRadius: 10,
                border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer",
              }}>
                <span style={{ fontWeight: 800 }}>{ls.label}</span>
                <span style={{ color: "#8A8276", marginLeft: 8 }}>{(ls.chars || []).join(" ")}</span>
              </button>
            ))}
            <button onClick={() => setLibOpen(false)} style={{
              alignSelf: "flex-start", minHeight: 40, padding: "0 12px", borderRadius: 10,
              border: "none", background: "none", color: "#9C9382", cursor: "pointer",
            }}>收起</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>周次名称</label>
          <input style={inputStyle} value={label} onChange={(ev) => setLabel(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>汉字（用空格分开）</label>
          <input style={inputStyle} value={charsStr} onChange={(ev) => setCharsStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>拼音（顺序对应汉字）</label>
          <input style={inputStyle} value={pinyinStr} onChange={(ev) => setPinyinStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>词汇</label>
          <input style={inputStyle} value={vocabStr} onChange={(ev) => setVocabStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>练习句子</label>
          <input style={inputStyle} value={sentence} onChange={(ev) => setSentence(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>字→表情（例如 山→⛰️，用空格分开）</label>
          <input style={inputStyle} value={emojiStr} onChange={(ev) => setEmojiStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>干扰字（找一找用）</label>
          <input style={inputStyle} value={distractorStr} onChange={(ev) => setDistractorStr(ev.target.value)} />
        </div>

        <div>
          <label style={labelStyle}>家长邀请码</label>
          <input style={inputStyle} value={inviteCode} onChange={(ev) => setInviteCode(ev.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          <BigButton color={C.bamboo} onClick={save}>保存内容 💾</BigButton>
          <BigButton color={C.gold} onClick={onStartNewWeek}>🗓️ 开始新的一周</BigButton>
        </div>
      </div>
    </Card>
  );
}

/* ===================================================================
   Student Manager (教务老师) — add / delete / move students across classes
   =================================================================== */
function StudentManager({ activeClassId, onSaveClasses, pushToast }) {
  const [list, setList] = useState(null); // [{id,name,invite_code,students:[]}]
  const [newName, setNewName] = useState("");
  const [addTo, setAddTo] = useState(activeClassId || "");

  useEffect(() => {
    let alive = true;
    getClasses().then((cs) => {
      if (!alive) return;
      const norm = cs.map((c) => ({ ...c, students: Array.isArray(c.students) ? c.students : [] }));
      setList(norm);
      if (!addTo && norm[0]) setAddTo(norm[0].id);
    }).catch(() => pushToast("读取班级失败 ⚠️"));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (nlist) => {
    setList(nlist);
    onSaveClasses(nlist);
  };

  const addStudent = () => {
    const nm = newName.trim();
    if (!nm || !addTo) return;
    const target = list.find((c) => c.id === addTo);
    if (target && target.students.includes(nm)) { pushToast("这个名字已在该班"); return; }
    commit(list.map((c) => (c.id === addTo ? { ...c, students: [...c.students, nm] } : c)));
    setNewName("");
  };
  const removeStudent = (clsId, nm) => {
    commit(list.map((c) => (c.id === clsId ? { ...c, students: c.students.filter((x) => x !== nm) } : c)));
  };
  const moveStudent = (fromId, nm, toId) => {
    if (!toId || toId === fromId) return;
    commit(list.map((c) => {
      if (c.id === fromId) return { ...c, students: c.students.filter((x) => x !== nm) };
      if (c.id === toId) return { ...c, students: c.students.includes(nm) ? c.students : [...c.students, nm] };
      return c;
    }));
  };

  const inputStyle = {
    minHeight: 52, padding: "10px 14px", borderRadius: 12, fontSize: 16,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };

  if (!list) return <Card><p style={{ color: "#9C9382" }}>正在加载班级…</p></Card>;

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>👧 学生管理</h3>
      <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>教务老师可新增 / 删除学生，并把孩子分配到不同班级。名单为空的班级，任何名字都能登录。</p>

      {/* add */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input style={{ ...inputStyle, flex: "1 1 140px" }} value={newName} placeholder="学生名字"
          onChange={(ev) => setNewName(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && addStudent()} />
        <select style={{ ...inputStyle }} value={addTo} onChange={(ev) => setAddTo(ev.target.value)}>
          {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={addStudent} style={{
          minHeight: 52, padding: "0 18px", borderRadius: 12, border: "none", background: C.bamboo,
          color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
        }}>＋ 添加</button>
      </div>

      {/* per-class rosters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.map((c) => (
          <div key={c.id} style={{ border: `2px solid ${c.id === activeClassId ? C.bamboo : C.border}`, borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              {c.name} <span style={{ fontSize: 12, color: "#9C9382", fontWeight: 600 }}>邀请码 {c.invite_code} · {c.students.length} 人</span>
            </div>
            {c.students.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>暂无学生</span>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.students.map((nm) => (
                <div key={nm} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, flex: "1 1 80px" }}>{nm}</span>
                  <select defaultValue="" onChange={(ev) => { moveStudent(c.id, nm, ev.target.value); ev.target.value = ""; }}
                    style={{ ...inputStyle, minHeight: 44, padding: "6px 10px", fontSize: 14 }}>
                    <option value="" disabled>移动到…</option>
                    {list.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <button onClick={() => removeStudent(c.id, nm)} style={{
                    minHeight: 44, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.border}`,
                    background: "#fff", color: C.red, fontWeight: 700, cursor: "pointer",
                  }}>删除</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ===================================================================
   Teacher / Admin area
   =================================================================== */
function TeacherArea({ role, className, roster, meta, students, getStudent, onSave, onSaveAudio, onStartNewWeek, onOpenArchive, onLogout, onSaveClasses, activeClassId, pushToast }) {
  const [view, setView] = useState("dashboard");
  const isAdmin = role === "admin";
  const tabs = [{ k: "dashboard", t: "📊 进度" }, { k: "content", t: "✏️ 内容" }];
  if (isAdmin) tabs.push({ k: "students", t: "👧 学生" });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          🏫 {className || "班级"}
          <span style={{ fontSize: 13, color: "#8A8276", marginLeft: 8, fontWeight: 600 }}>
            {isAdmin ? "教务老师" : "授课老师"} · {meta.label} · {meta.chars.join("")}
          </span>
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onOpenArchive} style={ghostBtn}>📚 历史</button>
          <button onClick={onLogout} style={ghostBtn}>退出</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "14px 0", background: "#F1E9DC", padding: 6, borderRadius: 14 }}>
        {tabs.map((tb) => (
          <button key={tb.k} onClick={() => setView(tb.k)} style={{
            flex: 1, minHeight: 48, borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700,
            background: view === tb.k ? "#fff" : "transparent", color: view === tb.k ? C.ink : "#8A8276",
          }}>{tb.t}</button>
        ))}
      </div>

      {view === "dashboard" && <Dashboard roster={roster} students={students} getStudent={getStudent} />}
      {view === "content" && (
        <ContentSettings meta={meta} isAdmin={isAdmin} onSave={onSave} onSaveAudio={onSaveAudio} onStartNewWeek={onStartNewWeek} pushToast={pushToast} />
      )}
      {view === "students" && isAdmin && (
        <StudentManager activeClassId={activeClassId} onSaveClasses={onSaveClasses} pushToast={pushToast} />
      )}
    </div>
  );
}
const ghostBtn = {
  minHeight: 44, padding: "8px 14px", borderRadius: 12, border: `2px solid ${C.border}`,
  background: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

/* ===================================================================
   MAIN APP
   =================================================================== */
export default function PandaHanziApp() {
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const pushToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  // ---- store (mirrored in React state, persisted to localStorage) ----
  const [index, setIndex] = useState([]);
  const [currentId, setCurrentId] = useState("");
  const [metas, setMetas] = useState({}); // id -> meta
  const [progresses, setProgresses] = useState({}); // id -> progress
  const [students, setStudents] = useState({}); // name -> record
  const [loaded, setLoaded] = useState(false); // active class data loaded
  const [activeClass, setActiveClass] = useState(null); // {id,name,invite_code}

  const blankProgress = () => ({ 0: false, 1: false, 2: false, 3: false, 4: false, completedAt: null });

  const persistMeta = useCallback((id, meta) => {
    if (!activeClass) return;
    kvSet(activeClass.id, `week:${id}:meta`, meta).catch(() => pushToast("保存失败，请检查网络 ⚠️"));
  }, [pushToast, activeClass]);
  const persistProgress = useCallback((id, pr) => {
    if (!activeClass) return;
    kvSet(activeClass.id, `week:${id}:progress`, pr).catch(() => pushToast("进度保存失败，请稍后再试 ⚠️"));
  }, [pushToast, activeClass]);
  const persistStudent = useCallback((rec) => {
    if (!activeClass) return;
    kvSet(activeClass.id, `student:${rec.name}`, rec).catch(() => pushToast("学生记录保存失败 ⚠️"));
  }, [pushToast, activeClass]);
  const persistIndex = useCallback((arr, cur) => {
    if (!activeClass) return;
    kvSetMany(activeClass.id, [["weeks:index", arr], ["weeks:current", cur]]).catch(() => pushToast("保存失败 ⚠️"));
  }, [pushToast, activeClass]);

  // rebuild React state from a full KV snapshot
  const applySnapshot = useCallback((kv) => {
    const idx = Array.isArray(kv["weeks:index"]) ? kv["weeks:index"] : [];
    const cur = kv["weeks:current"] || idx[idx.length - 1] || "";
    const ms = {}; const ps = {}; const stu = {};
    idx.forEach((wid) => {
      if (kv[`week:${wid}:meta`]) ms[wid] = kv[`week:${wid}:meta`];
      ps[wid] = kv[`week:${wid}:progress`] || blankProgress();
    });
    Object.keys(kv).forEach((k) => {
      if (k.indexOf("student:") === 0) { const r = kv[k]; if (r && r.name) stu[r.name] = r; }
    });
    setIndex(idx); setCurrentId(cur); setMetas(ms); setProgresses(ps); setStudents(stu);
  }, []);

  // ---- load the active class from Supabase (+ bootstrap its first week) ----
  useEffect(() => {
    if (!activeClass) return undefined;
    let alive = true;
    (async () => {
      try {
        const kv = await kvFetchAll(activeClass.id);
        if (!alive) return;
        const idx = kv["weeks:index"];
        if (!Array.isArray(idx) || idx.length === 0) {
          const id = "week_001";
          const meta = {
            id, label: "第一周", createdAt: new Date().toISOString(),
            chars: DEFAULTS.chars, pinyins: DEFAULTS.pinyins, vocab: DEFAULTS.vocab,
            sentence: DEFAULTS.sentence, emojiMap: DEFAULTS.emojiMap,
            inviteCode: activeClass.invite_code || DEFAULTS.inviteCode,
            students: DEFAULTS.students, distractors: DEFAULTS.distractors, audioMap: {},
          };
          const pr = blankProgress();
          await kvSetMany(activeClass.id, [
            [`week:${id}:meta`, meta],
            [`week:${id}:progress`, pr],
            ["weeks:index", [id]],
            ["weeks:current", id],
          ]);
          if (!alive) return;
          setIndex([id]); setCurrentId(id);
          setMetas({ [id]: meta }); setProgresses({ [id]: pr }); setStudents({});
          setLoaded(true);
          return;
        }
        applySnapshot(kv);
        setLoaded(true);
      } catch (err) {
        if (!alive) return;
        pushToast("连接数据库失败，请检查 Supabase 配置或网络 ⚠️");
        const id = "week_001";
        const meta = {
          id, label: "第一周", createdAt: new Date().toISOString(),
          chars: DEFAULTS.chars, pinyins: DEFAULTS.pinyins, vocab: DEFAULTS.vocab,
          sentence: DEFAULTS.sentence, emojiMap: DEFAULTS.emojiMap,
          inviteCode: (activeClass && activeClass.invite_code) || DEFAULTS.inviteCode,
          students: DEFAULTS.students, distractors: DEFAULTS.distractors, audioMap: {},
        };
        setIndex([id]); setCurrentId(id); setMetas({ [id]: meta }); setProgresses({ [id]: blankProgress() });
        setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [activeClass, pushToast, applySnapshot]);

  // ---- realtime: sync this class when anyone (e.g. the teacher) saves ----
  useEffect(() => {
    if (!activeClass) return undefined;
    let alive = true;
    let timer = null;
    const refetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        kvFetchAll(activeClass.id).then((kv) => { if (alive) applySnapshot(kv); }).catch(() => {});
      }, 250);
    };
    const channel = supabase
      .channel("kv-sync-" + activeClass.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "kv", filter: `class_id=eq.${activeClass.id}` }, refetch)
      .subscribe();
    return () => { alive = false; if (timer) clearTimeout(timer); supabase.removeChannel(channel); };
  }, [activeClass, applySnapshot]);

  // ---- session ----
  const [session, setSession] = useState(null); // {role:'parent'|'teacher'|'admin', name?}
  const [screen, setScreen] = useState("home"); // 'home' | activity index handled separately
  const [activeActivity, setActiveActivity] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reviewId, setReviewId] = useState(null); // weekId being reviewed (read-only)

  const currentMeta = metas[currentId];
  const reviewing = reviewId != null;
  const viewMeta = reviewing ? metas[reviewId] : currentMeta;
  const viewProgress = reviewing ? blankProgress() : (progresses[currentId] || blankProgress());

  const getProgressFor = useCallback((wid) => progresses[wid] || blankProgress(), [progresses]);
  const getStudent = useCallback((nm) => students[nm], [students]);

  // ---- save content (teacher/admin) ----
  const saveContent = useCallback((nextMeta) => {
    setMetas((prev) => ({ ...prev, [nextMeta.id]: nextMeta }));
    persistMeta(nextMeta.id, nextMeta);
    // keep the class invite code (used by parents to join) in sync with the registry
    if (activeClass && nextMeta.inviteCode && nextMeta.inviteCode !== activeClass.invite_code) {
      const code = nextMeta.inviteCode;
      getClasses().then((list) => {
        const nlist = list.map((c) => (c.id === activeClass.id ? { ...c, invite_code: code } : c));
        return saveClasses(nlist);
      }).then(() => setActiveClass((a) => (a ? { ...a, invite_code: code } : a))).catch(() => {});
    }
    pushToast("已保存 ✅");
  }, [persistMeta, pushToast, activeClass]);

  // ---- save a single character's teacher recording (or clear it) ----
  const saveAudio = useCallback((char, dataUrl) => {
    setMetas((prev) => {
      const m = prev[currentId];
      if (!m) return prev;
      const am = { ...(m.audioMap || {}) };
      if (dataUrl) am[char] = dataUrl; else delete am[char];
      const nm = { ...m, audioMap: am };
      persistMeta(currentId, nm);
      return { ...prev, [currentId]: nm };
    });
  }, [currentId, persistMeta]);

  // ---- start new week (admin) ----
  const doStartNewWeek = useCallback(() => {
    const num = index.length + 1;
    const newId = "week_" + String(num).padStart(3, "0");
    const newMeta = {
      id: newId, label: "第" + cnNumber(num) + "周", createdAt: new Date().toISOString(),
      chars: [], pinyins: [], vocab: [], sentence: "", emojiMap: {}, audioMap: {},
      inviteCode: currentMeta ? currentMeta.inviteCode : DEFAULTS.inviteCode,
      students: currentMeta ? currentMeta.students : [], distractors: DEFAULTS.distractors,
    };
    const newIdx = [...index, newId];
    const newPr = blankProgress();
    setIndex(newIdx);
    setCurrentId(newId);
    setMetas((prev) => ({ ...prev, [newId]: newMeta }));
    setProgresses((prev) => ({ ...prev, [newId]: newPr }));
    // reset students' completed for the new week
    setStudents((prev) => {
      const ns = {};
      Object.keys(prev).forEach((nm) => {
        const rec = { ...prev[nm], completed: [] };
        ns[nm] = rec;
        persistStudent(rec);
      });
      return ns;
    });
    persistMeta(newId, newMeta);
    persistProgress(newId, newPr);
    persistIndex(newIdx, newId);
    pushToast("新的一周开始啦！🗓️");
  }, [index, currentMeta, persistMeta, persistProgress, persistIndex, persistStudent, pushToast]);

  const [confirmNewWeek, setConfirmNewWeek] = useState(false);
  const handleStartNewWeek = useCallback(() => {
    const pr = progresses[currentId] || blankProgress();
    const complete = ACTIVITIES.every((_, i) => pr[i]);
    if (!complete) { setConfirmNewWeek(true); return; }
    doStartNewWeek();
  }, [progresses, currentId, doStartNewWeek]);

  // ---- mark activity complete (student) ----
  const markComplete = useCallback((activityIndex) => {
    if (reviewing) return;
    // week progress
    setProgresses((prev) => {
      const cur = prev[currentId] || blankProgress();
      const np = { ...cur, [activityIndex]: true };
      const allDone = ACTIVITIES.every((_, i) => np[i]);
      np.completedAt = allDone ? new Date().toISOString() : cur.completedAt;
      persistProgress(currentId, np);
      return { ...prev, [currentId]: np };
    });
    // student record
    if (session && session.role === "parent" && session.name) {
      setStudents((prev) => {
        const rec = prev[session.name] || { name: session.name, completed: [] };
        const comp = rec.completed.includes(activityIndex) ? rec.completed : [...rec.completed, activityIndex];
        const nrec = { ...rec, name: session.name, completed: comp };
        persistStudent(nrec);
        return { ...prev, [session.name]: nrec };
      });
    }
  }, [reviewing, currentId, session, persistProgress, persistStudent]);

  // ---- enter / leave a class ----
  const enterClass = useCallback((cls, sess) => {
    setLoaded(false);
    setIndex([]); setCurrentId(""); setMetas({}); setProgresses({}); setStudents({});
    setActiveClass(cls);
    setSession(sess);
    setScreen("home"); setReviewId(null); setActiveActivity(null); setArchiveOpen(false);
  }, []);

  const logout = useCallback(() => {
    setSession(null); setActiveClass(null); setLoaded(false);
    setScreen("home"); setActiveActivity(null); setReviewId(null); setArchiveOpen(false);
    setIndex([]); setCurrentId(""); setMetas({}); setProgresses({}); setStudents({});
  }, []);

  // admin: save the class registry (rosters etc.) and refresh the active class
  const saveAllClasses = useCallback((nlist) => {
    saveClasses(nlist).catch(() => pushToast("班级保存失败 ⚠️"));
    setActiveClass((a) => {
      if (!a) return a;
      const mine = nlist.find((c) => c.id === a.id);
      return mine ? { ...a, ...mine } : a;
    });
  }, [pushToast]);

  // seed the student record (so the teacher dashboard lists them) after load
  useEffect(() => {
    if (!loaded || !session || session.role !== "parent" || !session.name) return;
    if (students[session.name]) return;
    const rec = { name: session.name, completed: [] };
    setStudents((prev) => ({ ...prev, [session.name]: rec }));
    persistStudent(rec);
  }, [loaded, session, students, persistStudent]);

  // ---- archive / review ----
  const openReview = useCallback((wid) => {
    setReviewId(wid); setArchiveOpen(false); setActiveActivity(null);
  }, []);
  const exitReview = useCallback(() => { setReviewId(null); setActiveActivity(null); }, []);

  const weeksList = useMemo(
    () => index.map((wid) => metas[wid]).filter(Boolean).slice().reverse(),
    [index, metas]
  );

  /* --------------------------- RENDER --------------------------- */
  const styleTag = (
    <style>{`
      @keyframes pa-fall { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(110vh) rotate(540deg);opacity:1} }
      @keyframes pa-jump { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-16px)} }
      @keyframes pa-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
      @keyframes pa-water { from{background-position:0 0} to{background-position:44px 0} }
      @keyframes pa-float { 0%,100%{transform:translate(0,0)} 25%{transform:translate(10px,-14px)} 50%{transform:translate(-8px,8px)} 75%{transform:translate(6px,12px)} }
      @keyframes pa-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
      @keyframes pa-pop { 0%{transform:scale(.4);opacity:0} 50%{transform:scale(1.4);opacity:1} 100%{transform:scale(1);opacity:0} }
      @keyframes pa-slidein { from{transform:translateX(100%)} to{transform:translateX(0)} }
      @keyframes pa-toast { from{opacity:0;transform:translate(-50%,8px)} to{opacity:1;transform:translate(-50%,0)} }
      * { -webkit-tap-highlight-color: transparent; }
      @media (min-width: 640px){ .pa-tile-grid { grid-template-columns: 1fr 1fr !important; } }
      @media (prefers-reduced-motion: reduce){ *{animation-duration:.001ms !important; animation-iteration-count:1 !important;} }
    `}</style>
  );

  // no class chosen yet -> landing (login / pick class)
  if (!activeClass) {
    return (
      <Shell>
        {styleTag}
        <Landing onEnter={enterClass} pushToast={pushToast} />
        <Toast msg={toast} />
      </Shell>
    );
  }

  // class chosen but its data still loading
  if (!loaded) {
    return (
      <Shell>
        {styleTag}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "48px 0" }}>
          <div style={{ animation: "pa-jump 1.2s ease-in-out infinite" }}><Panda sz={110} ex="curious" /></div>
          <p style={{ color: "#8A8276" }}>正在加载…</p>
        </div>
        <Toast msg={toast} />
      </Shell>
    );
  }

  // review banner
  const reviewBanner = reviewing ? (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      background: "#FBEFCB", borderBottom: `2px solid ${C.gold}`, padding: "10px 16px", flexWrap: "wrap",
    }}>
      <span style={{ fontWeight: 800, color: "#8a6d12" }}>🔒 回顾模式 · {viewMeta ? viewMeta.label : ""}</span>
      <button onClick={exitReview} style={ghostBtn}>返回本周 ↩</button>
    </div>
  ) : null;

  // TEACHER / ADMIN
  if (session.role === "teacher" || session.role === "admin") {
    return (
      <Shell banner={reviewBanner}>
        {styleTag}
        {reviewing && viewMeta ? (
          activeActivity == null ? (
            <ReviewHome meta={viewMeta} onOpenActivity={setActiveActivity} onExit={exitReview} />
          ) : (
            <ActivityHost activityIndex={activeActivity} meta={viewMeta} readOnly
              onComplete={() => {}} onBack={() => setActiveActivity(null)} />
          )
        ) : (
          <TeacherArea
            role={session.role} className={activeClass ? activeClass.name : ""} roster={activeClass ? activeClass.students : []} meta={currentMeta} students={students} getStudent={getStudent}
            onSaveClasses={saveAllClasses} activeClassId={activeClass ? activeClass.id : ""}
            onSave={saveContent} onSaveAudio={saveAudio} onStartNewWeek={handleStartNewWeek}
            onOpenArchive={() => setArchiveOpen(true)} onLogout={logout} pushToast={pushToast}
          />
        )}
        {archiveOpen && (
          <ArchivePanel weeks={weeksList} currentId={currentId} getProgress={getProgressFor}
            onClose={() => setArchiveOpen(false)} onReview={openReview} />
        )}
        {confirmNewWeek && (
          <ConfirmDialog
            text="本周还没全部完成，确定要开始新的一周吗？当前这一周会存进历史记录。"
            onCancel={() => setConfirmNewWeek(false)}
            onConfirm={() => { setConfirmNewWeek(false); doStartNewWeek(); }}
          />
        )}
        <Toast msg={toast} />
      </Shell>
    );
  }

  // PARENT / STUDENT
  return (
    <Shell banner={reviewBanner}>
      {styleTag}
      {activeActivity == null ? (
        reviewing && viewMeta ? (
          <ReviewHome meta={viewMeta} onOpenActivity={setActiveActivity} onExit={exitReview} />
        ) : (
          <StudentHome
            studentName={session.name} meta={currentMeta} progress={viewProgress} readOnly={false}
            onOpenActivity={setActiveActivity} onOpenArchive={() => setArchiveOpen(true)} onLogout={logout}
          />
        )
      ) : (
        <ActivityHost
          activityIndex={activeActivity} meta={viewMeta} readOnly={reviewing}
          onComplete={markComplete} onBack={() => setActiveActivity(null)}
        />
      )}
      {archiveOpen && (
        <ArchivePanel weeks={weeksList} currentId={currentId} getProgress={getProgressFor}
          onClose={() => setArchiveOpen(false)} onReview={openReview} />
      )}
      <Toast msg={toast} />
    </Shell>
  );
}

/* ===================================================================
   Review Home (read-only week — shows the 5 activities to replay)
   =================================================================== */
function ReviewHome({ meta, onOpenActivity, onExit }) {
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

/* ===================================================================
   Confirm dialog
   =================================================================== */
function ConfirmDialog({ text, onCancel, onConfirm }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <Panda sz={80} ex="focused" />
        </div>
        <p style={{ fontSize: 17, textAlign: "center", color: C.ink, lineHeight: 1.6 }}>{text}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <BigButton color={C.bamboo} light onClick={onCancel} style={{ flex: 1 }}>再想想</BigButton>
          <BigButton color={C.red} onClick={onConfirm} style={{ flex: 1 }}>确定开始</BigButton>
        </div>
      </div>
    </div>
  );
}
