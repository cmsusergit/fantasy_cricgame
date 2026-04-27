import type { Team } from '../models/team';
import type { innings } from '../models/match';
import type { Player } from '../models/player';

export interface SuperOverResult {
  battingTeam: Team;
  bowlingTeam: Team;
  totalRuns: number;
  wickets: number;
  balls: number;
  winner: 'batting' | 'bowling' | 'tie';
  ballsFaced: any[];
}

export function playSuperOver(
  battingTeam: Team,
  bowlingTeam: Team,
  target: number,
  weather: string = 'sunny',
  pitch: string = 'balanced'
): SuperOverResult {
  const battingOrder = battingTeam.players.slice(0, 4).map(p => p.id);
  let runs = 0;
  let wickets = 0;
  const ballsFaced: any[] = [];
  
  let currentBowler = bowlingTeam.players[Math.floor(Math.random() * bowlingTeam.players.length)];
  
  for (let ball = 0; ball < 6 && wickets < 4; ball++) {
    const strikerIndex = wickets;
    const striker = battingTeam.players.find(p => p.id === battingOrder[strikerIndex]);
    
    if (!striker || !currentBowler) break;
    
    const shotQuality = Math.random() * 20 + 5;
    let ballRuns = 0;
    let isWicket = false;
    let commentary = '';
    let result: string = 'dot';
    
    if (shotQuality > 20) {
      ballRuns = 6;
      result = 'six';
      commentary = `${striker.name} smashes for 6!`;
    } else if (shotQuality > 12) {
      ballRuns = 4;
      result = 'four';
      commentary = `${striker.name} finds the boundary!`;
    } else if (shotQuality > 5) {
      ballRuns = Math.random() > 0.5 ? 2 : 1;
      result = ballRuns === 2 ? 'double' : 'single';
      commentary = `${striker.name} takes ${ballRuns} runs`;
    } else if (Math.random() < 0.1) {
      isWicket = true;
      wickets++;
      result = 'wicket';
      commentary = `${striker.name} is out!`;
    } else {
      commentary = 'Dot ball';
    }
    
    runs += ballRuns;
    
    ballsFaced.push({
      ballNumber: ball + 1,
      over: 0,
      ball: ball + 1,
      batsmanId: striker.id,
      bowlerId: currentBowler.id,
      result,
      runs: ballRuns,
      isWicket,
      commentary
    });
    
    if (runs >= target && wickets < 4) {
      break;
    }
  }
  
  const won = runs >= target;
  const tied = runs === target && wickets < 4;
  
  return {
    battingTeam,
    bowlingTeam,
    totalRuns: runs,
    wickets,
    balls: ballsFaced.length,
    winner: won ? 'batting' : tied ? 'tie' : 'bowling',
    ballsFaced
  };
}

export interface DLSResult {
  parScore: number;
  resourcePercent: number;
  revisedOvers: number;
}

export function calculateDLS(
  originalScore: number,
  oversCompleted: number,
  totalOvers: number = 20,
  wicketsLost: number = 0
): DLSResult {
  const resourceTable: Record<number, number> = {
    0: 100, 1: 95, 2: 90, 3: 85, 4: 80, 5: 74, 6: 68, 7: 61, 8: 53, 9: 44, 10: 33,
    11: 25, 12: 18, 13: 13, 14: 9, 15: 6, 16: 4, 17: 2, 18: 1, 19: 0, 20: 0
  };
  
  const oversLost = totalOvers - oversCompleted;
  const resourcePercent = resourceTable[Math.min(oversCompleted, 20)] || 50;
  
  const basePar = originalScore * (100 / resourcePercent);
  const wicketFactor = (10 - wicketsLost) / 10;
  
  const parScore = Math.round(basePar * wicketFactor);
  
  return {
    parScore,
    resourcePercent,
    revisedOvers: oversCompleted
  };
}

export function calculateDuckworthLewisTarget(
  firstInningsScore: number,
  oversUtilized: number,
  oversAllocated: number,
  wicketsLost: number
): number {
  if (oversUtilized >= oversAllocated) {
    return firstInningsScore + 1;
  }
  
  const Z = firstInningsScore;
  const u = oversUtilized;
  const o = oversAllocated;
  const w = Math.min(wicketsLost, 10);
  
  const G50 = calculateG50(o, w);
  const G50u = calculateG50(u, w);
  
  if (G50u === 0) return 0;
  
  const parScore = (Z * G50) / G50u;
  
  return Math.round(parScore);
}

function calculateG50(overs: number, wickets: number): number {
  const a = -7.3;
  const b = 0.45;
  const z = 0.01;
  const g50 = 200 * (1 - Math.exp(a + b * overs + z * overs * (10 - wickets)));
  
  return g50;
}

export interface TournamentConfig {
  name: string;
  totalTeams: number;
  groupStageMatches: number;
  playoffFormat: 'top4' | 'top6';
  pointPerWin: number;
  pointPerTie: number;
  nrrDecider: boolean;
}

export const IPL_TOURNAMENT_CONFIG: TournamentConfig = {
  name: 'Fantasy Premier League',
  totalTeams: 8,
  groupStageMatches: 14,
  playoffFormat: 'top4',
  pointPerWin: 2,
  pointPerTie: 1,
  nrrDecider: true
};

export interface TournamentStanding {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  runsFor: number;
  runsAgainst: number;
  nrr: number;
  netPoints: number;
}

export function calculateTournamentStandings(
  teams: Team[],
  matches: Array<{ team1Id: string; team2Id: string; team1Runs: number; team2Runs: number; winner: string | null }>
): TournamentStanding[] {
  const standings: Map<string, TournamentStanding> = new Map();
  
  for (const team of teams) {
    standings.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      runsFor: 0,
      runsAgainst: 0,
      nrr: 0,
      netPoints: 0
    });
  }
  
  for (const match of matches) {
    const t1 = standings.get(match.team1Id);
    const t2 = standings.get(match.team2Id);
    
    if (!t1 || !t2) continue;
    
    t1.played++;
    t2.played++;
    
    if (match.winner) {
      if (match.winner === match.team1Id) {
        t1.wins++;
        t2.losses++;
        t1.points += IPL_TOURNAMENT_CONFIG.pointPerWin;
      } else {
        t2.wins++;
        t1.losses++;
        t2.points += IPL_TOURNAMENT_CONFIG.pointPerWin;
      }
    } else {
      t1.draws++;
      t2.draws++;
      t1.points += IPL_TOURNAMENT_CONFIG.pointPerTie;
      t2.points += IPL_TOURNAMENT_CONFIG.pointPerTie;
    }
    
    t1.runsFor += match.team1Runs;
    t1.runsAgainst += match.team2Runs;
    t2.runsFor += match.team2Runs;
    t2.runsAgainst += match.team1Runs;
  }
  
  const result = Array.from(standings.values()).map(t => {
    const oversFaced = Math.max(1, t.played * 20);
    const oversBowled = Math.max(1, t.played * 20);
    const runRateFor = t.runsFor / oversFaced;
    const runRateAgainst = t.runsAgainst / oversBowled;
    t.nrr = runRateFor - runRateAgainst;
    t.netPoints = t.points;
    return t;
  });
  
  return result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    return b.runsFor - a.runsFor;
  });
}

export interface PlayoffMatch {
  qualifier: 'Q1' | 'Q2' | 'EL1' | 'EL2' | 'F';
  team1Id: string;
  team2Id: string;
  winner?: string;
  winnerMethod?: 'run' | 'superover' | 'dls';
}

export function generatePlayoffs(standings: TournamentStanding[]): PlayoffMatch[] {
  const top4 = standings.slice(0, 4);
  
  return [
    { qualifier: 'Q1', team1Id: top4[0]?.teamId || '', team2Id: top4[1]?.teamId || '' },
    { qualifier: 'Q2', team1Id: top4[2]?.teamId || '', team2Id: top4[3]?.teamId || '' },
    { qualifier: 'EL1', team1Id: '', team2Id: '' },
    { qualifier: 'EL2', team1Id: '', team2Id: '' },
    { qualifier: 'F', team1Id: '', team2Id: '' }
  ];
}

export const SALARY_CAP = 150000000;
export const MAX_PLAYER_PRICE = 15000000;
export const MIN_PLAYER_PRICE = 3000000;
export const RIGHT_TO_MATCH_FEE = 30000000;
export const FRANCHISE_TAG = 15000000;

export function validateTeamBudget(totalPlayers: number, totalSalary: number): { valid: boolean; message: string } {
  if (totalSalary > SALARY_CAP) {
    return { valid: false, message: `Over salary cap by ₹${(totalSalary - SALARY_CAP).toLocaleString()}` };
  }
  
  if (totalPlayers < 18 || totalPlayers > 25) {
    return { valid: false, message: `Must have 18-25 players, currently ${totalPlayers}` };
  }
  
  return { valid: true, message: 'Team is valid' };
}