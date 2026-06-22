import type { Player } from './player';
import type { FactionType } from './faction';
import type { SponsorshipContract } from '../core/sponsorship';
import type { Injury } from '../core/injurySystem';
import type { FanProfile } from '../core/fanSystem';

import type { StaffMember, TeamFacilities } from './staff';

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
  staff: StaffMember[];
  facilities: TeamFacilities;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  runsFor: number;
  runsAgainst: number;
  isUserTeam: boolean;
  fanProfile: FanProfile;
  sponsorships: SponsorshipContract[];
  tournamentWins: number;
  injuries: Injury[];
  personality: TeamPersonality;
  tendency: TeamTendency;
  faction?: FactionType;
  colorPrimary: string;
  colorSecondary: string;
  playing11?: string[]; // Array of player IDs
  captain?: string; // Player ID
  wicketKeeper?: string; // Player ID
  reservePlayer?: string; // Player ID
  retainedPlayers?: string[]; // Array of player IDs retained for next season
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