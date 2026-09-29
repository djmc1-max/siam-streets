'use strict';
// Section 19: trading — properties + cash (+ Get Out of Jail Free cards) in both directions,
// Accept / Decline / Negotiate.
const test = require('node:test');
const { BOARD } = require('../public/js/data.js');
const Rules = require('../public/js/rules.js');
const { assert, newGame, rig, types } = require('./helpers.js');

const side = (props = [], cash = 0, cards = []) => ({ props, cash, cards });
const setup = (n = 2) => { const g = newGame(n); g.state.owners[2] = 0; g.state.owners[7] = 1; return g; };

test('Section 19: properties and cash both ways in one offer — accepted', () => {
  const g = setup();
  let ev = g.proposeTrade(0, 1, side([2], 500), side([7], 200));
  assert.equal(ev[0].type, 'tradeProposed');
  assert.deepEqual(g.availableActions().trade.give, side([2], 500));
  assert.equal(g.availableActions().actor, 1, 'the receiver is the one who must act');
  ev = g.respondTrade(1, 'accept');
  assert.equal(ev[0].type, 'tradeCompleted');
  assert.equal(g.state.owners[2], 1); assert.equal(g.state.owners[7], 0);
  assert.equal(g.state.players[0].cash, 15000 - 500 + 200);
  assert.equal(g.state.players[1].cash, 15000 + 500 - 200);
  assert.equal(g.state.trade, null);
  assert.equal(g.availableActions().actor, 0, 'play returns to the current player');
});

test('a one-sided gift is allowed; an empty offer is not', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([2]), side());
  g.respondTrade(1, 'accept');
  assert.equal(g.state.owners[2], 1);
  assert.throws(() => g.proposeTrade(0, 1, side(), side()), /Add something/);
});

test('cash only, both directions', () => {
  const g = newGame();
  g.proposeTrade(0, 1, side([], 1000), side([], 300)); g.respondTrade(1, 'accept');
  assert.deepEqual(g.state.players.map((p) => p.cash), [14300, 15700]);
});

test('Section 21: Get Out of Jail Free cards can be traded, and the new owner can use them', () => {
  const g = newGame(); g.state.players[0].jailCards = ['T3']; g.state.decks.treasure = g.state.decks.treasure.filter((i) => i !== 'T3');
  g.proposeTrade(0, 1, side([], 0, ['T3']), side([], 400));
  const ev = g.respondTrade(1, 'accept');
  assert.deepEqual(ev[0].jailCards, [0, 1]);
  assert.deepEqual([g.state.players[0].jailCards, g.state.players[1].jailCards], [[], ['T3']]);
  assert.equal(g.state.players[0].cash, 15400);
  // player 1 is jailed on their turn and uses the card they bought
  g.state.phase = 'end'; g.endTurn(); g.state.players[1].jailed = true;
  assert.ok(g.availableActions().canUseJailCard);
  g.useJailCard();
  assert.equal(g.state.decks.treasure.at(-1), 'T3');
});

test('Decline: nothing changes and play carries on', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([2], 500), side([7]));
  const ev = g.respondTrade(1, 'decline');
  assert.equal(ev[0].type, 'tradeDeclined');
  assert.equal(g.state.owners[2], 0); assert.equal(g.state.owners[7], 1);
  assert.deepEqual(g.state.players.map((p) => p.cash), [15000, 15000]);
  assert.equal(g.state.trade, null);
  assert.ok(g.availableActions().canRoll);
});

test('Negotiate: the receiver counter-offers, roles swap, and the original proposer can accept the counter', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([2]), side([7]));                                       // A: my Khao San for your Nana Plaza
  let ev = g.respondTrade(1, { counter: { give: side([7]), get: side([2], 300) } });  // B: ...plus ฿300 from you
  assert.equal(ev[0].type, 'tradeCountered');
  const t = g.state.trade;
  assert.deepEqual([t.from, t.to, t.round], [1, 0, 2]);
  assert.equal(g.availableActions().actor, 0, 'now the original proposer must answer');
  assert.throws(() => g.respondTrade(1, 'accept'), /not for you/);
  ev = g.respondTrade(0, 'accept');
  assert.equal(ev[0].type, 'tradeCompleted');
  assert.equal(g.state.owners[2], 1); assert.equal(g.state.owners[7], 0);
  assert.equal(g.state.players[0].cash, 15000 - 300);
  assert.equal(g.state.players[1].cash, 15000 + 300);
});

test('Negotiate can go back and forth, but not forever', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([2]), side([7]));
  let responder = 1;
  for (let i = 0; i < 5; i++) {
    const t = g.state.trade;
    g.respondTrade(responder, { counter: { give: side(t.get.props, i * 10), get: side(t.give.props) } });
    responder = 1 - responder;
  }
  assert.equal(g.state.trade.round, 6);
  assert.throws(() => g.respondTrade(responder, { counter: { give: side(), get: side([], 10) } }), /Too many counter-offers/);
  g.respondTrade(responder, 'decline');
  assert.equal(g.state.trade, null);
});

test('validation: you can only offer what you own, can afford, and hold', () => {
  const g = setup();
  assert.throws(() => g.proposeTrade(0, 1, side([7]), side()), /does not own Nana Plaza/);            // not mine
  assert.throws(() => g.proposeTrade(0, 1, side([2]), side([2])), /does not own Khao San Rd/);         // theirs? no, mine
  assert.throws(() => g.proposeTrade(0, 1, side([], 15001), side()), /does not have ฿15,001/);
  assert.throws(() => g.proposeTrade(0, 1, side(), side([], 15001)), /does not have ฿15,001/);
  assert.throws(() => g.proposeTrade(0, 1, side([], 0, ['T3']), side()), /Get Out of Jail Free/);
  assert.throws(() => g.proposeTrade(0, 0, side([2]), side()), /another player/);
  assert.throws(() => g.proposeTrade(0, 1, side([1]), side()), /does not own/);                        // Start
  assert.throws(() => g.proposeTrade(0, 1, side([2, 2]), side()), /twice/);
  assert.throws(() => g.proposeTrade(0, 1, side([], 1.5), side()), /not valid/);
  assert.throws(() => g.proposeTrade(0, 1, side([], -5), side()), /not valid/);
  assert.equal(g.state.trade, null);
});

test('properties in a colour group with houses cannot be traded until the houses are sold', () => {
  const g = newGame(); [2, 4].forEach((i) => { g.state.owners[i] = 0; }); g.state.levels[2] = 1;
  assert.throws(() => g.proposeTrade(0, 1, side([4]), side()), /Sell the houses/);
  assert.throws(() => g.proposeTrade(0, 1, side([2]), side()), /Sell the houses/);
  g.state.owners[7] = 0;                                              // a property in another group is fine
  g.proposeTrade(0, 1, side([7]), side());
});

test('mortgaged properties can be traded and stay mortgaged', () => {
  const g = setup(); g.state.mortgaged[2] = true;
  g.proposeTrade(0, 1, side([2]), side([], 100)); g.respondTrade(1, 'accept');
  assert.equal(g.state.owners[2], 1);
  assert.ok(g.state.mortgaged[2], 'the new owner inherits the mortgage');
});

test('while an offer is pending nothing else can happen', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([2]), side());
  assert.throws(() => g.roll(), /trade offer/);
  assert.throws(() => g.mortgage(0, 2), /trade offer/);
  assert.throws(() => g.proposeTrade(0, 1, side([], 10), side()), /trade offer/);
  assert.throws(() => g.declareBankruptcy(0), /trade offer/);
  const a = g.availableActions();
  assert.ok(!a.canManage && !a.canTrade && !a.canBankrupt);
});

test('only the current player can propose, and not during an auction', () => {
  const g = newGame(3);
  assert.throws(() => g.proposeTrade(1, 0, side(), side([], 5)), /own turn/);
  g.state.players[0].cash = 100; rig(g, [2, 4]); g.roll();            // unaffordable -> auction
  assert.equal(g.state.phase, 'auction');
  assert.throws(() => g.proposeTrade(0, 1, side([], 10), side()), /Cannot manage/);
});

test('the answer is checked again when it is given: a stale offer cannot be accepted', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([], 14000), side([7]));
  g.state.players[0].cash = 10;                                         // the proposer no longer has the cash
  assert.throws(() => g.respondTrade(1, 'accept'), /does not have/);
  g.respondTrade(1, 'decline');
});

test('trading can clear a debt: the cash from the sale goes straight to the creditor and the turn continues', () => {
  const g = newGame(); g.state.owners[40] = 1; g.state.owners[2] = 0;
  g.state.players[0].cash = 100; g.state.players[0].pos = 33; rig(g, [3, 4]);
  g.roll();
  assert.equal(g.state.phase, 'debt'); assert.equal(g.debtTotal(0), 400);
  g.proposeTrade(0, 1, side([2]), side([], 1000));                     // sell Khao San Rd to the creditor for ฿1,000
  const ev = g.respondTrade(1, 'accept');
  assert.ok(types(ev).includes('tradeCompleted') && types(ev).includes('debtResolved'));
  assert.equal(g.debtTotal(0), 0);
  assert.equal(g.state.phase, 'end');
  assert.equal(g.state.players[0].cash, 600);                          // 1000 received, 400 paid on
});

test('a trade that completes a colour set gives the new owner the doubled rent', () => {
  const g = newGame(); g.state.owners[2] = 0; g.state.owners[4] = 1;
  assert.equal(g.rentFor(BOARD[1], 0, 7), 20);
  g.proposeTrade(0, 1, side([], 500), side([4])); g.respondTrade(1, 'accept');
  assert.equal(g.state.owners[4], 0);
  assert.equal(g.rentFor(BOARD[1], 0, 7), 40, 'Khao San Rd rent doubles');
  assert.equal(g.rentFor(BOARD[3], 0, 7), 80, 'Chatuchak too (40 x2)');
  assert.ok(Rules.ownsFullGroup(g.state, 0, 'red'));
});

test('counter-offers are validated too', () => {
  const g = setup();
  g.proposeTrade(0, 1, side([2]), side([7]));
  assert.throws(() => g.respondTrade(1, { counter: { give: side([2]), get: side() } }), /does not own Khao San Rd/);
  assert.throws(() => g.respondTrade(1, { counter: { give: side(), get: side() } }), /Add something/);
  assert.throws(() => g.respondTrade(1, 'maybe'), /Answer with/);
  assert.throws(() => g.respondTrade(1, { counter: { give: side([], 99999), get: side() } }), /does not have/);
});
