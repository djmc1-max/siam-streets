'use strict';
// Randomised play: many full games using only legal actions (including cards, mortgages, buildings and
// jail cards), with the invariants checked after every single step.
const test = require('node:test');
const { BOARD, CARDS } = require('../public/js/data.js');
const Rules = require('../public/js/rules.js');
const { assert, newGame, mulberry32 } = require('./helpers.js');

function checkInvariants(g, label) {
  const st = g.state;
  st.players.forEach((p) => {
    assert.ok(Number.isInteger(p.cash) && p.cash >= 0, label + ': cash must be a non-negative integer, got ' + p.cash);
    assert.ok(p.pos >= 1 && p.pos <= 40, label + ': position out of range ' + p.pos);
    assert.ok(p.skipTurns >= 0, label + ': negative skipTurns');
    if (p.bankrupt) {
      assert.equal(g.ownedBy(p.id).length, 0, label + ': bankrupt player still owns squares');
      assert.equal(p.jailCards.length, 0, label + ': bankrupt player still holds jail cards');
    }
  });
  Object.keys(st.owners).forEach((sq) => {
    assert.ok(Rules.isBuyable(BOARD[sq - 1]), label + ': owned a non-buyable square');
    assert.ok(!st.players[st.owners[sq]].bankrupt, label + ': owner is bankrupt');
  });
  Object.keys(st.mortgaged).forEach((sq) => assert.ok(st.owners[sq] !== undefined, label + ': mortgage on an unowned square ' + sq));
  Object.keys(st.levels).forEach((sq) => {
    const s = BOARD[sq - 1];
    assert.equal(s.type, 'property', label + ': buildings on a non-property');
    assert.ok(st.levels[sq] >= 1 && st.levels[sq] <= 5, label + ': level out of range');
    assert.ok(Rules.ownsFullGroup(st, st.owners[sq], s.group), label + ': buildings without the full group on ' + s.name);
  });
  Object.keys(Rules.GROUP_SQUARES).forEach((group) => {
    const lv = Rules.groupLevels(st, group);
    if (lv.some((l) => l > 0)) {
      assert.ok(Math.max(...lv) - Math.min(...lv) <= 1, label + ': uneven buildings in ' + group + ' ' + lv);
      assert.ok(!Rules.groupHasMortgage(st, group), label + ': buildings on a group with a mortgage in ' + group);
    }
  });
  // every card exists exactly once: in its deck or in a player's hand
  const held = [].concat(...st.players.map((p) => p.jailCards));
  assert.deepEqual(st.decks.surprise.slice().sort(), CARDS.surprise.map((c) => c.id).sort(), label + ': Surprise deck changed');
  assert.deepEqual(st.decks.treasure.concat(held).sort(), CARDS.treasure.map((c) => c.id).sort(), label + ': Treasure cards lost or duplicated');
  if (st.trade) {
    assert.ok(st.trade.from !== st.trade.to && !st.players[st.trade.from].bankrupt && !st.players[st.trade.to].bankrupt, label + ': bad pending trade');
  }
  st.debts.forEach((d) => {
    assert.ok(d.amount > 0, label + ': empty debt left in the log');
    assert.ok(!st.players[d.debtor].bankrupt, label + ': debt of a bankrupt player');
    assert.ok(typeof d.creditor !== 'number' || !st.players[d.creditor].bankrupt, label + ': debt owed to a bankrupt player');
  });
  if (st.phase === 'debt') assert.ok(g.debtsOf(st.current).length > 0, label + ': debt phase without a debt');
  else if (st.phase !== 'over') assert.equal(g.debtsOf(st.current).length, 0, label + ': current player owes money outside the debt phase');
  assert.ok(st.songkranPot >= 0);
  assert.ok(!st.players[st.current].bankrupt || st.phase === 'over', label + ': current player is bankrupt');
  assert.ok(['roll', 'action', 'auction', 'end', 'debt', 'over'].includes(st.phase));
}

function randomSide(g, pid, rnd) {
  const st = g.state;
  const p = st.players[pid];
  return {
    props: Rules.ownedIds(st, pid).filter((id) => rnd() < 0.3),
    cash: rnd() < 0.5 ? Math.floor(rnd() * Math.min(p.cash, 2000)) : 0,
    cards: p.jailCards.filter(() => rnd() < 0.5)
  };
}

// A random offer from the current player to a random other player (only if it is valid).
function tryPropose(g, rnd) {
  const me = g.state.current;
  const others = g.state.players.filter((q) => !q.bankrupt && q.id !== me);
  if (!others.length) return false;
  const to = others[Math.floor(rnd() * others.length)].id;
  const give = randomSide(g, me, rnd), get = randomSide(g, to, rnd);
  if (!Rules.checkTrade(g.state, me, to, give, get).ok) return false;
  g.proposeTrade(me, to, give, get);
  return true;
}

// The receiver's random answer: accept / decline / counter (a bad answer is turned into a decline).
function respond(g, rnd, stats) {
  const t = g.state.trade;
  const r = rnd();
  if (r < 0.45) {
    if (Rules.checkTrade(g.state, t.from, t.to, t.give, t.get).ok) { g.respondTrade(t.to, 'accept'); stats.trades++; return; }
  } else if (r >= 0.75 && t.round < 6) {
    const give = randomSide(g, t.to, rnd), get = randomSide(g, t.from, rnd);
    if (Rules.checkTrade(g.state, t.to, t.from, give, get).ok) { g.respondTrade(t.to, { counter: { give, get } }); return; }
  }
  g.respondTrade(t.to, 'decline');
}

// One random property-management action, if any is legal for the current player.
function tryManage(g, rnd) {
  const st = g.state;
  const pid = st.current;
  const mine = Rules.ownedIds(st, pid);
  if (!mine.length) return false;
  const id = mine[Math.floor(rnd() * mine.length)];
  const kinds = ['mortgage', 'unmortgage', 'build', 'sell'];
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  const check = { mortgage: Rules.checkMortgage, unmortgage: Rules.checkUnmortgage, build: Rules.checkBuild, sell: Rules.checkSell }[kind](st, pid, id);
  if (!check.ok) return false;
  ({ mortgage: g.mortgage, unmortgage: g.unmortgage, build: g.build, sell: g.sellBuilding }[kind])(pid, id);
  return true;
}

test('fuzz: 300 random games never throw and always keep the invariants', () => {
  let finished = 0, built = 0, mortgaged = 0, cards = 0, debtsSeen = 0, debtPhases = 0;
  const stats = { trades: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = mulberry32(seed);
    const n = 2 + Math.floor(rnd() * 5);
    const g = newGame(n, { startingCash: [10000, 15000, 20000, 30000][seed % 4], rng: mulberry32(seed * 7919) });
    for (let step = 0; step < 5000 && g.state.phase !== 'over'; step++) {
      const a = g.availableActions();
      const p = g.state.players[a.actor];
      const label = 'seed ' + seed + ' step ' + step;
      if (g.state.trade) {
        respond(g, rnd, stats);
      } else if (g.state.phase === 'auction') {
        const auc = g.state.auction;
        const bidder = g.state.players[auc.bidders[Math.floor(rnd() * auc.bidders.length)]];
        const max = Math.min(bidder.cash, 3000);
        if (rnd() < 0.5 && max > auc.highBid) g.bid(bidder.id, auc.highBid + 1 + Math.floor(rnd() * (max - auc.highBid)));
        else g.closeAuction();
      } else if (g.state.phase === 'debt') {
        // raise money (sell a building, else mortgage), or give up when there is nothing left / at random
        const pid = g.state.current;
        const owned = Rules.ownedIds(g.state, pid);
        const sellable = owned.find((id) => Rules.checkSell(g.state, pid, id).ok);
        const mortgageable = owned.find((id) => Rules.checkMortgage(g.state, pid, id).ok);
        if (rnd() < 0.08 || (sellable === undefined && mortgageable === undefined)) { g.declareBankruptcy(pid); debtsSeen++; }
        else if (sellable !== undefined) g.sellBuilding(pid, sellable);
        else g.mortgage(pid, mortgageable);
      } else if (a.canTrade && rnd() < 0.08 && tryPropose(g, rnd)) {
        // an offer is now pending; the next loop iteration answers it
      } else if (a.canManage && rnd() < 0.3 && tryManage(g, rnd)) {
        if (Object.keys(g.state.levels).length) built++;
        if (Object.keys(g.state.mortgaged).length) mortgaged++;
      } else if (a.canBuy || a.canAuction) {
        if (a.canBuy && rnd() < 0.7) g.buy(); else g.declineToAuction();
      } else if (a.canUseJailCard && rnd() < 0.6) g.useJailCard();
      else if (a.canPayFine && rnd() < 0.3) g.payJailFine();
      else if (a.canRoll) { const ev = g.roll(); if (ev.some((e) => e.type === 'cardDrawn')) cards++; }
      else if (a.canEndTurn) g.endTurn();
      else assert.fail(label + ': no legal action in phase ' + g.state.phase);
      if (g.state.phase === 'debt') debtPhases++;
      checkInvariants(g, label);
    }
    if (g.state.phase === 'over') {
      finished++;
      assert.equal(g.state.players.filter((p) => !p.bankrupt).length, 1);
      assert.equal(g.state.winner, g.state.players.find((p) => !p.bankrupt).id);
    }
  }
  assert.ok(finished > 0, 'at least some random games should reach a winner');
  assert.ok(cards > 100 && built > 50 && mortgaged > 50 && debtPhases > 50 && stats.trades > 100, 'the fuzz must actually exercise cards, buildings, mortgages, debts and trades (' + [cards, built, mortgaged, debtPhases, stats.trades] + ')');
});
