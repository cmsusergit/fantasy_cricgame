import type { FactionType } from './faction';
import { FACTIONS } from './faction';

export type PlayerRole = 'batsman' | 'allrounder' | 'bowler' | 'wicketkeeper';

export interface PlayerStats {
  batting: number;
  bowling: number;
  power: number;
  technique: number;
  fielding: number;
}

export interface PlayerSpecial {
  isCaptain: boolean;
  captainBonus: number;  // -5 to +5 strategic bonus
  isWicketKeeper: boolean;
  wkBonus: number;       // +handling skill
}

export type BowlingType = 'pacer' | 'fast' | 'swinger' | 'spinner' | 'none';
export type BattingType = 'RHB' | 'LHB';
export type BattingRole = 'Top Order' | 'Middle Order' | 'Finisher' | 'Tail Ender';

export interface Player {
  id: string;
  name: string;
  originalName?: string;
  role: PlayerRole;
  bowlingType: BowlingType;
  battingType?: BattingType;
  battingRole?: BattingRole;
  faction: FactionType;
  stats: PlayerStats;
  special: PlayerSpecial;
  fatigue: number;
  morale: number;
  isAvailable: boolean;
  price: number;
  form: number;        // -10 to +10 recent form
  matches: number;    // career matches
  runsScored: number; // career runs
  wickets: number;   // career wickets
  catches: number;   // career catches
  
  // Season Transition & Economy
  age: number;
  marketValue: number;
  potential: number;
  isScouted: boolean;
  retiring?: boolean;
  portraitId: number;
  tournamentStats?: {
    runs: number;
    wickets: number;
    catches: number;
  };
  activeInjury?: any | null; // We use any or a forward declared interface to prevent cycle dependencies
  isInjured?: boolean;
  xp: number;
  lifetimeXp?: number;
}

// Base stats for 180-200 average runs on the 20-100 scale
export function createBasePlayerStats(role: PlayerRole): PlayerStats {
  const base = {
    batsman: { batting: 60, bowling: 15, power: 50, technique: 60, fielding: 60 },
    allrounder: { batting: 50, bowling: 50, power: 40, technique: 40, fielding: 70 },
    bowler: { batting: 15, bowling: 70, power: 25, technique: 25, fielding: 50 },
    wicketkeeper: { batting: 50, bowling: 10, power: 40, technique: 70, fielding: 80 }
  };
  return base[role];
}

export function getEffectiveStats(player: Player): PlayerStats {
  const faction = FACTIONS[player.faction];
  let batting = player.stats.batting * faction.modifiers.tech;
  let power = player.stats.power * faction.modifiers.power;
  let technique = player.stats.technique * faction.modifiers.tech;
  
  // Apply form modifier (-10 to +10 = 0.9 to 1.1)
  const formMod = 1 + (player.form / 50);
  batting *= formMod;
  power *= formMod;
  
  // Apply captain bonus
  if (player.special.isCaptain) {
    technique += player.special.captainBonus;
    batting += player.special.captainBonus * 0.5;
  }
  
  // Apply WK bonus for keeping
  if (player.special.isWicketKeeper) {
    technique += player.special.wkBonus;
  }
  
  return {
    batting: Math.round(batting),
    bowling: player.stats.bowling,
    power: Math.round(power),
    technique: Math.round(technique),
    fielding: player.stats.fielding
  };
}

export function createDefaultSpecial(): PlayerSpecial {
  return {
    isCaptain: false,
    captainBonus: 0,
    isWicketKeeper: false,
    wkBonus: 0
  };
}

export function getFactionMultipliers(faction: FactionType): { tech: number; power: number; fatigue: number } {
  return FACTIONS[faction].modifiers;
}
