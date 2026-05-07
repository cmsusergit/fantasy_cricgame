import type { Team, TeamPersonality, TeamTendency } from '../models/team';
import { generatePlayerPool, generateTeamName, generateCoachName } from './draftAI';
import type { Player } from '../models/player';

export const PERSONALITY_NAMES: Record<TeamPersonality, string> = {
  aggressive: 'Thunder Strikers',
  defensive: 'Iron Shield',
  balanced: 'Eleven Warriors',
  strategic: 'Master Minds',
  adaptive: 'Chameleons'
};

export const PERSONALITY_DESCRIPTIONS: Record<TeamPersonality, string> = {
  aggressive: 'Go for broke from the first ball - maximize scoring rate',
  defensive: 'Build partnerships, protect wickets, attrition bowling',
  balanced: 'Mix of aggression and caution based on match situation',
  strategic: 'Match-ups, field placements, tactical substitutions',
  adaptive: 'Read the opposition and adjust accordingly'
};

export function createTeamTendency(personality: TeamPersonality): TeamTendency {
  switch (personality) {
    case 'aggressive':
      return {
        powerplayIntent: 'aggressive',
        deathOverIntent: 'aggressive',
        fieldSetting: 'attacking',
        riskTolerance: 85
      };
    case 'defensive':
      return {
        powerplayIntent: 'balanced',
        deathOverIntent: 'defensive',
        fieldSetting: 'defensive',
        riskTolerance: 20
      };
    case 'balanced':
      return {
        powerplayIntent: 'balanced',
        deathOverIntent: 'balanced',
        fieldSetting: 'neutral',
        riskTolerance: 50
      };
    case 'strategic':
      return {
        powerplayIntent: 'balanced',
        deathOverIntent: 'aggressive',
        fieldSetting: 'attacking',
        riskTolerance: 65
      };
    case 'adaptive':
      return {
        powerplayIntent: 'balanced',
        deathOverIntent: 'balanced',
        fieldSetting: 'neutral',
        riskTolerance: 55
      };
  }
}

export function selectBowlingOrder(players: Player[], tendency: TeamTendency, currentOver: number, totalOvers: number = 20): Player | null {
  const bowlers = players
    .filter(p => p.role === 'bowler' || p.role === 'allrounder')
    .filter(p => p.fatigue < 80)
    .sort((a, b) => b.stats.bowling - a.stats.bowling);
  
  if (bowlers.length === 0) return players[0] || null;
  
  const isPowerplay = currentOver < 6;
  const isDeath = currentOver >= 15;
  
  if (tendency.fieldSetting === 'defensive') {
    return bowlers.find(b => b.stats.bowling > 12) || bowlers[0];
  }
  
  if (isDeath && tendency.deathOverIntent === 'aggressive') {
    return bowlers.find(b => b.stats.bowling > 14) || bowlers[0];
  }
  
  if (isPowerplay && tendency.powerplayIntent === 'aggressive') {
    return bowlers.find(b => b.stats.bowling > 10) || bowlers[Math.floor(Math.random() * bowlers.length)];
  }
  
  return bowlers[Math.floor(Math.random() * Math.min(3, bowlers.length))];
}

export function selectBattingOrder(players: Player[], tendency: TeamTendency): string[] {
  const batsmen = players.filter(p => p.role === 'batsman' || p.role === 'wicketkeeper');
  const allrounders = players.filter(p => p.role === 'allrounder');
  
  if (tendency.riskTolerance > 70) {
    return [
      ...batsmen.slice(0, 2),
      ...allrounders.slice(0, 2),
      ...batsmen.slice(2),
      ...allrounders.slice(2)
    ].map(p => p.id);
  }
  
  return [
    ...batsmen.slice(0, 3),
    ...allrounders.slice(0, 2),
    ...batsmen.slice(3),
    ...allrounders.slice(2)
  ].map(p => p.id);
}

export function getAIIntent(tendency: TeamTendency, currentOver: number, totalOvers: number, requiredRR: number, ballsRemaining: number): 'defensive' | 'balanced' | 'aggressive' {
  if (currentOver < 6 && tendency.powerplayIntent !== 'balanced') {
    return tendency.powerplayIntent;
  }
  
  if (currentOver >= 15 && tendency.deathOverIntent !== 'balanced') {
    return tendency.deathOverIntent;
  }
  
  const currentRunRate = ballsRemaining > 0 ? (requiredRR * 6) / ballsRemaining : 0;
  const chaseNeeded = requiredRR > currentRunRate;
  
  if (chaseNeeded && tendency.riskTolerance > 60) {
    return 'aggressive';
  }
  
  if (!chaseNeeded && tendency.riskTolerance < 40) {
    return 'defensive';
  }
  
  return 'balanced';
}

export function generateAITeam(
  index: number,
  personality: TeamPersonality,
  playerPool: Player[]
): Team {
  const faction = (['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'] as const)[index % 6];
  const teamPlayers = playerPool
    .slice(index * 15, index * 15 + 15)
    .map(p => ({ ...p, isAvailable: false }));
  
  const tendency = createTeamTendency(personality);
  
  return {
    id: `ai_team_${index}`,
    name: PERSONALITY_NAMES[personality],
    coach: generateCoachName(faction),
    budget: 50000,
    players: teamPlayers,
    wins: 0,
    losses: 0,
    draws: 0,
    matchesPlayed: 0,
    runsFor: 0,
    runsAgainst: 0,
          isUserTeam: false,
          fanProfile: { homeAdvantage: 0, popularity: 50, revenue: 0, matchBonus: 0 },
          sponsorships: [],
          tournamentWins: 0,
          injuries: [],    personality,
    tendency
  };
}

export function generateUserTeam(playerPool: Player[]): Team {
  const teamPlayers = playerPool.slice(0, 15).map(p => ({ ...p, isAvailable: false }));
  const tendency = createTeamTendency('balanced');
  
  return {
    id: 'user_team',
    name: 'Your Team',
    coach: 'You',
    budget: 100000,
    players: teamPlayers,
    wins: 0,
    losses: 0,
    draws: 0,
    matchesPlayed: 0,
    runsFor: 0,
    runsAgainst: 0,
    isUserTeam: true,
    fanProfile: { homeAdvantage: 0, popularity: 50, revenue: 0, matchBonus: 0 },
    sponsorships: [],
    tournamentWins: 0,
    injuries: [],
    personality: 'balanced',
    tendency
  };
}

export const TEAM_PERSONALITIES: TeamPersonality[] = [
  'aggressive',    // Team 1: Thunder Strikers
  'defensive',    // Team 2: Iron Shield  
  'balanced',    // Team 3: Eleven Warriors
  'strategic',   // Team 4: Master Minds
  'adaptive',   // Team 5: Chameleons
  'aggressive', // Team 6: Another aggressive
  'defensive',  // Team 7: Another defensive
  'balanced'   // Team 8: Final balanced
];

export function getPersonalityColor(personality: TeamPersonality): string {
  switch (personality) {
    case 'aggressive': return 'var(--danger)';
    case 'defensive': return 'var(--info)';
    case 'balanced': return 'var(--accent-human)';
    case 'strategic': return 'var(--accent-elf)';
    case 'adaptive': return 'var(--accent-goblin)';
  }
}

export function getPersonalityIcon(personality: TeamPersonality): string {
  switch (personality) {
    case 'aggressive': return '🔥';
    case 'defensive': return '🛡️';
    case 'balanced': return '⚖️';
    case 'strategic': return '♟️';
    case 'adaptive': return '🦎';
  }
}