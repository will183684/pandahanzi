import { C } from "../theme";

/* ============================== Panda ==============================
   The mascot. `ex` selects an expression: neutral | excited | focused |
   curious. `sz` is the rendered pixel size.
   ================================================================== */
export default function Panda({ sz = 120, ex = "neutral" }) {
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
