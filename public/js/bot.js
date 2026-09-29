// Bot players. Easy = deliberately imperfect (GAME_DESIGN.md section 12). Decisions are pure
// functions of the engine state plus an injected rng, so bots run the same in a Node server (Phase 4).
(function (root, factory) {
  const data = (typeof module === 'object' && module.exports) ? require('./data.js') : root.SiamData;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiamBot = api;
})(typeof self !== 'undefined' ? self : this, function (data) {
  'use strict';
  const { BOARD } = data;

  const RESERVE = 1000;           // never spend below this when buying
  const BUY_CHANCE = 0.6;         // Easy bots pass on affordable properties fairly often
  const JAIL_FINE_MIN_CASH = 5000;

  const round10 = (n) => Math.max(1, Math.round(n / 10) * 10);
  const valuations = new WeakMap(); // auction object -> { playerId: max bid }

  const easy = {
    level: 'easy',
    thinkMs: 700,

    // 'pay' the fine or 'roll' for doubles
    decideJail(game, playerId) {
      return game.state.players[playerId].cash > JAIL_FINE_MIN_CASH ? 'pay' : 'roll';
    },

    // 'buy' or 'auction' for the property the bot just landed on
    decideOffer(game, playerId, rng) {
      const p = game.state.players[playerId];
      const sq = BOARD[game.state.pending - 1];
      if (p.cash - sq.price < RESERVE) return 'auction';
      return rng() < BUY_CHANCE ? 'buy' : 'auction';
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
