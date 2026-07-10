import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type { Player } from '../models/player';
import type { Team } from '../models/team';
import type { Match } from '../models/match';
import type { TournamentSchedule } from '../core/schedule';
import { generatePlayerPool, generateTeamName, generateCoachName, generateBalancedSquad } from '../core/draftAI';
import { TEAM_PERSONALITIES, createTeamTendency, PERSONALITY_NAMES, generateFantasyLogo } from '../core/teamBuilder';
import { generateTournamentSchedule, simulateAllMatchesForDay, aiMatchInnings } from '../core/schedule';
import { loadGame, saveGame, clearSave, loadTheme, saveTheme } from '../utils/storage';
import { selectInitialPlaying11, TEAM_COLORS } from './colorPalette';
import { processRetentions, isMegaAuction } from '../core/retentionSystem';
import { processSeasonEnd } from '../core/seasonTransition';
import { postMatchMoraleUpdate } from '../core/matchEngine';
import { updatePopularity, calculateHomeAdvantage } from '../core/fanSystem';
import { recoverFromInjury } from '../core/injurySystem';

export type GamePhase = 'menu' | 'draft' | 'tournament' | 'match' | 'season_end' | 'retention' | 'scouting' | 'trading' | 'auction';

export interface LogEntry {
  message: string;
  timestamp: number;
  teamId?: string;
  type?: 'bid' | 'sold' | 'unsold' | 'system';
}

export interface AuctionState {
  isActive: boolean;
  availablePlayers: Player[];
  currentPlayerIndex: number;
  currentPlayer: Player | null;
  currentBid: number;
  currentBidderId: string | null;
  timer: number;
  auctionLog: LogEntry[];
  lastAiBidderId: string | null;
  showAiBidFlash: boolean;
}

interface GameContextType {
  // Loading state
  isLoading: boolean;
  
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  hasSavedGame: boolean;
  continueGame: () => void;

  // Game state variables
  players: Player[];
  teams: Team[];
  tournamentMatches: Match[];
  schedule: TournamentSchedule | null;
  currentDay: number;
  currentSeason: number;
  gamePhase: GamePhase;
  isFirstLogin: boolean;
  
  // Derived state (useMemo)
  userTeam: Team | undefined;
  availablePlayers: Player[];
  
  // State set/update actions
  initializeGame: (
    teamName?: string, 
    managerName?: string, 
    logoUrl?: string,
    startWithAuction?: boolean,
    userColorIndex?: number
  ) => Promise<void>;
  saveCurrentGame: (userBudget: number) => Promise<void>;
  resetGame: () => Promise<void>;
  upgradePlayerStat: (playerId: string, teamId: string, statName: keyof import('../models/player').PlayerStats, xpCost: number, creditCost: number) => void;
  startNewSeason: () => void;
  advanceToNextDay: () => void;
  updateMatchResult: (
    matchId: string,
    winner: string,
    team1Score: number,
    team2Score: number,
    playerStatsUpdates?: Record<string, { runs: number; wickets: number; catches: number; matches: number; runOuts: number; xp: number }>,
    budgetUpdates?: Record<string, number>
  ) => void;
  setGamePhase: (phase: GamePhase) => void;
  resolveSeasonEnd: () => import('../core/seasonTransition').SeasonAwards;
  confirmRetentions: (retainedIds: string[]) => { success: boolean, message: string };
  scoutPlayer: (playerId: string) => { success: boolean, message: string };
  startAuctionPhase: () => void;
  renamePlayer: (playerId: string, newName: string) => void;
  updateTeamLineup: (playing11: string[], captain: string, wicketKeeper: string, reservePlayer: string) => void;
  trainPlayerStat: (playerId: string, statName: 'batting' | 'bowling' | 'power' | 'technique' | 'fielding', cost: number, increment: number) => void;
  upgradeFacility: (facility: 'stadium' | 'training' | 'medical', cost: number) => void;
  hireStaff: (staff: any, cost: number) => void;
  fireStaff: (staffId: string, severance: number) => void;
  addSponsorship: (sponsorship: any) => void;
  removeSponsorship: (sponsorshipId: string) => void;
  
  // Auction actions & state
  auctionState: AuctionState;
  initializeAuction: () => void;
  startAuctionTimer: () => void;
  stopAuctionTimer: () => void;
  placeAuctionBid: (teamId: string, amount?: number, isAiBid?: boolean) => void;
  fastForwardAuctionPlayer: () => void;
  autoCompleteAuction: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Game states
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentMatches, setTournamentMatches] = useState<Match[]>([]);
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(null);
  const [currentDay, setCurrentDayState] = useState(1);
  const [currentSeason, setCurrentSeasonState] = useState(1);
  const [gamePhase, setGamePhaseState] = useState<GamePhase>('menu');
  const [isFirstLogin, setIsFirstLoginState] = useState(false);
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [savedGamePhase, setSavedGamePhase] = useState<GamePhase | null>(null);
  
  // Derived state
  const userTeam = useMemo(() => teams.find(t => t.isUserTeam), [teams]);
  const availablePlayers = useMemo(() => players.filter(p => p.isAvailable), [players]);
  
  // Refs for auction tick intervals to persist across renders
  const tickIntervalRef = useRef<any>(null);
  const aiFlashTimeoutRef = useRef<any>(null);

  // Auction state
  const [auctionState, setAuctionState] = useState<AuctionState>({
    isActive: false,
    availablePlayers: [],
    currentPlayerIndex: 0,
    currentPlayer: null,
    currentBid: 0,
    currentBidderId: null,
    timer: 0,
    auctionLog: [],
    lastAiBidderId: null,
    showAiBidFlash: false
  });

  // Load game state from AsyncStorage on mount
  useEffect(() => {
    async function loadInitialState() {
      try {
        const savedTheme = await loadTheme();
        setThemeState(savedTheme);
        const saved = await loadGame();
        if (saved) {
          setPlayers(saved.players);
          
          // Sanitize teams to ensure playing11, captain, keeper are set
          const sanitizedTeams = saved.teams.map((t: Team) => {
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
          
          setTeams(sanitizedTeams);
          setTournamentMatches(saved.tournamentMatches);
          setCurrentDayState(saved.currentDay);
          setCurrentSeasonState(saved.currentSeason || 1);
          setIsFirstLoginState(saved.isFirstLogin ?? false);
          
          // Force gamePhase to 'menu' so that App always displays Main Menu on load
          setGamePhaseState('menu');
          setSavedGamePhase((saved.gamePhase as GamePhase) || 'tournament');
          setHasSavedGame(true);

          if (saved.schedule) {
            setSchedule(saved.schedule);
          } else {
            const newSchedule = generateTournamentSchedule(sanitizedTeams, 1);
            setSchedule(newSchedule);
          }
        } else {
          setHasSavedGame(false);
        }
      } catch (err) {
        console.error('Failed to load save during app load:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialState();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (aiFlashTimeoutRef.current) clearTimeout(aiFlashTimeoutRef.current);
    };
  }, []);

  // Auto-save whenever critical state changes
  useEffect(() => {
    if (isLoading || teams.length === 0) return;
    
    const saveTimer = setTimeout(async () => {
      const userBudgetVal = teams.find(t => t.isUserTeam)?.budget ?? 4000000;
      await saveGame({
        version: '1.4.2',
        userTeamId: 'user_team',
        teams,
        players,
        tournamentMatches,
        schedule: schedule || undefined,
        currentDay,
        currentSeason,
        gamePhase,
        isFirstLogin,
        userBudget: userBudgetVal,
        savedAt: Date.now()
      });
    }, 500); // debounce save by 500ms
    
    return () => clearTimeout(saveTimer);
  }, [teams, players, tournamentMatches, schedule, currentDay, currentSeason, gamePhase, isFirstLogin, isLoading]);

  // Actions
  const initializeGame = async (
    teamName: string = 'Your Team', 
    managerName: string = 'You', 
    logoUrl: string = '',
    startWithAuction: boolean = false,
    userColorIndex: number = 0
  ) => {
    const freshTeams: Team[] = [];
    let freshPlayerPool: Player[] = [];
    const factionTypes = ['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'] as const;
    
    // Order colors by swapping selected user color scheme to index 0
    const orderedColors = [...TEAM_COLORS];
    if (userColorIndex >= 0 && userColorIndex < TEAM_COLORS.length) {
      const selected = orderedColors.splice(userColorIndex, 1)[0];
      orderedColors.unshift(selected);
    }

    // 8 teams: User at index 0, 7 AI with unique personalities
    for (let i = 0; i < 8; i++) {
      const isUser = i === 0;
      const faction = factionTypes[i % factionTypes.length];
      const personality = isUser ? 'balanced' : TEAM_PERSONALITIES[i - 1] || 'balanced';
      const tendency = createTeamTendency(personality);
      const teamPlayers = generateBalancedSquad(faction)
        .map(p => ({ ...p, isAvailable: startWithAuction }));
      
      freshPlayerPool = [...freshPlayerPool, ...teamPlayers];
      const { playing11, captain, wicketKeeper, reservePlayer } = selectInitialPlaying11(teamPlayers);

      const name = isUser ? teamName : PERSONALITY_NAMES[personality] || generateTeamName(faction);
      const primaryColor = orderedColors[i % orderedColors.length].primary;
      const secondaryColor = orderedColors[i % orderedColors.length].secondary;
      const logo = isUser ? logoUrl : generateFantasyLogo(name, primaryColor, secondaryColor, i);

      freshTeams.push({
        id: isUser ? 'user_team' : `team_${i}`,
        name,
        coach: isUser ? managerName : generateCoachName(faction),
        logo,
        budget: 4000000,
        staff: [],
        facilities: { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 },
        players: startWithAuction ? [] : teamPlayers,
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        runsFor: 0,
        runsAgainst: 0,
        isUserTeam: isUser,
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
    freshPlayerPool = [...freshPlayerPool, ...extraPlayers];
    
    setPlayers(freshPlayerPool);
    setTeams(freshTeams);
    
    // Create initial tournament matches
    const matches: Match[] = [];
    let matchNum = 1;
    for (let i = 0; i < freshTeams.length; i++) {
      for (let j = i + 1; j < freshTeams.length; j++) {
        matches.push({
          id: `match_${matchNum}_${i}_${j}`,
          team1Id: freshTeams[i].id,
          team2Id: freshTeams[j].id,
          team1Name: freshTeams[i].name,
          team2Name: freshTeams[j].name,
          matchNumber: matchNum,
          status: 'scheduled',
          currentInnings: 1
        });
        matchNum++;
      }
    }
    setTournamentMatches(matches);
    
    const sched = generateTournamentSchedule(freshTeams, 1);
    setSchedule(sched);
    
    setCurrentDayState(1);
    setCurrentSeasonState(1);
    setIsFirstLoginState(true);
    
    const nextPhase = startWithAuction ? 'auction' : 'tournament';
    setGamePhaseState(nextPhase);
    setHasSavedGame(true);
    setSavedGamePhase(nextPhase);
    
    // Save state immediately
    await saveGame({
      version: '1.4.2',
      userTeamId: 'user_team',
      teams: freshTeams,
      players: freshPlayerPool,
      tournamentMatches: matches,
      schedule: sched,
      currentDay: 1,
      currentSeason: 1,
      gamePhase: nextPhase,
      isFirstLogin: true,
      userBudget: 4000000,
      savedAt: Date.now()
    });
  };

  const saveCurrentGame = async (userBudget: number) => {
    const saveObj = {
      version: '1.4.2',
      userTeamId: 'user_team',
      teams,
      players,
      tournamentMatches,
      schedule: schedule || undefined,
      currentDay,
      currentSeason,
      gamePhase,
      isFirstLogin,
      userBudget,
      savedAt: Date.now()
    };
    await saveGame(saveObj);
  };

  const resetGame = async () => {
    await clearSave();
    setPlayers([]);
    setTeams([]);
    setTournamentMatches([]);
    setSchedule(null);
    setCurrentDayState(1);
    setCurrentSeasonState(1);
    setIsFirstLoginState(false);
    setHasSavedGame(false);
    setSavedGamePhase(null);
    setGamePhaseState('menu');
  };

  const continueGame = () => {
    if (savedGamePhase) {
      setGamePhaseState(savedGamePhase);
    } else {
      setGamePhaseState('tournament');
    }
  };

  const upgradePlayerStat = (
    playerId: string, 
    teamId: string, 
    statName: keyof import('../models/player').PlayerStats, 
    xpCost: number, 
    creditCost: number
  ) => {
    setPlayers(prev => prev.map(p => {
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
    }));

    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      return {
        ...t,
        budget: t.budget - creditCost,
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
    }));
  };

  const advanceToNextDay = () => {
    if (!schedule) return;
    
    const nextDay = Math.min(schedule.currentDay + 1, schedule.totalDays);
    
    // 1. Simulate all other scheduled matches for currentDay (which are AI vs AI matches)
    const updatedSchedule = simulateAllMatchesForDay(schedule, schedule.currentDay, teams);
    updatedSchedule.currentDay = nextDay;

    // Filter completed AI matches
    const newlyCompletedMatches = updatedSchedule.matches.filter(m => 
      m.day === schedule.currentDay && 
      m.status === 'completed' && 
      m.result && 
      m.team1Id !== 'user_team' && 
      m.team2Id !== 'user_team'
    );

    // Make local copy of teams to mutate and update
    let nextTeams = teams.map(t => JSON.parse(JSON.stringify(t)));

    // Apply post-match morale/form updates to AI match players
    for (const match of newlyCompletedMatches) {
      const innsData = aiMatchInnings[match.id];
      if (!innsData) continue;
      const team1 = nextTeams.find(t => t.id === match.team1Id);
      const team2 = nextTeams.find(t => t.id === match.team2Id);
      if (!team1 || !team2) continue;
      const winner = match.result!.winner === match.team1Id ? 'team1' as const : match.result!.winner === match.team2Id ? 'team2' as const : 'draw' as const;
      postMatchMoraleUpdate(team1, team2, innsData.innings1, innsData.innings2, winner);
    }

    // 2. Apply wins, losses, draws, and sponsorship/match earnings to teams
    nextTeams = nextTeams.map(team => {
      const match = newlyCompletedMatches.find(m => m.team1Id === team.id || m.team2Id === team.id);
      if (!match || !match.result) return team;
      
      const isTeam1 = match.team1Id === team.id;
      const runsFor = isTeam1 ? match.result.team1Score : match.result.team2Score;
      const runsAgainst = isTeam1 ? match.result.team2Score : match.result.team1Score;
      
      const baseEarnings = 10000;
      const winBonus = 50000;
      let earnings = baseEarnings;
      
      let wins = team.wins;
      let losses = team.losses;
      let draws = team.draws;
      
      const teamResult = match.result.winner === team.id ? 'win' : match.result.winner === 'draw' ? 'draw' : 'loss';
      const newPopularity = updatePopularity(team.fanProfile?.popularity || 50, teamResult, runsFor);
      const homeAdvantage = match.team1Id === team.id ? calculateHomeAdvantage(newPopularity) : 0;
      const newStreak = newPopularity > 75 ? (team.fanProfile?.popularityStreak || 0) + 1 : 0;

      if (match.result.winner === team.id) {
        wins++;
        earnings += winBonus;
      } else if (match.result.winner === 'draw') {
        draws++;
      } else {
        losses++;
      }
      
      return {
        ...team,
        wins,
        losses,
        draws,
        matchesPlayed: team.matchesPlayed + 1,
        runsFor: team.runsFor + runsFor,
        runsAgainst: team.runsAgainst + runsAgainst,
        budget: team.budget + earnings,
        fanProfile: {
          ...(team.fanProfile || { homeAdvantage: 0, popularity: 50, revenue: 0, matchBonus: 0, popularityStreak: 0 }),
          popularity: newPopularity,
          homeAdvantage,
          revenue: (team.fanProfile?.revenue || 0) + earnings,
          popularityStreak: newStreak
        }
      };
    });

    // 3. Accumulate player stats (runs, wickets, catches, XP) from simulated AI matches
    const playerStats: Record<string, { runs: number; wickets: number; catches: number; xp: number }> = {};
    const addStat = (id: string, stat: string, value: number) => {
      if (!playerStats[id]) playerStats[id] = { runs: 0, wickets: 0, catches: 0, xp: 0 };
      (playerStats[id] as any)[stat] += value;
    };

    for (const match of newlyCompletedMatches) {
      if (!match.result) continue;
      const innsData = aiMatchInnings[match.id];
      if (!innsData) continue;

      const team1 = nextTeams.find(t => t.id === match.team1Id);
      const team2 = nextTeams.find(t => t.id === match.team2Id);
      if (!team1 || !team2) continue;

      [...team1.players.map((p: Player) => p.id), ...team2.players.map((p: Player) => p.id)]
        .forEach((id: string) => addStat(id, 'xp', 10));

      [innsData.innings1, innsData.innings2].forEach(inn => {
        inn.ballsFaced.forEach(ball => {
          if (ball.result !== 'wide' && ball.result !== 'noball') {
            addStat(ball.batsmanId, 'runs', ball.runs);
            addStat(ball.batsmanId, 'xp', ball.runs);
          }
          if (ball.isWicket) {
            if (ball.wicketType !== 'run out') {
              addStat(ball.bowlerId, 'wickets', 1);
              addStat(ball.bowlerId, 'xp', 15);
            }
            if ((ball.wicketType === 'caught' || ball.wicketType === 'stumped') && ball.fielderId) {
              addStat(ball.fielderId, 'catches', 1);
              addStat(ball.fielderId, 'xp', 10);
            }
          }
        });
      });
    }

    // Add milestones XP to playerStats
    Object.keys(playerStats).forEach(id => {
      const ps = playerStats[id];
      if (ps.runs >= 100) ps.xp += 100;
      else if (ps.runs >= 50) ps.xp += 50;
      if (ps.wickets >= 5) ps.xp += 100;
      else if (ps.wickets >= 3) ps.xp += 50;
      ps.xp = Math.round(ps.xp);
    });

    // 4. Update player details (fatigue, morale, form, injury, XP, performance) for ALL players in all teams
    nextTeams = nextTeams.map(team => {
      const teamMatch = schedule.matches.find(m => 
        m.day === schedule.currentDay && 
        (m.team1Id === team.id || m.team2Id === team.id)
      );
      const playedToday = !!teamMatch;

      // Find playing 11 IDs today
      const playing11Ids = new Set<string>();
      if (playedToday) {
        if (team.isUserTeam) {
          (team.playing11 || []).forEach((id: string) => playing11Ids.add(id));
        } else {
          const innsData = newlyCompletedMatches.find(m => m.id === teamMatch?.id) 
            ? aiMatchInnings[teamMatch!.id] 
            : null;
          if (innsData) {
            const inn = innsData.innings1.teamId === team.id ? innsData.innings1 : innsData.innings2;
            (inn.battingOrder || []).slice(0, 11).forEach((id: string) => playing11Ids.add(id));
          } else {
            (team.playing11 || team.players.slice(0, 11).map((p: Player) => p.id)).forEach((id: string) => playing11Ids.add(id));
          }
        }
      }

      const updatedPlayers = team.players.map((p: Player) => {
        let fatigue = p.fatigue || 0;
        let morale = p.morale || 50;
        let form = p.form || 0;

        // Rest recovery: if player did NOT play today, fatigue decreases by 10
        const didPlay = playedToday && playing11Ids.has(p.id);
        if (!didPlay && fatigue > 0) {
          fatigue = Math.max(0, fatigue - 10);
        }

        // Morale decay: if team played today and player did NOT play, morale drops by 4% (minimum 25%)
        if (playedToday && !didPlay) {
          morale = Math.max(25, morale - 4);
          form = Math.max(-10, Math.min(10, Math.round((morale - 50) / 5)));
        }

        let player = { ...p, fatigue, morale, form };
        
        // Apply injury healing/recovery
        let activeInjury = p.activeInjury;
        if (activeInjury) {
          const progressed = { ...activeInjury, currentDay: activeInjury.currentDay + 1 };
          if (progressed.currentDay >= progressed.recoveryDays) {
            player = recoverFromInjury(player);
          } else {
            player = { ...player, activeInjury: progressed };
          }
        }

        // Apply match performance stats (XP, runs, wickets, catches)
        const ps = playerStats[p.id];
        if (ps) {
          const ts = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
          player = {
            ...player,
            matches: (p.matches || 0) + 1,
            runsScored: (p.runsScored || 0) + ps.runs,
            wickets: (p.wickets || 0) + ps.wickets,
            catches: (p.catches || 0) + ps.catches,
            xp: (p.xp || 0) + ps.xp,
            lifetimeXp: (p.lifetimeXp || 0) + ps.xp,
            tournamentStats: {
              runs: (ts.runs || 0) + ps.runs,
              wickets: (ts.wickets || 0) + ps.wickets,
              catches: (ts.catches || 0) + ps.catches
            }
          };
        }

        return player;
      });

      return { ...team, players: updatedPlayers };
    });

    // Update global players state
    const nextPlayersPool = players.map((p: Player) => {
       const teamPlayer = nextTeams.flatMap(t => t.players).find(tp => tp.id === p.id);
       return teamPlayer ? teamPlayer : p;
    });

    // Update TournamentMatches list state
    const updatedTournamentMatches = tournamentMatches.map(m => {
       const schedMatch = updatedSchedule.matches.find(sm => sm.id === m.id);
       if (schedMatch && schedMatch.status === 'completed') {
          return { ...m, status: 'completed' as const, winner: schedMatch.result?.winner || '' };
       }
       return m;
    });

    // 5. Update React states
    setTeams(nextTeams);
    setPlayers(nextPlayersPool);
    setSchedule(updatedSchedule);
    setTournamentMatches(updatedTournamentMatches);
    setCurrentDayState(nextDay);

    // Save Game State to Storage
    const userTeamCopy = nextTeams.find(t => t.isUserTeam);
    const saveObj = {
      version: '1.4.2',
      userTeamId: 'user_team',
      teams: nextTeams,
      players: nextPlayersPool,
      tournamentMatches: updatedTournamentMatches,
      schedule: updatedSchedule,
      currentDay: nextDay,
      currentSeason,
      gamePhase,
      isFirstLogin,
      userBudget: userTeamCopy?.budget || 4000000,
      savedAt: Date.now()
    };
    saveGame(saveObj);
  };

  const updateMatchResult = (
    matchId: string,
    winner: string,
    team1Score: number,
    team2Score: number,
    playerStatsUpdates?: Record<string, { runs: number; wickets: number; catches: number; matches: number; runOuts: number; xp: number }>,
    budgetUpdates?: Record<string, number>
  ) => {
    // 1. Update Schedule Match
    let nextSchedule = schedule;
    if (schedule) {
      nextSchedule = {
        ...schedule,
        matches: schedule.matches.map(m => 
          m.id === matchId 
            ? { ...m, status: 'completed' as const, result: { winner, team1Score, team2Score } }
            : m
        )
      };
      setSchedule(nextSchedule);
    }

    // 2. Update TournamentMatches list
    const nextTournamentMatches = tournamentMatches.map(m => 
      m.id === matchId 
        ? { ...m, status: 'completed' as const, winner } 
        : m
    );
    setTournamentMatches(nextTournamentMatches);

    // 3. Update Team records & player stats
    const targetMatch = schedule?.matches.find(m => m.id === matchId);
    let nextTeams = teams;
    if (targetMatch) {
      const team1Id = targetMatch.team1Id;
      const team2Id = targetMatch.team2Id;

      nextTeams = teams.map(t => {
        let updatedPlayers = t.players;
        if (playerStatsUpdates) {
          updatedPlayers = t.players.map((p: Player) => {
            const updates = playerStatsUpdates[p.id];
            if (updates) {
              const ts = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
              return {
                ...p,
                matches: p.matches + (updates.matches || 0),
                runsScored: p.runsScored + (updates.runs || 0),
                wickets: p.wickets + (updates.wickets || 0),
                catches: p.catches + (updates.catches || 0),
                xp: (p.xp || 0) + (updates.xp || 0),
                lifetimeXp: (p.lifetimeXp || 0) + (updates.xp || 0),
                tournamentStats: {
                  runs: (ts.runs || 0) + (updates.runs || 0),
                  wickets: (ts.wickets || 0) + (updates.wickets || 0),
                  catches: (ts.catches || 0) + (updates.catches || 0)
                }
              };
            }
            return p;
          });
        }

        const bUpdate = budgetUpdates?.[t.id] || 0;

        if (t.id === team1Id) {
          const isWinner = winner === team1Id;
          return {
            ...t,
            wins: t.wins + (isWinner ? 1 : 0),
            losses: t.losses + (isWinner ? 0 : 1),
            matchesPlayed: t.matchesPlayed + 1,
            runsFor: t.runsFor + team1Score,
            runsAgainst: t.runsAgainst + team2Score,
            budget: t.budget + bUpdate,
            players: updatedPlayers
          };
        }
        if (t.id === team2Id) {
          const isWinner = winner === team2Id;
          return {
            ...t,
            wins: t.wins + (isWinner ? 1 : 0),
            losses: t.losses + (isWinner ? 0 : 1),
            matchesPlayed: t.matchesPlayed + 1,
            runsFor: t.runsFor + team2Score,
            runsAgainst: t.runsAgainst + team1Score,
            budget: t.budget + bUpdate,
            players: updatedPlayers
          };
        }
        return {
          ...t,
          budget: t.budget + bUpdate,
          players: updatedPlayers
        };
      });
      setTeams(nextTeams);
    }

    // 4. Update global Players list
    let nextPlayers = players;
    if (playerStatsUpdates) {
      nextPlayers = players.map((p: Player) => {
        const updates = playerStatsUpdates[p.id];
        if (updates) {
          const ts = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
          return {
            ...p,
            matches: p.matches + (updates.matches || 0),
            runsScored: p.runsScored + (updates.runs || 0),
            wickets: p.wickets + (updates.wickets || 0),
            catches: p.catches + (updates.catches || 0),
            xp: (p.xp || 0) + (updates.xp || 0),
            lifetimeXp: (p.lifetimeXp || 0) + (updates.xp || 0),
            tournamentStats: {
              runs: (ts.runs || 0) + (updates.runs || 0),
              wickets: (ts.wickets || 0) + (updates.wickets || 0),
              catches: (ts.catches || 0) + (updates.catches || 0)
            }
          };
        }
        return p;
      });
      setPlayers(nextPlayers);
    }

    // Save Game State to Storage
    const userTeamCopy = nextTeams.find(t => t.isUserTeam);
    const saveObj = {
      version: '1.4.2',
      userTeamId: 'user_team',
      teams: nextTeams,
      players: nextPlayers,
      tournamentMatches: nextTournamentMatches,
      schedule: nextSchedule || undefined,
      currentDay,
      currentSeason,
      gamePhase,
      isFirstLogin,
      userBudget: userTeamCopy?.budget || 4000000,
      savedAt: Date.now()
    };
    saveGame(saveObj);
  };

  const startNewSeason = () => {
    const nextSeason = currentSeason + 1;
    setCurrentSeasonState(nextSeason);
    setCurrentDayState(1);

    setTeams(prevTeams => {
      const nextTeams = prevTeams.map(t => {
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
      });

      // Generate schedule
      const nextSched = generateTournamentSchedule(nextTeams, nextSeason);
      setSchedule(nextSched);
      
      return nextTeams;
    });

    setPlayers(prevPlayers => prevPlayers.map(p => ({
      ...p,
      tournamentStats: { runs: 0, wickets: 0, catches: 0 }
    })));

    setGamePhaseState('tournament');
  };

  // Auction implementation
  const initializeAuction = () => {
    const pool = players.filter(p => p.isAvailable && !p.retiring);
    const sorted = [...pool].sort((a, b) => b.marketValue - a.marketValue);
    
    setAuctionState({
      isActive: true,
      availablePlayers: sorted,
      currentPlayerIndex: 0,
      currentPlayer: sorted[0] || null,
      currentBid: sorted[0] ? sorted[0].marketValue : 0,
      currentBidderId: null,
      timer: 5,
      auctionLog: [{ message: 'Auction has started!', timestamp: Date.now(), type: 'system' }],
      lastAiBidderId: null,
      showAiBidFlash: false
    });
  };

  const startAuctionTimer = () => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    
    tickIntervalRef.current = setInterval(() => {
      // 1. Process random AI bids
      setAuctionState(prev => {
        if (!prev.isActive || prev.timer <= 0) return prev;
        
        // Give AI a 40% chance of bidding in this second
        if (Math.random() < 0.4) {
          const nextBid = calculateNextBidAmount(prev.currentBid, prev.currentPlayer?.marketValue ?? 0, prev.currentBidderId);
          const bestAi = selectBestAiBidder(prev.currentPlayer, nextBid, prev.currentBidderId);
          if (bestAi) {
            // Trigger AI bid
            if (aiFlashTimeoutRef.current) clearTimeout(aiFlashTimeoutRef.current);
            aiFlashTimeoutRef.current = setTimeout(() => {
              setAuctionState(s => ({ ...s, showAiBidFlash: false }));
            }, 500);

            return {
              ...prev,
              currentBid: nextBid,
              currentBidderId: bestAi.id,
              timer: 5, // Reset timer
              showAiBidFlash: true,
              lastAiBidderId: bestAi.id,
              auctionLog: [
                { message: `${bestAi.name} bids $${nextBid.toLocaleString()}`, teamId: bestAi.id, type: 'bid', timestamp: Date.now() } as LogEntry,
                ...prev.auctionLog
              ].slice(0, 10)
            };
          }
        }
        
        return prev;
      });

      // 2. Decrement Timer
      setAuctionState(prev => {
        if (!prev.isActive) return prev;
        
        if (prev.timer > 0) {
          return { ...prev, timer: prev.timer - 1 };
        } else {
          // Timer hit 0, resolve current player
          if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
          setTimeout(() => resolveCurrentAuctionPlayer(), 0);
          return prev;
        }
      });
    }, 1000);
  };

  const stopAuctionTimer = () => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
  };

  const placeAuctionBid = (teamId: string, amount?: number, isAiBid = false) => {
    setAuctionState(prev => {
      if (!prev.currentPlayer) return prev;
      
      let nextBid = amount;
      if (!nextBid) {
        nextBid = calculateNextBidAmount(prev.currentBid, prev.currentPlayer.marketValue, prev.currentBidderId);
      }

      const bidderTeam = teams.find(t => t.id === teamId);
      if (!bidderTeam || bidderTeam.budget < nextBid || bidderTeam.players.length >= 25) {
        return prev; // Can't afford or squad is full
      }

      // Clear existing AI flash timeout
      if (aiFlashTimeoutRef.current) clearTimeout(aiFlashTimeoutRef.current);

      let newState: AuctionState = {
        ...prev,
        currentBid: nextBid,
        currentBidderId: teamId,
        timer: 5, // Reset timer on new bid
        showAiBidFlash: false,
        lastAiBidderId: null,
        auctionLog: [
          { message: `${bidderTeam.name} bids $${nextBid.toLocaleString()}`, teamId, type: 'bid', timestamp: Date.now() } as LogEntry,
          ...prev.auctionLog
        ].slice(0, 10)
      };

      if (isAiBid) {
        newState.showAiBidFlash = true;
        newState.lastAiBidderId = teamId;
        aiFlashTimeoutRef.current = setTimeout(() => {
          setAuctionState(s => ({ ...s, showAiBidFlash: false }));
        }, 500);
      }
      
      return newState;
    });

    startAuctionTimer();
  };

  const calculateNextBidAmount = (current: number, base: number, bidderId: string | null) => {
    if (current === base && bidderId === null) {
      return current; // Initial bid starts at base price
    }
    let inc = 500;
    if (current >= 50000) inc = 2000;
    else if (current >= 10000) inc = 1000;
    return current + inc;
  };

  const selectBestAiBidder = (player: Player | null, requiredBid: number, currentBidder: string | null): Team | null => {
    if (!player) return null;
    
    let bestBidder: Team | null = null;
    let highestWillingness = 0;

    teams.forEach(t => {
      if (t.isUserTeam || t.id === currentBidder) return;
      if (t.players.length >= 25) return;

      const valScore = player.stats.batting + player.stats.bowling + player.stats.power + player.stats.technique;
      let maxWilling = player.marketValue * (1 + (valScore / 100));

      const roleCount = t.players.filter(p => p.role === player.role).length;
      if (roleCount < 2) maxWilling *= 1.5;
      else if (roleCount > 5) maxWilling *= 0.5;

      maxWilling = Math.min(maxWilling, t.budget * 0.3);

      if (maxWilling >= requiredBid && maxWilling > highestWillingness) {
        highestWillingness = maxWilling;
        bestBidder = t;
      }
    });

    return bestBidder;
  };

  const resolveCurrentAuctionPlayer = (instant = false) => {
    setAuctionState(prev => {
      if (!prev.currentPlayer) return prev;

      const p = prev.currentPlayer;
      const bidderId = prev.currentBidderId;
      const bidVal = prev.currentBid;

      let logMessage = '';
      let logType: 'sold' | 'unsold' = 'unsold';

      if (bidderId) {
        const winningTeam = teams.find(t => t.id === bidderId);
        logMessage = `SOLD! ${p.name} goes to ${winningTeam?.name} for $${bidVal.toLocaleString()}`;
        logType = 'sold';

        // Update Teams state: assign player & deduct budget
        setTeams(prevTeams => prevTeams.map(t => {
          if (t.id === bidderId) {
            return {
              ...t,
              budget: t.budget - bidVal,
              players: [...t.players, { ...p, isAvailable: false, price: bidVal }]
            };
          }
          return t;
        }));

        // Update Players pool: mark as unavailable
        setPlayers(prevPlayers => prevPlayers.map(pl => pl.id === p.id ? { ...pl, isAvailable: false, price: bidVal } : pl));
      } else {
        logMessage = `UNSOLD. ${p.name} returns to the pool.`;
        logType = 'unsold';
      }

      const nextLog = [
        { message: logMessage, teamId: bidderId ?? undefined, type: logType, timestamp: Date.now() } as LogEntry,
        ...prev.auctionLog
      ].slice(0, 10);

      // Trigger next player loading after brief delay
      if (instant) {
        setTimeout(() => triggerNextAuctionPlayer(true), 0);
      } else {
        setTimeout(() => triggerNextAuctionPlayer(false), 2000);
      }

      return {
        ...prev,
        auctionLog: nextLog
      };
    });
  };

  const triggerNextAuctionPlayer = (instant = false) => {
    setAuctionState(prev => {
      const nextIndex = prev.currentPlayerIndex + 1;
      const nextP = prev.availablePlayers[nextIndex];

      if (nextP) {
        const systemLog = [
          { message: `Now on the block: ${nextP.name} (Base Price: $${nextP.marketValue.toLocaleString()})`, type: 'system' as const, timestamp: Date.now() },
          ...prev.auctionLog
        ].slice(0, 10);

        if (!instant) {
          setTimeout(() => startAuctionTimer(), 0);
        }

        return {
          ...prev,
          currentPlayerIndex: nextIndex,
          currentPlayer: nextP,
          currentBid: nextP.marketValue,
          currentBidderId: null,
          timer: 5,
          auctionLog: systemLog
        };
      } else {
        // Auction complete!
        const finalLog = [
          { message: 'Auction Complete!', type: 'system' as const, timestamp: Date.now() },
          ...prev.auctionLog
        ].slice(0, 10);

        setTimeout(() => {
          stopAuctionTimer();
          startNewSeason();
        }, instant ? 0 : 3000);

        return {
          ...prev,
          isActive: false,
          currentPlayer: null,
          auctionLog: finalLog
        };
      }
    });
  };

  const fastForwardAuctionPlayer = () => {
    stopAuctionTimer();
    setAuctionState(prev => {
      if (!prev.currentPlayer) return prev;
      
      let curBid = prev.currentBid;
      let curBidder = prev.currentBidderId;
      let loop = true;
      let safeCount = 0;

      while (loop && safeCount < 50) {
        const nextRequired = calculateNextBidAmount(curBid, prev.currentPlayer.marketValue, curBidder);
        const best = selectBestAiBidder(prev.currentPlayer, nextRequired, curBidder);
        
        if (best && Math.random() > 0.3) {
          curBid = nextRequired;
          curBidder = best.id;
          safeCount++;
        } else {
          loop = false;
        }
      }

      // Set state to fast forwarded results and immediately resolve
      const nextState = {
        ...prev,
        currentBid: curBid,
        currentBidderId: curBidder,
        timer: 0
      };

      setTimeout(() => resolveCurrentAuctionPlayer(true), 0);
      return nextState;
    });
  };

  const autoCompleteAuction = () => {
    stopAuctionTimer();
    
    // Simulate resolution for all remaining players
    setAuctionState(prev => {
      let currentTeams = [...teams];
      let currentPlayers = [...players];
      let currentIndex = prev.currentPlayerIndex;
      const pool = prev.availablePlayers;
      const logs = [...prev.auctionLog];

      while (currentIndex < pool.length) {
        const p = pool[currentIndex];
        let curBid = p.marketValue;
        let curBidder: string | null = null;
        let loop = true;
        let safeCount = 0;

        // Bidding war simulation
        while (loop && safeCount < 50) {
          const nextRequired = calculateNextBidAmount(curBid, p.marketValue, curBidder);
          
          // Select AI bidder
          let bestBidder: Team | null = null;
          let highestWillingness = 0;
          for (const t of currentTeams) {
            if (t.isUserTeam || t.id === curBidder) continue;
            if (t.players.length >= 25) continue;

            const valScore = p.stats.batting + p.stats.bowling + p.stats.power + p.stats.technique;
            let maxWilling = p.marketValue * (1 + (valScore / 100));

            const roleCount = t.players.filter(pl => pl.role === p.role).length;
            if (roleCount < 2) maxWilling *= 1.5;
            else if (roleCount > 5) maxWilling *= 0.5;

            maxWilling = Math.min(maxWilling, t.budget * 0.3);

            if (maxWilling >= nextRequired && maxWilling > highestWillingness) {
              highestWillingness = maxWilling;
              bestBidder = t;
            }
          }

          if (bestBidder && Math.random() > 0.3) {
            curBid = nextRequired;
            curBidder = bestBidder.id;
            safeCount++;
          } else {
            loop = false;
          }
        }

        if (curBidder) {
          const winningTeam = currentTeams.find(t => t.id === curBidder);
          logs.unshift({
            message: `SOLD! ${p.name} goes to ${winningTeam?.name} for $${curBid.toLocaleString()}`,
            teamId: curBidder,
            type: 'sold',
            timestamp: Date.now()
          });

          // update local teams
          currentTeams = currentTeams.map(t => {
            if (t.id === curBidder) {
              return {
                ...t,
                budget: t.budget - curBid,
                players: [...t.players, { ...p, isAvailable: false, price: curBid }]
              };
            }
            return t;
          });

          // update local players
          currentPlayers = currentPlayers.map(pl => pl.id === p.id ? { ...pl, isAvailable: false, price: curBid } : pl);
        } else {
          logs.unshift({
            message: `UNSOLD. ${p.name} returns to the pool.`,
            type: 'unsold',
            timestamp: Date.now()
          });
        }

        currentIndex++;
      }

      // Sync React states
      setTeams(currentTeams);
      setPlayers(currentPlayers);
      
      // Auto-schedule new season
      setTimeout(() => {
        const nextSeason = currentSeason + 1;
        setCurrentSeasonState(nextSeason);
        setCurrentDayState(1);

        const nextTeams = currentTeams.map(t => {
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
            players: t.players.map(pl => ({
              ...pl,
              fatigue: 0,
              tournamentStats: { runs: 0, wickets: 0, catches: 0 }
            }))
          };
        });

        setTeams(nextTeams);
        setPlayers(currentPlayers.map(pl => ({
          ...pl,
          tournamentStats: { runs: 0, wickets: 0, catches: 0 }
        })));

        const nextSched = generateTournamentSchedule(nextTeams, nextSeason);
        setSchedule(nextSched);
        
        setGamePhaseState('tournament');
      }, 100);

      return {
        ...prev,
        isActive: false,
        currentPlayer: null,
        currentPlayerIndex: currentIndex,
        auctionLog: logs.slice(0, 10)
      };
    });
  };

  const setGamePhase = (phase: GamePhase) => {
    setGamePhaseState(phase);
  };

  const resolveSeasonEnd = () => {
    const result = processSeasonEnd(teams, players, 'user_team');
    setTeams(result.updatedTeams);
    setPlayers(result.updatedPlayers);
    setCurrentSeasonState(prev => prev + 1);
    setGamePhaseState('season_end');
    return result.awards;
  };

  const confirmRetentions = (retainedIds: string[]) => {
    if (!userTeam) return { success: false, message: 'No user team found.' };
    const isMega = isMegaAuction(currentSeason + 1);
    const result = processRetentions(
      'user_team',
      retainedIds,
      isMega,
      userTeam.budget,
      players,
      teams
    );

    if (result.success) {
      setTeams(result.updatedTeams);
      setPlayers(result.updatedPlayers);
      setGamePhaseState('scouting');
      return { success: true, message: result.message };
    }
    return { success: false, message: result.message };
  };

  const scoutPlayer = (playerId: string) => {
    const SCOUT_COST = 500;
    if (!userTeam || userTeam.budget < SCOUT_COST) {
      return { success: false, message: `Not enough budget. Scouting costs $${SCOUT_COST.toLocaleString()}.` };
    }

    setTeams(prev => prev.map(t => {
      if (t.isUserTeam) return { ...t, budget: t.budget - SCOUT_COST };
      return t;
    }));

    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) return { ...p, isScouted: true };
      return p;
    }));

    return { success: true, message: 'Scout report completed!' };
  };

  const startAuctionPhase = () => {
    setGamePhaseState('auction');
  };

  const renamePlayer = (playerId: string, newName: string) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam) {
        return {
          ...t,
          players: t.players.map(p => {
            if (p.id === playerId) {
              return { ...p, name: newName, originalName: p.originalName || p.name };
            }
            return p;
          })
        };
      }
      return t;
    }));

    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        return { ...p, name: newName, originalName: p.originalName || p.name };
      }
      return p;
    }));
  };

  const updateTeamLineup = (playing11: string[], captain: string, wicketKeeper: string, reservePlayer: string) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam) {
        return {
          ...t,
          playing11,
          captain,
          wicketKeeper,
          reservePlayer
        };
      }
      return t;
    }));
  };

  const trainPlayerStat = (
    playerId: string, 
    statName: 'batting' | 'bowling' | 'power' | 'technique' | 'fielding', 
    cost: number, 
    increment: number
  ) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        return {
          ...p,
          stats: {
            ...p.stats,
            [statName]: Math.min(100, p.stats[statName] + increment)
          }
        };
      }
      return p;
    }));

    setTeams(prev => prev.map(t => {
      if (t.isUserTeam) {
        return {
          ...t,
          budget: t.budget - cost,
          players: t.players.map(p => {
            if (p.id === playerId) {
              return {
                ...p,
                stats: {
                  ...p.stats,
                  [statName]: Math.min(100, p.stats[statName] + increment)
                }
              };
            }
            return p;
          })
        };
      }
      return t;
    }));
  };

  const upgradeFacility = (facility: 'stadium' | 'training' | 'medical', cost: number) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam && t.budget >= cost) {
        const nextFacilities = { ...t.facilities };
        if (facility === 'stadium') nextFacilities.stadiumLevel++;
        if (facility === 'training') nextFacilities.trainingLevel++;
        if (facility === 'medical') nextFacilities.medicalLevel++;
        return {
          ...t,
          budget: t.budget - cost,
          facilities: nextFacilities
        };
      }
      return t;
    }));
  };

  const hireStaff = (staff: any, cost: number) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam && t.budget >= cost) {
        return {
          ...t,
          budget: t.budget - cost,
          staff: [...t.staff, staff]
        };
      }
      return t;
    }));
  };

  const fireStaff = (staffId: string, severance: number) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam && t.budget >= severance) {
        return {
          ...t,
          budget: t.budget - severance,
          staff: t.staff.filter((s: any) => s.id !== staffId)
        };
      }
      return t;
    }));
  };

  const addSponsorship = (sponsorship: any) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam) {
        return {
          ...t,
          sponsorships: [...(t.sponsorships || []), sponsorship]
        };
      }
      return t;
    }));
  };

  const removeSponsorship = (sponsorshipId: string) => {
    setTeams(prev => prev.map(t => {
      if (t.isUserTeam) {
        return {
          ...t,
          sponsorships: (t.sponsorships || []).filter((s: any) => s.id !== sponsorshipId)
        };
      }
      return t;
    }));
  };

  const setTheme = async (nextTheme: 'light' | 'dark') => {
    setThemeState(nextTheme);
    await saveTheme(nextTheme);
  };

  return (
    <GameContext.Provider value={{
      isLoading,
      theme,
      setTheme,
      hasSavedGame,
      continueGame,
      players,
      teams,
      tournamentMatches,
      schedule,
      currentDay,
      currentSeason,
      gamePhase,
      isFirstLogin,
      userTeam,
      availablePlayers,
      initializeGame,
      saveCurrentGame,
      resetGame,
      upgradePlayerStat,
      startNewSeason,
      advanceToNextDay,
      updateMatchResult,
      setGamePhase,
      resolveSeasonEnd,
      confirmRetentions,
      scoutPlayer,
      startAuctionPhase,
      renamePlayer,
      updateTeamLineup,
      trainPlayerStat,
      upgradeFacility,
      hireStaff,
      fireStaff,
      addSponsorship,
      removeSponsorship,
      auctionState,
      initializeAuction,
      startAuctionTimer,
      stopAuctionTimer,
      placeAuctionBid,
      fastForwardAuctionPlayer,
      autoCompleteAuction
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
