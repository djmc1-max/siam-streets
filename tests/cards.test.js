'use strict';
// Sections 20 and 21: Surprise and Treasure cards.
const test = require('node:test');
const { CARDS, CARD_BY_ID } = require('../public/js/data.js');
const { assert, money, newGame, rig, types, sectionTable, mulberry32, landOn } = require('./helpers.js');

const SURPRISE_SQUARES = [8, 23, 37];
const TREASURE_SQUARES = [18, 34];   // (square 3 needs a Start-crossing roll; the helper avoids that)
const rows = (h, n) => sectionTable(h, n).filter((c) => /^\d+$/.test(c[0]) && c.length === 3);

// Put a specific card on top of a deck, then land player 0 on a square of that deck.
function draw(g, deck, cardId, n = 2) {
  const rest = g.state.decks[deck].filter((id) => id !== cardId);
  g.state.decks[deck] = [cardId].concat(rest);
  const sq = deck === 'surprise' ? SURPRISE_SQUARES[0] : TREASURE_SQUARES[0];
  return landOn(g, 0, sq);
}

test('Sections 20/21: all 20 card texts and effects match the design doc', () => {
  const doc = { S: rows('## 20. SURPRISE CARDS', '## 21.'), T: rows('## 21. TREASURE CARDS', '## 22.') };
  assert.equal(doc.S.length, 10);
  assert.equal(doc.T.length, 10);
  for (const prefix of ['S', 'T']) {
    doc[prefix].forEach((r) => {
      const card = CARD_BY_ID[prefix + r[0]];
      assert.ok(card, 'missing card ' + prefix + r[0]);
      assert.equal(card.text, r[1], prefix + r[0] + ' text');
      const effect = r[2];
      const fx = card.effect;
      if (/from each player/.test(effect)) { assert.equal(fx.type, 'collectEach'); assert.equal(fx.amount, money(effect)); }
      else if (/^\+฿/.test(effect)) { assert.equal(fx.type, 'collect'); assert.equal(fx.amount, money(effect)); }
      else if (/^-฿/.test(effect)) { assert.equal(fx.type, 'pay'); assert.equal(fx.amount, money(effect)); }
      else if (/jail/i.test(effect)) assert.equal(fx.type, 'jail');
      else if (/Miss one turn/i.test(effect)) assert.equal(fx.type, 'skip');
      else if (/Keep card/i.test(effect)) assert.equal(fx.type, 'jailCard');
      else assert.fail('unrecognised effect in the doc: ' + effect);
    });
  }
  assert.equal(CARDS.surprise.length + CARDS.treasure.length, 20);
});

test('decks: each starts as a complete, shuffled set of 10 (deterministic for a given rng)', () => {
  const a = newGame(2, { rng: mulberry32(1) }), b = newGame(2, { rng: mulberry32(1) });
  assert.deepEqual(a.state.decks, b.state.decks);
  assert.deepEqual(a.state.decks.surprise.slice().sort(), CARDS.surprise.map((c) => c.id).sort());
  assert.deepEqual(a.state.decks.treasure.slice().sort(), CARDS.treasure.map((c) => c.id).sort());
  const orders = new Set();
  for (let s = 1; s <= 20; s++) orders.add(newGame(2, { rng: mulberry32(s) }).state.decks.surprise.join());
  assert.ok(orders.size > 10, 'different seeds should give different shuffles');
});

test('landing on any Surprise/Treasure square draws from the right deck', () => {
  for (const sq of SURPRISE_SQUARES) {
    const g = newGame(); const top = g.state.decks.surprise[0];
    const ev = landOn(g, 0, sq);
    assert.equal(ev.find((e) => e.type === 'cardDrawn').cardId, top, 'square ' + sq);
    assert.equal(ev.find((e) => e.type === 'cardDrawn').deck, 'surprise');
  }
  for (const sq of TREASURE_SQUARES) {
    const g = newGame(); const top = g.state.decks.treasure[0];
    const ev = landOn(g, 0, sq);
    assert.equal(ev.find((e) => e.type === 'cardDrawn').cardId, top, 'square ' + sq);
    assert.equal(ev.find((e) => e.type === 'cardDrawn').deck, 'treasure');
  }
  // Treasure square 3 as well (roll a double from Start)
  const g = newGame(); const top = g.state.decks.treasure[0]; rig(g, [1, 1]);
  assert.equal(g.roll().find((e) => e.type === 'cardDrawn').cardId, top);
});

test('every money card applies its exact amount automatically, and the card text is in the event', () => {
  [['surprise', 'S1', +500], ['surprise', 'S2', +300], ['surprise', 'S3', +1000], ['surprise', 'S5', +600],
   ['surprise', 'S6', -1500], ['surprise', 'S7', -1000], ['surprise', 'S8', -800],
   ['treasure', 'T1', +1000], ['treasure', 'T2', +800], ['treasure', 'T5', -500], ['treasure', 'T6', -300],
   ['treasure', 'T7', -500], ['treasure', 'T8', -600], ['treasure', 'T9', -700], ['treasure', 'T10', -600]].forEach(([deck, id, delta]) => {
    const g = newGame();
    const ev = draw(g, deck, id);
    assert.equal(g.state.players[0].cash, 15000 + delta, id + ' cash');
    assert.equal(g.state.players[1].cash, 15000, id + ' other player untouched');
    assert.equal(ev.find((e) => e.type === 'cardDrawn').text, CARD_BY_ID[id].text, id + ' text shown');
    assert.equal(g.state.decks[deck].at(-1), id, id + ' goes to the bottom of its deck');
    assert.equal(g.state.phase, 'end', id + ' leaves the turn ready to end');
  });
});

test('Surprise 4: collect ฿200 from each other player', () => {
  const g = newGame(4);
  const ev = draw(g, 'surprise', 'S4');
  assert.equal(g.state.players[0].cash, 15600);
  assert.deepEqual(g.state.players.slice(1).map((p) => p.cash), [14800, 14800, 14800]);
  assert.deepEqual(ev.find((e) => e.type === 'cardEffect').from, [1, 2, 3]);
});

test('Surprise 9: police checkpoint sends you straight to prison without Start salary', () => {
  const g = newGame();
  const ev = draw(g, 'surprise', 'S9');
  assert.equal(g.state.players[0].pos, 11);
  assert.ok(g.state.players[0].jailed);
  assert.equal(g.state.players[0].cash, 15000);
  assert.equal(ev.find((e) => e.type === 'jailed').reason, 'card');
  assert.equal(g.state.phase, 'end');
});

test('Surprise 10: miss one turn — the next turn is skipped, then play returns', () => {
  const g = newGame(2);
  draw(g, 'surprise', 'S10');
  assert.equal(g.state.players[0].skipTurns, 1);
  g.endTurn();                           // -> player 1
  assert.equal(g.state.current, 1);
  rig(g, [1, 3]); g.roll();              // player 1 lands on Income Tax
  const ev = g.endTurn();                // player 0 misses this turn -> back to player 1
  assert.ok(types(ev).includes('turnSkipped'));
  assert.equal(ev.find((e) => e.type === 'turnSkipped').playerId, 0);
  assert.equal(g.state.current, 1);
  assert.equal(g.state.players[0].skipTurns, 0);
  rig(g, [2, 4]); g.roll(); g.endTurn(); // player 1 again (5 + 6 = just visiting), then player 0 plays normally
  assert.equal(g.state.current, 0);
});

test('Treasure 3 and 4: Get Out of Jail Free is kept, not returned to the deck', () => {
  for (const id of ['T3', 'T4']) {
    const g = newGame();
    const ev = draw(g, 'treasure', id);
    assert.ok(types(ev).includes('cardKept'));
    assert.deepEqual(g.state.players[0].jailCards, [id]);
    assert.ok(!g.state.decks.treasure.includes(id), 'held card is out of the deck');
    assert.equal(g.state.decks.treasure.length, 9);
    assert.equal(g.state.players[0].cash, 15000);
  }
});

test('using a Get Out of Jail Free card frees you and puts it at the bottom of the Treasure deck', () => {
  const g = newGame();
  draw(g, 'treasure', 'T3');
  g.endTurn(); rig(g, [1, 3]); g.roll(); g.endTurn();   // back to player 0
  const p = g.state.players[0];
  assert.ok(!g.availableActions().canUseJailCard, 'not usable while free');
  assert.throws(() => g.useJailCard());
  p.jailed = true; p.pos = 11;
  const a = g.availableActions();
  assert.ok(a.canUseJailCard && a.canRoll);
  const ev = g.useJailCard();
  assert.equal(ev[0].type, 'jailCardUsed');
  assert.ok(!p.jailed);
  assert.equal(p.jailCards.length, 0);
  assert.equal(g.state.decks.treasure.at(-1), 'T3');
  assert.equal(g.state.decks.treasure.length, 10);
  assert.equal(g.state.phase, 'roll');   // then roll normally
  assert.throws(() => g.useJailCard());
});

test('a player can hold both jail cards', () => {
  const g = newGame();
  draw(g, 'treasure', 'T3'); g.endTurn(); rig(g, [1, 3]); g.roll(); g.endTurn();
  g.state.players[0].pos = 1;
  draw(g, 'treasure', 'T4');
  assert.deepEqual(g.state.players[0].jailCards.sort(), ['T3', 'T4']);
});

test('decks cycle: every drawn card returns to the bottom, so a full lap repeats the order', () => {
  const g = newGame(); const order = g.state.decks.surprise.slice();
  const seen = [];
  for (let i = 0; i < 10; i++) {
    g.state.phase = 'roll'; g.state.current = 0; g.state.players[0].cash = 15000; g.state.players[0].jailed = false;
    seen.push(landOn(g, 0, 8).find((e) => e.type === 'cardDrawn').cardId);
  }
  assert.deepEqual(seen, order);
  assert.deepEqual(g.state.decks.surprise, order);
});
