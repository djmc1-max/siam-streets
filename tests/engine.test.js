'use strict';
// Rules tests for the Siam Streets engine. Run: node --test tests/
const test = require('node:test');
const { BOARD } = require('../public/js/data.js');
const { CONSTANTS } = require('../public/js/engine.js');
const { assert, money, newGame, rig, placeBefore, types, sectionTable } = require('./helpers.js');

// ---- Section 6/7/8 tables are read straight from GAME_DESIGN.md ----
test('Section 6: all 22 properties match the pricing table (price + every rent level)', () => {
  const rows = sectionTable('## 6. PROPERTY PRICING', '## 7.').filter((c) => c.length === 9 && c[0] !== 'Property' && !c[0].startsWith('---'));
  assert.equal(rows.length, 22);
  for (const r of rows) {
    const sq = BOARD.find((s) => s.name === r[0] && s.type === 'property');
    assert.ok(sq, 'missing square ' + r[0]);
    assert.equal(sq.price, money(r[2]), r[0] + ' price');
    assert.deepEqual(sq.rent, r.slice(3).map(money), r[0] + ' rent levels');
  }
});

test('Section 6: landing on an owned property charges exactly the table rent', () => {
  const rows = sectionTable('## 6. PROPERTY PRICING', '## 7.').filter((c) => c.length === 9 && c[0] !== 'Property' && !c[0].startsWith('---'));
  for (const r of rows) {
    const sq = BOARD.find((s) => s.name === r[0] && s.type === 'property');
    const g = newGame();
    g.state.owners[sq.id] = 1;
    placeBefore(g, 0, sq.id, 7); // 3 + 4, not doubles
    rig(g, [3, 4]);
    const before = g.state.players.map((p) => p.cash);
    const ev = g.roll();
    const rent = ev.find((e) => e.type === 'rent');
    const salary = ev.some((e) => e.type === 'passStart') ? 2000 : 0;
    assert.equal(rent.amount, money(r[3]), r[0] + ' rent event');
    assert.equal(g.state.players[0].cash, before[0] - money(r[3]) + salary, r[0] + ' payer cash');
    assert.equal(g.state.players[1].cash, before[1] + money(r[3]), r[0] + ' owner cash');
  }
});

test('Section 7: airport rent scales 500/1000/2000/4000 with airports owned', () => {
  const rows = sectionTable('## 7. AIRPORTS', '## 8.').filter((c) => /^\d$/.test(c[0]));
  assert.deepEqual(rows.map((r) => money(r[1])), CONSTANTS.AIRPORT_RENT);
  const airports = BOARD.filter((s) => s.type === 'airport').map((s) => s.id);
  assert.deepEqual(airports, [6, 16, 26, 36]);
  rows.forEach((r, i) => {
    const g = newGame();
    airports.slice(0, i + 1).forEach((id) => { g.state.owners[id] = 1; });
    placeBefore(g, 0, 6, 7); rig(g, [3, 4]);
    const rent = g.roll().find((e) => e.type === 'rent');
    assert.equal(rent.amount, money(r[1]), (i + 1) + ' airport(s)');
  });
});

test('Section 8: Thai Massage rent = dice x40 (one) or x100 (both)', () => {
  const g1 = newGame(); g1.state.owners[13] = 1; placeBefore(g1, 0, 13, 9); rig(g1, [4, 5]);
  assert.equal(g1.roll().find((e) => e.type === 'rent').amount, 9 * 40);
  const g2 = newGame(); g2.state.owners[13] = 1; g2.state.owners[29] = 1; placeBefore(g2, 0, 13, 9); rig(g2, [4, 5]);
  assert.equal(g2.roll().find((e) => e.type === 'rent').amount, 9 * 100);
  assert.equal(BOARD[12].price, 1500);
});

test('no rent on your own property or on unowned squares', () => {
  const g = newGame(); g.state.owners[9] = 0; placeBefore(g, 0, 9, 7); rig(g, [3, 4]);
  const ev = g.roll();
  assert.ok(!ev.some((e) => e.type === 'rent'));
  assert.equal(g.state.phase, 'end');
});

// ---- Start salary ----
test('passing Start pays 2,000; landing ON Start pays 4,000 (not both)', () => {
  const g = newGame(); g.state.players[0].pos = 38; rig(g, [1, 3]); // 4 -> square 2 (Khao San Rd), crosses Start
  let ev = g.roll();
  assert.equal(g.state.players[0].cash, 17000);
  assert.deepEqual(types(ev).slice(0, 5), ['rolled', 'move', 'passStart', 'move', 'land']);
  assert.equal(ev.find((e) => e.type === 'passStart').amount, 2000);

  const h = newGame(); h.state.players[0].pos = 36; rig(h, [2, 3]); // 5 -> square 1
  ev = h.roll();
  assert.equal(h.state.players[0].pos, 1);
  assert.equal(h.state.players[0].cash, 19000);
  assert.ok(!ev.some((e) => e.type === 'passStart'));
  assert.equal(ev.find((e) => e.type === 'landStart').amount, 4000);
});

test('tokens move the exact number of squares, clockwise, wrapping past 40', () => {
  const g = newGame(); g.state.players[0].pos = 39; rig(g, [3, 4]);
  const ev = g.roll();
  const steps = ev.filter((e) => e.type === 'move').flatMap((e) => e.path);
  assert.deepEqual(steps, [40, 1, 2, 3, 4, 5, 6]);
  assert.equal(g.state.players[0].pos, 6);
});

// ---- Buying and turn cycle ----
test('full turn: roll -> offer -> buy -> end turn passes to the next player', () => {
  const g = newGame(); rig(g, [2, 4]); // 6 -> Nana Plaza (square 7)
  const start = g.availableActions();
  assert.ok(start.canRoll && !start.canBuy && !start.canEndTurn);
  const ev = g.roll();
  assert.deepEqual(types(ev), ['rolled', 'move', 'land', 'offer']);
  assert.equal(g.state.players[0].pos, 7);
  const a = g.availableActions();
  assert.ok(a.canBuy && a.canAuction && !a.canRoll && !a.canEndTurn);
  const bought = g.buy();
  assert.equal(bought[0].price, BOARD[6].price);
  assert.equal(g.state.players[0].cash, 15000 - BOARD[6].price);
  assert.equal(g.state.owners[7], 0);
  assert.ok(g.availableActions().canEndTurn);
  const turn = g.endTurn();
  assert.equal(turn[0].type, 'turn');
  assert.equal(g.state.current, 1);
  assert.ok(g.availableActions().canRoll);
});

test('actions are rejected out of phase', () => {
  const g = newGame();
  assert.throws(() => g.endTurn());
  assert.throws(() => g.buy());
  rig(g, [2, 4]); g.roll(); // offer on Nana Plaza: must buy or auction first
  assert.throws(() => g.roll());
  assert.throws(() => g.endTurn());
  g.buy();
  assert.throws(() => g.buy());
  assert.throws(() => g.roll());
});

test('turn order cycles through all players and skips the bankrupt', () => {
  const g = newGame(3);
  g.state.players[1].bankrupt = true;
  rig(g, [1, 3]); g.roll(); // square 5 (tax): nothing to decide
  g.endTurn();
  assert.equal(g.state.current, 2);
});

// ---- Doubles (Section 14) ----
test('doubles: roll again after the action; End Turn is not allowed until a non-double', () => {
  const g = newGame(); rig(g, [3, 3], [1, 2]); // 6 -> square 7 (Nana Plaza)
  let ev = g.roll();
  assert.ok(types(ev).includes('offer'));
  ev = g.buy();
  assert.ok(types(ev).includes('doubles'));
  assert.equal(g.state.phase, 'roll');
  assert.throws(() => g.endTurn());
  const ev2 = g.roll(); // non-double: same player's second roll of the turn
  assert.equal(g.state.current, 0);
  assert.equal(g.state.dice.join(), '1,2');
  assert.ok(!types(ev2).includes('doubles'));
  assert.equal(g.state.phase, 'action'); // 7 + 3 = square 10 (Pattaya) is up for sale
});

test('three doubles in a row sends the player straight to prison without moving', () => {
  const g = newGame();
  rig(g, [1, 1], [2, 2], [3, 3]);
  g.roll(); if (g.state.phase === 'action') g.buy(); if (g.state.phase === 'auction') { /* bots not involved */ }
  // resolve whatever the first two landings asked for
  const settle = () => {
    while (g.state.phase === 'action') g.declineToAuction();
    while (g.state.phase === 'auction') g.pass(g.state.auction.turn);
  };
  settle();
  if (g.state.phase === 'roll') g.roll();
  settle();
  const posBefore = g.state.players[0].pos;
  assert.equal(g.state.phase, 'roll');
  const ev = g.roll();
  assert.deepEqual(types(ev), ['rolled', 'jailed']);
  assert.equal(ev[1].reason, 'doubles');
  assert.equal(g.state.players[0].pos, 11);
  assert.ok(g.state.players[0].jailed);
  assert.notEqual(posBefore, 11);
  assert.equal(g.state.phase, 'end');
  assert.equal(g.state.players[0].cash > 0, true);
});

// ---- Jail (Section 13) ----
test('Go To Prison: straight to square 11, no Start salary', () => {
  const g = newGame(); placeBefore(g, 0, 31, 6); rig(g, [2, 4]);
  const cash = g.state.players[0].cash;
  const ev = g.roll();
  assert.ok(types(ev).includes('jailed'));
  assert.equal(g.state.players[0].pos, 11);
  assert.equal(g.state.players[0].cash, cash);
  assert.equal(g.state.phase, 'end');
});

test('jail: pay 500 to leave, then roll normally', () => {
  const g = newGame(); g.state.players[0].jailed = true; g.state.players[0].pos = 11;
  assert.ok(g.availableActions().canPayFine);
  g.payJailFine();
  assert.equal(g.state.players[0].cash, 14500);
  assert.ok(!g.state.players[0].jailed);
  assert.equal(g.state.phase, 'roll');
});

test('jail: doubles free you and you move, but get no extra turn', () => {
  const g = newGame(); g.state.players[0].jailed = true; g.state.players[0].pos = 11; rig(g, [2, 2]); // 4 -> square 15
  const ev = g.roll();
  assert.equal(ev.find((e) => e.type === 'jailFreed').reason, 'doubles');
  assert.equal(g.state.players[0].pos, 15);
  g.state.pending && g.declineToAuction();
  while (g.state.phase === 'auction') g.pass(g.state.auction.turn);
  assert.equal(g.state.phase, 'end');
});

test('jail: three failed rolls release the player for free, who then moves', () => {
  const g = newGame(2); const p = g.state.players[0]; p.jailed = true; p.pos = 11;
  rig(g, [1, 2], [1, 2], [1, 2]);
  let ev = g.roll(); assert.equal(ev.at(-1).type, 'jailStay'); assert.equal(ev.at(-1).attempt, 1); g.endTurn();
  g.state.current = 1; g.state.phase = 'end'; g.endTurn(); // back to player 0
  ev = g.roll(); assert.equal(ev.at(-1).attempt, 2); g.endTurn();
  g.state.current = 1; g.state.phase = 'end'; g.endTurn();
  const cash = p.cash;
  ev = g.roll();
  assert.equal(ev.find((e) => e.type === 'jailFreed').reason, 'time');
  assert.ok(!p.jailed);
  assert.equal(p.cash, cash); // released free: no fine
  assert.equal(p.pos, 14);    // 11 + 3
});

test('jail: an imprisoned owner still collects rent', () => {
  const g = newGame(); g.state.players[1].jailed = true; g.state.owners[2] = 1; placeBefore(g, 0, 2, 7); rig(g, [3, 4]);
  const before = g.state.players[1].cash;
  g.roll();
  assert.equal(g.state.players[1].cash, before + 20);
});

// ---- Tax + Songkran (Sections 10, 11) ----
test('10% Tax: the lesser of 10% of cash and 2,000, paid into the Songkran pot', () => {
  const g = newGame(); rig(g, [1, 3]); // 4 squares from Start -> square 5
  g.roll(); // cash 15000 -> 10% = 1500
  assert.equal(g.state.players[0].cash, 13500);
  assert.equal(g.state.songkranPot, 1500);

  const rich = newGame(2, { startingCash: 30000 }); rig(rich, [1, 3]);
  rich.roll(); // 10% = 3000 -> capped at 2000
  assert.equal(rich.state.players[0].cash, 28000);
  assert.equal(rich.state.songkranPot, 2000);
});

test('Luxury Tax is a flat 1,000 into the pot; landing on Songkran collects the whole pot', () => {
  const g = newGame(); placeBefore(g, 0, 39, 7); rig(g, [3, 4]); g.roll();
  assert.equal(g.state.songkranPot, 1000);
  assert.equal(g.state.players[0].cash, 14000);
  g.endTurn(); g.state.current = 0; g.state.phase = 'roll'; g.state.players[1].pos = 16; // player 1 idle
  placeBefore(g, 0, 21, 7); rig(g, [3, 4]);
  const ev = g.roll();
  assert.equal(ev.find((e) => e.type === 'songkran').amount, 1000);
  assert.equal(g.state.songkranPot, 0);
  assert.equal(g.state.players[0].cash, 15000);
});

// ---- Auction (Section 18) ----
function offerGame(n = 3, cash) {
  const g = newGame(n); if (cash !== undefined) g.state.players[0].cash = cash;
  placeBefore(g, 0, 2, 7); rig(g, [3, 4]); // Khao San Rd, 600
  return g;
}

test('auction: everyone but the decliner bids; highest bidder pays and owns the property', () => {
  const g = offerGame(3); const ev0 = g.roll(); assert.ok(types(ev0).includes('offer'));
  const ev = g.declineToAuction();
  assert.deepEqual(ev.find((e) => e.type === 'auctionStart').bidders, [1, 2]);
  assert.equal(g.availableActions().actor, 1);
  assert.throws(() => g.bid(0, 100), /turn/);
  g.bid(1, 100); assert.equal(g.availableActions().actor, 2);
  assert.throws(() => g.bid(2, 100), /higher/);
  g.bid(2, 200);
  const res = g.pass(1);
  const won = res.find((e) => e.type === 'auctionWon');
  assert.equal(won.playerId, 2); assert.equal(won.amount, 200);
  assert.equal(g.state.owners[2], 2);
  assert.equal(g.state.players[2].cash, 14800);
  assert.equal(g.state.players[0].cash > 0, true);
  assert.equal(g.state.phase, 'end');
});

test('auction: minimum bid is 1; no bids leaves the property with the bank', () => {
  const g = offerGame(3); g.roll(); g.declineToAuction();
  assert.throws(() => g.bid(1, 0));
  g.pass(1); const res = g.pass(2);
  assert.ok(types(res).includes('auctionNoSale'));
  assert.equal(g.state.owners[2], undefined);
  assert.equal(g.state.phase, 'end');
});

test('auction: starts automatically when the landing player cannot afford the property', () => {
  const g = newGame(2); g.state.players[0].cash = 100; rig(g, [2, 4]); // Nana Plaza costs 1,000
  const ev = g.roll();
  assert.deepEqual(types(ev).slice(-3), ['land', 'cantAfford', 'auctionStart']);
  assert.equal(g.state.phase, 'auction');
  assert.ok(!g.availableActions().canBuy);
  g.bid(1, 1); // the sole bidder wins for the minimum bid (Section 18 as written)
  assert.equal(g.state.owners[7], 1);
  assert.equal(g.state.players[1].cash, 14999);
});

// ---- Bankruptcy (Section 16) ----
test('bankruptcy: cash goes to the creditor, properties return to the bank, last player wins', () => {
  const g = newGame(2);
  g.state.owners[40] = 1; g.state.owners[38] = 0; // P1 owns Sukhumvit (rent 500); P0 owns Sathorn
  g.state.players[0].cash = 300;
  placeBefore(g, 0, 40, 7); rig(g, [3, 4]);
  const ev = g.roll();
  const rent = ev.find((e) => e.type === 'rent');
  assert.equal(rent.amount, 500); assert.equal(rent.paid, 300);
  assert.equal(g.state.players[1].cash, 15300);
  const b = ev.find((e) => e.type === 'bankrupt');
  assert.deepEqual(b.released, [38]);
  assert.equal(g.state.owners[38], undefined);
  assert.equal(g.state.owners[40], 1);
  assert.ok(g.state.players[0].bankrupt);
  assert.equal(ev.at(-1).type, 'gameOver');
  assert.equal(g.state.winner, 1);
  assert.equal(g.state.phase, 'over');
});

test('bankruptcy in a 3-player game passes the turn and the game continues', () => {
  const g = newGame(3); g.state.owners[40] = 2; g.state.players[0].cash = 10;
  placeBefore(g, 0, 40, 7); rig(g, [3, 4]);
  const ev = g.roll();
  assert.ok(types(ev).includes('bankrupt') && !types(ev).includes('gameOver'));
  assert.equal(g.state.current, 1);
  assert.equal(g.state.phase, 'roll');
  assert.equal(ev.at(-1).type, 'turn');
});

test('every event carries a per-player balances snapshot', () => {
  const g = newGame(); rig(g, [2, 4]);
  const ev = g.roll();
  ev.forEach((e) => { assert.equal(e.balances.length, 2); });
  assert.deepEqual(g.buy()[0].balances, [15000 - BOARD[6].price, 15000]);
});

test('settings: starting Baht must be one of the Section 12 options, 2-6 players', () => {
  assert.throws(() => newGame(2, { startingCash: 12345 }));
  assert.throws(() => newGame(1));
  assert.throws(() => newGame(7));
  [10000, 15000, 20000, 25000, 30000].forEach((c) => assert.equal(newGame(2, { startingCash: c }).state.players[0].cash, c));
});
