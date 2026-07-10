import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGame, GamePhase } from '../state/GameContext';
import { THEME, useStyles, darkColors, useThemeColors } from '../utils/theme';
import { resolveBall, updateFatigueAndMorale, calculateCurrentRunRate, getOverBalls, postMatchMoraleUpdate, resolveMatch } from '../core/matchEngine';
import { getAIIntent } from '../core/teamBuilder';
import { gameAudio } from '../utils/audio';
import type { Player } from '../models/player';
import type { Team } from '../models/team';
import type { Match, innings, IntentType, BallType, BallEvent } from '../models/match';
import { Play, Pause, SkipForward, ArrowRight, Shield, Award, Volume2, VolumeX, ClipboardList, BookOpen } from 'lucide-react-native';
import { getPortraitAsset } from '../utils/portraitMap';
import { loadActiveMatch, saveActiveMatch, clearActiveMatch } from '../utils/storage';

const WEATHER_EMOJIS: Record<string, string> = { sunny: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️' };
const PITCH_EMOJIS: Record<string, string> = { flat: '🎯', balanced: '⚖️', turning: '🔄', seaming: '🌊', bouncing: '🏐' };

const INTENT_LEVELS: IntentType[] = ['very_defensive', 'defensive', 'balanced', 'aggressive', 'very_aggressive'];
const INTENT_COLORS: Record<IntentType, string> = {
  very_defensive: '#6366f1',
  defensive: '#3b82f6',
  balanced: '#fbbf24',
  aggressive: '#22c55e',
  very_aggressive: '#ef4444',
};

const getBatsmanIntentLabel = (intent: IntentType) => {
  if (intent === 'very_defensive') return 'Block (Very Defensive)';
  if (intent === 'very_aggressive') return 'Slog (Ultra Aggressive)';
  if (intent === 'defensive') return 'Defensive';
  if (intent === 'aggressive') return 'Aggressive';
  return 'Neutral (Balanced)';
};

const getBowlerIntentLabel = (intent: IntentType) => {
  if (intent === 'very_defensive') return 'Ultra Def (Very Defensive)';
  if (intent === 'very_aggressive') return 'Ultra Att (Ultra Aggressive)';
  if (intent === 'defensive') return 'Defensive';
  if (intent === 'aggressive') return 'Aggressive';
  return 'Neutral (Balanced)';
};

export const MatchFlow: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const colors = useThemeColors();
  const { 
    teams, 
    schedule, 
    currentDay, 
    updateMatchResult, 
    saveCurrentGame,
    players: globalPlayers,
    setGamePhase
  } = useGame();

  // Find user's scheduled match for today
  const todayMatches = schedule?.matches.filter(m => m.day === currentDay) || [];
  const activeMatchInfo = todayMatches.find(m => m.team1Id === 'user_team' || m.team2Id === 'user_team');

  // Match setup details
  const [matchPhase, setMatchPhase] = useState<
    'toss' | 'selectOpeningBatsmen' | 'selectOpeningBowler' | 'selectNextBatsman' | 'selectNextBowler' | 'ready' | 'playing' | 'inningBreak' | 'complete'
  >('toss');
  
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rain' | 'storm'>('sunny');
  const [pitch, setPitch] = useState<'flat' | 'balanced' | 'turning' | 'seaming' | 'bouncing'>('balanced');
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const [tossChoice, setTossChoice] = useState<'bat' | 'bowl' | null>(null);
  const [tossResult, setTossResult] = useState<{ won: boolean; aiChoice?: 'bat' | 'bowl' } | null>(null);
  
  // Teams in the match
  const team1 = useMemo(() => teams.find(t => t.id === activeMatchInfo?.team1Id), [teams, activeMatchInfo]);
  const team2 = useMemo(() => teams.find(t => t.id === activeMatchInfo?.team2Id), [teams, activeMatchInfo]);
  
  const userTeam = useMemo(() => team1?.isUserTeam ? team1 : team2, [team1, team2]);
  const aiTeam = useMemo(() => team1?.isUserTeam ? team2 : team1, [team1, team2]);

  // Innings Data
  const [innings1, setInnings1] = useState<innings>({
    teamId: '', totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
    ballsFaced: [], battingOrder: [], currentBatsmen: ['', '']
  });
  const [innings2, setInnings2] = useState<innings>({
    teamId: '', totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
    ballsFaced: [], battingOrder: [], currentBatsmen: ['', '']
  });

  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  const [target, setTarget] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [freeHitActive, setFreeHitActive] = useState<boolean>(false);
  const [playerOfTheMatch, setPlayerOfTheMatch] = useState<{ id: string; name: string; teamId: string; stats: string } | null>(null);
  const [potmReward, setPotmReward] = useState<number>(0);
  const [matchResultObj, setMatchResultObj] = useState<any | null>(null);

  // Active game play selections
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  // User intent selections
  const [batsmanIntents, setBatsmanIntents] = useState<Record<string, IntentType>>({});
  const [bowlingIntent, setBowlingIntent] = useState<IntentType>('balanced');
  const [ballType, setBallType] = useState<BallType>('normal');
  const [avoidSingles, setAvoidSingles] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Live simulation speed variables
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState<'ball' | 'over' | 'instant'>('ball');

  // Commentary log
  const [commentary, setCommentary] = useState<string[]>([]);
  const [overBalls, setOverBallsState] = useState<string[]>([]);
  const [isScorecardOpen, setIsScorecardOpen] = useState(false);
  const [isCommentaryOpen, setIsCommentaryOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [scorecardTab, setScorecardTab] = useState<1 | 2>(1);
  const [isLoadingSavedMatch, setIsLoadingSavedMatch] = useState(true);

  // Simulation targets for state-controlled play loops
  const [simulationTarget, setSimulationTarget] = useState<'over' | 'wicket' | null>(null);
  const [initialSimWickets, setInitialSimWickets] = useState(0);
  const [initialSimBalls, setInitialSimBalls] = useState(0);
  const simTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const syncActiveMatchState = async (
    customPhase?: string,
    customInnings1?: innings,
    customInnings2?: innings,
    customCurrentInnings?: number,
    customTarget?: number,
    customStrikerId?: string,
    customNonStrikerId?: string,
    customBowlerId?: string,
    customFreeHit?: boolean
  ) => {
    if (!activeMatchInfo || matchPhase === 'complete') return;
    
    const phaseToSave = customPhase || matchPhase;
    const inn1ToSave = customInnings1 || innings1;
    const inn2ToSave = customInnings2 || innings2;
    const currInnToSave = customCurrentInnings || currentInnings;
    const targetToSave = customTarget !== undefined ? customTarget : target;
    const strikerToSave = customStrikerId !== undefined ? customStrikerId : strikerId;
    const nonStrikerToSave = customNonStrikerId !== undefined ? customNonStrikerId : nonStrikerId;
    const bowlerToSave = customBowlerId !== undefined ? customBowlerId : bowlerId;
    const freeHitToSave = customFreeHit !== undefined ? customFreeHit : freeHitActive;

    await saveActiveMatch({
      matchId: activeMatchInfo.id,
      phase: phaseToSave,
      innings1: inn1ToSave,
      innings2: inn2ToSave,
      currentInnings: currInnToSave,
      target: targetToSave,
      weather,
      pitch,
      tossWinner,
      tossChoice,
      currentBowlerIndex: 0,
      selectedBatsmen: [strikerToSave, nonStrikerToSave],
      selectedBowlerId: bowlerToSave || null,
      placeholderBatsman: null,
      pendingBowlerSelection: false,
      freeHitActive: freeHitToSave,
      impactUsed: false,
      replacedPlayerId: null,
      impactPlayerId: null,
      aiImpactUsed: false,
      aiReplacedPlayerId: null,
      aiImpactPlayerId: null,
      savedAt: Date.now()
    });
  };

  const handleExitToMenu = async () => {
    setIsSimulating(false);
    setSimulationTarget(null);
    if (simTimeoutRef.current) {
      clearTimeout(simTimeoutRef.current);
    }
    // 1. Sync current active match state to AsyncStorage
    await syncActiveMatchState();
    
    // 2. Save the main game state
    const userTeamBudget = userTeam?.budget ?? 4000000;
    await saveCurrentGame(userTeamBudget);

    // 3. Navigate back to menu/dashboard
    setGamePhase('tournament');
  };

  // Load saved active match or roll fresh setup on load
  useEffect(() => {
    async function initMatch() {
      try {
        const savedMatch = await loadActiveMatch();
        if (savedMatch && activeMatchInfo && savedMatch.matchId === activeMatchInfo.id) {
          setMatchPhase(savedMatch.phase as any);
          setInnings1(savedMatch.innings1);
          setInnings2(savedMatch.innings2);
          setCurrentInnings(savedMatch.currentInnings as any);
          setTarget(savedMatch.target);
          setWeather(savedMatch.weather as any);
          setPitch(savedMatch.pitch as any);
          setTossWinner(savedMatch.tossWinner);
          setTossChoice(savedMatch.tossChoice);
          if (savedMatch.selectedBatsmen && savedMatch.selectedBatsmen.length >= 2) {
            setStrikerId(savedMatch.selectedBatsmen[0]);
            setNonStrikerId(savedMatch.selectedBatsmen[1]);
          }
          if (savedMatch.selectedBowlerId) {
            setBowlerId(savedMatch.selectedBowlerId);
          }
          setFreeHitActive(savedMatch.freeHitActive || false);
          
          // Re-generate commentary log from ballsFaced so far
          const activeInn = savedMatch.currentInnings === 1 ? savedMatch.innings1 : savedMatch.innings2;
          const comms = activeInn.ballsFaced.map((b: any) => `[Over ${b.over}.${b.ball}] ${b.commentary}`);
          setCommentary(comms.reverse());
          
          // Over Balls tracker
          const lastBallsEvents = getOverBalls(activeInn);
          const lastBalls = lastBallsEvents.map((b: any) => b.isWicket ? 'W' : (b.result === 'wide' ? 'wd' : (b.result === 'noball' ? 'nb' : b.runs.toString())));
          setOverBallsState(lastBalls);
        } else {
          // Initialize fresh
          const wOptions: Array<'sunny' | 'cloudy' | 'rain' | 'storm'> = ['sunny', 'cloudy', 'rain', 'storm'];
          const pOptions: Array<'flat' | 'balanced' | 'turning' | 'seaming' | 'bouncing'> = ['flat', 'balanced', 'turning', 'seaming', 'bouncing'];
          setWeather(wOptions[Math.floor(Math.random() * wOptions.length)]);
          setPitch(pOptions[Math.floor(Math.random() * pOptions.length)]);
        }
      } catch (err) {
        console.error('Error loading active match:', err);
      } finally {
        setIsLoadingSavedMatch(false);
      }
    }
    initMatch();
    return () => {
      if (simTimeoutRef.current) {
        clearTimeout(simTimeoutRef.current);
      }
    };
  }, [activeMatchInfo]);

  useEffect(() => {
    if (matchPhase === 'complete' && activeMatchInfo && team1 && team2) {
      const t1Cloned = JSON.parse(JSON.stringify(team1));
      const t2Cloned = JSON.parse(JSON.stringify(team2));
      const result = resolveMatch(t1Cloned, t2Cloned, innings1, innings2, activeMatchInfo.team1Id);
      
      setPlayerOfTheMatch(result.playerOfTheMatch);
      setPotmReward(result.potmReward);
      setMatchResultObj(result);
    }
  }, [matchPhase, activeMatchInfo, team1, team2, innings1, innings2]);

  const activeInningsData = currentInnings === 1 ? innings1 : innings2;
  const isUserBatting = activeInningsData.teamId === 'user_team';

  // Compute live properties
  const runRate = calculateCurrentRunRate(activeInningsData);
  const reqRate = target > 0 ? ((target - activeInningsData.totalRuns) / Math.max(1, (120 - activeInningsData.balls)) * 6).toFixed(2) : null;

  // Active player models
  const activeStriker = useMemo(() => {
    return userTeam?.players.find(p => p.id === strikerId) || aiTeam?.players.find(p => p.id === strikerId);
  }, [strikerId, userTeam, aiTeam]);

  const activeNonStriker = useMemo(() => {
    return userTeam?.players.find(p => p.id === nonStrikerId) || aiTeam?.players.find(p => p.id === nonStrikerId);
  }, [nonStrikerId, userTeam, aiTeam]);

  const activeBowler = useMemo(() => {
    return userTeam?.players.find(p => p.id === bowlerId) || aiTeam?.players.find(p => p.id === bowlerId);
  }, [bowlerId, userTeam, aiTeam]);

  const strikerStats = useMemo(() => {
    if (!activeInningsData || !strikerId) return { runs: 0, balls: 0 };
    let runs = 0;
    let balls = 0;
    activeInningsData.ballsFaced.forEach(b => {
      if (b.batsmanId === strikerId && b.result !== 'wide') {
        runs += b.runs;
        balls += 1;
      }
    });
    return { runs, balls };
  }, [activeInningsData, strikerId]);

  const nonStrikerStats = useMemo(() => {
    if (!activeInningsData || !nonStrikerId) return { runs: 0, balls: 0 };
    let runs = 0;
    let balls = 0;
    activeInningsData.ballsFaced.forEach(b => {
      if (b.batsmanId === nonStrikerId && b.result !== 'wide') {
        runs += b.runs;
        balls += 1;
      }
    });
    return { runs, balls };
  }, [activeInningsData, nonStrikerId]);

  const bowlerStats = useMemo(() => {
    if (!activeInningsData || !bowlerId) return { overs: '0.0', runs: 0, wickets: 0 };
    let runs = 0;
    let balls = 0;
    let wickets = 0;
    activeInningsData.ballsFaced.forEach(b => {
      if (b.bowlerId === bowlerId) {
        runs += b.runs;
        if (b.result !== 'wide' && b.result !== 'noball') {
          balls += 1;
        }
        if (b.isWicket && b.wicketType !== 'run out') {
          wickets += 1;
        }
      }
    });
    const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
    return { overs, runs, wickets };
  }, [activeInningsData, bowlerId]);

  // Suggestion logic
  const currentSuggestion = useMemo(() => {
    if (!activeInningsData || !activeStriker) return 'Select opening batsmen to begin.';
    const curOver = Math.floor(activeInningsData.balls / 6);
    
    if (isUserBatting) {
      if (curOver < 6) {
        return `Powerplay! Adjust batting intent to aggressive for ${activeStriker.name} (Power: ${activeStriker.stats.power}) to hit boundaries.`;
      } else if (curOver >= 16) {
        return `Death overs! Maximize runs with very aggressive intent. Watch out for swingers and pacers.`;
      } else {
        return `Middle overs. Keep intent balanced to preserve wickets. Current runs: ${activeInningsData.totalRuns}/${activeInningsData.wickets}.`;
      }
    } else {
      if (activeBowler) {
        if (curOver < 6) {
          return `Powerplay: Use fast/swinger bowlers with aggressive intent to look for early wickets.`;
        } else if (curOver >= 16) {
          return `Death overs: Use defensive intent and bowl slower or yorker balls to avoid boundary leak.`;
        } else {
          return `Middle overs: Use spinners to slow down the run rate (balanced/defensive).`;
        }
      }
      return 'Select a bowler to start the over.';
    }
  }, [activeInningsData, strikerId, bowlerId, isUserBatting]);

  // Toss Simulation
  const handleToss = (userCall: 'heads' | 'tails') => {
    const coinRoll = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = userCall === coinRoll;
    
    if (won) {
      setTossWinner('user_team');
      setTossResult({ won: true });
    } else {
      const aiWin = aiTeam?.id || 'team_1';
      setTossWinner(aiWin);
      const aiChoices: Array<'bat' | 'bowl'> = ['bat', 'bowl'];
      const aiSelection = aiChoices[Math.floor(Math.random() * aiChoices.length)];
      setTossResult({ won: false, aiChoice: aiSelection });
    }
  };

  const chooseInnings = (userOption: 'bat' | 'bowl', winnerId: string) => {
    const isUserFirst = userOption === 'bat';
    setTossChoice(isUserFirst ? 'bat' : 'bowl');

    const inn1: innings = {
      teamId: isUserFirst ? 'user_team' : (aiTeam?.id || 'team_1'),
      totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
      ballsFaced: [], battingOrder: [], currentBatsmen: ['', '']
    };

    const inn2: innings = {
      teamId: isUserFirst ? (aiTeam?.id || 'team_1') : 'user_team',
      totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
      ballsFaced: [], battingOrder: [], currentBatsmen: ['', '']
    };

    setInnings1(inn1);
    setInnings2(inn2);
    setMatchPhase('selectOpeningBatsmen');
    syncActiveMatchState('selectOpeningBatsmen', inn1, inn2, 1, 0, '', '', '');
  };

  // Squad selection
  const handleSelectOpeningBatsmen = (p1Id: string, p2Id: string) => {
    if (p1Id === p2Id) {
      Alert.alert('Invalid Selection', 'Please select two different batsmen.');
      return;
    }
    setStrikerId(p1Id);
    setNonStrikerId(p2Id);

    const batOrder = isUserBatting
      ? (userTeam?.playing11 || [])
      : (aiTeam?.playing11 || []);

    const updated1 = currentInnings === 1 ? { ...innings1, battingOrder: batOrder, currentBatsmen: [p1Id, p2Id] as any } : innings1;
    const updated2 = currentInnings === 2 ? { ...innings2, battingOrder: batOrder, currentBatsmen: [p1Id, p2Id] as any } : innings2;

    if (currentInnings === 1) {
      setInnings1(updated1);
    } else {
      setInnings2(updated2);
    }

    setMatchPhase('selectOpeningBowler');
    syncActiveMatchState('selectOpeningBowler', updated1, updated2, currentInnings, target, p1Id, p2Id, bowlerId);
  };

  const handleSelectOpeningBowler = (bId: string) => {
    setBowlerId(bId);
    setMatchPhase('ready');
    syncActiveMatchState('ready', innings1, innings2, currentInnings, target, strikerId, nonStrikerId, bId);
  };

  const changeBatsmanIntent = (batsmanId: string, delta: number) => {
    const currentIntent = batsmanIntents[batsmanId] || 'balanced';
    const currentIdx = INTENT_LEVELS.indexOf(currentIntent);
    const newIdx = Math.max(0, Math.min(INTENT_LEVELS.length - 1, currentIdx + delta));
    setBatsmanIntents(prev => ({
      ...prev,
      [batsmanId]: INTENT_LEVELS[newIdx],
    }));
  };

  const changeBowlerIntent = (delta: number) => {
    const currentIdx = INTENT_LEVELS.indexOf(bowlingIntent);
    const newIdx = Math.max(0, Math.min(INTENT_LEVELS.length - 1, currentIdx + delta));
    setBowlingIntent(INTENT_LEVELS[newIdx]);
  };

  // Ball resolution
  const playSingleBall = () => {
    const curInn = currentInnings === 1 ? innings1 : innings2;
    const batTeam = curInn.teamId === 'user_team' ? userTeam : aiTeam;
    const bowlTeam = curInn.teamId === 'user_team' ? aiTeam : userTeam;

    // Safety check
    if (curInn.balls >= 120 || curInn.wickets >= 10) {
      handleInningsWrap();
      return false;
    }

    const currentStrikerId = curInn.currentBatsmen[0] || strikerId;
    const currentNonStrikerId = curInn.currentBatsmen[1] || nonStrikerId;

    const striker = batTeam?.players.find(p => p.id === currentStrikerId);
    const nonStriker = batTeam?.players.find(p => p.id === currentNonStrikerId);
    const bowler = bowlTeam?.players.find(p => p.id === bowlerId);

    if (!striker || !bowler) {
      Alert.alert('Error', 'Strike batsman or bowler missing.');
      setIsSimulating(false);
      return false;
    }

    // Determine intents (AI gets computed, user uses selector)
    let activeBatIntent = batsmanIntents[currentStrikerId] || 'balanced';
    let activeBowlIntent = bowlingIntent;

    if (batTeam?.id !== 'user_team' && batTeam?.tendency) {
      const remainingBalls = 120 - curInn.balls;
      const rrr = target > 0 ? (target - curInn.totalRuns) / (remainingBalls / 6 || 1) : 0;
      activeBatIntent = getAIIntent(batTeam.tendency, curInn.overs, 20, rrr, remainingBalls);
    }
    if (bowlTeam?.id !== 'user_team' && bowlTeam?.tendency) {
      const remainingBalls = 120 - curInn.balls;
      const rrr = target > 0 ? (target - curInn.totalRuns) / (remainingBalls / 6 || 1) : 0;
      activeBowlIntent = getAIIntent(bowlTeam.tendency, curInn.overs, 20, rrr, remainingBalls);
    }

    // Resolve ball logic
    const ballEvent = resolveBall(
      striker,
      bowler,
      curInn.balls,
      20,
      activeBatIntent,
      weather,
      pitch,
      0, // homeAdvantage
      freeHitActive, // isFreeHit
      activeBowlIntent,
      avoidSingles,
      60, // fieldingAverage
      ballType,
      1.0, // concentrationMult
      1.0, // rhythmMult
      bowlTeam?.playing11 || []
    );

    // Audio cracks/cheers
    if (audioEnabled) {
      if (ballEvent.isWicket) {
        gameAudio.groan(isUserBatting ? 1.0 : 0.4);
      } else if (ballEvent.runs === 4 || ballEvent.runs === 6) {
        gameAudio.cheer(isUserBatting ? 1.2 : 0.3);
      } else {
        gameAudio.batCrack();
      }
    }

    // Apply fatigue and morale adjustments
    const fatigueUpdates = updateFatigueAndMorale(striker, bowler, ballEvent.result, activeBatIntent, activeBowlIntent);
    striker.fatigue = Math.min(100, striker.fatigue + fatigueUpdates.batterFatigue);
    bowler.fatigue = Math.min(100, bowler.fatigue + fatigueUpdates.bowlerFatigue);
    striker.morale = Math.max(0, Math.min(100, striker.morale + fatigueUpdates.batterMorale));
    bowler.morale = Math.max(0, Math.min(100, bowler.morale + fatigueUpdates.bowlerMorale));

    // Update overs/balls progress
    let nextWickets = curInn.wickets;
    let nextBatsmen = [currentStrikerId, currentNonStrikerId] as [string, string];
    let nextBalls = curInn.balls;
    let nextOvers = curInn.overs;
    
    let wicketOccurred = false;
    let overFinished = false;

    if (ballEvent.isWicket) {
      nextWickets += 1;
      wicketOccurred = true;
    } else if (ballEvent.runs % 2 === 1) {
      // Rotate strike
      nextBatsmen = [currentNonStrikerId, currentStrikerId];
    }

    if (ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
      nextBalls += 1;
    }

    if (nextBalls > curInn.balls && nextBalls > 0 && nextBalls % 6 === 0) {
      nextOvers += 1;
      // End of over: rotate strike
      nextBatsmen = [nextBatsmen[1], nextBatsmen[0]];
      overFinished = true;
    }

    // Over Balls visual tracker
    const visualBallResult = ballEvent.isWicket ? 'W' : (ballEvent.result === 'wide' ? 'wd' : (ballEvent.result === 'noball' ? 'nb' : ballEvent.runs.toString()));
    const nextOverProgress = overFinished ? [] : [...overBalls, visualBallResult];
    setOverBallsState(nextOverProgress);

    const updatedInnings: innings = {
      ...curInn,
      totalRuns: curInn.totalRuns + ballEvent.runs,
      extras: curInn.extras + (ballEvent.result === 'wide' || ballEvent.result === 'noball' ? ballEvent.runs : 0),
      balls: nextBalls,
      overs: nextOvers,
      wickets: nextWickets,
      currentBatsmen: nextBatsmen,
      ballsFaced: [...curInn.ballsFaced, ballEvent]
    };

    // Keep state variables in sync
    setStrikerId(nextBatsmen[0]);
    setNonStrikerId(nextBatsmen[1]);

    // Update state
    if (currentInnings === 1) {
      setInnings1(updatedInnings);
    } else {
      setInnings2(updatedInnings);
    }

    // Add commentary
    const formattedComment = `[Over ${ballEvent.over}.${ballEvent.ball}] ${ballEvent.commentary}`;
    setCommentary(prev => [formattedComment, ...prev]);
    // Speak commentary only on wickets and boundary events to avoid speech overlapping
    if (ballEvent.isWicket || ballEvent.runs === 4 || ballEvent.runs === 6) {
      gameAudio.speakCommentary(ballEvent.commentary);
    }

    // Check innings conclusion rules
    const isTargetReached = currentInnings === 2 && updatedInnings.totalRuns >= target;
    const isInningsEnded = nextBalls >= 120 || nextWickets >= 10 || isTargetReached;

    if (isInningsEnded) {
      setIsSimulating(false);
      setTimeout(() => handleInningsWrap(updatedInnings), 500);
      return false;
    }

    // Interstitial selection states (Skip if AI is controlling)
    if (wicketOccurred && nextWickets < 10) {
      setIsSimulating(false);
      if (batTeam?.id === 'user_team') {
        setMatchPhase('selectNextBatsman');
        return false;
      } else {
        // AI auto-picks next batsman safely
        const roster = batTeam?.playing11 && batTeam.playing11.length >= 11
          ? batTeam.playing11
          : (batTeam?.players || []).map(p => p.id);
        
        // Find first player not currently in play and not already out
        const dismissedIds = updatedInnings.ballsFaced.filter(b => b.isWicket).map(b => b.batsmanId);
        const nextId = roster.find(id => id !== nextBatsmen[1] && !dismissedIds.includes(id)) || roster[nextWickets + 1] || roster[0];
        
        setStrikerId(nextId);
        if (currentInnings === 1) {
          setInnings1(prev => ({ ...prev, currentBatsmen: [nextId, prev.currentBatsmen[1]] }));
        } else {
          setInnings2(prev => ({ ...prev, currentBatsmen: [nextId, prev.currentBatsmen[1]] }));
        }
      }
    } else if (overFinished) {
      setIsSimulating(false);
      if (bowlTeam?.id === 'user_team') {
        setMatchPhase('selectNextBowler');
        return false;
      } else {
        // AI selects bowler safely
        const roster = bowlTeam?.players || [];
        const choices = roster.filter(p => p.id !== bowlerId && p.id !== nextBatsmen[1]);
        const randomBowler = choices[Math.floor(Math.random() * choices.length)] || roster[0];
        if (randomBowler) {
          setBowlerId(randomBowler.id);
        }
      }
    }

    // Free Hit state toggle
    let nextFreeHit = freeHitActive;
    if (ballEvent.result === 'noball') {
      nextFreeHit = true;
      if (audioEnabled) {
        gameAudio.playFreeHitSiren();
      }
    } else if (ballEvent.result === 'wide') {
      // keep free hit active if it was already active
    } else {
      nextFreeHit = false;
    }
    setFreeHitActive(nextFreeHit);

    const updatedInnings1 = currentInnings === 1 ? updatedInnings : innings1;
    const updatedInnings2 = currentInnings === 2 ? updatedInnings : innings2;
    
    let finalPhase = matchPhase;
    if (isInningsEnded) {
      finalPhase = currentInnings === 1 ? 'inningBreak' : 'complete';
    } else if (wicketOccurred && nextWickets < 10 && batTeam?.id === 'user_team') {
      finalPhase = 'selectNextBatsman';
    } else if (overFinished && bowlTeam?.id === 'user_team') {
      finalPhase = 'selectNextBowler';
    } else {
      finalPhase = 'playing';
    }

    let finalStrikerId = nextBatsmen[0];
    if (wicketOccurred && nextWickets < 10 && batTeam?.id !== 'user_team') {
      const roster = batTeam?.playing11 && batTeam.playing11.length >= 11
        ? batTeam.playing11
        : (batTeam?.players || []).map(p => p.id);
      const dismissedIds = updatedInnings.ballsFaced.filter(b => b.isWicket).map(b => b.batsmanId);
      finalStrikerId = roster.find(id => id !== nextBatsmen[1] && !dismissedIds.includes(id)) || roster[nextWickets + 1] || roster[0];
    }

    let finalBowlerId = bowlerId;
    if (overFinished && bowlTeam?.id !== 'user_team') {
      const roster = bowlTeam?.players || [];
      const choices = roster.filter(p => p.id !== bowlerId && p.id !== nextBatsmen[1]);
      const randomBowler = choices[Math.floor(Math.random() * choices.length)] || roster[0];
      if (randomBowler) {
        finalBowlerId = randomBowler.id;
      }
    }

    syncActiveMatchState(
      finalPhase,
      updatedInnings1,
      updatedInnings2,
      currentInnings,
      target,
      finalStrikerId,
      nextBatsmen[1],
      finalBowlerId,
      nextFreeHit
    );

    return true;
  };

  // Innings conclusion
  const handleInningsWrap = (lastState?: innings) => {
    const curInn = lastState || activeInningsData;
    
    if (currentInnings === 1) {
      setTarget(curInn.totalRuns + 1);
      setMatchPhase('inningBreak');
    } else {
      // Determine winner
      const runs1 = innings1.totalRuns;
      const runs2 = curInn.totalRuns;
      
      let winTeam = '';
      if (runs1 > runs2) winTeam = innings1.teamId;
      else if (runs2 > runs1) winTeam = curInn.teamId;
      else winTeam = 'draw';
      
      setWinner(winTeam);
      setMatchPhase('complete');
    }
  };

  const startSecondInnings = () => {
    setCurrentInnings(2);
    setMatchPhase('selectOpeningBatsmen');
    setStrikerId('');
    setNonStrikerId('');
    setBowlerId('');
    setCommentary([]);
    setOverBallsState([]);
  };

  const startInningsPlay = () => {
    setMatchPhase('playing');
    setCommentary([`Innings ${currentInnings} started! Good luck.`]);
  };

  // Simulating loops
  const togglePlaySimulation = () => {
    setIsSimulating(prev => {
      const nextSimState = !prev;
      if (!nextSimState) {
        setSimulationTarget(null);
        if (simTimeoutRef.current) {
          clearTimeout(simTimeoutRef.current);
        }
      }
      return nextSimState;
    });
  };

  // Simulate until the end of the current over
  const simulateToOver = () => {
    const curInn = currentInnings === 1 ? innings1 : innings2;
    setInitialSimBalls(curInn.balls);
    setInitialSimWickets(curInn.wickets);
    setSimulationTarget('over');
    setIsSimulating(true);
  };

  // Simulate until next wicket
  const simulateToWicket = () => {
    const curInn = currentInnings === 1 ? innings1 : innings2;
    setInitialSimBalls(curInn.balls);
    setInitialSimWickets(curInn.wickets);
    setSimulationTarget('wicket');
    setIsSimulating(true);
  };

  const playSingleBallRef = React.useRef(playSingleBall);
  useEffect(() => {
    playSingleBallRef.current = playSingleBall;
  });

  useEffect(() => {
    if (!isSimulating || matchPhase !== 'playing') {
      return;
    }

    const curInn = currentInnings === 1 ? innings1 : innings2;
    const currentBalls = curInn.balls;
    const currentWickets = curInn.wickets;

    // Check if simulation target met
    if (simulationTarget === 'over') {
      const currentOverNum = Math.floor(initialSimBalls / 6);
      const targetBalls = (currentOverNum + 1) * 6;
      if (currentBalls >= targetBalls || currentBalls >= 120) {
        setIsSimulating(false);
        setSimulationTarget(null);
        return;
      }
    } else if (simulationTarget === 'wicket') {
      if (currentWickets > initialSimWickets || currentBalls >= 120) {
        setIsSimulating(false);
        setSimulationTarget(null);
        return;
      }
    }

    const delay = simSpeed === 'ball' ? 1200 : simSpeed === 'over' ? 600 : 250;

    const timer = setTimeout(() => {
      const result = playSingleBallRef.current();
      if (result === false) {
        setIsSimulating(false);
        setSimulationTarget(null);
      }
    }, delay);

    simTimeoutRef.current = timer;

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    isSimulating,
    innings1.balls,
    innings2.balls,
    innings1.wickets,
    innings2.wickets,
    matchPhase,
    simSpeed,
    simulationTarget,
    initialSimBalls,
    initialSimWickets
  ]);

  const handleSimulateRest = () => {
    // Instant simulation loop
    let curInn = currentInnings === 1 ? innings1 : innings2;
    const batTeam = curInn.teamId === 'user_team' ? userTeam : aiTeam;
    const bowlTeam = curInn.teamId === 'user_team' ? aiTeam : userTeam;

    let tempStriker = strikerId;
    let tempNonStriker = nonStrikerId;
    let tempBowler = bowlerId;

    let tempRuns = curInn.totalRuns;
    let tempWickets = curInn.wickets;
    let tempBalls = curInn.balls;
    let tempOvers = curInn.overs;
    const tempBallsFaced = [...curInn.ballsFaced];

    while (tempBalls < 120 && tempWickets < 10) {
      // Check target reached for 2nd innings
      if (currentInnings === 2 && tempRuns >= target) {
        break;
      }

      // Safe players fallback selection
      let striker = batTeam?.players.find(p => p.id === tempStriker);
      if (!striker && batTeam?.players.length) {
        striker = batTeam.players[0];
        tempStriker = striker.id;
      }
      let nonStriker = batTeam?.players.find(p => p.id === tempNonStriker);
      if (!nonStriker && batTeam?.players.length) {
        nonStriker = batTeam.players.find(p => p.id !== tempStriker) || batTeam.players[0];
        tempNonStriker = nonStriker.id;
      }
      let bowler = bowlTeam?.players.find(p => p.id === tempBowler);
      if (!bowler && bowlTeam?.players.length) {
        bowler = bowlTeam.players[0];
        tempBowler = bowler.id;
      }

      if (!striker || !nonStriker || !bowler) {
        break;
      }

      const ballEvent = resolveBall(
        striker, bowler, tempBalls, 20, 'balanced', weather, pitch, 0, false, 'balanced',
        false, 60, 'normal', 1.0, 1.0, bowlTeam?.playing11 || []
      );

      tempBallsFaced.push(ballEvent);
      tempRuns += ballEvent.runs;

      if (ballEvent.isWicket) {
        tempWickets += 1;
        if (tempWickets < 10) {
          // Select next batter safely
          const roster = batTeam?.playing11 && batTeam.playing11.length >= 11
            ? batTeam.playing11
            : (batTeam?.players || []).map(p => p.id);
          
          // Find first player who is not currently nonStriker and not already out
          const dismissedIds = tempBallsFaced.filter(b => b.isWicket).map(b => b.batsmanId);
          tempStriker = roster.find(id => id !== tempNonStriker && !dismissedIds.includes(id)) || roster.find(id => id !== tempNonStriker) || roster[0];
        }
      } else {
        if (ballEvent.runs % 2 === 1) {
          const swap = tempStriker;
          tempStriker = tempNonStriker;
          tempNonStriker = swap;
        }
      }

      if (ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
        tempBalls += 1;
      }

      // Over transition
      if (tempBalls > 0 && tempBalls % 6 === 0 && (ballEvent.result !== 'wide' && ballEvent.result !== 'noball')) {
        tempOvers += 1;
        // Swap end rotation
        const swap = tempStriker;
        tempStriker = tempNonStriker;
        tempNonStriker = swap;
        
        // Select next bowler safely
        const roster = bowlTeam?.players || [];
        const choices = roster.filter(p => p.id !== tempBowler && p.id !== tempNonStriker).slice(0, 5);
        const randomBowler = choices[Math.floor(Math.random() * choices.length)] || roster.find(p => p.id !== tempNonStriker) || roster[0];
        if (randomBowler) {
          tempBowler = randomBowler.id;
        }
      }
    }

    const updated: innings = {
      ...curInn,
      totalRuns: tempRuns,
      wickets: tempWickets,
      balls: tempBalls,
      overs: tempOvers,
      ballsFaced: tempBallsFaced
    };

    if (currentInnings === 1) {
      setInnings1(updated);
      setTarget(tempRuns + 1);
      setMatchPhase('inningBreak');
    } else {
      setInnings2(updated);
      const runs1 = innings1.totalRuns;
      let winTeam = '';
      if (runs1 > tempRuns) winTeam = innings1.teamId;
      else if (tempRuns > runs1) winTeam = updated.teamId;
      else winTeam = 'draw';
      
      setWinner(winTeam);
      setMatchPhase('complete');
    }
  };

  const handleConfirmMatchComplete = () => {
    // 1. Submit results to Context
    if (activeMatchInfo && winner) {
      const team1Score = innings1.totalRuns;
      const team2Score = innings2.totalRuns;
      
      // Determine final score distribution
      const score1 = activeMatchInfo.team1Id === innings1.teamId ? team1Score : team2Score;
      const score2 = activeMatchInfo.team2Id === innings1.teamId ? team1Score : team2Score;

      // Calculate Player Stats Updates matching Svelte logic
      const playerStatsUpdates: Record<string, { runs: number; wickets: number; catches: number; matches: number; runOuts: number; xp: number }> = {};
      const addPlayerStat = (id: string, stat: 'runs' | 'wickets' | 'catches' | 'runOuts' | 'xp', value: number) => {
        if (!playerStatsUpdates[id]) playerStatsUpdates[id] = { runs: 0, wickets: 0, catches: 0, matches: 0, runOuts: 0, xp: 0 };
        playerStatsUpdates[id][stat] += value;
      };

      // Add playing participation
      const team1Playing = team1?.playing11 || [];
      const team2Playing = team2?.playing11 || [];
      const allPlayingIds = [...team1Playing, ...team2Playing];
      
      allPlayingIds.forEach(id => {
        if (!playerStatsUpdates[id]) {
          playerStatsUpdates[id] = { runs: 0, wickets: 0, catches: 0, matches: 1, runOuts: 0, xp: 0 };
        } else {
          playerStatsUpdates[id].matches = 1;
        }
        // Participation XP
        addPlayerStat(id, 'xp', 10);
      });

      // Staff XP Multipliers helper
      const getXpMultiplier = (team: any, role: string) => {
        const staff = team?.staff?.find((s: any) => s.role === role);
        if (!staff) return 1;
        return staff.tier === 'Legendary' ? 1.25 : staff.tier === 'Epic' ? 1.15 : staff.tier === 'Rare' ? 1.10 : 1.05;
      };
      
      const t1BattingMult = getXpMultiplier(team1, 'Batting Consultant');
      const t1BowlingMult = getXpMultiplier(team1, 'Bowling Consultant');
      const t2BattingMult = getXpMultiplier(team2, 'Batting Consultant');
      const t2BowlingMult = getXpMultiplier(team2, 'Bowling Consultant');

      [innings1, innings2].forEach(inn => {
        const battingMult = inn.teamId === team1?.id ? t1BattingMult : t2BattingMult;
        const bowlingMult = inn.teamId === team1?.id ? t2BowlingMult : t1BowlingMult; // Bowling team is opposite

        inn.ballsFaced.forEach(ball => {
          if (ball.result !== 'wide' && ball.result !== 'noball') {
            addPlayerStat(ball.batsmanId, 'runs', ball.runs);
            addPlayerStat(ball.batsmanId, 'xp', ball.runs * battingMult);
          }
          if (ball.isWicket) {
            if (ball.wicketType !== 'run out') {
              addPlayerStat(ball.bowlerId, 'wickets', 1);
              addPlayerStat(ball.bowlerId, 'xp', 15 * bowlingMult);
            }
            if (ball.wicketType === 'run out' && ball.fielderId) {
              addPlayerStat(ball.fielderId, 'runOuts', 1);
              addPlayerStat(ball.fielderId, 'xp', 15);
            } else if ((ball.wicketType === 'caught' || ball.wicketType === 'stumped') && ball.fielderId) {
              addPlayerStat(ball.fielderId, 'catches', 1);
              addPlayerStat(ball.fielderId, 'xp', 10);
            }
          }
        });
      });

      // Milestones
      Object.keys(playerStatsUpdates).forEach(id => {
        const pStats = playerStatsUpdates[id];
        const playerTeamId = team1?.players.some(p => p.id === id) ? team1?.id : team2?.id;
        const battingMult = playerTeamId === team1?.id ? t1BattingMult : t2BattingMult;
        const bowlingMult = playerTeamId === team1?.id ? t1BowlingMult : t2BowlingMult;

        if (pStats.runs >= 100) pStats.xp += 100 * battingMult;
        else if (pStats.runs >= 50) pStats.xp += 50 * battingMult;

        if (pStats.wickets >= 5) pStats.xp += 100 * bowlingMult;
        else if (pStats.wickets >= 3) pStats.xp += 50 * bowlingMult;

        pStats.xp = Math.round(pStats.xp);
      });

      // Award 100 XP bonus to Player of the Match
      if (playerOfTheMatch) {
        if (!playerStatsUpdates[playerOfTheMatch.id]) {
          playerStatsUpdates[playerOfTheMatch.id] = { runs: 0, wickets: 0, catches: 0, matches: 0, runOuts: 0, xp: 0 };
        }
        playerStatsUpdates[playerOfTheMatch.id].xp += 100;
      }

      if (team1 && team2) {
        const winnerEnum = winner === team1.id ? 'team1' : winner === team2.id ? 'team2' : 'draw';
        postMatchMoraleUpdate(team1, team2, innings1, innings2, winnerEnum);
      }

      // Calculate budget updates for match and sponsorship earnings plus POTM reward
      const budgetUpdates: Record<string, number> = {};
      if (matchResultObj && activeMatchInfo) {
        budgetUpdates[activeMatchInfo.team1Id] = (matchResultObj.matchEarnings?.team1 || 0) + (matchResultObj.sponsorshipEarnings?.team1 || 0);
        budgetUpdates[activeMatchInfo.team2Id] = (matchResultObj.matchEarnings?.team2 || 0) + (matchResultObj.sponsorshipEarnings?.team2 || 0);
        if (playerOfTheMatch && potmReward > 0) {
          budgetUpdates[playerOfTheMatch.teamId] = (budgetUpdates[playerOfTheMatch.teamId] || 0) + potmReward;
        }
      }

      updateMatchResult(activeMatchInfo.id, winner, score1, score2, playerStatsUpdates, budgetUpdates);
    }
    
    // Clear active match
    clearActiveMatch();

    // 2. Return to tournament page
    setGamePhase('tournament');
  };

  // List filter options
  const userTeamPlayers = userTeam?.players || [];
  const activeOpponentPlayers = aiTeam?.players || [];

  const userStartingXI = useMemo(() => {
    if (!userTeam) return [];
    return userTeam.players.filter(p => userTeam.playing11?.includes(p.id));
  }, [userTeam]);

  if (isLoadingSavedMatch) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Day {currentDay} Simulation</Text>
          <Text style={styles.headerTeamsText} numberOfLines={1}>
            {team1?.name} vs {team2?.name}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity 
            style={styles.volumeToggle} 
            onPress={() => setAudioEnabled(!audioEnabled)}
          >
            {audioEnabled ? <Volume2 size={20} stroke="#fff" /> : <VolumeX size={20} stroke={THEME.colors.textMuted} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={handleExitToMenu}
          >
            <Text style={styles.menuButtonText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Phase conditional screens */}
      {matchPhase === 'toss' && (
        <ScrollView style={styles.panel}>
          <Text style={styles.panelTitle}>Pitch & Weather Report</Text>
          <View style={styles.reportRow}>
            <View style={styles.reportItem}>
              <Text style={styles.reportLabel}>Weather</Text>
              <Text style={styles.reportVal}>
                {WEATHER_EMOJIS[weather]} {weather.toUpperCase()}
              </Text>
            </View>
            <View style={styles.reportItem}>
              <Text style={styles.reportLabel}>Pitch Type</Text>
              <Text style={styles.reportVal}>
                {PITCH_EMOJIS[pitch]} {pitch.toUpperCase()}
              </Text>
            </View>
          </View>

          {tossResult === null ? (
            <View>
              <Text style={styles.label}>Call the coin toss:</Text>
              <View style={styles.tossButtonsRow}>
                <TouchableOpacity style={styles.tossBtn} onPress={() => handleToss('heads')}>
                  <Text style={styles.btnText}>Heads</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tossBtn} onPress={() => handleToss('tails')}>
                  <Text style={styles.btnText}>Tails</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : tossResult.won ? (
            <View style={styles.tossDecisionBox}>
              <Text style={styles.tossResultTitle}>🎉 Toss Won!</Text>
              <Text style={styles.tossResultText}>You won the coin toss. Choose your preference:</Text>
              <View style={styles.tossActionRow}>
                <TouchableOpacity 
                  style={styles.tossChoiceBtn} 
                  onPress={() => {
                    setTossResult(null);
                    chooseInnings('bat', 'user_team');
                  }}
                >
                  <Text style={styles.tossChoiceBtnText}>🏏 Bat First</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.tossChoiceBtn} 
                  onPress={() => {
                    setTossResult(null);
                    chooseInnings('bowl', 'user_team');
                  }}
                >
                  <Text style={styles.tossChoiceBtnText}>🥎 Bowl First</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.tossDecisionBox}>
              <Text style={[styles.tossResultTitle, { color: THEME.colors.danger }]}>😢 Toss Lost</Text>
              <Text style={styles.tossResultText}>
                {aiTeam?.name || 'AI'} won the toss and elected to {tossResult.aiChoice === 'bat' ? 'bat first' : 'bowl first'}.
              </Text>
              <TouchableOpacity 
                style={styles.tossProceedBtn}
                onPress={() => {
                  setTossResult(null);
                  chooseInnings(tossResult.aiChoice === 'bat' ? 'bowl' : 'bat', tossWinner!);
                }}
              >
                <Text style={styles.tossProceedBtnText}>Proceed to Match Setup</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {matchPhase === 'selectOpeningBatsmen' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            Select Opening Batsmen ({isUserBatting ? 'You are Batting' : 'AI is Batting'})
          </Text>
          {isUserBatting ? (
            <ScrollView style={styles.listArea}>
              <Text style={styles.helperText}>Select exactly 2 batsmen to open the innings:</Text>
              {userStartingXI.map(p => {
                const isSelected = strikerId === p.id || nonStrikerId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playerListItem, isSelected && styles.playerListItemSelected, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                    onPress={() => {
                      if (strikerId === p.id) setStrikerId('');
                      else if (nonStrikerId === p.id) setNonStrikerId('');
                      else if (!strikerId) setStrikerId(p.id);
                      else if (!nonStrikerId) setNonStrikerId(p.id);
                      else Alert.alert('Max Selected', 'You have already selected 2 batsmen.');
                    }}
                  >
                    <Image source={getPortraitAsset(p.faction, p.portraitId || 1)} style={styles.selectionAvatarMini} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerListName}>{p.name}</Text>
                      <Text style={styles.playerListDesc}>{p.role.toUpperCase()} • Skills: B-{p.stats.batting} / F-{p.stats.fielding}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity 
                style={[styles.confirmBtn, (!strikerId || !nonStrikerId) && styles.confirmBtnDisabled]}
                disabled={!strikerId || !nonStrikerId}
                onPress={() => handleSelectOpeningBatsmen(strikerId, nonStrikerId)}
              >
                <Text style={styles.confirmBtnText}>Confirm Openers</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.centerBox}>
              <Text style={styles.aiLoadingText}>AI team is arranging batting order...</Text>
              <TouchableOpacity 
                style={styles.confirmBtn}
                onPress={() => {
                  const roster = aiTeam?.playing11 && aiTeam.playing11.length >= 2
                    ? aiTeam.playing11
                    : (aiTeam?.players || []).slice(0, 2).map(p => p.id);
                  handleSelectOpeningBatsmen(roster[0] || '', roster[1] || '');
                }}
              >
                <Text style={styles.confirmBtnText}>Proceed to Bowler Selection</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {matchPhase === 'selectOpeningBowler' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            Select Opening Bowler ({!isUserBatting ? 'You are Bowling' : 'AI is Bowling'})
          </Text>
          {!isUserBatting ? (
            <ScrollView style={styles.listArea}>
              <Text style={styles.helperText}>Select 1 bowler to deliver the first over:</Text>
              {userStartingXI.map(p => {
                if (userTeam && p.id === userTeam.wicketKeeper) return null;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playerListItem, bowlerId === p.id && styles.playerListItemSelected, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                    onPress={() => setBowlerId(p.id)}
                  >
                    <Image source={getPortraitAsset(p.faction, p.portraitId || 1)} style={styles.selectionAvatarMini} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerListName}>{p.name}</Text>
                      <Text style={styles.playerListDesc}>{p.role.toUpperCase()} • Bowling: {p.stats.bowling} • Type: {p.bowlingType}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity 
                style={[styles.confirmBtn, !bowlerId && styles.confirmBtnDisabled]}
                disabled={!bowlerId}
                onPress={() => handleSelectOpeningBowler(bowlerId)}
              >
                <Text style={styles.confirmBtnText}>Confirm Bowler</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.centerBox}>
              <Text style={styles.aiLoadingText}>AI team is selecting opening bowler...</Text>
              <TouchableOpacity 
                style={styles.confirmBtn}
                onPress={() => {
                  const aiStartingXI = aiTeam?.players.filter(p => aiTeam.playing11?.includes(p.id)) || [];
                  const finalStartingXI = aiStartingXI.length > 0 ? aiStartingXI : (aiTeam?.players || []);
                  const bowlers = finalStartingXI.filter(p => p.role === 'bowler' || p.role === 'allrounder');
                  handleSelectOpeningBowler(bowlers[0]?.id || finalStartingXI[0]?.id || '');
                }}
              >
                <Text style={styles.confirmBtnText}>Proceed to Ready Screen</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {matchPhase === 'ready' && (
        <View style={styles.panel}>
          <Text style={styles.readyTitle}>MATCH READY TO PLAY</Text>
          <Text style={styles.readyTeams}>
            {currentInnings === 1
              ? `${isUserBatting ? 'User Team' : (aiTeam?.name || 'AI')} will Bat First`
              : `${isUserBatting ? 'User Team' : (aiTeam?.name || 'AI')} will Chase Target of ${target} Runs`}
          </Text>
          
          <View style={styles.readyOverview}>
            <View style={[styles.overviewBox, { alignItems: 'center' }]}>
              <Text style={styles.overviewLabel}>Striker</Text>
              {activeStriker && (
                <Image source={getPortraitAsset(activeStriker.faction, activeStriker.portraitId || 1)} style={styles.selectionAvatarReady} />
              )}
              <Text style={styles.overviewVal} numberOfLines={1}>{activeStriker?.name}</Text>
            </View>
            <View style={[styles.overviewBox, { alignItems: 'center' }]}>
              <Text style={styles.overviewLabel}>Non-Striker</Text>
              {activeNonStriker && (
                <Image source={getPortraitAsset(activeNonStriker.faction, activeNonStriker.portraitId || 1)} style={styles.selectionAvatarReady} />
              )}
              <Text style={styles.overviewVal} numberOfLines={1}>{activeNonStriker?.name}</Text>
            </View>
            <View style={[styles.overviewBox, { alignItems: 'center' }]}>
              <Text style={styles.overviewLabel}>Bowler</Text>
              {activeBowler && (
                <Image source={getPortraitAsset(activeBowler.faction, activeBowler.portraitId || 1)} style={styles.selectionAvatarReady} />
              )}
              <Text style={styles.overviewVal} numberOfLines={1}>{activeBowler?.name}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startInningsPlay}>
            <Text style={styles.startButtonText}>Start {currentInnings === 1 ? '1st' : '2nd'} Innings</Text>
          </TouchableOpacity>
        </View>
      )}

      {matchPhase === 'selectNextBatsman' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>WICKET! Select Next Batsman</Text>
          <ScrollView style={styles.listArea}>
            {userStartingXI.map(p => {
              const hasBatted = activeInningsData.ballsFaced.some(b => b.batsmanId === p.id) || p.id === nonStrikerId || p.id === strikerId;
              if (hasBatted) return null;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.playerListItem, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                  onPress={() => {
                    setStrikerId(p.id);
                    const newBatsmen = [p.id, currentInnings === 1 ? innings1.currentBatsmen[1] : innings2.currentBatsmen[1]];
                    const nextInnings1 = currentInnings === 1 ? { ...innings1, currentBatsmen: newBatsmen as any } : innings1;
                    const nextInnings2 = currentInnings === 2 ? { ...innings2, currentBatsmen: newBatsmen as any } : innings2;
                    if (currentInnings === 1) {
                      setInnings1(nextInnings1);
                    } else {
                      setInnings2(nextInnings2);
                    }
                    syncActiveMatchState('playing', nextInnings1, nextInnings2, currentInnings, target, p.id, nonStrikerId, bowlerId);
                    setMatchPhase('playing');
                  }}
                >
                  <Image source={getPortraitAsset(p.faction, p.portraitId || 1)} style={styles.selectionAvatarMini} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerListName}>{p.name}</Text>
                    <Text style={styles.playerListDesc}>{p.role.toUpperCase()} • Batting: {p.stats.batting}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {matchPhase === 'selectNextBowler' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>OVER COMPLETE! Select Next Bowler</Text>
          <ScrollView style={styles.listArea}>
            {userStartingXI.map(p => {
              if (p.id === bowlerId) return null; // Can't bowl consecutive overs
              if (userTeam && p.id === userTeam.wicketKeeper) return null; // Wicketkeepers don't bowl
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.playerListItem, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                  onPress={() => {
                    setBowlerId(p.id);
                    syncActiveMatchState('playing', innings1, innings2, currentInnings, target, strikerId, nonStrikerId, p.id);
                    setMatchPhase('playing');
                  }}
                >
                  <Image source={getPortraitAsset(p.faction, p.portraitId || 1)} style={styles.selectionAvatarMini} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerListName}>{p.name}</Text>
                    <Text style={styles.playerListDesc}>{p.role.toUpperCase()} • Bowling: {p.stats.bowling} • Type: {p.bowlingType}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {matchPhase === 'inningBreak' && (
        <View style={styles.panel}>
          <Text style={styles.breakTitle}>INNINGS COMPLETE</Text>
          <Text style={styles.breakScore}>
            {currentInnings === 1 ? (isUserBatting ? 'Your' : (aiTeam?.name || 'AI')) : ''} Innings Score: {innings1.totalRuns}/{innings1.wickets}
          </Text>
          <Text style={styles.breakTarget}>
            Target for 2nd Innings: {target} Runs
          </Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={startSecondInnings}>
            <Text style={styles.confirmBtnText}>Start 2nd Innings</Text>
          </TouchableOpacity>
        </View>
      )}

      {matchPhase === 'playing' && (
        <View style={styles.playboard}>
          {/* Scrollable content */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

            {/* ── Scoreboard Card ── */}
            <View style={styles.scoreboardCard}>
              {/* Team matchup header */}
              <View style={styles.matchupHeader}>
                <Text style={[styles.matchupTeamName, { color: '#eab308' }]} numberOfLines={1}>{userTeam?.name || 'User'}</Text>
                <Text style={styles.matchupVs}>vs</Text>
                <Text style={[styles.matchupTeamName, { color: '#60a5fa' }]} numberOfLines={1}>{aiTeam?.name || 'AI'}</Text>
              </View>

              {/* Weather & Pitch */}
              <View style={styles.weatherPitchBar}>
                <Text style={styles.weatherPitchText}>
                  {WEATHER_EMOJIS[weather]} {weather} • {PITCH_EMOJIS[pitch]} {pitch} pitch
                  {activeInningsData.teamId === 'user_team' ? '  •  🏏 You Batting' : '  •  🎯 You Bowling'}
                </Text>
              </View>

              {/* Main score row */}
              <View style={styles.mainScoreRow}>
                <View style={styles.runsWicketsBlock}>
                  <Text style={styles.runsText}>{activeInningsData.totalRuns}</Text>
                  <Text style={styles.scoreDivider}>/</Text>
                  <Text style={styles.wicketsText}>{activeInningsData.wickets}</Text>
                </View>
                <View style={styles.oversOtherBlock}>
                  <Text style={styles.oversSmallLabel}>Overs</Text>
                  <Text style={styles.oversSmallVal}>{Math.floor(activeInningsData.balls / 6)}.{activeInningsData.balls % 6}</Text>
                </View>
                <TouchableOpacity style={styles.scorecardIconBtn} onPress={() => setIsScorecardOpen(true)}>
                  <ClipboardList size={16} stroke={THEME.colors.primaryLight} />
                  <Text style={styles.scorecardBtnText}>Card</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.scorecardIconBtn} onPress={() => setIsCommentaryOpen(true)}>
                  <BookOpen size={16} stroke={THEME.colors.primaryLight} />
                  <Text style={styles.scorecardBtnText}>Comm</Text>
                </TouchableOpacity>
              </View>

              {/* CRR / RRR / Target */}
              <View style={styles.statsBarRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>CRR</Text>
                  <Text style={styles.statValue}>{runRate}</Text>
                </View>
                {target > 0 && (
                  <>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Target</Text>
                      <Text style={styles.statValue}>{target}</Text>
                    </View>
                    <View style={[styles.statItem, { flex: 2 }]}>
                      <Text style={[styles.statLabel, { textAlign: 'center' }]}>
                        Need {target - activeInningsData.totalRuns} off {120 - activeInningsData.balls} balls
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* Recent deliveries mini bubbles */}
              {activeInningsData.ballsFaced.length > 0 && (() => {
                const recent = activeInningsData.ballsFaced.slice(-12);
                return (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentBallsScroll} contentContainerStyle={styles.recentBallsContent}>
                    {recent.map((ball, idx) => {
                      const prevBall = idx > 0 ? recent[idx - 1] : null;
                      const showSep = prevBall && ball.over !== prevBall.over;
                      let bg = '#475569';
                      if (ball.isWicket) bg = '#ef4444';
                      else if (ball.result === 'wide' || ball.result === 'noball') bg = '#3b82f6';
                      else if (ball.runs === 4 || ball.runs === 6) bg = '#f59e0b';
                      else if (ball.runs > 0) bg = '#10b981';
                      const label = ball.isWicket ? 'W' : ball.result === 'wide' ? `${ball.runs}wd` : ball.result === 'noball' ? `${ball.runs}nb` : `${ball.runs}`;
                      return (
                        <React.Fragment key={idx}>
                          {showSep && <View style={styles.recentBallSep} />}
                          <View style={[styles.recentBallBubble, { backgroundColor: bg }]}>
                            <Text style={styles.recentBallText}>{label}</Text>
                          </View>
                        </React.Fragment>
                      );
                    })}
                  </ScrollView>
                );
              })()}
            </View>

            {/* ── Active Batsman Cards ── */}
            <View style={styles.activeBatsmenGrid}>
              {([
                { player: activeStriker, stats: strikerStats, isStriker: true },
                { player: activeNonStriker, stats: nonStrikerStats, isStriker: false },
              ] as const).map(({ player, stats, isStriker }) => {
                if (!player) return null;
                const intent = batsmanIntents[player.id] || 'balanced';
                const intentColor = INTENT_COLORS[intent];
                const intentIdx = INTENT_LEVELS.indexOf(intent);
                const staminaPct = 100 - (player.fatigue || 0);
                const moralePct = player.morale || 70;
                return (
                  <View
                    key={player.id}
                    style={[
                      styles.playerCardNew,
                      { borderColor: intentColor },
                      isStriker && styles.playerCardOnStrike,
                    ]}
                  >
                    {/* Main content */}
                    <View style={styles.cardMainContent}>
                      {/* Avatar ring */}
                      <View style={styles.avatarRing}>
                        <Image source={getPortraitAsset(player.faction, player.portraitId || 1)} style={styles.avatarRingImg} />
                        <View style={styles.skillBadgeMini}>
                          <Text style={styles.skillBadgeText}>{player.stats.batting}</Text>
                        </View>
                      </View>
                      {/* Player details */}
                      <View style={styles.playerCardDetails}>
                        <View style={styles.playerNameRow}>
                          <Text style={styles.playerCardName} numberOfLines={1}>{player.name}</Text>
                          {isStriker && <Text style={styles.strikerIcon}>🏏</Text>}
                        </View>
                        <Text style={styles.playerStyleText}>{player.battingType || 'RHB'} • {player.battingRole || 'Batsman'}</Text>
                        <Text style={styles.playerScoreText}>
                          <Text style={styles.playerRunsLarge}>{stats.runs}</Text>
                          <Text style={styles.playerBallsFaced}> ({stats.balls})</Text>
                        </Text>
                        {/* Side-by-side stamina + confidence bars */}
                        <View style={styles.barsSideBySide}>
                          <View style={styles.miniBarWrapper}>
                            <Text style={styles.miniBarLabel}>Stam</Text>
                            <View style={styles.miniBarTrack}>
                              <View style={[styles.miniBarFill, { width: `${staminaPct}%` as any, backgroundColor: staminaPct > 60 ? '#3b82f6' : staminaPct > 30 ? '#f59e0b' : '#ef4444' }]} />
                            </View>
                          </View>
                          <View style={styles.miniBarWrapper}>
                            <Text style={styles.miniBarLabel}>Conf</Text>
                            <View style={styles.miniBarTrack}>
                              <View style={[styles.miniBarFill, { width: `${moralePct}%` as any, backgroundColor: moralePct > 60 ? '#a855f7' : moralePct > 30 ? '#f59e0b' : '#ef4444' }]} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Intent control — 5-segment bar with ➖/➕ */}
                    <View style={styles.cardStrategyControl}>
                      {isUserBatting ? (
                        <View>
                          <View style={styles.inlineIntentRow}>
                            <TouchableOpacity
                              style={styles.btnIntentAdjustMini}
                              disabled={intentIdx === 0}
                              onPress={() => changeBatsmanIntent(player.id, -1)}
                            >
                              <Text style={[styles.btnIntentAdjustMiniText, intentIdx === 0 && { opacity: 0.3 }]}>➖</Text>
                            </TouchableOpacity>
                            <View style={styles.inlineIntentBar}>
                              {INTENT_LEVELS.map((level, idx) => (
                                <TouchableOpacity
                                  key={level}
                                  activeOpacity={0.7}
                                  style={[
                                    styles.inlineIntentSegment,
                                    idx <= intentIdx
                                      ? { backgroundColor: INTENT_COLORS[level] }
                                      : { backgroundColor: 'rgba(255,255,255,0.08)' },
                                    idx === intentIdx && { shadowColor: INTENT_COLORS[level], shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 },
                                  ]}
                                  onPress={() => setBatsmanIntents(prev => ({ ...prev, [player.id]: level }))}
                                />
                              ))}
                            </View>
                            <TouchableOpacity
                              style={styles.btnIntentAdjustMini}
                              disabled={intentIdx === INTENT_LEVELS.length - 1}
                              onPress={() => changeBatsmanIntent(player.id, 1)}
                            >
                              <Text style={[styles.btnIntentAdjustMiniText, intentIdx === INTENT_LEVELS.length - 1 && { opacity: 0.3 }]}>➕</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={[styles.inlineIntentLabel, { color: intentColor }]}>{getBatsmanIntentLabel(intent)}</Text>
                        </View>
                      ) : (
                        <View style={styles.compactIntentDisabled}>
                          <Text style={styles.compactIntentLabelAI}>🤖 AI Managed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── Avoid Singles (below batsmen cards, only when batting) ── */}
            {isUserBatting && (
              <TouchableOpacity style={styles.avoidSinglesRow} onPress={() => setAvoidSingles(!avoidSingles)}>
                <View style={[styles.checkbox, avoidSingles && styles.checkboxChecked]}>
                  {avoidSingles && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Avoid Singles (preserve strike)</Text>
              </TouchableOpacity>
            )}

            {/* ── Active Bowler Card ── */}
            {activeBowler && (() => {
              const intent = bowlingIntent;
              const intentColor = INTENT_COLORS[intent];
              const intentIdx = INTENT_LEVELS.indexOf(intent);
              const staminaPct = 100 - (activeBowler.fatigue || 0);
              const moralePct = activeBowler.morale || 70;
              return (
                <View style={[styles.playerCardNew, styles.bowlerCardNew, { borderColor: intentColor }]}>
                  <View style={styles.cardMainContent}>
                    <View style={styles.avatarRing}>
                      <Image source={getPortraitAsset(activeBowler.faction, activeBowler.portraitId || 1)} style={styles.avatarRingImg} />
                      <View style={styles.skillBadgeMini}>
                        <Text style={styles.skillBadgeText}>{activeBowler.stats.bowling}</Text>
                      </View>
                    </View>
                    <View style={[styles.playerCardDetails, { flex: 1 }]}>
                      <View style={styles.playerNameRow}>
                        <Text style={styles.playerCardName} numberOfLines={1}>{activeBowler.name}</Text>
                      </View>
                      <Text style={styles.playerStyleText}>{activeBowler.bowlingType || 'Fast'} • {activeBowler.role}</Text>
                      <Text style={styles.playerScoreText}>
                        Figures: <Text style={[styles.playerRunsLarge, { color: '#60a5fa' }]}>{bowlerStats.wickets}-{bowlerStats.runs}</Text>
                        <Text style={styles.playerBallsFaced}> ({bowlerStats.overs} ov)</Text>
                      </Text>
                      <View style={styles.barsSideBySide}>
                        <View style={styles.miniBarWrapper}>
                          <Text style={styles.miniBarLabel}>Stam</Text>
                          <View style={styles.miniBarTrack}>
                            <View style={[styles.miniBarFill, { width: `${staminaPct}%` as any, backgroundColor: staminaPct > 60 ? '#3b82f6' : staminaPct > 30 ? '#f59e0b' : '#ef4444' }]} />
                          </View>
                        </View>
                        <View style={styles.miniBarWrapper}>
                          <Text style={styles.miniBarLabel}>Conf</Text>
                          <View style={styles.miniBarTrack}>
                            <View style={[styles.miniBarFill, { width: `${moralePct}%` as any, backgroundColor: '#a855f7' }]} />
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Bowling intent — 5-segment bar */}
                  <View style={styles.cardStrategyControl}>
                    {!isUserBatting ? (
                      <View>
                        <View style={styles.inlineIntentRow}>
                          <TouchableOpacity
                            style={styles.btnIntentAdjustMini}
                            disabled={intentIdx === 0}
                            onPress={() => changeBowlerIntent(-1)}
                          >
                            <Text style={[styles.btnIntentAdjustMiniText, intentIdx === 0 && { opacity: 0.3 }]}>➖</Text>
                          </TouchableOpacity>
                          <View style={styles.inlineIntentBar}>
                            {INTENT_LEVELS.map((level, idx) => (
                              <TouchableOpacity
                                key={level}
                                activeOpacity={0.7}
                                style={[
                                  styles.inlineIntentSegment,
                                  idx <= intentIdx
                                    ? { backgroundColor: INTENT_COLORS[level] }
                                    : { backgroundColor: 'rgba(255,255,255,0.08)' },
                                  idx === intentIdx && { shadowColor: INTENT_COLORS[level], shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 },
                                ]}
                                onPress={() => setBowlingIntent(level)}
                              />
                            ))}
                          </View>
                          <TouchableOpacity
                            style={styles.btnIntentAdjustMini}
                            disabled={intentIdx === INTENT_LEVELS.length - 1}
                            onPress={() => changeBowlerIntent(1)}
                          >
                            <Text style={[styles.btnIntentAdjustMiniText, intentIdx === INTENT_LEVELS.length - 1 && { opacity: 0.3 }]}>➕</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.inlineIntentLabel, { color: intentColor }]}>{getBowlerIntentLabel(intent)}</Text>

                        {/* Delivery type selector */}
                        <View style={styles.deliveryTypeRow}>
                          {(['normal', 'bouncer', 'yorker', 'slower'] as const).map(b => (
                            <TouchableOpacity
                              key={b}
                              style={[styles.deliveryTypeBtn, ballType === b && styles.deliveryTypeBtnActive]}
                              onPress={() => setBallType(b)}
                            >
                              <Text style={[styles.deliveryTypeBtnText, ballType === b && styles.deliveryTypeBtnTextActive]}>{b.toUpperCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.compactIntentDisabled}>
                        <Text style={styles.compactIntentLabelAI}>🤖 AI Managed</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* ── Coach Suggestion Box (Inline, below bowler card) ── */}
            {currentSuggestion ? (
              <View style={styles.coachTipCard}>
                <View style={styles.coachTipHeader}>
                  <Text style={styles.coachTipTitle}>💡 Coach's Tip</Text>
                </View>
                <Text style={styles.coachTipText}>
                  {currentSuggestion}
                </Text>
              </View>
            ) : null}

          </ScrollView>

          {/* ── Live Commentary Modal ── */}
          <Modal
            visible={isCommentaryOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsCommentaryOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.scorecardModalContent}>
                <View style={styles.scorecardHeaderRow}>
                  <Text style={styles.scorecardModalTitle}>🎙️ Live Commentary Feed</Text>
                  <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsCommentaryOpen(false)}>
                    <Text style={styles.closeModalBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  style={{ flex: 1, marginTop: 12 }} 
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={true}
                >
                  {[...commentary].reverse().map((c, idx) => (
                    <Text key={idx} style={[styles.commentText, idx === 0 && styles.commentTextLatest]}>{c}</Text>
                  ))}
                  {commentary.length === 0 && (
                    <Text style={{ color: THEME.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 32, fontStyle: 'italic' }}>
                      No commentary events logged yet.
                    </Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* ── Sim Actions Dock (sticky bottom) ── */}
          <View style={styles.simActionsDock}>
            {/* Play/Pause + +1 Ball */}
            <View style={styles.simActionsGroup}>
              <TouchableOpacity
                style={[styles.btnPlayPause, isSimulating && styles.btnPlayPausePlaying]}
                onPress={togglePlaySimulation}
              >
                {isSimulating ? <Pause size={14} stroke="#fff" /> : <Play size={14} stroke="#000" />}
                <Text style={[styles.btnPlayPauseText, isSimulating && { color: '#fff' }]}>
                  {isSimulating ? 'PAUSE' : 'PLAY'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnStep}
                onPress={playSingleBall}
                disabled={isSimulating}
              >
                <Text style={[styles.btnStepText, isSimulating && { opacity: 0.4 }]}>+1 BALL</Text>
              </TouchableOpacity>
            </View>

            {/* Speed group */}
            <View style={styles.simSpeedGroup}>
              <Text style={styles.simGroupLabel}>SPEED</Text>
              <View style={styles.simSegmentedControl}>
                {([{ key: 'ball', label: '1x' }, { key: 'over', label: 'Over' }, { key: 'instant', label: 'Max' }] as const).map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.simSegmentBtn, simSpeed === opt.key && styles.simSegmentBtnActive]}
                    onPress={() => setSimSpeed(opt.key)}
                  >
                    <Text style={[styles.simSegmentText, simSpeed === opt.key && styles.simSegmentTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sim-to group */}
            <View style={styles.simSpeedGroup}>
              <Text style={styles.simGroupLabel}>SIM TO</Text>
              <View style={styles.simSegmentedControl}>
                <TouchableOpacity style={styles.simSegmentBtn} onPress={simulateToOver} disabled={isSimulating}>
                  <Text style={[styles.simSegmentText, isSimulating && { opacity: 0.4 }]}>OVER</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.simSegmentBtn} onPress={simulateToWicket} disabled={isSimulating}>
                  <Text style={[styles.simSegmentText, isSimulating && { opacity: 0.4 }]}>WICKET</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.simSegmentBtn} onPress={handleSimulateRest} disabled={isSimulating}>
                  <Text style={[styles.simSegmentText, isSimulating && { opacity: 0.4 }]}>INNINGS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}



      {matchPhase === 'complete' && (
        <View style={styles.panel}>
          <Award size={48} stroke={THEME.colors.secondary} style={styles.centerIcon} />
          <Text style={styles.completeTitle}>MATCH COMPLETED</Text>
          <Text style={styles.winnerAnnounce}>
            {winner === 'user_team' ? '🏆 YOU WON THE MATCH! 🏆' : `Winner: ${teams.find(t => t.id === winner)?.name || 'AI'}`}
          </Text>
          
          <View style={styles.finalScores}>
            <Text style={styles.finalScoreText}>
              {innings1.teamId === 'user_team' ? 'Your Team' : (aiTeam?.name || 'AI')}: {innings1.totalRuns}/{innings1.wickets}
            </Text>
            <Text style={styles.finalScoreText}>
              {innings2.teamId === 'user_team' ? 'Your Team' : (aiTeam?.name || 'AI')}: {innings2.totalRuns}/{innings2.wickets}
            </Text>
          </View>

          {playerOfTheMatch && (
            <View style={{ marginVertical: 12, padding: 12, backgroundColor: THEME.colors.surfaceLight, borderRadius: 8, alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: THEME.colors.warning, letterSpacing: 1, marginBottom: 4 }}>PLAYER OF THE MATCH</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: THEME.colors.text }}>{playerOfTheMatch.name}</Text>
              <Text style={{ fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 }}>{playerOfTheMatch.stats}</Text>
            </View>
          )}

          {matchResultObj && activeMatchInfo && (
            <View style={{ marginVertical: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: THEME.colors.border, width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: THEME.colors.textSecondary }}>
                Match Earnings: +${(activeMatchInfo.team1Id === 'user_team' ? matchResultObj.matchEarnings.team1 : matchResultObj.matchEarnings.team2).toLocaleString()}
              </Text>
              <Text style={{ fontSize: 12, color: THEME.colors.textSecondary, marginTop: 2 }}>
                Sponsorship Revenue: +${(activeMatchInfo.team1Id === 'user_team' ? matchResultObj.sponsorshipEarnings.team1 : matchResultObj.sponsorshipEarnings.team2).toLocaleString()}
              </Text>
              {playerOfTheMatch?.teamId === 'user_team' && (
                <Text style={{ fontSize: 12, color: THEME.colors.warning, fontWeight: 'bold', marginTop: 2 }}>
                  Player of the Match Bonus: +$10,000
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={[styles.startButton, { backgroundColor: THEME.colors.surfaceLight, marginTop: 10 }]} onPress={() => setIsScorecardOpen(true)}>
            <Text style={styles.startButtonText}>📊 View Full Scorecard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.startButton, { marginTop: 10 }]} onPress={handleConfirmMatchComplete}>
            <Text style={styles.startButtonText}>Confirm & Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Detailed Live Scorecard Modal */}
      <Modal
        visible={isScorecardOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsScorecardOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.scorecardModalContent}>
            <View style={styles.scorecardHeaderRow}>
              <Text style={styles.scorecardModalTitle}>📊 Match Scorecard</Text>
              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsScorecardOpen(false)}>
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            {/* Innings Tabs */}
            <View style={styles.scorecardTabsRow}>
              <TouchableOpacity
                style={[styles.scorecardTabBtn, scorecardTab === 1 && styles.scorecardTabBtnActive]}
                onPress={() => setScorecardTab(1)}
              >
                <Text style={[styles.scorecardTabBtnText, scorecardTab === 1 && styles.scorecardTabBtnTextActive]}>
                  1st Innings ({innings1.teamId === 'user_team' ? 'User' : (aiTeam?.name || 'AI')})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scorecardTabBtn, scorecardTab === 2 && styles.scorecardTabBtnActive]}
                disabled={currentInnings < 2 && innings2.balls === 0}
                onPress={() => setScorecardTab(2)}
              >
                <Text style={[
                  styles.scorecardTabBtnText, 
                  scorecardTab === 2 && styles.scorecardTabBtnTextActive,
                  (currentInnings < 2 && innings2.balls === 0) && { opacity: 0.4 }
                ]}>
                  2nd Innings ({innings2.teamId === 'user_team' ? 'User' : (aiTeam?.name || 'AI')})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Scorecard Sheets */}
            <ScrollView style={styles.scorecardScroll} showsVerticalScrollIndicator={false}>
              {(() => {
                const targetInnings = scorecardTab === 1 ? innings1 : innings2;
                if (!targetInnings || !targetInnings.teamId) {
                  return (
                    <View style={styles.emptyScorecardState}>
                      <Text style={styles.emptyScorecardText}>Innings not yet started.</Text>
                    </View>
                  );
                }

                const targetTeam = targetInnings.teamId === 'user_team' ? userTeam : aiTeam;
                const opponentTeam = targetInnings.teamId === 'user_team' ? aiTeam : userTeam;
                // Aggregate batting statistics from ballsFaced
                const batsmanMap: Record<string, { runs: number; balls: number; dismissed: boolean; dismissalComment: string }> = {};
                
                // Pre-populate with order
                targetInnings.battingOrder.forEach(id => {
                  batsmanMap[id] = { runs: 0, balls: 0, dismissed: false, dismissalComment: 'not out' };
                });

                targetInnings.ballsFaced.forEach(b => {
                  if (!b.batsmanId) return;
                  if (!batsmanMap[b.batsmanId]) {
                    batsmanMap[b.batsmanId] = { runs: 0, balls: 0, dismissed: false, dismissalComment: 'not out' };
                  }
                  if (b.result !== 'wide') {
                    batsmanMap[b.batsmanId].runs += b.runs;
                    batsmanMap[b.batsmanId].balls += 1;
                  }
                  if (b.isWicket) {
                    batsmanMap[b.batsmanId].dismissed = true;
                    batsmanMap[b.batsmanId].dismissalComment = b.commentary || 'Dismissed';
                  }
                });

                const battingSequence = [...targetInnings.battingOrder];
                Object.keys(batsmanMap).forEach(id => {
                  if (!battingSequence.includes(id)) {
                    battingSequence.push(id);
                  }
                });

                // Aggregate bowling statistics from ballsFaced
                const bowlerMap: Record<string, { ballsBowled: number; runsConceded: number; wickets: number }> = {};
                targetInnings.ballsFaced.forEach(b => {
                  if (!b.bowlerId) return;
                  if (!bowlerMap[b.bowlerId]) {
                    bowlerMap[b.bowlerId] = { ballsBowled: 0, runsConceded: 0, wickets: 0 };
                  }
                  bowlerMap[b.bowlerId].runsConceded += b.runs;
                  if (b.result !== 'wide' && b.result !== 'noball') {
                    bowlerMap[b.bowlerId].ballsBowled += 1;
                  }
                  if (b.isWicket && b.wicketType !== 'run out') {
                    bowlerMap[b.bowlerId].wickets += 1;
                  }
                });

                const bowlingList = Object.keys(bowlerMap).map(id => {
                  const bInfo = bowlerMap[id];
                  const oversStr = `${Math.floor(bInfo.ballsBowled / 6)}.${bInfo.ballsBowled % 6}`;
                  const oversFloat = bInfo.ballsBowled / 6;
                  const econ = oversFloat > 0 ? (bInfo.runsConceded / oversFloat).toFixed(2) : '0.00';
                  return {
                    bowlerId: id,
                    overs: oversStr,
                    runs: bInfo.runsConceded,
                    wickets: bInfo.wickets,
                    econ
                  };
                });

                return (
                  <View style={{ gap: THEME.spacing.md }}>
                    <View style={styles.scorecardSummaryPanel}>
                      <Text style={styles.summaryRunsText}>
                        Total: {targetInnings.totalRuns}/{targetInnings.wickets}
                      </Text>
                      <Text style={styles.summaryOversText}>
                        Overs: {Math.floor(targetInnings.balls / 6)}.{targetInnings.balls % 6} (Extras: {targetInnings.extras})
                      </Text>
                    </View>

                    {/* Batting Roster Scorecard */}
                    <View style={styles.tablePanel}>
                      <Text style={styles.tableTitleText}>🏏 Batting Scorecard</Text>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.thText, { flex: 2 }]}>Batsman</Text>
                        <Text style={[styles.thText, { flex: 2 }]}>Status</Text>
                        <Text style={[styles.thText, { flex: 0.6, textAlign: 'right' }]}>R</Text>
                        <Text style={[styles.thText, { flex: 0.6, textAlign: 'right' }]}>B</Text>
                        <Text style={[styles.thText, { flex: 0.8, textAlign: 'right' }]}>SR</Text>
                      </View>
                      
                      {battingSequence.length === 0 ? (
                        <Text style={styles.noDataRowText}>No batsmen faced a delivery yet.</Text>
                      ) : (
                        battingSequence.map(batsmanId => {
                          const playerObj = targetTeam?.players.find(p => p.id === batsmanId);
                          const bStat = batsmanMap[batsmanId];
                          const sr = bStat.balls > 0 ? ((bStat.runs / bStat.balls) * 100).toFixed(1) : '0.0';
                          return (
                            <View key={batsmanId} style={styles.tableRow}>
                              <Text style={[styles.tdText, { flex: 2, fontWeight: 'bold' }]} numberOfLines={1}>
                                {playerObj?.name || 'Unknown'}
                              </Text>
                              <Text style={[styles.tdText, { flex: 2, color: THEME.colors.textMuted }]} numberOfLines={2}>
                                {bStat.dismissed ? (bStat.dismissalComment || 'out') : 'not out'}
                              </Text>
                              <Text style={[styles.tdText, { flex: 0.6, textAlign: 'right', fontWeight: 'bold' }]}>
                                {bStat.runs}
                              </Text>
                              <Text style={[styles.tdText, { flex: 0.6, textAlign: 'right' }]}>
                                {bStat.balls}
                              </Text>
                              <Text style={[styles.tdText, { flex: 0.8, textAlign: 'right', color: THEME.colors.secondary }]}>
                                {sr}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>

                    {/* Bowling Roster Scorecard */}
                    <View style={styles.tablePanel}>
                      <Text style={styles.tableTitleText}>🥎 Bowling Scorecard</Text>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.thText, { flex: 2 }]}>Bowler</Text>
                        <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Overs</Text>
                        <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Runs</Text>
                        <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Wkts</Text>
                        <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Econ</Text>
                      </View>

                      {bowlingList.length === 0 ? (
                        <Text style={styles.noDataRowText}>No bowlers delivered yet.</Text>
                      ) : (
                        bowlingList.map(bow => {
                          const playerObj = opponentTeam?.players.find(p => p.id === bow.bowlerId);
                          return (
                            <View key={bow.bowlerId} style={styles.tableRow}>
                              <Text style={[styles.tdText, { flex: 2, fontWeight: 'bold' }]} numberOfLines={1}>
                                {playerObj?.name || 'Unknown'}
                              </Text>
                              <Text style={[styles.tdText, { flex: 1, textAlign: 'right' }]}>
                                {bow.overs}
                              </Text>
                              <Text style={[styles.tdText, { flex: 1, textAlign: 'right' }]}>
                                {bow.runs}
                              </Text>
                              <Text style={[styles.tdText, { flex: 1, textAlign: 'right', color: THEME.colors.warning }]}>
                                {bow.wickets}
                              </Text>
                              <Text style={[styles.tdText, { flex: 1, textAlign: 'right', color: THEME.colors.secondary }]}>
                                {bow.econ}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: THEME.spacing.xl + 20,
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.primaryLight,
    fontWeight: 'bold',
    fontSize: 12,
  },
  headerTeamsText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  volumeToggle: {
    padding: 6,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    margin: THEME.spacing.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: THEME.spacing.md,
  },
  reportRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  reportItem: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  reportLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  reportVal: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: THEME.spacing.sm,
  },
  tossButtonsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  tossBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tossDecisionBox: {
    marginTop: THEME.spacing.md,
    padding: THEME.spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tossResultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.secondary,
    marginBottom: 6,
  },
  tossResultText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  tossActionRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  tossChoiceBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tossChoiceBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tossProceedBtn: {
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tossProceedBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listArea: {
    flex: 1,
    marginBottom: THEME.spacing.md,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: THEME.spacing.md,
  },
  playerListItem: {
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerListItemSelected: {
    borderColor: colors.secondary,
    borderWidth: 2,
    backgroundColor: `${colors.secondary}15`,
  },
  playerListName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerListDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  confirmBtn: {
    height: 48,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: THEME.spacing.md,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.border,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiLoadingText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: THEME.spacing.lg,
  },
  readyTitle: {
    color: colors.warning,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  readyTeams: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  readyOverview: {
    backgroundColor: colors.surfaceLight,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  overviewBox: {
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}88`,
    paddingBottom: 8,
  },
  overviewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  overviewVal: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  startButton: {
    height: 52,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  breakTitle: {
    color: colors.primaryLight,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
  },
  breakScore: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  breakTarget: {
    color: colors.warning,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  playboard: {
    flex: 1,
    padding: THEME.spacing.md,
  },
  scoreboard: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batTeamText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  scoreText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  oversBox: {
    alignItems: 'flex-end',
  },
  oversLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  oversVal: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  subScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: `${colors.border}66`,
    paddingTop: 8,
    marginTop: 8,
  },
  rrText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  liveDetails: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  playerDetailBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  detailDesc: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  overProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.md,
    gap: 8,
  },
  overLabelText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  dotCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyOverText: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  suggestionBox: {
    backgroundColor: `${colors.primary}12`,
    borderColor: `${colors.primary}33`,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
  },
  suggestionTitle: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  suggestionText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  intentPanel: {
    backgroundColor: colors.surface,
    padding: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.md,
  },
  intentOption: {
    marginBottom: 4,
  },
  intentLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  intentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  intentBtn: {
    flex: 1,
    height: 32,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  intentBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  intentBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  ballTypeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  ballTypeBtn: {
    flex: 1,
    height: 28,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  ballTypeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  ballTypeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: 'bold',
  },
  commentaryBox: {
    height: 120,
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: THEME.spacing.sm,
  },
  commentaryTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
    paddingBottom: 4,
    marginBottom: 6,
  },
  commentaryScroll: {
    flex: 1,
  },
  commentText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  speedSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: `${colors.border}44`,
    marginTop: THEME.spacing.sm,
  },
  speedLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  speedButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  speedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  speedBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  speedBtnTextActive: {
    color: '#fff',
  },
  simControls: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
    paddingBottom: THEME.spacing.xl + 10, // Safe Area padding
  },
  singleBallBtn: {
    flex: 1.5,
    height: 44,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  playSimBtn: {
    flex: 1.2,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  fastSimBtn: {
    flex: 1.2,
    height: 44,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerIcon: {
    alignSelf: 'center',
    marginBottom: THEME.spacing.md,
  },
  completeTitle: {
    color: colors.secondary,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  winnerAnnounce: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
  },
  finalScores: {
    backgroundColor: colors.surfaceLight,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.xl,
    gap: THEME.spacing.sm,
  },
  finalScoreText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pitchWeatherBar: {
    backgroundColor: `${colors.primary}22`,
    borderWidth: 1,
    borderColor: `${colors.primary}55`,
    borderRadius: THEME.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  pitchWeatherText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
    paddingVertical: 4,
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  checkboxCheckmark: {
    color: colors.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  scorecardIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}22`,
    borderWidth: 1,
    borderColor: `${colors.primary}55`,
    borderRadius: THEME.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
    marginHorizontal: 8,
  },
  scorecardBtnText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: 'bold',
  },
  activePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  playerAvatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
  },
  scorecardModalContent: {
    flex: 1,
    backgroundColor: colors.background,
    marginVertical: 40,
    marginHorizontal: 20,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  scorecardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: THEME.spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scorecardModalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
  },
  closeModalBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  scorecardTabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scorecardTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scorecardTabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight,
  },
  scorecardTabBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  scorecardTabBtnTextActive: {
    color: colors.primaryLight,
  },
  scorecardScroll: {
    flex: 1,
    padding: THEME.spacing.md,
  },
  emptyScorecardState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyScorecardText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  scorecardSummaryPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRunsText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  summaryOversText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  tablePanel: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: THEME.spacing.md,
  },
  tableTitleText: {
    color: colors.primaryLight,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: THEME.spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}88`,
    paddingBottom: 6,
    marginBottom: 6,
  },
  thText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}22`,
    alignItems: 'center',
  },
  tdText: {
    color: colors.text,
    fontSize: 12,
  },
  noDataRowText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  selectionAvatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  selectionAvatarReady: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceLight,
    marginVertical: 6,
  },

  // ─── Scoreboard Card ───────────────────────────────────────────
  scoreboardCard: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  matchupHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  matchupTeamName: {
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
    textAlign: 'center',
  },
  matchupVs: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  weatherPitchBar: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  weatherPitchText: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
  mainScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  runsWicketsBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    gap: 2,
  },
  runsText: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 44,
  },
  scoreDivider: {
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 44,
  },
  wicketsText: {
    color: colors.danger,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 44,
  },
  oversOtherBlock: {
    alignItems: 'center',
  },
  oversSmallLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  oversSmallVal: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statsBarRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    marginBottom: 6,
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Recent Ball Bubbles ──────────────────────────────────────
  recentBallsScroll: {
    marginTop: 4,
  },
  recentBallsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  recentBallBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentBallText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
  },
  recentBallSep: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
    marginHorizontal: 2,
  },

  // ─── Active Player Cards (Batsman / Bowler) ─────────────────
  activeBatsmenGrid: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  playerCardNew: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 10,
    gap: 8,
    overflow: 'hidden',
    minWidth: 0,
    minHeight: 145,
  },
  playerCardOnStrike: {
    borderWidth: 2,
    borderColor: '#eab308',
    shadowColor: '#eab308',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bowlerCardNew: {
    flex: 0,
    height: undefined,
    minHeight: 145,
    alignSelf: 'stretch',
    flexDirection: 'column',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
    overflow: 'hidden',
    minWidth: 0,
  },
  cardMainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    minWidth: 0,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'visible',
    flexShrink: 0,
    position: 'relative',
  },
  avatarRingImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  skillBadgeMini: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skillBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  playerCardDetails: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    flexShrink: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
    minWidth: 0,
    flexShrink: 1,
  },
  playerCardName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  strikerIcon: {
    fontSize: 13,
  },
  playerStyleText: {
    color: colors.textMuted,
    fontSize: 10,
  },
  playerScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  playerRunsLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  playerBallsFaced: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '400',
  },

  // ─── Side-by-side bars ────────────────────────────────────────
  barsSideBySide: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  miniBarWrapper: {
    flex: 1,
    gap: 2,
  },
  miniBarLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniBarTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ─── Bowler vertical stamina bar ─────────────────────────────
  bowlerRightStamina: {
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 8,
    marginLeft: 4,
    height: 55,
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  verticalBarTrack: {
    width: 8,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  verticalBarFill: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  staminaLabel: {
    color: colors.textMuted,
    fontSize: 6,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ─── Compact Intent Adjuster (inline card bottom) ─────────────
  cardStrategyControl: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 6,
  },
  compactIntentAdjuster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  compactIntentDisabled: {
    justifyContent: 'center',
  },
  btnIntentAdjustMini: {
    padding: 4,
  },
  btnIntentAdjustMiniText: {
    fontSize: 12,
  },
  compactIntentLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  compactIntentLabelAI: {
    flex: 1,
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ─── Strategy & Intent Panel ──────────────────────────────────
  strategyPanel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
    gap: 0,
  },
  strategyPanelTitle: {
    color: '#eab308',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  intentSection: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 10,
  },
  intentSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  intentSectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  batsmanIntentRow: {
    gap: 6,
    marginBottom: 10,
  },
  playerIntentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intentAvatarTiny: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intentPlayerName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  intentPlayerRole: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '400',
  },
  intentProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnIntentAdjust: {
    padding: 4,
  },
  btnIntentAdjustText: {
    fontSize: 14,
    color: '#fff',
  },
  intentProgressBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 18,
  },
  intentBarSegment: {
    flex: 1,
    borderRadius: 3,
    height: '100%',
  },
  intentBarSegmentActive: {
    shadowColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  intentLabelDisplay: {
    alignItems: 'center',
    marginTop: 4,
  },
  activeIntentName: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  disabledIntentBar: {
    gap: 4,
    opacity: 0.6,
  },
  aiManagedLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },

  // ─── Sim Actions Dock ─────────────────────────────────────────
  simActionsDock: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 10,
    gap: 8,
  },
  simActionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPlayPause: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eab308',
    borderRadius: 8,
    paddingVertical: 10,
  },
  btnPlayPausePlaying: {
    backgroundColor: '#ef4444',
  },
  btnPlayPauseText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  btnStep: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
  },
  btnStepText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  simSpeedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  simGroupLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    minWidth: 48,
  },
  simSegmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  simSegmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  simSegmentBtnActive: {
    backgroundColor: colors.primary,
  },
  simSegmentText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  simSegmentTextActive: {
    color: '#fff',
  },

  // ─── Commentary Panel ─────────────────────────────────────────
  commentaryPanel: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
    height: 190,
    padding: 10,
    overflow: 'hidden',
  },
  commentaryHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  commentaryHeaderText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  commentTextLatest: {
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#eab308',
    borderRadius: 2,
    fontWeight: 'bold',
  },

  // ─── Inline 5-segment intent bar ─────────────────────────────
  inlineIntentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineIntentBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 14,
  },
  inlineIntentSegment: {
    flex: 1,
    borderRadius: 3,
    height: '100%',
  },
  inlineIntentLabel: {
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ─── Avoid Singles row ────────────────────────────────────────
  avoidSinglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    marginBottom: 6,
  },

  // ─── Delivery Type Buttons (inside bowler card) ───────────────
  deliveryTypeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  deliveryTypeBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  deliveryTypeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  deliveryTypeBtnText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  deliveryTypeBtnTextActive: {
    color: '#fff',
  },
  coachTipCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  coachTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  coachTipTitle: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachTipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
