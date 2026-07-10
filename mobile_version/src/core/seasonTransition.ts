import type { Player } from '../models/player';
import type { Team, TeamPersonality } from '../models/team';
import { FACILITY_MAINTENANCE_COSTS } from '../models/staff';
import { calculateStandings } from './tournamentSim';
import { calculateTeamStrength, createTeamTendency } from './teamBuilder';

export interface SeasonAwards {
  mvp: Player | null;
  topScorer: Player | null;
  topWicketTaker: Player | null;
  prizeMoney: number;
  finalStanding: number;
  salaryPaid: number;
  teamPlaystyleChanges: {
    teamName: string;
    oldPlaystyle: string;
    newPlaystyle: string;
    oldStars: number;
    newStars: number;
  }[];
}

export function processSeasonEnd(
  teams: Team[], 
  players: Player[], 
  userTeamId: string
): { awards: SeasonAwards; updatedTeams: Team[]; updatedPlayers: Player[] } {
  // 1. Calculate Standings
  const standings = calculateStandings(teams);
  const userStandingIndex = standings.findIndex(s => s.teamId === userTeamId);
  const userStanding = userStandingIndex + 1;

  // Track old playstyles and stars
  const playstyleChanges = teams.map(t => {
    const strength = calculateTeamStrength(t);
    return {
      teamId: t.id,
      teamName: t.name,
      oldPlaystyle: t.personality,
      oldStars: strength.stars,
      newPlaystyle: t.personality,
      newStars: strength.stars
    };
  });

  // 2. Distribute Prize Money and Deduct Salaries
  const prizePool = [200000, 150000, 100000, 75000, 50000, 40000, 30000, 20000];
  const userPrizeMoney = prizePool[userStandingIndex] || 10000;
  
  let userSalaryPaid = 0;

  // 3. Identify Awards
  let topScorer: Player | null = null;
  let topWicketTaker: Player | null = null;
  let mvp: Player | null = null;

  let maxRuns = -1;
  let maxWickets = -1;
  let maxMvpScore = -1;

  // Evaluate players for performance this season
  const updatedPlayersMap = new Map<string, Player>();
  const updatedPlayers = players.map(p => {
    if (p.runsScored > maxRuns) {
      maxRuns = p.runsScored;
      topScorer = p;
    }
    if (p.wickets > maxWickets) {
      maxWickets = p.wickets;
      topWicketTaker = p;
    }
    
    const mvpScore = (p.runsScored * 1) + (p.wickets * 25) + (p.form * 50);
    if (mvpScore > maxMvpScore) {
      maxMvpScore = mvpScore;
      mvp = p;
    }

    // 4. Aging & Retirement
    let age = p.age + 1;
    let retiring = false;
    
    // Retirement logic: chance increases drastically after 35
    if (age > 35) {
        const retireChance = (age - 35) * 0.15; // 36=15%, 37=30%, 38=45%, 39=60%, 40=75%
        if (Math.random() < retireChance) {
            retiring = true;
        }
    } else if (age > 40) {
        retiring = true; // Forced retirement
    }

    // 5. Market Value Adjustment
    let newMarketValue = p.marketValue;
    
    // Performance boost/penalty
    const formImpact = p.form * 1000;
    newMarketValue += formImpact;

    // Age impact
    if (age < 24) {
        newMarketValue += (p.potential - 70) * 500; 
    } else if (age > 32) {
        newMarketValue -= (age - 32) * 2000;
    }

    // Clamp value
    newMarketValue = Math.max(10000, Math.min(newMarketValue, 250000));

    // Reset form and fatigue for the new season
    const updated = {
        ...p,
        age,
        retiring,
        marketValue: Math.floor(newMarketValue),
        fatigue: 0,
        form: Math.floor(Math.max(-10, Math.min(10, p.form + (Math.random() > 0.5 ? 1 : -1)))) // Slight form drift
    };
    updatedPlayersMap.set(p.id, updated);
    return updated;
  });

  // Distribute to all teams and update Playstyle and rosters
  const updatedTeams = teams.map(t => {
    const idx = standings.findIndex(s => s.teamId === t.id);
    const prize = prizePool[idx] || 10000;

    // Sync/update players in team roster
    const newTeamPlayers = t.players.map(p => {
      const updatedP = updatedPlayersMap.get(p.id);
      return updatedP ? updatedP : p;
    });

    // Calculate average stats of the team's players to decide playstyle
    let totalPower = 0;
    let totalBatting = 0;
    let totalBowling = 0;
    let totalTechnique = 0;
    
    newTeamPlayers.forEach(p => {
      totalPower += p.stats.power;
      totalBatting += p.stats.batting;
      totalBowling += p.stats.bowling;
      totalTechnique += p.stats.technique;
    });
    
    const count = newTeamPlayers.length || 1;
    const avgPower = totalPower / count;
    const avgBatting = totalBatting / count;
    const avgBowling = totalBowling / count;
    const avgTechnique = totalTechnique / count;

    // Performance metrics
    const wins = t.wins;
    const losses = t.losses;
    const netWins = wins - losses;

    // Compute playstyle score for each personality
    const aggressiveScore = avgPower * 1.4 + avgBatting * 0.8 + netWins * 1.5;
    const defensiveScore = avgBowling * 1.4 + avgTechnique * 0.8 - netWins * 1.5;
    const strategicScore = avgTechnique * 1.2 + (avgBatting + avgBowling) * 0.6;
    const adaptiveScore = (avgBatting + avgBowling + avgPower + avgTechnique) * 0.5 + (t.draws * 5);
    const balancedScore = (avgBatting + avgBowling + avgPower + avgTechnique) * 0.55;

    const scores = [
      { personality: 'aggressive' as TeamPersonality, score: aggressiveScore },
      { personality: 'defensive' as TeamPersonality, score: defensiveScore },
      { personality: 'strategic' as TeamPersonality, score: strategicScore },
      { personality: 'adaptive' as TeamPersonality, score: adaptiveScore },
      { personality: 'balanced' as TeamPersonality, score: balancedScore }
    ];
    
    scores.sort((a, b) => b.score - a.score);
    const newPersonality = scores[0].personality;
    const newTendency = createTeamTendency(newPersonality);
    
    const playerSalaries = newTeamPlayers.reduce((sum, p) => sum + p.price * 0.10, 0);
    const staffSalaries = t.staff?.reduce((sum, s) => sum + s.salary, 0) || 0;
    const facilityMaintenance = (
      (FACILITY_MAINTENANCE_COSTS.stadium[t.facilities?.stadiumLevel || 1] || 0) +
      (FACILITY_MAINTENANCE_COSTS.training[t.facilities?.trainingLevel || 1] || 0) +
      (FACILITY_MAINTENANCE_COSTS.medical[t.facilities?.medicalLevel || 1] || 0)
    );
    const totalSalaries = playerSalaries + staffSalaries + facilityMaintenance;
    
    if (t.id === userTeamId) {
        userSalaryPaid = totalSalaries;
    }
    
    return { 
      ...t, 
      budget: t.budget + prize - totalSalaries,
      players: newTeamPlayers,
      personality: newPersonality,
      tendency: newTendency
    };
  });

  const finalPlaystyleChanges = playstyleChanges.map(change => {
    const t = updatedTeams.find(x => x.id === change.teamId);
    if (t) {
      const strength = calculateTeamStrength(t);
      return {
        ...change,
        newPlaystyle: t.personality,
        newStars: strength.stars
      };
    }
    return change;
  });

  const awards: SeasonAwards = {
    mvp,
    topScorer,
    topWicketTaker,
    prizeMoney: userPrizeMoney,
    finalStanding: userStanding,
    salaryPaid: userSalaryPaid,
    teamPlaystyleChanges: finalPlaystyleChanges
  };

  return {
    awards,
    updatedTeams,
    updatedPlayers
  };
}