# Development Plan Follow-up: Codebase Analysis & UI/UX Design

This document details the codebase analysis for potential conflicts and high-level UI/UX designs for the new off-season modules, ensuring no existing functionalities are changed during this planning phase.

---

### 1. Codebase Analysis & Potential Conflicts

Implementing the new off-season mechanics requires careful consideration of the current game state architecture.

**A. Game Phase & State Management (`src/lib/stores/gameState.ts`)**
*   **Current State:** The game uses a simple `gamePhase` writable store (`'menu' | 'draft' | 'tournament' | 'match'`).
*   **The Conflict:** The new plan introduces several new distinct phases that must happen sequentially: `season_end` -> `retention` -> `trading` -> `auction` -> `tournament`. The current state machine is too simple to handle this flow automatically. 
*   **Solution:** We will need to expand the `gamePhase` types and introduce a `season` counter (e.g., `currentSeason: 1`). The `advanceDay` logic in `schedule.ts` will need to detect when the final day is completed and automatically shift the game into the `season_end` phase.

**B. Player Data Model (`src/lib/models/player.ts`)**
*   **Current State:** Players have a static `price` generated at creation. They lack attributes necessary for a multi-season career mode.
*   **The Conflict:** To implement retirement, aging, and dynamic valuations, the `Player` interface is missing critical fields.
*   **Solution:** We must add `age: number`, `marketValue: number`, `potential: number` (for scouting), and `isScouted: boolean` to the `Player` model. We also need to build a function that recalculates `marketValue` and `stats` based on their performance in the previous season.

**C. Financial & Roster Constraints (`src/lib/models/team.ts`)**
*   **Current State:** Teams just have a generic `budget`.
*   **The Conflict:** The Mega Auction retention rules stipulate tiered deductions (e.g., Retaining Player 1 costs 15M, Player 2 costs 12M). Trading also requires evaluating if a team has the purse to absorb a contract.
*   **Solution:** The `Team` interface needs properties to track `retainedPlayers: string[]` and potentially `rtmCardsAvailable: number`. 

**D. The Draft System (`src/routes/draft/+page.svelte`)**
*   **Current State:** The draft is a static page where you simply click up to 5 players and buy them instantly if you have the budget.
*   **The Conflict:** An English ascending auction is a stateful, event-driven process (Timer ticks down, AI bids, user counters). The current draft UI and logic (`draftAI.ts`) must be completely deprecated and replaced.
*   **Solution:** We will need a dedicated `AuctionEngine` class to manage the real-time state of the auction block, handling the queue of players, calculating AI bid probabilities, and managing the bidding timer.

---

### 2. UI/UX Design Plan for New Modules (High-Level Wireframes)

To ensure a seamless and engaging experience, here is how the new screens will be structured.

#### Module A: Season Review & Transition Hub
*   **Trigger:** Automatically appears when `schedule.currentDay` > `schedule.totalDays`.
*   **Layout:** A celebratory, dashboard-style modal.
    *   **Top:** Big banner: "Season [X] Complete!". Final Standings table.
    *   **Middle:** "Team Awards" showing your MVP, highest run-scorer, and highest wicket-taker.
    *   **Bottom:** Financial summary showing end-of-season prize money added to your budget.
    *   **Action:** A prominent button: **"Proceed to Off-Season"**.

#### Module B: Retention Board
*   **Context:** The first step of the off-season.
*   **Layout:** Split screen.
    *   **Left Panel (Your Squad):** A grid of your current players. Each card has a checkbox.
    *   **Right Panel (Financial Impact):** A sticky sidebar showing:
        *   Starting Purse: 10,000 Gold
        *   Retention Costs: -X,XXX Gold (Updates dynamically as you check players)
        *   Available Auction Purse: X,XXX Gold
        *   Rule Tracker: e.g., "3/5 Retained (Max 2 Overseas)".
    *   **Action:** **"Confirm Retentions & Release Squad"**. Warning prompt: "All unselected players will enter the auction pool."

#### Module C: Trade Window & Scouting Network
*   **Layout:** A multi-tab dashboard replacing the main tournament view.
    *   **Tab 1: Scouting Network**
        *   A grid of newly generated "Youth Academy" players (Age 18-20).
        *   Their stats are blurred or shown as ranges (e.g., `BAT: 40-75`).
        *   Button on card: **"Send Scout (Cost: 500 Gold)"**. Clicking this spends budget, runs an animation, and reveals their true base stats and potential.
    *   **Tab 2: Trade Block**
        *   Dropdown to select an AI Team.
        *   Shows your roster vs. AI roster.
        *   Click a player to propose a cash buyout. Click one of yours and one of theirs to propose a swap.
        *   Instant feedback toast: "Trade Rejected: Player is a core asset" or "Trade Accepted!".

#### Module D: The Live Mega Auction Room
*   **Vibe:** High tension, dramatic, fast-paced. Dark background with bright accent colors.
*   **Layout:**
    *   **Center Stage:** A massive, detailed card of the *Current Player on the Block*. Shows their form, stats, and previous season performance.
    *   **Top Bar:** "Lot 1: Marquee Batters" - showing the current category.
    *   **Right Sidebar (The Bidding War):**
        *   Current Highest Bid: `1,200 Gold` (Pulsing animation).
        *   Current Bidder: "Mumbai Indians".
        *   A progress bar acting as a timer (e.g., 5 seconds). If an AI bids, the timer resets.
    *   **Bottom Bar (Your Controls):**
        *   Your Remaining Purse: `4,500 Gold`.
        *   Huge Action Button: **"Bid 1,250 Gold"** (The amount auto-increments based on bidding rules).
        *   If the timer runs out and someone else won a player you previously released, a prompt interrupts: **"Use Right To Match (RTM) for 1,250 Gold?" [Yes] / [No]**.