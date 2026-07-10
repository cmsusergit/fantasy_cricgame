import { describe, test, expect } from '@jest/globals';
import { resolveBall } from '../core/matchEngine';
import type { Player } from '../models/player';

// Helper to create a mock squad of 11 players
function createMockSquad(teamId: string, faction: string, prefixName: string): Player[] {
  const players: Player[] = [];
  for (let i = 1; i <= 11; i++) {
    const isBatsman = i <= 6;
    const isWicketKeeper = i === 6;
    const isBowler = i > 6;
    
    players.push({
      id: `${teamId}_p_${i}`,
      name: `${prefixName} Player ${i}`,
      age: 24,
      role: isWicketKeeper ? 'wicketkeeper' : (isBatsman ? 'batsman' : 'bowler'),
      battingType: 'RHB',
      bowlingType: isBowler ? (i % 2 === 0 ? 'fast' : 'spinner') : 'none',
      stats: {
        batting: isBatsman ? 70 : 25,
        bowling: isBowler ? 70 : 15,
        power: isBatsman ? 65 : 20,
        technique: isBatsman ? 68 : 22,
        fielding: 60,
      },
      special: {
        isCaptain: i === 1,
        captainBonus: i === 1 ? 3 : 0,
        isWicketKeeper: isWicketKeeper,
        wkBonus: isWicketKeeper ? 3 : 0,
      },
      price: 50000,
      marketValue: 300000,
      isScouted: true,
      isAvailable: true,
      retiring: false,
      tournamentStats: { runs: 0, wickets: 0, catches: 0 },
      matches: 0,
      runsScored: 0,
      wickets: 0,
      catches: 0,
      form: 3,
      portraitId: i,
      potential: 75,
      xp: 20,
      originalName: `${prefixName} Player ${i}`,
      faction: faction as any,
      fatigue: 0,
      morale: 90,
    });
  }
  return players;
}

interface InningsSimResult {
  totalRuns: number;
  wickets: number;
  balls: number;
  overs: number;
}

function simulateInnings(
  batPlayers: Player[],
  bowlPlayers: Player[],
  target: number | null
): InningsSimResult {
  const rosterBat = batPlayers.map(p => p.id);
  const rosterBowl = bowlPlayers.map(p => p.id);

  let tempStriker = rosterBat[0];
  let tempNonStriker = rosterBat[1];
  let tempBowler = rosterBowl[6]; // First bowler in roster is index 6

  let tempRuns = 0;
  let tempWickets = 0;
  let tempBalls = 0;
  let tempOvers = 0;
  const tempBallsFaced: any[] = [];

  while (tempBalls < 120 && tempWickets < 10) {
    if (target !== null && tempRuns >= target) {
      break;
    }

    // safe players lookup
    let striker = batPlayers.find(p => p.id === tempStriker);
    if (!striker && batPlayers.length) {
      striker = batPlayers[0];
      tempStriker = striker.id;
    }
    let nonStriker = batPlayers.find(p => p.id === tempNonStriker);
    if (!nonStriker && batPlayers.length) {
      nonStriker = batPlayers.find(p => p.id !== tempStriker) || batPlayers[0];
      tempNonStriker = nonStriker.id;
    }
    let bowler = bowlPlayers.find(p => p.id === tempBowler);
    if (!bowler && bowlPlayers.length) {
      bowler = bowlPlayers[0];
      tempBowler = bowler.id;
    }

    if (!striker || !nonStriker || !bowler) {
      break;
    }

    const ballEvent = resolveBall(
      striker,
      bowler,
      tempBalls,
      20,
      'balanced',
      'sunny',
      'balanced',
      0,
      false,
      'balanced',
      false,
      60,
      'normal',
      1.0,
      1.0,
      rosterBowl
    );

    tempBallsFaced.push(ballEvent);
    tempRuns += ballEvent.runs;

    if (ballEvent.isWicket) {
      tempWickets += 1;
      if (tempWickets < 10) {
        // Select next batter safely
        const dismissedIds = tempBallsFaced.filter(b => b.isWicket).map(b => b.batsmanId);
        tempStriker = rosterBat.find(id => id !== tempNonStriker && !dismissedIds.includes(id)) || rosterBat.find(id => id !== tempNonStriker) || rosterBat[0];
      }
    } else {
      if (ballEvent.runs % 2 === 1) {
        const swap = tempStriker;
        tempStriker = tempNonStriker;
        tempNonStriker = swap;
      }
    }

    if (ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
      tempBalls += 1;
    }

    // Over transition
    if (tempBalls > 0 && tempBalls % 6 === 0 && (ballEvent.result !== 'wide' && ballEvent.result !== 'noball')) {
      tempOvers += 1;
      // swap strike
      const swap = tempStriker;
      tempStriker = tempNonStriker;
      tempNonStriker = swap;

      // select next bowler safely
      const choices = bowlPlayers.filter(p => p.id !== tempBowler && p.id !== tempNonStriker).slice(0, 5);
      const randomBowler = choices[Math.floor(Math.random() * choices.length)] || bowlPlayers.find(p => p.id !== tempNonStriker) || bowlPlayers[0];
      if (randomBowler) {
        tempBowler = randomBowler.id;
      }
    }
  }

  return {
    totalRuns: tempRuns,
    wickets: tempWickets,
    balls: tempBalls,
    overs: tempOvers,
  };
}

describe('Match Engine Balance Simulation', () => {
  test('Simulate 50 matches to verify functionality and balance', () => {
    const team1Players = createMockSquad('team_1', 'human', 'Knight');
    const team2Players = createMockSquad('team_2', 'orc', 'Warlord');

    let team1Wins = 0;
    let team2Wins = 0;
    let totalRuns1 = 0;
    let totalRuns2 = 0;
    let totalWickets1 = 0;
    let totalWickets2 = 0;
    let totalBalls1 = 0;
    let totalBalls2 = 0;

    const numMatches = 50;

    for (let m = 1; m <= numMatches; m++) {
      // Innings 1: Team 1 Bats, Team 2 Bowls
      const inn1 = simulateInnings(team1Players, team2Players, null);
      totalRuns1 += inn1.totalRuns;
      totalWickets1 += inn1.wickets;
      totalBalls1 += inn1.balls;

      const target = inn1.totalRuns + 1;

      // Innings 2: Team 2 Bats, Team 1 Bowls
      const inn2 = simulateInnings(team2Players, team1Players, target);
      totalRuns2 += inn2.totalRuns;
      totalWickets2 += inn2.wickets;
      totalBalls2 += inn2.balls;

      // Determine Winner
      if (inn2.totalRuns >= target) {
        team2Wins++;
      } else {
        team1Wins++;
      }
    }

    console.log(`===========================================`);
    console.log(`  SIMULATION STATISTICS FOR ${numMatches} MATCHES`);
    console.log(`===========================================`);
    console.log(`Team 1 Wins: ${team1Wins} (${Math.round((team1Wins / numMatches) * 100)}%)`);
    console.log(`Team 2 Wins: ${team2Wins} (${Math.round((team2Wins / numMatches) * 100)}%)`);
    console.log(`Avg Runs (Innings 1): ${Math.round(totalRuns1 / numMatches)}`);
    console.log(`Avg Wickets (Innings 1): ${(totalWickets1 / numMatches).toFixed(1)}`);
    console.log(`Avg Balls Faced (Innings 1): ${Math.round(totalBalls1 / numMatches)}`);
    console.log(`Avg Runs (Innings 2): ${Math.round(totalRuns2 / numMatches)}`);
    console.log(`Avg Wickets (Innings 2): ${(totalWickets2 / numMatches).toFixed(1)}`);
    console.log(`Avg Balls Faced (Innings 2): ${Math.round(totalBalls2 / numMatches)}`);
    console.log(`===========================================`);

    // Basic functional assertions
    expect(team1Wins + team2Wins).toBe(numMatches);
    expect(totalRuns1 / numMatches).toBeGreaterThan(50);
    expect(totalWickets1 / numMatches).toBeLessThanOrEqual(10);
  });
});
