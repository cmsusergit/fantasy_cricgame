# Feature Development Plan

## 1. Player Name Customization

### Objective
Allow the user to edit the names of players currently in their squad. This enhances immersion and personalization of the user's team.

### Implementation Details
*   **Location:**
    *   **Squad Management Screen (`src/routes/squad/`):** Add an "edit" icon (pencil) next to player names for players belonging to the user's team.
    *   **Detailed Player Profile Modal/Screen:** Include an edit button next to the player's name at the top of their profile.
*   **UI/UX:**
    *   Clicking the edit icon turns the name display into a text input field or opens a small modal.
    *   Provide "Save" and "Cancel" buttons.
    *   Add validation (e.g., maximum length 30 characters, no special characters depending on lore).
*   **Data Model Updates:**
    *   Update the `Player` interface/model (likely in `src/lib/models/` or `src/lib/core/`) to ensure it can handle a `customName` property, or simply overwrite the `name` property. Overwriting `name` might be easier, but storing `originalName` alongside `name` could be useful for reset functionalities.
    *   Update the team/squad store (`src/lib/stores/`) to persist these changes locally.
*   **Constraints:**
    *   Only allow renaming for players that are currently contracted to the user's club.

---

## 2. Match Play: In-Game Concentration & Momentum Mechanics

### Objective
Introduce a dynamic "form" system during live match simulations to reward sustained good performance and create realistic match flows (e.g., a "set" batsman becoming harder to dismiss, a bowler finding their "rhythm").

### Mechanic 1: Batsman Concentration (The "Set" Batsman)
*   **Concept:** The longer a batsman stays at the crease and faces deliveries, the better they "see the ball," temporarily boosting their batting skills.
*   **Triggers for Increase:**
    *   Facing deliveries (+ small amount per ball).
    *   Scoring boundaries (+ moderate amount).
    *   Rotating strike efficiently.
*   **Triggers for Decrease (Decay):**
    *   Facing multiple consecutive dot balls (frustration/pressure).
    *   New batsman arriving at the crease (starts at 0).
*   **Impact:**
    *   Introduces a `concentrationMultiplier` (e.g., 1.0 to 1.15).
    *   During the delivery outcome calculation (`MatchEngine`), multiply the batsman's core skills (Batting, Power, Technique) by this multiplier.
    *   This slightly increases the probability of scoring runs and decreases the probability of getting out.
*   **Visual UI Indicator:**
    *   **Concentration Meter:** Implement a visual slider/progress bar next to the batsman's name on the live match screen. 
    *   **Color Transition:** The bar starts empty or at a low level (colored **orange** to represent low focus or 'new to the crease'). As the batsman's concentration builds, the bar fills up and gradually transitions into a solid **green** color, clearly indicating to the user that the player is fully "set" and receiving maximum stat boosts.

### Mechanic 2: Bowler Rhythm/Momentum (The "Hot Streak")
*   **Concept:** A bowler who is hitting their areas and taking wickets gains confidence, temporarily boosting their bowling effectiveness.
*   **Triggers for Increase:**
    *   Bowling dot balls (+ small amount).
    *   Taking a wicket (+ large amount).
    *   Bowling a maiden over (+ moderate amount).
*   **Triggers for Decrease (Decay):**
    *   Being hit for boundaries (especially 6s) (- moderate amount).
    *   Bowling extras (Wides/No Balls) (- small amount).
    *   Starting a new spell (resets or reduces to a base level).
*   **Impact:**
    *   Introduces a `rhythmMultiplier` (e.g., 1.0 to 1.15).
    *   During the delivery outcome calculation, multiply the bowler's core skills (Bowling, Pace/Spin, Accuracy) by this multiplier.
    *   This increases the probability of inducing a mistake (wicket) or keeping the run rate down (dot balls).

### Implementation Architecture
1.  **Match State Update:** In `src/lib/core/MatchEngine.ts` (or similar), modify the temporary player match state objects (e.g., `BatsmanMatchStats`, `BowlerMatchStats`) to include these new dynamic values (`currentConcentration`, `currentRhythm`).
2.  **Simulation Loop Adjustment:** Inside the ball-by-ball simulation loop, update these values based on the *previous* ball's outcome *before* calculating the *current* ball's outcome.

---

## 3. Match Play: Auto-Play Target Conditions

### Objective
Give the user more tactical control during fast simulation speeds. Instead of a simple infinite "Auto Play" button, provide targeted simulation options that automatically run the game until a specific milestone is reached. This allows the manager to fast-forward to critical moments without missing them.

### Implementation Details
*   **UI Additions (`MatchControls.svelte`):**
    *   Replace or supplement the generic "Auto Play" button with a primary "Simulate Until..." button or a set of targeted fast-forward options.
    *   **Target Options:**
        *   **End of Innings:** Runs the rest of the current innings.
        *   **Next Over:** Runs exactly 6 legal deliveries (or finishes the current incomplete over).
        *   **Specific Over [ X ]:** A dropdown to pick a specific over to simulate up to (e.g., skip to the 15th over).
        *   **Next Wicket:** Runs the simulation until any wicket falls.
*   **Logic (`match/+page.svelte`):**
    *   Modify the auto-play loop (`playAutoBall`). Instead of running infinitely until manually paused, it should accept a "target condition".
    *   **State Tracking:** Introduce a state variable like `simulationTarget: { type: 'innings' | 'over' | 'specific_over' | 'wicket', value?: number } | null`.
    *   Inside the loop, immediately after resolving a ball and updating the innings state:
        *   Evaluate if the `simulationTarget` has been met.
        *   *Examples:* If type is `specific_over`, check `currentInningsData.overs === target.value`. If type is `wicket`, check if `ballEvent.isWicket` was true.
        *   If the condition is met, execute the `togglePause()` function (or directly set the phase to `paused`), clearing the target and halting the recursive `setTimeout` loop (`playAutoBall`), so the user regains control.

---

## 4. Persistent Storage (Database Integration)

### Objective
Migrate from local, in-memory state or `localStorage` to a lightweight, online database to allow for persistent storage of user progress, team data, customized player names, and match history across sessions and devices.

### Recommended Solution: Supabase
*   **Why Supabase?** It is a highly popular, open-source Firebase alternative based on PostgreSQL. It offers a generous free tier that is perfect for starting out, provides automatic REST and GraphQL APIs, and handles authentication (if user accounts are added later). It integrates exceptionally well with SvelteKit.
*   **Data to Persist:**
    *   **User/Manager Profile:** Current budget, current season, club name, overall reputation.
    *   **Team Roster:** The IDs of players currently owned by the user.
    *   **Player Data Overrides:** Specifically, the `customName` applied to a player by the user, linked to the user's unique ID and the base player's ID.
    *   **Match History/Standings:** Results of simulated matches to maintain league progression.

### Implementation Steps
1.  **Project Setup:** Create a free Supabase project online.
2.  **Schema Design:** Design simple tables (`profiles`, `user_squads`, `custom_players`, `match_history`).
3.  **Integration:** Install the `@supabase/supabase-js` client in the SvelteKit project.
4.  **Data Fetching/Saving:** Update the existing Svelte stores (e.g., in `src/lib/stores/`) to act as a cache. When a player's name is edited or a match concludes, trigger an API call to save the state to Supabase, then update the local store to reflect the change immediately.

---

## 5. In-Progress Match State Persistence

### Objective
Ensure that if a user accidentally refreshes the page, navigates away, or closes their browser during a live match simulation, the current state of the match is saved. Upon returning to the `/match` page, the game should resume exactly from where they left off instead of restarting the toss or the innings.

### Implementation Details
*   **State Extraction:**
    *   We need to serialize the complete state of the active match. This includes:
        *   `phase` (e.g., 'playing', 'selectNextBatsman', 'toss')
        *   `innings1` and `innings2` objects (containing all ball-by-ball history, scores, wickets, current batsmen, and concentration/rhythm stats).
        *   `currentInnings` (1 or 2)
        *   `weather` and `pitch` conditions.
        *   `currentMatch` metadata (teams involved, day).
*   **Storage Mechanism:**
    *   **Short-Term (Local):** Utilize SvelteKit's stores backed by `localStorage` or `sessionStorage`. Create a new store (e.g., `activeMatchStore`) that subscribes to changes in the `/match` page state and automatically stringifies and saves the data to the browser's storage on every ball bowled or phase change.
    *   **Long-Term (Supabase):** Once Supabase is integrated, we can add a `current_match_state` JSON column to the user's profile table. We would sync to the database periodically (e.g., end of every over, or debounced every 5 seconds) to prevent excessive API calls, ensuring the user can resume on a completely different device.
*   **Restoration Logic:**
    *   On `onMount` within `src/routes/match/+page.svelte`, before initializing a *new* match from the schedule, first check if there is an active match state saved in storage.
    *   If a saved state exists and matches the `userNextMatch` ID from the schedule, deserialize the JSON data and overwrite all local state variables (`innings1`, `phase`, `currentBowlerIndex`, etc.).
    *   If no saved state exists, proceed with the standard initialization (toss, team selection, etc.).
*   **Cleanup:**
    *   Crucially, when a match naturally reaches the `complete` phase and the user clicks "Continue to Dashboard", the `activeMatchStore` must be explicitly cleared/deleted from storage so the next match starts fresh.