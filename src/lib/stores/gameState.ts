import { writable, derived } from 'svelte/store';
import type { Player } from '../models/player';
import type { Team } from '../models/team';
import type { Match } from '../models/match';
import type { FactionType } from '../models/faction';
import { generatePlayerPool, generateTeamName, generateCoachName } from '../core/draftAI';
import { TEAM_PERSONALITIES, createTeamTendency, PERSONALITY_NAMES } from '../core/teamBuilder';
import { generateTournamentSchedule, type TournamentSchedule, type ScheduledMatch, type GameDay } from '../core/schedule';
import { saveGame, loadGame, clearSave } from '../services/storage';

function createPlayerStore() {
  const { subscribe, set, update } = writable<Player[]>([]);

  return {
    subscribe,
    set,
    update,
    initialize: (existingPlayers?: Player[]) => {
      if (existingPlayers && existingPlayers.length > 0) {
        set(existingPlayers);
      } else {
        set(generatePlayerPool(100));
      }
    },
    setPlayerUnavailable: (playerId: string) => {
      update(players => 
        players.map(p => p.id === playerId ? { ...p, isAvailable: false } : p)
      );
    },
    bidOnPlayer: (playerId: string, teamId: string) => {
      update(players =>
        players.map(p => {
          if (p.id === playerId) {
            return { ...p, isAvailable: false };
          }
          return p;
        })
      );
    }
  };
}

function createTeamStore() {
  const { subscribe, set, update } = writable<Team[]>([]);

  return {
    subscribe,
    set,
    update,
    initialize: (existingTeams?: Team[], userTeam?: Team) => {
      const baseTeams: Team[] = [];
      const playerPool = generatePlayerPool(150);
      
      const factionTypes = ['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'] as const;
      
      for (let i = 0; i < 8; i++) {
        const teamId = `team_${i}`;
        const isUserTeam = userTeam?.id === teamId;
        const faction = factionTypes[i % factionTypes.length];
        const teamPlayers = playerPool
          .slice(i * 15, i * 15 + 15)
          .map(p => ({ ...p, isAvailable: false }));
        
        baseTeams.push({
          id: teamId,
          name: generateTeamName(faction),
          coach: generateCoachName(faction),
          budget: isUserTeam ? (userTeam?.budget ?? 4000000) : 4000000,
          operatingBudget: isUserTeam ? (userTeam?.operatingBudget ?? 1000000) : 1000000,
          staff: isUserTeam ? (userTeam?.staff ?? []) : [],
          facilities: isUserTeam ? (userTeam?.facilities ?? { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 }) : { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
          players: teamPlayers,
          wins: 0,
          losses: 0,
          draws: 0,
          matchesPlayed: 0,
          runsFor: 0,
          runsAgainst: 0,
          isUserTeam,
          fanProfile: { homeAdvantage: 0, popularity: 50, revenue: 0, matchBonus: 0 },
          sponsorships: [],
          tournamentWins: 0,
          injuries: [],
          personality: isUserTeam ? 'balanced' : TEAM_PERSONALITIES[i - 1] || 'balanced',
          tendency: createTeamTendency(isUserTeam ? 'balanced' : TEAM_PERSONALITIES[i - 1] || 'balanced'),
          faction
        });
      }
      
      set(existingTeams && existingTeams.length > 0 ? existingTeams : baseTeams);
    },
    addWin: (teamId: string, runsFor: number, runsAgainst: number) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return {
              ...t,
              wins: t.wins + 1,
              matchesPlayed: t.matchesPlayed + 1,
              runsFor: t.runsFor + runsFor,
              runsAgainst: t.runsAgainst + runsAgainst
            };
          }
          return t;
        })
      );
    },
    addLoss: (teamId: string, runsFor: number, runsAgainst: number) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return {
              ...t,
              losses: t.losses + 1,
              matchesPlayed: t.matchesPlayed + 1,
              runsFor: t.runsFor + runsFor,
              runsAgainst: t.runsAgainst + runsAgainst
            };
          }
          return t;
        })
      );
    },
    updateBudget: (teamId: string, amount: number) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return { ...t, budget: t.budget + amount };
          }
          return t;
        })
      );
    },
    updateOperatingBudget: (teamId: string, amount: number) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return { ...t, operatingBudget: t.operatingBudget + amount };
          }
          return t;
        })
      );
    },
    hireStaff: (teamId: string, staff: any, cost: number) => {
      update(teams => teams.map(t => {
        if (t.id === teamId && t.operatingBudget >= cost) {
          return { ...t, operatingBudget: t.operatingBudget - cost, staff: [...t.staff, staff] };
        }
        return t;
      }));
    },
    fireStaff: (teamId: string, staffId: string, severance: number) => {
      update(teams => teams.map(t => {
        if (t.id === teamId) {
          return { ...t, operatingBudget: t.operatingBudget - severance, staff: t.staff.filter((s: any) => s.id !== staffId) };
        }
        return t;
      }));
    },
    upgradeFacility: (teamId: string, facility: 'stadium' | 'training' | 'medical', cost: number) => {
      update(teams => teams.map(t => {
        if (t.id === teamId && t.operatingBudget >= cost) {
          const newFacilities = { ...t.facilities };
          if (facility === 'stadium') newFacilities.stadiumLevel++;
          if (facility === 'training') newFacilities.trainingLevel++;
          if (facility === 'medical') newFacilities.medicalLevel++;
          return { ...t, operatingBudget: t.operatingBudget - cost, facilities: newFacilities };
        }
        return t;
      }));
    },
    addPlayer: (teamId: string, player: Player) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return { ...t, players: [...t.players, { ...player, isAvailable: false }] };
          }
          return t;
        })
      );
    },
    setPlaying11: (teamId: string, playing11: string[], captain: string, wicketKeeper: string) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return { ...t, playing11, captain, wicketKeeper };
          }
          return t;
        })
      );
    },
    addSponsorship: (teamId: string, sponsorship: any) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return { ...t, sponsorships: [...(t.sponsorships || []), sponsorship] };
          }
          return t;
        })
      );
    }
  };
}

function createTournamentStore() {
  const { subscribe, set, update } = writable<Match[]>([]);

  return {
    subscribe,
    set,
    initialize: (teams: Team[]) => {
      const matches: Match[] = [];
      const matchNum = 1;
      
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({
            id: `match_${matchNum}_${i}_${j}`,
            team1Id: teams[i].id,
            team2Id: teams[j].id,
            team1Name: teams[i].name,
            team2Name: teams[j].name,
            matchNumber: matchNum,
            status: 'scheduled',
            currentInnings: 1
          });
        }
      }
      
      set(matches);
    },
    updateMatch: (matchId: string, updates: Partial<Match>) => {
      update(matches =>
        matches.map(m => m.id === matchId ? { ...m, ...updates } : m)
      );
    },
    markComplete: (matchId: string, winnerId: string) => {
      update(matches =>
        matches.map(m => m.id === matchId ? { ...m, status: 'completed', winner: winnerId } : m)
      );
    }
  };
}

export const playerStore = createPlayerStore();
export const teamStore = createTeamStore();
export const tournamentStore = createTournamentStore();

function createScheduleStore() {
  const { subscribe, set, update } = writable<TournamentSchedule | null>(null);

  return {
    subscribe,
    set,
    initialize: (teams: Team[]) => {
      const schedule = generateTournamentSchedule(teams, 1);
      set(schedule);
      return schedule;
    },
    updateMatchResult: (matchId: string, winner: string, team1Score: number, team2Score: number) => {
      update(schedule => {
        if (!schedule) return schedule;
        return {
          ...schedule,
          matches: schedule.matches.map(m => 
            m.id === matchId 
              ? { ...m, status: 'completed' as const, result: { winner, team1Score, team2Score } }
              : m
          )
        };
      });
    },
    advanceToNextDay: () => {
      update(schedule => {
        if (!schedule) return schedule;
        const nextDay = Math.min(schedule.currentDay + 1, schedule.totalDays);
        return { ...schedule, currentDay: nextDay };
      });
    }
  };
}

export const scheduleStore = createScheduleStore();

export const userTeam = derived(teamStore, $teams => 
  $teams.find(t => t.isUserTeam)
);

export const availablePlayers = derived(playerStore, $players =>
  $players.filter(p => p.isAvailable)
);

export const currentDay = writable(1);
export const currentSeason = writable(1);
export const isFirstLogin = writable(false);

export type GamePhase = 'menu' | 'draft' | 'tournament' | 'match' | 'season_end' | 'retention' | 'scouting' | 'trading' | 'auction';
export const gamePhase = writable<GamePhase>('menu');

export function initializeGame(teamName: string = 'Your Team', managerName: string = 'You', logoUrl: string = '') {
  const existingSave = loadGame();
  
  if (existingSave) {
    playerStore.initialize(existingSave.players);
    teamStore.initialize(existingSave.teams);
    tournamentStore.initialize(existingSave.teams);
    currentDay.set(existingSave.currentDay);
    currentSeason.set(existingSave.currentSeason || 1);
    gamePhase.set((existingSave.gamePhase as GamePhase) || 'menu');
    if (existingSave.schedule) {
      scheduleStore.set(existingSave.schedule);
    } else {
      scheduleStore.initialize(existingSave.teams);
    }
  } else {
    const teams: Team[] = [];
    const playerPool = generatePlayerPool(150);
    const factionTypes: FactionType[] = ['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'];
    
    // 8 teams: User at index 0, 7 AI with unique personalities
    for (let i = 0; i < 8; i++) {
      const isUserTeam = i === 0;
      const faction = factionTypes[i % factionTypes.length];
      const personality = isUserTeam ? 'balanced' : TEAM_PERSONALITIES[i - 1];
      const tendency = createTeamTendency(personality);
      const teamPlayers = playerPool
        .slice(i * 15, i * 15 + 15)
        .map(p => ({ ...p, isAvailable: false }));
      
      teams.push({
        id: isUserTeam ? 'user_team' : `team_${i}`,
        name: isUserTeam ? teamName : PERSONALITY_NAMES[personality],
        coach: isUserTeam ? managerName : generateCoachName(faction),
        logo: isUserTeam ? logoUrl : undefined,
        budget: isUserTeam ? 4000000 : 4000000,
        operatingBudget: 1000000,
        staff: [],
        facilities: { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
        players: teamPlayers,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        runsFor: 0,
        runsAgainst: 0,
        isUserTeam,
        fanProfile: { homeAdvantage: 0, popularity: 50, revenue: 0, matchBonus: 0 },
        sponsorships: [],
        tournamentWins: 0,
        injuries: [],
        personality,
        tendency,
        faction
      });
    }
    
    playerStore.initialize(playerPool);
    teamStore.initialize(teams);
    tournamentStore.initialize(teams);
    scheduleStore.initialize(teams);
    isFirstLogin.set(true);
  }
}

export function saveCurrentGame(userBudget: number) {
  let teams: Team[] = [];
  let players: Player[] = [];
  let matches: Match[] = [];
  let schedule: TournamentSchedule | null = null;
  let day = 1;
  let season = 1;
  let phase = 'menu';
  
  teamStore.subscribe(t => teams = t)();
  playerStore.subscribe(p => players = p)();
  tournamentStore.subscribe(m => matches = m)();
  scheduleStore.subscribe(s => schedule = s)();
  currentDay.subscribe(d => day = d)();
  currentSeason.subscribe(s => season = s)();
  gamePhase.subscribe(p => phase = p)();
  
  const userTeam = teams.find(t => t.isUserTeam);
  
  saveGame({
    version: '1.4.2',
    userTeamId: userTeam?.id || 'user_team',
    teams,
    players,
    tournamentMatches: matches,
    schedule: schedule || undefined,
    currentDay: day,
    currentSeason: season,
    gamePhase: phase,
    userBudget,
    savedAt: Date.now()
  });
}

export function resetGame() {
  clearSave();
  playerStore.initialize();
  teamStore.initialize();
  tournamentStore.initialize([]);
  scheduleStore.set(null);
  currentDay.set(1);
  currentSeason.set(1);
  gamePhase.set('menu');
}