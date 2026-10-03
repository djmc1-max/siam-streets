'use strict';
// Sections 6, 9, 15: rent (with the full-set doubling), mortgages, houses and hotels.
const test = require('node:test');
const { BOARD, BUILD_COST } = require('../public/js/data.js');
const Rules = require('../public/js/rules.js');
const { assert, money, newGame, rig, placeBefore, types, sectionTable } = require('./helpers.js');

const GROUPS = Object.keys(Rules.GROUP_SQUARES);
const buyable = BOARD.filter((s) => Rules.isBuyable(s));
const own = (g, pid, group) => Rules.GROUP_SQUARES[group].forEach((id) => { g.state.owners[id] = pid; });
const setLevel = (g, id, lvl) => { if (lvl) g.state.levels[id] = lvl; else delete g.state.levels[id]; };
const rich = (n = 2) => { const g = newGame(n, { startingCash: 30000 }); g.state.players.forEach((p) => { p.cash = 100000; }); return g; };

// ---------------- Section 15: mortgages ----------------
test('Section 15: every buyable square mortgages for exactly 50% of its purchase price', () => {
  assert.equal(buyable.length, 28);   // 22 properties + 4 airports + 2 utilities
  buyable.forEach((sq) => {
    const g = newGame(); g.state.owners[sq.id] = 0;
    const before = g.state.players[0].cash;
    const ev = g.mortgage(0, sq.id);
    assert.equal(ev[0].type, 'mortgaged');
    assert.equal(ev[0].amount, sq.price / 2, sq.name);
    assert.equal(g.state.players[0].cash, before + sq.price / 2, sq.name + ' cash');
    assert.ok(g.state.mortgaged[sq.id]);
  });
});

test('Section 15: unmortgaging pays back exactly the same 50% (no interest)', () => {
  buyable.forEach((sq) => {
    const g = newGame(); g.state.owners[sq.id] = 0; g.mortgage(0, sq.id);
    const before = g.state.players[0].cash;
    const ev = g.unmortgage(0, sq.id);
    assert.equal(ev[0].amount, sq.price / 2);
    assert.equal(g.state.players[0].cash, before - sq.price / 2);
    assert.ok(!g.state.mortgaged[sq.id]);
  });
});

test('mortgage rules: must own it, not twice; unmortgage needs cash and an existing mortgage', () => {
  const g = newGame(); g.state.owners[2] = 1;
  assert.throws(() => g.mortgage(0, 2), /do not own/);
  g.state.owners[2] = 0; g.mortgage(0, 2);
  assert.throws(() => g.mortgage(0, 2), /Already mortgaged/);
  g.state.players[0].cash = 100;
  assert.throws(() => g.unmortgage(0, 2), /Needs ฿300/);
  assert.throws(() => g.unmortgage(0, 4), /do not own/);
  g.state.owners[4] = 0; g.state.players[0].cash = 5000;
  assert.throws(() => g.unmortgage(0, 4), /Not mortgaged/);
  assert.throws(() => g.mortgage(0, 1), /Not a property/);
});

test('Section 15: a mortgaged property earns zero rent, and the landing says so', () => {
  const g = newGame(); g.state.owners[7] = 1; g.state.mortgaged[7] = true;
  rig(g, [2, 4]);
  const ev = g.roll();
  assert.ok(types(ev).includes('rentMortgaged'));
  assert.ok(!types(ev).includes('rent'));
  assert.deepEqual(g.state.players.map((p) => p.cash), [15000, 15000]);
  assert.equal(g.state.phase, 'end');
  // unmortgaged again -> rent is charged
  delete g.state.mortgaged[7];
  g.endTurn(); g.state.current = 0; g.state.phase = 'roll'; g.state.players[0].pos = 1; rig(g, [2, 4]);
  assert.ok(types(g.roll()).includes('rent'));
});

test('Section 15: airports and utilities still count toward the count when mortgaged; only the mortgaged one is free', () => {
  const g = newGame(); [6, 16].forEach((id) => { g.state.owners[id] = 1; }); g.state.mortgaged[16] = true;
  assert.equal(g.rentFor(BOARD[5], 1, 7), 1000);      // Don Mueang: 2 airports owned -> 1,000
  assert.equal(g.rentFor(BOARD[15], 1, 7), 0);        // the mortgaged one
  const u = newGame(); [13, 29].forEach((id) => { u.state.owners[id] = 1; }); u.state.mortgaged[29] = true;
  assert.equal(u.rentFor(BOARD[12], 1, 8), 800);      // both utilities owned -> x100
});

test('mortgaging is blocked while any house stands in the colour group', () => {
  const g = rich(); own(g, 0, 'red'); setLevel(g, 2, 1); setLevel(g, 4, 1);
  assert.throws(() => g.mortgage(0, 2), /Sell every house/);
  assert.throws(() => g.mortgage(0, 4), /Sell every house/);
  g.sellBuilding(0, 2); g.sellBuilding(0, 4);
  g.mortgage(0, 2);
  assert.ok(g.state.mortgaged[2]);
});

// ---------------- Section 9: houses and hotels ----------------
test('Section 9: build costs for all 8 colour groups match the doc (house, and hotel on the 5th step)', () => {
  const rows = sectionTable('## 9. HOUSE AND HOTEL BUILD COSTS', '## 10.').filter((c) => c.length === 3 && /Red|Orange|Yellow|Green|Blue|Purple|Brown|Pink/.test(c[0]));
  assert.equal(rows.length, 8);
  rows.forEach((r) => {
    const group = r[0].match(/Red|Orange|Yellow|Green|Blue|Purple|Brown|Pink/)[0].toLowerCase();
    assert.deepEqual(BUILD_COST[group], { house: money(r[1]), hotel: money(r[2]) }, group);
    const g = rich(); own(g, 0, group);
    const ids = Rules.GROUP_SQUARES[group];
    let spent = 0;
    for (let level = 1; level <= 5; level++) {
      ids.forEach((id) => {
        const before = g.state.players[0].cash;
        const ev = g.build(0, id);
        const expected = level === 5 ? money(r[2]) : money(r[1]);
        assert.equal(ev[0].cost, expected, group + ' level ' + level);
        assert.equal(before - g.state.players[0].cash, expected);
        assert.equal(ev[0].level, level);
        assert.equal(ev[0].hotel, level === 5);
        spent += expected;
      });
    }
    ids.forEach((id) => assert.equal(g.state.levels[id], 5, 'hotel everywhere'));
    assert.throws(() => g.build(0, ids[0]), /Already a hotel/);
  });
});

test('Section 9: you need the WHOLE colour group (and nothing mortgaged in it) to build', () => {
  const g = rich(); g.state.owners[2] = 0;                 // red has 2 squares; own only one
  assert.throws(() => g.build(0, 2), /whole colour group/);
  g.state.owners[4] = 1;
  assert.throws(() => g.build(0, 2), /whole colour group/);
  g.state.owners[4] = 0;
  g.mortgage(0, 4);
  assert.throws(() => g.build(0, 2), /Unmortgage the whole group/);
  g.unmortgage(0, 4);
  g.build(0, 2);
  assert.equal(g.state.levels[2], 1);
  assert.throws(() => g.build(0, 1), /Only colour-group/);
  assert.throws(() => g.build(1, 2), /own turn/);
});

test('Section 9: building must be even across the group; selling must be even too', () => {
  const g = rich(); own(g, 0, 'orange');                   // squares 7, 9, 10
  g.build(0, 7);
  assert.throws(() => g.build(0, 7), /Build evenly/);      // 7 is ahead of 9 and 10
  g.build(0, 9); g.build(0, 10);
  g.build(0, 9);
  assert.throws(() => g.build(0, 9), /Build evenly/);
  assert.throws(() => g.sellBuilding(0, 7), /Sell evenly/); // 9 has more than 7
  g.sellBuilding(0, 9);
  assert.equal(g.state.levels[9], 1);
  assert.deepEqual(Rules.groupLevels(g.state, 'orange'), [1, 1, 1]);
});

test('Section 9: no supply limit — build hotels everywhere on every group', () => {
  const g = rich(); GROUPS.forEach((group) => own(g, 0, group));
  g.state.players[0].cash = 10000000;
  GROUPS.forEach((group) => { for (let l = 1; l <= 5; l++) Rules.GROUP_SQUARES[group].forEach((id) => g.build(0, id)); });
  BOARD.filter((s) => s.type === 'property').forEach((s) => assert.equal(g.state.levels[s.id], 5));
});

test('Section 9: selling gives back 50% of the build cost; a hotel sells back to 4 houses at 50% of the hotel price', () => {
  GROUPS.forEach((group) => {
    const g = rich(); own(g, 0, group);
    const { house, hotel } = BUILD_COST[group];
    const ids = Rules.GROUP_SQUARES[group];
    for (let l = 1; l <= 5; l++) ids.forEach((id) => g.build(0, id));
    const before = g.state.players[0].cash;
    const ev = g.sellBuilding(0, ids[0]);
    assert.equal(ev[0].refund, hotel / 2, group + ' hotel refund');
    assert.equal(ev[0].hotel, true);
    assert.equal(g.state.levels[ids[0]], 4, 'hotel becomes 4 houses');
    assert.equal(g.state.players[0].cash, before + hotel / 2);
    ids.slice(1).forEach((id) => g.sellBuilding(0, id));
    const ev2 = g.sellBuilding(0, ids[0]);
    assert.equal(ev2[0].refund, house / 2, group + ' house refund');
    assert.equal(g.state.levels[ids[0]], 3);
  });
});

test('building needs the cash — it can never push you into debt', () => {
  const g = newGame(); own(g, 0, 'brown'); g.state.players[0].cash = 999;
  assert.throws(() => g.build(0, 32), /Needs ฿1,000/);
  g.state.players[0].cash = 1000;
  g.build(0, 32);
  assert.equal(g.state.players[0].cash, 0);
});

// ---------------- Section 6: rent with houses, hotels and the full-set doubling ----------------
test('Section 6: rent for all 22 properties at every level 1-5 matches the table (landing for real)', () => {
  const rows = sectionTable('## 6. PROPERTY PRICING', '## 7.').filter((c) => c.length === 9 && c[0] !== 'Property' && !c[0].startsWith('---'));
  assert.equal(rows.length, 22);
  rows.forEach((r) => {
    const sq = BOARD.find((s) => s.name === r[0] && s.type === 'property');
    for (let level = 1; level <= 5; level++) {
      const g = newGame(); own(g, 1, sq.group);
      Rules.GROUP_SQUARES[sq.group].forEach((id) => setLevel(g, id, level));
      placeBefore(g, 0, sq.id, 7); rig(g, [3, 4]);
      g.state.players[0].cash = 1000000;
      const before = g.state.players[1].cash;
      const rent = g.roll().find((e) => e.type === 'rent');
      assert.equal(rent.amount, money(r[3 + level]), r[0] + ' level ' + level);   // columns: 1 House ... Hotel
      assert.equal(g.state.players[1].cash, before + money(r[3 + level]));
    }
  });
});

test('full-set rent: owning every property of a colour group DOUBLES the base rent (no houses yet)', () => {
  const rows = sectionTable('## 6. PROPERTY PRICING', '## 7.').filter((c) => c.length === 9 && c[0] !== 'Property' && !c[0].startsWith('---'));
  rows.forEach((r) => {
    const sq = BOARD.find((s) => s.name === r[0] && s.type === 'property');
    const solo = newGame(); solo.state.owners[sq.id] = 1;                 // owns just this one
    assert.equal(solo.rentFor(sq, 1, 7), money(r[3]), r[0] + ' single');
    const full = newGame(); own(full, 1, sq.group);
    assert.equal(full.rentFor(sq, 1, 7), money(r[3]) * 2, r[0] + ' full set');
  });
});

test('full-set doubling: needs the same owner for the whole group; airports and utilities are never doubled; houses use the table', () => {
  const g = newGame(3); own(g, 1, 'green'); g.state.owners[19] = 2;      // split ownership
  assert.equal(g.rentFor(BOARD[16], 1, 7), 140);                          // Chiang Rai, not doubled
  g.state.owners[19] = 1;
  assert.equal(g.rentFor(BOARD[16], 1, 7), 280);
  assert.equal(g.rentFor(BOARD[19], 1, 7), 320);                          // Pai base 160 x2
  setLevel(g, 17, 1);
  assert.equal(g.rentFor(BOARD[16], 1, 7), 700);                          // 1 house: the table value, not doubled again
  own(g, 1, 'green'); [6, 16, 26, 36].forEach((id) => { g.state.owners[id] = 1; });
  assert.equal(g.rentFor(BOARD[5], 1, 7), 4000);                          // 4 airports
});

test('a mortgaged member does not cancel the doubling on the others, but it collects nothing itself', () => {
  const g = newGame(); own(g, 1, 'red'); g.state.mortgaged[4] = true;
  assert.equal(g.rentFor(BOARD[1], 1, 7), 40);                            // Khao San: 20 x2
  assert.equal(g.rentFor(BOARD[3], 1, 7), 0);                             // Chatuchak mortgaged
});

// ---------------- turn-order rules for managing property ----------------
test('managing property: only the current player, on their own turn, never during an auction', () => {
  const g = rich(3); g.state.owners[2] = 1;
  assert.throws(() => g.mortgage(1, 2), /own turn/);
  assert.ok(g.availableActions().canManage);
  // an unaffordable offer -> auction
  g.state.players[0].cash = 100; rig(g, [2, 4]); g.roll();
  assert.equal(g.state.phase, 'auction');
  assert.ok(!g.availableActions().canManage);
  g.state.owners[4] = 0;
  assert.throws(() => g.mortgage(0, 4), /Cannot manage/);
});

test('you can raise cash by mortgaging while a purchase offer is pending, then buy', () => {
  const g = newGame(); g.state.players[0].cash = 1500; g.state.owners[4] = 0;   // owns Chatuchak (฿600 -> ฿300)
  g.state.owners[2] = 0; rig(g, [2, 4]);                                        // lands on Nana Plaza (฿1,000): affordable -> offer
  g.roll();
  assert.equal(g.state.phase, 'action');
  g.mortgage(0, 2);                                                             // +฿300 while the offer is pending
  g.buy();
  assert.equal(g.state.owners[7], 0);
  assert.equal(g.state.players[0].cash, 1500 + 300 - 1000);
});

test('bankruptcy returns properties to the bank with their buildings and mortgages cleared', () => {
  const g = rich(); own(g, 0, 'red'); setLevel(g, 2, 2); setLevel(g, 4, 2); g.state.mortgaged[6] = true; g.state.owners[6] = 0;
  g.state.owners[40] = 1; g.state.players[0].cash = 10;
  placeBefore(g, 0, 40, 7); rig(g, [3, 4]);
  g.roll();
  assert.equal(g.state.phase, 'debt');            // no more automatic bankruptcy: the debt comes first (Section 17)
  g.declareBankruptcy(0);
  assert.ok(g.state.players[0].bankrupt);
  assert.deepEqual([g.state.levels[2], g.state.levels[4], g.state.mortgaged[6], g.state.owners[2], g.state.owners[6]], [undefined, undefined, undefined, undefined, undefined]);
});
