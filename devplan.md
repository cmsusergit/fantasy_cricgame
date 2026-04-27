# Development Plan: Season Transition & Auction Mechanics

This document outlines the planned features for implementing a complete season lifecycle in Fantasy Cricket Grand Manager, drawing inspiration from real-world IPL mechanics.

## 1. End of Season Transition & Performance Tracking
*   **Season Review Dashboard:** Upon concluding a tournament, present a comprehensive review.
    *   **Financial Performance:** Track total budget spent vs. remaining, revenue from sponsors/fans, prize money earned based on final standings.
    *   **Player Performance:** Aggregate stats for the season (Total Runs, Wickets, Average, Strike Rate, Economy). Highlight MVP, top run-scorer, top wicket-taker.
    *   **Player Form & Market Value:** Dynamically adjust player base prices and market values based on their performance during the season. A breakout youth player's value skyrockets; an aging star's value might dip.
*   **Aging & Retirement:** Players age by 1 year. Players over a certain age have a chance to retire, removing them from the global pool.

## 2. Retention Mechanism
*   **Pre-Auction Phase:** Before the draft/auction opens, teams must finalize their retained players.
*   **Rules:**
    *   **Mega Auction (Every 3 Seasons):** Teams can retain a maximum of 4-6 players. Retention comes at a fixed, high cost deducted from the team's total budget purse (e.g., 1st retention costs 1,500 Gold, 2nd costs 1,200 Gold, etc.).
    *   **Mini Auction (Annual):** Teams can retain as many players as they want, provided they stay within the squad size limit (e.g., max 25) and salary cap.
*   **UI:** A dedicated "Retention Board" where the user selects players to keep. The UI dynamically shows the impact on the upcoming auction purse. Released players return to the global auction pool.

## 3. Trade Window
*   **Timing:** Opens immediately after the season review and closes before the retention deadline.
*   **Mechanics:**
    *   **Player-for-Cash:** Buy a player from an AI team using your budget, or sell a bench player to an AI team.
    *   **Player Swaps:** Trade one player for another, with budget adjustments made if their market values differ.
*   **AI Logic:** AI teams will evaluate trades based on their roster needs (e.g., if an AI team lacks spinners, they will value a spin bowler higher).

## 4. Scouting & Youth Academy
*   **Continuous Scouting:** Users can allocate a portion of their budget to a "Scouting Department".
*   **Youth Academy:** Introduce newly generated, young (18-20 yrs), uncapped players into the global pool every season.
*   **Mechanics:**
    *   Higher investment in scouting reveals "hidden potential" stats for youth players before the auction. 
    *   Un-scouted players will have masked or highly variable projected stats, making them risky buys.
*   **UI:** A "Scouting Network" tab showing newly discovered talent, allowing users to tag them for their auction shortlist.

## 5. The Auction Event (Replacing current Draft)
*   **Format:** English ascending bid system (like IPL).
*   **Phases:** Players are presented in sets based on roles (Marquee Batters, Fast Bowlers, Spinners, Uncapped Youth, etc.).
*   **Mechanics:**
    *   **Base Price:** Set dynamically based on the player's history and overall rating.
    *   **Bidding War:** The user competes against AI teams in real-time. Bids increase incrementally. 
    *   **AI Bidding Logic:** AI teams bid based on their remaining purse, current roster needs, and the player's perceived value.
    *   **Right to Match (RTM):** During a Mega Auction, allow teams to use 1 or 2 RTM cards to buy back a released player by matching the highest winning bid from another team.
*   **UI/UX:** A high-tension, fast-paced auction screen showing the current player, base price, current bid, active bidder, and a countdown timer. 

## Implementation Roadmap (Phases)
1.  **Phase 1 (Data & UI):** Build the Season Review dashboard. Implement dynamic player market value updates and aging/retirement logic.
2.  **Phase 2 (Roster Management):** Implement the Retention UI and logic, differentiating between Mega and Mini auctions. Ensure released players populate a staging pool.
3.  **Phase 3 (Scouting):** Create the Scouting tab and the generator for new Youth Academy players.
4.  **Phase 4 (The Auction):** Build the real-time bidding engine and AI logic. Replace the simple static draft with this dynamic event.
5.  **Phase 5 (Trading):** Add the Trade Window for inter-team negotiations.