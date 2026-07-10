# Phase 1: Game Launch, Setup, & Roster Navigation

This phase covers the game setup, faction selection, lore viewing, and squad management views.

---

## 1. Source Svelte References
* **Main Menu Setup**: [src/routes/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/+page.svelte)
* **Squad Roster**: [src/routes/squad/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/squad/+page.svelte)
* **Guide & Lore**: [src/routes/guide/+page.svelte](file:///home/user1/game/fantasy_cricmanager/src/routes/guide/+page.svelte)

---

## 2. Key Features & Implementation Checklists

### Module 1.1: Main Menu & Team Selection
* [ ] **New Game Configuration Form**:
  * Input field for Manager Name.
  * Input field for Custom Team Name (with random name generator helper `generateTeamName()`).
  * Faction grid selector (choices: **Human**, **Elf**, **Dwarf**, **Orc**, **Goblin**). Displays faction logo, color swatches, and description cards.
  * Start toggle options: "Start with Default Squad" vs. "Enter Player Auction".
  * Budget slider or initial budget setting (defaults to $1,000,000).
* [ ] **Save Progress Restore Launcher**:
  * Displays "Resume Game" button only if a career save exists in `AsyncStorage`. Shows manager name, day, season, and current budget.

### Module 1.2: Roster Sheet & Starters Selector
* [ ] **Roster Grid & List**:
  * Shows list of all players currently contracted by the franchise.
  * Displays role badge (Bat, Bowl, AR, WK), age, fitness, fatigue, and morale.
  * Shows detailed stat bars (Batting, Bowling, Power, Technique, Fielding) when a player card is clicked.
* [ ] **Starting XI Lineup Management**:
  * Allows checking/unchecking players to add them to the Starting XI.
  * Enforces validations:
    * Must select exactly 11 players.
    * Must select exactly 1 Captain (`captain` ID).
    * Must select exactly 1 Wicketkeeper (`wicketKeeper` ID).
    * Restricts choosing more than 11 players.
  * Reorder batting lineup order on the screen.

### Module 1.3: Game Guide & Lore Viewer
* [ ] **Faction Characteristics Reference**:
  * Displays faction synergies:
    * *Dwarves*: High bowling defense/stamina, low run scoring speed.
    * *Elves*: Elegant batting technique, low physical stamina.
    * *Orcs*: Heavy power hitting, high fatigue accumulation.
    * *Goblins*: Aggressive run-stealing, low fielding defense.
    * *Humans*: Balanced attributes.
* [ ] **Rules Sheet**:
  * Explains tournament structures (14 match league matches + top 4 playoffs).
  * Explains match simulation weather and pitch modifiers.
