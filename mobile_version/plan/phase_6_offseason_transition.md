# Phase 6: Off-Season Career Transitions

This phase covers career transitions: season-end reviews, awards payouts, player retirements, playstyle recalculations, player retentions (mega vs. mini rules), and youth scouting.

---

## 1. Source Svelte References
* **Season Review**: [src/routes/season-review/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/season-review/+page.svelte)
* **Retention Board**: [src/routes/retention/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/retention/+page.svelte)
* **Youth Scouting**: [src/routes/scouting/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/scouting/+page.svelte)

---

## 2. Key Features & Implementation Checklists

### Module 6.1: Season Review & Awards
* [ ] **Review Panel**:
  * Displays the finalized standings rank and awards prize cash (e.g., $100k for 1st, $80k for 2nd).
  * Deducts total annual player and staff salaries.
* [ ] **League Awards Winners**:
  * Displays MVP, Orange Cap (Top Runs), and Purple Cap (Top Wickets) winners with player cards.
* [ ] **Playstyle Development**:
  * Displays team playstyle adaptations and changes in star ratings.
* [ ] **Player Retirements**:
  * Lists players who are retiring (typically older players). Removes them from all active rosters.

### Module 6.2: Player Retention Board
* [ ] **Auction Rule Type Check**:
  * Mega Auction (occurs every 3 years): Restricts retentions to a maximum of 5 players. Uses fixed tiered pricing: $15k, $12k, $8k, $5k, $3k.
  * Mini Auction (other years): Allowed to retain any number of players. Retention cost is equal to the player's current Market Value.
* [ ] **Retention Roster Selection**:
  * Displays all squad players. User checks players to keep.
  * Dynamically calculates total retention cost and remaining purse.
* [ ] **Confirm & Release Actions**:
  * Submitting retentions deletes all un-selected players from the user team's roster array and releases them back into the global free agent pool.

### Module 6.3: Youth Academy Scouting
* [ ] **Draft Prospects Grid**:
  * Lists young prospects (Age 18-20) entering the upcoming auction.
  * Hides their exact stats (displays `??`) and potential (blurs it).
* [ ] **Scout Player Action**:
  * Pay $500 to send a scout to evaluate a player.
  * Deducts $500 from the budget, sets `isScouted` to `true`, and reveals their exact attributes and potential.
* [ ] **Proceed to Draft**:
  * Enters the next season's auction phase, initializing the auction draft pool with all free agents and youth prospects.
