import { describe, test, expect } from '@jest/globals';
import { processRetentions, calculateRetentionCost, isMegaAuction } from '../core/retentionSystem';
import type { Player } from '../models/player';
import type { Team } from '../models/team';

// Helper to make a mock player
const createMockPlayer = (id: string, name: string, marketValue: number, age: number, retiring = false): Player => ({
  id,
  name,
  age,
  role: 'batsman',
  battingType: 'RHB',
  bowlingType: 'none',
  stats: { batting: 70, bowling: 10, power: 70, technique: 70, fielding: 70 },
  special: { isCaptain: false, captainBonus: 0, isWicketKeeper: false, wkBonus: 0 },
  price: marketValue,
  marketValue,
  isScouted: true,
  isAvailable: true,
  retiring,
  tournamentStats: { runs: 0, wickets: 0, catches: 0 },
  fatigue: 0,
  morale: 80,
  xp: 150,
  originalName: name,
  faction: 'human',
  form: 0,
  matches: 0,
  runsScored: 0,
  wickets: 0,
  catches: 0,
  portraitId: 1,
  potential: 80
});

describe('Career Progression & Financial State Transitions', () => {

  test('isMegaAuction identifies the off-season correctly', () => {
    expect(isMegaAuction(4)).toBe(true);
    expect(isMegaAuction(7)).toBe(true);
    expect(isMegaAuction(2)).toBe(false);
    expect(isMegaAuction(3)).toBe(false);
  });

  test('Retention Cost computes tiered Mega costs or current Market Value for Mini', () => {
    const player = createMockPlayer('p1', 'Player One', 60000, 25);
    
    const miniCost = calculateRetentionCost(0, player, false);
    expect(miniCost).toBe(60000);

    const megaTier1Cost = calculateRetentionCost(0, player, true); 
    const megaTier2Cost = calculateRetentionCost(1, player, true); 
    
    expect(megaTier1Cost).toBe(15000);
    expect(megaTier2Cost).toBe(12000);
  });

  test('processRetentions correctly updates squad and deducts budget', () => {
    const p1 = createMockPlayer('p1', 'Player A', 45000, 24);
    const p2 = createMockPlayer('p2', 'Player B', 50000, 28);
    const p3 = createMockPlayer('p3', 'Player C', 30000, 27); 

    const initialBudget = 100000;
    
    const mockUserTeam: Team = {
      id: 'user_team',
      name: 'User Team',
      coach: 'User Coach',
      isUserTeam: true,
      budget: initialBudget,
      players: [p1, p2, p3],
      playing11: ['p1', 'p2', 'p3'],
      facilities: { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
      staff: [],
      sponsorships: [],
      wins: 0,
      losses: 0,
      draws: 0,
      runsFor: 0,
      runsAgainst: 0,
      matchesPlayed: 0,
      fanProfile: { fanbase: 1000, loyalty: 50, satisfaction: 50 },
      tournamentWins: 0,
      injuries: [],
      personality: 'balanced',
      tendency: { powerplayIntent: 'balanced', deathOverIntent: 'balanced', fieldSetting: 'neutral', riskTolerance: 50 },
      colorPrimary: '#1e40af',
      colorSecondary: '#06b6d4',
      faction: 'human'
    };

    const initialPlayers: Player[] = [p1, p2, p3];
    const initialTeams: Team[] = [mockUserTeam];

    const result = processRetentions(
      'user_team',
      ['p1', 'p2'],
      false, 
      initialBudget,
      initialPlayers,
      initialTeams
    );

    expect(result.success).toBe(true);
    
    const updatedTeam = result.updatedTeams.find(t => t.id === 'user_team')!;
    expect(updatedTeam.players).toHaveLength(2);
    expect(updatedTeam.players.some(p => p.id === 'p3')).toBe(false);
    expect(updatedTeam.budget).toBe(5000);
    
    const updatedP3 = result.updatedPlayers.find(p => p.id === 'p3')!;
    expect(updatedP3.isAvailable).toBe(true);
  });
});
