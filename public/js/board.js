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
    // name + price/sub live in one .label so phones can rotate them together (display: contents elsewhere)
    const label = document.createElement('div');
    label.className = 'label';
    const name = document.createElement('div');
    name.className = 'name';
    // one long single word may break in the middle on a narrow phone
    const BREAKS = { Suvarnabhumi: ['Suvarna', 'bhumi'], Sukhumvit: ['Sukhum', 'vit'] };
    const parts = BREAKS[sq.name] || [sq.name];
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
    if (sq.id === 21) {                       // Songkran shows the live pot under "Collect the pot"
      const pot = document.createElement('div');
      pot.className = 'pot';
      pot.textContent = baht(0);
      label.appendChild(pot);
    }
    body.appendChild(label);
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

  // Shrink a square's text just enough that no word is split or clipped.
  // Desktop / tablet: the name alone is fitted (names only wrap at spaces, so a too-long word shows up as
  // horizontal overflow). Phones: the whole label (name + price) is fitted on both axes, because the labels on
  // the top and bottom rows are rotated and run along the depth of the square.
  const MIN_NAME_PX = 6;
  const MIN_PHONE_PX = 7;
  const overflows = (el) => el.scrollWidth > el.clientWidth + 0.6 || el.scrollHeight > el.clientHeight + 0.6;
  function fitNames() {
    const phone = window.matchMedia && window.matchMedia('(max-width: 600px)').matches;
    document.querySelectorAll('#board .square').forEach((sq) => {
      const name = sq.querySelector('.name');
      const label = sq.querySelector('.label');
      name.classList.remove('clip');
      name.style.fontSize = '';
      label.style.fontSize = '';
      if (!phone) {
        let size = parseFloat(getComputedStyle(name).fontSize);
        while (name.scrollWidth > name.clientWidth + 0.5 && size > MIN_NAME_PX) {
          size -= 0.5;
          name.style.fontSize = size + 'px';
        }
        if (name.scrollWidth > name.clientWidth + 0.5) name.classList.add('clip');   // tap shows the full name
        return;
      }
      const bad = () => overflows(label) || Array.from(label.children).some(overflows);
      let size = parseFloat(getComputedStyle(label).fontSize);
      while (bad() && size > MIN_PHONE_PX) {
        size -= 0.25;
        label.style.fontSize = size + 'px';
      }
      if (bad()) name.classList.add('clip');
    });
  }

  function setPot(amount) {
    const el = document.querySelector('#board .square[data-id="21"] .pot');
    if (!el) return;
    const text = baht(amount);
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }

  window.SiamBoard = { renderBoard, fitNames, setPot };
})();
