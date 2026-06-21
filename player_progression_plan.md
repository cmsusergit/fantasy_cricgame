# Player XP and Progression System Plan

## 1. Overview
The goal of this system is to introduce RPG-like progression for players. As players participate in matches and perform well (scoring runs, taking wickets, making catches), they will earn **Experience Points (XP)**. 

Managers can then spend a combination of **Player XP** and **Team Credits (Budget)** to permanently improve the player's core stats (Batting, Bowling, Power, Technique, Fielding).

## 2. Data Model Updates
**File:** `src/lib/models/player.ts`
*   Add `xp: number` to the `Player` interface to track current spendable XP.
*   *(Optional)* Add `lifetimeXp: number` to track total XP earned over a career.

**File:** `src/lib/core/draftAI.ts`
*   Initialize `xp: 0` for all newly generated players.

## 3. XP Earning Mechanics
XP will be calculated and awarded at the end of each match in the `finishMatch` routine (or via a dedicated `awardMatchXP` function in the match engine).

**Proposed XP Reward Rates:**
*   **Participation:** +10 XP (just for being in the Playing 11)
*   **Batting:**
    *   +1 XP per run scored
    *   +50 XP bonus for a Half-Century (50+ runs)
    *   +100 XP bonus for a Century (100+ runs)
*   **Bowling:**
    *   +15 XP per wicket taken
    *   +50 XP bonus for a 3-wicket haul
    *   +100 XP bonus for a 5-wicket haul
*   **Fielding:**
    *   +10 XP per catch/stumping
    *   +15 XP for a run-out
*   **Match Awards:**
    *   +100 XP for being named Player of the Match

## 4. Stat Upgrade Mechanics (Training Cost)
Upgrading a stat requires both the player's personal XP and the team's financial budget. To prevent players from easily reaching 100 in all stats, the cost should scale exponentially based on the *current* level of the stat being upgraded.

**Proposed Scaling Costs (Per +1 Stat Point):**
*   **Stat Level 1 - 50:** 100 XP + $5,000
*   **Stat Level 51 - 75:** 250 XP + $15,000
*   **Stat Level 76 - 90:** 500 XP + $50,000
*   **Stat Level 91 - 100:** 1000 XP + $150,000

*Constraints:* 
*   A stat cannot exceed 100.
*   Role-specific limits could be applied (e.g., pure bowlers cost double to upgrade batting).

## 5. UI/UX Updates
1.  **Post-Match Summary (`match/+page.svelte`):**
    *   Add an "XP Earned" column to the post-match player performance summary.
2.  **Player Modal (`PlayerModal.svelte`):**
    *   Display the player's current XP prominently.
    *   Add an "Upgrade / Train" section.
    *   For each stat (Batting, Bowling, Power, Technique, Fielding), display a `[+]` button.
    *   Hovering over or clicking the `[+]` button should show the required XP and Credit cost for the next level.
3.  **Squad/Dashboard Views:**
    *   Add a visual indicator (like a small green up-arrow or glowing star) next to players who currently have enough XP to afford at least one upgrade.

## 6. Implementation Steps
When ready to implement, follow this sequence:
1.  **Step 1: State & Models.** Update `Player` interface and `generatePlayerPool` to include `xp`.
2.  **Step 2: Match Engine.** Update `resolveMatch` / `finishMatch` logic to calculate XP based on the `playerStatsUpdates` object and assign it to the players.
3.  **Step 3: Stores.** Create an `upgradePlayerStat(playerId, statName, xpCost, creditCost)` action in `gameState.ts` that deducts XP from the player, deducts money from the team, and increments the stat.
4.  **Step 4: UI.** Build out the UI in `PlayerModal.svelte` to display current XP and wire up the upgrade buttons to the new store action.