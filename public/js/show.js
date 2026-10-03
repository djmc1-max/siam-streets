// The game-show start: when the host presses Start game the crowd cheers and camera flashes pop around the
// screen as the live board takes over. Nothing plays on the landing / name screen.
// Photosensitivity: flashes are small and soft (never full-screen), at most 3 per second (we keep to ~2),
// and `prefers-reduced-motion` gets a calm golden fade with no flashes.
(function () {
  const DURATION_MS = 2800;
  const MIN_GAP_MS = 380;      // >= 380ms apart is at most 2.6 flashes per second
  const MAX_SIZE = 170;        // px; a flash covers a few percent of the screen at most
  const log = { flashes: [], reduced: false, runs: 0 };

  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function flashAt(layer) {
    const size = 90 + Math.random() * (MAX_SIZE - 90);
    const el = document.createElement('div');
    el.className = 'cam-flash';
    el.style.width = el.style.height = size + 'px';
    el.style.left = (Math.random() * (innerWidth - size)) + 'px';
    el.style.top = (Math.random() * (innerHeight - size)) + 'px';
    layer.appendChild(el);
    log.flashes.push({ t: performance.now(), size });
    window.SiamAudio.shutter();
    setTimeout(() => el.remove(), 500);
  }

  async function play() {
    const { sleep } = window.SiamUtil;
    const speed = window.SiamUtil.speed || 1;
    const layer = document.getElementById('show');
    log.runs++;
    log.flashes = [];
    log.reduced = reduced();
    window.SiamAudio.applause(3.2);
    const end = performance.now() + DURATION_MS / speed;
    if (!log.reduced) {
      while (performance.now() < end) {
        flashAt(layer);
        await sleep(MIN_GAP_MS + Math.random() * 320);
      }
    } else {
      await sleep(DURATION_MS);
    }
  }

  window.SiamShow = { play, log, DURATION_MS };
})();
