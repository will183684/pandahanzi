import { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../theme";
import { Card, BigButton } from "../components/ui";
import Panda from "../components/Panda";
import { playChar, stopAudio } from "../audio";
import { getSharedAudioByHanzi } from "../supabaseClient";
import {
  SECTIONS, PER_LEVEL, makeItems, initState, nextStep, describeLevel, startLevelFor,
} from "../assessment";

/* ===================================================================
   水平测评 —— 三个板块各自自适应定级，最后给一份报告。

   题目全部来自现有的字库和课程库，不需要老师另外出题：
     识字量  放字音四选一（同「听一听」）
     阅读    句子挖一个字四选一
     书写    Hanzi Writer 按笔顺判定，笔画错了就算不会

   定级逻辑在 assessment.js 里，这里只管呈现和收集对错。
   =================================================================== */

/* ---------------- 书写题：Hanzi Writer 判笔画 ---------------- */
let hwPromise = null;
function loadHanziWriter() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  if (hwPromise) return hwPromise;
  hwPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js";
    s.async = true;
    s.onload = () => (window.HanziWriter ? resolve(window.HanziWriter) : reject(new Error("no global")));
    s.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(s);
  });
  return hwPromise;
}

const BOX = 260;

/* 错几笔就判定「不会写」，直接过下一个字。
   写错 3 笔基本就是不认得这个字了，硬让他写对才放行只是在耗时间，
   孩子会烦，后面的题也就测不准了。 */
const MAX_MISTAKES = 3;

function WritingItem({ char, onResult }) {
  const boxRef = useRef(null);
  const [state, setState] = useState("loading");   // loading | writing | failed
  const settled = useRef(false);

  useEffect(() => { settled.current = false; setState("loading"); }, [char]);

  useEffect(() => {
    let writer = null, alive = true;
    loadHanziWriter().then((HW) => {
      if (!alive || !boxRef.current) return;
      boxRef.current.innerHTML = "";
      try {
        writer = HW.create(boxRef.current, char, {
          width: BOX, height: BOX, padding: 8,
          showCharacter: false, showOutline: true,
          strokeColor: "#1A1A1A", outlineColor: "#E8E0D5",
          drawingColor: C.bamboo, highlightColor: C.gold,
          drawingWidth: 24,
          /* 笔顺数据缺了就跳过这题，不能算孩子不会 */
          onLoadCharDataError: () => { if (alive && !settled.current) { settled.current = true; setState("failed"); onResult(null); } },
        });
        setState("writing");
        let misses = 0;
        writer.quiz({
          leniency: 1.4,
          showHintAfterMisses: false,
          highlightOnComplete: true,
          onMistake: () => {
            misses += 1;
            if (misses < MAX_MISTAKES || settled.current) return;
            /* 到 3 笔就收工：判不会，停掉这个字，别再让他试。 */
            settled.current = true;
            setState("gaveup");
            try { if (writer && writer.cancelQuiz) writer.cancelQuiz(); } catch (e) { /* ignore */ }
            onResult(false);
          },
          onComplete: ({ totalMistakes }) => {
            if (settled.current) return;
            settled.current = true;
            onResult(totalMistakes === 0);
          },
        });
      } catch (e) {
        if (alive && !settled.current) { settled.current = true; setState("failed"); onResult(null); }
      }
    }).catch(() => {
      if (alive && !settled.current) { settled.current = true; setState("failed"); onResult(null); }
    });
    return () => {
      alive = false;
      try { if (writer && writer.cancelQuiz) writer.cancelQuiz(); } catch (e) { /* ignore */ }
    };
  }, [char, onResult]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{
        width: BOX, maxWidth: "86vw", height: BOX, maxHeight: "86vw", position: "relative",
        background: C.card, border: `2px solid ${C.border}`, borderRadius: 20, overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed #EFE8DB" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, borderLeft: "1px dashed #EFE8DB" }} />
        </div>
        {state === "loading" && <span style={{ color: "#9C9382", fontSize: 15 }}>正在加载笔顺…</span>}
        {state === "failed" && <span style={{ color: "#9C9382", fontSize: 15 }}>这个字没有笔顺数据，跳过</span>}
        {state === "gaveup" && <span style={{ color: "#9C9382", fontSize: 16 }}>这个字先放一放，看下一个 →</span>}
        <div ref={boxRef} style={{ width: BOX, height: BOX, touchAction: "none", display: state === "writing" ? "block" : "none" }} />
      </div>
      <p style={{ fontSize: 14, color: "#9C9382", margin: 0 }}>按笔顺一笔一笔写出来</p>
    </div>
  );
}

/* ---------------- 主流程 ---------------- */
export default function Assessment({ curriculum, currentLevel, studentName, onExit, onFinish }) {
  const [phase, setPhase] = useState("intro");      // intro | running | done
  const [si, setSi] = useState(0);                  // 第几个板块
  const [st, setSt] = useState(null);               // 阶梯状态
  const [items, setItems] = useState([]);
  const [ii, setIi] = useState(0);                  // 本轮第几题
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState(null);       // 刚点的选项，用于显示对错
  const [audioMap, setAudioMap] = useState({});
  /* 老师录音是异步捞回来的。捞回来之前 audioMap 还是空的，
     自动播放那个 effect 会先用机器音念一遍，等录音到了 audioMap 一变
     又念第二遍 —— 孩子听到的就是同一个字说两次。
     所以：录音没到位不播；每道题只播一次，用 playedRef 记住播过谁。 */
  const [audioReady, setAudioReady] = useState(false);
  const playedRef = useRef(null);
  /* 本板块真正判过分的题数。全都判不了（比如整批字都没有笔顺数据）时，
     不能当成"全错"报成最低级 —— 那是数据缺失，不是孩子不会。 */
  const scoredRef = useRef(0);
  const [results, setResults] = useState({});       // {板块: {passed, capped}}

  const section = SECTIONS[si];
  const item = items[ii];

  /* 开一轮新题 */
  const loadRound = useCallback((sectionKey, level) => {
    const list = makeItems(sectionKey, curriculum, level);
    setItems(list);
    setIi(0); setCorrect(0); setPicked(null);
    if (sectionKey === "recognize") {
      setAudioReady(false);
      getSharedAudioByHanzi(list.map((i) => i.answer))
        .then((m) => {
          const out = {};
          m.forEach((v, h) => { if (v.audio_url) out[h] = v.audio_url; });
          setAudioMap(out);
        })
        .catch(() => setAudioMap({}))
        .finally(() => setAudioReady(true));
    }
  }, [curriculum]);

  const beginSection = useCallback((index) => {
    const s0 = initState(startLevelFor(currentLevel));
    scoredRef.current = 0;
    setSi(index); setSt(s0);
    loadRound(SECTIONS[index].key, s0.level);
  }, [currentLevel, loadRound]);

  const start = () => { setPhase("running"); beginSection(0); };

  useEffect(() => stopAudio, []);

  /* 识字量：进到新题自动放一次音（只放一次，见 playedRef） */
  useEffect(() => {
    if (phase !== "running" || !item || item.kind !== "recognize" || !audioReady) return undefined;
    const key = `${si}-${st ? st.level : 0}-${ii}-${item.answer}`;
    if (playedRef.current === key) return undefined;
    playedRef.current = key;
    const t = setTimeout(() => playChar(item.answer, audioMap), 300);
    return () => clearTimeout(t);
  }, [phase, item, audioMap, audioReady, si, st, ii]);

  /* 一题结束 -> 下一题 / 下一轮 / 下一个板块 */
  const finishItem = useCallback((ok) => {
    /* ok === null：这题判不了（比如字库里没有笔顺数据），
       不算对也不算错，直接过 —— 不能让数据缺失变成"孩子不会"。 */
    const nCorrect = correct + (ok === true ? 1 : 0);
    if (ok !== null) scoredRef.current += 1;
    setCorrect(nCorrect);

    setTimeout(() => {
      setPicked(null);
      if (ii + 1 < items.length) { setIi(ii + 1); return; }

      const step = nextStep(st, nCorrect);
      if (!step.done) { setSt(step); loadRound(section.key, step.level); return; }

      const done = {
        ...results,
        [section.key]: scoredRef.current === 0
          ? { unavailable: true }
          : { passed: step.passed, capped: !!step.capped },
      };
      setResults(done);
      if (si + 1 < SECTIONS.length) { beginSection(si + 1); return; }
      setPhase("done");
      if (onFinish) onFinish(done);
    }, ok === null ? 200 : 650);
  }, [correct, ii, items.length, st, section, results, si, loadRound, beginSection, onFinish]);

  const choose = (opt) => {
    if (picked) return;
    setPicked(opt);
    finishItem(opt === item.answer);
  };

  const onWritingResult = useCallback((ok) => { finishItem(ok); }, [finishItem]);

  /* ---------------- 开始前 ---------------- */
  if (phase === "intro") {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <Panda sz={96} />
          <h2 style={{ margin: "12px 0 4px" }}>📋 学习水平测评</h2>
          <p style={{ color: "#8A8276", fontSize: 15, margin: "0 0 16px" }}>
            题目会跟着答对答错自动变难变简单，答对得多就往上考，最后给一份报告。
            大约 5 分钟，中途可以退出。
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            {SECTIONS.map((s) => (
              <div key={s.key} style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                border: `2px solid ${C.border}`, borderRadius: 14, padding: "10px 14px", background: "#fff",
              }}>
                <span style={{ fontSize: 26 }}>{s.emoji}</span>
                <span>
                  <b style={{ fontSize: 16 }}>{s.name}</b>
                  <span style={{ display: "block", fontSize: 13, color: "#9C9382" }}>{s.desc}</span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <BigButton color={C.bamboo} onClick={start}>开始测评 🚀</BigButton>
            <BigButton color={C.bamboo} light onClick={onExit}>回去</BigButton>
          </div>
        </div>
      </Card>
    );
  }

  /* ---------------- 报告 ---------------- */
  if (phase === "done") {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "8px 4px" }}>
          <div style={{ fontSize: 52 }}>🎉</div>
          <h2 style={{ margin: "6px 0 2px" }}>测评完成！</h2>
          <p style={{ color: "#8A8276", fontSize: 14, marginTop: 0 }}>{studentName} 的水平报告</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
            {SECTIONS.map((s) => {
              const r = results[s.key] || {};
              const d = r.unavailable
                ? { label: "没测成", hint: "这些字缺笔顺数据，跳过了" }
                : describeLevel(r.passed, r.capped);
              return (
                <div key={s.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  border: `2px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", background: "#fff",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{s.emoji}</span>
                    <b style={{ fontSize: 16 }}>{s.name}</b>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <b style={{ fontSize: 20, color: r.unavailable ? "#9C9382" : C.bamboo }}>{d.label}</b>
                    <span style={{ display: "block", fontSize: 12, color: "#9C9382" }}>{d.hint}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 13, color: "#9C9382", lineHeight: 1.7 }}>
            这份结果是根据孩子当场答题估出来的，会有起伏，用来看大致方向就好。
          </p>
          <BigButton color={C.bamboo} onClick={onExit}>回去 →</BigButton>
        </div>
      </Card>
    );
  }

  /* ---------------- 答题中 ---------------- */
  const totalDone = ii + (st ? st.rounds * PER_LEVEL : 0);
  return (
    <Card>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontWeight: 800, fontSize: 17 }}>
          {section.emoji} {section.name}
          <span style={{ fontSize: 13, color: "#9C9382", fontWeight: 600, marginLeft: 8 }}>
            第 {si + 1} / {SECTIONS.length} 项 · 第 {totalDone + 1} 题
          </span>
        </span>
        <button onClick={onExit} style={{
          minHeight: 40, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.border}`,
          background: "#fff", color: "#8A8276", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}>退出</button>
      </div>

      {!item && <p style={{ color: "#9C9382" }}>正在出题…</p>}

      {item && item.kind === "recognize" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: 15, color: "#6B6356", margin: 0 }}>听一听是哪个字</p>
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

      {item && item.kind === "reading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: 15, color: "#6B6356", margin: 0 }}>句子里缺了一个字，选出来</p>
          <div style={{
            fontSize: 34, fontWeight: 800, letterSpacing: 4, textAlign: "center",
            background: "#FFFDF8", border: `2px solid ${C.border}`, borderRadius: 16, padding: "14px 18px",
          }}>
            {item.sentence.split("").map((ch, k) => (
              <span key={k} style={k === item.blank
                ? { color: C.gold, borderBottom: `3px solid ${C.gold}`, padding: "0 6px" }
                : undefined}>
                {k === item.blank ? "＿" : ch}
              </span>
            ))}
          </div>
          <Options item={item} picked={picked} onPick={choose} />
        </div>
      )}

      {item && item.kind === "writing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <p style={{ fontSize: 15, color: "#6B6356", margin: 0 }}>
            写这个字：<b style={{ fontSize: 22 }}>{item.pinyin || ""}</b>
          </p>
          <WritingItem key={`${st ? st.level : 0}-${ii}-${item.answer}`} char={item.answer} onResult={onWritingResult} />
        </div>
      )}
    </Card>
  );
}

function Options({ item, picked, onPick }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "min(92vw, 360px)" }}>
      {item.options.map((ch) => {
        const isPicked = picked === ch;
        const isAnswer = ch === item.answer;
        const show = picked != null;
        return (
          <button
            key={ch}
            onClick={() => onPick(ch)}
            style={{
              minHeight: 88, borderRadius: 18, fontSize: 50, fontWeight: 800, color: C.ink,
              cursor: show ? "default" : "pointer",
              border: `3px solid ${show && isAnswer ? C.bamboo : show && isPicked ? C.red : C.border}`,
              background: show && isAnswer ? "#EAF6EC" : show && isPicked ? "#FFF1F0" : C.card,
              animation: show && isPicked && !isAnswer ? "pa-shake .4s" : "none",
            }}
          >{ch}</button>
        );
      })}
    </div>
  );
}
