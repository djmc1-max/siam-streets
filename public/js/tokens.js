// Player pieces on the board. Positioned in % of the board so they stay put on resize,
// and moved one square at a time.
(function () {
  const STEP_MS = 220;
  const COLORS = window.SiamPalette.PLAYERS;
  // offsets (in --u units) so pieces sharing a square do not hide each other
  const SPREAD = [[0, 0], [-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7], [0, 0]];

  const pieces = {};   // playerId -> { el, square }
  let squareEls = null;

  const layer = () => document.getElementById('token-layer');
  const board = () => document.getElementById('board');

  function squareEl(id) {
    if (!squareEls) {
      squareEls = {};
      board().querySelectorAll('.square').forEach((s) => { squareEls[s.dataset.id] = s; });
    }
    return squareEls[id];
  }

  function place(piece, squareId) {
    const sq = squareEl(squareId);
    const b = board();
    piece.el.style.left = ((sq.offsetLeft + sq.offsetWidth / 2) / b.clientWidth * 100) + '%';
    piece.el.style.top = ((sq.offsetTop + sq.offsetHeight / 2) / b.clientHeight * 100) + '%';
    piece.square = squareId;
  }

  // Spread pieces that share a square.
  function spread() {
    const groups = {};
    Object.keys(pieces).forEach((id) => {
      const p = pieces[id];
      (groups[p.square] = groups[p.square] || []).push(p);
    });
    Object.keys(groups).forEach((sq) => {
      const g = groups[sq];
      g.forEach((p, i) => {
        const off = g.length === 1 ? [0, 0] : SPREAD[(i % 4) + 1];
        p.el.style.setProperty('--dx', off[0]);
        p.el.style.setProperty('--dy', off[1]);
      });
    });
  }

  function init(players) {
    reset();
    players.forEach((pl) => {
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.player = pl.id;
      el.style.setProperty('--ring', COLORS[pl.id % COLORS.length]);
      el.textContent = pl.icon;
      el.title = pl.name;
      layer().appendChild(el);
      pieces[pl.id] = { el, square: 1 };
      place(pieces[pl.id], 1);
    });
    spread();
  }

  function reset() {
    Object.keys(pieces).forEach((id) => delete pieces[id]);
    squareEls = null;
    layer().replaceChildren();
  }

  async function moveAlong(playerId, path) {
    const piece = pieces[playerId];
    if (!piece) return;
    for (const sq of path) {
      place(piece, sq);
      piece.el.classList.remove('hop');
      void piece.el.offsetWidth; // restart the hop animation
      piece.el.classList.add('hop');
      await window.SiamUtil.sleep(STEP_MS);
    }
    spread();
  }

  async function jumpTo(playerId, squareId) {
    const piece = pieces[playerId];
    if (!piece) return;
    place(piece, squareId);
    spread();
    await window.SiamUtil.sleep(STEP_MS * 2);
  }

  function setJailed(playerId, jailed) {
    if (pieces[playerId]) pieces[playerId].el.classList.toggle('jailed', jailed);
  }

  function remove(playerId) {
    const piece = pieces[playerId];
    if (!piece) return;
    piece.el.classList.add('gone');
    delete pieces[playerId];
    spread();
  }

  function squareOf(playerId) { return pieces[playerId] ? pieces[playerId].square : null; }

  window.SiamTokens = { init, reset, moveAlong, jumpTo, setJailed, remove, squareOf, COLORS };
})();
