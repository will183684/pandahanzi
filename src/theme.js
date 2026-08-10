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

/* 字库分级：characters.level / lessons.level = 1..12
   字数 40/50/60/70/80/90/100/110/120/130/150/200 = 1200，每级都是 10 的
   倍数，所以还是 10 字一课，共 120 课。颜色由易到难做渐变。 */
export const LEVELS = [
  { level: 1,  name: "L1",  sub: "启蒙起步", chars: 40,  lessons: 4,  color: "#6BAF72" },
  { level: 2,  name: "L2",  sub: "基础入门", chars: 50,  lessons: 5,  color: "#7CBA64" },
  { level: 3,  name: "L3",  sub: "启蒙进阶", chars: 60,  lessons: 6,  color: "#93C557" },
  { level: 4,  name: "L4",  sub: "生活初阶", chars: 70,  lessons: 7,  color: "#B5CC4A" },
  { level: 5,  name: "L5",  sub: "生活常用", chars: 80,  lessons: 8,  color: "#D8C93F" },
  { level: 6,  name: "L6",  sub: "场景拓展", chars: 90,  lessons: 9,  color: "#F5C842" },
  { level: 7,  name: "L7",  sub: "认知扩容", chars: 100, lessons: 10, color: "#F0AC38" },
  { level: 8,  name: "L8",  sub: "读写基础", chars: 110, lessons: 11, color: "#EB9130" },
  { level: 9,  name: "L9",  sub: "进阶提升", chars: 120, lessons: 12, color: "#E5763B" },
  { level: 10, name: "L10", sub: "读写进阶", chars: 130, lessons: 13, color: "#E05B45" },
  { level: 11, name: "L11", sub: "高阶巩固", chars: 150, lessons: 15, color: "#D9444F" },
  { level: 12, name: "L12", sub: "高阶收官", chars: 200, lessons: 20, color: "#B93A6B" },
];

export const LEVEL_BY_NO = Object.fromEntries(LEVELS.map((l) => [l.level, l]));
export const LEVEL_NAME = Object.fromEntries(LEVELS.map((l) => [l.level, `${l.name} ${l.sub}`]));

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
];
