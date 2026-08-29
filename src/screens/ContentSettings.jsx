import { useState, useRef, useEffect } from "react";
import { C } from "../theme";
import { Card, BigButton, ConfirmDialog } from "../components/ui";
import { supabase } from "../supabaseClient";
import { pickRecorderMime, toPlayableBlob, extFor } from "../recordingFormat";

/* ===================================================================
   本课内容设置 —— 编辑本班当前这节课：
   逐字改拼音 / 配表情 / 录音 / 增删字，外加词语和句子。
   所有改动只落在本班的副本上，不影响课程库。
   =================================================================== */
export default function ContentSettings({
  lesson, chars, charsFor, onOpenPicker, onSaveLesson, onSaveChars, onCompleteLesson, onBack, pushToast, busy,
  /* editMode：从「课程编辑」进来的，只改内容 —— 藏掉「换一课 / 完成本课」
     这些会动排课状态的按钮。 */
  editMode = false,
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
      hanzi: c.hanzi, pinyin: c.pinyin || "", emoji: c.emoji || "",
      audio_url: c.audio_url || null, audio_by: c.audio_by || null,
    })));
    setDirty(false);
  }, [lesson, chars, charsFor]);

  /* ---------------- 录音 ---------------- */
  const [recIdx, setRecIdx] = useState(null);
  const [pendingRec, setPendingRec] = useState(null);   // 待确认覆盖的那一行
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
      const want = pickRecorderMime();
      const mr = new window.MediaRecorder(stream, want ? { mimeType: want } : undefined);
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        const raw = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        try {
          /* 录成什么格式都收，但存进去之前统一成到处都放得出的格式 ——
             这段录音全站共用，不能只在录它的那台设备上能放。 */
          const blob = await toPlayableBlob(raw);
          const type = (blob.type || "audio/webm").split(";")[0];
          const fileName = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${extFor(type)}`;
          const { data, error } = await supabase.storage
            .from("lesson_audios")
            .upload(fileName, blob, { contentType: type });

          if (error) throw error;

          // 获取公开 URL
          const { data: urlData } = supabase.storage
            .from("lesson_audios")
            .getPublicUrl(data.path);

          setRows((prev) => prev.map((r, i) => (
            i === idx ? { ...r, audio_url: urlData.publicUrl, audio_by: null, reRecorded: true } : r
          )));
          setDirty(true);
          pushToast("录好了，记得点保存 ✅");
        } catch (err) {
          /* 别一律报「检查网络」—— 上传失败十有八九是 Storage 的
             权限没配（403 RLS），网络其实好好的，那句提示只会带偏。 */
          const msg = String((err && err.message) || err);
          pushToast(
            /row-level security|Unauthorized|403/i.test(msg) ? "没有上传权限，要配一下 Storage 权限 ⚠️"
              : /not found|Bucket/i.test(msg) ? "找不到录音存储空间 lesson_audios ⚠️"
              : `上传失败：${msg} ⚠️`
          );
          console.error("Audio upload failed:", err);
        }
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
      /* 每次都新建一个 Audio，不复用。
         iOS 刚录完音时音频会话还在「录音」模式，那会儿建出来的 Audio
         元素会一直被路由到听筒、几乎听不见 —— 复用它就一直是哑的。 */
      try { if (previewRef.current) previewRef.current.pause(); } catch (e) { /* ignore */ }
      const el = new Audio();
      el.preload = "auto";
      el.playsInline = true;
      el.volume = 1;
      previewRef.current = el;
      el.onerror = () => pushToast("这段录音放不出来 ⚠️");
      el.src = url;
      const p = el.play();
      if (p && p.catch) p.catch(() => pushToast("手机静音键打开了？放不出声音 🔇"));
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
          {onOpenPicker && (
            <BigButton color={C.bamboo} onClick={onOpenPicker} style={{ marginTop: 8 }}>
              📚 去选课
            </BigButton>
          )}
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
            {lesson.status === "active" ? "　·　正在上 🔵" : "　·　已上过"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onBack && (
            <button onClick={onBack} style={{
              minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.border}`,
              background: "#fff", color: C.ink, fontWeight: 700, cursor: "pointer",
            }}>← 返回</button>
          )}
          {!editMode && onOpenPicker && (
            <button onClick={onOpenPicker} style={{
              minHeight: 44, padding: "0 14px", borderRadius: 12, border: `2px solid ${C.bamboo}`,
              background: "#fff", color: C.bamboo, fontWeight: 700, cursor: "pointer",
            }}>📚 换一课</button>
          )}
          {!editMode && lesson.status === "active" && onCompleteLesson && (
            <button onClick={onCompleteLesson} disabled={busy} style={{
              minHeight: 44, padding: "0 14px", borderRadius: 12, border: "none",
              background: C.gold, color: C.ink, fontWeight: 800, cursor: "pointer",
            }}>✅ 完成本课</button>
          )}
        </div>
      </div>

      {/* 改动对学生是实时生效的，只是这一课不在首页 —— 老师录完音去
          学生首页找不着，容易误以为没保存上。说清楚去哪儿找。 */}
      {editMode && lesson.status !== "active" && (
        <div style={{
          background: "#F5EFE7", border: `2px solid ${C.border}`, borderRadius: 12,
          padding: "10px 12px", marginBottom: 14, fontSize: 14, color: "#6B6356",
        }}>
          这一课已经上过了，改动马上生效。孩子在「📚 历史记录」里能找到它 ——
          首页显示的是正在上的那一课。
        </div>
      )}

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
            {/* 录音是全站共用的，一个字只有一段，重录会盖掉所有班级听到的那段。
                所以有录音时先给试听 + 「重录」，别让人一按麦克风就覆盖掉。 */}
            {recIdx === i ? (
              <button onClick={stopRec} style={{
                minHeight: 44, padding: "0 10px", borderRadius: 10, border: "none",
                background: C.red, color: "#fff", fontWeight: 700, cursor: "pointer",
              }}>⏹ 停</button>
            ) : r.audio_url ? (
              <>
                <button onClick={() => playPreview(r.audio_url)} title="听听现在这段" style={{
                  minHeight: 44, padding: "0 12px", borderRadius: 10, border: `2px solid ${C.bamboo}`,
                  background: "#fff", cursor: "pointer", fontSize: 16,
                }}>▶️ 试听</button>
                <button onClick={() => setPendingRec(i)} title="盖掉现在这段，重新录" style={{
                  minHeight: 44, padding: "0 10px", borderRadius: 10, border: `2px solid ${C.border}`,
                  background: "#fff", color: "#8A8276", cursor: "pointer", fontSize: 13, fontWeight: 700,
                }}>🎤 重录</button>
                <span style={{
                  fontSize: 12, color: "#8A8276", fontWeight: 600, padding: "2px 8px",
                  background: "#F5EFE7", borderRadius: 6, whiteSpace: "nowrap",
                }}>
                  {r.reRecorded ? "刚录的（未保存）" : r.audio_by ? `📻 ${r.audio_by}` : "📻 已有录音"}
                </span>
              </>
            ) : (
              <button onClick={() => startRec(i)} title="录 3 秒" style={{
                minHeight: 44, padding: "0 12px", borderRadius: 10,
                border: `2px solid ${C.border}`,
                background: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#8A8276",
              }}>🎤 录音</button>
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

      {pendingRec != null && (
        <ConfirmDialog
          text={
            `确定重录「${(rows[pendingRec] || {}).hanzi}」吗？\n\n`
            + `这个字全站只有一段录音，重录会盖掉现在这段，`
            + `所有班级的孩子听到的都会变成新录的。\n`
            + `想留着现在这段就点「不了」。`
          }
          confirmLabel="重录"
          cancelLabel="不了，留着"
          onCancel={() => setPendingRec(null)}
          onConfirm={() => { const i = pendingRec; setPendingRec(null); startRec(i); }}
        />
      )}

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
