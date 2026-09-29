// Landing / onboarding screen (GAME_DESIGN.md section 39).
// State is held in memory only — no localStorage/sessionStorage (section 38, note 4).
(function () {
  const { TOKENS } = window.SiamData;

  const player = { name: '', tokenId: null };

  const nameInput = document.getElementById('name-input');
  const tokenGrid = document.getElementById('token-grid');
  const continueBtn = document.getElementById('continue-btn');

  function isValid() {
    return player.name.trim().length >= 1 && player.tokenId !== null;
  }

  function refresh() {
    continueBtn.disabled = !isValid();
    tokenGrid.querySelectorAll('.token').forEach((btn) => {
      btn.setAttribute('aria-checked', String(btn.dataset.id === player.tokenId));
    });
  }

  function renderTokens() {
    TOKENS.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'token' + (t.free ? '' : ' locked');
      btn.dataset.id = t.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('aria-label', t.free ? t.name : t.name + ' (locked, ' + t.coins + ' coins)');
      if (!t.free) {
        btn.setAttribute('aria-disabled', 'true');
        btn.title = 'Unlock for ' + t.coins + ' coins';
      }

      const icon = document.createElement('span');
      icon.className = 'token-icon';
      icon.textContent = t.icon;
      const name = document.createElement('span');
      name.className = 'token-name';
      name.textContent = t.free ? t.name : t.coins + ' coins';
      btn.append(icon, name);

      if (!t.free) {
        const lock = document.createElement('span');
        lock.className = 'lock';
        lock.textContent = '🔒';
        btn.appendChild(lock);
      }

      btn.addEventListener('click', () => {
        if (!t.free) return; // premium tokens are shown but locked
        player.tokenId = t.id;
        refresh();
      });
      tokenGrid.appendChild(btn);
    });
  }

  function init(onContinue) {
    renderTokens();
    nameInput.addEventListener('input', () => {
      player.name = nameInput.value;
      refresh();
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && isValid()) continueBtn.click();
    });
    continueBtn.addEventListener('click', () => {
      if (!isValid()) return;
      onContinue({
        name: player.name.trim(),
        token: TOKENS.find((t) => t.id === player.tokenId)
      });
    });
    refresh();
  }

  window.SiamLanding = { init };
})();
