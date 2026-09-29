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

    // A whole-Baht bid, or null to pass
    decideBid(game, playerId, rng) {
      const a = game.state.auction;
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

  return { easy, forLevel: (level) => (level === 'easy' ? easy : easy) };
});
