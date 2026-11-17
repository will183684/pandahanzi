import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { pickRecorderMime, toPlayableBlob, extFor } from "../recordingFormat";
import { stopAudio } from "../audio";

/* ===================================================================
   录音 + 上传 + 试听。

   原来只有「课程编辑」那一页会录音，这套逻辑就长在 ContentSettings 里。
   现在小测那边也要录（短文的问句、词语答案），抽出来两边共用。

   startRec(key, onGot)：开始录，录完把能公开访问的网址交给 onGot。
   key 只是个名字，用来标出「现在正在录哪一行」，界面照着它变红。
   =================================================================== */
export default function useRecorder({ pushToast, maxMs = 3000 } = {}) {
  const [recKey, setRecKey] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const previewRef = useRef(null);
  const autoStopRef = useRef(null);

  const stopTracks = useCallback(() => {
    try { if (streamRef.current) streamRef.current.getTracks().forEach((tk) => tk.stop()); }
    catch (e) { /* ignore */ }
    streamRef.current = null;
  }, []);

  const startRec = useCallback(async (key, onGot) => {
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
          const { data: urlData } = supabase.storage.from("lesson_audios").getPublicUrl(data.path);
          onGot(urlData.publicUrl);
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
        setRecKey(null);
      };
      recorderRef.current = mr;
      mr.start();
      setRecKey(key);
      /* 兜底自动停：有人按下去就走开了，麦克风不能一直开着。
         录一个字 3 秒够了，录一句话要给长一点（maxMs）。 */
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => {
        try { if (mr.state === "recording") mr.stop(); } catch (e) { /* ignore */ }
      }, maxMs);
    } catch (err) {
      stopTracks();
      setRecKey(null);
      pushToast("没法录音，请允许使用麦克风 🎤");
    }
  }, [pushToast, maxMs, stopTracks]);

  const stopRec = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    try { if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop(); }
    catch (e) { setRecKey(null); }
  }, []);

  /* 试听和机器音是两套播放机制，切换时必须互相叫停，
     否则两个声音压在一起。 */
  const stopAll = useCallback(() => {
    try { if (previewRef.current) previewRef.current.pause(); } catch (e) { /* ignore */ }
    stopAudio();
  }, []);

  const playPreview = useCallback((url) => {
    if (!url) return;
    stopAll();
    try {
      /* 每次都新建一个 Audio，不复用。
         iOS 刚录完音时音频会话还在「录音」模式，那会儿建出来的 Audio
         元素会一直被路由到听筒、几乎听不见 —— 复用它就一直是哑的。 */
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
  }, [stopAll, pushToast]);

  useEffect(() => () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    stopTracks();
  }, [stopTracks]);

  return { recKey, startRec, stopRec, playPreview, stopAll };
}
