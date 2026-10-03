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

  // ---- game-show sounds (Phase 3.5): crowd applause + camera shutter clicks, all synthesised ----
  const log = [];            // { type, t } — lets tests confirm the sounds were triggered
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function burst(at, dur, freq, q, peak) {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5, dur + 0.02);
  }
  // A crowd: hundreds of tiny claps whose density swells and then fades.
  function applause(seconds) {
    log.push({ type: 'applause', t: Date.now(), seconds });
    if (muted || !ensureContext()) return;
    const clapCount = Math.round(seconds * 70);
    for (let i = 0; i < clapCount; i++) {
      const x = Math.random();
      const at = x * seconds;
      const env = Math.sin(Math.PI * Math.min(1, at / seconds)) ** 0.8;   // swell then fade
      if (Math.random() < env) burst(at, 0.03 + Math.random() * 0.05, 1400 + Math.random() * 2600, 1.2, 0.12 * env);
    }
    burst(0, seconds, 900, 0.5, 0.03);                                      // low roar bed
  }
  function shutter() {
    log.push({ type: 'shutter', t: Date.now() });
    if (muted || !ensureContext()) return;
    burst(0, 0.03, 4200, 3, 0.35);
    burst(0.07, 0.05, 2400, 2, 0.28);
  }

  window.SiamAudio = { init, applause, shutter, log, isMuted: () => muted };
})();
