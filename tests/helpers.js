'use strict';
// Shared helpers for the rules tests.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createGame } = require('../public/js/engine.js');

const DESIGN = fs.readFileSync(path.join(__dirname, '..', 'GAME_DESIGN.md'), 'utf8');
const money = (s) => parseInt(s.replace(/[^\d]/g, ''), 10);

function newGame(n = 2, extra = {}) {
  const seats = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, tokenId: 't' + i, isBot: i > 0 }));
  return createGame(Object.assign({ players: seats, startingCash: 15000 }, extra));
}

// Queue exact dice: rig(g, [3,4], [1,1]) makes the next rolls 3+4 then 1+1.
function rig(g, ...rolls) {
  const values = rolls.flat();
  g.rng = () => { const v = values.shift(); assert.ok(v !== undefined, 'dice queue exhausted'); return (v - 1) / 6 + 0.01; };
}

// Put a player `total` squares before `target` so a roll of `total` lands exactly there.
function placeBefore(g, playerId, target, total) {
  g.state.players[playerId].pos = ((target - 1 - total + 40) % 40) + 1;
}

const types = (events) => events.map((e) => e.type);

// Rows of a markdown table in GAME_DESIGN.md between two headings, as arrays of trimmed cells.
function sectionTable(header, next) {
  const body = DESIGN.split(header)[1].split(next)[0];
  return body.split('\n').map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())).filter((c) => c.length > 1);
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lands player `playerId` on a card/other square >= 8 with a non-double roll of 7 (no Start crossing).
function landOn(g, playerId, square) {
  assert.ok(square >= 8, 'landOn needs a square >= 8');
  g.state.players[playerId].pos = square - 7;
  rig(g, [3, 4]);
  return g.roll();
}

module.exports = { assert, DESIGN, money, newGame, rig, placeBefore, types, sectionTable, mulberry32, landOn, createGame };
