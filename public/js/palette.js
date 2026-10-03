// Single source of colour for the board: jewel colours per property group, tones for the other squares,
// and one glow colour per player seat. In the browser it also publishes them as CSS variables
// (--g-<group>-a/-b, --t-<tone>-a/-b, --p0..--p5) so style sheets never repeat a hex value.
// Tests (tests/palette.test.js) check white-on-colour contrast and that the colours stay distinct.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SiamPalette = api;
    api.publish(document.documentElement);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // [bright strip colour, deep shade]. The bright colour is the strip across the top of a property square (the
  // square itself is dark navy); the deep shade carries white text in popups and the auction card.
  const GROUPS = {
    red:    ['#ff3b4e', '#8f0d24'],
    orange: ['#ff8c1a', '#8a3a04'],
    yellow: ['#ffd426', '#6e4d00'],
    green:  ['#28d27a', '#075a2c'],
    blue:   ['#3b82ff', '#1a3aa0'],
    purple: ['#b266ff', '#5e21b0'],
    brown:  ['#cf8a4a', '#5f3018'],
    pink:   ['#ff58b4', '#8f1058']
  };
  const PROPERTY_FACE = ['#10223a', '#0a1524'];   // dark navy behind every property name
  // Squares that are not property groups.
  const TONES = {
    airport:  ['#2b7a8c', '#124857'],
    utility:  ['#12796f', '#07524b'],
    tax:      ['#a3243a', '#3e1420'],
    surprise: ['#5a3fd0', '#2a1a78'],
    treasure: ['#9c6412', '#5e3a08'],
    start:    ['#12823f', '#064a25'],
    prison:   ['#b85808', '#7a3304'],
    songkran: ['#1a6fd0', '#0a3f94'],
    police:   ['#c01c2c', '#17338f']
  };
  // Glow colour per player seat (cyan, lime, magenta, white, solar orange, violet).
  const PLAYERS = ['#00e5ff', '#b8ff2c', '#ff2bd6', '#ffffff', '#ff8f8f', '#c9a8ff'];
  const GOLD = '#f5c542';

  function publish(el) {
    const set = (k, v) => el.style.setProperty(k, v);
    Object.keys(GROUPS).forEach((g) => { set('--g-' + g + '-a', GROUPS[g][0]); set('--g-' + g + '-b', GROUPS[g][1]); });
    Object.keys(TONES).forEach((t) => { set('--t-' + t + '-a', TONES[t][0]); set('--t-' + t + '-b', TONES[t][1]); });
    PLAYERS.forEach((c, i) => set('--p' + i, c));
    set('--gold', GOLD);
    set('--prop-a', PROPERTY_FACE[0]); set('--prop-b', PROPERTY_FACE[1]);
  }

  const playerColor = (id) => PLAYERS[id % PLAYERS.length];

  return { GROUPS, TONES, PLAYERS, GOLD, PROPERTY_FACE, publish, playerColor };
});
