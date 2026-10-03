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
  const iconOf = (id) => window.SiamData.TOKENS.find((t) => t.id === engine().state.players[id].tokenId).icon;
  const colourOf = (id) => window.SiamPalette.playerColor(id);
  function avatar(id, cls) {
    const a = el('span', 'trd-avatar ' + (cls || ''), iconOf(id));
    a.style.setProperty('--ring', colourOf(id));
    return a;
  }

  // plain-text description of one side of an offer
  function describe(side) {
    side = side || emptySide();
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

  function stepper(label, value, min, max, step, onSet) {
    const row = el('div', 'trd-step');
    row.append(el('span', 'trd-step-label', label));
    const ctl = el('div', 'trd-step-ctl');
    const minus = el('button', 'trd-step-btn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Less');
    const plus = el('button', 'trd-step-btn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'More');
    const input = el('input');
    input.type = 'number'; input.inputMode = 'numeric'; input.min = min; input.max = max; input.step = step;
    input.placeholder = '0';
    input.value = value ? value : '';
    const set = (v, keepFocus) => { onSet(Math.max(min, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(v || 0))), keepFocus); };
    input.addEventListener('input', () => set(Number(input.value), true));
    minus.addEventListener('click', () => set((Number(input.value) || 0) - step));
    plus.addEventListener('click', () => set((Number(input.value) || 0) + step));
    ctl.append(minus, input, plus);
    row.append(ctl);
    return { row, input };
  }

  function sideEditor(title, kind, ownerId, side, onChange) {
    const state = engine().state;
    const owner = state.players[ownerId];
    const box = el('section', 'trd-side trd-' + kind);
    const h = el('h3', 'trd-side-title');
    h.append(avatar(ownerId, 'small'), el('span', null, title));
    box.append(h);
    box.append(propertyChips(ownerId, side, onChange));

    const cash = stepper(ownerId === me() ? 'Cash (you have ' + fmtBaht(owner.cash) + ')' : 'Cash (' + owner.name + ' has ' + fmtBaht(owner.cash) + ')',
      side.cash, 0, owner.cash, 100, (v, keep) => { side.cash = v; onChange(keep); });
    box.append(cash.row);

    if (owner.jailCards.length) {
      const cards = stepper('🆓 Get Out of Jail Free cards', side.cards.length, 0, owner.jailCards.length, 1,
        (v) => { side.cards = owner.jailCards.slice(0, Math.min(v, owner.jailCards.length)); onChange(); });
      cards.input.max = owner.jailCards.length;
      box.append(cards.row);
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
      body.append(el('h3', 'trd-pick-title', 'Who do you want to trade with?'));
      const tiles = el('div', 'trd-tiles');
      state.players.forEach((p) => {
        if (p.id === me() || p.bankrupt) return;
        const t = el('button', 'trd-tile');
        t.type = 'button'; t.dataset.player = p.id;
        t.setAttribute('aria-pressed', String(draft.partner === p.id));
        const info = el('span', 'trd-tile-info');
        info.append(el('span', 'trd-tile-name', p.name), el('span', 'trd-tile-cash', fmtBaht(p.cash)));
        t.append(avatar(p.id), info);
        t.addEventListener('click', () => { draft.partner = p.id; draft.get = emptySide(); render(); });
        tiles.append(t);
      });
      body.append(tiles);
    } else {
      body.append(el('p', 'trd-note', name(draft.partner) + ' offered: they give ' + describe(draft.counterOf.give) + ', and want ' + describe(draft.counterOf.get) + '. Change the terms below.'));
    }

    const cols = el('div', 'trd-cols');
    const refresh = (keepFocus) => { if (keepFocus) updateStatus(); else render(); };
    cols.append(sideEditor('You offer', 'offer', me(), draft.give, refresh));
    cols.append(sideEditor('You ask for', 'ask', draft.partner, draft.get, refresh));
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
    [['They are offering', t.give, 'offer'], ['They are asking for', t.get, 'ask']].forEach(([title, side, kind]) => {
      const box = el('section', 'trd-side trd-' + kind);
      const h = el('h3', 'trd-side-title'); h.append(avatar(kind === 'offer' ? t.from : t.to, 'small'), el('span', null, title)); box.append(h);
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
    const decline = el('button', 'btn btn-secondary trd-big', 'Decline'); decline.type = 'button'; decline.id = 'trade-decline';
    decline.addEventListener('click', () => answer('decline'));
    const negotiate = el('button', 'btn btn-secondary trd-big trd-neg', 'Negotiate'); negotiate.type = 'button'; negotiate.id = 'trade-negotiate';
    negotiate.addEventListener('click', () => {
      // start from the reverse of their offer: I give what they asked for, I get what they offered
      draft = { partner: t.from, give: JSON.parse(JSON.stringify(t.get)), get: JSON.parse(JSON.stringify(t.give)), counterOf: t, trade: t };
      mode = 'compose';
      render();
    });
    const accept = el('button', 'btn btn-primary trd-big trd-acc', 'Accept'); accept.type = 'button'; accept.id = 'trade-accept';
    accept.disabled = !check.ok;
    accept.addEventListener('click', () => answer('accept'));
    foot.append(decline, negotiate, accept);
  }

  function render() { if (mode === 'compose') renderCompose(); else renderReview(); }

  function show() { $('trade').hidden = false; if (window.SiamPopup) window.SiamPopup.hide(); unwatch(); }
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

  // ---------- everyone sees a trade in progress ----------
  // A banner under the top bar names both sides and what is on the table. Players who are not part of the
  // trade see it too (with the live feed entries); the ones who are see it while they wait for the answer.
  let watchTimer = 0;
  function unwatch() { clearTimeout(watchTimer); const b = $('trade-watch'); if (b) b.hidden = true; }
  function watch(ev, kind) {
    const b = $('trade-watch');
    if (!b) return;
    clearTimeout(watchTimer);
    const st = engine().state;
    const from = st.players[ev.from], to = st.players[ev.to];
    const iAm = (id) => id === me();
    const who = (p) => (iAm(p.id) ? 'You' : p.name);
    const text = {
      offer: who(from) + (iAm(from.id) ? ' offer ' : ' offers ') + (iAm(to.id) ? 'you' : to.name) + ' ' + describe(ev.give) + ' for ' + describe(ev.get),
      counter: who(from) + (iAm(from.id) ? ' counter-offer ' : ' counter-offers ') + (iAm(to.id) ? 'you' : to.name) + ': ' + describe(ev.give) + ' for ' + describe(ev.get),
      declined: (iAm(to.id) ? 'You declined' : to.name + ' declined') + (iAm(from.id) ? ' your offer' : ' ' + (from.name) + "'s offer"),
      completed: 'Trade done: ' + from.name + ' and ' + to.name + ' swapped ' + describe(ev.give) + ' for ' + describe(ev.get)
    }[kind];
    b.replaceChildren();
    const av = el('span', 'tw-avatars');
    av.append(avatar(ev.from, 'small'), el('span', 'tw-arrows', '⇄'), avatar(ev.to, 'small'));
    const t = el('span', 'tw-text', text);
    const tag = el('span', 'tw-tag ' + kind, { offer: 'Trade in progress', counter: 'Trade in progress', declined: 'Declined', completed: 'Completed' }[kind]);
    b.append(av, el('span', 'tw-body', ''));
    b.lastChild.append(tag, t);
    b.dataset.kind = kind;
    b.hidden = false;
    if (kind === 'declined' || kind === 'completed') watchTimer = setTimeout(unwatch, 3500);
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

  window.SiamTrade = { init, open, respond, describe, watch, unwatch };
})();
