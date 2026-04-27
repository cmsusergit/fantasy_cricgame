# Advanced Player Classification and Matchup Plan

## 1. Batsman Classification & Batting Order Impact

Batsmen will be assigned a specific `battingPosition` role to reflect their expertise in the batting lineup.

### Classifications
- **Top Order (Positions 1-3):** Openers and number 3. High technique, excel against the new swinging ball and pace.
- **Middle Order (Positions 4-7):** Accumulators and finishers. High power and ability to play spin effectively during middle overs.
- **Tail Ender (Positions 8-11):** Primarily bowlers with low batting skills. Usually look to survive or hit wildly at the death.

### Implementation Strategy
- **Position Penalty/Bonus:** In the `calculateShotQuality` and `calculateWicketChance` functions, apply a modifier based on the player's actual batting position in the current match versus their classified role.
  - *Example:* A "Top Order" batsman coming in at #7 suffers a -10% technique penalty (struggles to hit out immediately).
  - *Example:* A "Tail Ender" coming in at #3 suffers a -30% technique penalty (cannot handle the new ball/quality bowling).
- **Phase Bonus:** Top Order gets a +5% bonus in the Powerplay (overs 1-6). Middle Order gets a +5% bonus in the middle overs (7-15) and death overs (16-20) if their power stat is high.

## 2. Bowler Classification & Skill Types

Bowlers will be assigned a `bowlingType` and `handedness` to determine their specific style and angle of attack.

### Classifications
- **Fast / Express Pace:** Relies on raw speed and bounce. High wicket-taking potential but can leak runs if misdirected. (Bonus on `bouncing` pitches).
- **Swing / Medium Pace:** Relies on moving the ball in the air. Highly effective with the new ball (overs 1-4). (Bonus on `seaming` pitches and `cloudy` weather).
- **Leg Spinner (Wrist Spin):** Turns the ball away from the right-hander. High wicket-taking ability, especially in middle overs. (Bonus on `turning` pitches).
- **Off Spinner (Finger Spin):** Turns the ball into the right-hander, away from the left-hander. High control and economy rate. (Bonus on `turning` pitches).

## 3. Advanced Matchup Analytics (The "Rock-Paper-Scissors" Effect)

Based on advanced real-world cricket analytics, specific bowler types have statistical advantages over specific batsman types based on handedness (`Left-Handed Batsman` vs `Right-Handed Batsman`).

### Matchup Implementation (Modifiers in Match Engine)
- **Off-Spinner vs Left-Handed Batsman:** +15% Wicket Chance, -10% Shot Quality for the batsman. (The ball turns away from the bat, finding the outside edge).
- **Leg-Spinner vs Right-Handed Batsman:** +10% Wicket Chance. (The ball turns away from the right-hander, leading to catches and stumpings).
- **Left-Arm Pace vs Right-Handed Batsman:** +10% Wicket Chance. (The natural angle across the right-hander is historically difficult to face).
- **Right-Arm Pace (Around the Wicket) vs Left-Handed Batsman:** +10% Wicket Chance. (Cramps the left-hander for room).
- **Fast/Pace vs Tail Enders:** +25% Wicket Chance. (Tail enders historically struggle against express pace and bouncers).
- **Swing Bowlers in Overs 1-4:** +15% Wicket Chance. (Maximum swing movement available).

## 4. Required Model Updates

To implement this plan, the following TypeScript interfaces in `src/lib/models/player.ts` would need updating:

```typescript
export type BattingRole = 'top_order' | 'middle_order' | 'tail_ender';
export type BowlingType = 'fast' | 'swing' | 'leg_spin' | 'off_spin' | 'none';
export type Handedness = 'left' | 'right';

export interface Player {
  // ... existing fields
  handedness: Handedness;
  battingRole: BattingRole;
  bowlingType: BowlingType;
}
```

## 5. Engine Integration (`src/lib/core/matchEngine.ts`)

1. **Update `calculateWicketChance()`**: Add a `matchupMultiplier` variable that checks the bowler's `bowlingType` and `handedness` against the batter's `handedness` and `battingRole`.
2. **Update `calculateShotQuality()`**: Apply penalties to the base shot quality if a batsman is batting out of their preferred order, or if the matchup heavily favors the bowler.
3. **UI Updates (`PlayerCard.svelte` & `PlayerModal.svelte`)**: Display these new classifications clearly so the user (manager) can make intelligent tactical decisions when selecting their batting order and bowling changes.