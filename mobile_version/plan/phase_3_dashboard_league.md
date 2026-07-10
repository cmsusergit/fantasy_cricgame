# Phase 3: Calendar, Standings, & Training Lab

This phase covers the main career tournament calendar loop, standings leaderboard, and the player training systems.

---

## 1. Source Svelte References
* **Tournament Calendar**: [src/routes/tournament/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/tournament/+page.svelte)
* **League Standings**: [src/routes/teams/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/teams/+page.svelte)
* **Training upgrades**: [src/routes/training/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/training/+page.svelte)

---

## 2. Key Features & Implementation Checklists

### Module 3.1: Calendar Schedule & AI Simulation Day Loop
* [ ] **Day Progression Tracker**:
  * Shows current day index (Day 1 to 45).
  * Filter matches list by day.
* [ ] **Today's Match Card List**:
  * Displays all matches scheduled for the current day.
  * Highlights the user's match if scheduled.
* [ ] **AI Matches Auto-Simulator**:
  * Tapping "Simulate Day" runs random score resolutions for all AI vs. AI matches on that day.
  * Records runs and wickets into team stats for NRR calculations.
  * Advances current day index by 1.
  * Restricts advancing if the user's own match is today and has not been played yet.

### Module 3.2: League Standings & Leaders
* [ ] **Live Standing Table**:
  * Lists all 6 teams sorted by Points (2 pts per win, 0 per loss) and Net Run Rate (NRR).
  * Columns: Rank, Team Name, P, W, L, Pts, NRR.
  * Stylized indicator representing team primary color.
* [ ] **Individual Player Leaderboards**:
  * **Orange Cap Table**: Top 5 run-scorers in the tournament. Displays name, team, and runs.
  * **Purple Cap Table**: Top 5 wicket-takers in the tournament. Displays name, team, and wickets.

### Module 3.3: Training Lab & Upgrade Options
* [ ] **Training Lab Portal**:
  * Select a player from your squad.
  * Displays current stats and two upgrade pathways:
* [ ] **Cash-based Training**:
  * Increases a stat (Batting, Bowling, Power, Technique, Fielding) in exchange for cash.
  * Enforces training cost scales based on player's current stat level and facility tier.
* [ ] **XP-based Upgrades**:
  * Upgrade a stat by exactly +1 using accumulated Player XP (gained from matches) and a credit fee.
  * Enforces XP cost scale (e.g. 100 XP for stats <= 50, 250 XP for <= 75, etc.).
