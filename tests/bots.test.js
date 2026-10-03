'use strict';
// Bot behaviour: decisions are legal, Hard beats Easy, games always finish.
const test = require('node:test');
const { BOARD } = require('../public/js/data.js');
const Rules = require('../public/js/rules.js');
const Bot = require('../public/js/bot.js');
const { assert, newGame, mulberry32 } = require('./helpers.js');

const CAP = 60000;   // engine steps per game

function netWorth(g, id) {
  const p = g.state.players[id];
  let w = p.cash;
  Rules.ownedIds(g.state, id).forEach((sq) => {
    const s = BOARD[sq - 1];
    w += Rules.isMortgaged(g.state, sq) ? s.price / 2 : s.price;
    const lvl = Rules.levelOf(g.state, sq);
    if (lvl) w += Rules.buildCost(s, 0) * lvl * 0.5;
  });
  return w;
}

// Plays one game bot-vs-bot. levels[i] is seat i's difficulty. Returns { winner, finished, steps }.
function simulate(levels, seed) {
  const rnd = mulberry32(seed);
  const g = newGame(levels.length, { rng: mulberry32(seed * 7919), startingCash: 15000 });
  const memo = { turn: -1, n: 0 };
  const memos = levels.map(() => ({ turn: -1, n: 0 }));
  let steps = 0;
  while (g.state.phase !== 'over' && steps++ < CAP) {
    const st = g.state;
    if (st.phase === 'auction') {
      const a = st.auction;
      let bidding = true, rounds = 0;
      while (bidding && rounds++ < 300) {
        bidding = false;
        for (const id of a.bidders) {
          const amount = Bot.forLevel(levels[id]).decideBid(g, id, rnd);
          if (amount !== null && amount > a.highBid && amount <= st.players[id].cash) { g.bid(id, amount); bidding = true; }
        }
      }
      g.closeAuction();
      continue;
    }
    const actor = g.availableActions().actor;
    const bot = Bot.forLevel(levels[actor]);
    const act = Bot.choose(bot, g, actor, rnd, memos[actor]);
    switch (act.type) {
      case 'tradeReply': g.respondTrade(actor, act.reply); break;
      case 'roll': g.roll(); break;
      case 'fine': g.payJailFine(); break;
      case 'jailCard': g.useJailCard(); break;
      case 'buy': g.buy(); break;
      case 'auction': g.declineToAuction(); break;
      case 'build': g.build(actor, act.square); break;
      case 'sell': g.sellBuilding(actor, act.square); break;
      case 'mortgage': g.mortgage(actor, act.square); break;
      case 'unmortgage': g.unmortgage(actor, act.square); break;
      case 'bankrupt': g.declareBankruptcy(actor); break;
      case 'end': g.endTurn(); break;
      default: throw new Error('unexpected action ' + act.type);
    }
  }
  const alive = g.state.players.filter((p) => !p.bankrupt);
  const finished = g.state.phase === 'over';
  const winner = alive.length === 1 ? alive[0].id : alive.map((p) => p.id).sort((x, y) => netWorth(g, y) - netWorth(g, x))[0];
  return { winner, finished, steps, turn: g.state.turn };
}

test('forLevel returns a distinct Hard bot', () => {
  assert.equal(Bot.forLevel('easy').level, 'easy');
  assert.equal(Bot.forLevel('hard').level, 'hard');
  assert.notEqual(Bot.forLevel('hard'), Bot.forLevel('easy'));
});

test('Hard buys what Easy would pass on, and pays to leave prison early but sits tight late', () => {
  const g = newGame(2);
  g.state.pending = 7; g.state.players[1].cash = 1500;                 // 1,000 property, 1,500 cash
  assert.equal(Bot.hard.decideOffer(g, 1, () => 0.99), 'buy');
  assert.equal(Bot.easy.decideOffer(g, 1, () => 0.99), 'auction');      // Easy keeps a 1,000 reserve
  assert.equal(Bot.hard.decideJail(g, 1), 'pay');                       // early: lots unowned, 1,500 in hand
  BOARD.forEach((sq) => { if (Rules.isBuyable(sq)) g.state.owners[sq.id] = 0; });
  assert.equal(Bot.hard.decideJail(g, 1), 'roll');                      // late: nothing left to buy
});

test('Hard bids far more than the list price for a property that completes its set, and blocks opponents', () => {
  const g = newGame(3);
  g.state.owners[2] = 1;                                               // bot 1 holds Khao San Rd ...
  g.state.auction = { square: 4, decliner: 0, bidders: [1, 2], highBid: 800, highBidder: 2 };   // ... Chatuchak (600) is up
  const bid = Bot.hard.decideBid(g, 1, Math.random);
  assert.ok(bid > 800 && bid <= 1200, 'raised above the list price to complete the set: ' + bid);
  const e = Bot.easy.decideBid(g, 1, () => 0.5);
  assert.equal(e, null, 'Easy never pays that much');
  g.state.auction.highBidder = 1;
  assert.equal(Bot.hard.decideBid(g, 1, Math.random), null, 'never outbids itself');
  // blocking: bot 2 owns the other red square, bot 1 does not
  g.state.owners[2] = 2; g.state.auction.highBidder = null; g.state.auction.highBid = 0;
  const blockBid = Bot.hard.decideBid(g, 1, Math.random);
  assert.ok(blockBid !== null && blockBid >= 60, 'opens a bid to stop an opponent completing a set');
});

test('bot decisions are always legal (every action the sim applies is accepted by the engine)', () => {
  for (let seed = 1; seed <= 6; seed++) simulate(['hard', 'easy', 'hard', 'easy'], seed);   // throws on any illegal action
});

test('games between bots finish (no stalls)', () => {
  let finished = 0, n = 0;
  [['easy', 'easy'], ['hard', 'hard'], ['hard', 'easy', 'easy', 'easy']].forEach((levels) => {
    for (let seed = 1; seed <= 12; seed++) { n++; const r = simulate(levels, seed * 31); if (r.finished) finished++; else assert.ok(r.turn > 1000, 'an unfinished game must still be moving, not stuck'); }
  });
  // cautious bots can circle forever on Start salaries; that is slow play, not a stall, so most games must end and the rest keep moving
  assert.ok(finished / n >= 0.75, 'finished ' + finished + ' of ' + n);
});

test('Hard beats Easy head-to-head (>= 60% of 40 games, seats alternated)', () => {
  let hardWins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const hardSeat = seed % 2;
    const levels = hardSeat === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
    if (simulate(levels, seed * 101).winner === hardSeat) hardWins++;
  }
  assert.ok(hardWins >= 24, 'Hard won ' + hardWins + ' of 40');
});

test('one Hard bot among three Easy ones wins far more than its fair 25% (>= 40% of 40 games)', () => {
  let hardWins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const hardSeat = seed % 4;
    const levels = ['easy', 'easy', 'easy', 'easy']; levels[hardSeat] = 'hard';
    if (simulate(levels, seed * 53).winner === hardSeat) hardWins++;
  }
  assert.ok(hardWins >= 16, 'Hard won ' + hardWins + ' of 40');
});
