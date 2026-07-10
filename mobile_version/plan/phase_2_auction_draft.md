# Phase 2: Live Auction Room & Player Draft

This phase covers the Player Auction loop, AI bidding behaviors, bid increments, and draft resolution.

---

## 1. Source Svelte References
* **Auction Arena**: [src/routes/auction/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/auction/+page.svelte)
* **Auction State Engine**: [src/lib/stores/auctionState.ts](file:///home/user1/game/fantasy_cricmanager/src/lib/stores/auctionState.ts) (if it existed, or equivalent logic in `GameContext`)

---

## 2. Key Features & Implementation Checklists

### Module 2.1: Live Auction Arena & Log Feed
* [ ] **Active Player Spotlight Card**:
  * Displays the player currently up for bidding (Name, Faction, Role, Base Price, Age, and revealed attributes).
* [ ] **Real-Time Bidding Log Feed**:
  * Displays a chronological list of recent bids (e.g. `"Orcs bid $45,000"`, `"Elves bid $50,000"`).
  * highlights the current highest bidder and bid amount.
* [ ] **User Bid Buttons**:
  * Bid button to place the next minimum increment (+$5,000 or 10% above current bid).
  * Custom bid entry box.
  * Checks that the user has enough remaining purse before allowing a bid.
* [ ] **Auction Controls**:
  * "Pass" button to opt-out of bidding for the current player.
  * "Fast Forward Player" button to instantly resolve the current player.
  * "Auto Complete Auction" button to simulate all remaining player drafts.

### Module 2.2: AI Bidding Decision Engine & Roster Auto-generation
* [ ] **AI Personality Weights**:
  * Simulates other league franchises bidding on players based on team budgets, roster needs (e.g., needing a bowler or batsman), and personality tendencies (e.g., aggressive teams bid higher, strategic teams save budget).
* [ ] **Auto-sold & Unsold Resolution**:
  * Triggers when the countdown timer expires (bidding stops after 5 seconds of inactivity).
  * Sells player to the highest bidder, deducts money from their budget, and appends the player to the team's roster array.
  * Handles unsold players (returns them to pool or marks them passed).
* [ ] **Roster Completion Check**:
  * Loops until all 6 AI teams and the user team have at least 15 players.
  * Transitions phase to `tournament` when the auction wraps.
