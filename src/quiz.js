import { shuffled } from "./utils";
import { soundsAlike } from "./polyphones";
import { PASSAGES, passageQuestionsFor } from "./quizPassages";

/* ============================================================
   单元小测 —— 每五课一张卷子，15 道题，做完指出哪一课要回去巩固。

   和「测一测」（assessment.js）不是一回事：那个是给新生定级的，
   从哪儿开始考都不知道，所以要自适应爬梯子。小测是给在读的孩子
   做的阶段检查，范围就是刚学完的那五课，不用猜难度。

   每课固定 3 道题，刚好 15 道 —— 这样每一课的对错都有同样的分母，
   报告里「第几课要巩固」才站得住。只出 10 道题分给 5 课，
   一课 2 道，错 1 道就掉到 50%，噪声太大。

   出题跟着孩子走：上回认错的字，这回出现的机会大；连着认对的就少考
   （见下面的 weightOf 和记分表 focus）。所以重做一遍不是换一套随机题，
   而是把记不住的那几个字和词再端上来。

   三种题型，从「认字」一路推到「读懂」：
     recognize  听字音选字      这个字还认不认得
     cloze      句子挖一个字    放在句子里还认不认得
     passage    小短文 + 问题   读懂了没有（手写题库，见 quizPassages.js）
                 没有手写题的单元退回 wordCloze：句子里挖掉整个词
   ============================================================ */

export const BLOCK_SIZE = 5;          // 几课一个小测
export const PER_LESSON = 3;          // 每课几题
export const QUIZ_SIZE = BLOCK_SIZE * PER_LESSON;

export function blockRange(block) {
  const to = block * BLOCK_SIZE;
  return { from: to - BLOCK_SIZE + 1, to };
}

export function blockLabel(block) {
  const { from, to } = blockRange(block);
  return `第${from}–${to}课`;
}

/* 已经学完第 maxLessonNo 课时，可以做哪几张卷子。
   整五课才解锁 —— 第 8 课的时候 6–10 还没学完，考了也没意义。 */
export function unlockedBlocks(maxLessonNo) {
  const n = Math.floor((maxLessonNo || 0) / BLOCK_SIZE);
  const out = [];
  for (let i = 1; i <= n; i++) out.push(i);
  return out;
}

/* ============================================================
   记分表 focus：{ "字或词": { r: 对过几次, w: 错过几次 } }
   存在孩子自己的小测成绩里（kv 的 quiz:{名字} → __focus__）。
   ============================================================ */

const FRESH = 1;          // 还没考过的字，基准权重
const WRONG_UP = 2.5;     // 错一次，机会涨这么多
const RIGHT_DOWN = 0.7;   // 对一次，机会降这么多
const FLOOR = 0.15;       // 但永远不为 0 —— 会了的字也要偶尔回头看一眼
const MASTERED_AT = 3;    // 没错过又连对这么多次，就从表里划掉（回到基准）
const FOCUS_CAP = 600;    // 记分表别无限长

/* 错一次 → 3.5 倍机会；对一次 → 0.3 倍。
   错过又对回来（w1 r1）是 2.8，还是偏高 —— 刚想起来的字最该再问一遍。 */
function weightOf(stats, key) {
  const s = stats && stats[key];
  if (!s) return FRESH;
  return Math.max(FLOOR, FRESH + WRONG_UP * (s.w || 0) - RIGHT_DOWN * (s.r || 0));
}

/* 按权重抽一个（不是直接挑最重的那个 —— 那样每次卷子都一样，
   孩子背的就是题目顺序了）。 */
function pickWeighted(arr, weight) {
  if (!arr || !arr.length) return null;
  const ws = arr.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return shuffled(arr)[0];
  let x = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    x -= ws[i];
    if (x <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

/* 这道题考的是哪个字／词。短文题考的是读懂，不挂在某个字上。 */
export function focusKeyOf(item) {
  if (!item) return null;
  if (item.kind === "recognize" || item.kind === "cloze" || item.kind === "wordCloze") {
    return item.answer;
  }
  return null;
}

/* 把这张卷子的对错并进孩子原来的记分表。 */
export function mergeFocus(prev, delta) {
  const out = {};
  Object.entries(prev || {}).forEach(([k, v]) => {
    out[k] = { r: Number(v && v.r) || 0, w: Number(v && v.w) || 0 };
  });
  Object.entries(delta || {}).forEach(([k, v]) => {
    const e = out[k] || (out[k] = { r: 0, w: 0 });
    e.r += Number(v && v.r) || 0;
    e.w += Number(v && v.w) || 0;
  });
  /* 从来没错、又连对够多次的字划掉：一是记分表不会越滚越大，
     二是这个字回到基准权重，隔一阵还会再考到，不至于再也不出现。 */
  Object.keys(out).forEach((k) => {
    if (out[k].w === 0 && out[k].r >= MASTERED_AT) delete out[k];
  });
  const keys = Object.keys(out);
  if (keys.length > FOCUS_CAP) {
    /* 真超了就先丢权重最低的（那些都是认得的） */
    keys.sort((a, b) => weightOf(out, a) - weightOf(out, b))
      .slice(0, keys.length - FOCUS_CAP)
      .forEach((k) => delete out[k]);
  }
  return out;
}

const lessonsOfBlock = (curriculum, block) => {
  const { from, to } = blockRange(block);
  return (curriculum.lessons || [])
    .filter((l) => l.lesson_no >= from && l.lesson_no <= to)
    .sort((a, b) => a.lesson_no - b.lesson_no);
};

/* 干扰项只从「已经教过的字」里挑。拿后面的字来当干扰项，
   孩子没见过，一眼就能排除，等于白送一道题。 */
function taughtChars(curriculum, upToLessonNo) {
  const out = [];
  (curriculum.lessons || []).forEach((l) => {
    if (l.lesson_no > upToLessonNo) return;
    (l.chars || []).forEach((c) => out.push(c));
  });
  return out;
}

/* 同音字不能当干扰项：它/他 都念 tā，放一起这题就无解
   （「听一听」那边踩过这个坑）。 */
function pickChars(pool, answer, answerPinyin, exclude, n = 3) {
  const no = new Set(exclude || []);
  const cand = pool.filter(
    (c) => c.hanzi !== answer && !no.has(c.hanzi) && !soundsAlike(answer, answerPinyin, c.hanzi, c.pinyin)
  );
  return shuffled(cand).slice(0, n).map((c) => c.hanzi);
}

/* avoid：这一课在这张卷子里已经考过的字，别一张卷子里问同一个字两遍。 */
function recognizeItem(lesson, pool, stats, avoid) {
  const all = lesson.chars || [];
  const left = avoid ? all.filter((x) => !avoid.has(x.hanzi)) : all;
  const c = pickWeighted(left.length ? left : all, (x) => weightOf(stats, x.hanzi));
  if (!c) return null;
  const others = pickChars(pool, c.hanzi, c.pinyin);
  if (others.length < 3) return null;
  return {
    kind: "recognize",
    lessonNo: lesson.lesson_no,
    answer: c.hanzi,
    pinyin: c.pinyin,
    options: shuffled([c.hanzi, ...others]),
  };
}

/* 句子挖一个字。挖的必须是本课的字 —— 挖到别的课的字，
   这道题就不是在考这一课了，报告会指错地方。

   课程库里每课只有一句话，光靠它重做一遍还是那句。老师在「小测题库」
   里多写几句，这里就多几句可抽（extra）。 */
function clozeItem(lesson, pool, extra, stats, avoid) {
  const all = [lesson.sentence, ...(extra || [])]
    .map((x) => String(x || "").trim())
    .filter((x) => x.length >= 3);
  const s = shuffled(all)[0] || "";
  if (!s) return null;
  const own = new Set((lesson.chars || []).map((c) => c.hanzi));
  const spots = [];
  s.split("").forEach((ch, i) => { if (own.has(ch)) spots.push({ i, ch }); });
  const left = avoid ? spots.filter((x) => !avoid.has(x.ch)) : spots;
  const spot = pickWeighted(left.length ? left : spots, (x) => weightOf(stats, x.ch));
  if (!spot) return null;
  const src = (lesson.chars || []).find((c) => c.hanzi === spot.ch);
  /* 句子里已经出现的字不当干扰项：孩子会以为那个字"在句子里见过所以对" */
  const others = pickChars(pool, spot.ch, src && src.pinyin, s.split(""));
  if (others.length < 3) return null;
  return {
    kind: "cloze",
    lessonNo: lesson.lesson_no,
    sentence: s,
    blank: spot.i,
    answer: spot.ch,
    options: shuffled([spot.ch, ...others]),
  };
}

/* 短文理解：手写题库里抽一道。
   尽量换着短文抽（used 记住这张卷子已经用过哪几篇）—— 同一篇短文连出三题，
   孩子第二眼就不用读了，考的就不是阅读是记性。实在没得换才重复用。 */
function passageItem(block, lesson, used, extraPassages) {
  const cand = passageQuestionsFor(block, lesson.lesson_no);
  /* 老师自己写的短文挂在课号下面，和内置那份一起抽 */
  (extraPassages || []).forEach((p) => {
    (p.questions || []).forEach((q) => {
      if (q && q.q && q.a && (q.opts || []).includes(q.a)) cand.push({ passage: p, question: q });
    });
  });
  if (!cand.length) return null;
  const fresh = cand.filter((c) => !used.has(c.passage));
  const pick = shuffled(fresh.length ? fresh : cand)[0];
  used.add(pick.passage);
  return {
    kind: "passage",
    lessonNo: lesson.lesson_no,
    passage: pick.passage.text,
    question: pick.question.q,
    answer: pick.question.a,
    options: shuffled(pick.question.opts),
  };
}

/* 没有手写短文时的替补：句子里挖掉整个词，从四个词里选。
   比挖一个字难一点，也还是在读句子。 */
function wordClozeItem(lesson, blockLessons, stats) {
  const s = (lesson.sentence || "").trim();
  const words = (lesson.vocab || []).filter((w) => w && w.length >= 2 && s.includes(w));
  const word = pickWeighted(words, (w) => weightOf(stats, w));
  if (!word) return null;
  const pool = [];
  blockLessons.forEach((l) => (l.vocab || []).forEach((w) => {
    if (w && w !== word && w.length === word.length && !s.includes(w)) pool.push(w);
  }));
  const others = shuffled(Array.from(new Set(pool))).slice(0, 3);
  if (others.length < 3) return null;
  return {
    kind: "wordCloze",
    lessonNo: lesson.lesson_no,
    sentence: s,
    blank: s.indexOf(word),
    blankLen: word.length,
    answer: word,
    options: shuffled([word, ...others]),
  };
}

/* 出一整张卷子。三种题型各自成段：孩子一段里做的是同一件事，
   不用每道题都重新适应玩法，最后一段才是最费劲的短文。 */
export function makeQuiz(curriculum, block, bank, stats) {
  if (!curriculum) return [];
  const lessons = lessonsOfBlock(curriculum, block);
  if (!lessons.length) return [];
  const pool = taughtChars(curriculum, blockRange(block).to);
  const bankOf = (no) => (bank && bank[no]) || {};

  const recog = [], cloze = [], read = [];
  const usedPassages = new Set();
  lessons.forEach((l) => {
    const mine = bankOf(l.lesson_no);
    /* 这一课这张卷子已经考过的字，后面的题换一个。
       先出填空 —— 能挖的字受句子限制（「我画了一个圆」整句只有「圆」
       是本课的字），可选的最少，让它先挑；听字音从本课十个字里随便挑，
       让得起。反过来的话这两题常常考到同一个字。 */
    const used = new Set();
    const c0 = clozeItem(l, pool, mine.sentences, stats, used);
    if (c0) used.add(c0.answer);
    const a = recognizeItem(l, pool, stats, used);
    if (a) { recog.push(a); used.add(a.answer); }
    const b = c0 || recognizeItem(l, pool, stats, used);
    if (b) { cloze.push(b); used.add(b.answer); }
    const c = passageItem(block, l, usedPassages, mine.passages)
      || wordClozeItem(l, lessons, stats)
      || clozeItem(l, pool, mine.sentences, stats, used);
    if (c) read.push(c);
  });

  return [...shuffled(recog), ...shuffled(cloze), ...shuffled(read)];
}

/* ============================================================
   这张卷子里「要念出来的整句整词」—— 老师可以给它们录音。

   单个字不在这张清单里：那些走的是单字录音，老师在「课程编辑」里
   录过就自动生效，小测这边一直在用。这里只列机器音念的那些：
     question  短文的问句（每次出现都会念一遍给孩子听）
     answer    多字的正确答案（答错时念出来）

   还没写手写短文的单元（第31课往后）退回「词语填空」，那几个词也会
   被念到，所以也列进来。
   ============================================================ */
export function spokenTextsOf(curriculum, block, bank) {
  if (!curriculum) return [];
  const out = new Map();
  const add = (text, kind, lessonNo, source) => {
    const t = String(text || "").trim();
    if (t.length < 2) return;                       // 单个字不算
    if (!out.has(t)) out.set(t, { text: t, kind, lessonNo, source });
  };

  const lessons = lessonsOfBlock(curriculum, block);
  const builtIn = PASSAGES[block] || [];
  lessons.forEach((l) => {
    const mine = (bank && bank[l.lesson_no]) || {};
    const qs = [];
    builtIn.forEach((p) => (p.questions || []).forEach((q) => {
      if (q.lesson === l.lesson_no) qs.push({ q, source: "builtin" });
    }));
    (mine.passages || []).forEach((p) => (p.questions || []).forEach((q) => {
      if (q && q.q && q.a) qs.push({ q, source: "teacher" });
    }));
    qs.forEach(({ q, source }) => {
      add(q.q, "question", l.lesson_no, source);
      add(q.a, "answer", l.lesson_no, source);
    });
    /* 这一课没有短文题 → 小测会退回词语填空，那些词也要念 */
    if (!qs.length) (l.vocab || []).forEach((w) => add(w, "answer", l.lesson_no, "builtin"));
  });
  return Array.from(out.values()).sort((a, b) => a.lessonNo - b.lessonNo);
}

/* ---------------- 判分 ---------------- */

/* 一课 3 题：对 0–1 题要回去巩固，对 2 题再练练，全对就是会了。
   四选一瞎蒙 3 题对 2 题的概率是 16%，所以「对 2 题」还不能算稳。 */
export function verdictFor(correct, total) {
  if (!total) return { key: "none", label: "没考到", color: "#9C9382" };
  const rate = correct / total;
  if (rate >= 0.999) return { key: "good", label: "掌握了", color: "#6BAF72" };
  if (rate >= 2 / 3) return { key: "ok", label: "再练一练", color: "#B79A2E" };
  return { key: "weak", label: "要回去巩固", color: "#D96A5B" };
}

export function gradeQuiz(items, answers) {
  const per = new Map();
  const focus = {};     // 这张卷子每个字／词的对错，回头并进孩子的记分表
  items.forEach((it, i) => {
    const e = per.get(it.lessonNo) || { lessonNo: it.lessonNo, correct: 0, total: 0 };
    e.total += 1;
    const right = answers[i] === it.answer;
    if (right) e.correct += 1;
    per.set(it.lessonNo, e);
    const k = focusKeyOf(it);
    if (k) {
      const f = focus[k] || (focus[k] = { r: 0, w: 0 });
      if (right) f.r += 1; else f.w += 1;
    }
  });
  const perLesson = Array.from(per.values()).sort((a, b) => a.lessonNo - b.lessonNo);
  perLesson.forEach((l) => { l.verdict = verdictFor(l.correct, l.total).key; });
  return {
    total: items.length,
    correct: perLesson.reduce((a, b) => a + b.correct, 0),
    perLesson,
    weak: perLesson.filter((l) => l.verdict === "weak").map((l) => l.lessonNo),
    focus,
    /* 这回认错的字和词 —— 报告里列出来，下回它们出现的机会最大 */
    missed: Object.keys(focus).filter((k) => focus[k].w > 0),
  };
}
