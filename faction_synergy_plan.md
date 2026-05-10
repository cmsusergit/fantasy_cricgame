# Faction Synergy and Rebalancing Plan

This document outlines the current and proposed faction synergies within the game, aiming to enhance strategic depth for mixed-faction teams. It also covers the rebalancing of intent multipliers and UI implications.

## 1. Intent Multiplier Rebalancing (Implemented)

The `INTENT_MULTIPLIERS` in `src/lib/models/match.ts` have been rebalanced to make aggressive and defensive tactical choices less extreme, encouraging more nuanced gameplay:

*   **`very_defensive`**: From 0.1x to **0.3x** (Wicket Chance Multiplier)
*   **`defensive`**: From 0.2x to **0.6x** (Wicket Chance Multiplier)
*   **`aggressive`**: From 3.5x to **1.8x** (Wicket Chance Multiplier)
*   **`very_aggressive`**: From 5.5x to **3.0x** (Wicket Chance Multiplier)

## 2. Implemented Faction Synergies

These synergies are already integrated into `src/lib/core/matchEngine.ts` and reflected in `src/lib/components/match/MatchControls.svelte` helper text:

*   **🧝 Elves (Masterful Defense)**
    *   **Effect:** When batting with `defensive` or `very_defensive` intent, Elves receive an additional `0.6x` multiplier to their wicket chance, making them exceptionally hard to dismiss when playing carefully.
    *   **UI Hint:** "Minimum Risk, Heavy Wicket Protection. Elves excel here."

*   **🪓 Orcs (Brutal Aggression - Batting)**
    *   **Effect:** When batting with `aggressive` or `very_aggressive` intent, an Orc's boundary-hitting bonus (`battingIntentBonus`) is multiplied by an additional `1.5x`.
    *   **UI Hint:** "High Risk, Boundary Focus. Orcs excel here." (Batting)

*   **🪓 Orcs (Intimidation - Bowling)**
    *   **Effect:** When bowling with `aggressive` or `very_aggressive` intent, an Orc's `bowlingEffort` multiplier increases by `1.25x`. As a trade-off for this wild aggression, their chance of bowling a `Wide` is doubled.
    *   **UI Hint:** "Attacking Field. Orcs excel here (more wides)." (Bowling)

## 3. Proposed Faction Synergies (For Future Implementation)

These synergies are designed for a mixed-faction team strategy, where each faction offers unique advantages for specific roles or match situations.

*   **Humans (The Adaptable All-Rounders)**
    *   **Batting Synergy (Tactical Discipline):** When batting with a `balanced` intent, Humans receive a "Stability Bonus" (slight increase in base shot quality, slight decrease in wicket chance). Ideal for anchors.
    *   **Bowling Synergy (New Ball Discipline):** When bowling with a `balanced` or `defensive` intent in the first 6 overs (Powerplay), Humans drastically reduce the opponent's boundary chance. Ideal for economical powerplay bowling.

*   **Dwarves (The Unbreakable Engines)**
    *   **Batting Synergy (Deep Reserves):** When batting in the last 4 overs (Death Overs) with `aggressive` or `very_aggressive` intent, Dwarves ignore all negative penalties from Fatigue. Perfect for late-game hitting.
    *   **Bowling Synergy (Relentless Stamina):** Dwarves ignore extra fatigue penalties incurred from bowling with `aggressive` or `very_aggressive` intent, allowing them to sustain high-intensity spells.

*   **Goblins (The Unpredictable Tricksters)**
    *   **Batting Synergy (Cheeky Thieves):** When batting with a `defensive` intent, Goblins get a unique modifier that practically guarantees a "Single" on any non-wicket ball. Excellent for rotating strike and frustrating bowlers.
    *   **Bowling Synergy (Chaotic Turn):** If a Goblin bowls spin (e.g., `off_spin`, `leg_spin`) with an `aggressive` intent, they get a massive spike to wicket-taking probability. However, this high-risk strategy doubles their chance of bowling a No-Ball (overstepping in their eagerness).

*   **Night Elves (The Shadow Assassins)**
    *   **Batting Synergy (Surgical Precision):** When batting with an `aggressive` intent, a Night Elf's boundary-hitting probability scales directly with their `Technique` stat rather than `Power`. This enables fast scoring with lower inherent risk for technically proficient players.
    *   **Bowling Synergy (Shadow of Death):** During the "Death Overs" (Overs 16-20), a Night Elf bowler's `Bowling` stat receives a flat `1.15x` multiplier, making them exceptional at restricting runs and taking wickets in high-pressure situations.

## 4. UI Implications for Proposed Synergies

For future implemented synergies, the `MatchControls.svelte` component (or similar in-match UI) should:

*   **Dynamic Tooltips/Text:** Update helper text based on the current batter/bowler's faction and selected intent.
*   **"Synergy Active" Indicators:** Visually highlight when a player's factional synergy is active due to the chosen intent and match context (e.g., glowing icon, special border).
*   **Pre-Match/Auction Hints:** Provide information on player cards in the Auction/Draft room about a player's primary synergy role.
