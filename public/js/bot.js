// Bot players. Easy = deliberately imperfect (GAME_DESIGN.md section 12). Decisions are pure
// functions of the engine state plus an injected rng, so bots run the same in a Node server (Phase 4).
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const data = node ? require('./data.js') : root.SiamData;
  const rules = node ? require('./rules.js') : root.SiamRules;
  const api = factory(data, rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiamBot = api;
})(typeof self !== 'undefined' ? self : this, function (data, Rules) {
  'use strict';
  const { BOARD } = data;

  const RESERVE = 1000;           // never spend below this when buying
  const BUY_CHANCE = 0.6;         // Easy bots pass on affordable properties fairly often
  const JAIL_FINE_MIN_CASH = 5000;
  const BUILD_RESERVE = 2500;     // cash an Easy bot keeps after building
  const UNMORTGAGE_RESERVE = 4000;
  const BUILD_SKIP_CHANCE = 0.25; // Easy bots sometimes just don't
  const JAIL_CARD_VALUE = 500;
  const MAX_BOT_COUNTER_ROUND = 3;  // an Easy bot stops haggling after a couple of rounds

  const round10 = (n) => Math.max(1, Math.round(n / 10) * 10);
  const valuations = new WeakMap(); // auction object -> { playerId: max bid }

  const easy = {
    level: 'easy',
    thinkMs: 700,

    // 'card' (use a Get Out of Jail Free card), 'pay' the fine or 'roll' for doubles
    decideJail(game, playerId) {
      const p = game.state.players[playerId];
      if (p.jailCards.length > 0) return 'card';
      return p.cash > JAIL_FINE_MIN_CASH ? 'pay' : 'roll';
    },

    // 'buy' or 'auction' for the property the bot just landed on
    decideOffer(game, playerId, rng) {
      const p = game.state.players[playerId];
      const sq = BOARD[game.state.pending - 1];
      if (p.cash - sq.price < RESERVE) return 'auction';
      return rng() < BUY_CHANCE ? 'buy' : 'auction';
    },

    // In debt (Section 17): sell the most valuable building first, then mortgage the most valuable property,
    // and give up only when nothing is left to raise cash with. Returns an action for the turn loop.
    decideDebt(game, playerId) {
      const state = game.state;
      let best = null;
      Rules.ownedIds(state, playerId).forEach((id) => {
        const c = Rules.checkSell(state, playerId, id);
        if (c.ok && (!best || c.amount > best.amount)) best = { type: 'sell', square: id, amount: c.amount };
      });
      if (best) return { type: best.type, square: best.square };
      Rules.ownedIds(state, playerId).forEach((id) => {
        const c = Rules.checkMortgage(state, playerId, id);
        if (c.ok && (!best || c.amount > best.amount)) best = { type: 'mortgage', square: id, amount: c.amount };
      });
      return best ? { type: best.type, square: best.square } : { type: 'bankrupt' };
    },

    // Answer a trade offer made TO this bot (Section 19): 'accept', 'decline' or { counter }.
    // Easy logic: value what it gets against what it gives (mortgaged property is worth half), refuse to hand
    // anyone a full colour set, and ask for extra cash when the offer is only a little short.
    decideTrade(game, botId, trade, rng) {
      const state = game.state;
      const receive = trade.give;    // the proposer gives this to the bot
      const give = trade.get;        // and wants this from the bot
      const value = (side) => side.props.reduce((sum, id) => sum + Rules.sqOf(id).price * (Rules.isMortgaged(state, id) ? 0.5 : 1), 0)
        + side.cash + side.cards.length * JAIL_CARD_VALUE;

      // who would own what afterwards
      const after = Object.assign({}, state.owners);
      receive.props.forEach((id) => { after[id] = botId; });
      give.props.forEach((id) => { after[id] = trade.from; });
      const groupPrice = (g) => Rules.GROUP_SQUARES[g].reduce((sum, id) => sum + Rules.sqOf(id).price, 0);
      let bonus = 0;
      Object.keys(Rules.GROUP_SQUARES).forEach((g) => {
        const ids = Rules.GROUP_SQUARES[g];
        const owns = (who, owners) => ids.every((id) => owners[id] === who);
        if (owns(botId, after) && !owns(botId, state.owners)) bonus += 0.5 * groupPrice(g);            // completes MY set
        if (owns(botId, state.owners) && !owns(botId, after)) bonus -= 0.6 * groupPrice(g);            // breaks my set
        if (owns(trade.from, after) && !owns(trade.from, state.owners)) bonus -= 1.0 * groupPrice(g);  // hands them a set
      });

      const giveValue = value(give);
      const gain = value(receive) - giveValue + bonus;
      const threshold = Math.max(100, 0.1 * giveValue);
      const jitter = 1 + (rng() - 0.5) * 0.1;
      if (gain * jitter >= threshold) return 'accept';

      if (trade.round < MAX_BOT_COUNTER_ROUND && gain > -0.4 * Math.max(giveValue, 500)) {
        const need = Math.ceil((threshold - gain) / 50) * 50;                 // ask for the shortfall in cash
        const proposer = state.players[trade.from];
        if (need > 0 && proposer.cash >= receive.cash + need) {
          const counter = {
            give: { props: give.props.slice(), cash: give.cash, cards: give.cards.slice() },
            get: { props: receive.props.slice(), cash: receive.cash + need, cards: receive.cards.slice() }
          };
          if (Rules.checkTrade(state, botId, trade.from, counter.give, counter.get).ok) return { counter };
        }
      }
      return 'decline';
    },

    // A square to build on, or null. Cheapest legal build first, and never below the reserve.
    decideBuild(game, playerId, rng) {
      const state = game.state;
      const p = state.players[playerId];
      if (rng() < BUILD_SKIP_CHANCE) return null;
      let best = null;
      Rules.ownedIds(state, playerId).forEach((id) => {
        const sq = Rules.sqOf(id);
        const c = Rules.checkBuild(state, playerId, id);
        if (!c.ok || p.cash - c.amount < BUILD_RESERVE) return;
        if (!best || c.amount < best.cost || (c.amount === best.cost && Rules.levelOf(state, id) < best.level)) {
          best = { id, cost: c.amount, level: Rules.levelOf(state, id) };
        }
      });
      return best ? best.id : null;
    },

    // A mortgaged square to buy back, or null. Only when comfortably rich.
    decideUnmortgage(game, playerId) {
      const state = game.state;
      const p = state.players[playerId];
      let best = null;
      Rules.ownedIds(state, playerId).forEach((id) => {
        if (!Rules.isMortgaged(state, id)) return;
        const value = Rules.mortgageValue(Rules.sqOf(id));
        if (p.cash - value >= UNMORTGAGE_RESERVE && (!best || value < best.value)) best = { id, value };
      });
      return best ? best.id : null;
    },

    // A whole-Baht bid that tops the current one, or null to stay quiet. Open bidding (Section 18): bots look
    // again after every new high bid and never outbid themselves.
    decideBid(game, playerId, rng) {
      const a = game.state.auction;
      if (a.highBidder === playerId) return null;
      const p = game.state.players[playerId];
      const sq = BOARD[a.square - 1];
      if (!valuations.has(a)) valuations.set(a, {});
      const table = valuations.get(a);
      if (table[playerId] === undefined) table[playerId] = Math.min(p.cash, round10(sq.price * (0.5 + rng() * 0.3)));
      const limit = table[playerId];
      const step = round10(sq.price * 0.05);
      const next = a.highBid === 0 ? round10(limit * 0.5) : a.highBid + step;
      return next <= limit && next <= p.cash ? next : null;
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Hard bot (Section 12): buys almost everything it can afford, chases colour sets, bids up to the value
  // of a property that completes a set, builds aggressively on a small reserve, unmortgages promptly, pays
  // the jail fine early and sits tight late, and judges trades rationally. Like Easy it never starts trades.
  // ---------------------------------------------------------------------------------------------
  const H_RESERVE = 250;
  const H_BUILD_RESERVE = 500;
  const H_UNMORTGAGE_RESERVE = 1200;

  const unownedCount = (state) => BOARD.filter((sq) => Rules.isBuyable(sq) && state.owners[sq.id] === undefined).length;
  const groupPrice = (g) => Rules.GROUP_SQUARES[g].reduce((sum, id) => sum + Rules.sqOf(id).price, 0);

  // 0 = no set at stake, 1 = completes MY set, 2 = stops somebody else completing theirs
  function setStake(state, playerId, sq) {
    if (!sq.group) return 0;
    const others = Rules.GROUP_SQUARES[sq.group].filter((id) => id !== sq.id);
    if (others.every((id) => state.owners[id] === playerId)) return 1;
    const first = state.owners[others[0]];
    if (first !== undefined && first !== playerId && others.every((id) => state.owners[id] === first)) return 2;
    return 0;
  }

  const hard = {
    level: 'hard',
    thinkMs: 700,

    decideJail(game, playerId) {
      const p = game.state.players[playerId];
      if (p.jailCards.length > 0) return 'card';
      const early = unownedCount(game.state) >= 6;          // plenty left to buy: get out and shop
      if (early && p.cash >= 1500) return 'pay';
      return p.cash >= 9000 ? 'pay' : 'roll';               // late, jail is a safe place to sit
    },

    decideOffer(game, playerId) {
      const p = game.state.players[playerId];
      const sq = BOARD[game.state.pending - 1];
      const stake = setStake(game.state, playerId, sq);
      if (stake) return p.cash >= sq.price ? 'buy' : 'auction';
      return p.cash - sq.price >= H_RESERVE ? 'buy' : 'auction';
    },

    decideDebt: easy.decideDebt,

    decideTrade(game, botId, trade) {
      const state = game.state;
      const receive = trade.give;
      const give = trade.get;
      const value = (side) => side.props.reduce((sum, id) => sum + Rules.sqOf(id).price * (Rules.isMortgaged(state, id) ? 0.5 : 1), 0)
        + side.cash + side.cards.length * 700;
      const after = Object.assign({}, state.owners);
      receive.props.forEach((id) => { after[id] = botId; });
      give.props.forEach((id) => { after[id] = trade.from; });
      let bonus = 0;
      Object.keys(Rules.GROUP_SQUARES).forEach((g) => {
        const ids = Rules.GROUP_SQUARES[g];
        const owns = (who, owners) => ids.every((id) => owners[id] === who);
        if (owns(botId, after) && !owns(botId, state.owners)) bonus += 0.9 * groupPrice(g);
        if (owns(botId, state.owners) && !owns(botId, after)) bonus -= 1.0 * groupPrice(g);
        if (owns(trade.from, after) && !owns(trade.from, state.owners)) bonus -= 1.4 * groupPrice(g);
      });
      const giveValue = value(give);
      const gain = value(receive) - giveValue + bonus;
      const threshold = Math.max(100, 0.08 * giveValue);
      if (gain >= threshold) return 'accept';
      if (trade.round < 4 && gain > -0.6 * Math.max(giveValue, 500)) {
        const need = Math.ceil((threshold - gain) / 50) * 50;
        const proposer = state.players[trade.from];
        if (need > 0 && proposer.cash >= receive.cash + need) {
          const counter = {
            give: { props: give.props.slice(), cash: give.cash, cards: give.cards.slice() },
            get: { props: receive.props.slice(), cash: receive.cash + need, cards: receive.cards.slice() }
          };
          if (Rules.checkTrade(state, botId, trade.from, counter.give, counter.get).ok) return { counter };
        }
      }
      return 'decline';
    },

    // The legal build with the best extra rent per Baht spent
    decideBuild(game, playerId) {
      const state = game.state;
      const p = state.players[playerId];
      let best = null;
      Rules.ownedIds(state, playerId).forEach((id) => {
        const sq = Rules.sqOf(id);
        const c = Rules.checkBuild(state, playerId, id);
        if (!c.ok || p.cash - c.amount < H_BUILD_RESERVE) return;
        const lvl = Rules.levelOf(state, id);
        const gain = (sq.rent[lvl + 1] - sq.rent[lvl]) / c.amount;
        if (!best || gain > best.gain) best = { id, gain };
      });
      return best ? best.id : null;
    },

    decideUnmortgage(game, playerId) {
      const state = game.state;
      const p = state.players[playerId];
      let best = null;
      Rules.ownedIds(state, playerId).forEach((id) => {
        if (!Rules.isMortgaged(state, id)) return;
        const value = Rules.mortgageValue(Rules.sqOf(id));
        if (p.cash - value >= H_UNMORTGAGE_RESERVE && (!best || value < best.value)) best = { id, value };
      });
      return best ? best.id : null;
    },

    // Bid up to what the property is worth to ME: far more when it completes a set or blocks an opponent's.
    decideBid(game, playerId) {
      const a = game.state.auction;
      if (a.highBidder === playerId) return null;
      const p = game.state.players[playerId];
      const sq = BOARD[a.square - 1];
      const stake = setStake(game.state, playerId, sq);
      const worth = sq.price * (stake === 1 ? 2.0 : stake === 2 ? 1.5 : 0.9);
      const limit = Math.min(p.cash - (stake ? 100 : H_RESERVE), round10(worth));
      const step = Math.max(10, round10(sq.price * 0.04));
      const next = a.highBid === 0 ? Math.max(1, round10(sq.price * 0.15)) : a.highBid + step;
      return next <= limit ? next : null;
    }
  };

  // ---- one decision for the bot whose turn / reply it is (never an auction bid: the auction stage drives those)
  // `memo` remembers how many tidy-ups the bot has done this turn.
  function choose(bot, game, actorId, rng, memo) {
    const st = game.state;
    const av = game.availableActions();
    if (st.trade) return { type: 'tradeReply', reply: bot.decideTrade(game, actorId, st.trade, rng) };

    if ((st.phase === 'roll' || st.phase === 'end') && av.canManage) {
      if (memo.turn !== st.turn) { memo.turn = st.turn; memo.n = 0; }
      if (memo.n < (bot.level === 'hard' ? 6 : 3)) {
        const unm = bot.decideUnmortgage(game, actorId);
        if (unm) { memo.n++; return { type: 'unmortgage', square: unm }; }
        const bld = bot.decideBuild(game, actorId, rng);
        if (bld) { memo.n++; return { type: 'build', square: bld }; }
      }
    }
    if (st.phase === 'debt') return bot.decideDebt(game, actorId);
    switch (st.phase) {
      case 'roll':
        if (av.canUseJailCard && bot.decideJail(game, actorId) === 'card') return { type: 'jailCard' };
        return av.canPayFine && bot.decideJail(game, actorId) === 'pay' ? { type: 'fine' } : { type: 'roll' };
      case 'action':
        return { type: av.canBuy && bot.decideOffer(game, actorId, rng) === 'buy' ? 'buy' : 'auction' };
      default:
        return { type: 'end' };
    }
  }

  return { easy, hard, choose, forLevel: (level) => (level === 'hard' ? hard : easy) };
});
