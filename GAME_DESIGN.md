# SIAM STREETS
## Complete Game Design Document for Claude Code
**Slogan:** *"Can you rule the streets of Siam?"*
**Domain:** siamstreets.io
**Type:** Browser-based online multiplayer property board game
**Inspired by:** RichUp.io and Monopoly

---

## 1. CONCEPT OVERVIEW

Siam Streets is a free-to-play, browser-based online multiplayer property board game set in Thailand. Players roll dice, move around a board, buy Thai landmark properties, collect rent, build houses and hotels, and try to bankrupt all other players to win.

- No download required
- No sign-up required to play
- English language only
- Works on desktop and mobile browsers
- Dark background visual style similar to RichUp.io
- Fast gameplay — games should last 20-40 minutes
- Fully automatic gameplay — all money, movement and effects happen automatically
- Players only make decisions when a decision is actually required

---

## 2. TECH STACK GUIDANCE

Build this as a web application using:
- **Frontend:** HTML, CSS, JavaScript
- **Real-time multiplayer:** Socket.io
- **Backend:** Node.js
- **Payments:** Stripe API (Phase 6 only)
- **Hosting:** To be decided later

---

## 3. VISUAL STYLE

- Dark navy/black background — same as RichUp.io
- Board sits around the edges of the screen as a square
- Center of the board contains:
  - Siam Streets logo (top)
  - Two 3D dice (center)
  - Live activity feed below the dice (scrolling log of game events)
  - Start game button before game begins
- Property squares have colored region indicators
- Each square shows property name and price in Thai Baht ฿
- Clean, modern, readable font
- Rounded corners on property squares
- Corner squares are larger than regular squares

---

## 4. THE BOARD — 40 SQUARES IN EXACT ORDER

**Board orientation:** Square 1 (Start) is positioned at the **top-left corner** of the board. The board runs **clockwise** from there — proceeding right along the top edge, down the right edge, left along the bottom edge, and back up the left edge to Start.

| # | Square Name | Type | Color Group |
|---|---|---|---|
| 1 | Start | Corner | — |
| 2 | Khao San Rd | Property | 🔴 Red |
| 3 | Treasure | Card | — |
| 4 | Chatuchak | Property | 🔴 Red |
| 5 | 10% Tax | Tax | — |
| 6 | Don Mueang | Airport | — |
| 7 | Nana Plaza | Property | 🟠 Orange |
| 8 | Surprise | Card | — |
| 9 | Patpong | Property | 🟠 Orange |
| 10 | Pattaya | Property | 🟠 Orange |
| 11 | In Prison | Corner | — |
| 12 | Koh Phi Phi | Property | 🟡 Yellow |
| 13 | Thai Massage | Utility | — |
| 14 | Koh Phangan | Property | 🟡 Yellow |
| 15 | Krabi | Property | 🟡 Yellow |
| 16 | Phuket Airport | Airport | — |
| 17 | Chiang Rai | Property | 🟢 Green |
| 18 | Treasure | Card | — |
| 19 | Chiang Mai | Property | 🟢 Green |
| 20 | Pai | Property | 🟢 Green |
| 21 | Songkran | Corner | — |
| 22 | Ayutthaya | Property | 🔵 Blue |
| 23 | Surprise | Card | — |
| 24 | Sukhothai | Property | 🔵 Blue |
| 25 | Kanchanaburi | Property | 🔵 Blue |
| 26 | Chiang Mai Air | Airport | — |
| 27 | Hua Hin | Property | 🟣 Purple |
| 28 | Cha Am | Property | 🟣 Purple |
| 29 | Thai Massage | Utility | — |
| 30 | Koh Samui | Property | 🟣 Purple |
| 31 | Go To Prison | Corner | — |
| 32 | Silom | Property | 🟤 Brown |
| 33 | Asok | Property | 🟤 Brown |
| 34 | Treasure | Card | — |
| 35 | Thonglor | Property | 🟤 Brown |
| 36 | Suvarnabhumi | Airport | — |
| 37 | Surprise | Card | — |
| 38 | Sathorn | Property | 🩷 Pink |
| 39 | Luxury Tax | Tax | — |
| 40 | Sukhumvit | Property | 🩷 Pink |

---

## 5. COLOR GROUPS

| Color | Group Name | Properties | Count |
|---|---|---|---|
| 🔴 Red | Bangkok Party | Khao San Rd, Chatuchak | 2 |
| 🟠 Orange | East Coast | Nana Plaza, Patpong, Pattaya | 3 |
| 🟡 Yellow | South Islands | Koh Phi Phi, Koh Phangan, Krabi | 3 |
| 🟢 Green | North | Chiang Rai, Chiang Mai, Pai | 3 |
| 🔵 Blue | Central/Historic | Ayutthaya, Sukhothai, Kanchanaburi | 3 |
| 🟣 Purple | Gulf South | Hua Hin, Cha Am, Koh Samui | 3 |
| 🟤 Brown | Mid Bangkok | Silom, Asok, Thonglor | 3 |
| 🩷 Pink | Premium Bangkok | Sathorn, Sukhumvit | 2 |

---

## 6. PROPERTY PRICING

| Property | Color | Buy Price | Rent | 1 House | 2 Houses | 3 Houses | 4 Houses | Hotel |
|---|---|---|---|---|---|---|---|---|
| Khao San Rd | 🔴 | ฿600 | ฿20 | ฿100 | ฿300 | ฿900 | ฿1,600 | ฿2,500 |
| Chatuchak | 🔴 | ฿600 | ฿40 | ฿200 | ฿600 | ฿1,800 | ฿3,200 | ฿4,500 |
| Nana Plaza | 🟠 | ฿1,000 | ฿60 | ฿300 | ฿900 | ฿2,500 | ฿4,200 | ฿6,000 |
| Patpong | 🟠 | ฿1,000 | ฿60 | ฿300 | ฿900 | ฿2,500 | ฿4,200 | ฿6,000 |
| Pattaya | 🟠 | ฿1,200 | ฿80 | ฿400 | ฿1,000 | ฿3,000 | ฿4,500 | ฿7,000 |
| Koh Phi Phi | 🟡 | ฿1,400 | ฿100 | ฿500 | ฿1,500 | ฿4,500 | ฿6,250 | ฿7,500 |
| Koh Phangan | 🟡 | ฿1,400 | ฿100 | ฿500 | ฿1,500 | ฿4,500 | ฿6,250 | ฿7,500 |
| Krabi | 🟡 | ฿1,600 | ฿120 | ฿600 | ฿1,800 | ฿5,000 | ฿7,000 | ฿9,000 |
| Chiang Rai | 🟢 | ฿1,800 | ฿140 | ฿700 | ฿2,000 | ฿5,500 | ฿7,500 | ฿9,500 |
| Chiang Mai | 🟢 | ฿1,800 | ฿140 | ฿700 | ฿2,000 | ฿5,500 | ฿7,500 | ฿9,500 |
| Pai | 🟢 | ฿2,000 | ฿160 | ฿800 | ฿2,200 | ฿6,000 | ฿8,000 | ฿10,000 |
| Ayutthaya | 🔵 | ฿2,200 | ฿180 | ฿900 | ฿2,500 | ฿7,000 | ฿8,750 | ฿10,500 |
| Sukhothai | 🔵 | ฿2,200 | ฿180 | ฿900 | ฿2,500 | ฿7,000 | ฿8,750 | ฿10,500 |
| Kanchanaburi | 🔵 | ฿2,400 | ฿200 | ฿1,000 | ฿3,000 | ฿7,500 | ฿9,250 | ฿11,000 |
| Hua Hin | 🟣 | ฿2,600 | ฿220 | ฿1,100 | ฿3,300 | ฿8,000 | ฿9,750 | ฿12,000 |
| Cha Am | 🟣 | ฿2,600 | ฿220 | ฿1,100 | ฿3,300 | ฿8,000 | ฿9,750 | ฿12,000 |
| Koh Samui | 🟣 | ฿2,800 | ฿240 | ฿1,200 | ฿3,600 | ฿8,500 | ฿10,250 | ฿12,500 |
| Silom | 🟤 | ฿3,000 | ฿260 | ฿1,300 | ฿3,900 | ฿9,000 | ฿11,000 | ฿12,750 |
| Asok | 🟤 | ฿3,000 | ฿260 | ฿1,300 | ฿3,900 | ฿9,000 | ฿11,000 | ฿12,750 |
| Thonglor | 🟤 | ฿3,200 | ฿280 | ฿1,500 | ฿4,500 | ฿10,000 | ฿12,000 | ฿14,000 |
| Sathorn | 🩷 | ฿3,500 | ฿350 | ฿1,750 | ฿5,000 | ฿11,000 | ฿13,000 | ฿15,000 |
| Sukhumvit | 🩷 | ฿4,000 | ฿500 | ฿2,000 | ฿6,000 | ฿14,000 | ฿17,000 | ฿20,000 |

---

## 7. AIRPORTS

**Purchase price: ฿2,000 each**
**Names:** Don Mueang (sq 6), Phuket Airport (sq 16), Chiang Mai Air (sq 26), Suvarnabhumi (sq 36)

| Airports Owned | Rent |
|---|---|
| 1 | ฿500 |
| 2 | ฿1,000 |
| 3 | ฿2,000 |
| 4 | ฿4,000 |

---

## 8. UTILITIES — THAI MASSAGE

**Purchase price: ฿1,500 each**
**Locations:** Square 13 and Square 29

| Utilities Owned | Rent Calculation |
|---|---|
| 1 Thai Massage | Dice roll x 40 |
| 2 Thai Massages | Dice roll x 100 |

---

## 9. HOUSE AND HOTEL BUILD COSTS

| Color Group | House Cost | Hotel Cost |
|---|---|---|
| 🔴 Red | ฿500 | ฿500 |
| 🟠 Orange | ฿500 | ฿500 |
| 🟡 Yellow | ฿1,000 | ฿1,000 |
| 🟢 Green | ฿1,000 | ฿1,000 |
| 🔵 Blue | ฿1,500 | ฿1,500 |
| 🟣 Purple | ฿1,500 | ฿1,500 |
| 🟤 Brown | ฿2,000 | ฿2,000 |
| 🩷 Pink | ฿2,000 | ฿2,000 |

- Player must own ALL properties in a color group before building
- Must build evenly across the group
- No limit on number of houses or hotels
- Sell houses back to bank at 50% of build cost

---

## 10. TAX SQUARES

| Square | Rule |
|---|---|
| 10% Tax (square 5) | Player pays 10% of current cash OR flat ฿2,000 — player chooses whichever is less |
| Luxury Tax (square 39) | Player pays flat ฿1,000 |

All tax payments go into the **Songkran pot**. Songkran (square 21) is a **corner square** — when a player lands on it they collect everything in the pot.

---

## 11. CORNER SQUARES

| Square | Name | Rule |
|---|---|---|
| 1 | Start | Collect ฿2,000 when passing. Collect ฿4,000 when landing ON Start |
| 11 | In Prison | Just visiting — no effect unless sent here |
| 21 | Songkran | Free parking — collect all money in the center pot |
| 31 | Go To Prison | Go directly to jail. Do not pass Start. Do not collect ฿2,000 |

---

## 12. GAME SETTINGS

| Setting | Default | Options |
|---|---|---|
| Starting Baht | ฿15,000 | ฿10,000 / ฿15,000 / ฿20,000 / ฿25,000 / ฿30,000 |
| Pass Start salary | ฿2,000 | Fixed |
| Land ON Start | ฿4,000 | Fixed |
| Max players | 6 | 2-6 |
| Bots | Available | 2 difficulty levels — Easy and Hard |
| Turn timer | None | No timer |
| Game speed | Fast | — |

---

## 13. JAIL RULES

- Player goes to jail when: landing on Go To Prison, rolling doubles 3 times in a row, or drawing a Police Checkpoint Surprise card
- To get out of jail:
  - Pay ฿500 fine
  - Use a Get Out of Jail Free card
  - Roll doubles within 3 turns
- If player fails to roll doubles after 3 turns — released for free
- While in jail player still collects rent from their properties

---

## 14. DOUBLES RULES

- Roll doubles → take another turn
- Roll doubles twice in a row → take another turn
- Roll doubles three times in a row → go directly to jail

---

## 15. MORTGAGE SYSTEM

- Any property can be mortgaged for 50% of its purchase price
- Mortgaged properties earn zero rent
- To unmortgage — pay back the 50% to the bank
- Bankrupt player's properties return to bank regardless of mortgage status

---

## 16. BANKRUPTCY RULES

- If a player owes more than they can pay:
  - Available cash is automatically transferred to the creditor
  - All remaining properties return to the bank — available for purchase again naturally
  - Bankrupt player is eliminated from the game
  - Bankrupt player becomes a spectator automatically
  - Properties are NOT auctioned — they return to bank as if start of game
- Last player remaining wins the game

---

## 17. DEBT SYSTEM

- If a player owes money but cannot pay immediately:
  - Debt is logged and shown clearly on screen
  - Game continues normally for other players
  - When it is the indebted player's turn they MUST resolve the debt before rolling
  - Resolution options: sell houses, mortgage a property, make a trade, or declare bankruptcy
  - Debt shown in live activity feed as a warning notification

---

## 18. AUCTION SYSTEM

- Automatically triggers when:
  - A player lands on an unowned property and declines to buy it
  - A player lands on an unowned property and cannot afford it
- All players except the one who triggered the auction can bid
- Minimum bid starts at ฿1
- Highest bidder wins the property and pays immediately
- If no one bids — property remains with the bank

---

## 19. TRADING SYSTEM

- Any player can initiate a trade with any other player at any time
- Trade button always visible in the UI
- Trade offer can include: properties + cash combined in one offer
- Receiver options: Accept / Decline / Negotiate
- If Negotiate — counter offer can be made
- All completed trades logged in live activity feed

---

## 20. SURPRISE CARDS — 10 Cards (shuffled randomly)

| # | Card Text | Effect |
|---|---|---|
| 1 | You got blessed by a monk at Wat Pho. Collect ฿500 | +฿500 |
| 2 | Ladyboy tipped you for a great night. Collect ฿300 | +฿300 |
| 3 | You won a Muay Thai fight. Collect ฿1,000 | +฿1,000 |
| 4 | Your pad thai went viral on TikTok. Collect ฿200 from each player | +฿200 from each player |
| 5 | Tourist paid full price, no haggling. Collect ฿600 | +฿600 |
| 6 | You crashed the jet ski in Phuket. Pay ฿1,500 | -฿1,500 |
| 7 | You overstayed your visa. Pay ฿1,000 | -฿1,000 |
| 8 | You got a bar fine in Pattaya. Pay ฿800 | -฿800 |
| 9 | Police checkpoint. Go directly to prison | Go to jail |
| 10 | Your 90 day report is due. Miss one turn | Miss one turn |

---

## 21. TREASURE CARDS — 10 Cards (shuffled randomly)

| # | Card Text | Effect |
|---|---|---|
| 1 | Tax refund from Revenue Department. Collect ฿1,000 | +฿1,000 |
| 2 | Your street food stall had a great week. Collect ฿800 | +฿800 |
| 3 | Get out of prison free | Keep card — use anytime |
| 4 | Get out of prison free | Keep card — use anytime |
| 5 | 90 day report forgotten. Pay ฿500 fine | -฿500 |
| 6 | Made a donation to the temple. Pay ฿300 | -฿300 |
| 7 | Bought a fake Rolex on Khao San Road. Pay ฿500 | -฿500 |
| 8 | A monkey stole your wallet in Lopburi. Pay ฿600 | -฿600 |
| 9 | Elephant sat on your scooter. Pay ฿700 | -฿700 |
| 10 | You lost a Muay Thai fight. Pay ฿600 | -฿600 |

- Get Out of Jail Free cards are kept by the player until used
- They can be traded with other players
- When used they are returned to the bottom of the Treasure deck

---

## 22. PLAYER TOKENS

**Free starter tokens (all players get these by default):**
- Elephant 🐘
- Tuk Tuk 🛺
- Moped 🏍️
- Straw Hat 👒

**Premium tokens (purchasable with coins):**
- Muay Thai Gloves 🥊 — 90 coins
- Monkey 🐒 — 80 coins
- Cocktail 🍹 — 60 coins
- Longtail Boat 🛥️ — 70 coins
- Massage Chair 💆 — 60 coins
- Lotus Flower 🌺 — 70 coins

---

## 23. VOTE KICK SYSTEM

- Any player can initiate a vote kick against any other player
- Majority vote required to kick
- Kicked player is removed from the game
- Kicked player's properties return to the bank
- Game continues with remaining players
- No bot replaces a kicked or bankrupt player

---

## 24. CHAT SYSTEM

- In-game text chat visible to all active players
- Eliminated/spectating players CANNOT use chat
- Spectators can watch but cannot chat
- Report button available next to each player's chat message
- Quick emoji reactions available: 👍 😂 😤 🎉

---

## 25. LIVE ACTIVITY FEED

A continuously scrolling log in the center of the board showing all game events in real time:

- 🛺 [Player] bought [Property] for ฿[amount]
- ✈️ [Player] passed Start and collected ฿2,000
- 🎲 [Player] rolled doubles and goes again
- 💰 [Player] paid ฿[amount] rent to [Player]
- ❓ [Player] drew a Surprise card — [card text]
- 📦 [Player] drew a Treasure card — [card text]
- 🔒 [Player] was sent to prison
- 🤝 [Player] and [Player] completed a trade
- 🏠 [Player] built a house on [Property]
- 🏨 [Player] built a hotel on [Property]
- ⚠️ [Player] owes ฿[amount] to [Player] — debt pending
- ✅ [Player] resolved their debt
- 💀 [Player] went bankrupt
- 🎉 [Player] wins the game!

---

## 26. SOUND DESIGN

| Sound | Trigger |
|---|---|
| Dice rolling | Every dice roll animation |
| Dice landing | When dice stop rolling |
| Your turn ping | Notification when it is your turn |
| Property purchased | When a player buys a property |
| Rent collected | When someone pays you rent |
| Rent paid | When you pay rent |
| House built | When a house is placed |
| Hotel built | When a hotel is placed |
| Going to jail | When sent to jail |
| Surprise card | Card flip sound |
| Treasure card | Card flip sound |
| Passing Start | Salary collected sound |
| Bankruptcy | Losing/elimination sound |
| Winner announced | Victory fanfare + fireworks animation |
| Trade completed | Success sound |
| Auction won | Gavel sound |
| Intro music | Short Thai-style theme, 8-9 seconds — plays on landing screen |
| Crowd applause | Plays once when transitioning from lobby into the live board |

---

## 27. END OF GAME SCREEN

**Winner announcement:**
- Full screen fireworks animation
- Trophy icon
- Winner name and avatar displayed prominently
- Two buttons: Another Game / Back to Lobby

**Game statistics panel:**

| Stat | Description |
|---|---|
| Duration | Total game time |
| Total turns | Number of turns taken |
| Doubles rolled | Total doubles across all players |
| Trades completed | Total trades made |
| Chat messages | Total messages sent |
| Most properties owned | Player who owned most at peak |
| Most times in jail | Player who went to jail most |
| Most trades made | Most active trader |
| Highest rent collected | Single largest rent payment |
| Most visited property | Property landed on most |

**Net worth over time graph:**
- Line graph showing each player's wealth throughout the game
- Different color line per player
- X axis = turn number
- Y axis = ฿ Baht net worth including property values

---

## 28. PLAYER PROFILE — PUBLIC STATS

Each player has a public profile showing:
- Username and avatar
- Games played
- Games won
- Games lost
- Win percentage
- Total trades made
- Tournament wins
- Member since date

---

## 29. ROOM SYSTEM

**Public rooms:**
- Listed in a public lobby
- Anyone can join
- Shows: host name, number of players, map being used, game settings

**Private rooms:**
- Any player can create
- Generates a shareable link AND a QR code
- Share with friends to invite them

**DLC map rooms:**
- Only the host needs to own the DLC map
- Invited guests can play the DLC map for free
- Host must remain in the game for DLC map to stay active

---

## 30. SPECTATOR MODE

- Players can join any game as a spectator
- Spectators can watch the full game in real time
- Spectators cannot use chat
- Spectators cannot interact with the game in any way
- Eliminated players automatically become spectators

---

## 31. MAPS

| Map | Status | Coin Price | Real Money |
|---|---|---|---|
| Thailand | Free — available at launch | 0 | Free |
| Chiang Mai | Coming Soon | 800 coins | ฿299 |
| Phuket | Coming Soon | 1,200 coins | ฿499 |
| Bangkok | Coming Soon | 2,000 coins | ฿899 |

- Coming Soon maps are visible in the map selection screen with a padlock icon

---

## 32. COIN ECONOMY

**Earning free coins:**

| Method | Coins Earned |
|---|---|
| Daily login | 20 coins |
| Day 3 login streak | 30 coins bonus |
| Day 7 login streak | 100 coins bonus |
| Win a game vs real players | 20 coins |
| Finish a game without quitting | 10 coins |
| Watch optional ad | 20 coins |

**Coin packs — purchase with real money via Stripe:**

| Pack Name | Coins | Price (฿) |
|---|---|---|
| Pile of Coins | 100 coins | ฿149 |
| Sack of Coins | 275 coins | ฿349 |
| Wallet of Coins | 580 coins | ฿699 |
| Check of Coins | 960 coins | ฿1,099 |
| Vault of Coins | 1,500 coins | ฿1,699 |
| Bank of Coins | 3,250 coins | ฿3,499 — Best Value |

- Playing games is always free — coins are only for extras
- Coins carry over between sessions and never expire

---

## 33. STORE CATEGORIES

1. **Player Appearance** — avatar tokens
2. **Board Maps** — DLC maps
3. **Profile Pictures** — custom profile images
4. **Get Coins** — coin packs with real money

---

## 34. TOURNAMENT SYSTEM — COMING SOON

Display as Coming Soon at launch. Rules visible to players:

- 16 players total
- Split into 4 groups of 4
- Each group plays one full game
- Top player from each group advances
- 4 winners play the grand final
- Entry fee: 100 coins
- Prize: coins + exclusive tournament winner badge on profile
- Schedule: weekends only (Saturday and Sunday)
- Future expansion to 32 players planned

---

## 35. BUTTONS REQUIRED IN GAME UI

| Button | Function |
|---|---|
| Roll Dice | Roll both dice — only active on your turn |
| Buy | Purchase property you landed on |
| Auction | Decline to buy — triggers auction |
| Build | Buy houses/hotels on owned complete groups |
| Mortgage | Mortgage a property for 50% value |
| Unmortgage | Pay back mortgage |
| Trade | Initiate trade with another player |
| Declare Bankruptcy | Voluntarily go bankrupt |
| Vote Kick | Initiate vote to remove a player |
| End Turn | End your turn manually |

---

## 36. PAYMENT SYSTEM

- **Payment processor:** Stripe
- **Currency:** Thai Baht (฿)
- **What can be purchased:** Coin packs and DLC maps directly
- Playing the game is always free
- No real money gambling — coins are only used for cosmetics, maps and tournament entry

---

## 37. BUILD ORDER — 6 PHASES

**Phase 1 — Landing Screen + Visual Board**
- Landing/onboarding screen (Section 39)
- 40 square board layout in HTML/CSS
- All squares in correct positions with correct names
- Color groups visually represented
- Corner squares correctly sized
- Dark background with center area for dice and feed

**Phase 2 — Basic Game Mechanics**
- Dice rolling with animation
- Player token movement around board
- Property purchasing
- Rent collection
- Pass Start salary
- Basic turn management

**Phase 3 — Advanced Mechanics**
- Card systems (Surprise and Treasure)
- Jail rules and doubles rules
- Mortgage system
- Building houses and hotels
- Auction system
- Bankruptcy and debt system
- Trading system

**Phase 4 — Multiplayer**
- Public room lobby
- Private rooms with link/QR code
- Real time gameplay with Socket.io
- Chat system
- Vote kick system
- Spectator mode

**Phase 5 — UI and Polish**
- Live activity feed
- Sound design
- End of game screen with stats and graph
- Player profiles
- Animations and visual polish

**Phase 6 — Store and Monetization**
- Coin economy
- Daily login rewards
- Store UI
- Stripe payment integration
- DLC map system

---

## 38. CRITICAL NOTES FOR CLAUDE CODE

1. All money transactions happen automatically — players never manually move money
2. Player tokens move automatically the exact number of squares rolled
3. All effects from cards are applied automatically and instantly
4. Never use localStorage or sessionStorage — use server-side state management
5. The board must work on both desktop and mobile browsers
6. Keep the UI clean and minimal — players' eyes should focus on the board
7. All prices are in Thai Baht ฿ — never use $ in the game
8. The meta currency is called Coins — keep completely separate from in-game Baht
9. Do not mention or reference the Royal Family, Grand Palace or any royal institutions anywhere in the game
10. No bot replaces bankrupt or kicked players — properties return to bank

---

## 39. LANDING / ONBOARDING SCREEN

This is the very first screen a player sees when they open Siam Streets.

**Layout and flow:**

1. **Intro music** plays automatically on screen load — short Thai-style theme, 8-9 seconds
2. **Siam Streets logo and slogan** displayed prominently: *"Can you rule the streets of Siam?"*
3. **Name entry field** — player types in their display name
4. **Character selection** — player picks their token from the free starter set (Elephant, Tuk Tuk, Moped, Straw Hat); premium tokens shown but locked/greyed out
5. **How to Play blurb** — 3 sentences:
   - *"Roll the dice, move around Thailand, and buy up properties as you go."*
   - *"Collect rent from other players when they land on your properties, build houses and hotels to earn more."*
   - *"Be the last player standing to win — everyone else goes bankrupt!"*
6. **Continue/Play button** — takes player to room selection screen

**Transition into the game:**
- When host starts the game, play **crowd applause** sound as screen transitions from lobby into the live board

---

*Document version: 2 — Ready for Claude Code*
*Game: Siam Streets | siamstreets.io*
*Slogan: Can you rule the streets of Siam?*
