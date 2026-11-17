import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { C } from "../theme";
import { Card, BigButton, Confetti } from "../components/ui";
import Panda from "../components/Panda";
import { playChar, stopAudio } from "../audio";
import { getSharedAudioByHanzi, getWordAudios, getQuizBank } from "../supabaseClient";
import { makeQuiz, gradeQuiz, blockLabel, verdictFor, QUIZ_SIZE } from "../quiz";

/* ===================================================================
   单元小测 —— 每五课一张 15 题的卷子，做完告诉家长哪一课要回去巩固。

   出题和判分在 quiz.js 里，这里只管呈现、收答案、给报告。
   =================================================================== */

const SECTION_OF = {
  recognize: { name: "听字音", emoji: "🔊", tip: "听一听是哪个字" },
  cloze: { name: "读句子", emoji: "📝", tip: "句子里缺了一个字，选出来" },
  wordCloze: { name: "读句子", emoji: "📝", tip: "句子里缺了一个词，选出来" },
  passage: { name: "读短文", emoji: "📖", tip: "读完小短文，回答问题" },
};

/* lessonTitleOf(lessonNo) -> "L1 第3课"；reviewIdOf(lessonNo) -> 本班那一课的
   class_lesson id（没上过就是 null，那就不给「去复习」按钮）。 */
/* focus：孩子的字词记分表 {"字": {r,w}}，出题按它加权 —— 认错过的多考。 */
export default function Quiz({
  curriculum, block, studentName, lastResult, focus,
  lessonTitleOf, reviewIdOf, onReview, onExit, onFinish,
}) {
  const [phase, setPhase] = useState("intro");     // intro | running | done
  const [items, setItems] = useState([]);
  const [ii, setIi] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [picked, setPicked] = useState(null);
  const [audioMap, setAudioMap] = useState({});
  const [audioReady, setAudioReady] = useState(false);
  const playedRef = useRef(null);

  const item = items[ii];
  const report = useMemo(
    () => (phase === "done" ? gradeQuiz(items, answers) : null),
    [phase, items, answers]
  );

  /* 答错要多停一会儿（见 choose），这中间孩子可能点「退出」。
     定时器不收掉的话，人已经离开了还会跳下一题 / 算成绩。 */
  const timersRef = useRef([]);
  const later = useCallback((fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    stopAudio();
  }, []);

  /* 老师自己加的句子和短文。进这一屏就先取，等孩子看完说明点「开始」，
     一般已经到了；没到就等它（出题要用），所以 start 里不直接用 state。 */
  const bankRef = useRef(null);
  useEffect(() => {
    let alive = true;
    getQuizBank()
      .then((b) => { if (alive) bankRef.current = b; })
      .catch(() => { if (alive) bankRef.current = {}; });   // 取不到就只用内置题库
    return () => { alive = false; };
  }, []);

  const start = useCallback(() => {
    const list = makeQuiz(curriculum, block, bankRef.current || {}, focus);
    setItems(list);
    setAnswers([]); setIi(0); setPicked(null);
    setPhase("running");
    /* focus 是进屏时拿到的那一份，整张卷子用同一份；做完回到这屏，
       App 已经把新的记分表推下来了，下一张就按新的出。 */
    /* 听字音那几题要用老师的录音。先一次性捞回来，捞到之前不自动放音 ——
       不然机器音先念一遍、录音到了再念一遍，孩子听见同一个字说两次。 */
    setAudioReady(false);
    const want = list.filter((i) => i.kind === "recognize").map((i) => i.answer);
    /* 短文的问句、多字的正确答案：老师在「🎤 小测录音」里录过就放真人声，
       没录过 playChar 会自动退回机器音。单字和整句整词放在同一张表里
       —— 键不会撞（一个是单字，一个是整句），下面播放时不用分两套。 */
    const wantText = [];
    list.forEach((i) => {
      if (i.kind === "passage") wantText.push(i.question);
      if (String(i.answer).length > 1) wantText.push(i.answer);
    });
    Promise.all([
      getSharedAudioByHanzi(want).catch(() => new Map()),
      getWordAudios(wantText).catch(() => new Map()),
    ])
      .then(([m, wm]) => {
        const out = {};
        m.forEach((v, h) => { if (v && v.audio_url) out[h] = v.audio_url; });
        wm.forEach((v, t) => { if (v && v.audio_url) out[t] = v.audio_url; });
        setAudioMap(out);
      })
      .catch(() => setAudioMap({}))
      .finally(() => setAudioReady(true));
  }, [curriculum, block, focus]);

  /* 听字音：进到新题自动放一次（只放一次，见 playedRef）。
     短文题把问句念出来 —— 「什么时候」这种词孩子还不认得，
     短文本身要他自己读，问句不该卡住他。 */
  useEffect(() => {
    if (phase !== "running" || !item) return undefined;
    const key = `${ii}-${item.answer}`;
    if (playedRef.current === key) return undefined;
    if (item.kind === "recognize") {
      if (!audioReady) return undefined;
      playedRef.current = key;
      const t = setTimeout(() => playChar(item.answer, audioMap), 300);
      return () => clearTimeout(t);
    }
    if (item.kind === "passage") {
      playedRef.current = key;
      /* playChar 会先找老师的录音，没有才用机器音 —— 问句也一样 */
      const t = setTimeout(() => playChar(item.question, audioMap, { rate: 0.75 }), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, item, ii, audioMap, audioReady]);

  /* 答对 0.75 秒就走，答错停 1.8 秒还要把正确答案念出来。

     原来对错都是 750ms：抖动动画自己就占 0.4 秒，孩子的眼睛全在自己点的
     那个红框上，正确答案那个绿框一闪就过去了 —— 等于错了也不知道正确的
     是哪个，这道题白错。念一遍是因为认字的孩子未必看得出绿框是什么意思。 */
  const RIGHT_HOLD = 750;
  const WRONG_HOLD = 1800;

  const choose = (opt) => {
    if (picked != null) return;
    setPicked(opt);
    const next = answers.slice();
    next[ii] = opt;
    setAnswers(next);

    const right = opt === item.answer;
    if (!right) {
      /* 等抖动演完再出声，不然声音和晃动撞在一起，哪个都没听清看清。
         优先放老师的录音（单字录音，或者整词整句录音），
         没录过 playChar 自动退回机器音。 */
      later(() => {
        playChar(item.answer, audioMap, { rate: 0.6 });
      }, 400);
    }

    later(() => {
      setPicked(null);
      if (ii + 1 < items.length) { setIi(ii + 1); return; }
      stopAudio();
      setPhase("done");
      if (onFinish) onFinish(gradeQuiz(items, next));
    }, right ? RIGHT_HOLD : WRONG_HOLD);
  };

  /* ---------------- 开始前 ---------------- */
  if (phase === "intro") {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <Panda sz={96} />
          <h2 style={{ margin: "12px 0 4px" }}>📝 单元小测 · {blockLabel(block)}</h2>
          <p style={{ color: "#8A8276", fontSize: 15, margin: "0 0 14px", lineHeight: 1.7 }}>
            这五课一起考 {QUIZ_SIZE} 道题，每课 3 道：先听字音选字，再读句子填空，
            最后读小短文回答问题。做完会告诉你哪一课要回去再练。
          </p>
          <div style={{
            textAlign: "left", background: "#FFFBF2", border: `2px solid ${C.gold}55`,
            borderRadius: 14, padding: "12px 14px", marginBottom: 16, fontSize: 14, color: "#6B6356",
          }}>
            <div>🔊 听字音 · 5 题</div>
            <div style={{ marginTop: 4 }}>📝 读句子 · 5 题</div>
            <div style={{ marginTop: 4 }}>📖 读短文 · 5 题</div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.gold}66`, color: "#8A8276" }}>
              🎯 上回认错的字，这回会多考几次；认得牢的少考。
            </div>
          </div>
          {lastResult && (
            <p style={{ fontSize: 13, color: "#9C9382", marginTop: 0 }}>
              上次做了 {lastResult.correct}/{lastResult.total} 题
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <BigButton color={C.bamboo} onClick={start}>开始小测 🚀</BigButton>
            <BigButton color={C.bamboo} light onClick={onExit}>回去</BigButton>
          </div>
        </div>
      </Card>
    );
  }

  /* ---------------- 报告 ---------------- */
  if (phase === "done" && report) {
    const allGood = report.weak.length === 0;
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "8px 4px", position: "relative" }}>
          {allGood && <Confetti count={90} />}
          <div style={{ fontSize: 52 }}>{allGood ? "🎉" : "💪"}</div>
          <h2 style={{ margin: "6px 0 2px" }}>小测做完了！</h2>
          <p style={{ color: "#8A8276", fontSize: 14, marginTop: 0 }}>
            {studentName} · {blockLabel(block)} · 对了 <b style={{ color: C.bamboo, fontSize: 20 }}>{report.correct}</b> / {report.total} 题
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
            {report.perLesson.map((l) => {
              const v = verdictFor(l.correct, l.total);
              const title = (lessonTitleOf && lessonTitleOf(l.lessonNo)) || `第${l.lessonNo}课`;
              const reviewId = reviewIdOf ? reviewIdOf(l.lessonNo) : null;
              return (
                <div key={l.lessonNo} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  flexWrap: "wrap",
                  border: `2px solid ${v.key === "weak" ? v.color + "88" : C.border}`,
                  background: v.key === "weak" ? "#FFF6F4" : "#fff",
                  borderRadius: 14, padding: "12px 14px", textAlign: "left",
                }}>
                  <span>
                    <b style={{ fontSize: 16 }}>{title}</b>
                    <span style={{ display: "block", fontSize: 13, color: "#9C9382" }}>
                      {"⭐".repeat(l.correct)}
                      <span style={{ color: "#C4BCAD" }}>{"☆".repeat(l.total - l.correct)}</span>
                      {"　"}{l.correct}/{l.total}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ color: v.color, fontSize: 15 }}>{v.label}</b>
                    {v.key !== "good" && reviewId != null && onReview && (
                      <button
                        onClick={() => onReview(reviewId)}
                        style={{
                          minHeight: 40, padding: "0 12px", borderRadius: 10, border: "none",
                          background: C.gold, color: C.ink, fontWeight: 800, fontSize: 14, cursor: "pointer",
                        }}
                      >去复习 →</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 这回认错的字和词：下一张卷子它们出现的机会最大 */}
          {report.missed.length > 0 && (
            <div style={{
              textAlign: "left", background: "#FFFBF2", border: `2px solid ${C.gold}55`,
              borderRadius: 14, padding: "12px 14px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 14, color: "#6B6356", marginBottom: 8 }}>
                🎯 这几个还没记牢，下次小测会多考：
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {report.missed.map((k) => (
                  <span key={k} style={{
                    fontSize: k.length > 1 ? 20 : 26, fontWeight: 800, color: C.ink,
                    background: "#fff", border: `2px solid ${C.gold}`, borderRadius: 10,
                    padding: k.length > 1 ? "4px 10px" : "2px 10px",
                  }}>{k}</span>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 14, color: "#6B6356", lineHeight: 1.8, textAlign: "left" }}>
            {allGood
              ? "这五课都过关了，可以放心往下学啦 🎉"
              : `建议回去再练一练：${report.weak.map((n) => (lessonTitleOf && lessonTitleOf(n)) || `第${n}课`).join("、")}。
                 在「历史记录」里点那一课的「查看回顾」就能重做。`}
          </p>
          <BigButton color={C.bamboo} onClick={onExit}>回去 →</BigButton>
        </div>
      </Card>
    );
  }

  /* ---------------- 答题中 ---------------- */
  const sec = item ? SECTION_OF[item.kind] : null;
  return (
    <Card>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontWeight: 800, fontSize: 17 }}>
          {sec ? `${sec.emoji} ${sec.name}` : "小测"}
          <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 600, marginLeft: 8 }}>
            第 {ii + 1} / {items.length} 题
          </span>
        </span>
        <button onClick={onExit} style={{
          minHeight: 40, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.border}`,
          background: "#fff", color: "#8A8276", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>退出</button>
      </div>

      {/* 进度条：15 题不短，得让孩子看见还剩多少 */}
      <div style={{ height: 8, borderRadius: 999, background: "#F1EADF", marginBottom: 16 }}>
        <div style={{
          width: `${items.length ? (ii / items.length) * 100 : 0}%`, height: "100%",
          borderRadius: 999, background: C.bamboo, transition: "width .3s",
        }} />
      </div>

      {!item && <p style={{ color: "#9C9382" }}>正在出题…</p>}

      {item && item.kind === "recognize" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: 15, color: "#6B6356", margin: 0 }}>{sec.tip}</p>
          <button
            onClick={() => playChar(item.answer, audioMap)}
            aria-label="再听一次"
            style={{
              width: 110, height: 110, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "radial-gradient(circle at 35% 30%, #FFE9A8, " + C.gold + ")",
              boxShadow: "0 6px 0 rgba(0,0,0,0.12)", fontSize: 50,
            }}
          >🔊</button>
          <Options item={item} picked={picked} onPick={choose} />
        </div>
      )}

      {item && (item.kind === "cloze" || item.kind === "wordCloze") && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: 15, color: "#6B6356", margin: 0 }}>{sec.tip}</p>
          <div style={{
            fontSize: 32, fontWeight: 800, letterSpacing: 4, textAlign: "center",
            background: "#FFFDF8", border: `2px solid ${C.border}`, borderRadius: 16, padding: "14px 18px",
          }}>
            {item.sentence.split("").map((ch, k) => {
              const len = item.blankLen || 1;
              const inBlank = k >= item.blank && k < item.blank + len;
              if (!inBlank) return <span key={k}>{ch}</span>;
              return (
                <span key={k} style={{ color: C.gold, borderBottom: `3px solid ${C.gold}`, padding: "0 4px" }}>＿</span>
              );
            })}
          </div>
          <Options item={item} picked={picked} onPick={choose} />
        </div>
      )}

      {item && item.kind === "passage" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <p style={{ fontSize: 15, color: "#6B6356", margin: 0 }}>{sec.tip}</p>
          {/* 短文自己读 —— 这一段考的就是读。问句才念出来。 */}
          <div style={{
            background: "#FFFDF8", border: `2px solid ${C.border}`, borderRadius: 16,
            padding: "16px 18px", width: "min(92vw, 420px)", boxSizing: "border-box",
          }}>
            {item.passage.map((line, k) => (
              <p key={k} style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.7, margin: 0, letterSpacing: 2 }}>
                {line}
              </p>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <b style={{ fontSize: 20 }}>{item.question}</b>
            <button
              onClick={() => playChar(item.question, audioMap, { rate: 0.75 })}
              aria-label="再听一遍问题"
              style={{
                minHeight: 44, minWidth: 44, borderRadius: 12, border: `2px solid ${C.bamboo}`,
                background: "#fff", fontSize: 20, cursor: "pointer", lineHeight: 1,
              }}
            >🔊</button>
          </div>
          <Options item={item} picked={picked} onPick={choose} wide />
        </div>
      )}
    </Card>
  );
}

function Options({ item, picked, onPick, wide }) {
  /* 短文题的选项是词，字数多，排一列才放得下；单字题两列两行。 */
  const long = wide || item.options.some((o) => String(o).length > 2);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: long ? "1fr" : "1fr 1fr",
      gap: 12, width: "min(92vw, 380px)",
    }}>
      {item.options.map((opt) => {
        const isPicked = picked === opt;
        const isAnswer = opt === item.answer;
        const show = picked != null;
        /* 选错了的时候，正确答案那个要跳出来 —— 光是变绿，孩子的眼睛
           全在自己点的那个红框上，根本注意不到。 */
        const reveal = show && isAnswer && !isPicked;
        return (
          <button
            key={opt}
            onClick={() => onPick(opt)}
            style={{
              position: "relative",
              minHeight: long ? 60 : 88, borderRadius: 18,
              fontSize: long ? 26 : 50, fontWeight: 800, color: C.ink,
              cursor: show ? "default" : "pointer",
              border: `3px solid ${show && isAnswer ? C.bamboo : show && isPicked ? C.red : C.border}`,
              background: show && isAnswer ? "#EAF6EC" : show && isPicked ? "#FFF1F0" : C.card,
              boxShadow: reveal ? `0 0 0 4px ${C.bamboo}33` : "none",
              animation: show && isPicked && !isAnswer
                ? "pa-shake .4s"
                : reveal ? "pa-pulse .6s ease-in-out .3s 2" : "none",
            }}
          >
            {opt}
            {reveal && (
              <span style={{
                position: "absolute", top: -10, right: -8,
                width: 28, height: 28, borderRadius: "50%", background: C.bamboo,
                color: "#fff", fontSize: 16, lineHeight: "28px", fontWeight: 900,
              }}>✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
