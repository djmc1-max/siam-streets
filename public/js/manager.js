// Properties manager (Section 35: Build / Mortgage / Unmortgage, plus selling houses).
// Lists the human's properties by colour group with the cost or refund of every action and, when an
// action is blocked, the reason. Actions go through SiamUI.submit so they run inside the normal turn loop.
(function () {
  const $ = (id) => document.getElementById(id);
  const Rules = window.SiamRules;
  const { fmtBaht } = window.SiamUtil;
  const { BOARD, COLOR_GROUPS } = window.SiamData;

  let openNow = false;

  const engine = () => window.SiamGame.engine;
  const me = () => window.SiamGame.humanId;

  // Reasons that are obvious from the row itself are not worth printing.
  const TRIVIAL = /^(Already mortgaged|Not mortgaged|No houses to sell|Already a hotel|You do not own this|Not a property|Only colour-group properties can be built on)$/;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function actionButton(label, amount, sign, check, action, cls) {
    const b = el('button', 'btn btn-secondary mgr-btn ' + (cls || ''));
    b.type = 'button';
    b.append(el('span', 'mgr-btn-label', label), el('span', 'mgr-btn-amt', sign + fmtBaht(amount)));
    b.disabled = !check.ok || !window.SiamUI.canAct();
    if (!check.ok) b.title = check.reason;
    b.addEventListener('click', () => { window.SiamUI.submit(action); });
    return b;
  }

  function statusText(state, sq) {
    if (Rules.isMortgaged(state, sq.id)) return { text: 'Mortgaged', cls: 'mortgaged' };
    const lvl = Rules.levelOf(state, sq.id);
    if (lvl === Rules.HOTEL) return { text: '🏨 Hotel', cls: 'hotel' };
    if (lvl > 0) return { text: '🏠'.repeat(lvl), cls: 'houses' };
    return { text: 'No houses', cls: 'none' };
  }

  function propertyRow(state, pid, sq) {
    const row = el('div', 'mgr-row');
    const owner = state.owners[sq.id];
    const left = el('div', 'mgr-info');
    left.append(el('div', 'mgr-name', sq.name));

    if (owner !== pid) {
      row.classList.add('mgr-other');
      left.append(el('div', 'mgr-sub', owner === undefined ? 'Unowned' : state.players[owner].name + ' owns this'));
      row.append(left);
      return row;
    }

    const st = statusText(state, sq);
    const rent = Rules.rentFor(state, sq, pid, 7);
    const sub = el('div', 'mgr-sub');
    sub.append(el('span', 'mgr-status ' + st.cls, sq.type === 'property' ? st.text : (Rules.isMortgaged(state, sq.id) ? 'Mortgaged' : '')));
    if (sq.type === 'property') sub.append(el('span', 'mgr-rent', ' · rent ' + fmtBaht(rent)));
    left.append(sub);
    row.append(left);

    const buttons = el('div', 'mgr-btns');
    const whys = [];
    if (sq.type === 'property') {
      const b = Rules.checkBuild(state, pid, sq.id);
      const s = Rules.checkSell(state, pid, sq.id);
      const lvl = Rules.levelOf(state, sq.id);
      buttons.append(actionButton(lvl === 4 ? 'Hotel' : 'Build', lvl >= Rules.MAX_LEVEL ? Rules.buildCost(sq, 4) : Rules.buildCost(sq, lvl), '−', b, { type: 'build', square: sq.id }, 'mgr-build'));
      if (lvl > 0) buttons.append(actionButton('Sell', Rules.sellRefund(sq, lvl), '+', s, { type: 'sell', square: sq.id }, 'mgr-sell'));
      if (!b.ok && Rules.ownsFullGroup(state, pid, sq.group) && !TRIVIAL.test(b.reason)) whys.push(b.reason);
      if (lvl > 0 && !s.ok && !TRIVIAL.test(s.reason)) whys.push(s.reason);
    }
    if (Rules.isMortgaged(state, sq.id)) {
      const u = Rules.checkUnmortgage(state, pid, sq.id);
      buttons.append(actionButton('Unmortgage', Rules.mortgageValue(sq), '−', u, { type: 'unmortgage', square: sq.id }, 'mgr-unmortgage'));
      if (!u.ok && !TRIVIAL.test(u.reason)) whys.push(u.reason);
    } else {
      const m = Rules.checkMortgage(state, pid, sq.id);
      buttons.append(actionButton('Mortgage', Rules.mortgageValue(sq), '+', m, { type: 'mortgage', square: sq.id }, 'mgr-mortgage'));
      if (!m.ok && !TRIVIAL.test(m.reason)) whys.push(m.reason);
    }
    row.append(buttons);
    if (whys.length) row.append(el('div', 'mgr-why', whys[0]));   // the most relevant blocked action explains itself
    return row;
  }

  function section(title, color, note) {
    const s = el('section', 'mgr-group');
    const h = el('div', 'mgr-group-head');
    const sw = el('span', 'mgr-swatch');
    if (color) sw.style.background = color; else sw.hidden = true;
    h.append(sw, el('span', 'mgr-group-name', title));
    if (note) h.append(el('span', 'mgr-group-note', note));
    s.append(h);
    return s;
  }

  function render() {
    const e = engine();
    if (!e) return;
    const state = e.state;
    const pid = me();
    const player = state.players[pid];
    $('manager-cash').textContent = fmtBaht(player.cash);
    const body = $('manager-body');
    body.replaceChildren();

    const mine = Rules.ownedIds(state, pid);
    if (mine.length === 0) {
      body.append(el('p', 'mgr-empty', 'You do not own any properties yet. Land on one and buy it, or trade for one.'));
    }

    // colour groups the player has a stake in
    Object.keys(Rules.GROUP_SQUARES).forEach((group) => {
      const ids = Rules.GROUP_SQUARES[group];
      const have = ids.filter((id) => state.owners[id] === pid).length;
      if (have === 0) return;
      const full = have === ids.length;
      const cost = window.SiamData.BUILD_COST[group];
      const note = full
        ? 'Full set · base rent ×2 · house ' + fmtBaht(cost.house) + ', hotel ' + fmtBaht(cost.hotel)
        : have + ' of ' + ids.length + ' owned — own them all to build';
      const sec = section(COLOR_GROUPS[group].name, COLOR_GROUPS[group].color, note);
      ids.forEach((id) => sec.append(propertyRow(state, pid, BOARD[id - 1])));
      body.append(sec);
    });

    [['airport', 'Airports'], ['utility', 'Thai Massage']].forEach(([type, title]) => {
      const ids = mine.filter((id) => BOARD[id - 1].type === type);
      if (!ids.length) return;
      const sec = section(title, null, null);
      ids.forEach((id) => sec.append(propertyRow(state, pid, BOARD[id - 1])));
      body.append(sec);
    });

    const foot = $('manager-foot');
    foot.replaceChildren();
    if (player.jailCards.length) foot.append(el('span', 'mgr-cards', '🆓 Get Out of Jail Free cards: ' + player.jailCards.length));
    const hint = window.SiamUI.canAct()
      ? 'Mortgage = 50% of the price now, pay the same back to unmortgage. Sell houses for 50% of the build cost.'
      : 'You can change properties on your own turn.';
    foot.append(el('span', 'mgr-hint', hint));
  }

  function open() {
    openNow = true;
    $('manager').hidden = false;
    render();
    $('manager-close').focus({ preventScroll: true });
  }
  function close() {
    openNow = false;
    $('manager').hidden = true;
  }

  function init() {
    $('btn-props').addEventListener('click', open);
    $('manager-close').addEventListener('click', close);
    $('manager').addEventListener('click', (ev) => { if (ev.target === $('manager')) close(); });
    document.addEventListener('keydown', (ev) => { if (openNow && ev.key === 'Escape') close(); });
    window.SiamUI.onChange(() => { if (openNow) render(); });
  }

  window.SiamManager = { init, open, close, render, isOpen: () => openNow };
})();
