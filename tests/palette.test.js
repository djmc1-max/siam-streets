const test = require('node:test');
const assert = require('node:assert/strict');
const { GROUPS, TONES, PLAYERS } = require('../public/js/palette.js');
const { COLOR_GROUPS } = require('../public/js/data.js');

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lum = (h) => { const c = rgb(h).map(lin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrastWhite = (h) => 1.05 / (lum(h) + 0.05);
const lab = (h) => {
  const c = rgb(h).map(lin);
  const x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
  const y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
function minPair(list) {
  let min = Infinity;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) min = Math.min(min, dE(list[i], list[j]));
  return min;
}

test('white text is readable (>= 4.5:1) on both stops of every group and tone', () => {
  const all = Object.assign({}, GROUPS, TONES);
  Object.keys(all).forEach((k) => all[k].forEach((c) => {
    assert.ok(contrastWhite(c) >= 4.5, k + ' ' + c + ' contrast ' + contrastWhite(c).toFixed(2)); }));
});

test('the 8 property groups stay clearly distinct', () => {
  assert.equal(Object.keys(GROUPS).length, 8);
  assert.ok(minPair(Object.values(GROUPS).map((g) => g[0])) >= 25, 'min deltaE ' + minPair(Object.values(GROUPS).map((g) => g[0])));
});

test('the six player glow colours are all distinct and bright', () => {
  assert.equal(PLAYERS.length, 6);
  assert.equal(new Set(PLAYERS).size, 6);
  assert.ok(minPair(PLAYERS) >= 40, 'min deltaE ' + minPair(PLAYERS));
  PLAYERS.forEach((c) => assert.ok(lab(c)[0] >= 55, c + ' is too dark to glow'));
});

test('player glow colours are not confusable with a property group colour', () => {
  PLAYERS.forEach((p) => Object.values(GROUPS).forEach((g) => assert.ok(dE(p, g[0]) >= 18, p + ' vs ' + g[0] + ' ' + dE(p, g[0]).toFixed(1))));
});

test('data.js group colours are the palette colours', () => {
  Object.keys(GROUPS).forEach((g) => assert.equal(COLOR_GROUPS[g].color, GROUPS[g][0], g));
});
