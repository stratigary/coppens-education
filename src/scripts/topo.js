// Faint topographic contour lines behind the page bands (decorative, aria-hidden).
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1), u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const field = (x, y, seed) => vnoise(x * .9 + seed, y * .9) * .6 + vnoise(x * 2.1, y * 2.1 + seed) * .28 + vnoise(x * 4.3 + seed, y * 4.3) * .12;
const SEGS = { 1: [3, 2], 2: [2, 1], 3: [3, 1], 4: [0, 1], 5: [3, 0, 2, 1], 6: [0, 2], 7: [3, 0], 8: [3, 0], 9: [0, 2], 10: [0, 1, 3, 2], 11: [0, 1], 12: [3, 1], 13: [2, 1], 14: [3, 2] };
function draw(cv) {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  const cs = getComputedStyle(document.documentElement);
  const thin = cs.getPropertyValue('--contour').trim(), idx = cs.getPropertyValue('--contour-index').trim();
  const step = 10, cols = Math.ceil(r.width / step) + 1, rows = Math.ceil(r.height / step) + 1;
  const seed = (cv.dataset.seed || location.pathname).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % 97 * 0.37 + 1.3, sc = 1 / 230;
  const g = []; for (let j = 0; j < rows; j++) { g[j] = []; for (let i = 0; i < cols; i++) g[j][i] = field(i * step * sc, j * step * sc, seed); }
  const lerp = (a, b, l) => (l - a) / (b - a);
  for (let n = 1; n < 22; n++) {
    const lv = .18 + n * .03; ctx.beginPath(); ctx.strokeStyle = n % 5 === 0 ? idx : thin; ctx.lineWidth = n % 5 === 0 ? 1.4 : 1;
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = g[j][i], b = g[j][i + 1], c = g[j + 1][i + 1], d = g[j + 1][i];
      const k = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0); if (k === 0 || k === 15) continue;
      const x = i * step, y = j * step;
      const P = [[x + step * lerp(a, b, lv), y], [x + step, y + step * lerp(b, c, lv)], [x + step * lerp(d, c, lv), y + step], [x, y + step * lerp(a, d, lv)]];
      const s = SEGS[k]; for (let q = 0; q < s.length; q += 2) { ctx.moveTo(...P[s[q]]); ctx.lineTo(...P[s[q + 1]]); }
    }
    ctx.stroke();
  }
}
const all = () => document.querySelectorAll('canvas.topo').forEach(draw);
let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(all, 150); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', all);
new MutationObserver(all).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
// The live calendar can change a band's height, so redraw when bands resize.
if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(all, 100); }); document.querySelectorAll('.band').forEach(b => ro.observe(b)); }
all();
