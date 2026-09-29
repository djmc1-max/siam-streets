// Synthesised Thai-style intro theme (~8.5s), no asset files.
// Autoplay is attempted on load; browsers usually block it, so it also
// starts on the first pointer/key event. Mute button toggles the master gain.
(function () {
  const THEME_SECONDS = 8.5;

  // Pentatonic scale (D E G A B) in Hz across two octaves — ranat-like bell tones.
  const N = {
    D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88,
    D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0
  };

  // [note, start (s), duration (s)]
  const MELODY = [
    ['D5', 0.0, 0.4], ['E5', 0.4, 0.4], ['G5', 0.8, 0.4], ['A5', 1.2, 0.8],
    ['G5', 2.0, 0.4], ['E5', 2.4, 0.4], ['D5', 2.8, 0.8],
    ['E5', 3.6, 0.4], ['G5', 4.0, 0.4], ['A5', 4.4, 0.4], ['G5', 4.8, 0.4],
    ['E5', 5.2, 0.4], ['D5', 5.6, 0.4], ['B4', 6.0, 0.4], ['A4', 6.4, 0.4],
    ['G4', 6.8, 0.4], ['A4', 7.2, 0.4], ['D5', 7.6, 0.9]
  ];
  const DRONE = [['D4', 0.0, THEME_SECONDS], ['A4', 0.0, THEME_SECONDS]];

  let ctx = null;
  let master = null;
  let started = false;
  let muted = false;

  const btn = document.getElementById('mute-btn');

  function tone(freq, start, dur, type, peak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function playTheme() {
    if (started) return;
    started = true;
    MELODY.forEach(([n, s, d]) => tone(N[n], s, d + 0.5, 'triangle', 0.35));
    DRONE.forEach(([n, s, d]) => tone(N[n] / 2, s, d, 'sine', 0.08));
  }

  function ensureContext() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  }

  function tryStart() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { if (ctx.state === 'running') playTheme(); }).catch(() => {});
    } else {
      playTheme();
    }
  }

  function onFirstGesture() {
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
    tryStart();
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.5;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
    btn.title = muted ? 'Unmute music' : 'Mute music';
  }

  function init() {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMuted(!muted);
      tryStart();
    });
    // Attempt autoplay; fall back to the first user gesture.
    try { tryStart(); } catch (e) { /* ignore */ }
    window.addEventListener('pointerdown', onFirstGesture);
    window.addEventListener('keydown', onFirstGesture);
  }

  window.SiamAudio = { init };
})();
