# Phase 5: Franchise Operations & Corporate Board

This phase covers corporate management: signing sponsorships, upgrading training/medical/stadium facilities, and hiring coaching staff.

---

## 1. Source Svelte References
* **Finance Hub**: [src/routes/budget/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/budget/+page.svelte)
* **Staff Board**: [src/routes/club/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/club/+page.svelte)

---

## 2. Key Features & Implementation Checklists

### Module 5.1: Sponsorship Contracts
* [ ] **Sponsorship Offer Search**:
  * Allows users to search for corporate sponsorship offers.
  * Offers are generated based on the franchise's current budget and fan base size.
* [ ] **Sponsor Offer Details**:
  * Displays sponsor name, contract type (Bonus, Performance, Hybrid), payout details (e.g., base payout per match, bonus per win, or payouts based on runs/wickets), and duration in matches (e.g., 8-15 matches).
* [ ] **Signing Slots**:
  * Enforces maximum of 2 active contracts (or 1 if the team is low popularity).
  * Automatically handles matchday payouts and matches played counters during Simulated/Played days.
  * Removes expired contracts.

### Module 5.2: Facility Upgrades
* [ ] **Facilities Level Grid**:
  * **Stadium Level**: Upgrades increase matchday gate attendance and fan ticket revenue.
  * **Training Lab Level**: Upgrades reduce the cash cost of training players.
  * **Medical Room Level**: Upgrades reduce the severity and recovery duration of player injuries.
* [ ] **Upgrade Cost Scaling**:
  * Enforces cost levels (e.g., Level 2 costs $50k, Level 3 costs $100k, Level 4 costs $200k, Level 5 costs $500k).
  * Checks remaining budget before allowing upgrades.

### Module 5.3: Staff Board (Coaches & Physios)
* [ ] **Hiring Board Grid**:
  * Lists available candidates for hire:
    * *Head Coach (Epic)*: Costs hiring fee, boosts player training effectiveness.
    * *Physiotherapist (Rare)*: Costs hiring fee, reduces player injury risk/recovery time.
* [ ] **Staff Salaries**:
  * Deducts staff salaries from franchise budget at the end of each season.
* [ ] **Severance & Dismissal**:
  * Allows firing staff members, enforcing a severance payout fee.
