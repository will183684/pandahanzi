import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C } from "../theme";
import { Card } from "../components/ui";
import {
  listAudioFiles, audioPublicUrl, getClaimedAudioNames,
  getCharIdsWithAudio, saveSharedAudio,
} from "../supabaseClient";

/* ===================================================================
   找回录音。

   录音分两步：先把文件传上去，再写一条「这个字 → 这个文件」的记录。
   2026-09-12 起，从课程库的「其他字」那一栏录的音，第二步被静默跳过了
   （修在 4287b07）。所以文件都还在，只是没人认领 —— 而文件名只有时间戳，
   没有字，机器没法猜出是哪个字，猜错了孩子就会看着「行」听到「海」。

   这一页把没人认领的文件按录制时间排出来，老师听一段、点一个字，当场
   认回去。听一遍比重录一遍快，而且本来就是她的声音。

   认领 = 往 shared_audios 写一条，和重新录一次的效果完全一样。
   =================================================================== */
/* 搜拼音的时候老师不会打声调，zhu 要能搜到 zhù */
const toneless = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ü/g, "v").toLowerCase();

export default function AudioClaim({ curriculum, session, pushToast }) {
  const [files, setFiles] = useState(null);      // 待认领的文件，按时间排
  const [err, setErr] = useState(null);
  const [day, setDay] = useState(null);
  const [i, setI] = useState(0);
  const [done, setDone] = useState(() => ({}));  // 文件名 -> 认成了哪个字
  const [withAudio, setWithAudio] = useState(() => new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const elRef = useRef(null);

  useEffect(() => () => { try { if (elRef.current) elRef.current.pause(); } catch (e) { /* ignore */ } }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([listAudioFiles(), getClaimedAudioNames(), getCharIdsWithAudio()])
      .then(([all, claimed, haveIds]) => {
        if (!alive) return;
        const orphans = all
          .filter((f) => !claimed.has(f.name))
          .map((f) => ({ name: f.name, at: f.created_at, size: (f.metadata || {}).size || 0 }))
          .sort((a, b) => String(a.at).localeCompare(String(b.at)));
        setFiles(orphans);
        setWithAudio(haveIds);
        const days = Array.from(new Set(orphans.map((f) => String(f.at).slice(0, 10))));
        setDay(days[days.length - 1] || null);     // 默认最近那一场
      })
      .catch((e) => { if (alive) setErr(String((e && e.message) || e)); });
    return () => { alive = false; };
  }, []);

  const byDay = useMemo(() => {
    const m = new Map();
    (files || []).forEach((f) => {
      const d = String(f.at).slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(f);
    });
    return m;
  }, [files]);

  const list = useMemo(() => (byDay.get(day) || []).filter((f) => !done[f.name]), [byDay, day, done]);
  const cur = list[Math.min(i, Math.max(0, list.length - 1))] || null;

  /* 候选字：先列还没录音的（最可能就是它们），按课号排；搜索时放开到全部。
     「其他字」排在最前面 —— 丢掉的就是这一批。 */
  const candidates = useMemo(() => {
    if (!curriculum) return [];
    const ownLesson = new Map();    // 这个字正式在第几课教
    const extraAt = new Map();      // 这个字最早在第几课的「其他字」里出现
    (curriculum.lessons || []).forEach((l) => {
      const own = new Set((l.chars || []).map((c) => c.hanzi));
      (l.chars || []).forEach((c) => { if (!ownLesson.has(c.hanzi)) ownLesson.set(c.hanzi, l.lesson_no); });
      const txt = (l.vocab || []).join("") + (l.sentence || "");
      Array.from(txt).forEach((ch) => {
        if (!own.has(ch) && !extraAt.has(ch)) extraAt.set(ch, l.lesson_no);
      });
    });
    const kw = q.trim().toLowerCase();
    return (curriculum.characters || [])
      .filter((c) => (kw
        ? c.hanzi === q.trim() || toneless(c.pinyin).startsWith(kw)
        : !withAudio.has(c.id)))
      .map((c) => ({
        ...c,
        /* 没录音的「其他字」按「她当时翻到哪一课」排 —— 她是顺着课程库
           一课一课往下录的，这个顺序最接近录音的先后。 */
        isExtra: extraAt.has(c.hanzi),
        lesson: extraAt.has(c.hanzi) ? extraAt.get(c.hanzi) : (ownLesson.get(c.hanzi) || 999),
      }))
      .sort((a, b) => (b.isExtra - a.isExtra) || (a.lesson - b.lesson) || a.hanzi.localeCompare(b.hanzi))
      .slice(0, 160);
  }, [curriculum, withAudio, q]);

  const play = useCallback((name) => {
    try {
      if (elRef.current) elRef.current.pause();
      /* 每次新建，不复用 —— 复用过的元素在 iOS 上会被路由到听筒 */
      const el = new Audio();
      el.preload = "auto";
      el.playsInline = true;
      elRef.current = el;
      el.onerror = () => pushToast("这段放不出来 ⚠️");
      el.src = audioPublicUrl(name);
      const p = el.play();
      if (p && p.catch) p.catch(() => pushToast("手机静音键打开了？放不出声音 🔇"));
    } catch (e) { /* ignore */ }
  }, [pushToast]);

  /* 换到下一段就自动放一次，省得每条都要先点播放 */
  useEffect(() => { if (cur) play(cur.name); }, [cur && cur.name]);   // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async (ch) => {
    if (!cur || busy) return;
    setBusy(true);
    try {
      await saveSharedAudio(ch.id, (session && session.name) || "老师", audioPublicUrl(cur.name));
      setDone((prev) => ({ ...prev, [cur.name]: ch.hanzi }));
      setWithAudio((prev) => new Set(prev).add(ch.id));
      setQ("");
      pushToast(`「${ch.hanzi}」认领好了 ✅`);
    } catch (e) {
      pushToast("没能存进去，再试一次 ⚠️");
    }
    setBusy(false);
  };

  if (err) {
    return <Card><p style={{ color: C.red }}>读不到录音文件：{err}</p></Card>;
  }
  if (!files) {
    return <Card><p style={{ color: "#9C9382" }}>正在翻存储里的录音…</p></Card>;
  }

  const days = Array.from(byDay.keys());
  const claimedCount = Object.keys(done).length;
  const total = (byDay.get(day) || []).length;

  return (
    <>
      <Card>
        <h3 style={{ marginTop: 0 }}>🔊 找回录音</h3>
        <p style={{ color: "#8A8276", fontSize: 14, lineHeight: 1.7, marginTop: 0 }}>
          这些录音文件还在，但没有记录说它是哪个字（之前「课程库 → 其他字」那一栏
          存不上，文件传上去了、记录没写成）。
          <b>听一段，点出是哪个字，就算认回来了</b> —— 和重新录一次效果一样，
          但省得你再张嘴。
        </p>
        <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
          听不出来就点「跳过」，不要硬猜 —— 认错了孩子会看着这个字听到另一个字。
          跳过的下次还在。
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>哪一场：</span>
          {days.map((d) => {
            const n = (byDay.get(d) || []).filter((f) => !done[f.name]).length;
            return (
              <button key={d} onClick={() => { setDay(d); setI(0); }} style={{
                minHeight: 40, padding: "0 10px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${d === day ? C.bamboo : C.border}`,
                background: d === day ? "#EAF6EC" : "#fff",
                fontWeight: d === day ? 800 : 600, fontSize: 13,
              }}>{d.slice(5)} · {n}</button>
            );
          })}
        </div>
      </Card>

      {!cur && (
        <Card>
          <p style={{ color: C.bamboo, fontWeight: 800, fontSize: 16 }}>
            这一场的录音都过完了 🎉
            {claimedCount > 0 && `　认回来 ${claimedCount} 段`}
          </p>
          <p style={{ color: "#9C9382", fontSize: 14, marginBottom: 0 }}>
            上面换一场接着弄，或者就到这儿。认回来的录音已经生效了。
          </p>
        </Card>
      )}

      {cur && (
        <Card>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap", marginBottom: 12,
          }}>
            <span style={{ fontSize: 14, color: "#8A8276" }}>
              第 <b style={{ color: C.ink, fontSize: 17 }}>{Math.min(i + 1, list.length)}</b> / {list.length} 段
              <span style={{ marginLeft: 8, fontSize: 12 }}>
                （{day} 共 {total} 段，已认回 {claimedCount}）
              </span>
            </span>
            <span style={{ fontSize: 12, color: "#B9AF9D" }}>录于 {String(cur.at).slice(11, 19)}</span>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => play(cur.name)} style={{
              minHeight: 72, padding: "0 28px", borderRadius: 18, border: "none", cursor: "pointer",
              background: "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
              fontSize: 22, fontWeight: 800, color: C.ink, boxShadow: "0 4px 0 rgba(0,0,0,0.12)",
            }}>🔊 再听一遍</button>
            <button onClick={() => setI((k) => k + 1)} style={{
              minHeight: 72, padding: "0 18px", borderRadius: 18, cursor: "pointer",
              border: `2px solid ${C.border}`, background: "#fff", color: "#8A8276",
              fontSize: 15, fontWeight: 700,
            }}>听不出，跳过 →</button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="直接打这个字，或者打拼音（zhu）"
              style={{
                minHeight: 48, padding: "8px 12px", borderRadius: 12, fontSize: 16, width: "100%",
                border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 12, color: "#9C9382", margin: "6px 0 0" }}>
              {q.trim()
                ? "搜的是全部 1200 字"
                : "下面是还没录音的字，「词句里用到的其他字」排在前面 —— 丢掉的就是这一批"}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {candidates.map((c) => {
              /* 搜索时会搜出已经有录音的字。认给它 = 用这段旧的盖掉现在那段，
                 多半不是想要的，所以标出来。 */
              const taken = withAudio.has(c.id);
              return (
                <button key={c.id} onClick={() => claim(c)} disabled={busy} style={{
                  minHeight: 56, minWidth: 56, padding: "4px 10px", borderRadius: 14, cursor: "pointer",
                  border: `2px solid ${taken ? C.red + "55" : c.isExtra ? C.gold : C.border}`,
                  background: taken ? "#FFF6F4" : c.isExtra ? "#FFFBF2" : "#fff",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{c.hanzi}</span>
                  <span style={{ fontSize: 11, color: taken ? C.red : "#9C9382" }}>
                    {taken ? "已有录音" : `${c.pinyin}${c.lesson < 999 ? ` · ${c.lesson}课` : ""}`}
                  </span>
                </button>
              );
            })}
            {!candidates.length && (
              <p style={{ color: "#9C9382", fontSize: 14 }}>没找到这个字，换个写法或者打拼音试试。</p>
            )}
          </div>
        </Card>
      )}

      {claimedCount > 0 && (
        <Card>
          <b style={{ fontSize: 15 }}>这一轮认回来的（{claimedCount} 段）</b>
          <div style={{ fontSize: 24, letterSpacing: 6, marginTop: 8, lineHeight: 1.6 }}>
            {Object.values(done).join("")}
          </div>
        </Card>
      )}
    </>
  );
}
