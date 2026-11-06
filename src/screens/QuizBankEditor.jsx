import { useState, useEffect, useMemo, useCallback } from "react";
import { C } from "../theme";
import { getQuizBankFor, saveQuizBank } from "../supabaseClient";

/* ===================================================================
   小测题库 —— 老师给某一课加句子和小短文，丰富单元小测的题目。

   为什么要这个：课程库里每课只有一句话，小测的「读句子」那五题就永远
   在这五句上打转；「读短文」内置的题也是有限的几道。孩子复习完回来重做，
   有三分之一的题是见过的。老师在这儿多写几句、多写一篇短文，重做就更
   换得开。

   加进来的东西是全站共用的（按课号存，不分班）—— 录音本来就是这么共用的，
   课文也是。别的班上到这一课，一样能抽到这些题。

   两处把关，都是提醒不是拦着（老师比程序更懂她的孩子）：
     · 用到了这一课还没教过的字 —— 列出来给她看
     · 句子里一个本课的字都没有 —— 那「读句子」挖不了空，用不上
   正确答案不会填错：答案单独一个框，三个干扰项单独填，答案必定在选项里。
   =================================================================== */

const emptyQuestion = () => ({ q: "", a: "", d: ["", "", ""] });
const emptyPassage = () => ({ text: "", questions: [emptyQuestion()] });

export default function QuizBankEditor({ lessonNo, lessonChars, curriculum, pushToast }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sentences, setSentences] = useState("");
  const [passages, setPassages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* 展开了才去取 —— 大多数时候老师是来录音改词句的，不该为这一块多跑一次库 */
  useEffect(() => {
    if (!open || loaded || !lessonNo) return undefined;
    let alive = true;
    getQuizBankFor(lessonNo)
      .then((b) => {
        if (!alive) return;
        setSentences((b.sentences || []).join("\n"));
        setPassages((b.passages || []).map((p) => ({
          text: (p.text || []).join("\n"),
          questions: (p.questions || []).map((q) => ({
            q: q.q || "",
            a: q.a || "",
            d: (q.opts || []).filter((o) => o !== q.a).slice(0, 3).concat(["", "", ""]).slice(0, 3),
          })),
        })));
        setLoaded(true);
      })
      .catch(() => { if (alive) { pushToast("题库读取失败 ⚠️"); setLoaded(true); } });
    return () => { alive = false; };
  }, [open, loaded, lessonNo, pushToast]);

  /* 这一课（含之前所有课）教过的字。没有课程库就不提醒，不瞎报。 */
  const taught = useMemo(() => {
    if (!curriculum || !lessonNo) return null;
    const s = new Set();
    (curriculum.lessons || []).forEach((l) => {
      if (l.lesson_no > lessonNo) return;
      (l.chars || []).forEach((c) => s.add(c.hanzi));
    });
    return s;
  }, [curriculum, lessonNo]);

  const ownChars = useMemo(
    () => new Set((lessonChars || []).map((c) => (typeof c === "string" ? c : c.hanzi))),
    [lessonChars]
  );

  const sentenceList = useMemo(
    () => sentences.split("\n").map((s) => s.trim()).filter(Boolean),
    [sentences]
  );

  /* 用到的、孩子还没学过的字 */
  const unknown = useMemo(() => {
    if (!taught) return [];
    const bad = new Set();
    const scan = (txt) => String(txt || "").split("").forEach((ch) => {
      if (/[一-龥]/.test(ch) && !taught.has(ch)) bad.add(ch);
    });
    sentenceList.forEach(scan);
    passages.forEach((p) => {
      scan(p.text);
      /* 问句不管 —— 「什么时候」这种词孩子本来就不认得，学生端会念出来。
         选项是要读的，照样要管。 */
      (p.questions || []).forEach((q) => { scan(q.a); (q.d || []).forEach(scan); });
    });
    return Array.from(bad);
  }, [taught, sentenceList, passages]);

  /* 挖不了空的句子：一个本课的字都没有 */
  const uselessSentences = useMemo(
    () => (ownChars.size ? sentenceList.filter((s) => !s.split("").some((ch) => ownChars.has(ch))) : []),
    [sentenceList, ownChars]
  );

  const touch = () => setDirty(true);

  const setPassage = (i, patch) => {
    setPassages((prev) => prev.map((p, k) => (k === i ? { ...p, ...patch } : p)));
    touch();
  };
  const setQuestion = (pi, qi, patch) => {
    setPassages((prev) => prev.map((p, k) => (k !== pi ? p : {
      ...p, questions: p.questions.map((q, j) => (j === qi ? { ...q, ...patch } : q)),
    })));
    touch();
  };

  const save = useCallback(async () => {
    const clean = [];
    for (const p of passages) {
      const text = p.text.split("\n").map((s) => s.trim()).filter(Boolean);
      const questions = (p.questions || [])
        .filter((q) => q.q.trim() && q.a.trim() && q.d.filter((d) => d.trim()).length === 3)
        .map((q) => ({
          q: q.q.trim(),
          a: q.a.trim(),
          opts: [q.a.trim(), ...q.d.map((d) => d.trim())],
        }));
      /* 短文没写完的（缺正文或一道完整的题）先不存，也不报错 ——
         老师可能只是写了一半先离开，下次回来接着写就是了。 */
      if (text.length && questions.length) clean.push({ text, questions });
    }
    setSaving(true);
    try {
      await saveQuizBank(lessonNo, { sentences: sentenceList, passages: clean });
      setDirty(false);
      pushToast(`已存进第${lessonNo}课的小测题库 ✅　句子 ${sentenceList.length} 句 · 短文 ${clean.length} 篇`);
    } catch (e) {
      pushToast("题库保存失败 ⚠️");
    }
    setSaving(false);
  }, [passages, sentenceList, lessonNo, pushToast]);

  if (!lessonNo) return null;

  const inputStyle = {
    minHeight: 44, padding: "8px 10px", borderRadius: 10, fontSize: 15, width: "100%",
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };

  return (
    <div style={{
      border: `2px solid ${C.border}`, borderRadius: 14, padding: 12, background: "#fff", marginTop: 4,
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", textAlign: "left", background: "none", border: "none", padding: 0,
          cursor: "pointer", minHeight: 44,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 15 }}>📝 小测题库（选填）　{open ? "▾" : "▸"}</span>
        <span style={{ display: "block", fontSize: 13, color: "#8A8276", marginTop: 2 }}>
          给这一课多写几个句子、一两篇小短文，孩子做单元小测时就能抽到，重做不容易碰上一样的题。
        </span>
      </button>

      {open && !loaded && <p style={{ color: "#9C9382", fontSize: 14 }}>正在读题库…</p>}

      {open && loaded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 15, display: "block", marginBottom: 4 }}>
              练习句子（一行一句）
            </label>
            <p style={{ fontSize: 13, color: "#8A8276", margin: "0 0 6px" }}>
              小测的「读句子」会从这些句子里挖掉一个字让孩子选。
              句子里至少要有一个本课的字，不然挖不了空。
            </p>
            <textarea
              value={sentences}
              onChange={(ev) => { setSentences(ev.target.value); touch(); }}
              rows={4}
              placeholder={"小鸟在天上飞\n田里有一只小羊"}
              style={{ ...inputStyle, minHeight: 92, lineHeight: 1.7 }}
            />
            {uselessSentences.length > 0 && (
              <p style={{ fontSize: 13, color: C.red, margin: "6px 0 0" }}>
                这几句里没有本课的字，小测用不上：{uselessSentences.join("　")}
              </p>
            )}
          </div>

          <div>
            <label style={{ fontWeight: 700, fontSize: 15, display: "block", marginBottom: 4 }}>
              小短文 + 问题
            </label>
            <p style={{ fontSize: 13, color: "#8A8276", margin: "0 0 8px" }}>
              两三句话一篇，孩子自己读，然后回答问题。问句可以用孩子还不认得的词
              （「什么时候」这种），学生端会念出来；<b>选项要用他读得懂的词</b>。
            </p>

            {passages.map((p, pi) => (
              <div key={pi} style={{
                border: `2px solid ${C.border}`, borderRadius: 12, padding: 10, marginBottom: 10,
                background: "#FFFDF8",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <b style={{ fontSize: 14 }}>第 {pi + 1} 篇</b>
                  <button
                    onClick={() => { setPassages((prev) => prev.filter((_, k) => k !== pi)); touch(); }}
                    style={{
                      minHeight: 36, padding: "0 10px", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${C.red}44`, background: "#fff", color: C.red, fontSize: 13, fontWeight: 700,
                    }}
                  >删掉这篇</button>
                </div>
                <textarea
                  value={p.text}
                  onChange={(ev) => setPassage(pi, { text: ev.target.value })}
                  rows={3}
                  placeholder={"短文，一行一句：\n小羊在山上。\n山上有大风。"}
                  style={{ ...inputStyle, minHeight: 80, lineHeight: 1.7 }}
                />

                {p.questions.map((q, qi) => (
                  <div key={qi} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                    <input
                      value={q.q}
                      onChange={(ev) => setQuestion(pi, qi, { q: ev.target.value })}
                      placeholder="问题，例如：谁在山上？"
                      style={inputStyle}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <input
                        value={q.a}
                        onChange={(ev) => setQuestion(pi, qi, { a: ev.target.value })}
                        placeholder="正确答案"
                        style={{ ...inputStyle, flex: "1 1 120px", width: "auto", borderColor: C.bamboo }}
                      />
                      {q.d.map((d, di) => (
                        <input
                          key={di}
                          value={d}
                          onChange={(ev) => setQuestion(pi, qi, {
                            d: q.d.map((x, k) => (k === di ? ev.target.value : x)),
                          })}
                          placeholder={`干扰项 ${di + 1}`}
                          style={{ ...inputStyle, flex: "1 1 100px", width: "auto" }}
                        />
                      ))}
                    </div>
                    {p.questions.length > 1 && (
                      <button
                        onClick={() => setPassage(pi, { questions: p.questions.filter((_, k) => k !== qi) })}
                        style={{
                          marginTop: 6, minHeight: 36, padding: "0 10px", borderRadius: 8, cursor: "pointer",
                          border: `2px solid ${C.border}`, background: "#fff", color: "#8A8276", fontSize: 13,
                        }}
                      >删掉这道题</button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => setPassage(pi, { questions: [...p.questions, emptyQuestion()] })}
                  style={{
                    marginTop: 10, minHeight: 40, padding: "0 12px", borderRadius: 10, cursor: "pointer",
                    border: `2px dashed ${C.bamboo}`, background: "#fff", color: C.bamboo,
                    fontWeight: 700, fontSize: 14,
                  }}
                >＋ 给这篇再加一道题</button>
              </div>
            ))}

            <button
              onClick={() => { setPassages((prev) => [...prev, emptyPassage()]); touch(); }}
              style={{
                minHeight: 44, padding: "0 14px", borderRadius: 10, cursor: "pointer",
                border: `2px dashed ${C.bamboo}`, background: "#fff", color: C.bamboo,
                fontWeight: 800, fontSize: 15,
              }}
            >＋ 加一篇小短文</button>
          </div>

          {unknown.length > 0 && (
            <div style={{
              background: "#FFF6F4", border: `2px solid ${C.red}55`, borderRadius: 12, padding: "10px 12px",
            }}>
              <b style={{ fontSize: 14, color: C.red }}>这些字孩子还没学过</b>
              <div style={{ fontSize: 22, letterSpacing: 4, margin: "4px 0" }}>{unknown.join("")}</div>
              <span style={{ fontSize: 13, color: "#8A8276" }}>
                小测只考学过的字，出现没学过的字孩子会卡住。确实要用也存得下，你自己把握。
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={save}
              disabled={saving || !dirty}
              style={{
                minHeight: 48, padding: "0 18px", borderRadius: 12, border: "none",
                background: saving || !dirty ? "#D8D2C6" : C.bamboo, color: "#fff",
                fontWeight: 800, fontSize: 15, cursor: saving || !dirty ? "not-allowed" : "pointer",
              }}
            >{saving ? "保存中…" : "保存题库"}</button>
            <span style={{ fontSize: 13, color: "#9C9382" }}>
              题库是按课号存的，所有班级共用；和上面的字表、录音分开保存。
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
