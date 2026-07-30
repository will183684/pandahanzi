import { useState, useRef, useEffect } from "react";
import { C } from "../theme";
import { Card, BigButton } from "../components/ui";

/* ===================================================================
   本课内容设置 —— 编辑本班当前这节课：
   逐字改拼音 / 配表情 / 录音 / 增删字，外加词语和句子。
   所有改动只落在本班的副本上，不影响课程库。
   =================================================================== */
export default function ContentSettings({
  lesson, chars, charsFor, onOpenPicker, onSaveLesson, onSaveChars, onCompleteLesson, pushToast, busy,
}) {
  const [title, setTitle] = useState("");
  const [vocabStr, setVocabStr] = useState("");
  const [sentence, setSentence] = useState("");
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);

  /* 播种表单的时机：字表确实属于当前这节课（charsFor === lesson.id），
     且还没为这节课播种过。
     —— chars 是异步到的：换课时 lesson 先更新、chars 还是上一课的，
        只看 lesson.id 会把旧字表灌进表单。charsFor 由 App 维护，标明
        手上这份 chars 属于哪节课。
     —— 播种一次之后不再重置，免得 realtime 刷新打断老师输入。 */
  const loadedFor = useRef(null);
  useEffect(() => {
    if (!lesson) { loadedFor.current = null; return; }
    if (charsFor !== lesson.id) return;
    if (loadedFor.current === lesson.id) return;
    const list = chars || [];
    loadedFor.current = lesson.id;
    setTitle(lesson.title || "");
    setVocabStr((lesson.vocab || []).join(" "));
    setSentence(lesson.sentence || "");
    setRows(list.map((c) => ({
      hanzi: c.hanzi, pinyin: c.pinyin || "", emoji: c.emoji || "", audio_url: c.audio_url || null,
    })));
    setDirty(false);
  }, [lesson, chars, charsFor]);

  /* ---------------- 录音 ---------------- */
  const [recIdx, setRecIdx] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const autoStopRef = useRef(null);

  const stopTracks = () => {
    try { if (streamRef.current) streamRef.current.getTracks().forEach((tk) => tk.stop()); }
    catch (e) { /* ignore */ }
    streamRef.current = null;
  };

  const startRec = async (idx) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ||
          typeof window.MediaRecorder === "undefined") {
        pushToast("这个浏览器/环境不支持录音 🎤"); return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new window.MediaRecorder(stream);
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, audio_url: reader.result } : r)));
          setDirty(true);
          pushToast("录好了，记得点保存 ✅");
        };
        reader.onerror = () => pushToast("录音保存失败 ⚠️");
        reader.readAsDataURL(blob);
        stopTracks();
        setRecIdx(null);
      };
      recorderRef.current = mr;
      mr.start();
      setRecIdx(idx);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => {
        try { if (mr.state === "recording") mr.stop(); } catch (e) { /* ignore */ }
      }, 3000);
    } catch (err) {
      stopTracks();
      setRecIdx(null);
      pushToast("没法录音，请允许使用麦克风 🎤");
    }
  };

  const stopRec = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    try { if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop(); }
    catch (e) { setRecIdx(null); }
  };

  const playPreview = (url) => {
    if (!url) return;
    try {
      if (!previewRef.current) previewRef.current = new Audio();
      previewRef.current.src = url;
      previewRef.current.currentTime = 0;
      const p = previewRef.current.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  };

  useEffect(() => () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    stopTracks();
  }, []);

  /* ---------------- 字表编辑 ---------------- */
  const patchRow = (i, patch) => {
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const removeRow = (i) => { setRows((prev) => prev.filter((_, k) => k !== i)); setDirty(true); };
  const moveRow = (i, dir) => {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const n = prev.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const addRow = () => { setRows((prev) => [...prev, { hanzi: "", pinyin: "", emoji: "", audio_url: null }]); setDirty(true); };

  const save = () => {
    const clean = rows
      .map((r) => ({ ...r, hanzi: (r.hanzi || "").trim(), pinyin: (r.pinyin || "").trim(), emoji: (r.emoji || "").trim() }))
      .filter((r) => r.hanzi);
    if (clean.length === 0) { pushToast("至少留一个字"); return; }
    const dupe = clean.map((r) => r.hanzi).find((h, i, a) => a.indexOf(h) !== i);
    if (dupe) { pushToast(`「${dupe}」重复了，请删掉一个`); return; }
    onSaveChars(clean);
    onSaveLesson({
      title: title.trim() || lesson.title,
      vocab: vocabStr.split(/\s+/).filter(Boolean),
      sentence: sentence.trim(),
    });
    setRows(clean);
    setDirty(false);
  };

  const inputStyle = {
    minHeight: 44, padding: "8px 10px", borderRadius: 10, fontSize: 15,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };
  const labelStyle = { fontWeight: 700, fontSize: 15, marginBottom: 4, display: "block" };

  /* ---------------- 还没选课 ---------------- */
  if (!lesson) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "24px 8px" }}>
          <div style={{ fontSize: 48 }}>📚</div>
          <h3 style={{ margin: "10px 0 6px" }}>还没安排本周课程</h3>
          <p style={{ color: "#8A8276", fontSize: 15, marginTop: 0 }}>
            从 240 节课里选一节，5 个字会自动填好（带拼音）。
          </p>
          <BigButton color={C.bamboo} onClick={onOpenPicker} style={{ marginTop: 8 }}>
            📚 去选课
          </BigButton>
        </div>
      </Card>
    );
  }

  /* 字表还在路上 —— 别渲染上一课的残留 */
  if (charsFor !== lesson.id) {
    return <Card><p style={{ color: "#9C9382", margin: 0 }}>正在加载本课字表…</p></Card>;
  }

  return (
    <Card>
      {/* 当前课头部 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10, marginBottom: 14,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20 }}>✏️ {lesson.title}</h3>
          <span style={{ fontSize: 13, color: "#9C9382" }}>
            本班第 {lesson.seq} 次课
            {lesson.lesson_id ? "　·　来自课程库" : "　·　自建"}
            {lesson.status === "completed" && "　·　已完成 ✅"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onOpenPicker} style={{
            minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.bamboo}`,
            background: "#fff", color: C.bamboo, fontWeight: 700, cursor: "pointer",
          }}>📚 换一课</button>
          {lesson.status === "active" && (
            <button onClick={onCompleteLesson} disabled={busy} style={{
              minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none",
              background: C.gold, color: C.ink, fontWeight: 800, cursor: "pointer",
            }}>✅ 完成本课</button>
          )}
        </div>
      </div>

      {/* 字表 */}
      <label style={labelStyle}>本课汉字（{rows.length} 个）</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
            padding: 8, borderRadius: 12, border: `2px solid ${C.border}`, background: "#FFFDF8",
          }}>
            <input
              value={r.hanzi}
              onChange={(ev) => patchRow(i, { hanzi: ev.target.value })}
              maxLength={1}
              style={{ ...inputStyle, width: 52, fontSize: 26, fontWeight: 800, textAlign: "center", padding: 4 }}
            />
            <input
              value={r.pinyin}
              onChange={(ev) => patchRow(i, { pinyin: ev.target.value })}
              placeholder="拼音"
              style={{ ...inputStyle, flex: "1 1 90px", minWidth: 80 }}
            />
            <input
              value={r.emoji}
              onChange={(ev) => patchRow(i, { emoji: ev.target.value })}
              placeholder="🖼️"
              style={{ ...inputStyle, width: 60, textAlign: "center" }}
            />
            {recIdx === i ? (
              <button onClick={stopRec} style={{
                minHeight: 44, padding: "0 10px", borderRadius: 10, border: "none",
                background: C.red, color: "#fff", fontWeight: 700, cursor: "pointer",
              }}>⏹ 停</button>
            ) : (
              <button onClick={() => startRec(i)} title="录 3 秒" style={{
                minHeight: 44, padding: "0 10px", borderRadius: 10,
                border: `2px solid ${r.audio_url ? C.bamboo : C.border}`,
                background: "#fff", cursor: "pointer", fontSize: 16,
              }}>🎤</button>
            )}
            {r.audio_url && (
              <>
                <button onClick={() => playPreview(r.audio_url)} style={{
                  minHeight: 44, padding: "0 10px", borderRadius: 10, border: `2px solid ${C.border}`,
                  background: "#fff", cursor: "pointer", fontSize: 16,
                }}>▶️</button>
                <button onClick={() => patchRow(i, { audio_url: null })} style={{
                  minHeight: 44, padding: "0 8px", borderRadius: 10, border: `2px solid ${C.border}`,
                  background: "#fff", color: "#9C9382", cursor: "pointer", fontSize: 13,
                }}>清音</button>
              </>
            )}
            <span style={{ display: "flex", gap: 2 }}>
              <button onClick={() => moveRow(i, -1)} disabled={i === 0} style={{
                minHeight: 44, width: 32, borderRadius: 10, border: `2px solid ${C.border}`,
                background: "#fff", cursor: i === 0 ? "not-allowed" : "pointer", opacity: i === 0 ? 0.4 : 1,
              }}>↑</button>
              <button onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} style={{
                minHeight: 44, width: 32, borderRadius: 10, border: `2px solid ${C.border}`,
                background: "#fff", cursor: i === rows.length - 1 ? "not-allowed" : "pointer",
                opacity: i === rows.length - 1 ? 0.4 : 1,
              }}>↓</button>
            </span>
            <button onClick={() => removeRow(i)} style={{
              minHeight: 44, padding: "0 10px", borderRadius: 10, border: `2px solid ${C.border}`,
              background: "#fff", color: C.red, fontWeight: 700, cursor: "pointer",
            }}>删</button>
          </div>
        ))}
      </div>

      <button onClick={addRow} style={{
        minHeight: 48, padding: "0 16px", borderRadius: 12, border: `2px dashed ${C.bamboo}`,
        background: "#fff", color: C.bamboo, fontWeight: 800, cursor: "pointer", marginBottom: 16,
      }}>＋ 添加一个字</button>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>课程名称</label>
          <input style={{ ...inputStyle, width: "100%" }} value={title}
            onChange={(ev) => { setTitle(ev.target.value); setDirty(true); }} />
        </div>
        <div>
          <label style={labelStyle}>词语（空格分开，「拼词语」用）</label>
          <input style={{ ...inputStyle, width: "100%" }} value={vocabStr} placeholder="例如：山水 火山"
            onChange={(ev) => { setVocabStr(ev.target.value); setDirty(true); }} />
        </div>
        <div>
          <label style={labelStyle}>练习句子（「拼句子」「过河」用）</label>
          <input style={{ ...inputStyle, width: "100%" }} value={sentence} placeholder="例如：山上有大树"
            onChange={(ev) => { setSentence(ev.target.value); setDirty(true); }} />
        </div>

        <p style={{ fontSize: 12, color: "#9C9382", margin: 0 }}>
          干扰字（「找一找」用）现在从同级别的字里自动取，不用填。
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <BigButton color={C.bamboo} onClick={save} disabled={busy}>保存内容 💾</BigButton>
          {dirty && <span style={{ color: C.red, fontWeight: 700, fontSize: 14 }}>有未保存的修改</span>}
        </div>
      </div>
    </Card>
  );
}
