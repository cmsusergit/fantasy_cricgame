import type { Player } from './player';
import type { FactionType } from './faction';
import type { SponsorshipContract } from '../core/sponsorship';
import type { Injury } from '../core/injurySystem';
import type { FanProfile } from '../core/fanSystem';

export type TeamPersonality = 'aggressive' | 'defensive' | 'balanced' | 'strategic' | 'adaptive';

export interface TeamTendency {
  powerplayIntent: 'aggressive' | 'balanced' | 'defensive';
  deathOverIntent: 'aggressive' | 'balanced' | 'defensive';
  fieldSetting: 'attacking' | 'neutral' | 'defensive';
  riskTolerance: number; // 0-100
}

export interface Team {
  id: string;
  name: string;
  coach: string;
  logo?: string;
  budget: number;
  players: Player[];
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  runsFor: number;
  runsAgainst: number;
  isUserTeam: boolean;
  fanProfile: FanProfile;
  sponsorship: SponsorshipContract | null;
  injuries: Injury[];
  personality: TeamPersonality;
  tendency: TeamTendency;
  faction?: FactionType;
  playing11?: string[]; // Array of player IDs
  captain?: string; // Player ID
  wicketKeeper?: string; // Player ID
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  runsFor: number;
  runsAgainst: number;
  points: number;
  nrr: number;
}