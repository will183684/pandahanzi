import { useState, useRef, useEffect } from "react";
import { C } from "../theme";
import { getLibraryLessons, addLibraryLesson } from "../supabaseClient";
import { Card, BigButton } from "../components/ui";

/* ===================================================================
   Content Settings form (the week's chars / pinyin / vocab / audio, plus
   the shared lesson library copy-in / contribute controls)
   =================================================================== */
export default function ContentSettings({ meta, isAdmin, onSave, onSaveAudio, onStartNewWeek, pushToast }) {
  const [label, setLabel] = useState(meta.label);
  const [charsStr, setCharsStr] = useState(meta.chars.join(" "));
  const [pinyinStr, setPinyinStr] = useState(meta.pinyins.join(" "));
  const [vocabStr, setVocabStr] = useState(meta.vocab.join(" "));
  const [sentence, setSentence] = useState(meta.sentence);
  const [emojiStr, setEmojiStr] = useState(
    Object.entries(meta.emojiMap).map(([k, v]) => k + "→" + v).join(" ")
  );
  const [distractorStr, setDistractorStr] = useState(meta.distractors.join(" "));
  const [inviteCode, setInviteCode] = useState(meta.inviteCode);

  // ---- per-character teacher recordings ----
  const [audioMap, setAudioMap] = useState(meta.audioMap || {});
  const [recChar, setRecChar] = useState(null); // char currently recording
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const autoStopRef = useRef(null);

  const stopTracks = () => {
    try { if (streamRef.current) streamRef.current.getTracks().forEach((tk) => tk.stop()); } catch (e) { /* ignore */ }
    streamRef.current = null;
  };

  const startRec = async (ch) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === "undefined") {
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
          const dataUrl = reader.result;
          setAudioMap((prev) => ({ ...prev, [ch]: dataUrl }));
          onSaveAudio(ch, dataUrl);
          pushToast("录好了：" + ch + " ✅");
        };
        reader.onerror = () => pushToast("录音保存失败 ⚠️");
        reader.readAsDataURL(blob);
        stopTracks();
        setRecChar(null);
      };
      recorderRef.current = mr;
      mr.start();
      setRecChar(ch);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => {
        try { if (mr.state === "recording") mr.stop(); } catch (e) { /* ignore */ }
      }, 3000);
    } catch (err) {
      stopTracks();
      setRecChar(null);
      pushToast("没法录音，请允许使用麦克风 🎤");
    }
  };

  const stopRec = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    try { if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop(); }
    catch (e) { setRecChar(null); }
  };

  const playPreview = (ch) => {
    const url = audioMap[ch];
    if (!url) return;
    try {
      if (!previewRef.current) previewRef.current = new Audio();
      previewRef.current.src = url;
      previewRef.current.currentTime = 0;
      const p = previewRef.current.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  };

  const clearRec = (ch) => {
    setAudioMap((prev) => {
      const np = { ...prev };
      delete np[ch];
      return np;
    });
    onSaveAudio(ch, null);
    pushToast("已删除：" + ch);
  };

  // cleanup on unmount
  useEffect(() => () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    stopTracks();
  }, []);

  const inputStyle = {
    width: "100%", minHeight: 52, padding: "10px 14px", borderRadius: 12, fontSize: 16,
    border: `2px solid ${C.border}`, background: "#fff", boxSizing: "border-box",
  };
  const labelStyle = { fontWeight: 700, fontSize: 15, marginBottom: 4, display: "block" };

  const parseEmoji = (str) => {
    const map = {};
    str.split(/\s+/).filter(Boolean).forEach((pair) => {
      const parts = pair.split("→");
      if (parts.length === 2) map[parts[0]] = parts[1];
    });
    return map;
  };

  const save = () => {
    const next = {
      ...meta,
      label: label.trim() || meta.label,
      chars: charsStr.split(/\s+/).filter(Boolean),
      pinyins: pinyinStr.split(/\s+/).filter(Boolean),
      vocab: vocabStr.split(/\s+/).filter(Boolean),
      sentence: sentence.trim(),
      emojiMap: parseEmoji(emojiStr),
      distractors: distractorStr.split(/\s+/).filter(Boolean),
      inviteCode: inviteCode.trim(),
      students: meta.students,
      audioMap,
    };
    onSave(next);
  };

  // ---- shared lesson library (copy in / contribute) ----
  const [libOpen, setLibOpen] = useState(false);
  const [lib, setLib] = useState([]);
  const [libBusy, setLibBusy] = useState(false);

  const openLibrary = async () => {
    setLibBusy(true);
    try { setLib(await getLibraryLessons()); setLibOpen(true); }
    catch (e) { pushToast("课程库读取失败 ⚠️"); }
    setLibBusy(false);
  };
  const useLesson = (ls) => {
    // copy a library lesson's content into the form (independent copy)
    setLabel(ls.label || label);
    setCharsStr((ls.chars || []).join(" "));
    setPinyinStr((ls.pinyins || []).join(" "));
    setVocabStr((ls.vocab || []).join(" "));
    setSentence(ls.sentence || "");
    setEmojiStr(Object.entries(ls.emojiMap || {}).map(([k, v]) => k + "→" + v).join(" "));
    setDistractorStr((ls.distractors || []).join(" "));
    setLibOpen(false);
    pushToast("已填入：" + (ls.label || "课程") + "，记得点保存");
  };
  const contribute = async () => {
    const chars = charsStr.split(/\s+/).filter(Boolean);
    if (chars.length === 0) { pushToast("先填好汉字再存入课程库"); return; }
    setLibBusy(true);
    try {
      await addLibraryLesson({
        id: "lib_" + Date.now().toString(36),
        label: label.trim() || "未命名",
        chars, pinyins: pinyinStr.split(/\s+/).filter(Boolean),
        vocab: vocabStr.split(/\s+/).filter(Boolean), sentence: sentence.trim(),
        emojiMap: parseEmoji(emojiStr), distractors: distractorStr.split(/\s+/).filter(Boolean),
      });
      pushToast("已存入课程库，别的班也能用啦 📚");
    } catch (e) { pushToast("存入失败 ⚠️"); }
    setLibBusy(false);
  };

  return (
    <Card>
      <h3 style={{ marginTop: 0 }}>✏️ 本周内容设置</h3>

      {/* shared lesson library */}
      <div style={{ background: "#FFFBF2", border: `2px solid ${C.gold}55`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📚 课程库</span>
          <button onClick={openLibrary} disabled={libBusy} style={{
            minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.bamboo}`,
            background: "#fff", color: C.bamboo, fontWeight: 700, cursor: "pointer",
          }}>从课程库选用</button>
          <button onClick={contribute} disabled={libBusy} style={{
            minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.border}`,
            background: "#fff", fontWeight: 700, cursor: "pointer",
          }}>⬆️ 存入课程库</button>
        </div>
        <p style={{ fontSize: 12, color: "#9C9382", margin: "8px 0 0" }}>
          “选用”会把课程内容填进下面的表单（拷贝一份，之后随便改、不影响别人）；改完点“保存内容”才生效。
        </p>
        {libOpen && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {lib.length === 0 && <span style={{ color: "#9C9382", fontSize: 14 }}>课程库还是空的，先“存入课程库”贡献一周吧。</span>}
            {lib.map((ls) => (
              <button key={ls.id} onClick={() => useLesson(ls)} style={{
                textAlign: "left", minHeight: 48, padding: "8px 12px", borderRadius: 10,
                border: `2px solid ${C.border}`, background: "#fff", cursor: "pointer",
              }}>
                <span style={{ fontWeight: 800 }}>{ls.label}</span>
                <span style={{ color: "#8A8276", marginLeft: 8 }}>{(ls.chars || []).join(" ")}</span>
              </button>
            ))}
            <button onClick={() => setLibOpen(false)} style={{
              alignSelf: "flex-start", minHeight: 40, padding: "0 12px", borderRadius: 10,
              border: "none", background: "none", color: "#9C9382", cursor: "pointer",
            }}>收起</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>周次名称</label>
          <input style={inputStyle} value={label} onChange={(ev) => setLabel(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>汉字（用空格分开）</label>
          <input style={inputStyle} value={charsStr} onChange={(ev) => setCharsStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>拼音（顺序对应汉字）</label>
          <input style={inputStyle} value={pinyinStr} onChange={(ev) => setPinyinStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>词汇</label>
          <input style={inputStyle} value={vocabStr} onChange={(ev) => setVocabStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>练习句子</label>
          <input style={inputStyle} value={sentence} onChange={(ev) => setSentence(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>字→表情（例如 山→⛰️，用空格分开）</label>
          <input style={inputStyle} value={emojiStr} onChange={(ev) => setEmojiStr(ev.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>干扰字（找一找用）</label>
          <input style={inputStyle} value={distractorStr} onChange={(ev) => setDistractorStr(ev.target.value)} />
        </div>

        <div>
          <label style={labelStyle}>家长邀请码</label>
          <input style={inputStyle} value={inviteCode} onChange={(ev) => setInviteCode(ev.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          <BigButton color={C.bamboo} onClick={save}>保存内容 💾</BigButton>
          <BigButton color={C.gold} onClick={onStartNewWeek}>🗓️ 开始新的一周</BigButton>
        </div>
      </div>
    </Card>
  );
}
