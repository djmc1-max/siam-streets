// Renders the 40-square board (GAME_DESIGN.md sections 3-5).
(function () {
  const { BOARD, COLOR_GROUPS } = window.SiamData;

  const baht = (n) => window.SiamUtil.fmtBaht(n);

  // Board runs clockwise from the top-left corner (square 1) on an 11x11 grid.
  function placement(id) {
    if (id <= 11) return { row: 1, col: id, side: 'top' };
    if (id <= 21) return { row: id - 10, col: 11, side: 'right' };
    if (id <= 31) return { row: 11, col: 32 - id, side: 'bottom' };
    return { row: 42 - id, col: 1, side: 'left' };
  }

  function isCorner(sq) { return sq.type === 'corner'; }

  function priceLabel(sq) {
    if (sq.id === 5) return '10%'; // the amount (lesser of 10% or ฿2,000) is worked out at landing and shown in the feed
    if (sq.price) return baht(sq.price);
    return '';
  }

  // Which artwork / tone each non-property square gets.
  const CORNER_ART = { 1: ['art-start', 'start'], 11: ['art-prison', 'prison'], 21: ['art-songkran', 'songkran'], 31: ['art-police', 'police'] };
  function iconFor(sq) {
    if (sq.type === 'airport') return 'icon-plane';
    if (sq.type === 'utility') return 'icon-lotus';
    if (sq.type === 'tax') return sq.id === 5 ? 'icon-coin' : 'icon-gem';
    if (sq.type === 'card') return sq.name === 'Surprise' ? 'icon-star' : 'icon-chest';
    return null;
  }
  function toneFor(sq) {
    if (sq.type === 'card') return sq.name === 'Surprise' ? 'surprise' : 'treasure';
    return sq.type; // airport | utility | tax
  }

  function buildSquare(sq) {
    const pos = placement(sq.id);
    const el = document.createElement('div');
    el.className = 'square ' + sq.type + ' side-' + pos.side + (isCorner(sq) ? ' corner' : '');
    el.dataset.id = sq.id;
    el.dataset.type = sq.type;
    if (sq.group) el.dataset.group = sq.group;
    el.style.gridRow = pos.row;
    el.style.gridColumn = pos.col;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', sq.name + (sq.price ? ', ' + baht(sq.price) : ''));

    const face = document.createElement('div');
    face.className = 'face';
    let tone;
    if (isCorner(sq)) {
      const [art, t] = CORNER_ART[sq.id];
      tone = t;
      face.appendChild(window.SiamArt.use(art, 'corner-art'));
    } else if (sq.group) {
      tone = null;
    } else {
      tone = toneFor(sq);
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.appendChild(window.SiamArt.use(iconFor(sq), 'sq-icon'));
      face.appendChild(icon);
    }
    if (tone) el.dataset.tone = tone;

    const label = document.createElement('div');
    label.className = 'label';
    const name = document.createElement('div');
    name.className = 'name';
    // one long single word (Suvarnabhumi) may break in the middle when the square is narrow
    const parts = sq.name === 'Suvarnabhumi' ? ['Suvarna', 'bhumi'] : [sq.name];
    parts.forEach((part, i) => { if (i) name.appendChild(document.createElement('wbr')); name.appendChild(document.createTextNode(part)); });
    label.appendChild(name);
    const price = priceLabel(sq);
    if (price) {
      const p = document.createElement('div');
      p.className = 'price';
      p.textContent = price;
      label.appendChild(p);
    } else if (sq.sub) {
      const s = document.createElement('div');
      s.className = 'sub';
      s.textContent = sq.sub;
      label.appendChild(s);
    }
    face.appendChild(label);

    if (sq.group) {
      const bldg = document.createElement('div');
      bldg.className = 'bldg';
      face.appendChild(bldg);
    }
    el.appendChild(face);
    return el;
  }

  function detailText(sq) {
    const parts = [];
    if (sq.group) parts.push(COLOR_GROUPS[sq.group].name);
    else parts.push({ corner: 'Corner', card: 'Card', tax: 'Tax', airport: 'Airport', utility: 'Utility' }[sq.type]);
    const price = sq.detail || priceLabel(sq);
    if (price) parts.push(price);
    else if (sq.sub) parts.push(sq.sub);
    return parts.join(' · ');
  }

  function wireDetail(boardEl) {
    const detail = document.getElementById('square-detail');
    let timer;
    function show(sq) {
      detail.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = sq.id + '. ' + sq.name;
      const span = document.createElement('span');
      span.textContent = detailText(sq);
      detail.append(strong, span);
      detail.style.setProperty('--detail-color', sq.group ? COLOR_GROUPS[sq.group].color : 'var(--line)');
      detail.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { detail.hidden = true; }, 3500);
    }
    boardEl.addEventListener('click', (e) => {
      const sqEl = e.target.closest('.square');
      if (sqEl) show(BOARD[Number(sqEl.dataset.id) - 1]);
    });
    boardEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const sqEl = e.target.closest('.square');
      if (sqEl) { e.preventDefault(); show(BOARD[Number(sqEl.dataset.id) - 1]); }
    });
  }

  function renderBoard() {
    const boardEl = document.getElementById('board');
    if (boardEl.querySelector('.square')) return;
    BOARD.forEach((sq) => boardEl.appendChild(buildSquare(sq)));
    wireDetail(boardEl);
  }

  // Shrink each square's label just enough that the name and price sit fully inside it. Names only wrap
  // at spaces (never mid-word); a word that is too long shows up as overflow, which is fixed by a
  // smaller font. Works for horizontal and rotated (vertical) labels because it checks both axes.
  const MIN_PX = 7;
  const overflows = (label) => {
    const kids = label.children;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (k.scrollWidth > k.clientWidth + 0.6 || k.scrollHeight > k.clientHeight + 0.6) return true;
    }
    return label.scrollWidth > label.clientWidth + 0.6 || label.scrollHeight > label.clientHeight + 0.6;
  };
  function fitNames() {
    document.querySelectorAll('#board .square .label').forEach((label) => {
      label.style.fontSize = '';
      label.classList.remove('clip');
      let size = parseFloat(getComputedStyle(label).fontSize);
      while (overflows(label) && size > MIN_PX) {
        size -= 0.25;
        label.style.fontSize = size + 'px';
      }
      if (overflows(label)) label.classList.add('clip'); // last resort on tiny screens; tapping a square shows the full text
    });
  }

  window.SiamBoard = { renderBoard, fitNames };
})();
