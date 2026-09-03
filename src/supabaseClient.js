import { createClient } from "@supabase/supabase-js";
import { levelOfCharSeq, levelOfLesson } from "./theme";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 未设置");
}

export const supabase = createClient(url || "http://localhost", anonKey || "public-anon-key", {
  realtime: { params: { eventsPerSecond: 5 } },
});

/* kv 表现在只剩下名册类数据（班级 / 学生 / 老师），
   课程和进度都已经迁到 characters / lessons / class_* 那几张关系表。 */
const TABLE = "kv";
const ROOT = "__root__";       // holds the class / teacher registries

/* ---- class-scoped key/value ---- */
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

/* ---- class registry (all classes) ---- */
export async function getClasses() {
  const v = await kvGet(ROOT, "classes");
  return Array.isArray(v) ? v : [];
}
export async function saveClasses(list) {
  await kvSet(ROOT, "classes", list);
}
/* 删班：kv 里的名册 + 关系表里的排课都要清掉，否则留下孤儿数据。
   class_lesson_chars / lesson_progress 由外键 on delete cascade 跟着删。 */
export async function deleteClassRecords(classId) {
  const { error } = await supabase.from(TABLE).delete().eq("class_id", classId);
  if (error) throw error;
  const { error: e2 } = await supabase.from("class_lessons").delete().eq("class_id", classId);
  if (e2) throw e2;
}

/* ---- 学生头像 ----
   存在 kv 里（key = "profile:{名字}"），不用另建表。
   value 形如 { avatar: "🐯" }。只是个 emoji，不涉及真人照片。 */
export async function getProfiles(classId) {
  const { data, error } = await supabase
    .from(TABLE).select("key,value").eq("class_id", classId).like("key", "profile:%");
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.key.slice("profile:".length)] = r.value || {}; });
  return map;
}
export async function saveProfile(classId, name, profile) {
  await kvSet(classId, "profile:" + name, profile);
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
  const [charRows, lessonRowsRaw, lessonChars] = await Promise.all([
    fetchAllRows("characters", "id,hanzi,level,global_seq,pinyin,emoji", "global_seq"),
    fetchAllRows("lessons", "id,lesson_no,level,level_seq,title,vocab,sentence", "lesson_no"),
    fetchAllRows("lesson_chars", "lesson_id,char_id,pos", "lesson_id"),
  ]);

  /* 级别在前端按 global_seq / lesson_no 算，盖掉库里的 level 列 —— 那列
     还是旧的 3 级，改它需要 DDL 和字库写权限，anon key 都没有。
     详见 theme.js 里 LEVEL_RANGES 的说明。 */
  const characters = charRows.map((c) => ({ ...c, level: levelOfCharSeq(c.global_seq) }));
  const lessonRows = lessonRowsRaw.map((l) => {
    const { level, levelSeq } = levelOfLesson(l.lesson_no);
    return { ...l, level, level_seq: levelSeq };
  });

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
  /* 按级别分桶。别写死级别数量 —— 分级从 3 级扩到 12 级时这里漏过字。 */
  const byLevel = {};
  characters.forEach((c) => { (byLevel[c.level] = byLevel[c.level] || []).push(c); });

  curriculumCache = {
    characters,
    lessons,
    byLevel,
    lessonById: new Map(lessons.map((l) => [l.id, l])),
    /* 按字查 —— 「听一听」要靠拼音把同音字从选项里剔掉 */
    charByHanzi: new Map(characters.map((c) => [c.hanzi, c])),
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

/* 单节课的完整字表。

   录音一律来自共享库，按「字」取，不再看本班自己那份 audio_url。
   一个字全站只有一段录音，谁最后录的就是谁的 —— 这样同一个字在
   不同班级、不同老师那儿听到的都一样，不会各录各的。
   （class_lesson_chars.audio_url 是旧模型留下的列，现在不读了。） */
export async function getClassLessonChars(classLessonId) {
  const { data, error } = await supabase
    .from("class_lesson_chars").select("*").eq("class_lesson_id", classLessonId).order("pos");
  if (error) throw error;

  const rows = data || [];
  const shared = await getSharedAudioByHanzi(rows.map((r) => r.hanzi));
  return rows.map((r) => {
    const s = shared.get(r.hanzi);
    return {
      ...r,
      audio_url: s ? s.audio_url : null,
      audio_by: s ? s.teacher_name : null,
    };
  });
}

/* 一批汉字 -> 共享录音（每个字一条）。
   共享库还没建表时返回空 Map，调用方照常走「没有录音」。 */
export async function getSharedAudioByHanzi(hanziList) {
  const out = new Map();
  const want = Array.from(new Set((hanziList || []).filter(Boolean)));
  if (!want.length) return out;
  try {
    const { data: chars, error: e1 } = await supabase
      .from("characters").select("id,hanzi").in("hanzi", want);
    if (e1) throw e1;
    if (!chars || !chars.length) return out;

    const hanziById = new Map(chars.map((c) => [c.id, c.hanzi]));
    const { data: audios, error: e2 } = await supabase
      .from("shared_audios")
      .select("char_id,teacher_name,audio_url,created_at")
      .in("char_id", chars.map((c) => c.id))
      .order("created_at", { ascending: false });
    if (e2) throw e2;

    (audios || []).forEach((a) => {
      const h = hanziById.get(a.char_id);
      if (h && !out.has(h)) out.set(h, a);            // 已排好序，第一条就是最新
    });
  } catch (e) {
    return out;
  }
  return out;
}

/* 选用一节标准课 → 拷贝进本班，并把上一节标记为完成
   （class_lessons_one_active 索引保证每班只有一节 active，所以必须先收尾） */
export async function startClassLesson(classId, lesson, existingLessons) {
  const active = existingLessons.find((l) => l.status === "active");
  if (active) await completeClassLesson(active.id);

  /* 这一课本班上过了 —— 直接把那条记录重新设为 active，不再插新的。
     以前每次「再上一次」都插一条新记录，字表是空白副本，老师之前
     录的音、改的拼音全留在旧记录里，看上去就是「录音没了」。 */
  const prev = existingLessons.find((l) => l.lesson_id === lesson.id);
  if (prev) {
    const { data, error } = await supabase.from("class_lessons")
      .update({ status: "active", completed_at: null })
      .eq("id", prev.id)
      .select().single();
    if (error) throw error;
    return data;
  }

  const seq = existingLessons.reduce((m, l) => Math.max(m, l.seq), 0) + 1;
  const { data, error } = await supabase.from("class_lessons").insert({
    class_id: classId,
    lesson_id: lesson.id,
    seq,
    /* 带上级别 —— 选课面板里按级内序号显示（L10 下面就是「第1课」），
       如果这里只存全局课号，历史里会冒出「第91课」，对不上。 */
    title: lesson.title || `L${lesson.level} 第${lesson.level_seq}课`,
    vocab: lesson.vocab || [],
    sentence: lesson.sentence || "",
    status: "active",
  }).select().single();
  if (error) throw error;

  /* 不往本班拷录音 —— 录音按「字」全局共用，读字表时再取。
     拷一份进来的话，别人之后重录了这个字，这个班还留着旧的。 */
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

/* 删掉某个班的某一次课。class_lesson_chars 和 lesson_progress
   靠外键 on delete cascade 跟着删。 */
export async function deleteClassLesson(id) {
  const { error } = await supabase.from("class_lessons").delete().eq("id", id);
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
  /* 不存 audio_url —— 录音在共享库里按字存，存这儿会变成过期的影子数据 */
  const rows = chars.map((c, i) => ({
    class_lesson_id: classLessonId,
    hanzi: c.hanzi,
    pinyin: c.pinyin || null,
    emoji: c.emoji || null,
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

/* 改学生名字时，同时更新所有相关的学习进度记录 */
export async function renameStudentEverywhereRpc(oldName, newName) {
  const { error } = await supabase.rpc("rename_student_with_progress", {
    old_name: oldName,
    new_name: newName,
  });
  if (error) throw error;
}

/* ============================================================
   共享音频（老师可配音，其他班级可复用）
   ============================================================ */

/* 录音入库：一个字一条，后录的直接覆盖前面的。
   以前是 onConflict "char_id,teacher_name"，每个老师各留一条，
   同一个字堆好几份，谁生效全看 created_at，不直观也不好清理。 */
/* ---- 整词录音 ----
   单字接起来播不等于真实语流（「你好」实际念 ní hǎo），纯听力档要用
   老师直接念的整词。一个词一条，后录覆盖前录，和单字录音同一套规矩。 */
export async function getWordAudios(words) {
  const out = new Map();
  const want = Array.from(new Set((words || []).filter(Boolean)));
  if (!want.length) return out;
  try {
    const { data, error } = await supabase
      .from("shared_word_audios").select("word,teacher_name,audio_url").in("word", want);
    if (error) throw error;
    (data || []).forEach((r) => out.set(r.word, r));
  } catch (e) {
    return out;                       // 表还没建就当没有整词录音
  }
  return out;
}

export async function saveWordAudio(word, teacherName, audioUrl) {
  const { error } = await supabase.from("shared_word_audios").upsert(
    { word, teacher_name: teacherName, audio_url: audioUrl, updated_at: new Date().toISOString() },
    { onConflict: "word" }
  );
  if (error) throw error;
}

export async function saveSharedAudio(charId, teacherName, audioUrl) {
  const { error } = await supabase.from("shared_audios").upsert(
    { char_id: charId, teacher_name: teacherName, audio_url: audioUrl, updated_at: new Date().toISOString() },
    { onConflict: "char_id" }
  );
  if (error) throw error;
}

export async function getCharSharedAudios(charId) {
  const { data, error } = await supabase
    .from("shared_audios")
    .select("teacher_name,audio_url,created_at")
    .eq("char_id", charId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
