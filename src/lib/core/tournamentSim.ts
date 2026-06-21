import type { Player } from '../models/player';
import type { Team } from '../models/team';
import type { Match, innings, IntentType } from '../models/match';
import { resolveBall, updateFatigueAndMorale } from './matchEngine';
import { randomInt } from './draftAI';

export function simulateMatch(team1: Team, team2: Team, totalOvers: number = 20): { 
  winner: string;
  team1Score: number;
  team2Score: number;
  innings1: innings;
  innings2: innings;
} {
  const innings1 = simulateInnings(team1, team2, totalOvers);
  const target = innings1.totalRuns + 1;
  const innings2 = simulateInnings(team2, team1, totalOvers, target);
  
  const winner = innings2.totalRuns >= target ? team2.id : team1.id;
  
  return {
    winner,
    team1Score: innings1.totalRuns,
    team2Score: innings2.totalRuns,
    innings1,
    innings2
  };
}

export function simulateInnings(
  battingTeam: Team, 
  bowlingTeam: Team, 
  totalOvers: number,
  target?: number
): innings {
  const players = battingTeam.players;
  const bowlers = bowlingTeam.players;
  
  if (players.length < 2) {
    return {
      teamId: battingTeam.id,
      totalRuns: 0,
      wickets: 10,
      overs: totalOvers,
      balls: totalOvers * 6,
      extras: 0,
      ballsFaced: [],
      battingOrder: [],
      currentBatsmen: ['', '']
    };
  }
  
  const battingOrder = [...players.map(p => p.id)];
  let currentBatsmen: [string, string] = [battingOrder[0], battingOrder[1]];
  let strikerIndex = 0;
  
  const innings: innings = {
    teamId: battingTeam.id,
    totalRuns: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: 0,
    ballsFaced: [],
    battingOrder,
    currentBatsmen
  };
  
  let bowlerIndex = 0;
  let bowlerOverCount = 0;
  let currentBowlerId = bowlers[bowlerIndex % bowlers.length].id;
  
  const intents: IntentType[] = ['balanced', 'balanced', 'balanced', 'aggressive', 'aggressive', 'defensive'];
  
  for (let over = 0; over < totalOvers; over++) {
    if (target && innings.totalRuns >= target) break;
    if (innings.wickets >= 10) break;
    
    for (let ball = 0; ball < 6; ball++) {
      if (target && innings.totalRuns >= target) break;
      if (innings.wickets >= 10) break;
      
      const striker = players.find(p => p.id === currentBatsmen[0])!;
      const bowler = bowlers.find(p => p.id === currentBowlerId)!;
        const intent: IntentType = over < 6 ? 'aggressive' : over >= 15 ? 'very_aggressive' : 'balanced';
        const bowlingFieldingAvg = bowlingTeam.players.slice(0, 11).reduce((sum, p) => sum + (p.stats.fielding || 60), 0) / 11;
        const bowlingTeamIds = bowlingTeam.players.slice(0, 11).map(p => p.id);
        const ballEvent = resolveBall(striker, bowler, over, totalOvers, intent, 'sunny', 'balanced', 0, false, 'balanced', false, bowlingFieldingAvg, 'normal', 1.0, 1.0, bowlingTeamIds);
      
      const updates = updateFatigueAndMorale(striker, bowler, ballEvent.result, intent, 'balanced');
      striker.fatigue += updates.batterFatigue;
      striker.morale += updates.batterMorale;
      bowler.fatigue += updates.bowlerFatigue;
      bowler.morale += updates.bowlerMorale;
      
      innings.totalRuns += ballEvent.runs;
      if (ballEvent.result === 'wide' || ballEvent.result === 'noball') {
        innings.extras += ballEvent.runs;
      } else {
        innings.balls++;
      }
      innings.ballsFaced.push(ballEvent);
      
      if (ballEvent.isWicket) {
        innings.wickets++;
        strikerIndex++;
        
        if (strikerIndex < battingOrder.length) {
          currentBatsmen[0] = battingOrder[strikerIndex];
        }
      } else {
        if (ballEvent.runs % 2 === 1) {
          [currentBatsmen[0], currentBatsmen[1]] = [currentBatsmen[1], currentBatsmen[0]];
        }
      }
      
      bowlerOverCount++;
      if (bowlerOverCount >= 4) {
        bowlerIndex++;
        bowlerOverCount = 0;
        currentBowlerId = bowlers[bowlerIndex % bowlers.length].id;
      }
    }
    
    innings.overs++;
    [currentBatsmen[0], currentBatsmen[1]] = [currentBatsmen[1], currentBatsmen[0]];
  }
  
  return innings;
}

export function getTeamForMatch(teams: Team[], teamId: string): Team | undefined {
  return teams.find(t => t.id === teamId);
}

export function calculateStandings(teams: Team[]): Array<{
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  runsFor: number;
  runsAgainst: number;
  points: number;
  nrr: number;
}> {
  return teams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    played: team.matchesPlayed,
    wins: team.wins,
    losses: team.losses,
    runsFor: team.runsFor,
    runsAgainst: team.runsAgainst,
    points: team.wins * 2,
    nrr: team.matchesPlayed > 0 
      ? (team.runsFor - team.runsAgainst) / (team.matchesPlayed * 20)
      : 0
  })).sort((a, b) => b.points - a.points || b.nrr - a.nrr);
}