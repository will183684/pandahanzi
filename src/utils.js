/* ============================================================
   Small pure helpers shared across activities & screens
   ============================================================ */

const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/* Spell a small integer as a Chinese numeral (used for week labels). */
export function cnNumber(num) {
  if (num <= 0) return "零";
  if (num < 10) return CN_DIGITS[num];
  if (num === 10) return "十";
  if (num < 20) return "十" + CN_DIGITS[num % 10];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return CN_DIGITS[tens] + "十" + (ones ? CN_DIGITS[ones] : "");
  }
  return String(num);
}

/* Fisher–Yates shuffle returning a new array. */
export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/* Normalize an invite code so full-width chars, stray spaces, and case
   differences don't cause false "wrong code" errors. */
export function normCode(s) {
  return String(s == null ? "" : s)
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[\s　]+/g, "")
    .toUpperCase();
}
