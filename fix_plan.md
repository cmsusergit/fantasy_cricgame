# Fix Plan: XP / Fatigue / Form Persistence

## Summary of Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | XP written to `playerStore` (free-agent pool) instead of `teamStore` (user team) | Critical | `match/+page.svelte:525-527` |
| 2 | AI matches skip all player stat updates (random scores only) | Critical | `schedule.ts:simulateAllMatchesForDay()` |
| 3 | Bowler fatigue never tracked in user matches | High | `match/+page.svelte:639` |
| 4 | `form` never updated after initial creation | High | `draftAI.ts:129`, unused elsewhere |
| 5 | `morale` only updated for user matches (via `resolveMatch`) | High | `schedule.ts` AI path |
| 6 | Form & morale are duplicate concepts kept out of sync | Medium | Both fields on `Player` model |

---

## Step A — Fix XP: Write to teamStore Instead of playerStore

**What:** In `match/+page.svelte:finishMatch()`, after computing `playerStatsUpdates` (line 523), update the team's players in `teamStore` rather than `playerStore`.

**Why:** Squad and training pages read from `teamStore.players`. The current code writes XP to `playerStore` (free agents), so displayed XP is always 0.

**How:**
```ts
// Instead of: playerStore.updatePlayerStats(id, playerStatsUpdates[id])
// Do:
teamStore.update(teams => teams.map(team => {
  if (team.id !== matchTeam1.id && team.id !== matchTeam2.id) return team;
  return {
    ...team,
    players: team.players.map(p => {
      const updates = playerStatsUpdates[p.id];
      if (!updates) return p;
      return {
        ...p,
        matches: p.matches + 1,
        runsScored: p.runsScored + (updates.runs || 0),
        wickets: p.wickets + (updates.wickets || 0),
        catches: p.catches + (updates.catches || 0),
        xp: (p.xp || 0) + (updates.xp || 0),
        lifetimeXp: (p.lifetimeXp || 0) + (updates.xp || 0),
        tournamentStats: {
          runs: (p.tournamentStats?.runs || 0) + (updates.runs || 0),
          wickets: (p.tournamentStats?.wickets || 0) + (updates.wickets || 0),
          catches: (p.tournamentStats?.catches || 0) + (updates.catches || 0)
        }
      };
    })
  };
}));
```

**Risk:** Low. Same data, correct store.

---

## Step B — Fix AI Matches: Use Proper Ball-by-Ball Sim + Apply Player Stats

**What:** Replace the random-score stub in `simulateAllMatchesForDay()` (schedule.ts:231) with calls to `tournamentSim.ts:simulateMatch()` which does full ball-by-ball resolution with fatigue/morale updates.

Then, for each completed AI match, compute XP (same calc as finishMatch lines 450-525) and apply to AI team players in `teamStore`.

**How:**
```ts
// In schedule.ts, for AI matches:
// 1. Call simulateMatch(team1, team2) instead of random scores
// 2. Return the full innings data along with the result
// 3. In +page.svelte advanceTournament(), receive innings data and:
//    - Apply XP to players (same calc as finishMatch)
//    - Call postMatchMoraleUpdate(team1, team2, innings1, innings2, winner)
```

**Changes needed:**
- `schedule.ts`: Add `simulateAllMatchesForDayDetailed()` that returns innings data, or make existing function call `simulateMatch()` and pass back results alongside innings.
- `+page.svelte:advanceTournament()`: After calling simulate, iterate completed AI matches, compute XP per player, update teamStore.

**Risk:** Medium. Runtime per AI match ~240 iterations of `resolveBall()` — negligible for 2-3 AI matches per day. Existing `quickSimulateUserMatch()` already uses `tournamentSim.simulateInnings()` so this pattern is proven.

---

## Step C — Add Intent-Based Fatigue Buildup

**What:** Update `updateFatigueAndMorale()` to accept `battingIntent` and `bowlingIntent` parameters, and apply multipliers to fatigue. Call it in the user match path too (replacing the hardcoded `striker.fatigue += 0.3`).

### Fatigue Multipliers by Intent

| Intent Level | Batter Fatigue Mult | Bowler Fatigue Mult | Rationale |
|---|---|---|---|
| `very_defensive` | 0.5x | 0.6x | Minimal running, slow bowling, conserving energy |
| `defensive` | 0.75x | 0.8x | Reduced aggression, steady play |
| `balanced` | 1.0x | 1.0x | Normal effort |
| `aggressive` | 1.5x | 1.5x | More running (converting 1s→2s), bigger swings, faster bowling |
| `very_aggressive` | 2.0x | 2.0x | Maximum exertion, sprinting, full-power deliveries |

### Base Fatigue Values (unchanged, from `updateFatigueAndMorale`)

| Ball Result | Batter Base Fatigue | Bowler Base Fatigue |
|---|---|---|
| dot | 0.3 | 0.2 |
| single | 0.2 | 0.2 |
| two | 0.3 | 0.2 |
| three | 0.4 | 0.2 |
| four | 0.35 | 0.2 |
| six | 0.35 | 0.2 |
| wicket | 0.3 | 0.2 |

**Final formula:** `finalFatigue = baseFatigue * intentMultiplier`

### Changes needed:
1. **`matchEngine.ts:updateFatigueAndMorale()`** — Add `battingIntent: IntentType` and `bowlingIntent: IntentType` params. Add multiplier lookup.
2. **`tournamentSim.ts:85-89`** — Pass intents through to `updateFatigueAndMorale()`.
3. **`match/+page.svelte:executeSingleBall()` line 639** — Replace `striker.fatigue += 0.3` with call to `updateFatigueAndMorale()` using `currentActiveBattingIntent` and `currentActiveBowlingIntent`, then apply returned fatigue values to both striker and bowler.

**Risk:** Low. Changes the fatigue accumulation rate, which has been negligible (barely noticeable at 0.3/ball). With 2x multiplier for very_aggressive, maximum per-ball fatigue would be 0.8 for batter, 0.4 for bowler — still modest over 120 balls (96 max batter, 48 max bowler).

---

## Step D — Unify Form & Morale (Sync Form from Morale Post-Match)

**What:** After `postMatchMoraleUpdate()` calculates new morale for each player, derive `form` from `morale` using: `form = clamp(Math.round((morale - 50) / 5), -10, 10)`

**Mapping:**

| Morale | Form |
|--------|------|
| 0 | -10 |
| 25 | -5 |
| 50 | 0 |
| 75 | +5 |
| 100 | +10 |

**Why:** Both track "recent performance form" but through different fields/ranges:
- `morale` (0-100) → used in ball resolution (`batterMoraleMod`, `bowlerMoraleMod`) and displayed in UI bars
- `form` (-10 to +10) → used in `getEffectiveStats()` as a 0.8-1.2 multiplier

Keeping them synced means form actually changes over time (currently frozen at initial value forever).

**Change in `matchEngine.ts:postMatchMoraleUpdate()`**, after line 853:
```ts
player.form = clamp(Math.round((player.morale - 50) / 5), -10, 10);
```

**Callers of `postMatchMoraleUpdate`:**
- `resolveMatch()` — already works for user matches (called from finishMatch)
- Need to also call for AI matches (see Step B)

**Risk:** Low. Same range, same direction. Just makes form dynamic instead of frozen.

---

## Step E — Apply Match Fatigue Post-Match

**What:** In `finishMatch()`, after XP updates, apply cumulative per-player fatigue from the match to all playing XI players. This ensures fatigue carries forward across matches.

**Batter fatigue:** Sum of per-ball fatigue values (from `updateFatigueAndMorale`) across all balls faced.
**Bowler fatigue:** Sum of per-ball fatigue values across all balls bowled.

For `finishMatch()`, we can approximate:
- Per batter: `ballsFaced * 0.3 * avgIntentMult` (approximate based on their recorded intent)
- Per bowler: `ballsBowled * 0.2 * avgIntentMult`
- Or: iterate innings ballsFaced and accumulate fatigue using `updateFatigueAndMorale` retroactively.

Simplest approach: During `executeSingleBall()`, track cumulative fatigue per player in a running total, then apply it at finishMatch time.

**Change in `finishMatch()`:**
```ts
// Apply fatigue from match
const matchFatigue: Record<string, number> = {};
// Already tracked during executeSingleBall via a running Map
// At finish, add to each player:
teamStore.update(teams => teams.map(team => {
  if (team.id !== matchTeam1.id && team.id !== matchTeam2.id) return team;
  return {
    ...team,
    players: team.players.map(p => ({
      ...p,
      fatigue: Math.min(100, (p.fatigue || 0) + (matchFatigue[p.id] || 0))
    }))
  };
}));
```

**Daily recovery** already exists in `advanceTournament()` at `+page.svelte:200` (`fatigue = Math.max(0, fatigue - 15)`).

**Risk:** Low. Fatigue already exists on the model and is already reduced daily. This just adds the accumulation side.

---

## Step F — Quick Sim Path: Apply Same XP/Fatigue/Form Updates

**What:** `quickSimulateUserMatch()` at `+page.svelte:101` already uses `tournamentSim.simulateInnings()` and `resolveMatch()`. But it only applies tournamentStats to `playerStore` (line 147). Need to also compute XP and apply to `teamStore` players.

**Change:** After line 170 (where `lastMatchResult = result`), add the same XP computation loop from `finishMatch()` (lines 450-525) targeting the teamStore players of the matched teams.

**Risk:** Low. Missing feature — quick sim should behave identically to normal match play for stat tracking.

---

## Implementation Order

1. **Step A** (XP → teamStore) — Core fix, unblocks XP display
2. **Step C** (Intent-based fatigue + call `updateFatigueAndMorale` in user match path) — Needed before Step E
3. **Step E** (Apply match fatigue post-match) — Depends on Step C
4. **Step D** (Sync form from morale) — Self-contained, small change
5. **Step B** (AI match proper sim + player updates) — Larger change, benefits from Steps A/C/D patterns being established
6. **Step F** (Quick sim XP) — Last, since quick sim is secondary path

## Files to Modify

| File | Steps |
|------|-------|
| `src/lib/core/matchEngine.ts` | C (updateFatigueAndMorale signature), D (form sync in postMatchMoraleUpdate) |
| `src/lib/core/tournamentSim.ts` | C (pass intents to updateFatigueAndMorale) |
| `src/lib/core/schedule.ts` | B (replace random scores with simulateMatch) |
| `src/routes/match/+page.svelte` | A (teamStore XP), C (use updateFatigueAndMorale in executeSingleBall), E (apply match fatigue) |
| `src/routes/+page.svelte` | B (process AI match XP/morale), F (quick sim XP) |

## What NOT to Change

- Player model (`player.ts`) — keep both `form` and `morale` fields, just sync them
- Match engine ball resolution (`resolveBall`, `calculateWicketChance`, `calculateShotQuality`) — leave untouched
- `getEffectiveStats()` — still uses `form`, which will now actually change
- UI components — morale bars, form display already work, will show real values after steps A/D
- Training/XP upgrade system — already works once XP data reaches teamStore
