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

    if (sq.group) {
      const strip = document.createElement('div');
      strip.className = 'strip';
      el.appendChild(strip);
    }

    const body = document.createElement('div');
    body.className = 'body';
    if (sq.icon) {
      const icon = document.createElement('div');
      icon.className = 'icon';
      if (window.SiamIcons.isToken(sq.icon)) icon.appendChild(window.SiamIcons.fromToken(sq.icon));
      else icon.textContent = sq.icon;
      body.appendChild(icon);
    }
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = sq.name;
    body.appendChild(name);

    const price = priceLabel(sq);
    if (price) {
      const p = document.createElement('div');
      p.className = 'price';
      p.textContent = price;
      body.appendChild(p);
    } else if (sq.sub) {
      const s = document.createElement('div');
      s.className = 'sub';
      s.textContent = sq.sub;
      body.appendChild(s);
    }
    el.appendChild(body);
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

  function renderLegend() {
    const legend = document.getElementById('legend');
    legend.replaceChildren();
    Object.values(COLOR_GROUPS).forEach((g) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = g.color;
      li.append(sw, document.createTextNode(g.name));
      legend.appendChild(li);
    });
  }

  function renderBoard() {
    const boardEl = document.getElementById('board');
    if (boardEl.querySelector('.square')) return;
    BOARD.forEach((sq) => boardEl.appendChild(buildSquare(sq)));
    renderLegend();
    wireDetail(boardEl);
  }

  // Shrink a square's name just enough that no word is split or clipped.
  // Names are only ever wrapped at spaces (never mid-word), so a word wider than the
  // square shows up as horizontal overflow, which we fit by reducing the font size.
  const MIN_NAME_PX = 6;
  function fitNames() {
    document.querySelectorAll('#board .square .name').forEach((el) => {
      el.classList.remove('clip');
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 0.5 && size > MIN_NAME_PX) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
      // Still too wide at the floor (tiny phones): fall back to an ellipsis; tap shows the full name.
      if (el.scrollWidth > el.clientWidth + 0.5) el.classList.add('clip');
    });
  }

  window.SiamBoard = { renderBoard, fitNames };
})();
