/* ============================================================
   Small pure helpers shared across activities & screens
   ============================================================ */

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
