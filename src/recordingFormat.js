/* ============================================================
   录音格式统一 —— 不管老师用什么设备录，存下来的都得人人放得出。

   问题：MediaRecorder 各家吐的格式不一样。电脑 Chrome 默认 webm/opus，
   而 Safari 和 iPhone / iPad 根本放不了 webm 音频 —— 老师在电脑上录完，
   孩子在 iPad 上就是哑的，退回机器朗读，看着像「录音没生效」。
   录音还要全班级共用，所以格式必须是哪儿都能放的。

   做法：能直接录 mp4 就录 mp4（小、通用）；录不了的浏览器录完之后
   把音频解码再转成 WAV。WAV 是裸 PCM，没有编解码器依赖，所有浏览器
   都放得出。代价是文件大，所以降到 22.05kHz 单声道，一个字两三秒
   大约 100KB，可以接受。
   ============================================================ */

/* 这些格式各家浏览器都放得出，录到就直接用 */
const UNIVERSAL = /(mp4|m4a|mpeg|mp3|aac|wav|x-wav)/i;

/* 挑一个录制格式：优先 mp4。浏览器不支持就返回 undefined，
   让 MediaRecorder 用它自己的默认值，之后再转 WAV。 */
export function pickRecorderMime() {
  const MR = typeof window !== "undefined" ? window.MediaRecorder : null;
  if (!MR || !MR.isTypeSupported) return undefined;
  return ["audio/mp4", "audio/mp4;codecs=mp4a.40.2"].find((t) => MR.isTypeSupported(t));
}

/* 录完的 blob -> 到处都能放的 blob。
   已经是通用格式就原样返回；否则解码后转 WAV。
   解码失败（浏览器连自己录的都解不了，基本不会发生）就原样返回，
   总比丢掉录音强。 */
export async function toPlayableBlob(blob) {
  const type = (blob.type || "").toLowerCase();
  if (UNIVERSAL.test(type)) return blob;

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return blob;
    const ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const wav = encodeWav(downmix(decoded), Math.min(decoded.sampleRate, 22050), decoded.sampleRate);
    try { ctx.close(); } catch (e) { /* ignore */ }
    return new Blob([wav], { type: "audio/wav" });
  } catch (e) {
    return blob;
  }
}

/* 多声道混成单声道 —— 念一个字，立体声没意义，白白大一倍 */
function downmix(buf) {
  const n = buf.length;
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += ch[i];
  }
  for (let i = 0; i < n; i++) out[i] /= buf.numberOfChannels;
  return out;
}

/* 线性重采样 + 16 位 PCM 的 WAV。
   幼儿念字是窄带人声，22.05kHz 完全够，用不着更高的采样率。 */
function encodeWav(samples, outRate, inRate) {
  const ratio = inRate / outRate;
  const n = Math.floor(samples.length / ratio);
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  str(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);      // fmt 块长度
  view.setUint16(20, 1, true);       // PCM
  view.setUint16(22, 1, true);       // 单声道
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);   // 字节率
  view.setUint16(32, 2, true);       // 块对齐
  view.setUint16(34, 16, true);      // 位深
  str(36, "data");
  view.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[Math.floor(i * ratio)]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/* content-type -> 文件后缀。后缀和实际内容对不上，有些环境会拒绝播放。 */
export function extFor(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("mp4") || t.includes("aac")) return "m4a";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}
