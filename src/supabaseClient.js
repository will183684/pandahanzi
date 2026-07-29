import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 未设置");
}

export const supabase = createClient(url || "http://localhost", anonKey || "public-anon-key", {
  realtime: { params: { eventsPerSecond: 5 } },
});

const TABLE = "kv";
const ROOT = "__root__";       // holds the class registry
const LIB = "__library__";     // holds the shared lesson library

/* ---- class-scoped key/value ---- */
export async function kvFetchAll(classId) {
  const { data, error } = await supabase.from(TABLE).select("key,value").eq("class_id", classId);
  if (error) throw error;
  const map = {};
  (data || []).forEach((row) => { map[row.key] = row.value; });
  return map;
}
export async function kvGet(classId, key) {
  const { data, error } = await supabase.from(TABLE).select("value").eq("class_id", classId).eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
export async function kvSet(classId, key, value) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ class_id: classId, key, value, updated_at: new Date().toISOString() }, { onConflict: "class_id,key" });
  if (error) throw error;
}
export async function kvSetMany(classId, rows) {
  const payload = rows.map(([key, value]) => ({ class_id: classId, key, value, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: "class_id,key" });
  if (error) throw error;
}

/* ---- class registry (all classes) ---- */
export async function getClasses() {
  const v = await kvGet(ROOT, "classes");
  return Array.isArray(v) ? v : [];
}
export async function saveClasses(list) {
  await kvSet(ROOT, "classes", list);
}
export async function deleteClassRecords(classId) {
  const { error } = await supabase.from(TABLE).delete().eq("class_id", classId);
  if (error) throw error;
}

/* ---- teacher registry ---- */
export async function getTeachers() {
  const v = await kvGet(ROOT, "teachers");
  return Array.isArray(v) ? v : [];
}
export async function saveTeachers(list) {
  await kvSet(ROOT, "teachers", list);
}

/* ============================================================
   课程库 v2（characters / lessons / lesson_chars）
   全局只读，进程内缓存一次。1200 字约 60KB，一次拉完最省事。
   ============================================================ */

/* PostgREST 单次最多返回 1000 行，字库有 1200 行，必须分页。 */
async function fetchAllRows(table, columns, orderCol) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select(columns).order(orderCol).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

let curriculumCache = null;

export async function getCurriculum() {
  if (curriculumCache) return curriculumCache;
  const [characters, lessonRows, lessonChars] = await Promise.all([
    fetchAllRows("characters", "id,hanzi,level,global_seq,pinyin,emoji", "global_seq"),
    fetchAllRows("lessons", "id,lesson_no,level,level_seq,title,vocab,sentence", "lesson_no"),
    fetchAllRows("lesson_chars", "lesson_id,char_id,pos", "lesson_id"),
  ]);

  const charById = new Map(characters.map((c) => [c.id, c]));
  const charsByLesson = new Map();
  lessonChars
    .slice()
    .sort((a, b) => a.lesson_id - b.lesson_id || a.pos - b.pos)
    .forEach((lc) => {
      const ch = charById.get(lc.char_id);
      if (!ch) return;
      if (!charsByLesson.has(lc.lesson_id)) charsByLesson.set(lc.lesson_id, []);
      charsByLesson.get(lc.lesson_id).push(ch);
    });

  const lessons = lessonRows.map((l) => ({ ...l, chars: charsByLesson.get(l.id) || [] }));
  const byLevel = { 1: [], 2: [], 3: [] };
  characters.forEach((c) => { if (byLevel[c.level]) byLevel[c.level].push(c); });

  curriculumCache = {
    characters,
    lessons,
    byLevel,
    lessonById: new Map(lessons.map((l) => [l.id, l])),
  };
  return curriculumCache;
}

/* ============================================================
   班级排课（class_lessons / class_lesson_chars / lesson_progress）
   ============================================================ */

export async function getClassLessons(classId) {
  const { data, error } = await supabase
    .from("class_lessons").select("*").eq("class_id", classId).order("seq");
  if (error) throw error;
  return data || [];
}

/* 本班所有课的字（不含录音，用于历史列表预览） */
export async function getClassCharsBrief(classLessonIds) {
  if (!classLessonIds.length) return [];
  const { data, error } = await supabase
    .from("class_lesson_chars")
    .select("class_lesson_id,hanzi,pinyin,emoji,pos")
    .in("class_lesson_id", classLessonIds)
    .order("pos");
  if (error) throw error;
  return data || [];
}

/* 单节课的完整字表（含录音） */
export async function getClassLessonChars(classLessonId) {
  const { data, error } = await supabase
    .from("class_lesson_chars").select("*").eq("class_lesson_id", classLessonId).order("pos");
  if (error) throw error;
  return data || [];
}

/* 选用一节标准课 → 拷贝进本班，并把上一节标记为完成
   （class_lessons_one_active 索引保证每班只有一节 active，所以必须先收尾） */
export async function startClassLesson(classId, lesson, existingLessons) {
  const active = existingLessons.find((l) => l.status === "active");
  if (active) await completeClassLesson(active.id);

  const seq = existingLessons.reduce((m, l) => Math.max(m, l.seq), 0) + 1;
  const { data, error } = await supabase.from("class_lessons").insert({
    class_id: classId,
    lesson_id: lesson.id,
    seq,
    title: lesson.title || `第${lesson.lesson_no}课`,
    vocab: lesson.vocab || [],
    sentence: lesson.sentence || "",
    status: "active",
  }).select().single();
  if (error) throw error;

  const rows = (lesson.chars || []).map((c, i) => ({
    class_lesson_id: data.id, hanzi: c.hanzi, pinyin: c.pinyin, emoji: c.emoji, pos: i + 1,
  }));
  if (rows.length) {
    const { error: e2 } = await supabase.from("class_lesson_chars").insert(rows);
    if (e2) throw e2;
  }
  return data;
}

export async function updateClassLesson(id, patch) {
  const { error } = await supabase.from("class_lessons").update(patch).eq("id", id);
  if (error) throw error;
}

export async function completeClassLesson(id) {
  const { error } = await supabase.from("class_lessons")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* 整表替换本课字表：老师增删改后一次性落库 */
export async function saveClassLessonChars(classLessonId, chars) {
  const { error: delErr } = await supabase
    .from("class_lesson_chars").delete().eq("class_lesson_id", classLessonId);
  if (delErr) throw delErr;
  if (!chars.length) return;
  const rows = chars.map((c, i) => ({
    class_lesson_id: classLessonId,
    hanzi: c.hanzi,
    pinyin: c.pinyin || null,
    emoji: c.emoji || null,
    audio_url: c.audio_url || null,
    pos: i + 1,
  }));
  const { error } = await supabase.from("class_lesson_chars").insert(rows);
  if (error) throw error;
}

export async function getClassProgress(classLessonIds) {
  if (!classLessonIds.length) return [];
  const { data, error } = await supabase
    .from("lesson_progress").select("*").in("class_lesson_id", classLessonIds);
  if (error) throw error;
  return data || [];
}

export async function markProgress(classLessonId, studentName, activityKey) {
  const { error } = await supabase.from("lesson_progress").upsert(
    { class_lesson_id: classLessonId, student_name: studentName, activity_key: activityKey },
    { onConflict: "class_lesson_id,student_name,activity_key" }
  );
  if (error) throw error;
}

/* ---- shared lesson library (reusable weekly content) ---- */
export async function getLibraryLessons() {
  const kv = await kvFetchAll(LIB);
  const idx = Array.isArray(kv["index"]) ? kv["index"] : [];
  return idx.map((id) => kv["lesson:" + id]).filter(Boolean);
}
export async function addLibraryLesson(lesson) {
  const kv = await kvFetchAll(LIB);
  const idx = Array.isArray(kv["index"]) ? kv["index"] : [];
  const nidx = idx.includes(lesson.id) ? idx : [...idx, lesson.id];
  await kvSetMany(LIB, [["lesson:" + lesson.id, lesson], ["index", nidx]]);
}
