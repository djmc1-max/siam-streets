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
  const botMemo = { turn: -1, n: 0 };   // property-management actions a bot has taken this turn
  const AUCTION_MS = 10000;             // the auction clock; restarts on every new bid
  const DECISION_MS = [2000, 3000];     // a bot thinks 2-3 s before any real decision or trade reply
  const BEAT_MS = 1000;                 // ...and about a second before the mechanical steps (roll, end turn)

  const SiamGame = {
    human: null,            // { name, token } from the landing screen
    engine: null,
    botRng: randomFloat,    // separate from the dice rng so bot choices never disturb the dice
    diceRng: randomFloat,
    thinkRng: randomFloat,  // test hook: picks the 2-3 s thinking time
    humanId: 0,             // the human always sits in seat 0
    botLevel: 'easy',
    botDelays: [],          // { type, ms } of every bot pause (unscaled), for tests
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

    SiamGame.botLevel = settings.botLevel === 'hard' ? 'hard' : 'easy';
    SiamGame.botDelays.length = 0;
    botMemo.turn = -1; botMemo.n = 0;
    const view = seats.map((s, i) => ({ id: i, name: s.name, isBot: s.isBot, level: s.isBot ? SiamGame.botLevel : null, icon: TOKENS.find((t) => t.id === s.tokenId).icon }));
    Feed.clear();
    UI.clearOwners();
    UI.showPlay();
    UI.renderPlayers(view, settings.startingCash);
    Tokens.init(view);
    UI.setCurrent(0);
    UI.idle();
    Feed.add('🎮', 'Game on! ' + seats.length + ' players, ' + fmtBaht(settings.startingCash) + ' each');
    Feed.add('🎯', nameOf(0) + "'s turn");

    window.SiamShow.play().then(() => { if (SiamGame.runId === myRun) return run(myRun); }).catch((err) => { console.error(err); Feed.add('⚠️', 'Something went wrong: ' + err.message); });
  }

  async function run(myRun) {
    const engine = SiamGame.engine;
    while (SiamGame.runId === myRun && engine.state.phase !== 'over') {
      if (engine.state.phase === 'auction') { await runAuction(myRun); continue; }
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
      case 'card':          // the Use card button
      case 'jailCard': return e.useJailCard();
      case 'buy': return e.buy();
      case 'auction': return e.declineToAuction();
      case 'bankrupt': return e.declareBankruptcy(actor.id);
      case 'trade': return e.proposeTrade(actor.id, action.to, action.give, action.get);
      case 'tradeReply': return e.respondTrade(actor.id, action.reply);
      case 'mortgage': return e.mortgage(actor.id, action.square);
      case 'unmortgage': return e.unmortgage(actor.id, action.square);
      case 'build': return e.build(actor.id, action.square);
      case 'sell': return e.sellBuilding(actor.id, action.square);
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
    if (st.trade) return window.SiamTrade.respond(st.trade);     // an offer (or counter-offer) is waiting for you
    const ctx = { jailed: actor.jailed, offer: st.pending ? BOARD[st.pending - 1] : null };
    if (st.phase === 'debt') ctx.debtText = debtBannerText(actor);
    else UI.setDebtBanner(null);
    return UI.awaitAction(e.availableActions(), ctx);
  }

  async function botChoose(actor) {
    const e = SiamGame.engine;
    const bot = window.SiamBot.forLevel(SiamGame.botLevel);
    UI.idle();
    const action = window.SiamBot.choose(bot, e, actor.id, SiamGame.botRng, botMemo);
    // Decisions and trade replies take a visible 2-3 s of "thinking"; rolling and ending the turn are quick.
    const quick = action.type === 'roll' || action.type === 'end';
    const ms = quick ? BEAT_MS : DECISION_MS[0] + SiamGame.thinkRng() * (DECISION_MS[1] - DECISION_MS[0]);
    SiamGame.botDelays.push({ type: action.type, ms });
    UI.setThinking(actor.id, !quick, actor.name);
    await sleep(ms);
    UI.setThinking(null, false);
    return action;
  }

  // ---------- the auction (Section 18): full-screen stage, open bidding, a clock that restarts on every bid ----------
  async function runAuction(myRun) {
    const e = SiamGame.engine;
    const a = e.state.auction;
    const Stage = window.SiamAuctionStage;
    const bot = window.SiamBot.forLevel(SiamGame.botLevel);
    const speed = window.SiamUtil.speed;
    const clock = AUCTION_MS / speed;
    const think = () => (DECISION_MS[0] + SiamGame.thinkRng() * (DECISION_MS[1] - DECISION_MS[0])) / speed;
    const roster = e.state.players.filter((p) => !p.bankrupt).map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, cash: p.cash, icon: TOKENS.find((t) => t.id === p.tokenId).icon }));
    Stage.open({ sq: BOARD[a.square - 1], roster, decliner: a.decliner, humanId: SiamGame.humanId, clockMs: clock });
    const bots = a.bidders.filter((id) => e.state.players[id].isBot);
    const next = {};
    const rethink = (now) => bots.forEach((id) => { next[id] = e.state.auction.highBidder === id ? Infinity : now + think(); });
    rethink(performance.now());

    const applyBid = async (id, amount) => {
      const events = e.bid(id, amount);
      Stage.setClock(clock);            // every new bid restarts the countdown at once
      await playEvents(events, myRun);
      rethink(performance.now());
    };

    while (SiamGame.runId === myRun && Stage.isOpen() && Stage.remaining() > 0) {
      const now = performance.now();
      const mine = Stage.takeBid();
      if (mine !== null && a.bidders.indexOf(SiamGame.humanId) !== -1) {
        try { await applyBid(SiamGame.humanId, mine); } catch (err) { /* stale click: ignore */ }
        continue;
      }
      let bid = null;
      for (const id of bots) {
        if (now < next[id]) continue;
        const amount = bot.decideBid(e, id, SiamGame.botRng);
        if (amount !== null && amount > a.highBid && amount <= e.state.players[id].cash) { bid = { id, amount }; break; }
        next[id] = Infinity;   // nothing more to say until somebody bids again
      }
      if (bid) { await applyBid(bid.id, bid.amount); continue; }
      await new Promise((r) => setTimeout(r, 40));
    }
    if (SiamGame.runId !== myRun) { Stage.close(); return; }
    await playEvents(e.closeAuction(), myRun);
    Stage.close();
  }

  const who = (creditor) => (typeof creditor === 'number' ? nameOf(creditor) : creditor === 'pot' ? 'the Songkran pot' : 'the bank');

  function debtBannerText(actor) {
    const e = SiamGame.engine;
    const list = e.debtsOf(actor.id).map((d) => fmtBaht(d.amount) + ' to ' + who(d.creditor));
    return {
      main: '⚠️ You owe ' + list.join(' and ') + '.',
      hint: 'Sell houses, mortgage a property or trade to raise the money — or declare bankruptcy.'
    };
  }

  // ---------- replaying engine events ----------
  async function playEvents(events, myRun) {
    for (const ev of events) {
      if (SiamGame.runId !== myRun) return;
      await handle(ev);
      if (ev.balances) { UI.setBalances(ev.balances); if (window.SiamAuctionStage.isOpen()) ev.balances.forEach((c, id) => window.SiamAuctionStage.setCash(id, c)); }
      if (ev.debts) UI.setDebts(ev.debts);
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
        Feed.add('🔨', 'Auction for ' + sqName(ev.square) + ': ' + ev.bidders.map(nameOf).join(', ') + ' can bid');
        break;
      case 'auctionBid':
        window.SiamAuctionStage.setBid(ev.playerId, ev.amount);
        Feed.add('🔨', n + ' bid ' + fmtBaht(ev.amount) + ' on ' + sqName(ev.square));
        break;
      case 'auctionWon':
        UI.setOwner(ev.square, ev.playerId);
        Feed.add('🛺', n + ' won ' + sqName(ev.square) + ' at auction for ' + fmtBaht(ev.amount));
        await window.SiamAuctionStage.finish(ev.playerId, ev.amount);
        break;
      case 'auctionNoSale':
        Feed.add('🔨', 'No bids — ' + sqName(ev.square) + ' stays with the bank');
        await window.SiamAuctionStage.finish(null);
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
      case 'mortgaged':
        UI.setMortgaged(ev.square, true);
        Feed.add('🏦', n + ' mortgaged ' + sqName(ev.square) + ' for ' + fmtBaht(ev.amount));
        break;
      case 'unmortgaged':
        UI.setMortgaged(ev.square, false);
        Feed.add('🏦', n + ' unmortgaged ' + sqName(ev.square) + ' for ' + fmtBaht(ev.amount));
        break;
      case 'built':
        UI.setLevel(ev.square, ev.level);
        Feed.add(ev.hotel ? '🏨' : '🏠', n + ' built a ' + (ev.hotel ? 'hotel' : 'house') + ' on ' + sqName(ev.square));
        break;
      case 'sold':
        UI.setLevel(ev.square, ev.level);
        Feed.add('💵', n + ' sold a ' + (ev.hotel ? 'hotel' : 'house') + ' on ' + sqName(ev.square) + ' for ' + fmtBaht(ev.refund));
        break;
      case 'tradeProposed':
        window.SiamTrade.watch(ev, 'offer');
        Feed.add('🤝', nameOf(ev.from) + ' offers ' + nameOf(ev.to) + ' a trade: gives ' + window.SiamTrade.describe(ev.give) + ' for ' + window.SiamTrade.describe(ev.get));
        break;
      case 'tradeCountered':
        window.SiamTrade.watch(ev, 'counter');
        Feed.add('🤝', nameOf(ev.from) + ' counter-offers ' + nameOf(ev.to) + ': gives ' + window.SiamTrade.describe(ev.give) + ' for ' + window.SiamTrade.describe(ev.get));
        break;
      case 'tradeDeclined':
        window.SiamTrade.watch(ev, 'declined');
        Feed.add('🤝', nameOf(ev.to) + ' declined ' + nameOf(ev.from) + "'s offer");
        break;
      case 'tradeCompleted':
        window.SiamTrade.watch(ev, 'completed');
        ev.give.props.forEach((sq) => UI.setOwner(sq, ev.to));
        ev.get.props.forEach((sq) => UI.setOwner(sq, ev.from));
        ev.jailCards.forEach((count, id) => UI.setJailCards(id, count));
        Feed.add('🤝', nameOf(ev.from) + ' and ' + nameOf(ev.to) + ' completed a trade');
        Feed.add('🤝', nameOf(ev.from) + ' gave ' + window.SiamTrade.describe(ev.give) + ' and got ' + window.SiamTrade.describe(ev.get));
        break;
      case 'debtLogged':
        Feed.add('⚠️', n + ' owes ' + fmtBaht(ev.amount) + ' to ' + who(ev.creditor) + ' — debt pending');
        break;
      case 'debtPayment':
        Feed.add('💵', n + ' paid ' + fmtBaht(ev.amount) + ' toward their debt to ' + who(ev.creditor) + ' (' + fmtBaht(ev.remaining) + ' left)');
        break;
      case 'debtResolved':
        Feed.add('✅', n + ' resolved their debt');
        break;
      case 'rentMortgaged':
        Feed.add('🏦', n + ' landed on ' + sqName(ev.square) + ' — mortgaged, so no rent');
        break;
      case 'jailed':
        UI.setJailed(ev.playerId, true);
        Feed.add('#jail', n + ' was sent to prison');
        await Tokens.jumpTo(ev.playerId, ev.to);
        break;
      case 'jailFine':
        UI.setJailed(ev.playerId, false);
        Feed.add('#jail', n + ' paid ' + fmtBaht(ev.amount) + ' to leave prison');
        break;
      case 'jailFreed':
        UI.setJailed(ev.playerId, false);
        Feed.add('#jail', ev.reason === 'doubles' ? n + ' rolled doubles and got out of prison' : n + ' served their time and is released');
        break;
      case 'jailStay':
        Feed.add('#jail', n + ' stays in prison (attempt ' + ev.attempt + '/' + ev.max + ')');
        break;
      case 'cardDrawn': {
        const deckName = ev.deck === 'surprise' ? 'Surprise' : 'Treasure';
        const bot = SiamGame.engine.state.players[ev.playerId].isBot;
        // the human's card waits for a tap before its effect is shown; bots' cards continue by themselves
        await window.SiamCardView.show({ deck: ev.deck, text: ev.text, playerName: n, waitForTap: !bot });
        await sleep(600);       // a beat after the card closes, so the effect on the money is seen happening
        Feed.add(ev.deck === 'surprise' ? '❓' : '#chest', n + ' drew a ' + deckName + ' card — ' + ev.text);
        break;
      }
      case 'cardEffect':
        if (ev.kind === 'skip') Feed.add('🚫', n + ' will miss their next turn');
        break;
      case 'cardKept':
        UI.setJailCards(ev.playerId, ev.count);
        Feed.add('🆓', n + ' keeps a Get Out of Jail Free card');
        break;
      case 'jailCardUsed':
        UI.setJailCards(ev.playerId, ev.count);
        UI.setJailed(ev.playerId, false);
        Feed.add('🆓', n + ' used a Get Out of Jail Free card');
        break;
      case 'turnSkipped':
        Feed.add('🚫', n + ' misses this turn');
        break;
      case 'bankrupt':
        UI.setJailCards(ev.playerId, 0);
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
    window.SiamAuctionStage.close();
    UI.setThinking(null, false);
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
