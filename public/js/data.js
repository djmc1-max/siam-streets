// Single source of truth for board data. Mirrors GAME_DESIGN.md sections 4, 5, 6, 7, 8, 22.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // Node (tests, Phase 4 server)
  else root.SiamData = api;                                               // browser
})(typeof self !== 'undefined' ? self : this, function () {
  const COLOR_GROUPS = {
    red:    { name: 'Bangkok Party',    color: '#e5484d' },
    orange: { name: 'East Coast',       color: '#f5892a' },
    yellow: { name: 'South Islands',    color: '#f2c94c' },
    green:  { name: 'North',            color: '#3fb950' },
    blue:   { name: 'Central/Historic', color: '#3b82f6' },
    purple: { name: 'Gulf South',       color: '#a855f7' },
    brown:  { name: 'Mid Bangkok',      color: '#a0673a' },
    pink:   { name: 'Premium Bangkok',  color: '#f472b6' }
  };

  // Rent by improvement level [base, 1 house, 2, 3, 4, hotel] — GAME_DESIGN.md section 6.
  const RENTS = {
    'Khao San Rd': [20, 100, 300, 900, 1600, 2500],
    'Chatuchak': [40, 200, 600, 1800, 3200, 4500],
    'Nana Plaza': [60, 300, 900, 2500, 4200, 6000],
    'Patpong': [60, 300, 900, 2500, 4200, 6000],
    'Pattaya': [80, 400, 1000, 3000, 4500, 7000],
    'Koh Phi Phi': [100, 500, 1500, 4500, 6250, 7500],
    'Koh Phangan': [100, 500, 1500, 4500, 6250, 7500],
    'Krabi': [120, 600, 1800, 5000, 7000, 9000],
    'Chiang Rai': [140, 700, 2000, 5500, 7500, 9500],
    'Chiang Mai': [140, 700, 2000, 5500, 7500, 9500],
    'Pai': [160, 800, 2200, 6000, 8000, 10000],
    'Ayutthaya': [180, 900, 2500, 7000, 8750, 10500],
    'Sukhothai': [180, 900, 2500, 7000, 8750, 10500],
    'Lopburi': [200, 1000, 3000, 7500, 9250, 11000],
    'Hua Hin': [220, 1100, 3300, 8000, 9750, 12000],
    'Cha Am': [220, 1100, 3300, 8000, 9750, 12000],
    'Koh Samui': [240, 1200, 3600, 8500, 10250, 12500],
    'Silom': [260, 1300, 3900, 9000, 11000, 12750],
    'Asok': [260, 1300, 3900, 9000, 11000, 12750],
    'Thonglor': [280, 1500, 4500, 10000, 12000, 14000],
    'Sathorn': [350, 1750, 5000, 11000, 13000, 15000],
    'Sukhumvit': [500, 2000, 6000, 14000, 17000, 20000]
  };

  const P = (id, name, group, price) => ({ id, name, type: 'property', group, price, rent: RENTS[name] });
  const AIRPORT = (id, name) => ({ id, name, type: 'airport', price: 2000, icon: '✈️' });
  const UTILITY = (id) => ({ id, name: 'Thai Massage', type: 'utility', price: 1500, icon: '💆' });
  const SURPRISE = (id) => ({ id, name: 'Surprise', type: 'card', icon: '❓' });
  const TREASURE = (id) => ({ id, name: 'Treasure', type: 'card', icon: '#chest' }); // '#name' = custom SVG icon

  // 40 squares in exact clockwise order, Start at top-left.
  const BOARD = [
    { id: 1, name: 'Start', type: 'corner', icon: '🏁', sub: 'Collect ฿2,000' },
    P(2, 'Khao San Rd', 'red', 600),
    TREASURE(3),
    P(4, 'Chatuchak', 'red', 600),
    { id: 5, name: 'Income Tax', type: 'tax', icon: '🧾', detail: '10% of your cash (max ฿2,000)' }, // square shows "10%"; tap card shows the rule
    AIRPORT(6, 'Don Mueang'),
    P(7, 'Nana Plaza', 'orange', 1000),
    SURPRISE(8),
    P(9, 'Patpong', 'orange', 1000),
    P(10, 'Pattaya', 'orange', 1200),
    { id: 11, name: 'In Prison', type: 'corner', icon: '#jail', sub: 'Just visiting' },
    P(12, 'Koh Phi Phi', 'yellow', 1400),
    UTILITY(13),
    P(14, 'Koh Phangan', 'yellow', 1400),
    P(15, 'Krabi', 'yellow', 1600),
    AIRPORT(16, 'Phuket Airport'),
    P(17, 'Chiang Rai', 'green', 1800),
    TREASURE(18),
    P(19, 'Chiang Mai', 'green', 1800),
    P(20, 'Pai', 'green', 2000),
    { id: 21, name: 'Songkran', type: 'corner', icon: '💦', sub: 'Collect the pot' },
    P(22, 'Ayutthaya', 'blue', 2200),
    SURPRISE(23),
    P(24, 'Sukhothai', 'blue', 2200),
    P(25, 'Lopburi', 'blue', 2400),
    AIRPORT(26, 'Chiang Mai Air'),
    P(27, 'Hua Hin', 'purple', 2600),
    P(28, 'Cha Am', 'purple', 2600),
    UTILITY(29),
    P(30, 'Koh Samui', 'purple', 2800),
    { id: 31, name: 'Go To Prison', type: 'corner', icon: '#jail', sub: 'Do not pass Start' },
    P(32, 'Silom', 'brown', 3000),
    P(33, 'Asok', 'brown', 3000),
    TREASURE(34),
    P(35, 'Thonglor', 'brown', 3200),
    AIRPORT(36, 'Suvarnabhumi'),
    SURPRISE(37),
    P(38, 'Sathorn', 'pink', 3500),
    { id: 39, name: 'Luxury Tax', type: 'tax', icon: '💎', price: 1000 },
    P(40, 'Sukhumvit', 'pink', 4000)
  ];

  // Surprise / Treasure decks — text from GAME_DESIGN.md sections 20 and 21 (a test re-parses the doc to verify).
  const SURPRISE_CARDS = [
    { id: 'S1', text: 'You got blessed by a monk at Wat Pho. Collect ฿500', effect: { type: 'collect', amount: 500 } },
    { id: 'S2', text: 'Ladyboy tipped you for a great night. Collect ฿300', effect: { type: 'collect', amount: 300 } },
    { id: 'S3', text: 'You won a Muay Thai fight. Collect ฿1,000', effect: { type: 'collect', amount: 1000 } },
    { id: 'S4', text: 'Your pad thai went viral on TikTok. Collect ฿200 from each player', effect: { type: 'collectEach', amount: 200 } },
    { id: 'S5', text: 'Tourist paid full price, no haggling. Collect ฿600', effect: { type: 'collect', amount: 600 } },
    { id: 'S6', text: 'You crashed the jet ski in Phuket. Pay ฿1,500', effect: { type: 'pay', amount: 1500 } },
    { id: 'S7', text: 'You overstayed your visa. Pay ฿1,000', effect: { type: 'pay', amount: 1000 } },
    { id: 'S8', text: 'You got a bar fine in Pattaya. Pay ฿800', effect: { type: 'pay', amount: 800 } },
    { id: 'S9', text: 'Police checkpoint. Go directly to prison', effect: { type: 'jail' } },
    { id: 'S10', text: 'Your 90 day report is due. Miss one turn', effect: { type: 'skip' } }
  ];
  const TREASURE_CARDS = [
    { id: 'T1', text: 'Tax refund from Revenue Department. Collect ฿1,000', effect: { type: 'collect', amount: 1000 } },
    { id: 'T2', text: 'Your street food stall had a great week. Collect ฿800', effect: { type: 'collect', amount: 800 } },
    { id: 'T3', text: 'Get out of prison free', effect: { type: 'jailCard' } },
    { id: 'T4', text: 'Get out of prison free', effect: { type: 'jailCard' } },
    { id: 'T5', text: '90 day report forgotten. Pay ฿500 fine', effect: { type: 'pay', amount: 500 } },
    { id: 'T6', text: 'Made a donation to the temple. Pay ฿300', effect: { type: 'pay', amount: 300 } },
    { id: 'T7', text: 'Bought a fake Rolex on Khao San Road. Pay ฿500', effect: { type: 'pay', amount: 500 } },
    { id: 'T8', text: 'A monkey stole your wallet in Lopburi. Pay ฿600', effect: { type: 'pay', amount: 600 } },
    { id: 'T9', text: 'Elephant sat on your scooter. Pay ฿700', effect: { type: 'pay', amount: 700 } },
    { id: 'T10', text: 'You lost a Muay Thai fight. Pay ฿600', effect: { type: 'pay', amount: 600 } }
  ];
  const CARDS = { surprise: SURPRISE_CARDS, treasure: TREASURE_CARDS };
  const CARD_BY_ID = {};
  SURPRISE_CARDS.concat(TREASURE_CARDS).forEach((c) => { CARD_BY_ID[c.id] = c; });

  const TOKENS = [
    { id: 'elephant',  name: 'Elephant',      icon: '🐘', free: true },
    { id: 'tuktuk',    name: 'Tuk Tuk',       icon: '🛺', free: true },
    { id: 'moped',     name: 'Moped',         icon: '🏍️', free: true },
    { id: 'strawhat',  name: 'Straw Hat',     icon: '👒', free: true },
    { id: 'gloves',    name: 'Muay Thai Gloves', icon: '🥊', free: false, coins: 90 },
    { id: 'monkey',    name: 'Monkey',        icon: '🐒', free: false, coins: 80 },
    { id: 'cocktail',  name: 'Cocktail',      icon: '🍹', free: false, coins: 60 },
    { id: 'longtail',  name: 'Longtail Boat', icon: '🛥️', free: false, coins: 70 },
    { id: 'massage',   name: 'Massage Chair', icon: '💆', free: false, coins: 60 },
    { id: 'lotus',     name: 'Lotus Flower',  icon: '🌺', free: false, coins: 70 }
  ];

  return { COLOR_GROUPS, BOARD, TOKENS, RENTS, CARDS, CARD_BY_ID };
});
