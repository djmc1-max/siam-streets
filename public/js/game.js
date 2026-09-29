// Game controller: runs the turn loop. One loop serves humans and bots — ask the engine who acts,
// get an action (button click or bot decision), apply it, then play the returned events with animation.
(function () {
  const { fmtBaht, sleep, randomFloat } = window.SiamUtil;
  const { BOARD, TOKENS } = window.SiamData;
  const Engine = window.SiamEngine;
  const UI = window.SiamUI;
  const Feed = window.SiamFeed;
  const Tokens = window.SiamTokens;
  const Dice = window.SiamDice;

  const BOT_NAMES = ['Malee', 'Somsak', 'Niran', 'Suda', 'Anan'];

  const SiamGame = {
    human: null,            // { name, token } from the landing screen
    engine: null,
    botRng: randomFloat,    // separate from the dice rng so bot choices never disturb the dice
    diceRng: randomFloat,
    runId: 0
  };

  const sqName = (id) => BOARD[id - 1].name;
  const nameOf = (id) => SiamGame.engine.state.players[id].name;

  function buildSeats(botCount) {
    const human = SiamGame.human;
    const others = TOKENS.filter((t) => t.id !== human.token.id);
    others.sort((a, b) => (b.free ? 1 : 0) - (a.free ? 1 : 0)); // free tokens first (stable enough)
    const seats = [{ name: human.name, tokenId: human.token.id, isBot: false }];
    for (let i = 0; i < botCount; i++) seats.push({ name: BOT_NAMES[i], tokenId: others[i].id, isBot: true });
    return seats;
  }

  function start(settings) {
    const seats = buildSeats(settings.bots);
    const engine = Engine.createGame({ players: seats, startingCash: settings.startingCash, rng: () => SiamGame.diceRng() });
    SiamGame.engine = engine;
    const myRun = ++SiamGame.runId;

    const view = seats.map((s, i) => ({ id: i, name: s.name, isBot: s.isBot, icon: TOKENS.find((t) => t.id === s.tokenId).icon }));
    Feed.clear();
    UI.clearOwners();
    UI.showPlay();
    UI.renderPlayers(view, settings.startingCash);
    Tokens.init(view);
    UI.setCurrent(0);
    UI.idle();
    Feed.add('🎮', 'Game on! ' + seats.length + ' players, ' + fmtBaht(settings.startingCash) + ' each');
    Feed.add('🎯', nameOf(0) + "'s turn");

    run(myRun).catch((err) => { console.error(err); Feed.add('⚠️', 'Something went wrong: ' + err.message); });
  }

  async function run(myRun) {
    const engine = SiamGame.engine;
    while (SiamGame.runId === myRun && engine.state.phase !== 'over') {
      const actor = engine.state.players[engine.availableActions().actor];
      const action = actor.isBot ? await botChoose(actor) : await humanChoose(actor);
      if (SiamGame.runId !== myRun) return;
      UI.lock();
      await playEvents(perform(action, actor), myRun);
    }
  }

  function perform(action, actor) {
    const e = SiamGame.engine;
    switch (action.type) {
      case 'roll': return e.roll();
      case 'fine': return e.payJailFine();
      case 'buy': return e.buy();
      case 'auction': return e.declineToAuction();
      case 'end': return e.endTurn();
      case 'bid': return e.bid(actor.id, action.amount);
      case 'pass': return e.pass(actor.id);
      default: throw new Error('Unknown action ' + action.type);
    }
  }

  // ---------- who decides ----------
  async function humanChoose(actor) {
    const e = SiamGame.engine;
    const st = e.state;
    if (st.phase === 'auction') {
      const a = st.auction;
      return UI.awaitBid({
        highBid: a.highBid,
        highBidderName: a.highBidder === null ? '' : nameOf(a.highBidder),
        cash: actor.cash
      });
    }
    const ctx = { jailed: actor.jailed, offer: st.pending ? BOARD[st.pending - 1] : null };
    return UI.awaitAction(e.availableActions(), ctx);
  }

  async function botChoose(actor) {
    const e = SiamGame.engine;
    const bot = window.SiamBot.easy;
    UI.idle();
    await sleep(bot.thinkMs);
    const av = e.availableActions();
    switch (e.state.phase) {
      case 'roll':
        return av.canPayFine && bot.decideJail(e, actor.id) === 'pay' ? { type: 'fine' } : { type: 'roll' };
      case 'action':
        return { type: av.canBuy && bot.decideOffer(e, actor.id, SiamGame.botRng) === 'buy' ? 'buy' : 'auction' };
      case 'auction': {
        const bid = bot.decideBid(e, actor.id, SiamGame.botRng);
        return bid === null ? { type: 'pass' } : { type: 'bid', amount: bid };
      }
      default:
        return { type: 'end' };
    }
  }

  // ---------- replaying engine events ----------
  async function playEvents(events, myRun) {
    for (const ev of events) {
      if (SiamGame.runId !== myRun) return;
      await handle(ev);
      if (ev.balances) UI.setBalances(ev.balances);
    }
  }

  async function handle(ev) {
    const n = ev.playerId !== undefined ? nameOf(ev.playerId) : '';
    switch (ev.type) {
      case 'turn':
        UI.setCurrent(ev.playerId);
        Feed.add('🎯', n + "'s turn");
        break;
      case 'rolled':
        await Dice.roll([ev.d1, ev.d2]);
        Feed.add('🎲', n + ' rolled ' + ev.d1 + ' + ' + ev.d2 + ' = ' + ev.total);
        break;
      case 'doubles':
        Feed.add('🎲', n + ' rolled doubles and goes again');
        break;
      case 'move':
        await Tokens.moveAlong(ev.playerId, ev.path);
        break;
      case 'passStart':
        Feed.add('✈️', n + ' passed Start and collected ' + fmtBaht(ev.amount));
        break;
      case 'landStart':
        Feed.add('🏁', n + ' landed on Start and collected ' + fmtBaht(ev.amount));
        break;
      case 'land':
        Feed.add('📍', n + ' landed on ' + sqName(ev.square));
        break;
      case 'offer':
        Feed.add('🏷️', sqName(ev.square) + ' is for sale — ' + fmtBaht(ev.price));
        break;
      case 'cantAfford':
        Feed.add('🏷️', n + " can't afford " + sqName(ev.square) + ' (' + fmtBaht(ev.price) + ') — it goes to auction');
        break;
      case 'bought':
        UI.setOwner(ev.square, ev.playerId);
        Feed.add('🛺', n + ' bought ' + sqName(ev.square) + ' for ' + fmtBaht(ev.price));
        break;
      case 'declined':
        Feed.add('🔨', n + ' declined to buy ' + sqName(ev.square) + ' — auction!');
        break;
      case 'auctionStart':
        UI.showAuction(sqName(ev.square), BOARD[ev.square - 1].price);
        Feed.add('🔨', 'Auction for ' + sqName(ev.square) + ': ' + ev.bidders.map(nameOf).join(', ') + ' can bid');
        break;
      case 'auctionBid':
        UI.updateAuction(n + ' bid ' + fmtBaht(ev.amount));
        Feed.add('🔨', n + ' bid ' + fmtBaht(ev.amount) + ' on ' + sqName(ev.square));
        break;
      case 'auctionPass':
        Feed.add('🔨', n + ' passed');
        break;
      case 'auctionWon':
        UI.setOwner(ev.square, ev.playerId);
        UI.hideAuction();
        Feed.add('🛺', n + ' won ' + sqName(ev.square) + ' at auction for ' + fmtBaht(ev.amount));
        break;
      case 'auctionNoSale':
        UI.hideAuction();
        Feed.add('🔨', 'No bids — ' + sqName(ev.square) + ' stays with the bank');
        break;
      case 'rent': {
        const owner = nameOf(ev.ownerId);
        Feed.add('💰', ev.paid < ev.amount
          ? n + ' owed ' + fmtBaht(ev.amount) + ' rent to ' + owner + ' but could only pay ' + fmtBaht(ev.paid)
          : n + ' paid ' + fmtBaht(ev.amount) + ' rent to ' + owner);
        break;
      }
      case 'tax':
        Feed.add('🧾', n + ' paid ' + fmtBaht(ev.paid) + ' tax — added to the Songkran pot');
        break;
      case 'songkran':
        Feed.add('💦', ev.amount > 0
          ? n + ' landed on Songkran and collected ' + fmtBaht(ev.amount)
          : n + ' landed on Songkran — the pot is empty');
        break;
      case 'jailed':
        UI.setJailed(ev.playerId, true);
        Feed.add('🔒', n + ' was sent to prison');
        await Tokens.jumpTo(ev.playerId, ev.to);
        break;
      case 'jailFine':
        UI.setJailed(ev.playerId, false);
        Feed.add('🔒', n + ' paid ' + fmtBaht(ev.amount) + ' to leave prison');
        break;
      case 'jailFreed':
        UI.setJailed(ev.playerId, false);
        Feed.add('🔓', ev.reason === 'doubles' ? n + ' rolled doubles and got out of prison' : n + ' served their time and is released');
        break;
      case 'jailStay':
        Feed.add('🔒', n + ' stays in prison (attempt ' + ev.attempt + '/' + ev.max + ')');
        break;
      case 'cardStub':
        Feed.add(ev.deck === 'Surprise' ? '❓' : '📦', n + ' landed on ' + ev.deck + ' (cards coming soon)');
        break;
      case 'bankrupt':
        ev.released.forEach((sq) => UI.setOwner(sq, null));
        UI.markBankrupt(ev.playerId);
        Tokens.remove(ev.playerId);
        Feed.add('💀', n + ' went bankrupt');
        break;
      case 'gameOver': {
        const w = SiamGame.engine.state.players[ev.winnerId];
        Feed.add('🎉', w.name + ' wins the game!');
        UI.lock();
        UI.showWinner({ name: w.name, icon: TOKENS.find((t) => t.id === w.tokenId).icon }, reset);
        break;
      }
      default:
        break;
    }
  }

  function reset() {
    SiamGame.runId++;
    Tokens.reset();
    UI.clearOwners();
    Feed.clear();
    Feed.add('🎲', 'Choose your settings and start a new game');
    UI.showSetup();
  }

  SiamGame.start = start;
  SiamGame.reset = reset;
  window.SiamGame = SiamGame;
})();
