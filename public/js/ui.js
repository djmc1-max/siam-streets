// Game UI pieces around the board: player panel, action buttons, setup, auction, winner banner.
// Pure presentation — the rules live in engine.js.
(function () {
  const { fmtBaht } = window.SiamUtil;
  const $ = (id) => document.getElementById(id);

  let players = [];
  let owners = {};        // squareId -> playerId, as *displayed* (advances event by event)
  let cash = [];
  let resolveAction = null;
  let resolveBid = null;

  const BUTTONS = { roll: 'btn-roll', fine: 'btn-fine', buy: 'btn-buy', auction: 'btn-auction', end: 'btn-end' };

  // ---------- player panel ----------
  function renderPlayers(list, startingCash) {
    players = list;
    owners = {};
    cash = list.map(() => startingCash);
    const panel = $('players');
    panel.replaceChildren();
    list.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'player-card';
      card.dataset.player = p.id;
      card.style.setProperty('--ring', window.SiamTokens.COLORS[p.id % window.SiamTokens.COLORS.length]);
      card.innerHTML = '<span class="pc-token"></span><span class="pc-info"><span class="pc-name"></span><span class="pc-cash"></span></span>' +
        '<span class="pc-meta"><span class="pc-props"></span><span class="pc-jail" hidden></span></span>';
      card.querySelector('.pc-token').textContent = p.icon;
      card.querySelector('.pc-jail').replaceChildren(window.SiamIcons.el('jail'));
      card.querySelector('.pc-name').textContent = p.name + (p.isBot ? ' 🤖' : '');
      panel.appendChild(card);
    });
    refreshCards();
    panel.hidden = false;
  }

  const card = (id) => $('players').querySelector('[data-player="' + id + '"]');

  function refreshCards() {
    players.forEach((p) => {
      const c = card(p.id);
      c.querySelector('.pc-cash').textContent = fmtBaht(cash[p.id]);
      const count = Object.keys(owners).filter((sq) => owners[sq] === p.id).length;
      c.querySelector('.pc-props').textContent = '🏠 ' + count;
    });
  }

  function setBalances(balances) {
    balances.forEach((value, id) => {
      if (cash[id] === value) return;
      const el = card(id).querySelector('.pc-cash');
      const cls = value > cash[id] ? 'up' : 'down';
      cash[id] = value;
      el.textContent = fmtBaht(value);
      el.classList.remove('up', 'down');
      void el.offsetWidth;
      el.classList.add(cls);
    });
  }

  function setCurrent(id) {
    players.forEach((p) => card(p.id).classList.toggle('current', p.id === id));
  }
  function setJailed(id, jailed) {
    card(id).querySelector('.pc-jail').hidden = !jailed;
    window.SiamTokens.setJailed(id, jailed);
  }
  function markBankrupt(id) { card(id).classList.add('bankrupt'); card(id).classList.remove('current'); setJailed(id, false); }

  // ---------- ownership badges on squares ----------
  function setOwner(squareId, playerId) {
    const sq = document.querySelector('#board .square[data-id="' + squareId + '"]');
    if (!sq) return;
    const old = sq.querySelector('.owner-badge');
    if (old) old.remove();
    if (playerId === null) { delete owners[squareId]; } else {
      owners[squareId] = playerId;
      const badge = document.createElement('span');
      badge.className = 'owner-badge';
      badge.style.setProperty('--ring', window.SiamTokens.COLORS[playerId % window.SiamTokens.COLORS.length]);
      badge.textContent = players[playerId].icon;
      badge.title = 'Owned by ' + players[playerId].name;
      sq.appendChild(badge);
    }
    refreshCards();
  }
  function clearOwners() {
    document.querySelectorAll('#board .owner-badge').forEach((b) => b.remove());
    owners = {};
  }

  // ---------- action buttons ----------
  function setButtons(spec) {
    Object.keys(BUTTONS).forEach((k) => {
      const b = $(BUTTONS[k]);
      const v = spec[k] || 'hide';
      b.hidden = v === 'hide';
      b.disabled = v !== 'on';
    });
  }

  function idle() { setButtons({ roll: 'off', end: 'off' }); }
  function lock() {
    Object.keys(BUTTONS).forEach((k) => { $(BUTTONS[k]).disabled = true; });
  }

  // Enables exactly what the engine allows the human to do, and resolves with their choice.
  function awaitAction(avail, ctx) {
    $('btn-roll').textContent = ctx.jailed ? 'Roll for doubles' : 'Roll Dice';
    if (avail.canAuction) {
      $('btn-buy').textContent = 'Buy ' + fmtBaht(ctx.offer.price);
      setButtons({ buy: avail.canBuy ? 'on' : 'off', auction: 'on' });
    } else {
      setButtons({
        roll: avail.canRoll ? 'on' : 'off',
        fine: avail.canPayFine ? 'on' : 'hide',
        end: avail.canEndTurn ? 'on' : 'off'
      });
    }
    return new Promise((resolve) => { resolveAction = resolve; });
  }

  function bindButtons() {
    Object.keys(BUTTONS).forEach((type) => {
      $(BUTTONS[type]).addEventListener('click', () => {
        if (!resolveAction || $(BUTTONS[type]).disabled) return;
        const done = resolveAction;
        resolveAction = null;
        lock();
        done({ type });
      });
    });
  }

  // ---------- auction ----------
  function showAuction(squareName, price) {
    $('actions').hidden = true;
    $('auction').hidden = false;
    $('auction-title').textContent = '🔨 Auction: ' + squareName + ' (' + fmtBaht(price) + ')';
    $('auction-status').textContent = 'Bidding is open';
    $('auction-controls').hidden = true;
  }
  function updateAuction(text) { $('auction-status').textContent = text; }
  function hideAuction() {
    $('auction').hidden = true;
    $('actions').hidden = false;
    if (resolveBid) resolveBid = null;
  }

  // The human's bid turn: resolves { type: 'bid', amount } or { type: 'pass' }.
  function awaitBid(info) {
    const input = $('bid-input');
    $('auction-controls').hidden = false;
    input.min = info.highBid + 1;
    input.max = info.cash;
    input.value = Math.min(info.cash, info.highBid + 10);
    $('auction-status').textContent = (info.highBid ? 'High bid ' + fmtBaht(info.highBid) + ' by ' + info.highBidderName : 'No bids yet') +
      ' · you have ' + fmtBaht(info.cash);
    return new Promise((resolve) => { resolveBid = { resolve, info }; });
  }

  function bindAuction() {
    const input = $('bid-input');
    const add = (n) => { input.value = Math.min(Number(input.max) || Infinity, (Number(input.value) || 0) + n); };
    $('bid-plus10').addEventListener('click', () => add(10));
    $('bid-plus100').addEventListener('click', () => add(100));
    $('bid-submit').addEventListener('click', () => {
      if (!resolveBid) return;
      const amount = Number(input.value);
      const { info } = resolveBid;
      if (!Number.isInteger(amount) || amount <= info.highBid || amount > info.cash) {
        $('auction-status').textContent = 'Bid between ' + fmtBaht(info.highBid + 1) + ' and ' + fmtBaht(info.cash);
        return;
      }
      const done = resolveBid.resolve; resolveBid = null;
      $('auction-controls').hidden = true;
      done({ type: 'bid', amount });
    });
    $('bid-pass').addEventListener('click', () => {
      if (!resolveBid) return;
      const done = resolveBid.resolve; resolveBid = null;
      $('auction-controls').hidden = true;
      done({ type: 'pass' });
    });
  }

  // ---------- setup + winner ----------
  function initSetup(onStart) {
    const cashSel = $('setup-cash');
    window.SiamEngine.CONSTANTS.STARTING_CASH_OPTIONS.forEach((c) => {
      const o = document.createElement('option');
      o.value = c; o.textContent = fmtBaht(c);
      if (c === 15000) o.selected = true;
      cashSel.appendChild(o);
    });
    const botSel = $('setup-bots');
    for (let n = 1; n <= 5; n++) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      botSel.appendChild(o);
    }
    $('btn-start').addEventListener('click', () => onStart({ startingCash: Number(cashSel.value), bots: Number(botSel.value) }));
  }

  function showSetup() {
    $('setup').hidden = false;
    $('actions').hidden = true;
    $('auction').hidden = true;
    $('players').hidden = true;
  }
  function showPlay() {
    $('setup').hidden = true;
    $('actions').hidden = false;
  }

  function showWinner(player, onAgain) {
    $('winner-name').textContent = player.name + ' wins!';
    $('winner-token').textContent = player.icon;
    $('winner').hidden = false;
    $('btn-again').onclick = () => { $('winner').hidden = true; onAgain(); };
  }

  // Phones (<= 600px): the controls live in a fixed bottom dock within thumb reach. Wider screens keep
  // them in the board centre. They are moved (not cloned) so their state and listeners are kept.
  function initDock() {
    const dock = $('dock');
    const phone = window.matchMedia('(max-width: 600px)');
    const place = () => {
      const target = phone.matches ? dock : document.querySelector('#board .board-center');
      ['setup', 'actions', 'auction'].forEach((id) => target.appendChild($(id)));
      measure();
    };
    // The dock's height tells the layout how much room to leave, so the board stays centred between
    // the top bar and the dock even when the dock grows (e.g. the auction bid controls).
    const measure = () => {
      document.documentElement.style.setProperty('--dock-h', (phone.matches ? dock.offsetHeight : 0) + 'px');
    };
    if (window.ResizeObserver) new ResizeObserver(measure).observe(dock);
    phone.addEventListener('change', place);
    place();
  }

  function init(onStart) {
    initDock();
    bindButtons();
    bindAuction();
    initSetup(onStart);
    showSetup();
  }

  window.SiamUI = {
    init, renderPlayers, setBalances, setCurrent, setJailed, markBankrupt, setOwner, clearOwners,
    idle, lock, awaitAction, showAuction, updateAuction, hideAuction, awaitBid,
    showSetup, showPlay, showWinner
  };
})();
