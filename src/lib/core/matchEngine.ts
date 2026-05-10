import type { IntentType, BallEvent, BallResult, innings, BallType } from '../models/match';
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
  pitch: PitchType = 'balanced',
  bowlingIntent: IntentType = 'balanced'
): number {
  const batterStats = getEffectiveStats(batter);
  const bowlerStats = getEffectiveStats(bowler);
  
  // Apply Stat Synergies
  if (batter.faction === 'human' && intent === 'balanced') batterStats.technique += 10;
  if (bowler.faction === 'human' && (bowlingIntent === 'balanced' || bowlingIntent === 'defensive') && currentOver < 6) bowlerStats.bowling += 10;
  if (batter.faction === 'nightelf' && intent === 'aggressive') batterStats.power = batterStats.technique;
  if (bowler.faction === 'nightelf' && currentOver >= 16) bowlerStats.bowling *= 1.15;
  if (bowler.faction === 'goblin' && bowlingIntent === 'aggressive' && bowler.bowlingType === 'spinner') bowlerStats.bowling += 20;

  const faction = FACTIONS[batter.faction];
  let intentMult = INTENT_MULTIPLIERS[intent];
  
  // Elven Synergy: Masterful Defense
  if (batter.faction === 'elf' && (intent === 'defensive' || intent === 'very_defensive')) {
    intentMult *= 0.6; // Even lower wicket chance when playing defensively
  }

  let batterFatigue = batter.fatigue;
  if (batter.faction === 'dwarf' && currentOver >= 16 && (intent === 'aggressive' || intent === 'very_aggressive')) batterFatigue = 0;

  const fatigueMult = 1 + (batterFatigue / 100 * 0.2 * currentOver / totalOvers);
  
  // Morale modifiers
  const batterMoraleMod = 1 + ((batter.morale - 50) / 100) * 0.20;
  const bowlerMoraleMod = 1 + ((bowler.morale - 50) / 100) * 0.20;
  
  const baseChance = 0.07;
  const techReduction = (batterStats.technique * batterMoraleMod) * 0.00012;
  const synergyMult = getPitchSynergyMultiplier(bowler.bowlingType, pitch);
  const bowlerBoost = (bowlerStats.bowling * bowlerMoraleMod * synergyMult) * 0.00007;
  const weatherMod = WEATHER_EFFECTS[weather].wicketChance;
  
  const wicketChance = (baseChance * intentMult) + (faction.modifiers.fatigue * (batterFatigue / 100) * 0.2 * fatigueMult) 
                   - techReduction + bowlerBoost;
  
  return clamp(wicketChance * weatherMod, 0.02, 0.16);
}

export function getPitchSynergyMultiplier(bowlingType: string, pitch: PitchType): number {
  if (pitch === 'flat') return 0.90;
  
  if (pitch === 'turning') {
      if (bowlingType === 'spinner') return 1.20;
      if (bowlingType === 'fast' || bowlingType === 'pacer') return 0.95;
  }
  if (pitch === 'seaming') {
      if (bowlingType === 'swinger') return 1.15;
      if (bowlingType === 'pacer') return 1.05;
  }
  if (pitch === 'bouncing') {
      if (bowlingType === 'fast' || bowlingType === 'pacer') return 1.15;
      if (bowlingType === 'spinner') return 0.95;
  }
  
  return 1.0;
}

export function calculateShotQuality(
  batter: Player,
  bowler: Player,
  intent: IntentType,
  isLastOver: boolean,
  weather: WeatherType = 'sunny',
  pitch: PitchType = 'balanced',
  homeAdvantage: number = 0,
  bowlingEffort: number = 1.0,
  currentOver: number = 0,
  bowlingIntent: IntentType = 'balanced'
): number {
  const batterStats = getEffectiveStats(batter);
  const bowlerStats = getEffectiveStats(bowler);
  
  // Apply Stat Synergies
  if (batter.faction === 'human' && intent === 'balanced') batterStats.technique += 10;
  if (bowler.faction === 'human' && (bowlingIntent === 'balanced' || bowlingIntent === 'defensive') && currentOver < 6) bowlerStats.bowling += 10;
  if (batter.faction === 'nightelf' && intent === 'aggressive') batterStats.power = batterStats.technique;
  if (bowler.faction === 'nightelf' && currentOver >= 16) bowlerStats.bowling *= 1.15;
  if (bowler.faction === 'goblin' && bowlingIntent === 'aggressive' && bowler.bowlingType === 'spinner') bowlerStats.bowling += 20;

  const weatherMod = WEATHER_EFFECTS[weather];
  const pitchMod = PITCH_EFFECTS[pitch];
  
  // Morale modifiers
  const batterMoraleMod = 1 + ((batter.morale - 50) / 100) * 0.20;
  const bowlerMoraleMod = 1 + ((bowler.morale - 50) / 100) * 0.20;

  const synergyMult = getPitchSynergyMultiplier(bowler.bowlingType, pitch);
  const effectiveBowling = bowlerStats.bowling * bowlerMoraleMod * synergyMult;
  
  let batterFatigue = batter.fatigue;
  let bowlerFatigue = bowler.fatigue;
  if (batter.faction === 'dwarf' && currentOver >= 16 && (intent === 'aggressive' || intent === 'very_aggressive')) batterFatigue = 0;
  if (bowler.faction === 'dwarf' && (bowlingIntent === 'aggressive' || bowlingIntent === 'very_aggressive')) bowlerFatigue = Math.max(0, bowlerFatigue - 20);

  const fatigueFactor = 1 - (batterFatigue / 350);
  const lastOverBonus = isLastOver ? 0.03 : 0;
  
  // Intent bonuses
  let battingIntentBonus = intent === 'aggressive' ? 0.08 : intent === 'defensive' ? -0.05 : 0;
  if (intent === 'very_aggressive') battingIntentBonus = 0.15;
  if (intent === 'very_defensive') battingIntentBonus = -0.10;
  
  // Orcish Synergy: Brutal Aggression
  if (batter.faction === 'orc' && (intent === 'aggressive' || intent === 'very_aggressive')) {
    battingIntentBonus *= 1.5; // Huge boost to boundary hitting when slogging
  }
  
  // Injury penalty for batter
  let injuryPenalty = 0;
  if ((batter as any).activeInjury) {
    const injury = (batter as any).activeInjury as Injury;
    injuryPenalty = injury.statPenalty * 0.8 * (injury.currentDay / injury.recoveryDays);
  }

  // Bowling type and technique interaction
  let typeAdvantage = 0;
  if (bowler.bowlingType === 'spinner' && pitch === 'turning') typeAdvantage = 2.5;
  if (bowler.bowlingType === 'pacer' && pitch === 'seaming') typeAdvantage = 2.0;
  if (bowler.bowlingType === 'fast' && pitch === 'bouncing') typeAdvantage = 2.0;
  if (bowler.bowlingType === 'swinger' && weather === 'cloudy') typeAdvantage = 2.5;

  const techMitigation = batterStats.technique * batterMoraleMod * 0.016;
  const netTypeAdvantage = Math.max(0, typeAdvantage - techMitigation);
  
  // Balanced formula from simulation
  const battingPower = (batterStats.batting * 0.055 + batterStats.power * 0.028) * batterMoraleMod * fatigueFactor;
  const bowlingDefense = (effectiveBowling * 0.018 + bowlerStats.technique * bowlerMoraleMod * 0.008) * bowlingEffort + netTypeAdvantage;
  
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

export function calculateWideBall(chanceMultiplier: number = 1.0): { isWide: boolean; runs: number; commentary: string } {
  if (Math.random() < T20_RULES.WIDE_CHANCE * chanceMultiplier) {
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
  very_defensive: 1.3,
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
  avoidSingles: boolean = false,
  fieldingAverage: number = 60,
  ballType: BallType = 'normal'
): BallEvent {
  const ballNumber = currentBalls + 1;
  const currentOver = Math.floor(currentBalls / 6);
  const isLastOver = currentOver >= totalOvers - 1;
  const isPowerplay = isPowerplayOver(currentOver);
  
  let bowlingEffort = BOWLING_INTENT_EFFECT[bowlingIntent] || 1.0;
  
  // Orcish Synergy: Intimidation
  if (bowler.faction === 'orc' && (bowlingIntent === 'aggressive' || bowlingIntent === 'very_aggressive')) {
    bowlingEffort *= 1.25; // Massive boost to bowling quality, but we will increase extras chance later
  }
  let ballTypeEffect = 1.0;

  // Apply ball type specific effects
  switch (ballType) {
      case 'yorker':
          ballTypeEffect *= 1.2; // More likely to get wickets, less likely to go for runs
          break;
      case 'bouncer':
          ballTypeEffect *= 1.1; // More aggressive, higher chance of wicket or boundary
          break;
      case 'slower':
          ballTypeEffect *= 1.15; // Deceptive, can cause mishits
          break;
      case 'inswinger':
      case 'outswinger':
          ballTypeEffect *= 1.1; // Movement can trouble batsmen
          break;
      case 'off_spin':
      case 'leg_spin':
      case 'googly':
      case 'doosra':
      case 'arm_ball':
          ballTypeEffect *= 1.25; // Spin variations can be very effective
          break;
      default:
          ballTypeEffect = 1.0;
  }
  const finalBowlingEffort = bowlingEffort * ballTypeEffect;

  const { isNoBall, runs: noBallRuns, freeHit, commentary: noBallCommentary } = calculateNoBall(calculateShotQuality(batter, bowler, battingIntent, isLastOver, weather, pitch, homeAdvantage, finalBowlingEffort, currentOver, bowlingIntent));
  
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

  let wideChanceMult = 1.0;
  if (bowler.faction === 'orc' && (bowlingIntent === 'aggressive' || bowlingIntent === 'very_aggressive')) {
      wideChanceMult = 2.0; // Double chance of bowling a wide when bowling aggressively as an Orc
  }
  const { isWide, runs: wideRuns, commentary: wideCommentary } = calculateWideBall(wideChanceMult);
  
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

    if (wicketType === 'caught' || wicketType === 'run out') {
      const dropChance = Math.max(0.02, 0.25 - (fieldingAverage * 0.003)); // Higher fielding = lower drop chance
      
      if (Math.random() < dropChance) {
         // Dropped!
         const dropRuns = randomInt(1, 2);
         return {
            ballNumber,
            over: currentOver,
            ball: ballNumber % 6 || 6,
            batsmanId: batter.id,
            bowlerId: bowler.id,
            result: dropRuns === 1 ? 'single' : 'dot', // Simplify result mapping
            runs: dropRuns,
            isWicket: false,
            commentary: `${wicketType === 'caught' ? 'Dropped catch!' : 'Missed run out!'} They scrambled for ${dropRuns} run${dropRuns > 1 ? 's' : ''}.`,
            isPowerplay
         };
      }
    }

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

  const shotQuality = calculateShotQuality(batter, bowler, battingIntent, isLastOver, weather, pitch, homeAdvantage, bowlingEffort, currentOver, bowlingIntent);
  let { result, runs } = determineBallResult(shotQuality, isFreeHit, isPowerplay);

  // Goblin Synergy: Cheeky Thieves
  if (batter.faction === 'goblin' && battingIntent === 'defensive' && result === 'dot') {
    result = 'single';
    runs = 1;
  }

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
  let batterMorale = 0; // Morale is now handled post-match
  let bowlerFatigue = 0.2;
  let bowlerMorale = 0; // Morale is now handled post-match
  
  if (ballResult === 'six' || ballResult === 'four') {
    batterFatigue = 0.35;
  } else if (ballResult === 'single') {
    batterFatigue = 0.2;
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
  matchEarnings: { team1: number; team2: number };
  operatingEarnings: { team1: number; team2: number };
  potmReward: number;
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
  
  if (team1.sponsorships && team1.sponsorships.length > 0) {
    const result: 'win' | 'loss' | 'draw' = team1Won ? 'win' : team2Won ? 'loss' : 'draw';
    team1.sponsorships = team1.sponsorships.map(sponsor => {
      if (!sponsor.active) return sponsor;
      const earnings = calculateSponsorshipEarnings(sponsor, result, innings1.totalRuns, innings2.wickets);
      team1Earnings += earnings;
      return updateSponsorship(sponsor, earnings);
    });
  }
  
  if (team2.sponsorships && team2.sponsorships.length > 0) {
    const result: 'win' | 'loss' | 'draw' = team2Won ? 'win' : team1Won ? 'loss' : 'draw';
    team2.sponsorships = team2.sponsorships.map(sponsor => {
      if (!sponsor.active) return sponsor;
      const earnings = calculateSponsorshipEarnings(sponsor, result, innings2.totalRuns, innings1.wickets);
      team2Earnings += earnings;
      return updateSponsorship(sponsor, earnings);
    });
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
  
  // Calculate Base Match Fees and Win Rewards
  let matchEarningsTeam1 = 10000; // Base participation fee
  let matchEarningsTeam2 = 10000;
  if (team1Won) matchEarningsTeam1 += 50000; // Win bonus
  if (team2Won) matchEarningsTeam2 += 50000;
  
  let operatingEarningsTeam1 = 0;
  let operatingEarningsTeam2 = 0;
  if (homeTeamId === team1.id) {
    const stadiumLvl = team1.facilities?.stadiumLevel || 1;
    operatingEarningsTeam1 = 50000 * stadiumLvl;
  } else if (homeTeamId === team2.id) {
    const stadiumLvl = team2.facilities?.stadiumLevel || 1;
    operatingEarningsTeam2 = 50000 * stadiumLvl;
  }
  
  // Calculate POTM (Simple approximation: 1 run = 1 pt, 1 wicket = 25 pts)
  const playerPoints: Record<string, number> = {};
  const playerNames: Record<string, string> = {};
  const playerTeam: Record<string, string> = {};
  
  const processInningsForPOTM = (inn: innings, battingTeam: Team, bowlingTeam: Team) => {
      inn.ballsFaced.forEach(ball => {
          if (!playerPoints[ball.batsmanId]) {
              playerPoints[ball.batsmanId] = 0;
              const b = battingTeam.players.find(p => p.id === ball.batsmanId);
              if (b) { playerNames[ball.batsmanId] = b.name; playerTeam[ball.batsmanId] = battingTeam.id; }
          }
          if (ball.result !== 'wide' && ball.result !== 'noball') {
              playerPoints[ball.batsmanId] += ball.runs;
          }
          if (ball.isWicket && ball.result !== 'noball') { // Rough check
              if (!playerPoints[ball.bowlerId]) {
                  playerPoints[ball.bowlerId] = 0;
                  const b = bowlingTeam.players.find(p => p.id === ball.bowlerId);
                  if (b) { playerNames[ball.bowlerId] = b.name; playerTeam[ball.bowlerId] = bowlingTeam.id; }
              }
              playerPoints[ball.bowlerId] += 25;
          }
      });
  };
  
  processInningsForPOTM(innings1, team1, team2);
  processInningsForPOTM(innings2, team2, team1);
  
  let bestPlayerId: string | null = null;
  let highestPoints = -1;
  for (const [id, points] of Object.entries(playerPoints)) {
      if (points > highestPoints) {
          highestPoints = points;
          bestPlayerId = id;
      }
  }
  
  let playerOfTheMatch = null;
  let potmReward = 0;
  if (bestPlayerId && highestPoints > 0) {
      playerOfTheMatch = {
          id: bestPlayerId,
          name: playerNames[bestPlayerId] || 'Unknown',
          teamId: playerTeam[bestPlayerId],
          stats: `${highestPoints} impact points`
      };
      potmReward = 10000;
  }
  
  postMatchMoraleUpdate(team1, team2, innings1, innings2, winner);
  
  return {
    winner,
    team1Runs: innings1.totalRuns,
    team2Runs: innings2.totalRuns,
    team1Wickets: innings1.wickets,
    team2Wickets: innings2.wickets,
    sponsorshipEarnings: { team1: team1Earnings, team2: team2Earnings },
    matchEarnings: { team1: matchEarningsTeam1, team2: matchEarningsTeam2 },
    operatingEarnings: { team1: operatingEarningsTeam1, team2: operatingEarningsTeam2 },
    potmReward,
    injuries: [...team1Injuries, ...team2Injuries],
    fanUpdates: {
      team1: { popularity: team1NewPopularity, homeAdvantage: team1HomeAdvantage },
      team2: { popularity: team2NewPopularity, homeAdvantage: team2HomeAdvantage }
    },
    playerOfTheMatch
  };
}

export function postMatchMoraleUpdate(
  team1: Team,
  team2: Team,
  innings1: innings,
  innings2: innings,
  winner: 'team1' | 'team2' | 'draw'
) {
  const processTeamMorale = (team: Team, isWin: boolean, isDraw: boolean, teamInnings: innings, bowlingInnings: innings) => {
    const playing11 = team.playing11 && team.playing11.length === 11 ? team.playing11 : team.players.slice(0, 11).map(p => p.id);
    const playedSet = new Set(playing11);

    const matchStats: Record<string, { runs: number, balls: number, wickets: number, runsConceded: number, oversBowled: number, isOut: boolean }> = {};
    playing11.forEach(id => matchStats[id] = { runs: 0, balls: 0, wickets: 0, runsConceded: 0, oversBowled: 0, isOut: false });

    teamInnings.ballsFaced.forEach(b => {
       if (matchStats[b.batsmanId]) {
          if (b.result !== 'wide') {
              matchStats[b.batsmanId].runs += b.runs;
              matchStats[b.batsmanId].balls += 1;
          }
          if (b.isWicket) matchStats[b.batsmanId].isOut = true;
       }
    });

    const ballsBowled: Record<string, number> = {};
    bowlingInnings.ballsFaced.forEach(b => {
       if (matchStats[b.bowlerId]) {
           matchStats[b.bowlerId].runsConceded += b.runs;
           if (b.result !== 'wide' && b.result !== 'noball') {
               ballsBowled[b.bowlerId] = (ballsBowled[b.bowlerId] || 0) + 1;
           }
           if (b.isWicket && b.wicketType !== 'run out') {
               matchStats[b.bowlerId].wickets += 1;
           }
       }
    });
    for (const [id, balls] of Object.entries(ballsBowled)) {
        if (matchStats[id]) matchStats[id].oversBowled = balls / 6;
    }

    team.players.forEach(player => {
        let moraleChange = 0;
        if (playedSet.has(player.id)) {
            // Base match result
            if (isWin) moraleChange += 5;
            else if (!isDraw) moraleChange -= 5;

            const stats = matchStats[player.id];
            
            // Batting performance
            if (stats.runs >= 50) moraleChange += 10;
            else if (stats.runs >= 30) moraleChange += 5;
            
            const sr = stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0;
            if (stats.runs > 10 && sr > 150) moraleChange += 5;
            if (stats.isOut && stats.runs === 0) moraleChange -= 10; // Duck
            else if (stats.isOut && stats.runs < 10 && stats.balls >= 10 && sr < 100) moraleChange -= 5; // Slow low score

            // Bowling performance
            if (stats.wickets >= 3) moraleChange += 10;
            else if (stats.wickets >= 2) moraleChange += 5;
            
            const econ = stats.oversBowled > 0 ? stats.runsConceded / stats.oversBowled : 0;
            if (stats.oversBowled >= 2 && econ < 6.0) moraleChange += 5;
            if (stats.oversBowled >= 2 && stats.wickets === 0 && econ > 10.0) moraleChange -= 10;
        } else {
            // Regression towards 50 for non-playing
            if (player.morale > 50) moraleChange = -2;
            else if (player.morale < 50) moraleChange = +2;
        }

        player.morale = clamp(player.morale + moraleChange, 0, 100);
    });
  };

  processTeamMorale(team1, winner === 'team1', winner === 'draw', innings1, innings2);
  processTeamMorale(team2, winner === 'team2', winner === 'draw', innings2, innings1);
}