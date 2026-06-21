# UI/UX Redesign Prompt: Fantasy CricManager

This document is a comprehensive design brief and prompt that you can copy and paste into Figma AI tools (e.g., Figma AI, Musho, Builder.io), AI text models (ChatGPT, Claude), or provide directly to a UI/UX designer. It describes the design system, responsive transition rules, reusable components, and a screen-by-screen layout for **Fantasy CricManager** (a SvelteKit + Tailwind CSS T20 cricket simulation game).

---

## 🎨 Global Design System & Aesthetics

### 1. The Vibe & Theme
*   **Vibe:** Sleek, premium sports-analytics app (e.g., ESPN Cricinfo meets Football Manager) combined with subtle fantasy game elements (Elves, Orcs, Dwarves, Humans). 
*   **Theming:** Full support for both:
    *   **Dark Mode (Default):** Immersive, high-contrast. Deep space/slate backgrounds (`#0F172A` or `#0B0F19`), translucent card overlays with subtle borders, and neon/glowing accents.
    *   **Light Mode:** Clean, paper-like. Crisp light gray backgrounds (`#F8FAFC`), structured panels (`#FFFFFF`), and refined typography.
*   **Typography:** Clean, highly legible sans-serif for UI (e.g., `Inter` or `Outfit`). Use a monospaced font family (e.g., `JetBrains Mono` or `Roboto Mono`) for numeric values like scores, budgets, run rates, and clocks to prevent horizontal shifting.

### 2. Palette & Visual Indicators
*   **Primary Brand:** Energetic sporty teal/blue (`#06B6D4` or `#3B82F6`) for links, selected states, and brand marks.
*   **Positive Alerts/Stats:** Emerald green (`#10B981` / `#00FF87`) for wins, high form, green stats, and run boundaries.
*   **Auctions & CTA Actions:** Vibrant Amber/Gold (`#F59E0B` / `#FBBF24`) for money, player prices, bids, and primary CTA buttons.
*   **Danger / Alerts:** Crimson red (`#EF4444`) for wickets, losses, injuries, and destructive actions.

---

## 📱 Responsive & Layout Rules (Mobile-First)

Your design must scale seamlessly across two primary viewports:
1.  **Mobile Viewport (390px - width):**
    *   Sticky top header with global stats: Day number, Season, Game Phase, and current Budget.
    *   Single-column vertically stacked scrollable container.
    *   Sticky bottom tab-bar navigation with standard touch targets (min 48px) and icons + text labels for core actions: `Dashboard`, `Match`, `Squad`, `Auction`.
2.  **Desktop Viewport (1440px+ - width):**
    *   Sticky left-hand collapsible sidebar or clean top navigation bar.
    *   Multi-column grid layouts (2-column or 3-column splits) to reduce vertical scrolling.
    *   Bigger interactive areas with hover animations (scale up, subtle glows, tooltips).

---

## 🧩 Reusable Components & Patterns

### 1. Player Card Component
Designed to fit in lists, grids, and team sheets.
*   **Compact Mode (Mobile List / Match Sheet):**
    *   Avatar slot (prefixed with faction emoji/icon: e.g., 🧝 for Elf, 👹 for Orc, 🧔 for Dwarf).
    *   Player name, primary role badge (e.g., `WK`, `BAT`, `BOWL`, `ALL`).
    *   Overall Rating (`OVR`: 0-100) inside a colored circular badge.
    *   Compact indicators: Form (e.g., 📈/📉 or tiny colored bar), Status (e.g., 🩹 Injured, 🔋 Fatigue %).
*   **Detailed Mode (Modal / Bottom Sheet):**
    *   Full player portrait area.
    *   Stat Progress Bars (0-100 scales) for: Batting Power, Batting Technique, Bowling Speed, Bowling Spin, Fielding, Form, Morale, Fatigue.
    *   Historical career stats table (Matches, Runs, Wickets, Average, Strike Rate).

### 2. Match Control & Live Scoreboard
*   **Sticky Scoreboard Header:**
    *   Live runs/wickets display (e.g., **154/4** in large bold text, overs **14.2 / 20** in smaller monospaced text).
    *   Team name text labels, team badge colors, and required run rate (RR / RRR) banner.
*   **Tactics Selector Panel:**
    *   Segmented controls or toggle buttons to instantly select:
        *   *Batting Intent:* Defensive 🛡️ | Balanced ⚖️ | Aggressive ⚡ | Slog 🔥
        *   *Bowling Intent:* Defensive 🛡️ | Balanced ⚖️ | Aggressive ⚡
*   **Simulation Control Dials:**
    *   Clean layout for Speed buttons: `Ball-by-Ball` | `Over-by-Over` | `Instant Sim`.
    *   Play/Pause button with transition states (pulse effect when paused).

---

## 🖥️ Screen-by-Screen Redesign Details

### Screen A: Dashboard & Schedule (`/`)
*   **Mobile Layout:**
    *   Hero section at the top showcasing Team Logo, Team Name, and manager name.
    *   **Next Fixture Card:** Bold card showing the upcoming opponent, weather icon, pitch type, and a primary CTA "Play Match" (only active on user's match day).
    *   **Tournament Calendar:** Horizontal scrolling slider for Day 1 to Day 45. Days show match fixtures. Current day is highlighted with a gold border.
    *   **Sponsorship Panel (Conditional):** If unsigned, shows 3 interactive cards with Sponsor details (Base fee, Win bonus, signing CTAs).
*   **Desktop Layout:**
    *   Left side column (33% width): Team overview stats (wins/losses ratio, fan popularity chart) and signed sponsor badge.
    *   Middle column (45% width): Main Dashboard containing the prominent Next Fixture Card and the full tournament fixture calendar list.
    *   Right side column (22% width): Live League Standings table (Teams, Points, Net Run Rate).

### Screen B: Squad Management & Lineups (`/squad`)
*   **Mobile Layout:**
    *   Tab switcher at the top: `Playing 11` (Active roster) vs `Reserve Bench`.
    *   Tap-to-swap interface to move players between Active and Bench.
    *   Quick dropdowns to designate the Captain (👑) and Wicketkeeper (🧤).
    *   Tapping a player card opens a sleek bottom drawer showing their full skills and stats.
*   **Desktop Layout:**
    *   Left panel: Interactive cricket field mockup visualizing player positions.
    *   Right panel: Two-column split containing the 11 active players list and the reserves.
    *   Supports drag-and-drop handles for quick rearranging.

### Screen C: Live Match Simulator (`/match`)
*   **Desktop Layout Status:** **Implemented** as a two-column grid. We are specifically designing the **Mobile Portrait Layout (390px viewport)** to fit all active gameplay elements on a single screen without vertical scrollbars.

*   **Mobile Layout Requirements:**
    *   **Single-Screen Viewport Fit (No Scrolling):** The entire gameplay flow (scoreboard, active batsman/bowler cards, controls, and active ball feed) must fit inside a single screen height. Use condensed margins and auto-layout spacing to prevent vertical scrolling.
    *   **Thin Sticky Scoreboard (Top):** A compact row ribbon showing T20 scores (e.g. `154/4`), overs (`14.2 / 20`), current run rate (CRR), and target run rate equation (e.g., `Need 45 runs from 34 balls`).
    *   **Active Batsmen & Bowler Stack (Middle-Top):**
        *   *Batsmen Duo:* Display both active batsmen side-by-side in thin, horizontal cards. The batsman currently on strike should have a prominent visual border highlight (e.g. neon gold outline) and a batting icon (`🏏`). Include small progress bars for Stamina and Confidence (morale).
        *   *Active Bowler Card:* Stacks directly under the batsmen in a similar thin row, showing their current spell stats (e.g. `2-18 (2.1 overs)`).
    *   **Tactics Panel (Segmented Pills):** 
        *   Replace vertical/horizontal slider tracks with compact, touch-friendly segmented controls (pill buttons).
        *   *Batting Intent Selectors:* `Defensive` | `Balanced` | `Aggressive` | `Slog`
        *   *Bowling Intent Selectors:* `Defensive` | `Balanced` | `Aggressive`
    *   **Integrated Live Commentary Console (Middle-Bottom):**
        *   A fixed-height box (about 25-30% of screen height) containing a scrolling list of the latest ball outcomes.
        *   Must show the last 3-4 balls. Ensure color-coding for events: boundaries in soft green/teal, wickets in soft red with a warning icon, normal runs in white.
    *   **Simulation Control Dock (Bottom):** 
        *   Sticky control hub at the very bottom of the screen.
        *   Left: Prominent Play/Pause (`▶` / `⏸`) toggle button.
        *   Center: Simulation Speed switches (`1x` | `Over` | `Max`).
        *   Right: Instant Simulation actions (`+1 Ball` | `Over` | `Wicket` | `Innings`).
    *   **Overlay Bottom Sheets (Selectors):**
        *   When choosing openers, selecting a new batsman/bowler, or during the coin toss, these UIs should slide up from the bottom as a **bottom sheet (drawer modal)**, overlaying the match screen instead of loading inline and pushing layouts down.

### Screen D: Auction House (`/auction`)
*   **Mobile Layout:**
    *   Center stage: The player card currently bidding on.
    *   Top right: Current Purse/Budget gauge.
    *   Middle: Current Bid Amount and Highest Bidder badge.
    *   Bottom: Interactive radial countdown timer (e.g. 15 seconds) ticking down.
    *   Large, easily clickable "BID +$5,000" primary CTA button.
*   **Desktop Layout:**
    *   Grid view: Left side displays the full player profile and rating details.
    *   Center displays the auction arena with live bidding activity logs scrolling in real time (e.g. "Elven Warriors bid $45,000").
    *   Right side displays a list of upcoming players in the draft pool and current squads of other franchises.

### Screen E: Club & Training Lab (`/training` & `/club`)
*   **Mobile Layout:**
    *   Top: Available Training Points.
    *   List of players with upgradable attributes. Clicking "Upgrade" expands inline slider controls.
*   **Desktop Layout:**
    *   Sleek grid of player cards with radial charts indicating stat potentials.
    *   Interactive upgrading screen where coaches/trainers can be assigned to players.

---

## 📤 Deliverables Expected from Figma
*   **Responsive layouts:** Mobile (390px width) and Desktop (1440px width) frames side-by-side for each core screen.
*   **Component Set:** Unified design components for:
    *   Player Cards (Compact & Detailed)
    *   Navbars (Mobile bottom sheet, Desktop sidebar)
    *   Buttons & Form inputs (aligned with Tailwind CSS default spacing & roundness)
    *   Scoreboard, Toss overlays, and Commentary logs.
*   **Asset exports:** Custom SVGs for weather, pitch conditions, and faction-themed logos.
