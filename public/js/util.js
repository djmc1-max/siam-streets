// Small shared helpers. Loadable in the browser and in Node.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiamUtil = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // The one place money is formatted: always Thai Baht, never $ (GAME_DESIGN.md section 38, note 7).
  function fmtBaht(n) {
    return '฿' + Math.round(n).toLocaleString('en-US');
  }

  const api = {
    fmtBaht,
    // Divides every animation/thinking delay; tests raise it to run whole games quickly.
    speed: 1,
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms / api.speed));
    },
    // Uniform [0,1) from the platform CSPRNG when available.
    randomFloat() {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return a[0] / 4294967296;
      }
      return Math.random();
    }
  };
  return api;
});
