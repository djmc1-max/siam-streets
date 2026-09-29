// Single source of truth for board data. Mirrors GAME_DESIGN.md sections 4, 5, 6, 7, 8, 22.
(function () {
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

  const P = (id, name, group, price) => ({ id, name, type: 'property', group, price });
  const AIRPORT = (id, name) => ({ id, name, type: 'airport', price: 2000, icon: '✈️' });
  const UTILITY = (id) => ({ id, name: 'Thai Massage', type: 'utility', price: 1500, icon: '💆' });
  const SURPRISE = (id) => ({ id, name: 'Surprise', type: 'card', icon: '❓' });
  const TREASURE = (id) => ({ id, name: 'Treasure', type: 'card', icon: '📦' });

  // 40 squares in exact clockwise order, Start at top-left.
  const BOARD = [
    { id: 1, name: 'Start', type: 'corner', icon: '🏁', sub: 'Collect ฿2,000' },
    P(2, 'Khao San Rd', 'red', 600),
    TREASURE(3),
    P(4, 'Chatuchak', 'red', 600),
    { id: 5, name: '10% Tax', type: 'tax', icon: '🧾', sub: '10% or ฿2,000' },
    AIRPORT(6, 'Don Mueang'),
    P(7, 'Nana Plaza', 'orange', 1000),
    SURPRISE(8),
    P(9, 'Patpong', 'orange', 1000),
    P(10, 'Pattaya', 'orange', 1200),
    { id: 11, name: 'In Prison', type: 'corner', icon: '🔒', sub: 'Just visiting' },
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
    P(25, 'Kanchanaburi', 'blue', 2400),
    AIRPORT(26, 'Chiang Mai Air'),
    P(27, 'Hua Hin', 'purple', 2600),
    P(28, 'Cha Am', 'purple', 2600),
    UTILITY(29),
    P(30, 'Koh Samui', 'purple', 2800),
    { id: 31, name: 'Go To Prison', type: 'corner', icon: '🚔', sub: 'Do not pass Start' },
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

  window.SiamData = { COLOR_GROUPS, BOARD, TOKENS };
})();
