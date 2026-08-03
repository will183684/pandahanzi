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

/* 小朋友可选的头像。默认熊猫，跟品牌一致。
   只存一个 emoji 字符串，不涉及上传真人照片。 */
export const AVATARS = [
  "🐼", "🐯", "🦁", "🐻", "🐨", "🦊",
  "🐰", "🐱", "🐶", "🐭", "🐹", "🐷",
  "🐮", "🐸", "🐵", "🐔", "🐧", "🦉",
  "🦄", "🐢", "🐙", "🦋", "🐝", "🐬",
];
export const DEFAULT_AVATAR = "🐼";

/* 字库分级：characters.level / lessons.level = 1 | 2 | 3 */
export const LEVELS = [
  { level: 1, name: "初级", sub: "启蒙级", color: "#E8453C" },
  { level: 2, name: "中级", sub: "生活常用", color: "#F5C842" },
  { level: 3, name: "高级", sub: "进阶提升", color: "#6BAF72" },
];
export const LEVEL_NAME = { 1: "初级", 2: "中级", 3: "高级" };

/* 顺序 = 学生首页的顺序，也是建议的练习顺序：
   先认读 → 再听辨 → 再找形 → 再配对 → 写 → 组词 → 造句 → 最后限时复习。
   进度按 key 存（不是下标），所以调整顺序不会影响已有记录。 */
export const ACTIVITIES = [
  { key: "flash",  emoji: "🃏", name: "认一认", desc: "翻卡片，听读音" },
  { key: "listen", emoji: "👂", name: "听一听", desc: "听读音，选汉字" },
  { key: "find",   emoji: "🔍", name: "找一找", desc: "在泡泡里找到汉字" },
  { key: "trace",  emoji: "✏️", name: "描一描", desc: "看笔顺，照着描" },
  { key: "word",   emoji: "🔤", name: "拼词语", desc: "把字拼成词语" },
  { key: "build",  emoji: "🧩", name: "拼句子", desc: "把字拼成一句话" },
  { key: "speed",  emoji: "⚡", name: "抢一抢", desc: "限时抢答，看谁快" },
];
