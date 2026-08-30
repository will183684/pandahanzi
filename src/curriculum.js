import { DEFAULTS } from "./theme";
import { shuffled } from "./utils";

/* ============================================================
   适配层：把 v2 的「班级课程 + 字表」映射成活动组件吃的老 `meta` 形状。

   9 个活动组件因此一行都不用改 —— 它们只认 meta.chars / meta.pinyins /
   meta.emojiMap / meta.audioMap / meta.vocab / meta.sentence / meta.distractors。
   ============================================================ */

/* 干扰字：从同级别的字里取，难度接近；没有课程库时回退到内置列表。 */
export function buildDistractors(chars, classLesson, curriculum, n = 12) {
  const own = new Set(chars.map((c) => c.hanzi));
  let pool = [];

  if (curriculum) {
    const src = classLesson && classLesson.lesson_id
      ? curriculum.lessonById.get(classLesson.lesson_id)
      : null;
    const list = src ? curriculum.byLevel[src.level] : curriculum.characters;
    pool = (list || []).map((c) => c.hanzi).filter((h) => !own.has(h));
  }

  if (pool.length < n) {
    return DEFAULTS.distractors.filter((h) => !own.has(h));
  }
  return shuffled(pool).slice(0, n);
}

/* 这节课来自课程库的哪一课（老师自建的课返回 null） */
export function sourceLesson(classLesson, curriculum) {
  if (!classLesson || !classLesson.lesson_id || !curriculum) return null;
  return curriculum.lessonById.get(classLesson.lesson_id) || null;
}

/* classLesson + chars  ->  meta

   extraAudio：词语和句子里用到、但不在本课字表里的字的录音（汉字 -> url）。
   没有它的话，「小羊」的「小」不在本课 10 个字里，即使老师录过也取不到，
   孩子听到的是机器音。录音本来就是按字全局共用的，字表内外一视同仁。 */
export function toMeta(classLesson, chars, curriculum, extraAudio, wordAudio) {
  if (!classLesson) return null;
  const list = chars || [];
  const src = sourceLesson(classLesson, curriculum);

  const emojiMap = {};
  const audioMap = { ...(extraAudio || {}) };
  list.forEach((c) => {
    if (c.emoji) emojiMap[c.hanzi] = c.emoji;
    if (c.audio_url) audioMap[c.hanzi] = c.audio_url;
  });

  return {
    id: classLesson.id,
    label: classLesson.title || "本课",
    createdAt: classLesson.started_at,
    chars: list.map((c) => c.hanzi),
    pinyins: list.map((c) => c.pinyin || ""),
    vocab: classLesson.vocab || [],
    sentence: classLesson.sentence || "",
    emojiMap,
    audioMap,
    /* 词 -> 老师念的整词录音。没有的词就退回单字拼接。 */
    wordAudioMap: wordAudio || {},
    distractors: buildDistractors(list, classLesson, curriculum),
    /* 课程库来源：用来显示「L3 启蒙进阶 · 第2课」。老师自建的课为 null。 */
    level: src ? src.level : null,
    levelSeq: src ? src.level_seq : null,
    lessonNo: src ? src.lesson_no : null,
  };
}

/* 把 lesson_progress 的行压成活动组件用的 {0:bool,1:bool,...}
   who = 学生名；传 null 表示「任一学生做过就算」（老师视角）。 */
export function progressMap(rows, classLessonId, activities, who) {
  const out = {};
  activities.forEach((_, i) => { out[i] = false; });
  rows.forEach((r) => {
    if (r.class_lesson_id !== classLessonId) return;
    if (who != null && r.student_name !== who) return;
    const i = activities.findIndex((a) => a.key === r.activity_key);
    if (i >= 0) out[i] = true;
  });
  return out;
}
