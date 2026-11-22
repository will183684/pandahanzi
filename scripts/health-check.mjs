#!/usr/bin/env node
/* ============================================================
   体检：直接问线上数据库「有没有在悄悄掉东西」。

   为什么要有这个脚本：2026-09-12 到 11-21，老师在「课程库 → 其他字」
   录的音一条都没存进去，界面还照报已保存，两个多月没人发现。那个 bug
   读代码很难看出来（一个 continue 而已），但看数据一眼就知道：单字录音
   的数量一直不涨，存储里的孤儿文件却月月堆高。

   所以体检查的是「数据应该长什么样」，不是「代码看起来对不对」。
   每条都给出判断，有问题的打 ⚠️，最后按是否有问题返回退出码。

     node scripts/health-check.mjs            # 读 .env
     node scripts/health-check.mjs --json     # 给机器看
   ============================================================ */
import fs from "node:fs";
import path from "node:path";

/* ---- 连接 ---- */
const envFile = path.join(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL_ = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error("缺 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(2);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rest(q) {
  const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${q} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function count(table) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  return Number((r.headers.get("content-range") || "/0").split("/")[1]);
}
async function listBucket(bucket) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${URL_}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "", limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } }),
    });
    if (!r.ok) throw new Error(`storage list → ${r.status}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/* ---- 检查项 ---- */
const findings = [];
const ok = (name, detail) => findings.push({ name, level: "ok", detail });
const warn = (name, detail) => findings.push({ name, level: "warn", detail });

/* 1. 录完的音有没有真的入库。
      录音是「先传文件、后写记录」两步，第二步悄悄失败过两个多月。
      只看最近 14 天：更早的孤儿多半是重录覆盖留下的旧文件，正常。 */
async function checkAudioLanding() {
  const files = await listBucket("lesson_audios");
  const [sa, swa] = await Promise.all([
    rest("shared_audios?select=audio_url"),
    rest("shared_word_audios?select=audio_url"),
  ]);
  const used = new Set();
  for (const r of [...sa, ...swa]) {
    const m = /\/lesson_audios\/(.+)$/.exec(r.audio_url || "");
    if (m) used.add(decodeURIComponent(m[1]));
  }
  /* 2026-11-22 修好之前的那些不算 —— 那一批是已知的，再报没有意义。
     等这个日期滚出 14 天窗口，这行就可以删了。 */
  const FIXED_AT = "2026-11-22T04:25";
  const cut = [new Date(Date.now() - 14 * 864e5).toISOString(), FIXED_AT]
    .sort().reverse()[0];
  const recent = files.filter((f) => f.created_at >= cut);
  const lost = recent.filter((f) => !used.has(f.name));
  const detail = `${cut.slice(0, 10)} 以来上传 ${recent.length} 段，没入库 ${lost.length} 段`
    + `（全库 ${files.length} 个文件，孤儿 ${files.filter((f) => !used.has(f.name)).length} 个）`;
  /* 重录会留下旧文件，所以允许少量；成片的才是又在丢 */
  if (lost.length > Math.max(5, recent.length * 0.4)) {
    warn("录音入库", `${detail} —— 录了存不上，查保存路径`);
  } else ok("录音入库", detail);
}

/* 2. 会不会撞上 PostgREST 一次 1000 行的上限。
      撞上了不报错，只是少给数据，最难发现。 */
async function checkRowCaps() {
  /* 已经分页取的表（supabaseClient 里的 fetchAllRows / range 循环）。
     加了新的分页读法就往这儿补一个，不然这条会一直喊狼来了。 */
  const paged = new Set(["characters", "lesson_chars", "lessons", "class_lesson_chars"]);
  const tables = ["characters", "lesson_chars", "lessons", "class_lesson_chars",
    "lesson_progress", "shared_audios", "shared_word_audios", "kv", "assessments"];
  const hot = [];
  const safe = [];
  for (const t of tables) {
    const n = await count(t);
    if (n < 900) continue;
    (paged.has(t) ? safe : hot).push(`${t} ${n}`);
  }
  if (hot.length) {
    warn("1000 行上限", `这些表过线了，但取数的地方没分页，会被悄悄截断：${hot.join("，")}`);
  } else {
    ok("1000 行上限", safe.length
      ? `过线的表都已经分页取：${safe.join("，")}`
      : "所有表都还在 900 行以内");
  }
}

/* 3. 练习记录指向的课还在不在（删课没清记录的话，回顾会打不开） */
async function checkDangling() {
  const [cl, lp] = await Promise.all([
    rest("class_lessons?select=id"),
    rest("lesson_progress?select=class_lesson_id"),
  ]);
  const ids = new Set(cl.map((r) => r.id));
  const bad = lp.filter((r) => !ids.has(r.class_lesson_id));
  if (bad.length) warn("练习记录", `${bad.length} 条指向已经不存在的课`);
  else ok("练习记录", `${lp.length} 条，都指得到课`);
}

/* 4. 课程库本身完整：1200 字、1200 条课-字对应、120 课 */
async function checkCurriculum() {
  const [chars, pairs, lessons] = await Promise.all([
    count("characters"), count("lesson_chars"), count("lessons"),
  ]);
  if (chars === 1200 && pairs === 1200 && lessons === 120) {
    ok("课程库", "1200 字 / 1200 条对应 / 120 课");
  } else {
    warn("课程库", `对不上：${chars} 字 / ${pairs} 条对应 / ${lessons} 课（应是 1200 / 1200 / 120）`);
  }
}

/* 5. kv 里的值能不能用（profile、小测成绩、题库都存在这儿） */
async function checkKv() {
  const rows = await rest("kv?select=class_id,key,value");
  const bad = rows.filter((r) => r.value === null || r.value === undefined);
  if (bad.length) warn("kv", `${bad.length} 行的值是空的：${bad.map((r) => r.key).join("、")}`);
  else ok("kv", `${rows.length} 行，值都在`);
}

/* 6. 录音覆盖率：掉头往下就说明出事了（纯参考，不报警） */
async function checkCoverage() {
  const [n, total] = await Promise.all([count("shared_audios"), count("characters")]);
  ok("录音覆盖", `${n} / ${total} 字有录音（${Math.round((n / total) * 100)}%）`);
}

const checks = [checkAudioLanding, checkRowCaps, checkDangling, checkCurriculum, checkKv, checkCoverage];

for (const fn of checks) {
  try { await fn(); }
  catch (e) { warn(fn.name, `查不了：${(e && e.message) || e}`); }
}

const bad = findings.filter((f) => f.level === "warn");
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ at: new Date().toISOString(), findings }, null, 2));
} else {
  console.log(`熊猫中文 · 数据体检　${new Date().toISOString().slice(0, 16).replace("T", " ")}\n`);
  for (const f of findings) {
    console.log(`${f.level === "warn" ? "⚠️ " : "✅"} ${f.name}：${f.detail}`);
  }
  console.log(`\n${bad.length ? `${bad.length} 项要看一下` : "都正常"}`);
}
process.exit(bad.length ? 1 : 0);
