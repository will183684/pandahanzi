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
   0.45 是目前的平衡点，试图改善连音问题。
   要更慢更准，只能让老师自己录音（「内容」里每个字的 🎤，录音优先播）。
   返回 false 表示这个环境放不出声。 */
export function speak(text, { rate = 0.45, times = 1, delay = 0 } = {}) {
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (!synth) return false;
    // 停止任何正在播放的音频（录音或 TTS）
    stopAudio();

    const body = times > 1 ? Array(times).fill(text).join("、") : text;
    const scheduleSpeak = () => {
      const u = new window.SpeechSynthesisUtterance(body);
      u.lang = "zh-CN";
      u.rate = rate;
      u.pitch = 0.95;
      const v = pickVoice();
      if (v) u.voice = v;
      u.onerror = () => { /* 忽略引擎的瞬时错误 */ };
      synth.speak(u);
      ensureKeepAlive();
    };
    if (delay > 0) {
      setTimeout(scheduleSpeak, delay);
    } else {
      scheduleSpeak();
    }
    return true;
  } catch (err) {
    return false;
  }
}

/* 放一个字：有老师录音就放录音，否则 TTS。 */
export function playChar(ch, audioMap, opts) {
  stopAudio();   // 停止任何正在播放的音
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

/* ---------------- 连着念一串字 ----------------

   拼词语那种「念整个词」的场合，以前是直接 speak("山水")，机器音。
   而且前一个字的录音还在放，下一句就 cancel 掉它插进来 —— 听感就是
   尾音被砍掉、冒出半个音。

   这里改成排队：一个念完再念下一个，中间留一点间隔。有老师录音就用
   老师的，缺哪个字才用机器音补，这样一个词里能听到真人声。 */
let seqToken = 0;
/* 队列里正在响的那个元素。必须记着 —— 每段都是新建的 Audio，
   不记的话 stopAudio 只能停下模块里那个单例，队列这段照样响到底，
   于是新一串起头时和它撞在一起，就是「尾音盖上来」。 */
let seqEl = null;

const waitFor = (el, ms) => new Promise((done) => {
  let over = false;
  const finish = () => { if (over) return; over = true; clearTimeout(t); done(); };
  const t = setTimeout(finish, ms);      // 兜底：ended 不触发也不会卡死
  el.addEventListener("ended", finish, { once: true });
  el.addEventListener("error", finish, { once: true });
});

/* 放一个字并等它放完。返回 Promise。 */
function playCharAwait(ch, audioMap, opts) {
  const url = audioMap && audioMap[ch];
  if (url) {
    try {
      /* 每次新建 —— 复用同一个元素时，前一段的 ended 监听会串到下一段上 */
      const el = new window.Audio();
      el.preload = "auto";
      el.playsInline = true;
      el.src = url;
      seqEl = el;
      const p = el.play();
      if (p && p.catch) p.catch(() => { /* 放不出就当放完了，继续下一个 */ });
      return waitFor(el, 6000).then(() => { if (seqEl === el) seqEl = null; });
    } catch (e) { /* 落到 TTS */ }
  }
  return speakAwait(ch, opts);
}

/* 念一段并等它念完 */
function speakAwait(text, opts) {
  return new Promise((done) => {
    try {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) { done(); return; }
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = (opts && opts.rate) || 0.45;
      u.pitch = 0.95;
      const v = pickVoice();
      if (v) u.voice = v;
      let over = false;
      const finish = () => { if (over) return; over = true; clearTimeout(t); done(); };
      const t = setTimeout(finish, 6000);
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
      ensureKeepAlive();
    } catch (e) { done(); }
  });
}

/* 依次念完一串字。再调一次会打断上一串。
   gap：字与字之间的间隔，太短会连成一片，太长听着不像一个词。 */
export async function playSequence(chars, audioMap, { gap = 140, rate = 0.5 } = {}) {
  stopAudio();              // 先收尾（它会 ++seqToken 把上一串叫停）
  const mine = ++seqToken;  // 再领自己的号，顺序反了会把自己也叫停
  for (let i = 0; i < chars.length; i++) {
    if (mine !== seqToken) return;               // 被新的一串接管了
    await playCharAwait(chars[i], audioMap, { rate });
    if (mine !== seqToken) return;
    if (i < chars.length - 1) await new Promise((r) => setTimeout(r, gap));
  }
}

/* 离开活动时收尾，免得声音继续放。 */
export function stopAudio() {
  seqToken++;                                    // 让在跑的队列不再往下排
  try { if (seqEl) { seqEl.pause(); seqEl.src = ""; seqEl = null; } } catch (e) { /* ignore */ }
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch (e) { /* ignore */ }
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (synth) synth.cancel();
  } catch (e) { /* ignore */ }
}
