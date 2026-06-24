import { writable, derived } from 'svelte/store';
import type { Player } from '../models/player';
import type { Team } from '../models/team';
import type { Match } from '../models/match';
import type { FactionType } from '../models/faction';
import { generatePlayerPool, generateTeamName, generateCoachName, generateBalancedSquad } from '../core/draftAI';
import { TEAM_PERSONALITIES, createTeamTendency, PERSONALITY_NAMES, generateFantasyLogo } from '../core/teamBuilder';
import { generateTournamentSchedule, type TournamentSchedule, type ScheduledMatch, type GameDay } from '../core/schedule';
import { saveGame, loadGame, clearSave } from '../services/storage';

export interface TeamColorPalette {
  primary: string;
  secondary: string;
  primaryRgb: string;
  secondaryRgb: string;
}

export const TEAM_COLORS: TeamColorPalette[] = [
  { primary: '#1e40af', secondary: '#fbbf24', primaryRgb: '30, 64, 175', secondaryRgb: '251, 191, 36' },
  { primary: '#dc2626', secondary: '#f59e0b', primaryRgb: '220, 38, 38', secondaryRgb: '245, 158, 11' },
  { primary: '#059669', secondary: '#6366f1', primaryRgb: '5, 150, 105', secondaryRgb: '99, 102, 241' },
  { primary: '#7c3aed', secondary: '#ec4899', primaryRgb: '124, 58, 237', secondaryRgb: '236, 72, 153' },
  { primary: '#ea580c', secondary: '#1e293b', primaryRgb: '234, 88, 12', secondaryRgb: '30, 41, 59' },
  { primary: '#0891b2', secondary: '#f97316', primaryRgb: '8, 145, 178', secondaryRgb: '249, 115, 22' },
  { primary: '#be185d', secondary: '#14b8a6', primaryRgb: '190, 24, 93', secondaryRgb: '20, 184, 166' },
  { primary: '#4f46e5', secondary: '#a855f7', primaryRgb: '79, 70, 229', secondaryRgb: '168, 85, 247' },
];

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
    },
    updatePlayerStats: (playerId: string, stats: { runs?: number, wickets?: number, catches?: number, matches?: number, xp?: number }) => {
      update(players =>
        players.map(p => {
          if (p.id === playerId) {
            const tournamentStats = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
            return {
              ...p,
              matches: p.matches + (stats.matches || 0),
              runsScored: p.runsScored + (stats.runs || 0),
              wickets: p.wickets + (stats.wickets || 0),
              catches: p.catches + (stats.catches || 0),
              xp: (p.xp || 0) + (stats.xp || 0),
              lifetimeXp: (p.lifetimeXp || 0) + (stats.xp || 0),
              tournamentStats: {
                runs: tournamentStats.runs + (stats.runs || 0),
                wickets: tournamentStats.wickets + (stats.wickets || 0),
                catches: (tournamentStats.catches || 0) + (stats.catches || 0)
              }
            };
          }
          return p;
        })
      );
    }
  };
}

export function selectInitialPlaying11(players: Player[]): { playing11: string[], captain: string, wicketKeeper: string, reservePlayer?: string } {
  const batsmen = [...players].filter(p => p.role === 'batsman').sort((a, b) => b.stats.batting - a.stats.batting);
  const wks = [...players].filter(p => p.role === 'wicketkeeper').sort((a, b) => b.stats.batting - a.stats.batting);
  const allrounders = [...players].filter(p => p.role === 'allrounder').sort((a, b) => (b.stats.batting + b.stats.bowling) - (a.stats.batting + a.stats.bowling));
  const bowlers = [...players].filter(p => p.role === 'bowler').sort((a, b) => b.stats.bowling - a.stats.bowling);

  // Balanced 11: 4 Batsmen, 1 Wicketkeeper, 2 All-rounders, 4 Bowlers
  const selectedWk = wks[0];
  const selectedBatsmen = batsmen.slice(0, 4);
  const selectedArs = allrounders.slice(0, 2);
  const selectedBowlers = bowlers.slice(0, 4);

  const playing11Players = [
    ...selectedBatsmen,
    selectedWk,
    ...selectedArs,
    ...selectedBowlers
  ].filter(Boolean);

  // Fallback if needed to reach 11
  while (playing11Players.length < 11 && playing11Players.length < players.length) {
    const remaining = players.filter(p => !playing11Players.some(sel => sel.id === p.id));
    if (remaining.length === 0) break;
    remaining.sort((a, b) => Math.max(b.stats.batting, b.stats.bowling) - Math.max(a.stats.batting, a.stats.bowling));
    playing11Players.push(remaining[0]);
  }

  const playing11 = playing11Players.map(p => p.id);

  // Choose Captain: prioritize isCaptain flag, otherwise highest overall skill
  let captain = playing11Players.find(p => p.special?.isCaptain)?.id;
  if (!captain) {
    const sortedBySkill = [...playing11Players].sort((a, b) => 
      Math.max(b.stats.batting, b.stats.bowling) - Math.max(a.stats.batting, a.stats.bowling)
    );
    captain = sortedBySkill[0]?.id || playing11[0];
  }

  // Choose WicketKeeper
  const wicketKeeper = selectedWk?.id || playing11Players.find(p => p.special?.isWicketKeeper)?.id || playing11[0];

  // Nominate 1 reserve player from those not in starting 11
  const reserveCandidates = players.filter(p => !playing11.includes(p.id));
  const reservePlayer = reserveCandidates[0]?.id;

  return { playing11, captain, wicketKeeper, reservePlayer };
}

function createTeamStore() {
  const { subscribe, set, update } = writable<Team[]>([]);

  return {
    subscribe,
    set,
    update,
    initialize: (existingTeams?: Team[], userTeam?: Team) => {
      const baseTeams: Team[] = [];
      const factionTypes = ['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'] as const;
      
      for (let i = 0; i < 8; i++) {
        const teamId = `team_${i}`;
        const isUserTeam = userTeam?.id === teamId;
        const faction = factionTypes[i % factionTypes.length];
        const teamPlayers = generateBalancedSquad(faction)
          .map(p => ({ ...p, isAvailable: false }));
        
        const { playing11, captain, wicketKeeper, reservePlayer } = selectInitialPlaying11(teamPlayers);
        
        const name = generateTeamName(faction);
        const primaryColor = TEAM_COLORS[i % TEAM_COLORS.length].primary;
        const secondaryColor = TEAM_COLORS[i % TEAM_COLORS.length].secondary;
        const logo = generateFantasyLogo(name, primaryColor, secondaryColor, i);
        const personality = isUserTeam ? 'balanced' : TEAM_PERSONALITIES[i - 1] || 'balanced';
        const tendency = createTeamTendency(personality);

        baseTeams.push({
          id: teamId,
          name,
          coach: generateCoachName(faction),
          logo,
          budget: isUserTeam ? (userTeam?.budget ?? 4000000) : 4000000,
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
          personality,
          tendency,
          faction,
          colorPrimary: primaryColor,
          colorSecondary: secondaryColor,
          playing11,
          captain,
          wicketKeeper,
          reservePlayer
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
    renamePlayer: (teamId: string, playerId: string, newName: string) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return {
              ...t,
              players: t.players.map(p => {
                if (p.id === playerId) {
                  return {
                    ...p,
                    name: newName,
                    originalName: p.originalName || p.name
                  };
                }
                return p;
              })
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
    hireStaff: (teamId: string, staff: any, cost: number) => {
      update(teams => teams.map(t => {
        if (t.id === teamId && t.budget >= cost) {
          return { ...t, budget: t.budget - cost, staff: [...t.staff, staff] };
        }
        return t;
      }));
    },
    fireStaff: (teamId: string, staffId: string, severance: number) => {
      update(teams => teams.map(t => {
        if (t.id === teamId) {
          return { ...t, budget: t.budget - severance, staff: t.staff.filter((s: any) => s.id !== staffId) };
        }
        return t;
      }));
    },
    upgradeFacility: (teamId: string, facility: 'stadium' | 'training' | 'medical', cost: number) => {
      update(teams => teams.map(t => {
        if (t.id === teamId && t.budget >= cost) {
          const newFacilities = { ...t.facilities };
          if (facility === 'stadium') newFacilities.stadiumLevel++;
          if (facility === 'training') newFacilities.trainingLevel++;
          if (facility === 'medical') newFacilities.medicalLevel++;
          return { ...t, budget: t.budget - cost, facilities: newFacilities };
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
    setPlaying11: (teamId: string, playing11: string[], captain: string, wicketKeeper: string, reservePlayer?: string) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return { ...t, playing11, captain, wicketKeeper, reservePlayer };
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
    },
    removeSponsorship: (teamId: string, sponsorshipId: string) => {
      update(teams =>
        teams.map(t => {
          if (t.id === teamId) {
            return {
              ...t,
              sponsorships: (t.sponsorships || []).filter((s: any) => s.id !== sponsorshipId)
            };
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

export async function initializeGame(
  teamName: string = 'Your Team', 
  managerName: string = 'You', 
  logoUrl: string = '',
  startWithAuction: boolean = false,
  userColorIndex: number = 0
) {
  const existingSave = await loadGame();
  
  if (existingSave) {
    playerStore.initialize(existingSave.players);
    // Sanitize loaded teams to guarantee playing 11, captain, and wicketkeeper are initialized
    const sanitizedTeams = existingSave.teams.map((t: Team) => {
      if (!t.playing11 || t.playing11.length !== 11 || !t.captain || !t.wicketKeeper || !t.reservePlayer) {
        const { playing11, captain, wicketKeeper, reservePlayer } = selectInitialPlaying11(t.players);
        return {
          ...t,
          playing11: t.playing11 && t.playing11.length === 11 ? t.playing11 : playing11,
          captain: t.captain || captain,
          wicketKeeper: t.wicketKeeper || wicketKeeper,
          reservePlayer: t.reservePlayer || reservePlayer
        };
      }
      return t;
    });
    teamStore.initialize(sanitizedTeams);
    tournamentStore.initialize(sanitizedTeams);
    currentDay.set(existingSave.currentDay);
    currentSeason.set(existingSave.currentSeason || 1);
    isFirstLogin.set(existingSave.isFirstLogin ?? false);
    gamePhase.set((existingSave.gamePhase as GamePhase) || 'menu');
    if (existingSave.schedule) {
      scheduleStore.set(existingSave.schedule);
    } else {
      scheduleStore.initialize(sanitizedTeams);
    }
  } else {
    const teams: Team[] = [];
    let playerPool: Player[] = [];
    const factionTypes: FactionType[] = ['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'];
    
    // Order colors by swapping selected user color scheme to index 0
    const orderedColors = [...TEAM_COLORS];
    if (userColorIndex >= 0 && userColorIndex < TEAM_COLORS.length) {
      const selected = orderedColors.splice(userColorIndex, 1)[0];
      orderedColors.unshift(selected);
    }

    // 8 teams: User at index 0, 7 AI with unique personalities
    for (let i = 0; i < 8; i++) {
      const isUserTeam = i === 0;
      const faction = factionTypes[i % factionTypes.length];
      const personality = isUserTeam ? 'balanced' : TEAM_PERSONALITIES[i - 1] || 'balanced';
      const tendency = createTeamTendency(personality);
      const teamPlayers = generateBalancedSquad(faction)
        .map(p => ({ ...p, isAvailable: startWithAuction })); // If starting with auction, players start available in the pool
      
      playerPool = [...playerPool, ...teamPlayers];
      
      const { playing11, captain, wicketKeeper, reservePlayer } = selectInitialPlaying11(teamPlayers);

      const name = isUserTeam ? teamName : PERSONALITY_NAMES[personality] || generateTeamName(faction);
      const primaryColor = orderedColors[i % orderedColors.length].primary;
      const secondaryColor = orderedColors[i % orderedColors.length].secondary;
      const logo = isUserTeam ? logoUrl : generateFantasyLogo(name, primaryColor, secondaryColor, i);

      teams.push({
        id: isUserTeam ? 'user_team' : `team_${i}`,
        name,
        coach: isUserTeam ? managerName : generateCoachName(faction),
        logo,
        budget: isUserTeam ? 4000000 : 4000000,
        staff: [],
        facilities: { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
        players: startWithAuction ? [] : teamPlayers,
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
        faction,
        colorPrimary: primaryColor,
        colorSecondary: secondaryColor,
        playing11: startWithAuction ? undefined : playing11,
        captain: startWithAuction ? undefined : captain,
        wicketKeeper: startWithAuction ? undefined : wicketKeeper,
        reservePlayer: startWithAuction ? undefined : reservePlayer
      });
    }
    
    // Add 30 additional random players for the available pool/market
    const extraPlayers = generatePlayerPool(30);
    playerPool = [...playerPool, ...extraPlayers];
    
    playerStore.initialize(playerPool);
    teamStore.initialize(teams);
    tournamentStore.initialize(teams);
    scheduleStore.initialize(teams);
    
    if (startWithAuction) {
      gamePhase.set('auction');
    } else {
      gamePhase.set('tournament');
    }
    isFirstLogin.set(true);
  }
}

export async function saveCurrentGame(userBudget: number) {
  let teams: Team[] = [];
  let players: Player[] = [];
  let matches: Match[] = [];
  let schedule: TournamentSchedule | null = null;
  let day = 1;
  let season = 1;
  let phase = 'menu';
  let firstLogin = false;
  
  teamStore.subscribe(t => teams = t)();
  playerStore.subscribe(p => players = p)();
  tournamentStore.subscribe(m => matches = m)();
  scheduleStore.subscribe(s => schedule = s)();
  currentDay.subscribe(d => day = d)();
  currentSeason.subscribe(s => season = s)();
  gamePhase.subscribe(p => phase = p)();
  isFirstLogin.subscribe(f => firstLogin = f)();
  
  const userTeam = teams.find(t => t.isUserTeam);
  
  await saveGame({
    version: '1.4.2',
    userTeamId: userTeam?.id || 'user_team',
    teams,
    players,
    tournamentMatches: matches,
    schedule: schedule || undefined,
    currentDay: day,
    currentSeason: season,
    gamePhase: phase,
    isFirstLogin: firstLogin,
    userBudget,
    savedAt: Date.now()
  });
}

export async function resetGame() {
  await clearSave();
  playerStore.initialize();
  teamStore.initialize();
  tournamentStore.initialize([]);
  currentDay.set(1);
  currentSeason.set(1);
  gamePhase.set('menu');
  isFirstLogin.set(false);
}

export function upgradePlayerStat(playerId: string, teamId: string, statName: keyof import('../models/player').PlayerStats, xpCost: number, creditCost: number) {
  playerStore.update(players => 
    players.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          xp: Math.max(0, (p.xp || 0) - xpCost),
          stats: {
            ...p.stats,
            [statName]: Math.min(100, p.stats[statName] + 1)
          }
        };
      }
      return p;
    })
  );

  teamStore.update(teams => 
    teams.map(t => {
      if (t.id !== teamId) return t;
      return {
        ...t,
        players: t.players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              xp: Math.max(0, (p.xp || 0) - xpCost),
              stats: {
                ...p.stats,
                [statName]: Math.min(100, p.stats[statName] + 1)
              }
            };
          }
          return p;
        })
      };
    })
  );

  teamStore.updateBudget(teamId, -creditCost);
}

export function startNewSeason() {
  // 1. Reset currentDay to 1
  currentDay.set(1);
  
  // 2. Reset team standings stats to 0, reset player fatigue, and clear player tournamentStats
  teamStore.update(teams => 
    teams.map(t => {
      const { playing11, captain, wicketKeeper, reservePlayer } = selectInitialPlaying11(t.players);
      return {
        ...t,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        runsFor: 0,
        runsAgainst: 0,
        playing11,
        captain,
        wicketKeeper,
        reservePlayer,
        players: t.players.map(p => ({
          ...p,
          fatigue: 0,
          tournamentStats: { runs: 0, wickets: 0, catches: 0 }
        }))
      };
    })
  );

  // 3. Reset playerPool tournament stats
  playerStore.update(players =>
    players.map(p => ({
      ...p,
      tournamentStats: { runs: 0, wickets: 0, catches: 0 }
    }))
  );

  // 4. Generate new tournament schedule
  let currentTeams: Team[] = [];
  teamStore.subscribe(t => currentTeams = t)();
  scheduleStore.initialize(currentTeams);

  // 5. Save the game with the new state
  const userTeam = currentTeams.find(t => t.isUserTeam);
  saveCurrentGame(userTeam?.budget || 0);

  // 6. Set phase to tournament
  gamePhase.set('tournament');
}