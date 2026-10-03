// Siam Streets game engine — rules only, no DOM (GAME_DESIGN.md sections 6-14, 16, 18).
// Every action returns an ordered list of events. The engine applies state changes
// immediately; each event carries a `balances` snapshot so the UI can animate money in
// sync. Runs in the browser today and moves to the Node server unchanged in Phase 4.
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const data = node ? require('./data.js') : root.SiamData;
  const rules = node ? require('./rules.js') : root.SiamRules;
  const api = factory(data, rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiamEngine = api;
})(typeof self !== 'undefined' ? self : this, function (data, Rules) {
  'use strict';

  const { BOARD, CARDS, CARD_BY_ID } = data;
  const N = BOARD.length; // 40

  const START_SQUARE = 1;
  const JAIL_SQUARE = 11;
  const SONGKRAN_SQUARE = 21;
  const GO_TO_JAIL_SQUARE = 31;
  const PASS_START_SALARY = 2000;
  const LAND_START_SALARY = 4000;
  const JAIL_FINE = 500;
  const MAX_JAIL_TURNS = 3;
  const TAX_10_CAP = 2000;
  const LUXURY_TAX = 1000;
  const AIRPORT_RENT = [500, 1000, 2000, 4000];
  const STARTING_CASH_OPTIONS = [10000, 15000, 20000, 25000, 30000];

  function createGame(opts) {
    const seats = opts.players;
    const startingCash = opts.startingCash === undefined ? 15000 : opts.startingCash;
    if (!Array.isArray(seats) || seats.length < 2 || seats.length > 6) throw new Error('Siam Streets needs 2-6 players');
    if (STARTING_CASH_OPTIONS.indexOf(startingCash) === -1) throw new Error('Invalid starting Baht: ' + startingCash);

    const state = {
      players: seats.map((s, i) => ({
        id: i, name: s.name, tokenId: s.tokenId, isBot: !!s.isBot,
        cash: startingCash, pos: START_SQUARE, jailed: false, jailTurns: 0, bankrupt: false,
        jailCards: [],   // Get Out of Jail Free card ids held (Section 21)
        skipTurns: 0     // turns still to miss (Surprise card 10)
      })),
      owners: {},          // squareId -> playerId
      levels: {},          // squareId -> 1-4 houses, 5 = hotel (absent = none)
      mortgaged: {},       // squareId -> true
      current: 0,
      turn: 1,
      phase: 'roll',       // roll | action | auction | end | over
      dice: [0, 0],
      doublesCount: 0,
      extraRoll: false,    // a double was rolled: the player rolls again after their action
      songkranPot: 0,
      decks: { surprise: [], treasure: [] },   // card ids, top of the deck first
      pending: null,       // squareId of an unowned property awaiting buy/auction
      auction: null,
      debts: [],           // { id, debtor, creditor: playerId | 'bank' | 'pot', amount (still owed), reason }
      debtSeq: 0,
      trade: null,         // a pending offer: { id, from, to, give, get, round } — `to` must answer it
      tradeSeq: 0,
      afterDebt: null,     // what to do once the current player's debts are cleared: 'start' (roll) or 'landing'
      winner: null
    };

    const game = { state, rng: opts.rng || Math.random };

    // Fisher-Yates with the injected rng, so tests can replay a deck.
    function shuffled(ids) {
      const a = ids.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.min(i, Math.floor(game.rng() * (i + 1)));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    state.decks.surprise = shuffled(CARDS.surprise.map((c) => c.id));
    state.decks.treasure = shuffled(CARDS.treasure.map((c) => c.id));

    // ---------- helpers ----------
    const current = () => state.players[state.current];
    const balances = () => state.players.map((p) => p.cash);
    const emit = (list, type, extra) => {
      list.push(Object.assign({ type }, extra, { balances: balances(), debts: state.players.map((q) => debtTotal(q.id)) }));
    };
    const rollDie = () => {
      const r = game.rng();
      if (!(r >= 0 && r < 1)) throw new Error('rng must return a number in [0, 1), got ' + r);
      return 1 + Math.floor(r * 6);
    };
    const ownedBy = (playerId) => Object.keys(state.owners).filter((id) => state.owners[id] === playerId).map(Number);

    const rentFor = (sq, ownerId, diceTotal) => Rules.rentFor(state, sq, ownerId, diceTotal);

    function give(creditor, amount) {
      if (typeof creditor === 'number') state.players[creditor].cash += amount;
      else if (creditor === 'pot') state.songkranPot += amount;   // 'bank': the money just leaves the game
    }

    // Moves money. creditor is a player id, 'bank' or 'pot'. If the payer is short, ALL their available
    // cash goes to the creditor right now (Sections 16/17) and `owed` is what is left; the caller emits its
    // own payment event and then calls owe() to log the remainder as a debt.
    function charge(payer, amount, creditor) {
      const paid = Math.min(amount, payer.cash);
      payer.cash -= paid;
      give(creditor, paid);
      return { paid, owed: amount - paid };
    }

    const debtsOf = (pid) => state.debts.filter((d) => d.debtor === pid);
    const debtTotal = (pid) => debtsOf(pid).reduce((sum, d) => sum + d.amount, 0);

    // Section 17: the remainder is logged and must be resolved before the player's next roll / turn end.
    function owe(debtor, creditor, amount, reason, list) {
      const d = { id: ++state.debtSeq, debtor: debtor.id, creditor, amount, reason };
      state.debts.push(d);
      emit(list, 'debtLogged', { debtId: d.id, playerId: debtor.id, creditor, amount, owed: debtTotal(debtor.id), reason });
    }

    // Any cash a debtor holds (from a mortgage, a sale, a trade, rent...) goes straight to the oldest debt.
    function settleDebts(list) {
      state.debts.slice().forEach((d) => {
        const debtor = state.players[d.debtor];
        if (debtor.bankrupt || debtor.cash <= 0) return;
        const pay = Math.min(debtor.cash, d.amount);
        debtor.cash -= pay;
        give(d.creditor, pay);
        d.amount -= pay;
        if (d.amount === 0) {
          state.debts = state.debts.filter((x) => x !== d);
          emit(list, 'debtResolved', { debtId: d.id, playerId: d.debtor, creditor: d.creditor, owed: debtTotal(d.debtor) });
        } else {
          emit(list, 'debtPayment', { debtId: d.id, playerId: d.debtor, creditor: d.creditor, amount: pay, remaining: d.amount, owed: debtTotal(d.debtor) });
        }
      });
    }

    // After the current player's last debt is cleared the interrupted turn carries on.
    function afterSettle(list) {
      if (state.phase !== 'debt') return;
      const p = current();
      if (debtsOf(p.id).length > 0) return;
      const next = state.afterDebt;
      state.afterDebt = null;
      if (next === 'start') state.phase = 'roll';
      else finishStep(p, list);
    }

    // The end of a landing / card: a prisoner's turn ends, otherwise a double rolls again or the turn can end.
    function finishStep(p, list) {
      if (p.jailed) { state.extraRoll = false; state.phase = 'end'; return; }
      finishAction(list);
    }

    function checkWinner(list) {
      const alive = state.players.filter((p) => !p.bankrupt);
      if (alive.length !== 1) return false;
      state.winner = alive[0].id;
      state.phase = 'over';
      state.pending = null;
      state.auction = null;
      emit(list, 'gameOver', { winnerId: alive[0].id });
      return true;
    }

    // Section 16: cash to the creditor (already moved by charge), properties return to the bank.
    function declareBankrupt(p, creditor, list) {
      const released = ownedBy(p.id);
      released.forEach((id) => { delete state.owners[id]; delete state.levels[id]; delete state.mortgaged[id]; });
      p.jailCards.forEach((id) => state.decks.treasure.push(id)); // held jail cards go back to the deck
      p.jailCards = [];
      p.bankrupt = true;
      p.jailed = false;
      state.debts = state.debts.filter((d) => d.debtor !== p.id && d.creditor !== p.id);   // debts owed BY or TO them end here
      emit(list, 'bankrupt', { playerId: p.id, creditor, released });
      checkWinner(list);
    }

    function advanceTurn(list) {
      state.doublesCount = 0;
      state.extraRoll = false;
      let next = state.current;
      for (;;) {
        next = (next + 1) % state.players.length;
        const q = state.players[next];
        if (q.bankrupt) continue;
        if (q.skipTurns > 0) {            // Surprise card 10: this player misses their turn
          q.skipTurns -= 1;
          emit(list, 'turnSkipped', { playerId: next });
          continue;
        }
        break;
      }
      state.current = next;
      state.turn += 1;
      // a player who still owes money (e.g. from Surprise card 4) must clear it before rolling
      state.phase = debtsOf(next).length ? 'debt' : 'roll';
      state.afterDebt = state.phase === 'debt' ? 'start' : null;
      emit(list, 'turn', { playerId: next, turn: state.turn });
    }

    // Leaves the action step: a double owes another roll, otherwise the turn is ready to end.
    function finishAction(list) {
      if (state.phase === 'over') return;
      const p = current();
      state.pending = null;
      if (state.extraRoll && !p.jailed && !p.bankrupt) {
        emit(list, 'doubles', { playerId: p.id });
        state.phase = 'roll';
      } else {
        state.extraRoll = false;
        state.phase = 'end';
      }
    }

    function goToJail(p, list, reason) {
      p.pos = JAIL_SQUARE;
      p.jailed = true;
      p.jailTurns = 0;
      state.doublesCount = 0;
      state.extraRoll = false;
      emit(list, 'jailed', { playerId: p.id, reason, to: JAIL_SQUARE });
    }

    // Steps the token along the path. Crossing Start pays the salary mid-move; landing ON Start pays double.
    function move(p, total, list) {
      const from = p.pos;
      const path = [];
      for (let i = 1; i <= total; i++) path.push(((from - 1 + i) % N) + 1);
      const to = path[path.length - 1];
      const crossAt = path.slice(0, -1).indexOf(START_SQUARE);
      if (crossAt !== -1) {
        emit(list, 'move', { playerId: p.id, from, to: START_SQUARE, path: path.slice(0, crossAt + 1) });
        p.cash += PASS_START_SALARY;
        emit(list, 'passStart', { playerId: p.id, amount: PASS_START_SALARY });
        emit(list, 'move', { playerId: p.id, from: START_SQUARE, to, path: path.slice(crossAt + 1) });
      } else {
        emit(list, 'move', { playerId: p.id, from, to, path });
      }
      p.pos = to;
      if (to === START_SQUARE) {
        p.cash += LAND_START_SALARY;
        emit(list, 'landStart', { playerId: p.id, amount: LAND_START_SALARY });
      }
      emit(list, 'land', { playerId: p.id, square: to });
    }

    function startAuction(sq, decliner, list, reason) {
      const order = [];
      for (let i = 1; i < state.players.length; i++) {
        const q = state.players[(decliner.id + i) % state.players.length];
        if (!q.bankrupt && q.cash >= 1) order.push(q.id);
      }
      state.pending = null;
      if (order.length === 0) {
        emit(list, 'auctionNoSale', { square: sq.id });
        finishAction(list);
        return;
      }
      state.auction = { square: sq.id, decliner: decliner.id, active: order.slice(), turn: order[0], highBid: 0, highBidder: null };
      state.phase = 'auction';
      emit(list, 'auctionStart', { square: sq.id, decliner: decliner.id, bidders: order, reason });
    }

    function nextActiveAfter(a, afterId) {
      for (let i = 1; i <= state.players.length; i++) {
        const id = (afterId + i) % state.players.length;
        if (a.active.indexOf(id) !== -1) return id;
      }
      return null;
    }

    function finishAuction(list) {
      const a = state.auction;
      if (a.highBidder !== null) {
        const winner = state.players[a.highBidder];
        charge(winner, a.highBid, 'bank');
        state.owners[a.square] = winner.id;
        emit(list, 'auctionWon', { playerId: winner.id, square: a.square, amount: a.highBid });
      } else {
        emit(list, 'auctionNoSale', { square: a.square });
      }
      state.auction = null;
      finishAction(list);
    }

    // Draws the top card of a deck and applies it automatically (Sections 20, 21). Cards return to the
    // bottom of their deck, except Get Out of Jail Free, which the player keeps until it is used.
    function drawCard(p, deckName, list) {
      const deck = state.decks[deckName];
      const id = deck.shift();
      const card = CARD_BY_ID[id];
      const fx = card.effect;
      emit(list, 'cardDrawn', { playerId: p.id, deck: deckName, cardId: id, text: card.text });
      if (fx.type !== 'jailCard') deck.push(id);

      if (fx.type === 'collect') {
        p.cash += fx.amount;
        emit(list, 'cardEffect', { playerId: p.id, kind: 'collect', amount: fx.amount });
      } else if (fx.type === 'pay') {
        const r = charge(p, fx.amount, 'bank');
        emit(list, 'cardEffect', { playerId: p.id, kind: 'pay', amount: fx.amount, paid: r.paid });
        if (r.owed) owe(p, 'bank', r.owed, 'card', list);
      } else if (fx.type === 'collectEach') {
        const from = [];
        const short = [];
        state.players.forEach((q) => {
          if (q.id === p.id || q.bankrupt) return;
          const r = charge(q, fx.amount, p.id);
          from.push(q.id);
          if (r.owed) short.push([q, r.owed]);
        });
        emit(list, 'cardEffect', { playerId: p.id, kind: 'collectEach', amount: fx.amount, from });
        short.forEach(([q, owed]) => owe(q, p.id, owed, 'card', list));   // they settle it on their own turn
      } else if (fx.type === 'jail') {
        goToJail(p, list, 'card');
      } else if (fx.type === 'skip') {
        p.skipTurns += 1;
        emit(list, 'cardEffect', { playerId: p.id, kind: 'skip' });
      } else if (fx.type === 'jailCard') {
        p.jailCards.push(id);
        emit(list, 'cardKept', { playerId: p.id, cardId: id, count: p.jailCards.length });
      }
    }

    function resolveLanding(p, total, list) {
      const sq = BOARD[p.pos - 1];
      if (sq.type === 'corner') {
        if (sq.id === SONGKRAN_SQUARE) {
          const amount = state.songkranPot;
          p.cash += amount;
          state.songkranPot = 0;
          emit(list, 'songkran', { playerId: p.id, amount });
        } else if (sq.id === GO_TO_JAIL_SQUARE) {
          goToJail(p, list, 'square');
        }
      } else if (sq.type === 'tax') {
        const amount = sq.id === 5 ? Math.min(Math.floor(p.cash * 0.10), TAX_10_CAP) : LUXURY_TAX;
        const r = charge(p, amount, 'pot');
        emit(list, 'tax', { playerId: p.id, square: sq.id, amount, paid: r.paid });
        if (r.owed) owe(p, 'pot', r.owed, 'tax', list);
      } else if (sq.type === 'card') {
        drawCard(p, sq.name === 'Surprise' ? 'surprise' : 'treasure', list);
      } else {
        const ownerId = state.owners[sq.id];
        if (ownerId === undefined) {
          if (p.cash < sq.price) {
            emit(list, 'cantAfford', { playerId: p.id, square: sq.id, price: sq.price });
            startAuction(sq, p, list, 'cantAfford');
          } else {
            state.pending = sq.id;
            state.phase = 'action';
            emit(list, 'offer', { playerId: p.id, square: sq.id, price: sq.price });
          }
        } else if (ownerId !== p.id && state.mortgaged[sq.id]) {
          emit(list, 'rentMortgaged', { playerId: p.id, ownerId, square: sq.id });   // Section 15: no rent while mortgaged
        } else if (ownerId !== p.id) {
          const amount = rentFor(sq, ownerId, total);
          const r = charge(p, amount, ownerId);
          emit(list, 'rent', { playerId: p.id, ownerId, square: sq.id, amount, paid: r.paid });
          if (r.owed) owe(p, ownerId, r.owed, 'rent', list);
        }
      }

      if (state.pending !== null || state.auction) return; // waiting on a buy/auction decision
      if (state.phase === 'over') return;
      if (p.bankrupt) { advanceTurn(list); return; }
      if (debtsOf(p.id).length) { state.phase = 'debt'; state.afterDebt = 'landing'; return; }   // must clear it first
      finishStep(p, list);
    }

    // ---------- public actions ----------
    function assertPhase(phase) {
      if (state.trade) throw new Error('A trade offer is waiting for an answer');
      if (state.phase !== phase) throw new Error('Not allowed in phase "' + state.phase + '" (needs "' + phase + '")');
    }

    game.roll = function () {
      assertPhase('roll');
      const list = [];
      const p = current();
      const wasJailed = p.jailed;
      state.extraRoll = false;
      const d1 = rollDie();
      const d2 = rollDie();
      const doubles = d1 === d2;
      const total = d1 + d2;
      state.dice = [d1, d2];
      emit(list, 'rolled', { playerId: p.id, d1, d2, total, doubles, inJail: wasJailed });

      if (wasJailed) {
        if (doubles) {
          p.jailed = false; p.jailTurns = 0;
          emit(list, 'jailFreed', { playerId: p.id, reason: 'doubles' });
        } else {
          p.jailTurns += 1;
          if (p.jailTurns >= MAX_JAIL_TURNS) {
            p.jailed = false; p.jailTurns = 0;
            emit(list, 'jailFreed', { playerId: p.id, reason: 'time' });
          } else {
            emit(list, 'jailStay', { playerId: p.id, attempt: p.jailTurns, max: MAX_JAIL_TURNS });
            state.phase = 'end';
            return list;
          }
        }
        // freed: move by this roll, but a jail-breaking double gives no extra turn
      } else {
        state.doublesCount = doubles ? state.doublesCount + 1 : 0;
        if (doubles && state.doublesCount >= 3) {
          goToJail(p, list, 'doubles');
          state.phase = 'end';
          return list;
        }
        state.extraRoll = doubles;
      }

      move(p, total, list);
      resolveLanding(p, total, list);
      return list;
    };

    game.payJailFine = function () {
      assertPhase('roll');
      const p = current();
      if (!p.jailed) throw new Error('Player is not in prison');
      if (p.cash < JAIL_FINE) throw new Error('Cannot afford the fine');
      const list = [];
      charge(p, JAIL_FINE, 'bank');
      p.jailed = false; p.jailTurns = 0;
      emit(list, 'jailFine', { playerId: p.id, amount: JAIL_FINE });
      return list;
    };

    // Property management (mortgage / build / sell): your own turn, any step of it except auctions.
    function assertCanManage(pid) {
      if (state.trade) throw new Error('A trade offer is waiting for an answer');
      if (pid !== state.current) throw new Error('You can only manage properties on your own turn');
      if (['roll', 'action', 'end', 'debt'].indexOf(state.phase) === -1) throw new Error('Cannot manage properties now (' + state.phase + ')');
    }

    game.mortgage = function (pid, sqId) {
      assertCanManage(pid);
      const c = Rules.checkMortgage(state, pid, sqId);
      if (!c.ok) throw new Error(c.reason);
      const list = [];
      state.mortgaged[sqId] = true;
      state.players[pid].cash += c.amount;
      emit(list, 'mortgaged', { playerId: pid, square: sqId, amount: c.amount });
      return list;
    };

    game.unmortgage = function (pid, sqId) {
      assertCanManage(pid);
      const c = Rules.checkUnmortgage(state, pid, sqId);
      if (!c.ok) throw new Error(c.reason);
      const list = [];
      state.players[pid].cash -= c.amount;
      delete state.mortgaged[sqId];
      emit(list, 'unmortgaged', { playerId: pid, square: sqId, amount: c.amount });
      return list;
    };

    game.build = function (pid, sqId) {
      assertCanManage(pid);
      const c = Rules.checkBuild(state, pid, sqId);
      if (!c.ok) throw new Error(c.reason);
      const list = [];
      state.players[pid].cash -= c.amount;
      state.levels[sqId] = c.toLevel;
      emit(list, 'built', { playerId: pid, square: sqId, level: c.toLevel, cost: c.amount, hotel: c.toLevel === Rules.HOTEL });
      return list;
    };

    game.sellBuilding = function (pid, sqId) {
      assertCanManage(pid);
      const c = Rules.checkSell(state, pid, sqId);
      if (!c.ok) throw new Error(c.reason);
      const list = [];
      const wasHotel = Rules.levelOf(state, sqId) === Rules.HOTEL;
      if (c.toLevel === 0) delete state.levels[sqId]; else state.levels[sqId] = c.toLevel;
      state.players[pid].cash += c.amount;
      emit(list, 'sold', { playerId: pid, square: sqId, level: c.toLevel, refund: c.amount, hotel: wasHotel });
      return list;
    };

    // ---------- trading (Section 19) ----------
    const MAX_TRADE_ROUNDS = 6;
    const cloneSide = (s) => ({ props: s.props.slice(), cash: s.cash, cards: s.cards.slice() });

    // Any player offers properties + cash (+ jail cards) for the other's, in either direction.
    game.proposeTrade = function (pid, toId, give, get) {
      assertCanManage(pid);
      const c = Rules.checkTrade(state, pid, toId, give, get);
      if (!c.ok) throw new Error(c.reason);
      const list = [];
      state.trade = { id: ++state.tradeSeq, from: pid, to: toId, give: cloneSide(give), get: cloneSide(get), round: 1 };
      emit(list, 'tradeProposed', { tradeId: state.trade.id, from: pid, to: toId, give: cloneSide(give), get: cloneSide(get) });
      return list;
    };

    // The receiver answers: 'accept', 'decline', or { counter: { give, get } } (Negotiate). A counter-offer
    // swaps the roles: the receiver becomes the proposer and the original proposer must now answer.
    game.respondTrade = function (pid, reply) {
      const t = state.trade;
      if (!t) throw new Error('No trade offer is waiting');
      if (pid !== t.to) throw new Error('This offer is not for you');
      const list = [];
      if (reply === 'accept') {
        const c = Rules.checkTrade(state, t.from, t.to, t.give, t.get);
        if (!c.ok) throw new Error(c.reason);
        t.give.props.forEach((id) => { state.owners[id] = t.to; });
        t.get.props.forEach((id) => { state.owners[id] = t.from; });
        state.players[t.from].cash += t.get.cash - t.give.cash;
        state.players[t.to].cash += t.give.cash - t.get.cash;
        t.give.cards.forEach((id) => { const a = state.players[t.from].jailCards; a.splice(a.indexOf(id), 1); state.players[t.to].jailCards.push(id); });
        t.get.cards.forEach((id) => { const a = state.players[t.to].jailCards; a.splice(a.indexOf(id), 1); state.players[t.from].jailCards.push(id); });
        state.trade = null;
        emit(list, 'tradeCompleted', { tradeId: t.id, from: t.from, to: t.to, give: t.give, get: t.get, jailCards: state.players.map((q) => q.jailCards.length) });
      } else if (reply === 'decline') {
        state.trade = null;
        emit(list, 'tradeDeclined', { tradeId: t.id, from: t.from, to: t.to });
      } else if (reply && reply.counter) {
        if (t.round >= MAX_TRADE_ROUNDS) throw new Error('Too many counter-offers — accept or decline');
        const { give, get } = reply.counter;
        const c = Rules.checkTrade(state, pid, t.from, give, get);
        if (!c.ok) throw new Error(c.reason);
        state.trade = { id: t.id, from: pid, to: t.from, give: cloneSide(give), get: cloneSide(get), round: t.round + 1 };
        emit(list, 'tradeCountered', { tradeId: t.id, from: pid, to: t.from, give: cloneSide(give), get: cloneSide(get), round: t.round + 1 });
      } else {
        throw new Error('Answer with accept, decline or a counter-offer');
      }
      return list;
    };

    // Section 35: Declare Bankruptcy. Also how a hopeless debtor ends it (Sections 16/17): remaining cash goes
    // to the creditor, everything else goes back to the bank, and the turn passes on.
    game.declareBankruptcy = function (pid) {
      if (state.trade) throw new Error('A trade offer is waiting for an answer');
      if (pid !== state.current) throw new Error('You can only declare bankruptcy on your own turn');
      if (['roll', 'action', 'end', 'debt'].indexOf(state.phase) === -1) throw new Error('Cannot declare bankruptcy now (' + state.phase + ')');
      const list = [];
      const p = current();
      const owed = debtsOf(p.id);
      const creditor = owed.length ? owed[0].creditor : 'bank';
      const cash = p.cash;
      p.cash = 0;
      give(creditor, cash);
      state.pending = null;
      declareBankrupt(p, creditor, list);
      if (state.phase !== 'over') advanceTurn(list);
      return list;
    };

    // Section 13: a kept Get Out of Jail Free card is one way out. It goes back to the bottom of the Treasure deck.
    game.useJailCard = function () {
      assertPhase('roll');
      const p = current();
      if (!p.jailed) throw new Error('Player is not in prison');
      if (p.jailCards.length === 0) throw new Error('No Get Out of Jail Free card');
      const list = [];
      const id = p.jailCards.pop();
      state.decks.treasure.push(id);
      p.jailed = false; p.jailTurns = 0;
      emit(list, 'jailCardUsed', { playerId: p.id, cardId: id, count: p.jailCards.length });
      return list;
    };

    game.buy = function () {
      assertPhase('action');
      const p = current();
      const sq = BOARD[state.pending - 1];
      if (p.cash < sq.price) throw new Error('Cannot afford ' + sq.name);
      const list = [];
      charge(p, sq.price, 'bank');
      state.owners[sq.id] = p.id;
      emit(list, 'bought', { playerId: p.id, square: sq.id, price: sq.price });
      finishAction(list);
      return list;
    };

    game.declineToAuction = function () {
      assertPhase('action');
      const list = [];
      const sq = BOARD[state.pending - 1];
      emit(list, 'declined', { playerId: current().id, square: sq.id });
      startAuction(sq, current(), list, 'declined');
      return list;
    };

    game.bid = function (playerId, amount) {
      assertPhase('auction');
      const a = state.auction;
      const p = state.players[playerId];
      if (a.turn !== playerId) throw new Error('Not this player\'s turn to bid');
      if (!Number.isInteger(amount) || amount <= a.highBid) throw new Error('Bid must be higher than ' + a.highBid);
      if (amount > p.cash) throw new Error('Bid exceeds available Baht');
      const list = [];
      a.highBid = amount;
      a.highBidder = playerId;
      emit(list, 'auctionBid', { playerId, square: a.square, amount });
      if (a.active.length === 1) finishAuction(list);
      else a.turn = nextActiveAfter(a, playerId);
      return list;
    };

    game.pass = function (playerId) {
      assertPhase('auction');
      const a = state.auction;
      if (a.turn !== playerId) throw new Error('Not this player\'s turn to bid');
      const list = [];
      a.active = a.active.filter((id) => id !== playerId);
      emit(list, 'auctionPass', { playerId, square: a.square });
      const onlyLeaderLeft = a.highBidder !== null && a.active.length === 1 && a.active[0] === a.highBidder;
      if (a.active.length === 0 || onlyLeaderLeft) finishAuction(list);
      else a.turn = nextActiveAfter(a, playerId);
      return list;
    };

    game.endTurn = function () {
      assertPhase('end');
      const list = [];
      advanceTurn(list);
      return list;
    };

    // What the acting player may do right now. The UI enables buttons only from this.
    game.availableActions = function () {
      const p = current();
      const sq = state.pending ? BOARD[state.pending - 1] : null;
      return {
        actor: state.trade ? state.trade.to : state.phase === 'auction' ? state.auction.turn : state.current,
        trade: state.trade,
        canTrade: !state.trade && ['roll', 'action', 'end', 'debt'].indexOf(state.phase) !== -1,
        canRoll: state.phase === 'roll',
        canPayFine: state.phase === 'roll' && p.jailed && p.cash >= JAIL_FINE,
        canUseJailCard: state.phase === 'roll' && p.jailed && p.jailCards.length > 0,
        canBuy: state.phase === 'action' && !!sq && p.cash >= sq.price,
        canAuction: state.phase === 'action' && !!sq,
        canEndTurn: state.phase === 'end',
        canManage: !state.trade && ['roll', 'action', 'end', 'debt'].indexOf(state.phase) !== -1,
        inDebt: state.phase === 'debt',
        debtOwed: debtTotal(state.current),
        canBankrupt: !state.trade && ['roll', 'action', 'end', 'debt'].indexOf(state.phase) !== -1,
        canBid: state.phase === 'auction'
      };
    };

    // Every action that can change anyone's cash ends by sweeping cash into open debts and, if the current
    // player's last debt just cleared, letting the interrupted turn continue.
    ['roll', 'payJailFine', 'useJailCard', 'buy', 'declineToAuction', 'bid', 'pass', 'endTurn',
     'mortgage', 'unmortgage', 'build', 'sellBuilding', 'declareBankruptcy', 'proposeTrade', 'respondTrade'].forEach((name) => {
      const action = game[name];
      game[name] = function () {
        const list = action.apply(this, arguments);
        if (state.phase !== 'over') { settleDebts(list); afterSettle(list); }
        return list;
      };
    });

    game.debtsOf = debtsOf;
    game.debtTotal = debtTotal;
    game.current = current;
    game.ownedBy = ownedBy;
    game.rentFor = rentFor;
    return game;
  }

  return {
    createGame,
    CONSTANTS: {
      START_SQUARE, JAIL_SQUARE, SONGKRAN_SQUARE, GO_TO_JAIL_SQUARE, PASS_START_SALARY, LAND_START_SALARY,
      JAIL_FINE, MAX_JAIL_TURNS, TAX_10_CAP, LUXURY_TAX, AIRPORT_RENT, STARTING_CASH_OPTIONS
    }
  };
});
