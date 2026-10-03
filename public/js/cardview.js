// Card reveal (Sections 20/21). The human's card waits for a tap; a bot's card continues on its own.
(function () {
  const $ = (id) => document.getElementById(id);
  const AUTO_MS = 4500;   // bots' cards stay up 2 s longer than before so the card can be read before its effect

  const DECKS = {
    surprise: { title: 'Surprise', icon: () => { const s = document.createElement('span'); s.className = 'card-q'; s.textContent = '❓'; return s; } },
    treasure: { title: 'Treasure', icon: () => window.SiamIcons.el('chest') }
  };

  // Resolves once the card has been dismissed (tap / OK / Enter) or, for bots, after a short pause.
  function show({ deck, text, playerName, waitForTap }) {
    const overlay = $('card-overlay');
    if (window.SiamPopup) window.SiamPopup.hide();
    const face = $('card-face');
    const meta = DECKS[deck];
    face.className = 'card-face card-' + deck;
    $('card-icon').replaceChildren(meta.icon());
    $('card-deck').textContent = meta.title;
    $('card-who').textContent = playerName + ' drew:';
    $('card-text').textContent = text;
    const ok = $('card-ok');
    ok.hidden = !waitForTap;
    $('card-timer').hidden = waitForTap;
    overlay.hidden = false;
    // restart the flip-in and the countdown bar
    face.style.animation = 'none'; void face.offsetWidth; face.style.animation = '';
    const bar = $('card-timer-bar');
    bar.style.animation = 'none'; void bar.offsetWidth;
    bar.style.animation = waitForTap ? 'none' : 'card-count ' + (AUTO_MS / window.SiamUtil.speed) + 'ms linear forwards';

    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        overlay.hidden = true;
        overlay.removeEventListener('click', finish);
        document.removeEventListener('keydown', onKey);
        resolve();
      };
      const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); finish(); } };
      overlay.addEventListener('click', finish);
      document.addEventListener('keydown', onKey);
      if (waitForTap) ok.focus({ preventScroll: true });
      else timer = setTimeout(finish, AUTO_MS / window.SiamUtil.speed);
    });
  }

  window.SiamCardView = { show };
})();
