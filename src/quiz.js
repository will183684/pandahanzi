import { shuffled } from "./utils";
import { soundsAlike } from "./polyphones";
import { passageQuestionsFor } from "./quizPassages";

/* ============================================================
   单元小测 —— 每五课一张卷子，15 道题，做完指出哪一课要回去巩固。

   和「测一测」（assessment.js）不是一回事：那个是给新生定级的，
   从哪儿开始考都不知道，所以要自适应爬梯子。小测是给在读的孩子
   做的阶段检查，范围就是刚学完的那五课，不用猜难度。

   每课固定 3 道题，刚好 15 道 —— 这样每一课的对错都有同样的分母，
   报告里「第几课要巩固」才站得住。只出 10 道题分给 5 课，
   一课 2 道，错 1 道就掉到 50%，噪声太大。

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

function recognizeItem(lesson, pool) {
  const c = shuffled(lesson.chars || [])[0];
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
function clozeItem(lesson, pool, extra) {
  const all = [lesson.sentence, ...(extra || [])]
    .map((x) => String(x || "").trim())
    .filter((x) => x.length >= 3);
  const s = shuffled(all)[0] || "";
  if (!s) return null;
  const own = new Set((lesson.chars || []).map((c) => c.hanzi));
  const spots = [];
  s.split("").forEach((ch, i) => { if (own.has(ch)) spots.push({ i, ch }); });
  const spot = shuffled(spots)[0];
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
function wordClozeItem(lesson, blockLessons) {
  const s = (lesson.sentence || "").trim();
  const words = (lesson.vocab || []).filter((w) => w && w.length >= 2 && s.includes(w));
  const word = shuffled(words)[0];
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
export function makeQuiz(curriculum, block, bank) {
  if (!curriculum) return [];
  const lessons = lessonsOfBlock(curriculum, block);
  if (!lessons.length) return [];
  const pool = taughtChars(curriculum, blockRange(block).to);
  const bankOf = (no) => (bank && bank[no]) || {};

  const recog = [], cloze = [], read = [];
  const usedPassages = new Set();
  lessons.forEach((l) => {
    const mine = bankOf(l.lesson_no);
    const a = recognizeItem(l, pool);
    if (a) recog.push(a);
    const b = clozeItem(l, pool, mine.sentences) || recognizeItem(l, pool);
    if (b) cloze.push(b);
    const c = passageItem(block, l, usedPassages, mine.passages)
      || wordClozeItem(l, lessons)
      || clozeItem(l, pool, mine.sentences);
    if (c) read.push(c);
  });

  return [...shuffled(recog), ...shuffled(cloze), ...shuffled(read)];
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
  items.forEach((it, i) => {
    const e = per.get(it.lessonNo) || { lessonNo: it.lessonNo, correct: 0, total: 0 };
    e.total += 1;
    if (answers[i] === it.answer) e.correct += 1;
    per.set(it.lessonNo, e);
  });
  const perLesson = Array.from(per.values()).sort((a, b) => a.lessonNo - b.lessonNo);
  perLesson.forEach((l) => { l.verdict = verdictFor(l.correct, l.total).key; });
  return {
    total: items.length,
    correct: perLesson.reduce((a, b) => a + b.correct, 0),
    perLesson,
    weak: perLesson.filter((l) => l.verdict === "weak").map((l) => l.lessonNo),
  };
}
