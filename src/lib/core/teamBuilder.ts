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
    return bowlers.find(b => b.stats.bowling > 60) || bowlers[0];
  }
  
  if (isDeath && tendency.deathOverIntent === 'aggressive') {
    return bowlers.find(b => b.stats.bowling > 70) || bowlers[0];
  }
  
  if (isPowerplay && tendency.powerplayIntent === 'aggressive') {
    return bowlers.find(b => b.stats.bowling > 50) || bowlers[Math.floor(Math.random() * bowlers.length)];
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
    budget: 4000000,
    operatingBudget: 1000000,
    players: teamPlayers,
    staff: [],
    facilities: { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
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
    tendency,
    colorPrimary: '#0969da',
    colorSecondary: '#24292f'
  };
}

export function generateUserTeam(playerPool: Player[]): Team {
  const teamPlayers = playerPool.slice(0, 15).map(p => ({ ...p, isAvailable: false }));
  const tendency = createTeamTendency('balanced');
  
  return {
    id: 'user_team',
    name: 'Your Team',
    coach: 'You',
    budget: 4000000,
    operatingBudget: 1000000,
    players: teamPlayers,
    staff: [],
    facilities: { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
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
    tendency,
    colorPrimary: '#0969da',
    colorSecondary: '#24292f'
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

export function calculateTeamStrength(team: Team): { batting: number; bowling: number; fielding: number; overall: number; stars: number } {
  if (!team.players || team.players.length === 0) {
    return { batting: 0, bowling: 0, fielding: 0, overall: 0, stars: 1 };
  }

  // Get best 11 players by overall stat sum roughly
  const sortedPlayers = [...team.players].sort((a, b) => {
    const aTotal = a.stats.batting + a.stats.bowling + a.stats.technique + a.stats.power;
    const bTotal = b.stats.batting + b.stats.bowling + b.stats.technique + b.stats.power;
    return bTotal - aTotal;
  });
  
  const top11 = sortedPlayers.slice(0, 11);
  
  let battingTotal = 0;
  let bowlingTotal = 0;
  let fieldingTotal = 0;

  top11.forEach(p => {
    // Focus on primary skills for the role, but just sum stats for simplicity
    battingTotal += p.stats.batting * 0.6 + p.stats.power * 0.4;
    bowlingTotal += p.stats.bowling;
    fieldingTotal += p.stats.fielding || 60;
  });

  const avgBatting = battingTotal / 11;
  const avgBowling = bowlingTotal / 11;
  const avgFielding = fieldingTotal / 11;

  const overall = (avgBatting * 0.4 + avgBowling * 0.4 + avgFielding * 0.2);
  
  let stars = Math.round((overall - 30) / 10);
  if (stars < 1) stars = 1;
  if (stars > 5) stars = 5;

  return {
    batting: Math.round(avgBatting),
    bowling: Math.round(avgBowling),
    fielding: Math.round(avgFielding),
    overall: Math.round(overall),
    stars
  };
}