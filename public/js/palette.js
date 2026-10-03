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
  // [top highlight, bottom depth]
  const GROUPS = {
    red:    ['#d0203a', '#8f0d24'],   // ruby
    orange: ['#c0540a', '#8a3a04'],   // amber
    yellow: ['#977000', '#6e4d00'],   // topaz
    green:  ['#12823f', '#075a2c'],   // emerald
    blue:   ['#2f63e8', '#1a3aa0'],   // sapphire
    purple: ['#9040e0', '#5e21b0'],   // amethyst
    brown:  ['#9a5530', '#5f3018'],   // bronze
    pink:   ['#d01f80', '#8f1058']    // rose
  };
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
  const PLAYERS = ['#00e5ff', '#b8ff2c', '#ff2bd6', '#ffffff', '#ff9d1a', '#c9a8ff'];
  const GOLD = '#f5c542';

  function publish(el) {
    const set = (k, v) => el.style.setProperty(k, v);
    Object.keys(GROUPS).forEach((g) => { set('--g-' + g + '-a', GROUPS[g][0]); set('--g-' + g + '-b', GROUPS[g][1]); });
    Object.keys(TONES).forEach((t) => { set('--t-' + t + '-a', TONES[t][0]); set('--t-' + t + '-b', TONES[t][1]); });
    PLAYERS.forEach((c, i) => set('--p' + i, c));
    set('--gold', GOLD);
  }

  const playerColor = (id) => PLAYERS[id % PLAYERS.length];

  return { GROUPS, TONES, PLAYERS, GOLD, publish, playerColor };
});
