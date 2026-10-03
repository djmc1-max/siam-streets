'use strict';
// Sections 16 and 17: partial payment, debt, resolving it, bankruptcy.
const test = require('node:test');
const { BOARD } = require('../public/js/data.js');
const Rules = require('../public/js/rules.js');
const { assert, newGame, rig, placeBefore, types, landOn } = require('./helpers.js');

// Player 0 lands on Sukhumvit (rent ฿500) owned by player 1, holding `cash`.
function rentShortfall(cash, opts = {}) {
  const g = newGame(opts.players || 2, { startingCash: 15000 });
  g.state.owners[40] = 1;
  g.state.players[0].cash = cash;
  g.state.players[0].pos = 33;            // 33 + 7 = 40 without passing Start
  rig(g, [3, 4]);
  return g;
}

test('Section 17: a shortfall pays ALL available cash to the creditor at once and logs only the remainder', () => {
  const g = rentShortfall(300);
  const ev = g.roll();
  const rent = ev.find((e) => e.type === 'rent');
  assert.equal(rent.amount, 500); assert.equal(rent.paid, 300);
  assert.equal(g.state.players[0].cash, 0);
  assert.equal(g.state.players[1].cash, 15300, 'the creditor got the available cash immediately');
  const d = ev.find((e) => e.type === 'debtLogged');
  assert.equal(d.amount, 200); assert.equal(d.creditor, 1); assert.equal(d.playerId, 0); assert.equal(d.reason, 'rent');
  assert.equal(g.debtTotal(0), 200);
  assert.equal(g.state.phase, 'debt');
  assert.ok(types(ev).indexOf('rent') < types(ev).indexOf('debtLogged'), 'payment event, then the debt notice');
});

test('Section 17: while in debt you cannot roll or end the turn; you can manage, trade later, or go bankrupt', () => {
  const g = rentShortfall(300); g.roll();
  const a = g.availableActions();
  assert.ok(!a.canRoll && !a.canEndTurn && !a.canBuy && !a.canPayFine);
  assert.ok(a.canManage && a.canBankrupt && a.inDebt);
  assert.equal(a.debtOwed, 200);
  assert.throws(() => g.roll()); assert.throws(() => g.endTurn()); assert.throws(() => g.buy());
});

test('resolving a debt: mortgage cash goes straight to the creditor and the turn continues', () => {
  const g = rentShortfall(300); g.state.owners[2] = 0; g.roll();          // owns Khao San Rd (mortgage value ฿300)
  const ev = g.mortgage(0, 2);
  assert.deepEqual(types(ev), ['mortgaged', 'debtResolved']);
  assert.equal(g.state.players[0].cash, 100, '฿300 raised, ฿200 to the creditor, ฿100 kept');
  assert.equal(g.state.players[1].cash, 15500);
  assert.equal(g.debtTotal(0), 0);
  assert.equal(g.state.phase, 'end');
  assert.ok(g.availableActions().canEndTurn);
});

test('resolving a debt by selling a house', () => {
  const g = rentShortfall(0); const own = (ids) => ids.forEach((i) => { g.state.owners[i] = 0; });
  own([2, 4]); g.state.levels[2] = 1; g.state.levels[4] = 1;
  g.state.players[0].cash = 400; g.roll();                                 // rent 500, pays 400, owes 100
  assert.equal(g.debtTotal(0), 100);
  const ev = g.sellBuilding(0, 2);                                        // Red house cost 200 -> refund 100
  assert.ok(types(ev).includes('debtResolved'));
  assert.equal(g.state.phase, 'end');
  assert.equal(g.state.players[0].cash, 0);
});

test('a debt can be paid down in several steps, oldest debt first', () => {
  const g = rentShortfall(0); g.state.owners[2] = 0; g.state.owners[4] = 0;
  g.state.players[0].cash = 0; g.roll();
  assert.equal(g.debtTotal(0), 500);
  let ev = g.mortgage(0, 2);                                              // +300
  assert.equal(ev.find((e) => e.type === 'debtPayment').remaining, 200);
  assert.equal(g.state.phase, 'debt');
  ev = g.mortgage(0, 4);                                                  // +300 -> clears, 100 left over
  assert.ok(types(ev).includes('debtResolved'));
  assert.equal(g.state.players[0].cash, 100);
  assert.equal(g.state.players[1].cash, 15000 + 500);
});

test('a double rolled before the debt still gives the extra roll once the debt is cleared', () => {
  const g = newGame(); g.state.owners[40] = 1; g.state.owners[2] = 0; g.state.players[0].pos = 36; g.state.players[0].cash = 250;
  rig(g, [2, 2]);                                                          // 36 + 4 = 40 (a double)
  g.roll();
  assert.equal(g.state.phase, 'debt');
  const ev = g.mortgage(0, 2);
  assert.ok(types(ev).includes('debtResolved') && types(ev).includes('doubles'));
  assert.equal(g.state.phase, 'roll');
});

test('taxes: a shortfall is paid into the Songkran pot immediately and the rest is owed to the pot', () => {
  const g = newGame();
  g.state.players[0].cash = 400; g.state.players[0].pos = 32; rig(g, [3, 4]);                         // 32 + 7 = 39
  const ev = g.roll();
  assert.equal(ev.find((e) => e.type === 'tax').paid, 400);
  assert.equal(g.state.songkranPot, 400);
  const d = ev.find((e) => e.type === 'debtLogged');
  assert.deepEqual([d.creditor, d.amount, d.reason], ['pot', 600, 'tax']);
  g.state.owners[2] = 0; g.mortgage(0, 2);                                                            // +300
  assert.equal(g.state.songkranPot, 700);
  assert.equal(g.debtTotal(0), 300);
});

test('cards: a fine you cannot pay becomes a debt to the bank', () => {
  const g = newGame(); g.state.players[0].cash = 200;
  g.state.decks.surprise = ['S6'].concat(g.state.decks.surprise.filter((i) => i !== 'S6'));   // pay ฿1,500
  landOn(g, 0, 8);
  assert.equal(g.state.players[0].cash, 0);
  assert.equal(g.debtTotal(0), 1300);
  assert.equal(g.state.debts[0].creditor, 'bank');
  assert.equal(g.state.phase, 'debt');
});

test('Surprise 4: players who cannot afford ฿200 pay what they have; the rest is owed and must be cleared on their turn', () => {
  const g = newGame(3); g.state.players[1].cash = 50; g.state.players[2].cash = 15000;
  g.state.decks.surprise = ['S4'].concat(g.state.decks.surprise.filter((i) => i !== 'S4'));
  landOn(g, 0, 8);
  assert.equal(g.state.players[0].cash, 15000 + 50 + 200);
  assert.equal(g.debtTotal(1), 150);
  assert.equal(g.state.phase, 'end', "the drawer's own turn is not blocked by someone else's debt");
  g.endTurn();
  assert.equal(g.state.current, 1);
  assert.equal(g.state.phase, 'debt', 'the debtor must resolve before rolling');
  assert.throws(() => g.roll());
  g.state.owners[2] = 1; g.mortgage(1, 2);                                // +300 -> pays 150, keeps 150
  assert.equal(g.state.phase, 'roll');
  assert.equal(g.state.players[1].cash, 150);
  assert.equal(g.state.players[0].cash, 15000 + 50 + 200 + 150);
});

test('a debtor who receives cash before their turn has it swept into the debt automatically', () => {
  const g = newGame(3); g.state.players[1].cash = 50; g.state.owners[26] = 1;   // player 1 owns Chiang Mai Air
  g.state.decks.surprise = ['S4'].concat(g.state.decks.surprise.filter((i) => i !== 'S4'));
  g.state.players[0].pos = 15; rig(g, [4, 4], [1, 2]);                          // 15 + 8 = Surprise (23) with a double, then 3 more = the airport
  g.roll();
  assert.equal(g.debtTotal(1), 150, 'player 1 owes player 0 the rest of the ฿200');
  assert.equal(g.state.phase, 'roll', 'the double gives player 0 another roll');
  const ev = g.roll();                                                          // player 0 pays player 1 airport rent ฿500
  assert.ok(types(ev).includes('rent') && types(ev).includes('debtResolved'), 'the rent cleared the debt on arrival');
  assert.equal(g.debtTotal(1), 0);
  assert.equal(g.state.players[1].cash, 500 - 150);
  assert.equal(g.state.players[0].cash, 15000 + 50 + 200 - 500 + 150);
  g.endTurn();
  assert.equal(g.state.current, 1);
  assert.equal(g.state.phase, 'roll', 'no debt phase, nothing left to resolve');
});

// ---------------- bankruptcy (Sections 16, 35) ----------------
test('Section 16: declaring bankruptcy hands cash to the creditor, returns properties to the bank, and in a 2-player game the other player wins', () => {
  const g = rentShortfall(300); g.state.owners[38] = 0; g.state.levels = {}; g.roll();
  const ev = g.declareBankruptcy(0);
  const b = ev.find((e) => e.type === 'bankrupt');
  assert.deepEqual(b.released, [38]);
  assert.equal(g.state.owners[38], undefined);
  assert.equal(g.state.owners[40], 1, "the creditor's property is untouched");
  assert.ok(g.state.players[0].bankrupt);
  assert.equal(g.debtTotal(0), 0);
  assert.equal(ev.at(-1).type, 'gameOver');
  assert.equal(g.state.winner, 1);
  assert.equal(g.state.phase, 'over');
});

test('bankruptcy in a 3-player game passes the turn on and the game continues', () => {
  const g = rentShortfall(10, { players: 3 }); g.roll();
  const ev = g.declareBankruptcy(0);
  assert.ok(types(ev).includes('bankrupt') && !types(ev).includes('gameOver'));
  assert.equal(g.state.current, 1);
  assert.equal(g.state.phase, 'roll');
  assert.equal(g.state.players[1].cash, 15010, 'the last of the cash went to the creditor');
});

test('voluntary bankruptcy: allowed on your own turn (no debt needed); cash goes to the bank', () => {
  const g = newGame(3);
  assert.throws(() => g.declareBankruptcy(1), /own turn/);
  g.state.owners[2] = 0;
  const ev = g.declareBankruptcy(0);
  assert.equal(ev.find((e) => e.type === 'bankrupt').creditor, 'bank');
  assert.equal(g.state.owners[2], undefined);
  assert.equal(g.state.current, 1);
  assert.equal(g.state.players[1].cash, 15000 && 15000);
  assert.ok(g.state.players.slice(1).every((p) => p.cash === 15000), 'nobody received the bankrupt cash');
});

test('bankruptcy is not possible during an auction', () => {
  const g = newGame(); g.state.players[0].cash = 100; rig(g, [2, 4]); g.roll();
  assert.equal(g.state.phase, 'auction');
  assert.throws(() => g.declareBankruptcy(0), /Cannot declare/);
});

test('debts owed to a player who goes bankrupt are forgiven', () => {
  const g = newGame(3); g.state.players[1].cash = 0;
  g.state.decks.surprise = ['S4'].concat(g.state.decks.surprise.filter((i) => i !== 'S4'));
  landOn(g, 0, 8);                                                        // player 1 (and 2) owe player 0
  assert.equal(g.debtTotal(1), 200);
  g.declareBankruptcy(0);                                                 // the creditor gives up
  assert.equal(g.debtTotal(1), 0);
  assert.equal(g.state.current, 1);
  assert.equal(g.state.phase, 'roll', 'no debt left to resolve');
});

test('a bankrupt player takes no further turns and their jail cards return to the deck', () => {
  const g = newGame(3); g.state.players[0].jailCards = ['T3'];
  g.state.decks.treasure = g.state.decks.treasure.filter((i) => i !== 'T3');
  g.declareBankruptcy(0);
  assert.equal(g.state.decks.treasure.at(-1), 'T3');
  assert.equal(g.state.players[0].jailCards.length, 0);
  g.state.phase = 'end'; g.endTurn();                                     // 1 -> 2
  g.state.phase = 'end'; g.endTurn();                                     // 2 -> back around, skipping the bankrupt 0
  assert.equal(g.state.current, 1);
});
