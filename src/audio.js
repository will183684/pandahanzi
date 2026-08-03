/* ============================================================
   字音播放 —— 优先放老师的录音，没有就用浏览器 TTS 兜底。
   「听一听」和「认一认」共用这份实现。
   ============================================================ */

let audioEl = null;
let keepAliveTimer = null;

/* 有些浏览器的 TTS 讲到 ~15 秒会自己停，speaking 时周期性 resume() 可以避开。 */
function ensureKeepAlive() {
  if (keepAliveTimer || typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  keepAliveTimer = setInterval(() => {
    try { if (synth.speaking) synth.resume(); } catch (e) { /* ignore */ }
  }, 8000);
}

/* 浏览器朗读。返回 false 表示这个环境放不出声。 */
export function speak(text) {
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return false;
    // 只在真的有东西在播时才 cancel —— 每次都调用容易把引擎卡死
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.8;
    const voices = synth.getVoices() || [];
    const zh = voices.find((v) => /zh|cmn|chinese/i.test(v.lang) || /chinese|中文|普通话/i.test(v.name));
    if (zh) u.voice = zh;
    u.onerror = () => { /* 忽略引擎的瞬时错误 */ };
    synth.speak(u);
    ensureKeepAlive();
    return true;
  } catch (err) {
    return false;
  }
}

/* 放一个字：有老师录音就放录音，否则 TTS。 */
export function playChar(ch, audioMap) {
  const url = audioMap && audioMap[ch];
  if (url) {
    try {
      if (!audioEl) audioEl = new window.Audio();
      audioEl.src = url;
      audioEl.currentTime = 0;
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => speak(ch));   // 自动播放被拦截时退回 TTS
      return true;
    } catch (e) { /* 落到 TTS */ }
  }
  return speak(ch);
}

/* 离开活动时收尾，免得声音继续放。 */
export function stopAudio() {
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch (e) { /* ignore */ }
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (synth) synth.cancel();
  } catch (e) { /* ignore */ }
}
