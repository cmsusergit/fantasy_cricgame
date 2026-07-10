# Phase 4: Match Simulation Engine & Gameplay Flow

This phase covers the interactive match flow engine, coin toss reports, bowler drawers, strategy intent tunings, commentary logs, and milestone audio triggers.

---

## 1. Source Svelte References
* **Match Page Flow**: [src/routes/match/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/match/+page.svelte)
* **Match Engine Calculations**: [src/lib/core/matchEngine.ts](file:///home/user1/game/fantasy_cricmanager/src/lib/core/matchEngine.ts) (if it existed, or equivalent logic in `GameContext`)

---

## 2. Key Features & Implementation Checklists

### Module 4.1: Pitch Settings & Coin Toss
* [ ] **Pitch & Weather Report**:
  * Displays weather icon/description (Sunny, Cloudy, Rainy, Stormy) and Pitch Type (Flat, Balanced, Turning, Seaming, Bouncing).
  * Shows how these affect spin/pace bowlers and batting boundary parameters.
* [ ] **Interactive Coin Toss**:
  * Choose Heads or Tails.
  * Flips coin virtually.
  * If user wins: select "Bat First" or "Bowl First".
  * If AI wins: randomly chooses based on pitch and displays selection alert.

### Module 4.2: Opening Selectors & Match Playboard
* [ ] **Opener Selections**:
  * Batting Opening list: Select exactly 2 batsmen to open.
  * Bowling Opening list: Select 1 bowler to deliver the first over.
* [ ] **Match Playboard UI Components**:
  * **Scoreboard Panel**: Displays batting team runs, wickets, overs, current run rate (CRR), required run rate (RRR), and 2nd innings target.
  * **Batsman Cards**: Shows striker (*) and non-striker names, runs, balls faced, 4s, and 6s.
  * **Bowler Card**: Shows current bowler name, overs, runs conceded, wickets, economy rate, and bowling type.
  * **This Over Progress Dots**: A horizontal row of circular dots displaying delivery events (dot, 1, 2, 4, 6, W, wd, nb) color-coded (red for wickets, gold/yellow for boundaries, green for runs, grey for dots).

### Module 4.3: Strategy Modifications & Simulation Controls
* [ ] **Strategic Strategy Panels**:
  * **Batting Intent Selector**: User sets striker's intent (Defensive, Balanced, Aggressive).
  * **Bowling Delivery Selector**: User sets bowler's intent (Defensive, Balanced, Aggressive) and delivery type (Normal, Yorker, Bouncer, Slower).
  * **Avoid Singles Checkbox**: Instructs batsman to refuse single runs (useful for preserving strike with tailenders).
* [ ] **Wicket & Over Interstitial Pickers**:
  * **Next Batsman Selector**: Displays list of remaining batsmen when a wicket falls. Blocks playing until one is chosen.
  * **Next Bowler Selector**: Displays list of available bowlers when an over ends (prevents selecting the bowler who delivered the last over).
* [ ] **Simulation Speed Panel**:
  * **Single Ball**: Runs one ball event, appends to over progress, and prints commentary.
  * **Simulate Over**: Automatically resolves balls until the 6-ball over completes.
  * **Instant Resolve**: Simulates all remaining balls of the innings instantly.

### Module 4.4: Commentary Logs & Resolution
* [ ] **Commentary Logger Feed**:
  * Displays scrollable, rich-text logs of every ball event with customized action text (e.g. *"Bumrah bowls a bouncer... Kohli pulls it over square leg for a massive SIX!"*).
  * Highlights wickets in red and boundaries in gold/green.
* [ ] **Milestone Events**:
  * Triggers milestone alert text and speech sound effects when a player reaches 50 or 100 runs.
* [ ] **Match Resolution**:
  * Displays final scoreboard summary and winner banner.
  * Submits wins/losses/NRR back to tournament league standings and career budgets on return.
