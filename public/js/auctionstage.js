// Full-screen auction (Phase 3.5, item 6). The board disappears behind a stage showing the property, the
// current high bid and bidder, every player's cash, and a 10-second countdown that restarts on every new bid.
// This file is only the view: game.js owns the clock and the bots and talks to the engine.
(function () {
  const $ = (id) => document.getElementById(id);
  const { fmtBaht } = window.SiamUtil;
  const { BOARD, COLOR_GROUPS } = window.SiamData;
  const R = 54, CIRC = 2 * Math.PI * R;
  const RAISES = [10, 50, 100, 500];

  let st = null;          // { sq, roster, decliner, humanId, highBid, highBidder, pendingBid, deadline, total, raf }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const player = (id) => st.roster.find((p) => p.id === id);
  const color = (id) => window.SiamPalette.playerColor(id);

  function avatar(p, cls) {
    const a = el('span', 'as-avatar ' + (cls || ''), p.icon);
    a.style.setProperty('--ring', color(p.id));
    return a;
  }

  function build() {
    const root = $('auction-stage');
    const sq = st.sq;
    root.replaceChildren();
    root.className = 'auction-stage';
    const sqEl = document.querySelector('#board .square[data-id="' + sq.id + '"]');
    if (sqEl) { const cs = getComputedStyle(sqEl); root.style.setProperty('--a', cs.getPropertyValue('--a')); root.style.setProperty('--b', cs.getPropertyValue('--b')); }

    root.append(el('div', 'as-rays'));
    const title = el('div', 'as-title');
    title.append(el('span', 'as-gavel', '🔨'), el('span', null, 'AUCTION'), el('span', 'as-gavel', '🔨'));
    root.append(title);

    const mid = el('div', 'as-mid');
    const prop = el('div', 'as-prop');
    prop.append(el('div', 'as-prop-kind', sq.group ? COLOR_GROUPS[sq.group].name : ({ airport: 'Airport', utility: 'Utility' }[sq.type] || '')));
    prop.append(el('div', 'as-prop-name', sq.name));
    prop.append(el('div', 'as-prop-label', 'List price'));
    prop.append(el('div', 'as-prop-price', fmtBaht(sq.price)));
    if (sq.rent) prop.append(el('div', 'as-prop-rent', 'Base rent ' + fmtBaht(sq.rent[0])));
    mid.append(prop);

    const clock = el('div', 'as-clock');
    clock.innerHTML = '<svg viewBox="0 0 128 128" class="as-ring" aria-hidden="true"><circle class="as-ring-bg" cx="64" cy="64" r="' + R + '"/><circle id="as-ring-fg" class="as-ring-fg" cx="64" cy="64" r="' + R + '" transform="rotate(-90 64 64)"/></svg>';
    clock.append(el('div', 'as-secs'));
    clock.lastChild.id = 'as-secs';
    mid.append(clock);

    const bid = el('div', 'as-bid');
    bid.append(el('div', 'as-bid-label', 'Current bid'));
    const amount = el('div', 'as-bid-amount', '—'); amount.id = 'as-amount';
    const who = el('div', 'as-bid-who', 'No bids yet — opening bid ฿1'); who.id = 'as-who';
    bid.append(amount, who);
    mid.append(bid);
    root.append(mid);

    const roster = el('div', 'as-roster');
    roster.id = 'as-roster';
    st.roster.forEach((p) => {
      const row = el('div', 'as-player');
      row.dataset.player = p.id;
      const info = el('span', 'as-player-info');
      info.append(el('span', 'as-player-name', p.id === st.humanId ? p.name + ' (you)' : p.name), el('span', 'as-player-cash', fmtBaht(p.cash)));
      const tag = el('span', 'as-player-tag');
      row.append(avatar(p), info, tag);
      if (p.id === st.decliner) { row.classList.add('watching'); tag.textContent = 'Watching'; }
      roster.append(row);
    });
    root.append(roster);

    const ctl = el('div', 'as-controls');
    ctl.id = 'as-controls';
    if (st.humanId === st.decliner || !player(st.humanId)) {
      ctl.append(el('div', 'as-note', st.humanId === st.decliner ? 'You declined to buy — you can only watch this auction.' : 'You are watching this auction.'));
    } else {
      const quick = el('div', 'as-quick');
      RAISES.forEach((n) => {
        const b = el('button', 'btn as-raise', '+' + n);
        b.type = 'button'; b.dataset.raise = n;
        b.addEventListener('click', () => submit(st.highBid + n));
        quick.append(b);
      });
      const row = el('div', 'as-custom');
      const input = el('input'); input.id = 'as-input'; input.type = 'number'; input.inputMode = 'numeric'; input.min = 1; input.step = 1; input.setAttribute('aria-label', 'Your bid in Baht');
      const go = el('button', 'btn btn-primary as-bid-btn', 'Bid'); go.type = 'button'; go.id = 'as-bid-btn';
      go.addEventListener('click', () => submit(Number(input.value)));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(Number(input.value)); });
      row.append(input, go);
      ctl.append(quick, row, el('div', 'as-hint'));
      ctl.lastChild.id = 'as-hint';
    }
    root.append(ctl);
    root.hidden = false;
    refreshControls();
  }

  function submit(amount) {
    const me = player(st.humanId);
    const hint = $('as-hint');
    if (!me || st.over) return;
    if (!Number.isInteger(amount) || amount <= st.highBid) { if (hint) hint.textContent = 'Bid more than ' + fmtBaht(st.highBid) + '.'; return; }
    if (amount > me.cash) { if (hint) hint.textContent = 'You only have ' + fmtBaht(me.cash) + '.'; return; }
    if (hint) hint.textContent = '';
    st.pendingBid = amount;
  }

  function refreshControls() {
    const me = player(st.humanId);
    if (!me || st.humanId === st.decliner) return;
    document.querySelectorAll('.as-raise').forEach((b) => { b.disabled = st.over || st.highBid + Number(b.dataset.raise) > me.cash; });
    const input = $('as-input');
    if (input) {
      input.max = me.cash;
      input.placeholder = String(st.highBid + 1);
      $('as-bid-btn').disabled = st.over || me.cash <= st.highBid;
    }
    const hint = $('as-hint');
    if (hint && me.cash <= st.highBid) hint.textContent = 'You can no longer afford to outbid ' + fmtBaht(st.highBid) + '.';
  }

  function frame() {
    if (!st || st.over) return;
    const left = Math.max(0, st.deadline - performance.now());
    const frac = st.total ? left / st.total : 0;
    $('as-ring-fg').style.strokeDasharray = CIRC;
    $('as-ring-fg').style.strokeDashoffset = CIRC * (1 - frac);
    const secs = Math.ceil(frac * 10 - 1e-6);
    const s = $('as-secs');
    if (s.textContent !== String(secs)) s.textContent = secs;
    $('auction-stage').dataset.secs = secs;
    $('auction-stage').classList.toggle('urgent', secs <= 3 && left > 0);
    st.raf = requestAnimationFrame(frame);
  }

  // ---- public API ----
  function open(info) {
    close();
    st = { sq: info.sq, roster: info.roster.map((p) => Object.assign({}, p)), decliner: info.decliner, humanId: info.humanId, highBid: 0, highBidder: null, pendingBid: null, deadline: 0, total: 0, over: false, raf: 0 };
    document.getElementById('game').classList.add('auction-on');
    build();
    setClock(info.clockMs);
    $('auction-stage').dataset.open = '1';
    frame();
  }

  function setClock(totalMs) { st.total = totalMs; st.deadline = performance.now() + totalMs; }

  function setBid(playerId, amount) {
    if (!st) return;
    st.highBid = amount; st.highBidder = playerId;
    const p = player(playerId);
    const a = $('as-amount');
    a.textContent = fmtBaht(amount);
    a.classList.remove('bump'); void a.offsetWidth; a.classList.add('bump');
    const who = $('as-who');
    who.replaceChildren();
    who.append(avatar(p, 'small'), el('span', null, p.id === st.humanId ? 'You are winning!' : p.name));
    document.querySelectorAll('#as-roster .as-player').forEach((r) => {
      const lead = Number(r.dataset.player) === playerId;
      r.classList.toggle('leading', lead);
      if (Number(r.dataset.player) !== st.decliner) r.querySelector('.as-player-tag').textContent = lead ? 'Leading' : '';
    });
    refreshControls();
  }

  function setCash(id, cash) {
    if (!st) return;
    const p = player(id);
    if (!p) return;
    p.cash = cash;
    const row = document.querySelector('#as-roster .as-player[data-player="' + id + '"] .as-player-cash');
    if (row) row.textContent = fmtBaht(cash);
    refreshControls();
  }

  function takeBid() { const b = st && st.pendingBid; if (st) st.pendingBid = null; return b || null; }

  // The hammer falls: SOLD / NO SALE. Resolves when the banner has had its moment.
  function finish(winnerId, amount) {
    if (!st) return Promise.resolve();
    st.over = true;
    cancelAnimationFrame(st.raf);
    const root = $('auction-stage');
    root.classList.remove('urgent');
    root.classList.add('done');
    $('as-secs').textContent = '0';
    $('as-ring-fg').style.strokeDashoffset = CIRC;
    document.querySelectorAll('.as-raise, .as-bid-btn, #as-input').forEach((x) => { x.disabled = true; });
    const stamp = el('div', 'as-stamp');
    if (winnerId === null || winnerId === undefined) {
      stamp.classList.add('nosale');
      stamp.append(el('div', 'as-stamp-big', 'NO SALE'), el('div', 'as-stamp-sub', st.sq.name + ' stays with the bank'));
    } else {
      const p = player(winnerId);
      stamp.append(el('div', 'as-stamp-big', 'SOLD!'));
      const sub = el('div', 'as-stamp-sub');
      sub.append(avatar(p, 'small'), el('span', null, (p.id === st.humanId ? 'You win ' : p.name + ' wins ') + st.sq.name + ' for ' + fmtBaht(amount)));
      stamp.append(sub);
    }
    root.append(stamp);
    root.dataset.result = winnerId === null || winnerId === undefined ? 'nosale' : 'sold';
    return window.SiamUtil.sleep(2200);
  }

  function close() {
    if (st) cancelAnimationFrame(st.raf);
    st = null;
    const root = $('auction-stage');
    if (root) { root.hidden = true; root.replaceChildren(); delete root.dataset.open; delete root.dataset.result; root.classList.remove('done', 'urgent'); }
    const g = document.getElementById('game');
    if (g) g.classList.remove('auction-on');
  }

  window.SiamAuctionStage = { open, setClock, setBid, setCash, takeBid, finish, close, isOpen: () => !!st, remaining: () => (st ? Math.max(0, st.deadline - performance.now()) : 0) };
})();
