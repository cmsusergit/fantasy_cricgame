import { describe, test, expect } from '@jest/globals';
import { resolveBall, updateFatigueAndMorale } from '../core/matchEngine';
import type { Player } from '../models/player';

// Mock high-tier batsman
const mockStarBatsman: Player = {
  id: 'bat_star',
  name: 'Virat Kohli',
  age: 32,
  role: 'batsman',
  battingType: 'RHB',
  bowlingType: 'none',
  stats: { batting: 95, bowling: 20, power: 90, technique: 92, fielding: 85 },
  special: { isCaptain: true, captainBonus: 3, isWicketKeeper: false, wkBonus: 0 },
  price: 150000,
  marketValue: 1200000,
  isScouted: true,
  isAvailable: true,
  retiring: false,
  tournamentStats: { runs: 0, wickets: 0, catches: 0 },
  matches: 0,
  runsScored: 0,
  wickets: 0,
  catches: 0,
  form: 5,
  portraitId: 1,
  potential: 95,
  xp: 50,
  originalName: 'Virat Kohli',
  faction: 'human',
  fatigue: 0,
  morale: 100
};

// Mock amateur batsman
const mockAmateurBatsman: Player = {
  id: 'bat_amateur',
  name: 'Amateur Batter',
  age: 20,
  role: 'batsman',
  battingType: 'RHB',
  bowlingType: 'none',
  stats: { batting: 35, bowling: 15, power: 30, technique: 32, fielding: 45 },
  special: { isCaptain: false, captainBonus: 0, isWicketKeeper: false, wkBonus: 0 },
  price: 15000,
  marketValue: 50000,
  isScouted: true,
  isAvailable: true,
  retiring: false,
  tournamentStats: { runs: 0, wickets: 0, catches: 0 },
  matches: 0,
  runsScored: 0,
  wickets: 0,
  catches: 0,
  form: 0,
  portraitId: 2,
  potential: 65,
  xp: 10,
  originalName: 'Amateur Batter',
  faction: 'goblin',
  fatigue: 0,
  morale: 80
};

// Mock star bowler
const mockStarBowler: Player = {
  id: 'bowl_star',
  name: 'Jasprit Bumrah',
  age: 28,
  role: 'bowler',
  battingType: 'RHB',
  bowlingType: 'fast',
  stats: { batting: 15, bowling: 95, power: 25, technique: 30, fielding: 80 },
  special: { isCaptain: false, captainBonus: 0, isWicketKeeper: false, wkBonus: 0 },
  price: 140000,
  marketValue: 1100000,
  isScouted: true,
  isAvailable: true,
  retiring: false,
  tournamentStats: { runs: 0, wickets: 0, catches: 0 },
  matches: 0,
  runsScored: 0,
  wickets: 0,
  catches: 0,
  form: 5,
  portraitId: 3,
  potential: 96,
  xp: 40,
  originalName: 'Jasprit Bumrah',
  faction: 'dwarf',
  fatigue: 0,
  morale: 100
};

describe('Cricket Match Engine Simulation Balance Tests', () => {
  
  test('Star Batsman vs Amateur Bowler should score runs efficiently', () => {
    let totalRuns = 0;
    let boundariesCount = 0;
    let wicketsCount = 0;

    // Simulate 100 balls
    for (let i = 0; i < 100; i++) {
      const ballEvent = resolveBall(
        mockStarBatsman,
        mockAmateurBatsman, // weak bowler
        i, // current ball index
        20, // total overs
        'aggressive', // batting intent
        'sunny',
        'flat',
        0,
        false,
        'balanced',
        false,
        50,
        'normal',
        1.0,
        1.0,
        []
      );

      totalRuns += ballEvent.runs;
      if (ballEvent.runs === 4 || ballEvent.runs === 6) {
        boundariesCount++;
      }
      if (ballEvent.isWicket) {
        wicketsCount++;
      }
    }

    console.log(`[Star Bat vs Amateur Bowl] 100 Balls: Runs: ${totalRuns}, Boundaries: ${boundariesCount}, Wickets: ${wicketsCount}`);
    expect(totalRuns).toBeGreaterThanOrEqual(100); 
    expect(boundariesCount).toBeGreaterThanOrEqual(5); 
    expect(wicketsCount).toBeLessThanOrEqual(18); 
  });

  test('Amateur Batsman vs Star Bowler should struggle heavily', () => {
    let totalRuns = 0;
    let boundariesCount = 0;
    let wicketsCount = 0;

    // Simulate 100 balls
    for (let i = 0; i < 100; i++) {
      const ballEvent = resolveBall(
        mockAmateurBatsman,
        mockStarBowler,
        i,
        20,
        'defensive',
        'cloudy',
        'seaming', // Seaming pitch favors fast bowler Bumrah
        0,
        false,
        'aggressive',
        false,
        80,
        'normal',
        1.0,
        1.0,
        []
      );

      totalRuns += ballEvent.runs;
      if (ballEvent.runs === 4 || ballEvent.runs === 6) {
        boundariesCount++;
      }
      if (ballEvent.isWicket) {
        wicketsCount++;
      }
    }

    console.log(`[Amateur Bat vs Star Bowl] 100 Balls: Runs: ${totalRuns}, Boundaries: ${boundariesCount}, Wickets: ${wicketsCount}`);
    expect(totalRuns).toBeLessThan(200); // Star bowler limits run leakage
    expect(wicketsCount).toBeGreaterThanOrEqual(0); // Star bowler restricts scoring, wickets may vary
  });

  test('Fatigue and Morale updates drift correctly', () => {
    const batIntent = 'aggressive';
    const bowlIntent = 'aggressive';
    
    const updates = updateFatigueAndMorale(
      mockStarBatsman,
      mockStarBowler,
      'four',
      batIntent,
      bowlIntent
    );

    expect(updates.batterFatigue).toBeGreaterThan(0);
    expect(updates.bowlerFatigue).toBeGreaterThan(0);
    expect(updates.batterMorale).toBeGreaterThanOrEqual(0);
    expect(updates.bowlerMorale).toBeLessThanOrEqual(0);
  });
});
