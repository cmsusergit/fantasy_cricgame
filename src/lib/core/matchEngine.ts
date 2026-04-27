import type { IntentType, BallEvent, BallResult, innings } from '../models/match';
import { INTENT_MULTIPLIERS } from '../models/match';
import type { Player } from '../models/player';
import type { Team } from '../models/team';
import { FACTIONS } from '../models/faction';
import { getEffectiveStats } from '../models/player';
import { applyInjuryToPlayer, rollForInjury, type Injury } from './injurySystem';

export interface MatchConfig {
  totalOvers: number;
  matchSeed?: number;
  weather?: WeatherType;
  pitch?: PitchType;
}

export type WeatherType = 'sunny' | 'cloudy' | 'rain' | 'storm';
export type PitchType = 'flat' | 'balanced' | 'turning' | 'seaming' | 'bouncing';

const WEATHER_EFFECTS: Record<WeatherType, { batting: number; bowling: number; wicketChance: number }> = {
  sunny: { batting: 1.05, bowling: 0.95, wicketChance: 1.0 },
  cloudy: { batting: 1.0, bowling: 1.08, wicketChance: 1.0 },
  rain: { batting: 0.88, bowling: 1.15, wicketChance: 1.12 },
  storm: { batting: 0.80, bowling: 1.25, wicketChance: 1.25 }
};

const PITCH_EFFECTS: Record<PitchType, { batting: number; bowling: number; spin: number; seam: number }> = {
  flat: { batting: 1.08, bowling: 0.92, spin: 0.8, seam: 0.8 },
  balanced: { batting: 1.0, bowling: 1.0, spin: 1.0, seam: 1.0 },
  turning: { batting: 0.88, bowling: 1.20, spin: 1.4, seam: 0.7 },
  seaming: { batting: 0.92, bowling: 1.25, spin: 0.6, seam: 1.4 },
  bouncing: { batting: 0.96, bowling: 1.12, spin: 0.9, seam: 1.0 }
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRoll(range: number): number {
  return Math.floor(Math.random() * (range * 2 + 1)) - range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateWicketChance(
  batter: Player,
  bowler: Player,
  intent: IntentType,
  currentOver: number,
  totalOvers: number,
  weather: WeatherType = 'sunny',
  pitch: PitchType = 'balanced'
): number {
  const batterStats = getEffectiveStats(batter);
  const bowlerStats = getEffectiveStats(bowler);
  const faction = FACTIONS[batter.faction];
  const intentMult = INTENT_MULTIPLIERS[intent];
  const fatigueMult = 1 + (batter.fatigue / 100 * 0.2 * currentOver / totalOvers);
  
  const baseChance = 0.09;
  const techReduction = batterStats.technique * 0.0005;
  const bowlerBoost = bowlerStats.bowling * 0.0004;
  const weatherMod = WEATHER_EFFECTS[weather].wicketChance;
  
  const wicketChance = (baseChance * intentMult) + (faction.modifiers.fatigue * (batter.fatigue / 100) * 0.2 * fatigueMult) 
                   - techReduction + bowlerBoost;
  
  return clamp(wicketChance * weatherMod, 0.02, 0.16);
}

export function calculateShotQuality(
  batter: Player,
  bowler: Player,
  intent: IntentType,
  isLastOver: boolean,
  weather: WeatherType = 'sunny',
  pitch: PitchType = 'balanced',
  homeAdvantage: number = 0,
  bowlingEffort: number = 1.0
): number {
  const batterStats = getEffectiveStats(batter);
  const bowlerStats = getEffectiveStats(bowler);
  const weatherMod = WEATHER_EFFECTS[weather];
  const pitchMod = PITCH_EFFECTS[pitch];
  
  const fatigueFactor = 1 - (batter.fatigue / 350);
  const lastOverBonus = isLastOver ? 0.03 : 0;
  
  // Intent bonuses
  const battingIntentBonus = intent === 'aggressive' ? 0.08 : intent === 'defensive' ? -0.05 : 0;
  
  // Injury penalty for batter
  let injuryPenalty = 0;
  if ((batter as any).activeInjury) {
    const injury = (batter as any).activeInjury as Injury;
    injuryPenalty = injury.statPenalty * 0.8 * (injury.currentDay / injury.recoveryDays);
  }
  
  // Balanced formula from simulation
  const battingPower = (batterStats.batting * 0.22 + batterStats.power * 0.11) * fatigueFactor;
  const bowlingDefense = (bowlerStats.bowling * 0.09 + bowlerStats.technique * 0.04) * bowlingEffort;
  
  // Home advantage bonus
  const homeBonus = homeAdvantage * 0.015;
  
  const baseShot = (battingPower * weatherMod.batting * pitchMod.batting - bowlingDefense - injuryPenalty) * (1 + homeBonus + battingIntentBonus);
  
  // Reduced random roll (was 32, now 4)
  return clamp(baseShot * (1 + lastOverBonus) + randomRoll(4), -5, 35);
}

export const T20_RULES = {
  POWERPLAY_START: 0,
  POWERPLAY_END: 5,
  MANDATORY_CIRCLE_FIELDERS: 2,
  MAX_OUTSIDE_CIRCLE: 5,
  BOUNCER_LIMIT_PER_OVER: 2,
  NO_BALL_CHANCE: 0.02,
  WIDE_CHANCE: 0.025,
  FREE_HIT_AFTER_NO_BALL: true
};

export function determineBallResult(
  shotQuality: number,
  isFreeHit: boolean = false,
  isPowerplay: boolean = false
): { result: BallResult; runs: number } {
  let baseShotQuality = shotQuality;
  
  if (isFreeHit) {
    baseShotQuality += 3;
  }
  
  if (isPowerplay) {
    baseShotQuality += 2.5;
  }
  
  if (baseShotQuality > 20) {
    return { result: 'six', runs: 6 };
  } else if (baseShotQuality > 5) {
    return { result: 'four', runs: 4 };
  } else if (baseShotQuality > -3) {
    return { result: 'single', runs: 1 };
  } else {
    return { result: 'dot', runs: 0 };
  }
}

export function calculateNoBall(shotQuality: number): { isNoBall: boolean; runs: number; freeHit: boolean; commentary: string } {
  if (Math.random() < T20_RULES.NO_BALL_CHANCE) {
    return {
      isNoBall: true,
      runs: 1 + (shotQuality > 10 ? 1 : 0),
      freeHit: true,
      commentary: 'No ball! Free hit coming up...'
    };
  }
  return { isNoBall: false, runs: 0, freeHit: false, commentary: '' };
}

export function calculateWideBall(): { isWide: boolean; runs: number; commentary: string } {
  if (Math.random() < T20_RULES.WIDE_CHANCE) {
    return {
      isWide: true,
      runs: 1,
      commentary: 'Wide ball! Extra run, re-bowling...'
    };
  }
  return { isWide: false, runs: 0, commentary: '' };
}

export function isPowerplayOver(currentOver: number): boolean {
  return currentOver >= T20_RULES.POWERPLAY_START && currentOver <= T20_RULES.POWERPLAY_END;
}

const BOWLING_INTENT_EFFECT: Record<IntentType, number> = {
  defensive: 1.15,
  balanced: 1.0,
  aggressive: 0.85,
  very_aggressive: 0.7
};

export function resolveBall(
  batter: Player,
  bowler: Player,
  currentBalls: number,
  totalOvers: number,
  battingIntent: IntentType = 'balanced',
  weather: WeatherType = 'sunny',
  pitch: PitchType = 'balanced',
  homeAdvantage: number = 0,
  isFreeHit: boolean = false,
  bowlingIntent: IntentType = 'balanced',
  avoidSingles: boolean = false
): BallEvent {
  const ballNumber = currentBalls + 1;
  const currentOver = Math.floor(currentBalls / 6);
  const isLastOver = currentOver >= totalOvers - 1;
  const isPowerplay = isPowerplayOver(currentOver);
  
  const bowlingEffort = BOWLING_INTENT_EFFECT[bowlingIntent] || 1.0;

  const { isNoBall, runs: noBallRuns, freeHit, commentary: noBallCommentary } = calculateNoBall(calculateShotQuality(batter, bowler, battingIntent, isLastOver, weather, pitch, homeAdvantage, bowlingEffort));
  
  if (isNoBall) {
    return {
      ballNumber,
      over: currentOver,
      ball: ballNumber % 6 || 6,
      batsmanId: batter.id,
      bowlerId: bowler.id,
      result: 'noball',
      runs: noBallRuns,
      isWicket: false,
      commentary: noBallCommentary,
      isFreeHit: freeHit
    };
  }

  const { isWide, runs: wideRuns, commentary: wideCommentary } = calculateWideBall();
  
  if (isWide) {
    return {
      ballNumber,
      over: currentOver,
      ball: ballNumber % 6 || 6,
      batsmanId: batter.id,
      bowlerId: bowler.id,
      result: 'wide',
      runs: wideRuns,
      isWicket: false,
      commentary: wideCommentary
    };
  }

  const wicketChance = calculateWicketChance(batter, bowler, battingIntent, currentOver, totalOvers, weather, pitch) * bowlingEffort;

  if (Math.random() < wicketChance && !isFreeHit) {
    const wicketTypes = ['caught', 'bowled', 'lbw', 'run out', 'stumped'];
    const wicketType = wicketTypes[randomInt(0, wicketTypes.length - 1)];
    return {
      ballNumber,
      over: currentOver,
      ball: ballNumber % 6 || 6,
      batsmanId: batter.id,
      bowlerId: bowler.id,
      result: 'wicket',
      runs: 0,
      isWicket: true,
      commentary: `${batter.name} is out! ${wicketType}`,
      wicketType
    };
  }

  const shotQuality = calculateShotQuality(batter, bowler, battingIntent, isLastOver, weather, pitch, homeAdvantage, bowlingEffort);
  let { result, runs } = determineBallResult(shotQuality, isFreeHit, isPowerplay);

  if (avoidSingles && result === 'single') {
    result = 'dot';
    runs = 0;
  }

  let commentary = '';
  switch (result) {
    case 'six':
      commentary = `${batter.name} launches it over the boundary! 6 runs!`;
      break;
    case 'four':
      commentary = `${batter.name} finds the gap! 4 runs!`;
      break;
    case 'single':
      commentary = `${batter.name} takes a quick single`;
      break;
    case 'dot':
      commentary = avoidSingles && runs === 0 && shotQuality > -3 
        ? `${batter.name} plays it to the fielder and declines the single to keep strike.` 
        : `Dot ball! ${bowler.name} bowls a tight one`;
      break;
  }

  return {
    ballNumber,
    over: currentOver,
    ball: ballNumber % 6 || 6,
    batsmanId: batter.id,
    bowlerId: bowler.id,
    result,
    runs,
    isWicket: false,
    commentary,
    isPowerplay
  };
}

export function updateFatigueAndMorale(
  batter: Player,
  bowler: Player,
  ballResult: BallResult,
  morale: number = 50
): { batterFatigue: number; batterMorale: number; bowlerFatigue: number; bowlerMorale: number } {
  let batterFatigue = 0.3;
  let batterMorale = 0;
  let bowlerFatigue = 0.2;
  let bowlerMorale = 0;
  
  // Morale affects performance
  const moraleMod = morale > 70 ? 1.08 : morale < 30 ? 0.92 : 1.0;

  if (ballResult === 'six' || ballResult === 'four') {
    batterMorale = 6 * moraleMod;
    bowlerMorale = -4;
    batterFatigue = 0.35;
  } else if (ballResult === 'single') {
    batterMorale = 2;
    batterFatigue = 0.2;
  } else if (ballResult === 'dot') {
    bowlerMorale = 5;
  }

  return {
    batterFatigue,
    batterMorale,
    bowlerFatigue,
    bowlerMorale
  };
}

export function calculateRunRate(innings: innings): number {
  if (innings.balls === 0) return 0;
  const totalBalls = innings.overs * 6 + innings.balls;
  return (innings.totalRuns / totalBalls) * 6;
}

export function calculateRequiredRunRate(
  target: number,
  currentRuns: number,
  ballsRemaining: number
): number {
  if (ballsRemaining <= 0) return 0;
  const runsNeeded = target - currentRuns;
  return (runsNeeded / ballsRemaining) * 6;
}

export function randomWeather(): WeatherType {
  const weather = ['sunny', 'cloudy', 'rain', 'storm'];
  const weights = [0.40, 0.30, 0.20, 0.10];
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return weather[i] as WeatherType;
  }
  return 'sunny';
}

export function randomPitch(): PitchType {
  const pitch = ['flat', 'balanced', 'turning', 'seaming', 'bouncing'];
  const weights = [0.15, 0.35, 0.20, 0.20, 0.10];
  const roll = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return pitch[i] as PitchType;
  }
  return 'balanced';
}

export { WEATHER_EFFECTS, PITCH_EFFECTS };

export interface MatchResult {
  winner: 'team1' | 'team2' | 'draw';
  team1Runs: number;
  team2Runs: number;
  team1Wickets: number;
  team2Wickets: number;
  sponsorshipEarnings: { team1: number; team2: number };
  injuries: Array<{ playerId: string; playerName: string; type: string }>;
  fanUpdates: { team1: { popularity: number; homeAdvantage: number }; team2: { popularity: number; homeAdvantage: number } };
  playerOfTheMatch: { id: string; name: string; teamId: string; stats: string } | null;
}

import { calculateSponsorshipEarnings, updateSponsorship } from './sponsorship';
import { updatePopularity, calculateHomeAdvantage } from './fanSystem';

export function resolveMatch(
  team1: Team,
  team2: Team,
  innings1: innings,
  innings2: innings,
  homeTeamId: string | null
): MatchResult {
  const winner: 'team1' | 'team2' | 'draw' = 
    innings2.totalRuns > innings1.totalRuns ? 'team2' : 
    innings2.totalRuns < innings1.totalRuns ? 'team1' : 'draw';
  
  const team1Won = winner === 'team1';
  const team2Won = winner === 'team2';
  
  // Sponsorship earnings
  let team1Earnings = 0;
  let team2Earnings = 0;
  
  if (team1.sponsorship && team1.sponsorship.active) {
    const result: 'win' | 'loss' | 'draw' = team1Won ? 'win' : team2Won ? 'loss' : 'draw';
    team1Earnings = calculateSponsorshipEarnings(
      team1.sponsorship,
      result,
      innings1.totalRuns,
      innings2.wickets
    );
    team1.sponsorship = updateSponsorship(team1.sponsorship, team1Earnings);
  }
  
  if (team2.sponsorship && team2.sponsorship.active) {
    const result: 'win' | 'loss' | 'draw' = team2Won ? 'win' : team1Won ? 'loss' : 'draw';
    team2Earnings = calculateSponsorshipEarnings(
      team2.sponsorship,
      result,
      innings2.totalRuns,
      innings1.wickets
    );
    team2.sponsorship = updateSponsorship(team2.sponsorship, team2Earnings);
  }
  
  // Injury rolls - check random injuries after match
  const injuryRolls = rollForInjury();
  const team1Injuries: Array<{ playerId: string; playerName: string; type: string }> = [];
  const team2Injuries: Array<{ playerId: string; playerName: string; type: string }> = [];
  
  if (injuryRolls && team1.players.length > 0) {
    const randomPlayer = team1.players[Math.floor(Math.random() * Math.min(5, team1.players.length))];
    const injury = { ...injuryRolls, playerId: randomPlayer.id, playerName: randomPlayer.name };
    team1Injuries.push({ playerId: injury.playerId, playerName: injury.playerName, type: injury.type });
  }
  
  const injuryRolls2 = rollForInjury();
  if (injuryRolls2 && team2.players.length > 0) {
    const randomPlayer = team2.players[Math.floor(Math.random() * Math.min(5, team2.players.length))];
    const injury = { ...injuryRolls2, playerId: randomPlayer.id, playerName: randomPlayer.name };
    team2Injuries.push({ playerId: injury.playerId, playerName: injury.playerName, type: injury.type });
  }
  
  // Fan/popularity updates
  const team1Result: 'win' | 'loss' | 'draw' = team1Won ? 'win' : team2Won ? 'loss' : 'draw';
  const team2Result: 'win' | 'loss' | 'draw' = team2Won ? 'win' : team1Won ? 'loss' : 'draw';
  
  const team1NewPopularity = updatePopularity(team1.fanProfile?.popularity || 50, team1Result, innings1.totalRuns);
  const team2NewPopularity = updatePopularity(team2.fanProfile?.popularity || 50, team2Result, innings2.totalRuns);
  
  const team1HomeAdvantage = homeTeamId === team1.id ? calculateHomeAdvantage(team1NewPopularity) : 0;
  const team2HomeAdvantage = homeTeamId === team2.id ? calculateHomeAdvantage(team2NewPopularity) : 0;
  
  return {
    winner,
    team1Runs: innings1.totalRuns,
    team2Runs: innings2.totalRuns,
    team1Wickets: innings1.wickets,
    team2Wickets: innings2.wickets,
    sponsorshipEarnings: { team1: team1Earnings, team2: team2Earnings },
    injuries: [...team1Injuries, ...team2Injuries],
    fanUpdates: {
      team1: { popularity: team1NewPopularity, homeAdvantage: team1HomeAdvantage },
      team2: { popularity: team2NewPopularity, homeAdvantage: team2HomeAdvantage }
    },
    playerOfTheMatch: null
  };
}