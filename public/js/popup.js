// Tap a square on the board -> popup (Phase 3.5, item 8).
// Your own property: big Buy House / Sell House / Mortgage / Unmortgage buttons with their prices, so you never
// need the Properties manager just to build or mortgage. Anyone else's or unowned: facts and the rent table.
// Actions go through SiamUI.submit (your own turn only), exactly like the manager.
(function () {
  const $ = (id) => document.getElementById(id);
  const Rules = window.SiamRules;
  const { fmtBaht } = window.SiamUtil;
  const { BOARD, COLOR_GROUPS } = window.SiamData;

  let current = null;   // square id shown, or null

  const engine = () => window.SiamGame.engine;
  const me = () => window.SiamGame.humanId;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function priceText(sq) {
    if (sq.id === 5) return sq.detail;                  // "10% of your cash (max ฿2,000)"
    return sq.detail || (sq.price ? fmtBaht(sq.price) : sq.sub || '');
  }

  function kindText(sq) {
    if (sq.group) return COLOR_GROUPS[sq.group].name;
    return { corner: 'Corner', card: 'Card square', tax: 'Tax', airport: 'Airport', utility: 'Utility' }[sq.type];
  }

  function actionBtn(label, amountText, check, action, cls) {
    const b = el('button', 'btn sqp-btn ' + cls);
    b.type = 'button';
    b.append(el('span', 'sqp-btn-label', label), el('span', 'sqp-btn-amt', amountText));
    b.disabled = !check.ok || !window.SiamUI.canAct();
    b.addEventListener('click', () => { window.SiamUI.submit(action); });
    return b;
  }

  function rentTable(state, sq) {
    const lvl = Rules.levelOf(state, sq.id);
    const owner = state.owners[sq.id];
    const full = owner !== undefined && Rules.ownsFullGroup(state, owner, sq.group);
    const wrap = el('div', 'sqp-rents');
    const names = ['Rent, no houses' + (full ? ' (full set ×2)' : ''), 'Rent, 1 house', 'Rent, 2 houses', 'Rent, 3 houses', 'Rent, 4 houses', 'Rent, hotel'];
    sq.rent.forEach((r, i) => {
      const row = el('div', 'sqp-rent' + (owner !== undefined && i === lvl ? ' now' : ''));
      const shown = i === 0 && full ? r * 2 : r;
      row.append(el('span', null, names[i]), el('span', null, fmtBaht(shown)));
      wrap.append(row);
    });
    return wrap;
  }

  function facts(state, sq) {
    const owner = state.owners[sq.id];
    const rows = [['Purchase price', fmtBaht(sq.price)]];
    if (sq.type === 'property') {
      const cost = window.SiamData.BUILD_COST[sq.group];
      rows.push(['House build cost', fmtBaht(cost.house)], ['Hotel build cost', fmtBaht(cost.hotel)]);
    }
    rows.push(['Mortgage value', fmtBaht(Rules.mortgageValue(sq))]);
    rows.push(['Owner', owner === undefined ? 'Unowned' : (owner === me() ? 'You' : state.players[owner].name)]);
    if (sq.type === 'property') {
      const lvl = Rules.levelOf(state, sq.id);
      rows.push(['Buildings', Rules.isMortgaged(state, sq.id) && owner !== undefined && lvl === 0 ? 'None (mortgaged)' : lvl === 0 ? 'None' : lvl === Rules.HOTEL ? 'Hotel' : lvl + (lvl === 1 ? ' house' : ' houses')]);
    }
    const wrap = el('div', 'sqp-facts');
    rows.forEach(([k, v]) => { const r = el('div', 'sqp-fact'); r.append(el('span', null, k), el('strong', null, v)); wrap.append(r); });
    return wrap;
  }

  function otherRents(sq) {
    const wrap = el('div', 'sqp-rents');
    const add = (k, v) => { const r = el('div', 'sqp-rent'); r.append(el('span', null, k), el('span', null, v)); wrap.append(r); };
    if (sq.type === 'airport') Rules.AIRPORT_RENT.forEach((r, i) => add('Rent with ' + (i + 1) + (i === 0 ? ' airport' : ' airports'), fmtBaht(r)));
    else { add('Rent with 1 Thai Massage', 'Dice roll × 40'); add('Rent with 2 Thai Massages', 'Dice roll × 100'); }
    return wrap;
  }

  function render() {
    const root = $('square-detail');
    if (current === null) { root.hidden = true; return; }
    const sq = BOARD[current - 1];
    const e = engine();
    const state = e ? e.state : null;
    const card = el('div', 'sqp-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', sq.name);
    const head = el('header', 'sqp-head');
    const sqEl = document.querySelector('#board .square[data-id="' + sq.id + '"]');
    if (sqEl) {
      const cs = getComputedStyle(sqEl);
      head.style.setProperty('--a', cs.getPropertyValue('--a'));
      head.style.setProperty('--b', cs.getPropertyValue('--b'));
    }
    const titles = el('div', 'sqp-titles');
    titles.append(el('strong', 'sqp-name', sq.id + '. ' + sq.name), el('span', 'sqp-kind', kindText(sq)));
    const close = el('button', 'icon-btn sqp-close', '✕');
    close.type = 'button'; close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', hide);
    head.append(titles, close);
    card.append(head);

    const body = el('div', 'sqp-body');
    const price = priceText(sq);
    if (price) body.append(el('div', 'sqp-price', price));
    if (sq.sub && !sq.price) body.append(el('div', 'sqp-sub', sq.sub));

    const buyable = sq.type === 'property' || sq.type === 'airport' || sq.type === 'utility';
    if (buyable && state) {
      const owner = state.owners[sq.id];
      const status = el('div', 'sqp-status');
      if (owner === undefined) status.textContent = 'Unowned — land here to buy it';
      else {
        const dot = el('span', 'sqp-dot');
        dot.style.background = window.SiamPalette.playerColor(owner);
        status.append(dot, el('span', null, (owner === me() ? 'You own this' : state.players[owner].name + ' owns this')));
        const lvl = Rules.levelOf(state, sq.id);
        if (Rules.isMortgaged(state, sq.id)) status.append(el('span', 'sqp-tag bad', 'Mortgaged'));
        else if (lvl === Rules.HOTEL) status.append(el('span', 'sqp-tag good', 'Hotel'));
        else if (lvl > 0) status.append(el('span', 'sqp-tag good', lvl + (lvl === 1 ? ' house' : ' houses')));
      }
      body.append(status);
      body.append(sq.type === 'property' ? rentTable(state, sq) : otherRents(sq));
      body.append(facts(state, sq));

      if (owner === me()) {
        const mortgaged = Rules.isMortgaged(state, sq.id);
        const btns = el('div', 'sqp-btns');
        const whys = [];
        const note = (c) => { if (!c.ok && c.reason) whys.push(c.reason); };
        if (sq.type === 'property') {
          const lvl = Rules.levelOf(state, sq.id);
          const b = Rules.checkBuild(state, me(), sq.id);
          const s = Rules.checkSell(state, me(), sq.id);
          const cost = lvl >= Rules.MAX_LEVEL ? Rules.buildCost(sq, 4) : Rules.buildCost(sq, lvl);
          btns.append(actionBtn(lvl === 4 ? 'Buy Hotel' : 'Buy House', '−' + fmtBaht(cost), b, { type: 'build', square: sq.id }, 'sqp-build'));
          btns.append(actionBtn('Sell House', '+' + fmtBaht(lvl > 0 ? Rules.sellRefund(sq, lvl) : Rules.sellRefund(sq, 1)), s, { type: 'sell', square: sq.id }, 'sqp-sell'));
          if (!b.ok && Rules.ownsFullGroup(state, me(), sq.group)) note(b);
          if (lvl > 0) note(s);
        }
        const m = Rules.checkMortgage(state, me(), sq.id);
        const u = Rules.checkUnmortgage(state, me(), sq.id);
        btns.append(actionBtn('Mortgage', '+' + fmtBaht(Rules.mortgageValue(sq)), m, { type: 'mortgage', square: sq.id }, 'sqp-mortgage'));
        btns.append(actionBtn('Unmortgage', '−' + fmtBaht(Rules.mortgageValue(sq)), u, { type: 'unmortgage', square: sq.id }, 'sqp-unmortgage'));
        if (mortgaged) note(u); else if (!m.ok) note(m);
        body.append(btns);
        const hint = el('div', 'sqp-why');
        hint.textContent = window.SiamUI.canAct() ? (whys[0] || '') : 'You can change properties on your own turn.';
        hint.hidden = !hint.textContent;
        body.append(hint);
      }
    }
    card.append(body);
    root.replaceChildren(card);
    root.hidden = false;
  }

  function show(id) { current = id; render(); const c = $('square-detail').querySelector('.sqp-close'); if (c) c.focus({ preventScroll: true }); }
  function hide() { current = null; $('square-detail').hidden = true; }

  function init() {
    const board = $('board');
    board.addEventListener('click', (e) => { const s = e.target.closest('.square'); if (s) show(Number(s.dataset.id)); });
    board.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const s = e.target.closest('.square');
      if (s) { e.preventDefault(); show(Number(s.dataset.id)); }
    });
    $('square-detail').addEventListener('click', (e) => { if (e.target === $('square-detail')) hide(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current !== null) hide(); });
    window.SiamUI.onChange(() => { if (current !== null) render(); });
  }

  window.SiamPopup = { init, show, hide, current: () => current };
})();
