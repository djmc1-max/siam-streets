// Siam Streets game engine — rules only, no DOM (GAME_DESIGN.md sections 6-14, 16, 18).
// Every action returns an ordered list of events. The engine applies state changes
// immediately; each event carries a `balances` snapshot so the UI can animate money in
// sync. Runs in the browser today and moves to the Node server unchanged in Phase 4.
(function (root, factory) {
  const data = (typeof module === 'object' && module.exports) ? require('./data.js') : root.SiamData;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiamEngine = api;
})(typeof self !== 'undefined' ? self : this, function (data) {
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
  const UTILITY_MULTIPLIER = { 1: 40, 2: 100 };
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
    const emit = (list, type, extra) => { list.push(Object.assign({ type }, extra, { balances: balances() })); };
    const rollDie = () => {
      const r = game.rng();
      if (!(r >= 0 && r < 1)) throw new Error('rng must return a number in [0, 1), got ' + r);
      return 1 + Math.floor(r * 6);
    };
    const ownedBy = (playerId) => Object.keys(state.owners).filter((id) => state.owners[id] === playerId).map(Number);

    function rentFor(sq, ownerId, diceTotal) {
      if (sq.type === 'property') return sq.rent[0]; // unimproved rent, Section 6 (houses arrive in Phase 3)
      const owned = ownedBy(ownerId).map((id) => BOARD[id - 1]);
      if (sq.type === 'airport') return AIRPORT_RENT[owned.filter((s) => s.type === 'airport').length - 1];
      if (sq.type === 'utility') return diceTotal * UTILITY_MULTIPLIER[Math.min(2, owned.filter((s) => s.type === 'utility').length)];
      return 0;
    }

    // Moves money. creditor is a player id, 'bank' or 'pot'. If the payer is short, all their
    // cash is handed over (a tax shortfall goes to the bank) and the caller declares bankruptcy.
    function charge(payer, amount, creditor) {
      const paid = Math.min(amount, payer.cash);
      payer.cash -= paid;
      if (typeof creditor === 'number') state.players[creditor].cash += paid;
      else if (creditor === 'pot' && paid === amount) state.songkranPot += paid;
      return { paid, short: paid < amount };
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
      released.forEach((id) => { delete state.owners[id]; });
      p.jailCards.forEach((id) => state.decks.treasure.push(id)); // held jail cards go back to the deck
      p.jailCards = [];
      p.bankrupt = true;
      p.jailed = false;
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
      state.phase = 'roll';
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
        if (r.short) declareBankrupt(p, 'bank', list);
      } else if (fx.type === 'collectEach') {
        const from = [];
        state.players.forEach((q) => {
          if (q.id === p.id || q.bankrupt) return;
          const r = charge(q, fx.amount, p.id);
          from.push(q.id);
          if (r.short) declareBankrupt(q, p.id, list);
        });
        emit(list, 'cardEffect', { playerId: p.id, kind: 'collectEach', amount: fx.amount, from });
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
        if (r.short) declareBankrupt(p, 'bank', list);
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
        } else if (ownerId !== p.id) {
          const amount = rentFor(sq, ownerId, total);
          const r = charge(p, amount, ownerId);
          emit(list, 'rent', { playerId: p.id, ownerId, square: sq.id, amount, paid: r.paid });
          if (r.short) declareBankrupt(p, ownerId, list);
        }
      }

      if (state.pending !== null || state.auction) return; // waiting on a buy/auction decision
      if (state.phase === 'over') return;
      if (p.bankrupt) { advanceTurn(list); return; }
      if (p.jailed) { state.extraRoll = false; state.phase = 'end'; return; }
      finishAction(list);
    }

    // ---------- public actions ----------
    function assertPhase(phase) {
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
        actor: state.phase === 'auction' ? state.auction.turn : state.current,
        canRoll: state.phase === 'roll',
        canPayFine: state.phase === 'roll' && p.jailed && p.cash >= JAIL_FINE,
        canUseJailCard: state.phase === 'roll' && p.jailed && p.jailCards.length > 0,
        canBuy: state.phase === 'action' && !!sq && p.cash >= sq.price,
        canAuction: state.phase === 'action' && !!sq,
        canEndTurn: state.phase === 'end',
        canBid: state.phase === 'auction'
      };
    };

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
