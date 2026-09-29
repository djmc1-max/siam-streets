// Pure rules over the game state: rent, mortgages and buildings (GAME_DESIGN.md sections 6-9, 15).
// Shared by the engine (to enforce), the bots (to decide) and the UI (to enable buttons and explain why not).
(function (root, factory) {
  const data = (typeof module === 'object' && module.exports) ? require('./data.js') : root.SiamData;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SiamRules = api;
})(typeof self !== 'undefined' ? self : this, function (data) {
  'use strict';
  const { BOARD, BUILD_COST } = data;

  const AIRPORT_RENT = [500, 1000, 2000, 4000];
  const UTILITY_MULTIPLIER = { 1: 40, 2: 100 };
  const MAX_LEVEL = 5;            // 0 = none, 1-4 = houses, 5 = hotel (the Section 6 rent columns)
  const HOTEL = 5;

  const GROUP_SQUARES = {};
  BOARD.forEach((sq) => { if (sq.group) (GROUP_SQUARES[sq.group] = GROUP_SQUARES[sq.group] || []).push(sq.id); });

  const sqOf = (id) => BOARD[id - 1];
  const isBuyable = (sq) => sq.type === 'property' || sq.type === 'airport' || sq.type === 'utility';
  const levelOf = (state, id) => state.levels[id] || 0;
  const isMortgaged = (state, id) => !!state.mortgaged[id];
  const ownedIds = (state, pid) => Object.keys(state.owners).filter((id) => state.owners[id] === pid).map(Number);

  const ownsFullGroup = (state, pid, group) => GROUP_SQUARES[group].every((id) => state.owners[id] === pid);
  const groupLevels = (state, group) => GROUP_SQUARES[group].map((id) => levelOf(state, id));
  const groupHasBuildings = (state, group) => groupLevels(state, group).some((l) => l > 0);
  const groupHasMortgage = (state, group) => GROUP_SQUARES[group].some((id) => isMortgaged(state, id));

  const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');

  // Rent for landing on `sq` owned by `ownerId`.
  //  - mortgaged: nothing
  //  - property: buildings use the Section 6 table; with no buildings, the base rent is DOUBLED when the
  //    owner holds the whole colour group
  //  - airports / utilities: by how many the owner holds (mortgaged ones still count)
  function rentFor(state, sq, ownerId, diceTotal) {
    if (isMortgaged(state, sq.id)) return 0;
    if (sq.type === 'property') {
      const lvl = levelOf(state, sq.id);
      if (lvl > 0) return sq.rent[lvl];
      return ownsFullGroup(state, ownerId, sq.group) ? sq.rent[0] * 2 : sq.rent[0];
    }
    const owned = ownedIds(state, ownerId).map(sqOf);
    if (sq.type === 'airport') return AIRPORT_RENT[owned.filter((s) => s.type === 'airport').length - 1];
    if (sq.type === 'utility') return diceTotal * UTILITY_MULTIPLIER[Math.min(2, owned.filter((s) => s.type === 'utility').length)];
    return 0;
  }

  // ---------- mortgages (Section 15): 50% of the purchase price, paid back at exactly 50% ----------
  const mortgageValue = (sq) => sq.price / 2;

  function checkMortgage(state, pid, id) {
    const sq = sqOf(id);
    if (!isBuyable(sq)) return { ok: false, reason: 'Not a property' };
    if (state.owners[id] !== pid) return { ok: false, reason: 'You do not own this' };
    if (isMortgaged(state, id)) return { ok: false, reason: 'Already mortgaged' };
    if (sq.group && groupHasBuildings(state, sq.group)) return { ok: false, reason: 'Sell every house in this colour group first' };
    return { ok: true, amount: mortgageValue(sq) };
  }

  function checkUnmortgage(state, pid, id) {
    const sq = sqOf(id);
    if (!isBuyable(sq) || state.owners[id] !== pid) return { ok: false, reason: 'You do not own this' };
    if (!isMortgaged(state, id)) return { ok: false, reason: 'Not mortgaged' };
    const cost = mortgageValue(sq);
    if (state.players[pid].cash < cost) return { ok: false, reason: 'Needs ' + fmt(cost), amount: cost };
    return { ok: true, amount: cost };
  }

  // ---------- houses and hotels (Section 9) ----------
  // The next building costs the house price, or the hotel price when it upgrades 4 houses to a hotel.
  function buildCost(sq, level) {
    const c = BUILD_COST[sq.group];
    return level >= 4 ? c.hotel : c.house;
  }

  // What selling one building at `level` refunds: 50% of the house price, or of the hotel price for a hotel.
  function sellRefund(sq, level) {
    const c = BUILD_COST[sq.group];
    return Math.floor((level >= HOTEL ? c.hotel : c.house) / 2);
  }

  function checkBuild(state, pid, id) {
    const sq = sqOf(id);
    if (sq.type !== 'property') return { ok: false, reason: 'Only colour-group properties can be built on' };
    if (state.owners[id] !== pid) return { ok: false, reason: 'You do not own this' };
    if (!ownsFullGroup(state, pid, sq.group)) return { ok: false, reason: 'Own the whole colour group first' };
    if (groupHasMortgage(state, sq.group)) return { ok: false, reason: 'Unmortgage the whole group first' };
    const lvl = levelOf(state, id);
    if (lvl >= MAX_LEVEL) return { ok: false, reason: 'Already a hotel' };
    const levels = groupLevels(state, sq.group);
    if (lvl > Math.min.apply(null, levels)) {
      const lowest = GROUP_SQUARES[sq.group].find((sid) => levelOf(state, sid) === Math.min.apply(null, levels));
      return { ok: false, reason: 'Build evenly: build on ' + sqOf(lowest).name + ' first' };
    }
    const cost = buildCost(sq, lvl);
    if (state.players[pid].cash < cost) return { ok: false, reason: 'Needs ' + fmt(cost), amount: cost };
    return { ok: true, amount: cost, toLevel: lvl + 1 };
  }

  function checkSell(state, pid, id) {
    const sq = sqOf(id);
    if (sq.type !== 'property' || state.owners[id] !== pid) return { ok: false, reason: 'You do not own this' };
    const lvl = levelOf(state, id);
    if (lvl === 0) return { ok: false, reason: 'No houses to sell' };
    const levels = groupLevels(state, sq.group);
    if (lvl < Math.max.apply(null, levels)) {
      const highest = GROUP_SQUARES[sq.group].find((sid) => levelOf(state, sid) === Math.max.apply(null, levels));
      return { ok: false, reason: 'Sell evenly: sell on ' + sqOf(highest).name + ' first' };
    }
    // selling a hotel returns 50% of the hotel price and leaves 4 houses; a house returns 50% of the house price
    return { ok: true, amount: sellRefund(sq, lvl), toLevel: lvl - 1 };
  }

  return {
    GROUP_SQUARES, MAX_LEVEL, HOTEL, AIRPORT_RENT,
    sqOf, isBuyable, levelOf, isMortgaged, ownedIds, ownsFullGroup, groupLevels, groupHasBuildings, groupHasMortgage,
    rentFor, mortgageValue, buildCost, sellRefund, checkMortgage, checkUnmortgage, checkBuild, checkSell
  };
});
