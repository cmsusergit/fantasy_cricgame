import type { Player } from './player';
import type { Team } from './team';

export type IntentType = 'defensive' | 'balanced' | 'aggressive' | 'very_aggressive';

export const INTENT_MULTIPLIERS: Record<IntentType, number> = {
  defensive: 0.2,
  balanced: 1.0,
  aggressive: 3.5,
  very_aggressive: 5.5
};

export type BallResult = 'dot' | 'single' | 'four' | 'six' | 'wicket' | 'noball' | 'wide';

export interface BallEvent {
  ballNumber: number;
  over: number;
  ball: number;
  batsmanId: string;
  bowlerId: string;
  result: BallResult;
  runs: number;
  isWicket: boolean;
  commentary: string;
  wicketType?: string;
  isFreeHit?: boolean;
  isPowerplay?: boolean;
}

export interface innings {
  teamId: string;
  totalRuns: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: number;
  ballsFaced: BallEvent[];
  battingOrder: string[];
  currentBatsmen: [string, string];
  impactPlayer?: string | null;
  impactUsed?: boolean;
  powerplayRuns?: number;
  deathOverRuns?: number;
}

export interface Match {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  matchNumber: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  winner?: string;
  innings1?: innings;
  innings2?: innings;
  currentInnings: 1 | 2;
  target?: number;
}

export interface MatchState {
  match: Match;
  currentOver: number;
  currentBall: number;
  currentBowlerId: string;
  strikeBatsmanId: string;
  nonStrikeBatsmanId: string;
  battingTeam: Team;
  bowlingTeam: Team;
  isUserBatting: boolean;
  gameSpeed: 1 | 5 | 'instant';
  isPaused: boolean;
}
