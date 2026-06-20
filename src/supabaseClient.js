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
