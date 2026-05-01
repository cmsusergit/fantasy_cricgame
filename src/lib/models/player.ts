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
}

// Lower base stats to target 180-200 average runs
export function createBasePlayerStats(role: PlayerRole): PlayerStats {
  const base = {
    batsman: { batting: 12, bowling: 5, power: 10, technique: 12, fielding: 12 },
    allrounder: { batting: 10, bowling: 10, power: 8, technique: 8, fielding: 14 },
    bowler: { batting: 5, bowling: 14, power: 9, technique: 8, fielding: 10 },
    wicketkeeper: { batting: 10, bowling: 4, power: 8, technique: 14, fielding: 16 }
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

export function getFactionMultipliers(faction: FactionType): { tech: number; power: number } {
  return FACTIONS[faction].modifiers;
}