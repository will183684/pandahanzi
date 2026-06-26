/* ============================================================
   Design tokens & app-wide constants
   ============================================================ */

export const C = {
  bg: "#FDF6EC",
  ink: "#1A1A1A",
  bamboo: "#6BAF72",
  red: "#E8453C",
  gold: "#F5C842",
  card: "#FFFFFF",
  border: "#E8E0D5",
};

export const DEFAULTS = {
  chars: ["山", "水", "火", "木", "土"],
  pinyins: ["shān", "shuǐ", "huǒ", "mù", "tǔ"],
  vocab: ["山水", "木土", "火山"],
  sentence: "山上有大树",
  emojiMap: { 山: "⛰️", 水: "💧", 火: "🔥", 木: "🌲", 土: "🟫" },
  distractors: ["大", "小", "上", "下", "日", "月", "云", "人", "手", "左", "右", "中"],
  inviteCode: "PANDA2026",
  students: [],
};

export const ADMIN_CODE = "panda@admin";     // 教务老师口令（可改）

export const ACTIVITIES = [
  { key: "flash", emoji: "🃏", name: "认一认", desc: "翻卡片认识汉字" },
  { key: "find", emoji: "🔍", name: "找一找", desc: "在泡泡里找到汉字" },
  { key: "trace", emoji: "✏️", name: "描一描", desc: "看笔顺，照着描" },
  { key: "build", emoji: "🧩", name: "拼句子", desc: "把字拼成一句话" },
];
