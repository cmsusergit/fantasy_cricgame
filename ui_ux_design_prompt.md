# UI/UX Design Brief: Fantasy CricManager

## 1. Project Overview
**Fantasy CricManager** is a web-based, text/UI-heavy sports management simulation game. Players take on the role of a cricket team manager in a fantasy universe (featuring factions like Humans, Elves, Orcs, etc.). The core gameplay loop involves drafting/auctioning players, managing a squad, setting match tactics (intent), negotiating sponsorships, and simulating a tournament schedule.

## 2. Core Design Objectives & Vibe
*   **Aesthetic:** Modern, sporty, premium, and slightly analytical (data-rich but not overwhelming). It should feel like a high-end sports broadcast app mixed with a sleek management dashboard.
*   **Thematic Elements:** Subtle nods to the fantasy setting (e.g., faction icons/colors) without becoming a cartoonish RPG. The primary focus is the sport/management aspect.
*   **Accessibility:** Clean typography, high contrast, and clear visual hierarchy for data.

## 3. Technical & Implementation Constraints
*   **Responsive Design (CRITICAL):** The design **must** be mobile-first. All layouts need to stack intelligently on small screens (smartphones) and expand gracefully to utilize wider real estate on tablets and desktops (e.g., changing from a single column to 2-column or 3-column grids).
*   **Theming:** Full support for both **Dark Mode** (default, sleek, immersive) and **Light Mode** (clean, high-contrast, paper-like).
*   **Framework Compatibility:** The frontend is built using **SvelteKit** and **Tailwind CSS**. Designs should utilize standard utility-class paradigms (e.g., consistent spacing scales like 4px, 8px, 16px, 24px; standard border-radii; flexbox/grid layouts).

## 4. Global UI/UX Elements
*   **Color Palette:**
    *   *Primary:* A strong brand color (e.g., an energetic sporty blue or vibrant emerald).
    *   *Accents:* Colors for game states (e.g., Green for wins/positive stats, Red for losses/danger, Amber/Gold for auctions/warnings or primary actions).
    *   *Backgrounds (Dark/Light sets):* Base background, secondary background (cards/panels), tertiary background (hover states/inputs).
*   **Typography:** A modern, highly legible sans-serif font family (e.g., Inter, Roboto, or system fonts). Monospaced fonts can be used for numbers, scores, and budgets to align them perfectly.
*   **Global Navigation:**
    *   *Mobile:* A sticky bottom app-bar with icons for core routes (Home, Squad, Match, Auction).
    *   *Desktop:* A clean top navbar or a collapsible left-hand sidebar.
*   **Persistent Header:** Often needs to display the user's current "Purse/Budget" globally, as it dictates many actions.

## 5. Screen-by-Screen Breakdown & Functionality

### A. Dashboard / Home (`/`)
*   **Purpose:** The central hub summarizing the team's status and driving the player to the next action.
*   **Key Elements:**
    *   **Hero/Header:** Team Name, Logo, Coach Name, Season indicator.
    *   **Team Overview:** Quick stats (Win Rate, Total Matches, Total Runs) and active Sponsorship badge.
    *   **Key Metrics (Grid):** Prominent display of Budget, Wins, Losses.
    *   **Actionable Areas:**
        *   *Sponsorship Selection (Conditional):* A section showing 3 sponsor cards (Name, Type, Match Bonus, Performance Bonus) with a "Sign Contract" button.
        *   *Tournament Calendar:* A list of upcoming days. Highlights the current day and the next match. Includes an "Advance Day" or "Start Match" primary CTA button.
    *   **Quick Links:** A horizontal scroll or small grid showing the current squad members (Player Cards) with a link to manage the full squad.

### B. Squad Management (`/squad`)
*   **Purpose:** View all owned players and select the "Playing 11" for the next match.
*   **Key Elements:**
    *   **Roster List/Grid:** Display all players. Needs visual indicators for their status (e.g., in Playing 11, benched, injured, fatigued).
    *   **Selection Mechanism:** A clear way to move players between the "Available Roster" and the "Playing 11" (e.g., drag-and-drop on desktop, tap-to-select/swap on mobile).
    *   **Role Assignments:** Designate exactly 1 Captain and 1 Wicket Keeper from the Playing 11.
    *   **Player Cards:** Needs a compact view for lists and a detailed modal/expanded view showing full stats (Batting, Bowling, Power, Tech, Fielding, Form, Morale, Fatigue) and career history.

### C. Live Match Simulation (`/match`)
*   **Purpose:** The core gameplay screen where users watch the match unfold ball-by-ball.
*   **Key Elements:**
    *   **Scoreboard (Sticky):** Top of the screen. Shows Team 1 vs Team 2 scores (e.g., 154/4 vs 120/2), current over (e.g., 14.2/20), and required run rate.
    *   **Tactics Panel (Match Controls):**
        *   *Intent Selectors:* Dropdowns or segmented controls to set Batting Intent (Defensive, Normal, Aggressive, Slog) and Bowling Intent.
        *   *Simulation Speed:* Buttons to play "Next Ball", "Next Over", or "Auto-Simulate".
    *   **Current Action Area:** Shows the current bowler and the two current batters with their individual scores.
    *   **Ball-by-Ball Feed:** A scrollable log of events (e.g., "14.2: Bowler to Batter, FOUR runs!"). Needs color-coding for events (boundaries in green/blue, wickets in red).

### D. Live Auction (`/auction`)
*   **Purpose:** A real-time bidding war against AI teams to buy players.
*   **Key Elements:**
    *   **Current Purse:** Prominently displayed.
    *   **Player on the Block:** A large, detailed Player Card taking center stage.
    *   **Bidding Area:**
        *   Current Bid Amount (huge text).
        *   Current Highest Bidder.
        *   Visual countdown timer (progress bar or circular timer).
        *   Primary "BID $X" button (needs to be easily tappable on mobile).
    *   **Activity Log:** A scrolling list of who bid what, or if a player was sold/unsold.

### E. Scouting / Youth Academy (`/scouting`)
*   **Purpose:** Inter-season phase to discover new talent.
*   **Key Elements:**
    *   List of "Unknown" youth players (stats obscured).
    *   A "Send Scout" button attached to each player, displaying the cost to reveal their stats.
    *   Once scouted, the card flips or expands to reveal the true stats before they enter the auction.

### F. Retention Board (`/retention`)
*   **Purpose:** Pre-auction phase to select which current players to keep for the next season.
*   **Key Elements:**
    *   List of current squad players with their market value.
    *   Selection toggles (checkboxes) to mark players for retention.
    *   A dynamic counter showing how much of the budget will be spent on retentions and how many slots are left (e.g., "Retained: 3/5, Cost: $45,000").

## 6. Specific Component Details for Consistency
*   **Player Cards:** These are the most common element. Design a standard system for them.
    *   *Compact:* Name, Role (Batter/Bowler), Faction icon, overall rating or price.
    *   *Detailed:* Adds stat progress bars (0-100 scale) for specific skills, form trends, and fatigue warnings.
*   **Stat Bars:** Use consistent visual progress bars for stats (Batting, Bowling) with color coding (e.g., 0-30 Red, 31-70 Yellow, 71-100 Green).
*   **Modals/Drawers:** Use bottom sheets on mobile and centered modals on desktop for detailed views (like clicking a player card to see full stats).