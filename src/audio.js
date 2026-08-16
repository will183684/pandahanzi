/* ============================================================
   字音播放 —— 优先放老师的录音，没有就用浏览器 TTS 兜底。
   「听一听」和「认一认」共用这份实现。
   ============================================================ */

let audioEl = null;
let keepAliveTimer = null;
let cachedVoice = null;

/* 苹果系统里的「角色音」，卡通化、念单字很怪，要避开。
   之前用 voices.find() 取第一个匹配，正好选中 Eddy，所以特别难听。 */
const NOVELTY = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bells|Boing|Bubbles|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Albert|Bahh|Bad News|Good News)/i;

/* 已知的男声，念给幼儿听不如女声合适，排在最后 */
const MALE = /^(li-?mu|liang|yu-?shu|reed|eddy|rocko|grandpa|han|kangkang|yunyang|yunxi)/i;

/* 按好听程度排的普通话女声，覆盖 苹果 / Chrome / Edge 三套引擎。
   注意排序即优先级 —— 之前只用 find() 取第一个匹配，撞上了角色音 Eddy。 */
const PREFERRED = [
  "tingting", "ting-ting", "婷婷",          // 苹果标准普通话女声
  "meijia", "mei-jia",                      // 苹果（台湾腔）
  "google普通话", "google国语", "google中文",  // Chrome
  "huihui", "xiaoxiao", "yaoyao", "xiaoyi",  // Edge / Windows
];

const norm = (s) => s.replace(/[-\s_]/g, "").toLowerCase();

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  if (!synth) return null;
  const all = synth.getVoices() || [];
  if (!all.length) return null;                       // 语音表还没加载好，下次再挑

  const zhCN = all.filter((v) => /^zh[-_]?CN/i.test(v.lang) || /^cmn/i.test(v.lang) || /Chinese \(China/i.test(v.name));
  const zhAny = all.filter((v) => /zh|cmn|chinese/i.test(v.lang) || /chinese|中文|普通话/i.test(v.name));

  // 1) 偏好名单
  for (const want of PREFERRED) {
    const hit = zhCN.find((v) => norm(v.name).startsWith(want)) || zhAny.find((v) => norm(v.name).startsWith(want));
    if (hit) { cachedVoice = hit; return hit; }
  }
  // 2) 普通话里非角色音的，女声优先
  const plain = zhCN.filter((v) => !NOVELTY.test(v.name));
  const female = plain.find((v) => !MALE.test(norm(v.name)));
  if (female) { cachedVoice = female; return female; }
  if (plain.length) { cachedVoice = plain[0]; return plain[0]; }
  // 3) 任意中文，实在没有就系统默认
  cachedVoice = zhCN[0] || zhAny[0] || null;
  return cachedVoice;
}

/* 语音表是异步加载的。第一次 getVoices() 常常返回空数组，这时候如果
   直接发音就不会设 voice，退回系统默认（往往是男声）——所以模块一加载
   就先预热，并在语音表就绪时重挑一次。 */
if (typeof window !== "undefined" && window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; pickVoice(); };
  // 有些浏览器不触发 onvoiceschanged，兜底再试几次
  let tries = 0;
  const warm = setInterval(() => {
    if (cachedVoice || ++tries > 10) { clearInterval(warm); return; }
    pickVoice();
  }, 300);
}

/* 调试用：看当前选中的是哪个音色 */
export function currentVoiceName() {
  const v = pickVoice();
  return v ? `${v.name} (${v.lang})` : "（系统默认）";
}

/* 有些浏览器的 TTS 讲到 ~15 秒会自己停，speaking 时周期性 resume() 可以避开。 */
function ensureKeepAlive() {
  if (keepAliveTimer || typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  keepAliveTimer = setInterval(() => {
    try { if (synth.speaking) synth.resume(); } catch (e) { /* ignore */ }
  }, 8000);
}

/* 浏览器朗读。语速和发音准确度是冲突的：
   压到 0.3 时苹果的引擎会把音节拉长，复韵母的滑动被抹平 ——
   「月 yuè」听起来会塌成「玉 yù」，孩子反而学错音。
   0.5 是兼顾清楚和够慢的折中，别再往下压了。
   要更慢更准，只能让老师自己录音（「内容」里每个字的 🎤，录音优先播）。
   返回 false 表示这个环境放不出声。 */
export function speak(text, { rate = 0.5, times = 1 } = {}) {
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return false;
    // 只在真的有东西在播时才 cancel —— 每次都调用容易把引擎卡死
    if (synth.speaking || synth.pending) synth.cancel();

    const body = times > 1 ? Array(times).fill(text).join("、") : text;
    const u = new window.SpeechSynthesisUtterance(body);
    u.lang = "zh-CN";
    u.rate = rate;
    u.pitch = 1;
    const v = pickVoice();
    if (v) u.voice = v;
    u.onerror = () => { /* 忽略引擎的瞬时错误 */ };
    synth.speak(u);
    ensureKeepAlive();
    return true;
  } catch (err) {
    return false;
  }
}

/* 放一个字：有老师录音就放录音，否则 TTS。 */
export function playChar(ch, audioMap, opts) {
  const url = audioMap && audioMap[ch];
  if (url) {
    try {
      if (!audioEl) audioEl = new window.Audio();
      audioEl.src = url;
      audioEl.currentTime = 0;
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => speak(ch, opts));   // 自动播放被拦截时退回 TTS
      return true;
    } catch (e) { /* 落到 TTS */ }
  }
  return speak(ch, opts);
}

/* 离开活动时收尾，免得声音继续放。 */
export function stopAudio() {
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch (e) { /* ignore */ }
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (synth) synth.cancel();
  } catch (e) { /* ignore */ }
}
