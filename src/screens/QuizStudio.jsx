import { useState, useEffect, useMemo, useCallback } from "react";
import { C } from "../theme";
import { Card } from "../components/ui";
import useRecorder from "../components/useRecorder";
import { playChar, stopAudio } from "../audio";
import { getWordAudios, saveWordAudio, getQuizBank } from "../supabaseClient";
import { blockLabel, blockRange, spokenTextsOf, BLOCK_SIZE, QUIZ_SIZE } from "../quiz";
import Quiz from "./Quiz";
import QuizBankEditor from "./QuizBankEditor";

/* ===================================================================
   老师端的小测页。

   老师反映两件事：看不到小测长什么样，也不知道上哪儿给小测里的声音
   录音。这一页就这两件事：

     ▶️ 试做一遍  —— 走孩子看到的那套界面，题也是现抽的，但不记分、
                     不进孩子的记分表（老师自己做的不该影响出题权重）。
     🎤 小测录音  —— 短文的问句、多字的正确答案，现在默认是机器音，
                     这里一条一条录成真人声。

   「听字音」那一段用的是单字录音，老师在「课程编辑」里录过就自动
   生效，不用在这儿重录，所以下面只提一句、不重复列一遍。
   =================================================================== */
export default function QuizStudio({ curriculum, session, maxLessonNo, pushToast }) {
  const totalLessons = (curriculum && curriculum.lessons && curriculum.lessons.length) || 0;
  const maxBlock = Math.max(1, Math.floor(totalLessons / BLOCK_SIZE));
  /* 默认停在班级正在学的那一张，老师多半要看的就是它 */
  const [block, setBlock] = useState(() => {
    const now = Math.floor((maxLessonNo || 0) / BLOCK_SIZE);
    return Math.min(Math.max(now || 1, 1), Math.max(1, Math.floor(totalLessons / BLOCK_SIZE)));
  });
  const [trying, setTrying] = useState(false);
  const [bank, setBank] = useState(null);
  const [audio, setAudio] = useState({});       // 文字 -> 录音网址
  const [audioBy, setAudioBy] = useState({});   // 文字 -> 谁录的
  const [justSaved, setJustSaved] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  const recorder = useRecorder({ pushToast, maxMs: 6000 });   // 录一句话，3 秒不够
  const { recKey, startRec, stopRec, playPreview, stopAll } = recorder;

  useEffect(() => () => stopAudio(), []);

  /* 老师自己加的题也要能录音，所以题库要一起拉回来。
     bankTick：老师在下面加完题点保存，重拉一次，新问句立刻出现在录音清单里。 */
  const [bankTick, setBankTick] = useState(0);
  useEffect(() => {
    let alive = true;
    getQuizBank()
      .then((b) => { if (alive) setBank(b); })
      .catch(() => { if (alive) setBank({}); });
    return () => { alive = false; };
  }, [bankTick]);

  const texts = useMemo(
    () => (bank ? spokenTextsOf(curriculum, block, bank) : []),
    [curriculum, block, bank]
  );

  /* 哪些已经录过了 */
  const refreshAudio = useCallback(() => {
    if (!texts.length) { setAudio({}); setAudioBy({}); setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    getWordAudios(texts.map((t) => t.text))
      .then((m) => {
        if (!alive) return;
        const out = {};
        const by = {};
        m.forEach((v, t) => {
          if (v && v.audio_url) { out[t] = v.audio_url; by[t] = v.teacher_name || ""; }
        });
        setAudio(out);
        setAudioBy(by);
      })
      .catch(() => { if (alive) { setAudio({}); setAudioBy({}); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [texts]);

  useEffect(refreshAudio, [refreshAudio]);

  /* 这一页录完就存，没有保存按钮 —— 老师从「课程编辑」过来，那边是要点
     保存的，所以她不确定存没存上，一条反复录好几遍。写完再回头查一次库，
     确认真有这条才说「存好了」，并且把那一行标成刚存好，让她看得见。 */
  const onGot = (text) => async (url) => {
    try {
      await saveWordAudio(text, session && session.name, url);
      const back = await getWordAudios([text]);
      const row = back.get(text);
      if (!row || !row.audio_url) throw new Error("not stored");
      setAudio((prev) => ({ ...prev, [text]: row.audio_url }));
      setAudioBy((prev) => ({ ...prev, [text]: row.teacher_name || (session && session.name) || "" }));
      setJustSaved((prev) => { const s = new Set(prev); s.add(text); return s; });
      pushToast("已经存好了 ✅ 这一页不用点保存");
    } catch (e) {
      pushToast("没存上，请再录一次 ⚠️");
    }
  };

  const listen = (t) => {
    stopAll();
    /* 和孩子听到的完全一样：有录音放录音，没有才机器音 */
    playChar(t.text, audio, { rate: t.kind === "question" ? 0.75 : 0.6 });
  };

  /* ---------------- 试做 ---------------- */
  if (trying) {
    return (
      <>
        <Card>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 14, color: "#8A8276" }}>
              👀 你正在试做 <b style={{ color: C.ink }}>{blockLabel(block)}</b> 的小测，
              和孩子看到的一模一样。做完<b>不会</b>记成绩。
            </span>
            <button onClick={() => setTrying(false)} style={{
              minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.border}`,
              background: "#fff", fontWeight: 700, cursor: "pointer",
            }}>← 回小测页</button>
          </div>
        </Card>
        {/* onFinish / focus 都不传：老师试做不记分，也不进孩子的记分表 */}
        <Quiz
          curriculum={curriculum} block={block}
          studentName={(session && session.name) || "老师"}
          lessonTitleOf={null} reviewIdOf={null} onReview={null}
          onFinish={null}
          onExit={() => setTrying(false)}
        />
      </>
    );
  }

  /* ---------------- 小测页 ---------------- */
  const { from, to } = blockRange(block);
  const done = texts.filter((t) => audio[t.text]).length;
  const blocks = [];
  for (let i = 1; i <= maxBlock; i++) blocks.push(i);
  /* 这张卷子的五课，下面按课给一块题库编辑 */
  const lessons = ((curriculum && curriculum.lessons) || [])
    .filter((l) => l.lesson_no >= from && l.lesson_no <= to)
    .sort((a, b) => a.lesson_no - b.lesson_no);

  return (
    <>
      <Card>
        <h3 style={{ marginTop: 0 }}>📝 小测</h3>
        <p style={{ color: "#8A8276", fontSize: 14, lineHeight: 1.7, marginTop: 0 }}>
          每五课一张卷子，{QUIZ_SIZE} 道题（听字音 5 道、读句子填空 5 道、读小短文回答问题 5 道）。
          孩子学完整五课才会在自己那边看到这一张。
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>看哪一张：</span>
          <select
            value={block}
            onChange={(e) => setBlock(Number(e.target.value))}
            style={{
              minHeight: 44, padding: "0 12px", borderRadius: 12,
              border: `2px solid ${C.border}`, background: "#fff", fontSize: 15, fontWeight: 700,
            }}
          >
            {blocks.map((b) => (
              <option key={b} value={b}>{blockLabel(b)}</option>
            ))}
          </select>
          <button onClick={() => setTrying(true)} style={{
            minHeight: 44, padding: "0 16px", borderRadius: 12, border: "none",
            background: C.bamboo, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>▶️ 试做一遍</button>
        </div>
        <p style={{ fontSize: 13, color: "#9C9382", marginBottom: 0 }}>
          试做不记成绩，也不会影响孩子的出题。每次点都是现抽的题，和孩子做到的那套一样。
        </p>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>
          🎤 小测录音
          <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 600 }}>
            {blockLabel(block)} · 已录 {done} / {texts.length}
          </span>
        </h3>
        <p style={{ color: "#8A8276", fontSize: 14, lineHeight: 1.7, marginTop: 0 }}>
          下面这些默认是机器音。录一条就换成你的声音，<b>全站共用</b>，别的班也听得到。
        </p>
        {/* 老师从「课程编辑」过来会找保存按钮（那边确实要点保存），
            找不到就不敢信，一条反复录。这里把话说死。 */}
        <div style={{
          background: "#F7FBF7", border: `2px solid ${C.bamboo}55`, borderRadius: 12,
          padding: "10px 12px", fontSize: 14, color: "#4A6B4F", lineHeight: 1.7, marginBottom: 12,
        }}>
          🔒 <b>这一页没有保存按钮，录完就直接存好了</b>，不用再点别的。
          存上了那一行会变绿、写上「📻 已录」和你的名字，按钮也变成「🎤 重录」——
          看到这三样就是成了，不用重录。
        </div>
        <div style={{
          background: "#FFFBF2", border: `2px solid ${C.gold}55`, borderRadius: 12,
          padding: "10px 12px", fontSize: 13, color: "#6B6356", lineHeight: 1.7, marginBottom: 14,
        }}>
          💡「听字音」那一段念的是单个字，用的是你在「📚 课程编辑」里录的那套单字录音，
          录过就已经在小测里生效了，不用在这儿重录。
        </div>

        {loading && <p style={{ color: "#9C9382" }}>正在看哪些录过了…</p>}
        {!loading && !texts.length && (
          <p style={{ color: "#9C9382" }}>
            第{from}–{to}课还没有要录的内容 —— 这几课的课程还没建好。
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {texts.map((t) => {
            const key = `t:${t.text}`;
            const url = audio[t.text];
            const recording = recKey === key;
            return (
              <div key={t.text} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                border: `2px solid ${url ? C.bamboo + "66" : C.border}`,
                background: url ? "#F7FBF7" : "#fff",
                borderRadius: 14, padding: "10px 12px",
              }}>
                <span style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <b style={{ fontSize: 16 }}>{t.text}</b>
                  <span style={{ display: "block", fontSize: 12, color: "#9C9382" }}>
                    第{t.lessonNo}课 · {t.kind === "question" ? "短文的问句" : "正确答案（答错时念）"}
                    {t.source === "teacher" ? " · ✏️ 你加的" : ""}
                    {"　"}
                    <span style={{ color: url ? C.bamboo : "#B9AF9D", fontWeight: 700 }}>
                      {url ? `📻 已录${audioBy[t.text] ? ` · ${audioBy[t.text]}` : ""}` : "🤖 机器音"}
                    </span>
                    {justSaved.has(t.text) && (
                      <span style={{ color: C.bamboo, fontWeight: 700 }}>　刚存好 ✅</span>
                    )}
                  </span>
                </span>
                <button onClick={() => listen(t)} title="听听孩子现在听到的" style={{
                  minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.border}`,
                  background: "#fff", fontSize: 18, cursor: "pointer",
                }}>▶️</button>
                {recording ? (
                  <button onClick={stopRec} style={{
                    minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none",
                    background: C.red, color: "#fff", fontWeight: 800, cursor: "pointer",
                  }}>⏹ 停止</button>
                ) : (
                  <button onClick={() => startRec(key, onGot(t.text))} style={{
                    minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none",
                    background: url ? C.gold : C.bamboo, color: url ? C.ink : "#fff",
                    fontWeight: 800, cursor: "pointer",
                  }}>{url ? "🎤 重录" : "🎤 录音"}</button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0 }}>✏️ 加题
          <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 600 }}>{blockLabel(block)}</span>
        </h3>
        <p style={{ color: "#8A8276", fontSize: 14, lineHeight: 1.7, marginTop: 0 }}>
          上面那些题是内置的，文字不能改；但你可以自己加 —— 加进来的和内置的一起抽。
          课程库里每课只有一句话，「读句子」那五题就永远在这五句上打转，
          <b>每课随手加两三句</b>，孩子重做就不容易碰上一样的题。
        </p>
        <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
          加完点那一块自己的「保存题库」。存好以后，新的问句和答案会出现在上面的录音清单里，可以接着录。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lessons.map((l) => (
            <QuizBankEditor
              key={l.lesson_no}
              lessonNo={l.lesson_no}
              lessonChars={l.chars || []}
              curriculum={curriculum}
              pushToast={pushToast}
              label={`📝 第${l.lesson_no}课`}
              hint={(l.chars || []).map((c) => c.hanzi).join("")}
              onSaved={() => setBankTick((t) => t + 1)}
            />
          ))}
          {!lessons.length && (
            <p style={{ color: "#9C9382" }}>第{from}–{to}课的课程还没建好，暂时加不了题。</p>
          )}
        </div>
      </Card>
    </>
  );
}
