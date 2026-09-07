/* ============================================================
   多音字读音表 —— 服务于「听一听」的选项筛选。

   字库里每个字只存一个读音（「觉」存的是 jué），可孩子学过「睡觉」，
   听到 jiào 去选「觉」完全合理。所以判断两个字会不会听混，不能只比
   库里那一个读音，得比它们的全部读音有没有交集。

   收录原则：
     · 只收这 1000 字里确实常见、孩子可能真学过的多音读法
     · 宁可多列不可漏列 —— 多列只是少一个可选的干扰字（每级有 100 个字
       可挑，绰绰有余），漏列就是出一道听不出答案的题
     · 不必求全：以后发现漏了哪个字，补一行就行
   ============================================================ */

const READINGS = {
  大: ["dà", "dài"],
  中: ["zhōng", "zhòng"],
  只: ["zhī", "zhǐ"],
  少: ["shǎo", "shào"],
  了: ["le", "liǎo"],
  干: ["gān", "gàn"],
  分: ["fēn", "fèn"],
  的: ["de", "dí", "dì"],
  着: ["zhe", "zháo", "zhuó", "zhāo"],
  车: ["chē", "jū"],
  子: ["zi", "zǐ"],
  地: ["dì", "de"],

  会: ["huì", "kuài"],
  好: ["hǎo", "hào"],
  长: ["cháng", "zhǎng"],
  乐: ["lè", "yuè"],
  空: ["kōng", "kòng"],
  兴: ["xīng", "xìng"],
  发: ["fā", "fà"],
  要: ["yào", "yāo"],
  和: ["hé", "huo", "hè"],
  正: ["zhèng", "zhēng"],
  角: ["jiǎo", "jué"],
  看: ["kàn", "kān"],
  行: ["xíng", "háng"],
  相: ["xiāng", "xiàng"],

  教: ["jiāo", "jiào"],
  觉: ["jué", "jiào"],
  没: ["méi", "mò"],
  都: ["dōu", "dū"],
  什: ["shén", "shí"],
  号: ["hào", "háo"],
  累: ["lèi", "lěi", "léi"],
  给: ["gěi", "jǐ"],
  食: ["shí", "sì"],
  当: ["dāng", "dàng"],

  还: ["hái", "huán"],
  处: ["chù", "chǔ"],
  卜: ["bo", "bǔ"],
  服: ["fú", "fù"],
  亲: ["qīn", "qìng"],
  盖: ["gài", "gě"],
  将: ["jiāng", "jiàng"],

  得: ["dé", "de", "děi"],
  种: ["zhǒng", "zhòng"],
  露: ["lù", "lòu"],
  划: ["huá", "huà"],
  冲: ["chōng", "chòng"],
  别: ["bié", "biè"],
  壳: ["ké", "qiào"],

  落: ["luò", "là", "lào"],
  数: ["shù", "shǔ"],
  朝: ["zhāo", "cháo"],
  过: ["guò", "guo"],
  节: ["jié", "jiē"],

  为: ["wéi", "wèi"],
  应: ["yīng", "yìng"],
  背: ["bèi", "bēi"],
  重: ["zhòng", "chóng"],
  更: ["gèng", "gēng"],
  舍: ["shè", "shě"],
  量: ["liàng", "liáng"],
  斗: ["dòu", "dǒu"],
  吐: ["tǔ", "tù"],
  结: ["jié", "jiē"],
  答: ["dá", "dā"],
  难: ["nán", "nàn"],

  散: ["sàn", "sǎn"],
  转: ["zhuǎn", "zhuàn"],
  藏: ["cáng", "zàng"],
  压: ["yā", "yà"],
  观: ["guān", "guàn"],
  倒: ["dào", "dǎo"],

  合: ["hé", "gě"],
  参: ["cān", "shēn"],

  弹: ["tán", "dàn"],
  假: ["jiǎ", "jià"],
  泊: ["bó", "pō"],
  漂: ["piāo", "piào", "piǎo"],
  夹: ["jiā", "jiá"],
  术: ["shù", "zhú"],
};

const norm = (p) => (p || "").trim().toLowerCase();

/* 一个字的全部读音。stored 是字库里存的那个，务必传 ——
   表里列的未必涵盖它，两边取并集才保险。 */
export function readingsOf(hanzi, stored) {
  const out = new Set();
  if (stored) out.add(norm(stored));
  (READINGS[hanzi] || []).forEach((p) => out.add(norm(p)));
  return out;
}

/* 两个字听起来会不会混：读音集合有交集就算会混。 */
export function soundsAlike(hanziA, storedA, hanziB, storedB) {
  const a = readingsOf(hanziA, storedA);
  for (const p of readingsOf(hanziB, storedB)) if (a.has(p)) return true;
  return false;
}

export const POLYPHONES = READINGS;
