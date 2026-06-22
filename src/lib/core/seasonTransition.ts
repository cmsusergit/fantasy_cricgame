import type { Player } from '../models/player';
import type { Team } from '../models/team';
import { FACILITY_MAINTENANCE_COSTS } from '../models/staff';
import { calculateStandings } from './tournamentSim';
import { teamStore, playerStore, scheduleStore, currentSeason, gamePhase } from '../stores/gameState';

export interface SeasonAwards {
  mvp: Player | null;
  topScorer: Player | null;
  topWicketTaker: Player | null;
  prizeMoney: number;
  finalStanding: number;
  salaryPaid: number;
}

export function processSeasonEnd(teams: Team[], players: Player[], userTeamId: string): SeasonAwards {
  // 1. Calculate Standings
  const standings = calculateStandings(teams);
  const userStandingIndex = standings.findIndex(s => s.teamId === userTeamId);
  const userStanding = userStandingIndex + 1;

  // 2. Distribute Prize Money and Deduct Salaries
  const prizePool = [200000, 150000, 100000, 75000, 50000, 40000, 30000, 20000];
  const userPrizeMoney = prizePool[userStandingIndex] || 10000;
  
  let userSalaryPaid = 0;

  // Distribute to all teams
  teamStore.update(currentTeams => {
    return currentTeams.map(t => {
      const idx = standings.findIndex(s => s.teamId === t.id);
      const prize = prizePool[idx] || 10000;
      
      const playerSalaries = t.players.reduce((sum, p) => sum + p.price * 0.10, 0);
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
      
      return { ...t, budget: t.budget + prize - totalSalaries };
    });
  });

  // 3. Identify Awards
  let topScorer: Player | null = null;
  let topWicketTaker: Player | null = null;
  let mvp: Player | null = null;

  let maxRuns = -1;
  let maxWickets = -1;
  let maxMvpScore = -1;

  // Evaluate players for performance this season (simplified proxy using overall career for now, 
  // ideally we would track season-specific stats, but we'll use form/runs to approximate for Phase 1)
  const updatedPlayers = players.map(p => {
    // Determine awards based on simple logic (in a real scenario, this would be delta runs for this season)
    // We will use current runsScored / matches as a simple proxy if matches > 0
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
    // Base it on form, matches played (exposure), and age penalty
    let newMarketValue = p.marketValue;
    
    // Performance boost/penalty
    const formImpact = p.form * 1000; // -10000 to +10000
    newMarketValue += formImpact;

    // Age impact
    if (age < 24) {
        // Young players gain value quickly if they have potential
        newMarketValue += (p.potential - 70) * 500; 
    } else if (age > 32) {
        // Older players lose value
        newMarketValue -= (age - 32) * 2000;
    }

    // Clamp value
    newMarketValue = Math.max(10000, Math.min(newMarketValue, 250000));

    // Reset form and fatigue for the new season
    return {
        ...p,
        age,
        retiring,
        marketValue: Math.floor(newMarketValue),
        fatigue: 0,
        form: Math.floor(Math.max(-10, Math.min(10, p.form + (Math.random() > 0.5 ? 1 : -1)))) // Slight form drift
    };
  });

  playerStore.set(updatedPlayers);

  currentSeason.update(n => n + 1);

  return {
    mvp,
    topScorer,
    topWicketTaker,
    prizeMoney: userPrizeMoney,
    finalStanding: userStanding,
    salaryPaid: userSalaryPaid
  };
}