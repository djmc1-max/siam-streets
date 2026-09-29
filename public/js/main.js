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
    window.scrollTo(0, 0);
  }

  window.SiamAudio.init();
  window.SiamLanding.init(showGame);
})();
