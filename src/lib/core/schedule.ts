import type { Team } from '../models/team';

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'rained_out';
export type DayType = 'matchday' | 'rest' | 'training' | 'auction';

export interface GameDay {
  day: number;
  type: DayType;
  date: Date;
  title: string;
  description: string;
}

export interface ScheduledMatch {
  id: string;
  day: number;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  matchNumber: number;
  status: MatchStatus;
  venue: string;
  result?: {
    winner: string;
    team1Score: number;
    team2Score: number;
  };
}

export interface TournamentSchedule {
  days: GameDay[];
  matches: ScheduledMatch[];
  currentDay: number;
  totalDays: number;
}

export function generateTournamentSchedule(teams: Team[], startDay: number = 1): TournamentSchedule {
  const days: GameDay[] = [];
  const matches: ScheduledMatch[] = [];
  
  const teamCount = teams.length;
  const totalMatches = (teamCount * (teamCount - 1)) / 2;
  const totalDays = 45;
  
  const venues = ['Stadium A', 'Stadium B', 'Stadium C', 'Stadium D'];
  
  const schedule: [string, string][] = [];
  for (let i = 0; i < teamCount; i++) {
    for (let j = i + 1; j < teamCount; j++) {
      schedule.push([teams[i].id, teams[j].id]);
    }
  }
  
  schedule.sort(() => Math.random() - 0.5);
  
  let matchIndex = 0;
  
  for (let d = 0; d < totalDays; d++) {
    const dayNum = startDay + d;
    const dayOfWeek = d % 7;
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFriday = dayOfWeek === 5;
    const isRestDay = d === 0 || d === totalDays - 1;
    const isAuctionDay = d === 1;
    const isTrainingDay = d === 2;
    
    let dayType: DayType = 'matchday';
    let matchesThisDay = 0;
    let title = '';
    let description = '';
    
    if (isRestDay) {
      dayType = 'rest';
      title = d === 0 ? 'Tournament Opening' : 'Final & Awards';
      description = 'No matches scheduled';
    } else if (isAuctionDay) {
      dayType = 'auction';
      title = 'Player Auction';
      description = 'Transfer window opens';
    } else if (isTrainingDay) {
      dayType = 'training';
      title = 'Training Day';
      description = 'Practice sessions available';
    } else {
      if (isWeekend) {
        matchesThisDay = 2;
        title = `Weekend Double Header`;
        description = '2 matches today';
      } else if (isFriday) {
        matchesThisDay = 1;
        title = 'Friday Night Match';
        description = '1 match today';
      } else {
        matchesThisDay = 1;
        title = `Weekday Match`;
        description = '1 match today';
      }
    }
    
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + d);
    
    const dayGames: GameDay = {
      day: dayNum,
      type: dayType,
      date: baseDate,
      title,
      description
    };
    days.push(dayGames);
    
    if (dayType === 'matchday' && matchesThisDay > 0) {
      for (let m = 0; m < matchesThisDay; m++) {
        if (matchIndex >= schedule.length) break;
        
        const [t1Id, t2Id] = schedule[matchIndex];
        const team1 = teams.find(t => t.id === t1Id) || teams[0];
        const team2 = teams.find(t => t.id === t2Id) || teams[1];
        
        matches.push({
          id: `match_${dayNum}_${m}`,
          day: dayNum,
          team1Id: t1Id,
          team2Id: t2Id,
          team1Name: team1.name,
          team2Name: team2.name,
          matchNumber: matchIndex + 1,
          status: 'scheduled',
          venue: venues[matchIndex % venues.length]
        });
        
        matchIndex++;
      }
    }
  }
  
  return {
    days,
    matches,
    currentDay: startDay,
    totalDays: days.length
  };
}

export function getMatchesForDay(schedule: TournamentSchedule, day: number): ScheduledMatch[] {
  return schedule.matches.filter(m => m.day === day);
}

export function getCurrentDay(schedule: TournamentSchedule): number {
  const completedMatches = schedule.matches.filter(m => m.status === 'completed').length;
  const matchesPerDay = 4;
  return Math.min(schedule.currentDay + Math.floor(completedMatches / matchesPerDay), schedule.totalDays);
}

export function getNextMatch(schedule: TournamentSchedule, teamId: string): ScheduledMatch | null {
  return schedule.matches.find(m => 
    m.status === 'scheduled' && 
    (m.team1Id === teamId || m.team2Id === teamId)
  ) || null;
}

export function advanceDay(schedule: TournamentSchedule): TournamentSchedule {
  const nextDay = schedule.currentDay + 1;
  
  const matchesForDay = schedule.matches.filter(m => m.day === nextDay && m.status === 'scheduled');
  
  const updatedMatches = schedule.matches.map(m => {
    if (m.day === schedule.currentDay && m.status === 'scheduled') {
      return { ...m, status: 'completed' as MatchStatus };
    }
    return m;
  });
  
  return {
    ...schedule,
    matches: updatedMatches,
    currentDay: nextDay
  };
}

export function getStandingsFromSchedule(schedule: TournamentSchedule): Map<string, { points: number; wins: number; losses: number; nrr: number }> {
  const standings = new Map();
  
  for (const match of schedule.matches) {
    if (match.status !== 'completed' || !match.result) continue;
    
    const t1 = standings.get(match.team1Id) || { points: 0, wins: 0, losses: 0, nrr: 0 };
    const t2 = standings.get(match.team2Id) || { points: 0, wins: 0, losses: 0, nrr: 0 };
    
    if (match.result.winner === match.team1Id) {
      t1.wins++;
      t2.losses++;
      t1.points += 2;
    } else {
      t2.wins++;
      t1.losses++;
      t2.points += 2;
    }
    
    const t1RunRate = match.result.team1Score / 20;
    const t2RunRate = match.result.team2Score / 20;
    t1.nrr += t1RunRate - t2RunRate;
    t2.nrr += t2RunRate - t1RunRate;
    
    standings.set(match.team1Id, t1);
    standings.set(match.team2Id, t2);
  }
  
  return standings;
}

export function simulateAIMatch(team1Score: number, team2Score: number): { winner: string; margin: string } {
  if (team1Score > team2Score) {
    return { winner: 'team1', margin: `${team1Score - team2Score} runs` };
  } else if (team2Score > team1Score) {
    return { winner: 'team2', margin: `${team2Score - team1Score} wickets` };
  }
  return { winner: 'tie', margin: 'Super Over' };
}

export function simulateAllMatchesForDay(
  schedule: TournamentSchedule, 
  day: number,
  teams: Team[]
): TournamentSchedule {
  const matchesForDay = schedule.matches.filter(m => m.day === day && m.status === 'scheduled');
  
  const updatedMatches = schedule.matches.map(match => {
    if (match.day !== day || match.status !== 'scheduled') return match;
    
    const isUserMatch = match.team1Id === 'user_team' || match.team2Id === 'user_team';
    
    if (isUserMatch) return match;
    
    const team1 = teams.find(t => t.id === match.team1Id);
    const team2 = teams.find(t => t.id === match.team2Id);
    
    if (!team1 || !team2) return match;
    
    const team1Score = Math.floor(150 + Math.random() * 60);
    const team2Score = Math.floor(150 + Math.random() * 60);
    
    const result = simulateAIMatch(team1Score, team2Score);
    const winnerId = result.winner === 'team1' ? match.team1Id : result.winner === 'team2' ? match.team2Id : match.team1Id;
    
    return {
      ...match,
      status: 'completed' as MatchStatus,
      result: {
        winner: winnerId,
        team1Score,
        team2Score
      }
    };
  });
  
  return {
    ...schedule,
    matches: updatedMatches,
    currentDay: day
  };
}