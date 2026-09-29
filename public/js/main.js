(function () {
  const landing = document.getElementById('landing');
  const game = document.getElementById('game');
  const badge = document.getElementById('player-badge');

  function showGame(player) {
    badge.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'badge-icon';
    icon.textContent = player.token.icon;
    const name = document.createElement('span');
    name.textContent = player.name;
    badge.append(icon, name);

    window.SiamBoard.renderBoard();
    landing.hidden = true;
    game.hidden = false;
    window.SiamBoard.fitNames(); // needs the board visible to measure
    window.scrollTo(0, 0);
  }

  const diceEl = document.getElementById('dice');
  [4, 3].forEach((v) => diceEl.appendChild(window.SiamDice.createDie(v)));

  window.SiamAudio.init();
  window.SiamLanding.init(showGame);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (game.hidden) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(window.SiamBoard.fitNames);
  });
})();
