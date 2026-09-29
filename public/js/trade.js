// Trade dialogs (Section 19): compose an offer, review an offer made to you, or negotiate (counter-offer).
// A composed offer goes through SiamUI.submit (your own turn); an incoming offer is answered through
// respond(), which the turn loop awaits.
(function () {
  const $ = (id) => document.getElementById(id);
  const Rules = window.SiamRules;
  const { fmtBaht } = window.SiamUtil;
  const { BOARD, COLOR_GROUPS } = window.SiamData;

  const engine = () => window.SiamGame.engine;
  const me = () => window.SiamGame.humanId;
  const name = (id) => engine().state.players[id].name;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const emptySide = () => ({ props: [], cash: 0, cards: [] });

  // plain-text description of one side of an offer
  function describe(side) {
    const parts = side.props.map((id) => BOARD[id - 1].name);
    if (side.cash) parts.push(fmtBaht(side.cash));
    if (side.cards.length) parts.push(side.cards.length + ' Get Out of Jail Free card' + (side.cards.length > 1 ? 's' : ''));
    return parts.length ? parts.join(' + ') : 'nothing';
  }

  let mode = null;            // 'compose' | 'review'
  let draft = null;           // { partner, give, get, counterOf }
  let pendingReply = null;    // resolve() of respond()

  // ---------- one side of the composer ----------
  function propertyChips(ownerId, side, onChange) {
    const state = engine().state;
    const wrap = el('div', 'trd-chips');
    const ids = Rules.ownedIds(state, ownerId);
    if (!ids.length) wrap.append(el('span', 'trd-none', 'No properties'));
    ids.forEach((id) => {
      const sq = BOARD[id - 1];
      const blocked = sq.group && Rules.groupHasBuildings(state, sq.group);
      const chip = el('button', 'trd-chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(side.props.indexOf(id) !== -1));
      chip.disabled = !!blocked;
      if (blocked) chip.title = 'Sell the houses in this colour group first';
      const dot = el('span', 'trd-dot');
      dot.style.background = sq.group ? COLOR_GROUPS[sq.group].color : '#8fa0c4';
      chip.append(dot, el('span', 'trd-chip-name', sq.name), el('span', 'trd-chip-price', fmtBaht(sq.price)));
      if (Rules.isMortgaged(state, id)) chip.append(el('span', 'trd-tag', 'Mortgaged'));
      chip.addEventListener('click', () => {
        const i = side.props.indexOf(id);
        if (i === -1) side.props.push(id); else side.props.splice(i, 1);
        onChange();
      });
      wrap.append(chip);
    });
    return wrap;
  }

  function sideEditor(title, ownerId, side, onChange) {
    const state = engine().state;
    const owner = state.players[ownerId];
    const box = el('section', 'trd-side');
    box.append(el('h3', null, title));
    box.append(propertyChips(ownerId, side, onChange));

    const cashRow = el('label', 'trd-cash');
    cashRow.append(el('span', null, ownerId === me() ? 'Cash (you have ' + fmtBaht(owner.cash) + ')' : 'Cash (' + owner.name + ' has ' + fmtBaht(owner.cash) + ')'));
    const input = el('input');
    input.type = 'number'; input.inputMode = 'numeric'; input.min = 0; input.max = owner.cash; input.step = 50;
    input.placeholder = '฿0';
    input.value = side.cash ? side.cash : '';
    input.addEventListener('input', () => { side.cash = Math.max(0, Math.floor(Number(input.value) || 0)); onChange(true); });
    cashRow.append(input);
    box.append(cashRow);

    if (owner.jailCards.length) {
      const cardsRow = el('label', 'trd-cash');
      cardsRow.append(el('span', null, '🆓 Get Out of Jail Free cards'));
      const sel = el('select');
      for (let n = 0; n <= owner.jailCards.length; n++) { const o = el('option', null, String(n)); o.value = n; sel.append(o); }
      sel.value = side.cards.length;
      sel.addEventListener('change', () => { side.cards = owner.jailCards.slice(0, Number(sel.value)); onChange(); });
      cardsRow.append(sel);
      box.append(cardsRow);
    }
    return box;
  }

  // ---------- compose ----------
  function renderCompose() {
    const state = engine().state;
    const body = $('trade-body'), foot = $('trade-foot');
    body.replaceChildren(); foot.replaceChildren();
    const counter = !!draft.counterOf;
    $('trade-title').textContent = counter ? 'Counter-offer to ' + name(draft.partner) : 'Trade';
    $('trade-close').hidden = counter;      // a counter-offer is answered, not abandoned (Back returns to the offer)

    if (!counter) {
      const pick = el('label', 'trd-partner');
      pick.append(el('span', null, 'Trade with'));
      const sel = el('select', null);
      state.players.forEach((p) => {
        if (p.id === me() || p.bankrupt) return;
        const o = el('option', null, p.name); o.value = p.id; sel.append(o);
      });
      sel.value = draft.partner;
      sel.addEventListener('change', () => { draft.partner = Number(sel.value); draft.get = emptySide(); render(); });
      pick.append(sel);
      body.append(pick);
    } else {
      body.append(el('p', 'trd-note', name(draft.partner) + ' offered: they give ' + describe(draft.counterOf.give) + ', and want ' + describe(draft.counterOf.get) + '. Change the terms below.'));
    }

    const cols = el('div', 'trd-cols');
    const refresh = (keepFocus) => { if (keepFocus) updateStatus(); else render(); };
    cols.append(sideEditor('You give', me(), draft.give, refresh));
    cols.append(sideEditor('You get from ' + name(draft.partner), draft.partner, draft.get, refresh));
    body.append(cols);

    const status = el('div', 'trd-status');
    status.id = 'trade-status';
    body.append(status);

    const cancel = el('button', 'btn btn-secondary', counter ? 'Back' : 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => { if (counter) { mode = 'review'; render(); } else close(); });
    const send = el('button', 'btn btn-primary', counter ? 'Send counter-offer' : 'Send offer');
    send.type = 'button'; send.id = 'trade-send';
    send.addEventListener('click', () => {
      const offer = { give: draft.give, get: draft.get };
      if (counter) {
        const done = pendingReply; pendingReply = null;
        close();
        done({ type: 'tradeReply', reply: { counter: offer } });
      } else if (window.SiamUI.submit({ type: 'trade', to: draft.partner, give: offer.give, get: offer.get })) {
        close();
      }
    });
    foot.append(cancel, send);
    updateStatus();

    function updateStatus() {
      const c = counter
        ? Rules.checkTrade(state, me(), draft.partner, draft.give, draft.get)
        : Rules.checkTrade(state, me(), draft.partner, draft.give, draft.get);
      status.textContent = c.ok ? 'Summary: you give ' + describe(draft.give) + ' and get ' + describe(draft.get) + '.' : c.reason;
      status.classList.toggle('bad', !c.ok);
      send.disabled = !c.ok || (!counter && !window.SiamUI.canAct());
      if (!counter && !window.SiamUI.canAct()) status.textContent = 'You can propose trades on your own turn.';
    }
  }

  // ---------- review an offer made to you ----------
  function renderReview() {
    const t = draft.trade;
    const body = $('trade-body'), foot = $('trade-foot');
    body.replaceChildren(); foot.replaceChildren();
    $('trade-title').textContent = (t.round > 1 ? 'Counter-offer from ' : 'Offer from ') + name(t.from);
    $('trade-close').hidden = true;

    const cols = el('div', 'trd-cols');
    [['They give you', t.give], ['They want from you', t.get]].forEach(([title, side]) => {
      const box = el('section', 'trd-side');
      box.append(el('h3', null, title));
      const list = el('div', 'trd-summary');
      side.props.forEach((id) => {
        const sq = BOARD[id - 1];
        const row = el('div', 'trd-sum-row');
        const dot = el('span', 'trd-dot'); dot.style.background = sq.group ? COLOR_GROUPS[sq.group].color : '#8fa0c4';
        row.append(dot, el('span', null, sq.name + ' (' + fmtBaht(sq.price) + ')' + (Rules.isMortgaged(engine().state, id) ? ' · mortgaged' : '')));
        list.append(row);
      });
      if (side.cash) list.append(el('div', 'trd-sum-row', fmtBaht(side.cash)));
      if (side.cards.length) list.append(el('div', 'trd-sum-row', '🆓 ' + side.cards.length + ' Get Out of Jail Free card' + (side.cards.length > 1 ? 's' : '')));
      if (!list.children.length) list.append(el('div', 'trd-sum-row trd-none', 'Nothing'));
      box.append(list);
      cols.append(box);
    });
    body.append(cols);

    const check = Rules.checkTrade(engine().state, t.from, t.to, t.give, t.get);
    const status = el('div', 'trd-status' + (check.ok ? '' : ' bad'), check.ok ? 'Accept, decline, or negotiate a different deal.' : check.reason);
    body.append(status);

    const answer = (reply) => { const done = pendingReply; pendingReply = null; close(); done({ type: 'tradeReply', reply }); };
    const decline = el('button', 'btn btn-secondary', 'Decline'); decline.type = 'button'; decline.id = 'trade-decline';
    decline.addEventListener('click', () => answer('decline'));
    const negotiate = el('button', 'btn btn-secondary', 'Negotiate'); negotiate.type = 'button'; negotiate.id = 'trade-negotiate';
    negotiate.addEventListener('click', () => {
      // start from the reverse of their offer: I give what they asked for, I get what they offered
      draft = { partner: t.from, give: JSON.parse(JSON.stringify(t.get)), get: JSON.parse(JSON.stringify(t.give)), counterOf: t, trade: t };
      mode = 'compose';
      render();
    });
    const accept = el('button', 'btn btn-primary', 'Accept'); accept.type = 'button'; accept.id = 'trade-accept';
    accept.disabled = !check.ok;
    accept.addEventListener('click', () => answer('accept'));
    foot.append(decline, negotiate, accept);
  }

  function render() { if (mode === 'compose') renderCompose(); else renderReview(); }

  function show() { $('trade').hidden = false; }
  function close() { $('trade').hidden = true; mode = null; }

  // Composer, opened from the Trade button.
  function open() {
    const state = engine().state;
    const first = state.players.find((p) => p.id !== me() && !p.bankrupt);
    if (!first) return;
    draft = { partner: first.id, give: emptySide(), get: emptySide(), counterOf: null };
    mode = 'compose';
    render(); show();
  }

  // An offer made to the human: resolves with { type: 'tradeReply', reply }.
  function respond(trade) {
    draft = { trade };
    mode = 'review';
    render(); show();
    return new Promise((resolve) => { pendingReply = resolve; });
  }

  function init() {
    $('btn-trade').addEventListener('click', open);
    $('trade-close').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode === 'compose' && !draft.counterOf) close(); });
    // the Trade button is live only when the loop is waiting for you and a trade is allowed
    window.SiamUI.onChange(() => {
      const e = engine();
      const ok = !!e && window.SiamUI.canAct() && e.availableActions().canTrade;
      $('btn-trade').disabled = !ok;
      if (mode === 'compose' && !draft.counterOf) render();
    });
  }

  window.SiamTrade = { init, open, respond, describe };
})();
