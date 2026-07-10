# Phase 1: Setup & Initial Architecture Plan - Mobile Version

## 1. Project Overview & Objectives
The goal of this project is to develop a fully functional, premium cross-platform mobile game based on the **Fantasy Cricket Grand Manager** codebase, using **React Native Expo Go**. 

We will port the core mechanics (match engine, tournament schedule, AI team personalities, injury/sponsorship systems, player progression) to a mobile interface. We must focus heavily on:
1. **Premium UI/UX**: Elegant typography, high-contrast visual design, dark/light theme options, tactile touch controls, and fluid layouts optimized for mobile screens.
2. **Simulation Fidelity**: Ball-by-ball, over-by-over, and instant simulation controls with interactive intent tuning (batting/bowling), tosses, weather/pitch adjustments, and full scorecards.
3. **No-Modification Policy**: The original Svelte web application code will remain completely unmodified. The React Native version will be entirely self-contained inside the `mobile_version` folder.

---

## 2. Technology Stack
* **Framework**: React Native with **Expo Go** (SDK 51+) for instant cross-platform testing and delivery.
* **Language**: TypeScript for type safety, matching the original codebase models.
* **Styling**: Vanilla React Native `StyleSheet` for optimized, flexible layouts, adhering to our guidelines (avoiding Tailwind CSS unless requested).
* **Navigation**: React Navigation (Native Stack & Bottom Tabs) or a robust custom state-driven router to maintain pure JavaScript execution without platform link issues.
* **State Management**: React Context API with custom hooks (`useGame`) that replicate the Svelte store API (`playerStore`, `teamStore`, etc.), providing a simple, reactive, and unified global game state.
* **Persistence**: Expo `AsyncStorage` to handle game saves and settings.

---

## 3. Directory Structure (Proposed)
```
mobile_version/
├── assets/                  # Icons, fonts, branding images
├── phase_documentation/     # Step-by-step phase logs (this folder)
├── src/
│   ├── components/          # Reusable UI (PlayerCard, Scoreboard, etc.)
│   ├── core/                # Ported game logic (matchEngine, schedule, injury, etc.)
│   ├── hooks/               # Custom state hooks (useGame, useAudio, etc.)
│   ├── models/              # Ported type interfaces (player, team, match, faction)
│   ├── navigation/          # Navigation setup / routing logic
│   ├── screens/             # Main screen components (Menu, Dashboard, Match, Draft)
│   ├── state/               # React Context for global game state (GameContext)
│   └── utils/               # Helper utilities (storage, styling, helpers)
├── App.tsx                  # Application entry point
├── app.json                 # Expo configuration
├── package.json             # NPM dependencies
└── tsconfig.json            # TypeScript configuration
```

---

## 4. Phase 1 Todo List

### Task 1: Project Initialization
- [ ] Run `npx create-expo-app` with the `blank-typescript` template in the `mobile_version` directory.
- [ ] Verify core configuration files (`package.json`, `app.json`, `tsconfig.json`).
- [ ] Configure `app.json` for proper app name, orientation, and color themes.
- [ ] Set up basic folder structure inside `src/`.

### Task 2: Port Models & Core Game Logic
- [ ] Port typescript interfaces from `src/lib/models/`:
  - `player.ts`
  - `team.ts`
  - `match.ts`
  - `faction.ts`
- [ ] Port core TypeScript engines/utilities from `src/lib/core/` (cleaning up any Svelte or browser-specific imports):
  - `matchEngine.ts` (Match logic, powerplays, free hits, wide/no balls, intents)
  - `schedule.ts` (Tournament scheduling, weekdays/weekends match configurations)
  - `teamBuilder.ts` (Personalities, logos, coaches, team names)
  - `tournamentRules.ts` (Rules, Super Over, DLS placeholders/stubs)
  - `tournamentSim.ts` (AI vs AI simulation resolution)
  - `injurySystem.ts` (Fatigue and match injuries)
  - `sponsorship.ts` (Contracts and sponsor revenue)
  - `fanSystem.ts` (Popularity, fan revenue, home advantage bonus)
  - `trainingLab.ts` (XP upgrades and cost calculations)
  - `draftAI.ts` (Balanced squad generators and player pool builders)
  - `retentionSystem.ts` (Retaining players between seasons)

### Task 3: Establish State Management (GameContext)
- [ ] Create `src/state/GameContext.tsx` providing parallel functionality to Svelte stores:
  - React state for `players`, `teams`, `schedule`, `currentDay`, `currentSeason`, `gamePhase`, `isFirstLogin`.
  - Port functions: `initializeGame`, `saveCurrentGame`, `resetGame`, `upgradePlayerStat`, `startNewSeason`.
- [ ] Implement local storage integration using `@react-native-async-storage/async-storage` (replaces Svelte's `localStorage` service).
- [ ] Expose state via a custom React hook `useGame()`.

### Task 4: UI Navigation & Shell Creation
- [ ] Create a custom screen router based on the `gamePhase` state ('menu' | 'draft' | 'tournament' | 'match' | 'season_end' | 'retention' | 'scouting' | 'trading' | 'auction') to keep transitions fast and easily testable on Expo.
- [ ] Create UI/UX design theme tokens (`src/utils/theme.ts`) with custom fonts, colors (Human, Elf, Orc, Dwarf, Goblin, Night Elf custom palettes), gradients, and border-radius rules.
- [ ] Create a basic Main Menu screen placeholder.
- [ ] Create a basic Dashboard screen placeholder.
- [ ] Create a basic Match Flow container placeholder.

### Task 5: Build & Run Verification
- [ ] Install required mobile packages (`expo-status-bar`, `@react-native-async-storage/async-storage`, `expo-linear-gradient`, `lucide-react-native`).
- [ ] Run `npm run start` (or `expo start`) and verify that compilation succeeds without errors.
- [ ] Validate TypeScript types check successfully.

---

## 5. Next Steps
Once Phase 1 is complete, we will move into:
* **Phase 2: UI/UX Implementation**: Building the detailed Dashboard, Team Roster, Training Lab, Sponsor/Contract hub, Player Auction interface, and Tournament Standings.
* **Phase 3: Match Simulation Experience**: Creating the interactive Match screens (Toss, Over-by-Over visual tracker, Ball Feed, Dynamic scorecard, Innings Break, Match completion).
* **Phase 4: Optimization & Polish**: Testing on devices, adding micro-animations, refining loading states, and ensuring clean error handling.
