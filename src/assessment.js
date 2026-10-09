import { shuffled } from "./utils";
import { soundsAlike } from "./polyphones";

/* ============================================================
   测评引擎 —— 出题 + 自适应定级。纯逻辑，不碰界面，方便单独验。

   三个板块各自定级，互不影响：
     recognize 识字量  放字音，四选一（就是「听一听」的形式）
     reading   阅读     句子挖一个字，四选一
     writing   书写     照笔顺写，Hanzi Writer 判笔画对错

   定级用阶梯法（staircase）：某一级答对够多就往上爬，不够就往下退，
   退到能过的那一级为止。不从 L1 一路爬 —— 10 级 × 4 题 = 40 题，
   五六岁的孩子做不完，中途放弃的数据反而没意义。
   ============================================================ */

export const SECTIONS = [
  { key: "recognize", name: "识字量", emoji: "🔊", desc: "听字音，选出是哪个字" },
  { key: "reading",   name: "阅读",   emoji: "📖", desc: "把句子里缺的字填上" },
  { key: "writing",   name: "书写",   emoji: "✏️", desc: "按笔顺把字写出来" },
];

/* 一级考几题、答对几题算过。
   3 题里对 2 题才算掌握。四选一瞎蒙能蒙到 2 题的概率是 16%，
   够低了；再往上加题只是把测评拖长 —— 五六岁的孩子坐不住，
   前面拖太久，后面书写那一项的数据反而不准。
   每板块最多 4 轮 => 最多 12 题（原来是 24 题）。模拟下来：真实水平在
   L0–L1 的孩子 5～7 题就测完，L3 左右的要 12 题，定级误差都在 ±1 级内。 */
export const PER_LEVEL = 3;
export const PASS = 2;
export const MAX_LEVEL = 10;     // 课程库实际只有 L1–L10（1000 字）
export const MAX_ROUNDS = 4;     // 每个板块最多考 4 轮，控制在孩子坐得住的时间内

/* ---------------- 出题 ---------------- */

const charsOfLevel = (curriculum, level) => (curriculum.byLevel && curriculum.byLevel[level]) || [];

const lessonsOfLevel = (curriculum, level) =>
  (curriculum.lessons || []).filter((l) => l.level === level && (l.chars || []).length);

/* 干扰字：同级别里挑，且不能和答案听起来一样 —— 「听一听」那边踩过这个坑，
   它/他 都念 tā，放一起这题就无解。 */
function pickDistractors(curriculum, level, answer, answerPinyin, n = 3) {
  const pool = charsOfLevel(curriculum, level).filter(
    (c) => c.hanzi !== answer && !soundsAlike(answer, answerPinyin, c.hanzi, c.pinyin)
  );
  return shuffled(pool).slice(0, n).map((c) => c.hanzi);
}

/* 识字量：放这个字的音，从四个字里选 */
export function makeRecognizeItems(curriculum, level, count = PER_LEVEL) {
  const pool = shuffled(charsOfLevel(curriculum, level));
  return pool.slice(0, count).map((c) => {
    const distractors = pickDistractors(curriculum, level, c.hanzi, c.pinyin);
    return {
      kind: "recognize",
      level,
      answer: c.hanzi,
      pinyin: c.pinyin,
      options: shuffled([c.hanzi, ...distractors]),
    };
  });
}

/* 阅读：句子挖掉一个字，从四个字里选回来。
   挖的字必须是这一级的字 —— 挖到更高级的字，考的就不是这一级了。

   一个句子只出一道题。一句话里往往有好几个本级字，全都收进来的话，
   抽出来的几道题会是同一个句子挖不同的空 —— 孩子看着像在做重复的题，
   而且第二次已经读过这句了，考的就不是阅读了。 */
export function makeReadingItems(curriculum, level, count = PER_LEVEL) {
  const levelChars = new Set(charsOfLevel(curriculum, level).map((c) => c.hanzi));
  const byHanzi = new Map((curriculum.characters || []).map((c) => [c.hanzi, c]));
  const cand = [];

  shuffled(lessonsOfLevel(curriculum, level)).forEach((l) => {
    const s = (l.sentence || "").trim();
    if (s.length < 3) return;
    const spots = [];
    s.split("").forEach((ch, i) => {
      if (levelChars.has(ch)) spots.push({ sentence: s, blank: i, answer: ch });
    });
    if (spots.length) cand.push(shuffled(spots)[0]);   // 每句只留一个空
  });

  return shuffled(cand).slice(0, count).map((c) => {
    const src = byHanzi.get(c.answer);
    const distractors = pickDistractors(curriculum, level, c.answer, src && src.pinyin);
    return {
      kind: "reading",
      level,
      sentence: c.sentence,
      blank: c.blank,
      answer: c.answer,
      options: shuffled([c.answer, ...distractors]),
    };
  });
}

/* 书写：写这一级的字，对错由 Hanzi Writer 的笔画判定给 */
export function makeWritingItems(curriculum, level, count = PER_LEVEL) {
  return shuffled(charsOfLevel(curriculum, level)).slice(0, count).map((c) => ({
    kind: "writing",
    level,
    answer: c.hanzi,
    pinyin: c.pinyin,
  }));
}

export function makeItems(sectionKey, curriculum, level, count = PER_LEVEL) {
  if (sectionKey === "recognize") return makeRecognizeItems(curriculum, level, count);
  if (sectionKey === "reading") return makeReadingItems(curriculum, level, count);
  if (sectionKey === "writing") return makeWritingItems(curriculum, level, count);
  return [];
}

/* ---------------- 自适应定级 ----------------

   一轮 = 一个级别的 PER_LEVEL 道题。每轮结束调 nextStep 决定下一步。

   state: { level, passed, rounds, tried }
     level  当前在考第几级
     passed 已经通过的最高级别（0 = 还没通过任何一级）
     tried  已经考过的级别，避免上下横跳考重复 */
export function initState(startLevel) {
  const level = Math.min(MAX_LEVEL, Math.max(1, startLevel || 1));
  return { level, passed: 0, rounds: 0, tried: [] };
}

export function nextStep(state, correctCount) {
  const passedRound = correctCount >= PASS;
  const next = {
    ...state,
    rounds: state.rounds + 1,
    tried: [...state.tried, state.level],
    passed: passedRound ? Math.max(state.passed, state.level) : state.passed,
  };

  /* 轮数用完了。如果最后一轮还是过的，说明是被上限截断、不是真到顶了 ——
     这时报「= L5」是低估，必须标成「≥ L5」。 */
  if (next.rounds >= MAX_ROUNDS) {
    return { ...next, done: true, capped: passedRound && state.level < MAX_LEVEL };
  }

  if (passedRound) {
    /* 过了就往上爬。已经是顶了、或者上一级考过了，就到此为止。 */
    const up = state.level + 1;
    if (up > MAX_LEVEL || next.tried.includes(up)) return { ...next, done: true };
    return { ...next, level: up, done: false };
  }

  /* 没过：如果下面已经有通过的级别，说明水平就在那儿，收工。 */
  if (next.passed > 0) return { ...next, done: true };

  /* 还没通过任何一级，往下退着找。退到 L1 还没过就是 0。 */
  const down = state.level - 1;
  if (down < 1 || next.tried.includes(down)) return { ...next, done: true };
  return { ...next, level: down, done: false };
}

/* 定级结果 -> 给家长看的说法。
   capped = 题目做完了但最后一轮还是全过，只能说「至少这么高」。 */
export function describeLevel(passed, capped) {
  if (!passed) return { label: "还没到 L1", hint: "L1 的字还要再练一练" };
  if (capped) return { label: `L${passed} 以上`, hint: `至少掌握 ${passed * 100} 字，还没测到上限` };
  return { label: `L${passed}`, hint: `大约掌握 ${passed * 100} 字` };
}

/* 从孩子正在上的课推一个起考级别：退一级开考。
   直接从 L1 一路爬上去，题量会翻倍还未必爬得到位（模拟里真实 L8
   从 L1 起考命中率是 0）。 */
export function startLevelFor(currentLevel) {
  return Math.min(MAX_LEVEL, Math.max(1, (currentLevel || 1) - 1));
}
