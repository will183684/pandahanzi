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

export const ADMIN_CODE = "8867";     // 教务老师口令（可改）

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
/* 4 个大类，每类 3 个 L；每个 L 100 字 / 10 课 */
export const LEVEL_GROUPS = [
  { name: "启蒙识字", from: 1,  to: 3,  range: "1-300",    desc: "最高频基础字：数字、身体、家庭、颜色、形状" },
  { name: "基础阅读", from: 4,  to: 6,  range: "301-600",  desc: "校园、天气、食物、动物、家居生活" },
  { name: "进阶阅读", from: 7,  to: 9,  range: "601-900",  desc: "社区、地理方位、情绪、动作、自然现象" },
  { name: "自主精读", from: 10, to: 12, range: "901-1200", desc: "更细的动作/性格/自然词汇，词汇密度更高" },
];

/* 由易到难的渐变，绿 → 黄 → 红 */
const LEVEL_COLORS = [
  "#6BAF72", "#7CBA64", "#93C557", "#B5CC4A", "#D8C93F", "#F5C842",
  "#F0AC38", "#EB9130", "#E5763B", "#E05B45", "#D9444F", "#B93A6B",
];

export const LEVELS = Array.from({ length: 12 }, (_, i) => {
  const level = i + 1;
  const g = LEVEL_GROUPS.find((x) => level >= x.from && level <= x.to);
  return {
    level,
    name: `L${level}`,
    sub: g.name,              // 大类名，显示成「L5 基础阅读」
    groupDesc: g.desc,
    chars: 100,
    lessons: 10,
    color: LEVEL_COLORS[i],
  };
});

export const LEVEL_BY_NO = Object.fromEntries(LEVELS.map((l) => [l.level, l]));
export const LEVEL_NAME = Object.fromEntries(LEVELS.map((l) => [l.level, `${l.name} ${l.sub}`]));

/* 由上面的字数/课数推出每级的区间边界。

   级别是前端按 global_seq / lesson_no 算出来的，不读数据库的 level 列。
   原因：改那一列要 DDL（check 约束卡在 1..3）加上字库的写权限，
   而前端只有 anon key —— 字库故意设成只读，不然谁都能改乱 1200 个字。
   算出来还有个好处：级别定义只存在这一个地方，不会出现代码和库不一致。 */
export const LEVEL_RANGES = (() => {
  let c = 0, l = 0;
  return LEVELS.map((lv) => {
    const r = {
      level: lv.level,
      charFrom: c + 1, charTo: c + lv.chars,
      lessonFrom: l + 1, lessonTo: l + lv.lessons,
    };
    c += lv.chars; l += lv.lessons;
    return r;
  });
})();

const LAST = LEVELS[LEVELS.length - 1].level;

/* 第几个字 -> 属于哪一级 */
export function levelOfCharSeq(seq) {
  const r = LEVEL_RANGES.find((x) => seq >= x.charFrom && seq <= x.charTo);
  return r ? r.level : LAST;
}

/* 第几课 -> {级别, 级内第几课} */
export function levelOfLesson(lessonNo) {
  const r = LEVEL_RANGES.find((x) => lessonNo >= x.lessonFrom && lessonNo <= x.lessonTo);
  return r
    ? { level: r.level, levelSeq: lessonNo - r.lessonFrom + 1 }
    : { level: LAST, levelSeq: lessonNo };
}

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
