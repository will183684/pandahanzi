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

/* ---------------- 录音预处理：先下好，并掐掉头尾的空白 ----------------

   翻开卡片后要等一两秒才出声，量下来是两件事各占一半：
     · 录音文件开头就有 0.5–0.8 秒空白 —— 老师按下麦克风到开口说话那一段，
       MediaRecorder 忠实地录了进去；
     · 这个字的录音是点下去才开始下载的，Supabase 冷启动首字节 0.6–1.2 秒。

   所以：进活动时把这一课的录音全部提前抓下来（fetch 进 blob，之后播放
   不再走网络），顺便解一次码算出真正出声的区间，播的时候直接从那里起播、
   到那里停。头空白砍了声音就跟手，尾空白砍了拼词语才不会一顿一顿。 */

const SILENCE = 0.02;   // 低于这个振幅算静音
const HEAD_PAD = 0.04;  // 起播往前留一点，别把字头的爆破音削掉
const TAIL_PAD = 0.12;  // 结尾多留一点余韵，收得太干听着突兀

/* url -> { src, head, dur }；dur 是掐完之后的实际时长 */
const clips = new Map();
const clipPending = new Map();
let actx = null;

function audioContext() {
  if (actx) return actx;
  const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!Ctor) return null;
  try { actx = new Ctor(); } catch (e) { actx = null; }
  return actx;
}

function edges(buf) {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  let head = 0, tail = d.length - 1;
  while (head < d.length && Math.abs(d[head]) <= SILENCE) head++;
  while (tail > head && Math.abs(d[tail]) <= SILENCE) tail--;
  if (head >= tail) return { head: 0, dur: buf.duration };   // 整段都很轻，别乱切
  const h = Math.max(0, head / sr - HEAD_PAD);
  const t = Math.min(buf.duration, tail / sr + TAIL_PAD);
  return { head: h, dur: Math.max(0.15, t - h) };
}

/* 把一条录音抓下来、量好头尾。重复调用只做一次。 */
function ensureClip(url) {
  if (!url || clips.has(url)) return Promise.resolve(clips.get(url) || null);
  if (clipPending.has(url)) return clipPending.get(url);
  const job = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("fetch"))))
    .then((ab) => {
      const src = URL.createObjectURL(new Blob([ab]));
      const ctx = audioContext();
      /* 解不了码就只留 blob —— 至少省掉网络那一段 */
      if (!ctx) return { src, head: 0, dur: 0 };
      return ctx.decodeAudioData(ab.slice(0))
        .then((buf) => ({ src, ...edges(buf) }))
        .catch(() => ({ src, head: 0, dur: 0 }));
    })
    .then((clip) => { clips.set(url, clip); clipPending.delete(url); return clip; })
    .catch(() => { clipPending.delete(url); return null; });
  clipPending.set(url, job);
  return job;
}

/* 进一个活动时先把这一课的录音抓下来。之后翻卡片就是本地播放，没有等待。 */
export function preloadAudio(audioMap, chars) {
  if (!audioMap || typeof fetch === "undefined") return;
  const want = chars && chars.length ? chars : Object.keys(audioMap);
  want.forEach((ch) => { const u = audioMap[ch]; if (u && /^https?:/.test(u)) ensureClip(u); });
}

/* 起播位置：换了 src 之后元素还没读到元数据，这时候赋 currentTime 是不生效的
   —— 第一次点会从 0 开始放（也就是从那段空白开始），所以要在 loadedmetadata
   到了之后补一次。第二次点同一个字 src 没变、早就加载好了，一次就成，
   这正是「刚点是断的、再听就完整」的由来。 */
function seekTo(el, pos) {
  const go = () => { try { if (Math.abs(el.currentTime - pos) > 0.02) el.currentTime = pos; } catch (e) { /* ignore */ } };
  go();
  if (el.readyState < 1) el.addEventListener("loadedmetadata", go, { once: true });
}

/* 播到掐好的结尾就停 —— 免得把尾巴那一两秒空白也放完。
   按播放位置判断，不能按秒表：万一起播没跳成，秒表会把字拦腰砍掉。 */
let cutEl = null;
let cutFn = null;
function clearCut() {
  if (cutEl && cutFn) { try { cutEl.removeEventListener("timeupdate", cutFn); } catch (e) { /* ignore */ } }
  cutEl = null; cutFn = null;
}
function armCut(el, clip) {
  clearCut();
  if (!clip || !clip.dur) return;
  const end = clip.head + clip.dur;
  cutFn = () => { if (el.currentTime >= end) { try { el.pause(); } catch (e) { /* ignore */ } clearCut(); } };
  cutEl = el;
  el.addEventListener("timeupdate", cutFn);
}

/* 放一个字：有老师录音就放录音，否则 TTS。 */
export function playChar(ch, audioMap, opts) {
  stopAudio();   // 停止任何正在播放的音
  const url = audioMap && audioMap[ch];
  if (url) {
    try {
      if (!audioEl) audioEl = new window.Audio();
      const clip = clips.get(url);
      if (clip) {
        if (audioEl.src !== clip.src) audioEl.src = clip.src;
        seekTo(audioEl, clip.head);
        armCut(audioEl, clip);
      } else {
        audioEl.src = url;
        audioEl.currentTime = 0;
        ensureClip(url);        // 这次只能将就，下次就快了
      }
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

/* 等到播放位置走过 end（或者放完 / 出错 / 超时兜底）。 */
const waitUntil = (el, end, ms) => new Promise((done) => {
  let over = false;
  const finish = () => {
    if (over) return;
    over = true;
    clearTimeout(t);
    el.removeEventListener("timeupdate", tick);
    done();
  };
  const tick = () => { if (el.currentTime >= end) finish(); };
  const t = setTimeout(finish, ms);
  el.addEventListener("timeupdate", tick);
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
      const clip = clips.get(url);
      el.src = clip ? clip.src : url;
      if (clip && clip.head) seekTo(el, clip.head);
      if (!clip) ensureClip(url);
      seqEl = el;
      const p = el.play();
      if (p && p.catch) p.catch(() => { /* 放不出就当放完了，继续下一个 */ });
      /* 掐掉尾部空白：念到那儿就算这个字完了，接着念下一个，别干等那一两秒。
         同样要看播放位置 —— 按秒表会在起播没跳成时把字砍断。 */
      const wait = clip && clip.dur
        ? waitUntil(el, clip.head + clip.dur, 6000)
        : waitFor(el, 6000);
      return wait.then(() => {
        try { el.pause(); } catch (e) { /* ignore */ }
        if (seqEl === el) seqEl = null;
      });
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
  clearCut();
  try { if (seqEl) { seqEl.pause(); seqEl.src = ""; seqEl = null; } } catch (e) { /* ignore */ }
  try { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } } catch (e) { /* ignore */ }
  try {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    if (synth) synth.cancel();
  } catch (e) { /* ignore */ }
}
