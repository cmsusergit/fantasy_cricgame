<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { teamStore, scheduleStore } from '$lib/stores/gameState';
  import { getAvatarUrl } from '$lib/models/faction';
  import { loadActiveMatch, saveActiveMatch, clearActiveMatch } from '$lib/services/storage';
  import { resolveBall, updateFatigueAndMorale, calculateCurrentRunRate, getOverBalls, resolveMatch } from '$lib/core/matchEngine';
  import { getAIIntent } from '$lib/core/teamBuilder';
  import type { Player } from '$lib/models/player';
  import type { Team } from '$lib/models/team';
  import type { Match, innings, IntentType, BallType } from '$lib/models/match';
  import type { ScheduledMatch, TournamentSchedule } from '$lib/core/schedule';
  import MatchControls, { type SimSpeed } from '$lib/components/match/MatchControls.svelte';
  import BallFeed from '$lib/components/match/BallFeed.svelte';
  import Scoreboard from '$lib/components/match/Scoreboard.svelte';
  import FullScorecard from '$lib/components/match/FullScorecard.svelte';
  import MatchSummary from '$lib/components/match/MatchSummary.svelte';
  import { goto } from '$app/navigation';
  
  type Phase = 'loading' | 'toss' | 'selectOpeningBatsmen' | 'selectOpeningBowler' | 'selectNextBatsman' | 'selectNextBowler' | 'ready' | 'inningBreak' | 'playing' | 'paused' | 'complete' | 'invalidSquad';
  
  const weatherTypes = ['sunny', 'cloudy', 'rain', 'storm'] as const;
  const pitchTypes = ['flat', 'balanced', 'turning', 'seaming', 'bouncing'] as const;
  const weatherEmojis: Record<string, string> = { sunny: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️' };
  const pitchEmojis: Record<string, string> = { flat: '🎯', balanced: '⚖️', turning: '🔄', seaming: '🌊', bouncing: '🏐' };
  
  const totalOvers = 20;
  
  let teams = $state<Team[]>([]);
  let schedule = $state<TournamentSchedule | null>(null);
  let currentMatch = $state<ScheduledMatch | null>(null);
  
  let phase = $state<Phase>('loading');
  let weather = $state('sunny');
  let pitch = $state('balanced');
  
  let matchTeam1 = $state<Team | null>(null);
  let matchTeam2 = $state<Team | null>(null);
  
  let innings1 = $state<innings>(createEmptyInnings());
  let innings2 = $state<innings>(createEmptyInnings());
  
  let currentInnings = $state(1);
  let target = $state(0);
  let matchResultObj = $state<any>(null);
  let currentBowlerIndex = $state(0);
  let ballInterval: any = null;
  
  let gameSpeed = $state<SimSpeed>('ball');

  let isComplete = $state(false);
  let currentBallType: BallType = $state('normal');
  let avoidSingles = $state(false);  
  let noMatchAvailable = $state(false);
  let autoResume = $state(false);
  let speed = $state<'instant' | 'ball' | 'over'>('instant');
  let autoPlayDelay = $state<number>(1000);
  let targetOver = $state<number>(15);
  
  type SimTarget = { type: 'innings' | 'over' | 'specific_over' | 'wicket', value?: number } | null;
  let simulationTarget = $state<SimTarget>(null);

  // Derived properties - Order matters!
  let currentInningsData = $derived(currentInnings === 1 ? innings1 : innings2);
  let currentBattingTeam = $derived(
    currentInnings === 1 
      ? (innings1.teamId === matchTeam1?.id ? matchTeam1 : matchTeam2)
      : (innings2.teamId === matchTeam1?.id ? matchTeam1 : matchTeam2)
  );
  let currentBowlingTeam = $derived(
    currentInnings === 1 
      ? (innings1.teamId === matchTeam1?.id ? matchTeam2 : matchTeam1)
      : (innings2.teamId === matchTeam1?.id ? matchTeam2 : matchTeam1)
  );

  
  let runRate = $derived(calculateCurrentRunRate(currentInningsData));
  let currentOverBalls = $derived(getOverBalls(currentInningsData));

  let showSuggestion = $state(false);
  let currentSuggestion = $derived.by(() => {
     if (!currentInningsData) return "No suggestions available yet.";
     
     const totalOvers = 20; // Assuming T20 for now
     const currentOver = Math.floor(currentInningsData.balls / 6);
     const isBatting = currentBattingTeam?.id === 'user_team';
     const isBowling = currentBowlingTeam?.id === 'user_team';
     const wickets = currentInningsData.wickets;
     const runRateValue = parseFloat(calculateCurrentRunRate(currentInningsData));
     const reqRate = target ? ((target - currentInningsData.totalRuns) / Math.max(1, (120 - currentInningsData.balls))) * 6 : null;

     let suggestion = "";
     
     let currentBatsman: Player | undefined;
     let currentBowler: Player | undefined;

     if (isBatting) {
        currentBatsman = currentBattingTeam?.players.find(p => p.id === currentInningsData.currentBatsmen[0]);
        if (!currentBatsman) return "Error: Current batsman not found.";
        
        if (currentOver < 6) {
           suggestion = "Powerplay! Exploit field restrictions.";
           if (currentBatsman.stats.power > 70) suggestion += ` ${currentBatsman.name} is powerful, consider 'Aggressive' intent.`;
           else if (currentBatsman.stats.technique > 70) suggestion += ` ${currentBatsman.name} has good technique, 'Balanced' might preserve wickets.`;
           
           if (wickets >= 2) suggestion += " Early wickets lost! Maybe drop to 'Balanced' or 'Defensive' to rebuild, especially if current batsman has low technique.";
           else suggestion += " 'Aggressive' intent is usually good.";

        } else if (currentOver > 15) {
           suggestion = "Death overs!";
           if (currentBatsman.stats.power > 80) suggestion += ` ${currentBatsman.name} is a strong hitter, go 'Very Aggressive' to maximize runs.`;
           else suggestion += " Try to hit boundaries, go 'Aggressive' or 'Very Aggressive'.";
           
        } else { // Middle overs
           if (wickets >= 5) suggestion = "Middle overs, lost too many wickets. Play 'Defensive' to survive.";
           else if (reqRate && reqRate > runRateValue + 2) suggestion = "Falling behind required rate! Time to shift to 'Aggressive'.";
           else suggestion = "Middle overs. 'Balanced' is a safe bet to keep the scoreboard ticking.";

           if (currentBatsman.stats.technique < 50) suggestion += ` ${currentBatsman.name}'s technique is low, be cautious.`;
        }
     } else if (isBowling) {
        currentBowler = currentBowlingTeam?.players.find(p => p.id === selectedBowlerId); // Using selectedBowlerId for user intent
        
        if (phase === 'selectOpeningBowler' || phase === 'selectNextBowler') {
            const topBowlers = getAvailableBowlers().sort((a,b) => b.stats.bowling - a.stats.bowling);
            if (topBowlers.length > 0) suggestion = `Consider selecting ${topBowlers[0].name} (Bowling: ${topBowlers[0].stats.bowling}). `;
            suggestion += "Look for bowlers with good stamina if you want them for multiple overs.";
        } else if (currentBowler) {
            if (currentOver < 6) {
               suggestion = "Powerplay! Batsmen will attack.";
               if (currentBowler.stats.bowling > 75) suggestion += ` ${currentBowler.name} is a strong bowler, 'Aggressive' might get an early wicket.`;
               else suggestion += " 'Defensive' can stem the flow.";
            } else if (currentOver > 15) {
               suggestion = "Death overs!";
               if (currentBowler.bowlingType === 'fast' || currentBowler.bowlingType === 'swinger') suggestion += ` ${currentBowler.name} can bowl 'Yorker' or 'Slower' balls. Use 'Defensive' intent.`;
               else if (currentBowler.bowlingType === 'spinner') suggestion += ` ${currentBowler.name} might try variations like 'Googly' or 'Arm Ball'. Use 'Defensive' intent.`;
               else suggestion += " Use 'Defensive' intent with appropriate ball types.";
            } else { // Middle overs
               if (runRateValue > 9) suggestion = "They are scoring fast! 'Defensive' intent and 'Avoid Singles' might help.";
               else suggestion = "Middle overs. 'Balanced' or 'Aggressive' to try and break partnerships.";

               if (currentBowler.stats.bowling < 60) suggestion += ` ${currentBowler.name}'s bowling skill is moderate, be careful with 'Aggressive' intent.`;
            }
        } else {
            suggestion = "Select a bowler to get more specific advice!";
        }
     }

     return suggestion;
  });

  let selectedBatsmen = $state<string[]>([]);
  let tempSelectedBowlerId = $state<string | null>(null);
  let selectedBowlerId = $state<string | null>(null);
  let pendingBowlerSelection = $state(false);
  let placeholderBatsman = $state<string | null>(null);

  let showFullBattingDrawer = $state(false);
  
  let tossWinner = $state<string | null>(null);
  let tossChoice = $state<'bat' | 'bowl' | null>(null);
  let isTossing = $state(false);

  let showImpactAnimation = $state(false);
  let impactAnimationType = $state<'wicket' | 'four' | 'six' | null>(null);
  let animationTimeout: any = null;
  
  function createEmptyInnings(): innings {
    return {
      teamId: '', totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
      ballsFaced: [], battingOrder: [], currentBatsmen: ['', ''],
      batsmanConcentration: {}, bowlerRhythm: {}
    };
  }

  function hexToRgb(hex: string | undefined): string {
    if (!hex) return '148, 163, 184';
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '148, 163, 184';
  }
  
  function getRandomWeather() {
    const weights = [0.40, 0.30, 0.20, 0.10];
    const roll = Math.random();
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) return weatherTypes[i];
    }
    return 'sunny';
  }
  
  function getRandomPitch() {
    const weights = [0.15, 0.35, 0.20, 0.20, 0.10];
    const roll = Math.random();
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) return pitchTypes[i];
    }
    return 'balanced';
  }

  async function initMatchState(s: any) {
    if (s && teams.length >= 2 && phase === 'loading') {
      const userMatch = s.matches.find((m: any) => 
        m.status === 'scheduled' && 
        (m.team1Id === 'user_team' || m.team2Id === 'user_team') &&
        m.day === s.currentDay
      );
      
      const userT = teams.find(t => t.id === 'user_team');
      
      if (userMatch) {
        if (!userT || !userT.playing11 || userT.playing11.length !== 11 || !userT.captain || !userT.wicketKeeper) {
          phase = 'invalidSquad';
          return;
        }

        currentMatch = userMatch;
        matchTeam1 = teams.find(t => t.id === userMatch.team1Id) || null;
        matchTeam2 = teams.find(t => t.id === userMatch.team2Id) || null;
        
        // Check for existing saved match state
        const savedMatch = await loadActiveMatch();
        if (savedMatch && savedMatch.matchId === userMatch.id) {
            phase = savedMatch.phase as Phase;
            innings1 = savedMatch.innings1;
            innings2 = savedMatch.innings2;
            currentInnings = savedMatch.currentInnings;
            target = savedMatch.target;
            weather = savedMatch.weather;
            pitch = savedMatch.pitch;
            tossWinner = savedMatch.tossWinner;
            tossChoice = savedMatch.tossChoice;
            currentBowlerIndex = savedMatch.currentBowlerIndex;
            selectedBatsmen = savedMatch.selectedBatsmen;
            selectedBowlerId = savedMatch.selectedBowlerId;
            placeholderBatsman = savedMatch.placeholderBatsman;
            pendingBowlerSelection = savedMatch.pendingBowlerSelection;
        } else {
            weather = getRandomWeather();
            pitch = getRandomPitch();
            phase = 'toss';
            clearActiveMatch();
        }
      } else {
        noMatchAvailable = true;
      }
    }
  }

  onMount(() => {
    const unsubTeam = teamStore.subscribe(t => {
      teams = t;
      if (schedule && phase === 'loading') {
        initMatchState(schedule);
      }
    });
    const unsubSchedule = scheduleStore.subscribe(s => {
      schedule = s;
      initMatchState(s);
    });
    
    return () => { unsubTeam(); unsubSchedule(); };
  });

  function syncActiveMatchState() {
      if (!currentMatch || phase === 'loading' || phase === 'invalidSquad' || phase === 'complete' || noMatchAvailable) return;
      saveActiveMatch({
          matchId: currentMatch.id,
          phase,
          innings1,
          innings2,
          currentInnings,
          target,
          weather,
          pitch,
          tossWinner,
          tossChoice,
          currentBowlerIndex,
          selectedBatsmen,
          selectedBowlerId,
          placeholderBatsman,
          pendingBowlerSelection,
          savedAt: Date.now()
      });
  }
  
  function getPlaying11(team: Team) {
    return team.playing11 && team.playing11.length === 11 
      ? team.playing11 
      : team.players.slice(0, 11).map(p => p.id);
  }

  function getSortedBattingOrder(team: Team) {
      const p11 = getPlaying11(team);
      return team.players.filter(p => p11.includes(p.id)).sort((a,b) => b.stats.batting - a.stats.batting).map(p => p.id);
  }

  function getBowlers(team: Team) {
    const p11 = getPlaying11(team);
    const bowlers = team.players.filter(p => p11.includes(p.id) && (p.role === 'bowler' || p.role === 'allrounder')).map(p => p.id);
    if (bowlers.length < 5) {
      const extra = team.players.filter(p => p11.includes(p.id) && !bowlers.includes(p.id)).slice(0, 5 - bowlers.length).map(p => p.id);
      return [...bowlers, ...extra];
    }
    return bowlers.slice(0, 5);
  }

  function checkInitialSelection() {
    const currentInn = currentInnings === 1 ? innings1 : innings2;
    const isUserBatting = currentInn.teamId === 'user_team';
    
    if (isUserBatting) {
        phase = 'selectOpeningBatsmen';
        selectedBatsmen = [];
    } else {
        phase = 'selectOpeningBowler';
        selectedBowlerId = null;
    }
  }

  function performToss() {
    if (!matchTeam1 || !matchTeam2) return;
    isTossing = true;
    setTimeout(() => {
      const userWon = Math.random() > 0.5;
      tossWinner = userWon ? 'user_team' : (matchTeam1!.id === 'user_team' ? matchTeam2!.id : matchTeam1!.id);
      
      if (!userWon) {
         tossChoice = Math.random() > 0.5 ? 'bat' : 'bowl';
         setTimeout(() => {
            if (tossChoice === 'bat') {
                startGame(tossWinner!);
            } else {
                startGame('user_team');
            }
         }, 3000);
      }
      isTossing = false;
    }, 1500);
  }

  function startGame(battingTeamId: string) {
    if (!matchTeam1 || !matchTeam2) return;
    const battingTeamObj = matchTeam1.id === battingTeamId ? matchTeam1 : matchTeam2;
    const bowlingTeamObj = matchTeam1.id === battingTeamId ? matchTeam2 : matchTeam1;

    const t1BattingOrder = battingTeamId === 'user_team' ? getPlaying11(battingTeamObj) : getSortedBattingOrder(battingTeamObj);
    const t2BattingOrder = bowlingTeamObj.id === 'user_team' ? getPlaying11(bowlingTeamObj) : getSortedBattingOrder(bowlingTeamObj);

    innings1 = { teamId: battingTeamObj.id, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0, ballsFaced: [], battingOrder: t1BattingOrder, currentBatsmen: [t1BattingOrder[0], t1BattingOrder[1]], impactPlayer: null };
    innings2 = { teamId: bowlingTeamObj.id, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0, ballsFaced: [], battingOrder: t2BattingOrder, currentBatsmen: [t2BattingOrder[0], t2BattingOrder[1]], impactPlayer: null };
    
    currentInnings = 1;
    currentBowlerIndex = 0;
    target = 0;
    checkInitialSelection();
  }

  function userChooseToBat() {
    startGame('user_team');
  }

  function userChooseToBowl() {
    if (!matchTeam1 || !matchTeam2) return;
    const aiTeamId = matchTeam1.id === 'user_team' ? matchTeam2.id : matchTeam1.id;
    startGame(aiTeamId);
  }
  
  function startPlay() {
    phase = 'paused';
    if (ballInterval) clearInterval(ballInterval);
  }
  
  function startSecondInnings() {
    currentInnings = 2;
    currentBowlerIndex = 0;
    if (ballInterval) clearInterval(ballInterval);
    checkInitialSelection();
  }
  
  function togglePause() {
    if (phase === 'playing') {
      phase = 'paused';
      autoResume = false;
      simulationTarget = null;
      if (ballInterval) clearInterval(ballInterval);
    }
  }
  
  function handleSpeedChange(speed: SimSpeed) {
    gameSpeed = speed;
  }
  


  function getTeamName(teamId: string) {
    return teamId === matchTeam1?.id ? matchTeam1?.name : matchTeam2?.name;
  }
  
  function finishMatch() {
    isComplete = true;
    phase = 'complete';
    if (ballInterval) clearInterval(ballInterval);
    
    if (currentMatch && matchTeam1 && matchTeam2) {
      const t1Won = innings1.totalRuns > innings2.totalRuns;
      const t2Won = innings2.totalRuns > innings1.totalRuns;

      if (t1Won) {
        teamStore.addWin(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
        teamStore.addLoss(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
      } else if (t2Won) {
        teamStore.addWin(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
        teamStore.addLoss(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
      }

      const winnerId = t1Won ? innings1.teamId : t2Won ? innings2.teamId : 'draw';
      const score1 = currentMatch.team1Id === innings1.teamId ? innings1.totalRuns : innings2.totalRuns;
      const score2 = currentMatch.team2Id === innings2.teamId ? innings2.totalRuns : innings1.totalRuns;
      
      scheduleStore.updateMatchResult(currentMatch.id, winnerId, score1, score2);

      const result = resolveMatch(matchTeam1, matchTeam2, innings1, innings2, currentMatch.team1Id);
      matchResultObj = result;
      
      // Apply Earnings
      const totalEarningsTeam1 = result.sponsorshipEarnings.team1 + result.matchEarnings.team1;
      const totalEarningsTeam2 = result.sponsorshipEarnings.team2 + result.matchEarnings.team2;
      
      if (totalEarningsTeam1 > 0) teamStore.updateBudget(matchTeam1.id, totalEarningsTeam1);
      if (totalEarningsTeam2 > 0) teamStore.updateBudget(matchTeam2.id, totalEarningsTeam2);
      if (result.operatingEarnings.team1 > 0) teamStore.updateOperatingBudget(matchTeam1.id, result.operatingEarnings.team1);
      if (result.operatingEarnings.team2 > 0) teamStore.updateOperatingBudget(matchTeam2.id, result.operatingEarnings.team2);
      
      if (result.playerOfTheMatch && result.potmReward > 0) {
          teamStore.updateBudget(result.playerOfTheMatch.teamId, result.potmReward);
      }
    }
  }

  function clearAnimation() {
    showImpactAnimation = false;
    impactAnimationType = null;
    if (animationTimeout) clearTimeout(animationTimeout);
    animationTimeout = null;
  }
  
  function executeSingleBall() {
    if (isComplete || !currentBattingTeam || !currentBowlingTeam) {
      phase = 'paused';
      return true;
    }
    
    clearAnimation(); // Clear any previous animation
  
    const currentInn = currentInnings === 1 ? innings1 : innings2;
    const strikerId = currentInn.currentBatsmen[0];
    const striker = currentBattingTeam.players.find(p => p.id === strikerId);
    
    const bowlers = getBowlers(currentBowlingTeam);
    if (!bowlers || bowlers.length === 0) {
      phase = 'paused';
      return true;
    }
    
    const aiBowlerId = [...currentBowlingTeam.players].filter(p => bowlers.includes(p.id)).sort((a,b) => b.stats.bowling - a.stats.bowling)[currentBowlerIndex % Math.min(5, bowlers.length)]?.id || bowlers[currentBowlerIndex % bowlers.length];
    
    const bowlerId = (currentBowlingTeam.id === 'user_team' && selectedBowlerId) 
        ? selectedBowlerId 
        : aiBowlerId;
        
    const bowler = currentBowlingTeam.players.find(p => p.id === bowlerId);
    
    if (!striker || !bowler) {
      console.error('Match error: Missing striker or bowler.', { strikerId, bowlerId });
      if (!striker) {
          if (currentInnings === 1) {
              currentInnings = 2;
              target = currentInn.totalRuns + 1;
              currentBowlerIndex = 0;
              phase = 'inningBreak';
              if (ballInterval) clearInterval(ballInterval);
          } else {
              finishMatch();
          }
      } else {
          phase = 'paused';
      }
      return true;
    }
    
    if (currentBattingTeam.id !== 'user_team' && currentBattingTeam.tendency) {
      const reqRR = target > 0 ? (target - currentInn.totalRuns) / ((totalOvers * 6 - currentInn.balls) / 6 || 1) : 0;
      currentActiveBattingIntent = getAIIntent(currentBattingTeam.tendency, currentInn.overs, totalOvers, reqRR, totalOvers * 6 - currentInn.balls);
    }
    if (currentBowlingTeam.id !== 'user_team' && currentBowlingTeam.tendency) {
      const reqRR = target > 0 ? (target - currentInn.totalRuns) / ((totalOvers * 6 - currentInn.balls) / 6 || 1) : 0;
      currentActiveBowlingIntent = getAIIntent(currentBowlingTeam.tendency, currentInn.overs, totalOvers, reqRR, totalOvers * 6 - currentInn.balls);
    }

    const bowlingFieldingAvg = currentBowlingTeam.players.filter(p => getPlaying11(currentBowlingTeam).includes(p.id)).reduce((sum, p) => sum + (p.stats.fielding || 60), 0) / 11;

    if (!currentInn.batsmanConcentration) currentInn.batsmanConcentration = {};
    if (currentInn.batsmanConcentration[strikerId] === undefined) currentInn.batsmanConcentration[strikerId] = 0;
    let conc = currentInn.batsmanConcentration[strikerId];
    let concMult = 1.0 + (conc / 100) * 0.15;

    if (!currentInn.bowlerRhythm) currentInn.bowlerRhythm = {};
    if (currentInn.bowlerRhythm[bowlerId] === undefined) currentInn.bowlerRhythm[bowlerId] = 0;
    let rhythm = currentInn.bowlerRhythm[bowlerId];
    let rhythmMult = 1.0 + (rhythm / 100) * 0.15;

    const ballEvent = resolveBall(striker, bowler, currentInn.balls, totalOvers, currentActiveBattingIntent, weather as any, pitch as any, 0, false, currentActiveBowlingIntent, avoidSingles, bowlingFieldingAvg, currentBallType, concMult, rhythmMult);

    if (ballEvent.result === 'dot') {
       conc = Math.max(0, conc - 5);
       rhythm = Math.min(100, rhythm + 5);
    } else if (ballEvent.runs === 4 || ballEvent.runs === 6) {
       conc = Math.min(100, conc + 15);
       rhythm = Math.max(0, rhythm - 10);
    } else if (ballEvent.runs > 0) {
       conc = Math.min(100, conc + 5);
    }
    if (ballEvent.result === 'wide' || ballEvent.result === 'noball') {
       rhythm = Math.max(0, rhythm - 5);
    }
    if (ballEvent.isWicket) {
       rhythm = Math.min(100, rhythm + 25);
    }

    currentInn.batsmanConcentration[strikerId] = conc;
    currentInn.bowlerRhythm[bowlerId] = rhythm;
    
    // Trigger impact animations
    if (ballEvent.isWicket) {
      showImpactAnimation = true;
      impactAnimationType = 'wicket';
      animationTimeout = setTimeout(clearAnimation, 1500); // Show for 1.5 seconds
    } else if (ballEvent.runs === 4) {
      showImpactAnimation = true;
      impactAnimationType = 'four';
      animationTimeout = setTimeout(clearAnimation, 1000); // Show for 1 second
    } else if (ballEvent.runs === 6) {
      showImpactAnimation = true;
      impactAnimationType = 'six';
      animationTimeout = setTimeout(clearAnimation, 1000); // Show for 1 second
    }
    
    striker.fatigue += 0.3;
    
    let nextWickets = currentInn.wickets;
    let nextBatsmen = [...currentInn.currentBatsmen] as [string, string];
    let needsBatsman = false;
    let needsBowler = false;

    if (ballEvent.isWicket) {
        nextWickets += 1;
        needsBatsman = (currentBattingTeam.id === 'user_team') && nextWickets < 10;
        const nextBatterId = currentInn.battingOrder[nextWickets + 1];
        placeholderBatsman = nextBatterId || '';
        nextBatsmen = [nextBatterId || '', currentInn.currentBatsmen[1]] as [string, string];
    } else if (ballEvent.runs % 2 === 1) {
        nextBatsmen = [currentInn.currentBatsmen[1], currentInn.currentBatsmen[0]] as [string, string];
    }

    let nextBalls = currentInn.balls;
    if (ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
        nextBalls += 1;
    }
    let nextOvers = currentInn.overs;
    
    if (nextBalls > currentInn.balls && nextBalls > 0 && nextBalls % 6 === 0) {
        nextOvers += 1;
        nextBatsmen = [nextBatsmen[1], nextBatsmen[0]] as [string, string];
        needsBowler = (currentBowlingTeam.id === 'user_team') && nextOvers < totalOvers && nextWickets < 10;
        currentBowlerIndex++;
        selectedBowlerId = null;
    }

    const updatedInn = {
        ...currentInn,
        totalRuns: currentInn.totalRuns + ballEvent.runs,
        balls: nextBalls,
        overs: nextOvers,
        wickets: nextWickets,
        currentBatsmen: nextBatsmen,
        ballsFaced: [...currentInn.ballsFaced, ballEvent]
    };

    if (currentInnings === 1) innings1 = updatedInn;
    else innings2 = updatedInn;

    if (currentInnings === 1 && (nextOvers >= totalOvers || nextWickets >= 10 || nextWickets >= currentInn.battingOrder.length - 1)) {
        currentInnings = 2;
        target = updatedInn.totalRuns + 1;
        currentBowlerIndex = 0;
        phase = 'inningBreak';
        if (ballInterval) clearInterval(ballInterval);
        return true;
    } else if (currentInnings === 2 && (updatedInn.totalRuns >= target || nextOvers >= totalOvers || nextWickets >= 10 || nextWickets >= currentInn.battingOrder.length - 1)) {
        finishMatch();
        return true;
    }

    if (needsBatsman) {
        phase = 'selectNextBatsman';
        if (ballInterval) clearInterval(ballInterval);
        if (pendingBowlerSelection) pendingBowlerSelection = false; // Clear pending if batsman selected first
        return true;
    } else if (needsBowler) {
        phase = 'selectNextBowler';
        if (ballInterval) clearInterval(ballInterval);
        return true;
    }
    
    return false;
  }

  function handleSimulateTarget(target: SimTarget) {
      if (phase !== 'paused' && phase !== 'playing' && phase !== 'ready') return;
      simulationTarget = target;
      phase = 'playing';
      autoResume = true;
      if (ballInterval) clearInterval(ballInterval);
      ballInterval = setTimeout(playTargetedLoop, 50);
  }

  function playTargetedLoop() {
    if (phase !== 'playing' || isComplete) return;

    const currentInn = currentInnings === 1 ? innings1 : innings2;
    const initialBalls = currentInn.balls;

    const phaseChanged = executeSingleBall();
    syncActiveMatchState();

    if (isComplete) {
        simulationTarget = null;
        autoResume = false;
        return;
    }

    const newInn = currentInnings === 1 ? innings1 : innings2;
    const lastBallEvent = newInn.ballsFaced[newInn.ballsFaced.length - 1];

    let targetMet = false;
    if (simulationTarget) {
        if (simulationTarget.type === 'wicket' && lastBallEvent?.isWicket) targetMet = true;
        if (simulationTarget.type === 'over' && newInn.balls % 6 === 0 && newInn.balls > initialBalls) targetMet = true;
        if (simulationTarget.type === 'specific_over' && newInn.overs >= (simulationTarget.value || 20)) targetMet = true;
    }

    if (targetMet) {
        simulationTarget = null;
        autoResume = false;
    }

    if (phaseChanged || phase !== 'playing') {
        if ((phase as string) === 'inningBreak') {
            simulationTarget = null;
            autoResume = false;
        }
        return;
    }

    if (targetMet) {
        phase = 'paused';
        return;
    }

    let delay = autoPlayDelay;
    if (gameSpeed === 'instant') {
       delay = 10; 
    }

    ballInterval = setTimeout(playTargetedLoop, delay);
  }

  function playSingleBallAction() {
    if (phase === 'playing') return;
    executeSingleBall();
    syncActiveMatchState();
  }

  function playSingleOverAction() {
    if (phase === 'playing') return;
    for (let i = 0; i < 6; i++) {
      if (isComplete) break;
      const phaseChanged = executeSingleBall();
      if (phaseChanged) break;
    }
  }

  function getAvailableBatsmen() {
    const inn = currentInnings === 1 ? innings1 : innings2;
    const team = currentBattingTeam;
    if (!team) return [];
    
    const getRoleWeight = (role: string) => {
        if (role === 'batsman') return 3;
        if (role === 'wk' || role === 'wicketkeeper') return 2;
        if (role === 'allrounder') return 1;
        return 0;
    };

    let available = [];
    if (phase === 'selectOpeningBatsmen') {
        available = team.players.filter(p => inn.battingOrder.includes(p.id));
    } else {
        const outPlayers = new Set(inn.ballsFaced.filter(b => b.isWicket).map(b => b.batsmanId));
        const nonStriker = inn.currentBatsmen[0] === placeholderBatsman ? inn.currentBatsmen[1] : inn.currentBatsmen[0];
        available = team.players.filter(p => inn.battingOrder.includes(p.id) && !outPlayers.has(p.id) && p.id !== nonStriker);
    }
    
    return available.sort((a,b) => {
        const weightA = getRoleWeight(a.role);
        const weightB = getRoleWeight(b.role);
        if (weightA !== weightB) return weightB - weightA;
        return b.stats.batting - a.stats.batting;
    });
  }

  function toggleBatsman(id: string) {
    if (phase === 'selectNextBatsman') {
        confirmNextBatsman(id);
        return;
    }
    if (selectedBatsmen.includes(id)) {
        selectedBatsmen = selectedBatsmen.filter(x => x !== id);
    } else if (selectedBatsmen.length < 2) {
        selectedBatsmen = [...selectedBatsmen, id];
    }
  }

  function confirmOpeningBatsmen() {
    const inn = currentInnings === 1 ? innings1 : innings2;
    const order = inn.battingOrder;
    const newOrder = [selectedBatsmen[0], selectedBatsmen[1], ...order.filter(x => !selectedBatsmen.includes(x))];
    if (currentInnings === 1) {
        innings1.battingOrder = newOrder;
        innings1.currentBatsmen = [newOrder[0], newOrder[1]] as [string, string];
    } else {
        innings2.battingOrder = newOrder;
        innings2.currentBatsmen = [newOrder[0], newOrder[1]] as [string, string];
    }
    
    const isUserBowling = currentBowlingTeam?.id === 'user_team';
    if (isUserBowling) {
        phase = 'selectOpeningBowler';
        selectedBowlerId = null;
    } else {
        phase = 'ready';
    }
  }

  function confirmNextBatsman(id: string) {
    const inn = currentInnings === 1 ? innings1 : innings2;
    const order = inn.battingOrder.filter(x => x !== id);
    order.splice(inn.wickets + 1, 0, id);
    
    const newInn = { ...inn, battingOrder: order };
    
    newInn.currentBatsmen = inn.currentBatsmen.map(b => b === placeholderBatsman ? id : b) as [string, string];
    
    if (currentInnings === 1) innings1 = newInn;
    else innings2 = newInn;
    
    if (pendingBowlerSelection) {
        pendingBowlerSelection = false;
        phase = 'selectNextBowler';
    } else {
        if (autoResume && simulationTarget) {
            phase = 'playing';
            ballInterval = setTimeout(playTargetedLoop, 50);
        } else {
            phase = 'paused';
        }
    }
  }

  function getAvailableBowlers() {
    const inn = currentInnings === 1 ? innings1 : innings2;
    const team = currentBowlingTeam;
    if (!team) return [];
    
    const p11 = getPlaying11(team);
    
    let lastBowler = null;
    const legalBalls = inn.ballsFaced.filter(b => b.result !== 'wide' && b.result !== 'noball');
    if (legalBalls.length > 0 && legalBalls.length % 6 === 0) {
       lastBowler = inn.ballsFaced[inn.ballsFaced.length - 1].bowlerId;
    }
    
    const bowlerOvers: Record<string, number> = {};
    for (const b of inn.ballsFaced) {
        if (b.result !== 'wide' && b.result !== 'noball') {
            bowlerOvers[b.bowlerId] = (bowlerOvers[b.bowlerId] || 0) + 1;
        }
    }
    
    const getRoleWeight = (role: string) => {
        if (role === 'bowler') return 2;
        if (role === 'allrounder') return 1;
        return 0;
    };

    return team.players.filter(p => {
        if (!p11.includes(p.id)) return false;
        if (p.id === lastBowler) return false;
        const balls = bowlerOvers[p.id] || 0;
        if (Math.floor(balls / 6) >= 4) return false;
        return true;
    }).sort((a,b) => {
        const weightA = getRoleWeight(a.role);
        const weightB = getRoleWeight(b.role);
        if (weightA !== weightB) return weightB - weightA;
        return b.stats.bowling - a.stats.bowling;
    });
  }

  function confirmBowler(id: string) {
    selectedBowlerId = id;
    if (phase === 'selectOpeningBowler') {
        phase = 'ready';
    } else {
        if (autoResume && simulationTarget) {
            phase = 'playing';
            ballInterval = setTimeout(playTargetedLoop, 50);
        } else {
            phase = 'paused';
        }
    }
  }

  function handleGoHome() {
      goto('/');
  }

  function getBatsmanStats(playerId: string) {
    const inn = currentInnings === 1 ? innings1 : innings2;
    const balls = inn.ballsFaced.filter(b => b.batsmanId === playerId);
    const legalBalls = balls.filter(b => b.result !== 'wide');
    const runs = balls.reduce((sum, b) => sum + (b.result !== 'wide' ? b.runs : 0), 0);
    const isOut = balls.some(b => b.isWicket);
    const outEvent = balls.find(b => b.isWicket);
    const isBatting = inn.currentBatsmen.includes(playerId);
    return { runs, balls: legalBalls.length, isOut, outType: outEvent?.wicketType, isBatting };
  }

  function getBowlerStats(playerId: string) {
    const inn = currentInnings === 1 ? innings1 : innings2;
    const balls = inn.ballsFaced.filter(b => b.bowlerId === playerId);
    const legalBalls = balls.filter(b => b.result !== 'wide' && b.result !== 'noball');
    const oversBowled = Math.floor(legalBalls.length / 6);
    const ballsBowled = legalBalls.length % 6;
    const runs = balls.reduce((sum, b) => sum + b.runs, 0);
    const wickets = balls.filter(b => b.isWicket && b.wicketType !== 'run out').length;
    return { overs: `${oversBowled}.${ballsBowled}`, runs, wickets, oversBowled };
  }

  function getCurrentLiveBowler() {
     const inn = currentInnings === 1 ? innings1 : innings2;
     if (inn.ballsFaced.length === 0) return null;
     const lastBall = inn.ballsFaced[inn.ballsFaced.length - 1];
     const legalBalls = inn.ballsFaced.filter(b => b.result !== 'wide' && b.result !== 'noball');
     if (legalBalls.length > 0 && legalBalls.length % 6 === 0 && phase !== 'playing' && phase !== 'paused' && phase !== 'complete') {
        return null;
     }
     return lastBall.bowlerId;
  }
  
  let currentLiveBowlerId = $derived(getCurrentLiveBowler());


  let batsmanIntents = $state<Record<string, IntentType>>({});
  let bowlerIntents = $state<Record<string, IntentType>>({});
  
  const INTENT_LEVELS: IntentType[] = ['defensive', 'balanced', 'aggressive', 'very_aggressive'];
  const INTENT_LABELS = {
      'defensive': 'Defensive',
      'balanced': 'Neutral',
      'aggressive': 'Aggressive',
      'very_aggressive': 'Ultra Aggressive'
  };

  function getIntentIndex(intent: IntentType) {
      return INTENT_LEVELS.indexOf(intent) !== -1 ? INTENT_LEVELS.indexOf(intent) : 1;
  }

  function changeBatsmanIntent(id: string, delta: number) {
      const current = getIntentIndex(batsmanIntents[id] || 'balanced');
      const nextIndex = Math.max(0, Math.min(INTENT_LEVELS.length - 1, current + delta));
      batsmanIntents[id] = INTENT_LEVELS[nextIndex];
  }

  function changeBowlerIntent(id: string, delta: number) {
      const current = getIntentIndex(bowlerIntents[id] || 'balanced');
      const nextIndex = Math.max(0, Math.min(INTENT_LEVELS.length - 1, current + delta));
      bowlerIntents[id] = INTENT_LEVELS[nextIndex];
  }
  
  let currentActiveBattingIntent = $derived(currentInningsData.currentBatsmen[0] ? (batsmanIntents[currentInningsData.currentBatsmen[0]] || 'balanced') : 'balanced');
  let currentActiveBowlingIntent = $derived(currentLiveBowlerId ? (bowlerIntents[currentLiveBowlerId] || 'balanced') : 'balanced');

</script>

<svelte:head><title>Match - Fantasy Cricket</title></svelte:head>

<div class="match-page-wrapper">
  {#if showImpactAnimation}
    <div class="impact-animation-overlay {impactAnimationType}">
      {#if impactAnimationType === 'wicket'}
        <div class="impact-graphic">OUT!</div>
        <div class="impact-subtext">WICKET!</div>
      {:else if impactAnimationType === 'four'}
        <div class="impact-graphic">4</div>
        <div class="impact-subtext">FOUR!</div>
      {:else if impactAnimationType === 'six'}
        <div class="impact-graphic">6</div>
        <div class="impact-subtext">SIX!</div>
      {/if}
    </div>
  {/if}

  {#if noMatchAvailable}
    <div class="full-screen-message">
      <div class="message-card">
        <h2>No Match Scheduled Today</h2>
        <p>Check the tournament schedule for your next match. Make sure you play matches on the scheduled day.</p>
        <button class="btn-primary" onclick={handleGoHome}>Back to Dashboard</button>
      </div>
    </div>
  {:else if phase === 'loading'}
    <div class="full-screen-message"><div class="spinner"></div><h2>Loading Match...</h2></div>
  {:else if phase === 'invalidSquad'}
    <div class="full-screen-message">
      <div class="message-card error">
        <h2>Incomplete Squad</h2>
        <p>You must select exactly 11 players, a captain, and a wicketkeeper before you can play a match.</p>
        <a href="/squad" class="btn-primary">Go to Squad Management</a>
      </div>
    </div>
  {:else if phase === 'toss'}
    <div class="full-screen-message">
      <div class="toss-card" style="border-top: 4px solid {matchTeam1?.colorPrimary}; background: linear-gradient(135deg, {matchTeam1?.colorPrimary}10, {matchTeam2?.colorPrimary}10, var(--bg-surface));">
        <div class="toss-header" style="color: {matchTeam1?.colorPrimary};">🪙 Matchday Toss</div>
        <div class="toss-teams">
          <span style="color: {matchTeam1?.colorPrimary};">{matchTeam1?.name}</span>
          <span class="vs">vs</span>
          <span style="color: {matchTeam2?.colorPrimary};">{matchTeam2?.name}</span>
        </div>
        
        <div class="conditions-panel">
          <div class="condition">
            <span class="emoji">{weatherEmojis[weather]}</span>
            <div class="details">
              <span class="value">{weather}</span>
              <span class="label">{weather === 'sunny' ? 'Clear skies' : weather === 'rain' ? 'DLS active' : 'Swing conditions'}</span>
            </div>
          </div>
          <div class="divider"></div>
          <div class="condition">
            <span class="emoji">{pitchEmojis[pitch]}</span>
            <div class="details">
              <span class="value">{pitch}</span>
              <span class="label">{pitch === 'flat' ? 'Batsman paradise' : pitch === 'turning' ? 'Spin friendly' : 'Pace friendly'}</span>
            </div>
          </div>
        </div>
        
        {#if !tossWinner}
          <div class="toss-actions">
            <button class="btn-primary large" onclick={performToss} disabled={isTossing}>
              {isTossing ? '🪙 Flipping Coin...' : '🪙 Flip Coin'}
            </button>
          </div>
        {:else if tossWinner === 'user_team'}
          <p class="toss-prompt">You Won The Toss! Choose to:</p>
          <div class="toss-actions">
            <button class="btn-bat" onclick={userChooseToBat}>🏏 Bat First</button>
            <button class="btn-bowl" onclick={userChooseToBowl}>🎯 Bowl First</button>
          </div>
        {:else}
          <p class="toss-prompt">{matchTeam1?.id === tossWinner ? matchTeam1?.name : matchTeam2?.name} Won The Toss!</p>
          {#if tossChoice}
            <div class="toss-actions" style="margin-top: 16px;">
              <p class="toss-prompt" style="font-weight: 700; color: var(--color-accent);">
                They chose to {tossChoice === 'bat' ? '🏏 Bat' : '🎯 Bowl'} first.
              </p>
            </div>
          {:else}
            <p class="toss-prompt" style="color: var(--text-muted); font-size: 0.9rem;">Making decision...</p>
          {/if}
        {/if}
      </div>
    </div>
  {:else}
    <!-- Main Vertical Match Layout -->
    <div class="match-dashboard">
    <div class="main-content">
      <div class="match-layout-vertical">
      
      <!-- TOP PANE: Batting Team Controls -->
      <div class="top-section">
        <div class="teams-matchup-header" style="text-align: center; margin-bottom: 16px;">
          <h2 style="margin: 0; font-family: 'Cinzel', serif; font-size: 1.5rem;">
            <span style="color: {currentBattingTeam?.colorPrimary}">{currentBattingTeam?.name}</span>
            <span style="color: var(--text-muted); font-size: 1rem; margin: 0 12px;">VS</span>
            <span style="color: {currentBowlingTeam?.colorPrimary}">{currentBowlingTeam?.name}</span>
          </h2>
        </div>
        {#if currentBattingTeam?.id === 'user_team' && (phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman')}
          <!-- selection UI reused from before -->
          <div class="selection-container batting-selection">
             <div class="selection-prompt">{phase === 'selectOpeningBatsmen' ? 'Pick 2 Openers' : 'Pick Next Batsman'}</div>
             <div class="selection-list horizontal-list">
                {#each getAvailableBatsmen() as p}
                   {@const isSelected = selectedBatsmen.includes(p.id)}
                   <button class="player-select-btn mini" class:selected={isSelected} onclick={() => toggleBatsman(p.id)}>
                       <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" />
                       <div class="mini-info">
                          <span class="name">{p.name}</span>
                          <span class="stat-badge">Bat: {p.stats.batting}</span>
                       </div>
                   </button>
                 {/each}
             </div>
             {#if phase === 'selectOpeningBatsmen'}
               <button class="btn-confirm" disabled={selectedBatsmen.length !== 2} onclick={confirmOpeningBatsmen}>Confirm Openers</button>
             {/if}
          </div>
        {:else}
          <div class="active-batsmen-row">
             {#each currentInningsData.currentBatsmen.filter(id => id) as batsmanId, i}
               {@const p = currentBattingTeam?.players.find(x => x.id === batsmanId)}
               {@const stats = getBatsmanStats(batsmanId)}
               {@const intent = batsmanIntents[batsmanId] || 'balanced'}
               {#if p}
                 <div class="batsman-card intent-{intent} {i === 0 ? 'on-strike' : ''}">
                    <div class="b-avatar-col">
                      <div class="avatar-ring">
                        <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                      </div>
                      <div class="faction-badge-mini left-badge faction-{p.faction}">
                          {p.faction === 'human' ? '⚔' : p.faction === 'elf' ? '🌿' : p.faction === 'orc' ? '🪓' : p.faction === 'dwarf' ? '⛏' : p.faction === 'goblin' ? '💎' : '🌙'}
                      </div>
                      <div class="skill-badge {p.stats.batting >= 70 ? 'high' : p.stats.batting >= 40 ? 'med' : 'low'}">{p.stats.batting}</div>
                    </div>
                    <div class="b-info-col">
                       <div class="b-name">{p.name} {#if i === 0}<span class="striker-icon" title="On Strike">🏏</span>{/if}</div>
                       <div class="b-style">{p.battingType || 'RHB'}</div>
                       <div class="b-score">{stats.runs} <span class="b-balls">({stats.balls})</span></div>
                       <div class="b-form-bar-container"><div class="b-form-bar" style="width: {p.morale}%"></div></div>
                    </div>
                    <div class="b-aggression-col">
                       <button class="btn-agg" onclick={() => changeBatsmanIntent(batsmanId, 1)} disabled={!currentBattingTeam?.isUserTeam}>+</button>
                       <div class="agg-slider-track vertical">
                           <div class="agg-slider-fill intent-{intent}" style="height: {(getIntentIndex(intent) / 3) * 100}%"></div>
                       </div>
                       <button class="btn-agg" onclick={() => changeBatsmanIntent(batsmanId, -1)} disabled={!currentBattingTeam?.isUserTeam}>-</button>
                       <div class="agg-label">{INTENT_LABELS[intent]}</div>
                    </div>
                 </div>
               {/if}
             {/each}
          </div>
        {/if}
      </div>
      
      <!-- CENTER PANE: Match Context -->
      <div class="center-section">
        {#if phase === 'ready'}
          <div class="action-panel centered">
            <h2 class="ready-title">Match Ready</h2>
            <button class="btn-start" onclick={startPlay}>▶ Start Match</button>
          </div>
        {:else if phase === 'inningBreak'}
          <div class="action-panel centered">
            <h2 class="break-title">Innings Break</h2>
            <p class="target-text">Target for {matchTeam1?.id === innings2.teamId ? matchTeam1?.name : matchTeam2?.name} is <strong>{target}</strong> runs.</p>
            <button class="btn-start" onclick={startSecondInnings}>▶ Start 2nd Innings</button>
          </div>
        {:else if phase === 'complete'}
          <div class="action-panel centered">
            <h3 class="win-title">{innings2.totalRuns >= target ? getTeamName(innings2.teamId) : getTeamName(innings1.teamId)} Wins!</h3>
            <p class="final-score">{innings1.totalRuns}/{innings1.wickets} <span class="vs">vs</span> {innings2.totalRuns}/{innings2.wickets}</p>
            <button class="btn-primary" onclick={handleGoHome}>Continue to Dashboard</button>
          </div>
        {:else if phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman' || phase === 'selectOpeningBowler' || phase === 'selectNextBowler'}
          <div class="action-panel centered">
            <h3 style="color: var(--color-accent);">Waiting for Selection...</h3>
          </div>
        {:else}
          <div class="scoreboard-main animated-score">
             
             <div class="score-display">
                <div class="main-score">
                  <span class="runs-val">{currentInningsData.totalRuns}</span>/<span class="wickets-val">{currentInningsData.wickets}</span>
                  <span class="overs-val">({currentInningsData.overs}.{currentInningsData.balls % 6})</span>
                </div>
                <div class="rates">
                    <span class="crr">CRR: {runRate}</span>
                    {#if currentInnings === 2 && target}
                       <span class="req">Target: {target}</span>
                    {/if}
                </div>
                {#if currentInnings === 2 && target}
                   <div class="chase-equation">Need {target - currentInningsData.totalRuns} from {120 - currentInningsData.balls} balls</div>
                {/if}
             </div>
             
             <div class="play-controls-row">
                 <button class="btn-play-pause" onclick={togglePause}>
                    {phase === 'paused' ? '▶ Play' : '⏸ Pause'}
                 </button>
                 <select class="speed-select" bind:value={gameSpeed}>
                    <option value="ball">Normal Speed</option>
                    <option value="fast">Fast</option>
                    <option value="instant">Instant</option>
                 </select>
                 <button class="btn-action" onclick={playSingleBallAction} disabled={phase !== 'paused'}>Play 1 Ball</button>
             </div>
             
             <!-- Recent Balls -->
             <div class="recent-balls-mini">
                 {#each currentInningsData.ballsFaced.slice(-6) as ball}
                    <div class="bubble {ball.isWicket ? 'wicket' : ball.runs === 4 ? 'four' : ball.runs === 6 ? 'six' : ball.runs === 0 ? 'dot' : ball.runs === 1 || ball.runs === 2 || ball.runs === 3 ? 'runs' : ''}">
                       {ball.isWicket ? 'W' : ball.runs}
                    </div>
                 {/each}
             </div>
          </div>
        {/if}
      </div>

      <!-- BOTTOM PANE: Bowling Controls -->
      <div class="bottom-section">
        {#if currentBowlingTeam?.id === 'user_team' && (phase === 'selectOpeningBowler' || phase === 'selectNextBowler')}
           <div class="selection-container bowling-selection">
              <div class="selection-prompt">Select Bowler</div>
              <div class="selection-list horizontal-list">
                 {#each getAvailableBowlers() as p}
                     <button class="player-select-btn mini" onclick={() => confirmBowler(p.id)}>
                         <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" />
                         <div class="mini-info">
                            <span class="name">{p.name}</span>
                            <span class="stat-badge">Bowl: {p.stats.bowling}</span>
                         </div>
                     </button>
                  {/each}
              </div>
           </div>
        {:else}
              {@const bowlerId = currentLiveBowlerId}
              {@const p = currentBowlingTeam?.players.find(x => x.id === bowlerId)}
              {@const stats = p ? getBowlerStats(p.id) : null}
              {@const intent = bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}
           <div class="active-bowler-row">
              
              {#if p && stats}
                <div class="bowler-card intent-{intent}">
                   <div class="bw-avatar-col pulse-anim-{Math.floor(p.morale / 20)}">
                     <div class="avatar-ring">
                       <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                     </div>
                     <div class="faction-badge-mini left-badge faction-{p.faction}">
                         {p.faction === 'human' ? '⚔' : p.faction === 'elf' ? '🌿' : p.faction === 'orc' ? '🪓' : p.faction === 'dwarf' ? '⛏' : p.faction === 'goblin' ? '💎' : '🌙'}
                     </div>
                     <div class="skill-badge {p.stats.bowling >= 70 ? 'high' : p.stats.bowling >= 40 ? 'med' : 'low'}">{p.stats.bowling}</div>
                   </div>
                   <div class="bw-info-col">
                      <div class="bw-name">{p.name}</div>
                      <div class="bw-style">{p.bowlingType || 'Fast'}</div>
                      <div class="bw-stats">{stats.wickets}-{stats.runs} ({stats.overs})</div>
                      
                      <div class="bw-meters">
                          <div class="meter-row">
                              <span class="meter-label">Stamina</span>
                              <div class="b-meter-container"><div class="b-meter-fill stamina" style="width: {100 - p.fatigue}%"></div></div>
                          </div>
                          <div class="meter-row">
                              <span class="meter-label">Confidence</span>
                              <div class="b-meter-container"><div class="b-meter-fill confidence" style="width: {p.morale}%"></div></div>
                          </div>
                      </div>
                   </div>
                   <div class="bw-aggression-col horizontal">
                      <div class="agg-label">{INTENT_LABELS[intent]}</div>
                      <button class="btn-agg" onclick={() => changeBowlerIntent(p.id, -1)} disabled={!currentBowlingTeam?.isUserTeam}>-</button>
                      <div class="agg-slider-track horizontal-track">
                          <div class="agg-slider-fill intent-{intent}" style="width: {(getIntentIndex(intent) / 3) * 100}%"></div>
                      </div>
                      <button class="btn-agg" onclick={() => changeBowlerIntent(p.id, 1)} disabled={!currentBowlingTeam?.isUserTeam}>+</button>
                   </div>
                </div>
              {/if}
           </div>
        {/if}
      </div>    </div>
      
      

      
    </div>
    
    <div class="side-content">
      <div class="commentary-panel">
         <div class="commentary-header">
           <span>Live Commentary</span>
         </div>
         <div class="commentary-content">
            <BallFeed events={currentInningsData.ballsFaced} />
         </div>
      </div>
    </div>
  </div>

  <div class="full-width-scorecard-container">
    <FullScorecard 
                   innings1={innings1}
                   innings2={innings2}
                   team1={matchTeam1}
                   team2={matchTeam2}
                   currentInnings={currentInnings}
         />
  </div>
  
  
  {/if}
  {#if currentSuggestion}
    <div class="floating-suggestion" class:expanded={showSuggestion}>
      <button class="suggestion-toggle" onclick={() => showSuggestion = !showSuggestion} title="Assistant Suggestion">
        💡
      </button>
      {#if showSuggestion}
        <div class="suggestion-content">
          <h4>Assistant Tip</h4>
          <p>{currentSuggestion}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>

  .match-dashboard {
    display: grid;
    grid-template-columns: 7fr 5fr; /* 10/12 for main, 2/12 for side */
    gap: 16px;
    height: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  
  @media (max-width: 1200px) {
    .match-dashboard {
      grid-template-columns: 7fr 5fr;
    }
  }
  
  @media (max-width: 900px) {
    .match-dashboard {
      grid-template-columns: 1fr;
    }
  }

  .main-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .side-content {
    display: flex;
    flex-direction: column;
  }
  
  .commentary-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    min-height: 400px;
  }

  .commentary-header {
    background: rgba(0,0,0,0.1);
    padding: 12px 16px;
    font-weight: bold;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .commentary-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }
  
  .bottom-bar {
    display: flex;
    justify-content: center;
    padding: 16px;
    background: var(--bg-surface);
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }
  
  .btn-drawer-toggle {
    background: linear-gradient(135deg, var(--color-batting), var(--color-batting-dark));
    color: white;
    border: none;
    padding: 12px 24px;
    font-size: 1.1rem;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-drawer-toggle:hover {
    opacity: 0.9;
  }


  /* New Vertical Layout Styles */
  .match-layout-vertical {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
  }
  
  .top-section, .bottom-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .center-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
  }

  .active-batsmen-row {
    display: flex;
    justify-content: center;
    gap: 24px;
    width: 100%;
  }

  .batsman-card, .bowler-card {
    display: flex;
    background: var(--bg-surface);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 12px;
    gap: 16px;
    min-width: 300px;
    align-items: center;
    transition: box-shadow 0.3s ease, border-color 0.3s ease;
  }
  
  .batsman-card.intent-defensive { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59,130,246,0.3); }
  .batsman-card.intent-balanced { border-color: #fbbf24; box-shadow: 0 0 15px rgba(251,191,36,0.3); }
  .batsman-card.intent-aggressive { border-color: #22c55e; box-shadow: 0 0 15px rgba(34,197,94,0.3); }
  .batsman-card.intent-very_aggressive { border-color: #ef4444; box-shadow: 0 0 15px rgba(239,68,68,0.3); }
  
  .bowler-card.intent-defensive { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59,130,246,0.3); }
  .bowler-card.intent-balanced { border-color: #fbbf24; box-shadow: 0 0 15px rgba(251,191,36,0.3); }
  .bowler-card.intent-aggressive { border-color: #22c55e; box-shadow: 0 0 15px rgba(34,197,94,0.3); }
  .bowler-card.intent-very_aggressive { border-color: #ef4444; box-shadow: 0 0 15px rgba(239,68,68,0.3); }

  .b-avatar-col, .bw-avatar-col {
    position: relative;
    width: 64px;
    height: 64px;
  }

  .avatar-ring {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--text-muted);
    overflow: hidden;
  }

  .player-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .skill-badge {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
    color: white;
    border: 2px solid var(--bg-surface);
  }
  .skill-badge.high { background: #22c55e; }
  .skill-badge.med { background: #f97316; }
  .skill-badge.low { background: #ef4444; }

  .b-info-col, .bw-info-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .b-name, .bw-name { font-weight: bold; font-size: 1.1rem; color: var(--text-primary); }
  .b-style, .bw-style { font-size: 0.8rem; color: var(--text-muted); }
  .b-score { font-size: 1.2rem; font-weight: bold; color: var(--text-primary); }
  .b-balls { font-size: 0.9rem; color: var(--text-muted); font-weight: normal; }

  .b-form-bar-container, .b-meter-container {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 4px;
  }
  .b-form-bar { height: 100%; background: linear-gradient(90deg, #f59e0b, #22c55e); transition: width 0.3s ease; }
  
  .b-meter-fill.stamina { height: 100%; background: #3b82f6; transition: width 0.3s ease; }
  .b-meter-fill.confidence { height: 100%; background: #a855f7; transition: width 0.3s ease; }

  .meter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
  }
  .meter-label { width: 60px; color: var(--text-muted); }
  .b-meter-container { flex: 1; }

  .b-aggression-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .bw-aggression-col.horizontal {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .btn-agg {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  .btn-agg:hover:not(:disabled) { background: var(--color-accent); color: white; }
  .btn-agg:disabled { opacity: 0.5; cursor: not-allowed; }

  .agg-slider-track {
    background: var(--bg-tertiary);
    border-radius: 4px;
    position: relative;
    overflow: hidden;
  }
  .agg-slider-track.vertical { width: 8px; height: 60px; }
  .agg-slider-track.horizontal-track { width: 100px; height: 8px; }

  .agg-slider-fill {
    position: absolute;
    transition: all 0.3s ease;
  }
  .agg-slider-track.vertical .agg-slider-fill {
    bottom: 0;
    left: 0;
    width: 100%;
  }
  .agg-slider-track.horizontal-track .agg-slider-fill {
    top: 0;
    left: 0;
    height: 100%;
  }

  .agg-slider-fill.intent-defensive { background: #3b82f6; }
  .agg-slider-fill.intent-balanced { background: #fbbf24; }
  .agg-slider-fill.intent-aggressive { background: #22c55e; }
  .agg-slider-fill.intent-very_aggressive { background: #ef4444; }

  .agg-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: bold;
    text-align: center;
    width: max-content;
  }

  .scoreboard-main {
    background: var(--bg-surface);
    border-radius: 16px;
    padding: 16px;
    width: 100%;
    box-sizing: border-box;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .scoreboard-header {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    font-weight: bold;
    color: var(--text-muted);
  }

  .score-display {
    text-align: center;
  }

  .main-score {
    font-size: 2.2rem;
    font-weight: bold;
    font-family: 'Cinzel', serif;
    color: var(--text-primary);
    line-height: 1.1;
  }
  
  .main-score .wickets-val { color: var(--color-danger); }
  .main-score .overs-val { font-size: 1rem; color: var(--text-muted); font-family: sans-serif; }

  .rates {
    display: flex;
    gap: 12px;
    justify-content: center;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .chase-equation {
    margin-top: 4px;
    font-weight: bold;
    color: var(--warning);
    font-size: 0.95rem;
  }

  .play-controls-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }

  .btn-play-pause, .btn-action {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: var(--color-accent);
    color: white;
    font-weight: bold;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .btn-play-pause:hover, .btn-action:hover:not(:disabled) {
    opacity: 0.9;
  }
  .btn-action:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }

  .speed-select {
    padding: 6px;
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    font-size: 0.9rem;
  }

  .recent-balls-mini {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  
  .active-bowler-row {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  /* Pulse Animations */
  @keyframes pulse1 { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
  @keyframes pulse2 { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
  @keyframes pulse3 { 0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes pulse4 { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
  @keyframes pulse5 { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }

  .pulse-anim-1 { animation: pulse1 2s infinite; }
  .pulse-anim-2 { animation: pulse2 2s infinite; }
  .pulse-anim-3 { animation: pulse3 1.5s infinite; }
  .pulse-anim-4 { animation: pulse4 1.5s infinite; }
  .pulse-anim-5 { animation: pulse5 1s infinite; }
  
  /* Selection styling fix */
  .horizontal-list { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); 
    gap: 12px; 
    padding: 16px; 
    width: 100%;
    box-sizing: border-box;
  }
  .player-select-btn.mini { flex-direction: column; width: 100%; text-align: center; }
  .player-avatar-mini { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; }
  .mini-info { display: flex; flex-direction: column; gap: 4px; align-items: center; }

  /* Base Variables & Theming */
  :root {
    --color-bg-dark: var(--bg-primary);
    --color-bg-panel: var(--bg-secondary);
    --color-bg-panel-light: var(--bg-tertiary);
    --color-border: var(--border-color);
    
    --color-batting: var(--success); /* Emerald */
    --color-batting-dark: var(--accent-emerald);
    --color-batting-transparent: rgba(var(--accent-emerald-rgb), 0.15);
    
    --color-bowling: var(--info); /* Blue */
    --color-bowling-dark: var(--accent-sapphire);
    --color-bowling-transparent: rgba(var(--accent-sapphire-rgb), 0.15);
    
    --color-accent: var(--warning); /* Amber */
    --color-danger: var(--danger); /* Rose */
    
    --text-primary: var(--text-primary);
    --text-secondary: var(--text-secondary);
    --text-muted: var(--text-muted);
    
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

.match-page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 80px); /* Adjust based on header/footer */
    background-color: var(--color-green-pitch); /* Base green color */
    background-image:
      radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.1) 100%), /* Subtle vignetting */
      repeating-linear-gradient(0deg, #6c9a59, #6c9a59 1px, #649151 1px, #649151 2px); /* Subtle horizontal lines */
    background-size: 100% 100%, 100% 40px; /* Adjust size of repeating lines */
    background-position: center center, 0 0;
    position: relative;
    overflow: hidden;
  }
  
  .match-page-wrapper::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 80%;
    height: 20%;
    min-height: 120px;
    max-height: 200px;
    transform: translate(-50%, -50%);
    background: radial-gradient(ellipse at center, rgba(144, 107, 73, 0.4) 0%, rgba(144, 107, 73, 0) 70%); /* Pitch effect */
    border-radius: 50%;
    z-index: 0;
  }

  /* Full Screen Messages & Toss */
  .full-screen-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
  }

  .message-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: 40px;
    border-radius: 16px;
    text-align: center;
    max-width: 500px;
    box-shadow: var(--shadow-lg);
  }
  
  .message-card h2 { font-size: 1.5rem; margin-bottom: 16px; color: var(--text-primary); }
  .message-card p { color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }
  .message-card.error h2 { color: var(--color-danger); }

  .toss-card {
    background: linear-gradient(145deg, var(--color-bg-panel), var(--color-bg-dark));
    border: 1px solid var(--color-border);
    padding: 40px;
    border-radius: 20px;
    text-align: center;
    max-width: 600px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  }

  .toss-header {
    font-size: 1.75rem;
    font-weight: 800;
    margin-bottom: 20px;
  }

  .toss-teams {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 30px;
  }
  .toss-teams .vs { color: var(--text-muted); font-size: 1rem; margin: 0 10px; }

  .conditions-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    background: rgba(0,0,0,0.2);
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 30px;
    border: 1px solid var(--color-bg-panel-light);
  }

  .condition { display: flex; align-items: center; gap: 15px; }
  .condition .emoji { font-size: 2.5rem; }
  .condition .details { display: flex; flex-direction: column; text-align: left; }
  .condition .value { font-weight: 700; font-size: 1.1rem; text-transform: capitalize; }
  .condition .label { font-size: 0.8rem; color: var(--text-muted); }
  .conditions-panel .divider { width: 1px; height: 50px; background: var(--color-border); }

  .toss-prompt { font-size: 1.2rem; color: var(--text-secondary); margin-bottom: 20px; }
  .toss-actions { display: flex; gap: 16px; justify-content: center; }

  /* Buttons */
  button { font-family: var(--font-sports); cursor: pointer; border: none; outline: none; }
  .btn-primary { background: var(--color-bowling); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; transition: background 0.2s; text-decoration: none; display: inline-block; }
  .btn-primary:hover { background: var(--color-bowling-dark); }
  .btn-primary.large { padding: 14px 28px; font-size: 1rem; }
  
  .btn-bat { background: var(--color-batting); color: white; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(var(--accent-emerald-rgb), 0.4); }
  .btn-bat:hover { transform: translateY(-2px); background: var(--color-batting-dark); }
  
  .btn-bowl { background: var(--color-danger); color: white; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(var(--accent-ruby-rgb), 0.4); }
  .btn-bowl:hover { transform: translateY(-2px); background: var(--accent-ruby); }

  .btn-start { background: var(--color-batting); color: white; padding: 16px 32px; border-radius: 12px; font-size: 1.1rem; font-weight: 800; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 10px 15px -3px rgba(var(--accent-emerald-rgb), 0.3); }
  .btn-start:hover { transform: scale(1.05); }

  /* Main Layout */
  .match-layout {
    display: flex;
    flex-direction: row;
    gap: 24px;
    min-height: calc(100vh - 40px);
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
  }

  @media (max-width: 1024px) {
    .match-layout { flex-direction: column; height: auto; }
  }

  .pane {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .left-pane, .right-pane {
    flex: 0 0 25%;
    min-width: 280px;
  }
  
  .center-pane {
    flex: 1;
    background: transparent;
    border: none;
    box-shadow: none;
    gap: 20px;
    display: flex;
    flex-direction: column;
  }

  /* Pane Headers */
  .pane-header {
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid;
    background: rgba(0,0,0,0.1);
  }
  .pane-header h3 { margin: 0; font-size: 1.2rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  
  .batting-header { border-bottom-color: var(--color-batting); }
  .batting-header h3 { color: var(--color-batting); }
  
  .bowling-header { border-bottom-color: var(--color-bowling); }
  .bowling-header h3 { color: var(--color-bowling); }

  .role-badge {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    color: var(--text-muted);
    background: rgba(255,255,255,0.05);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .pane-content {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  /* Selection Lists */
  .selection-container { display: flex; flex-direction: column; gap: 12px; height: 100%; }
  .selection-prompt { font-size: 0.9rem; color: var(--color-accent); font-weight: 600; text-align: center; margin-bottom: 8px; }
  .selection-list { display: flex; flex-direction: column; gap: 10px; }
  
  .player-select-btn {
    background: var(--bg-surface);
    border: 2px solid rgba(255,255,255,0.1);
    padding: 12px 16px;
    border-radius: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.15s ease;
    color: var(--text-primary);
    position: relative;
    cursor: pointer;
  }
  .player-select-btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
  .player-select-btn:hover:not(.selected):not(:disabled) {
    border-color: var(--team-primary, #3b82f6);
    background: rgba(var(--team-primary-rgb, 59, 130, 246), 0.1);
  }
  .player-select-btn.selected {
    background: linear-gradient(135deg, var(--team-primary, #3b82f6), var(--team-secondary, #fbbf24)) !important;
    border-color: var(--team-primary, #3b82f6) !important;
    border-width: 3px !important;
    color: #fff !important;
  }
  .player-select-btn.selected .name { color: #fff !important; font-weight: 700; }
  .player-select-btn.selected .role { color: rgba(255,255,255,0.8) !important; }
  .player-select-btn.selected .stat-badge { background: rgba(0,0,0,0.3) !important; color: #fff !important; font-weight: 700; }
  .player-select-btn.selected .avatar-wrapper { border-color: #fff !important; }
  .player-select-btn.selected .faction-badge-mini { background: rgba(0,0,0,0.3) !important; color: #fff !important; border-color: rgba(255,255,255,0.3) !important; }
  
  .select-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 22px;
    height: 22px;
    background: #22c55e;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 900;
    z-index: 10;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    border: 2px solid var(--bg-surface, #1e293b);
    line-height: 1;
  }
  
  .player-info { display: flex; flex-direction: column; text-align: left; }
  .player-info .name { font-weight: 600; font-size: 1rem; color: var(--team-primary, var(--text-primary)); }
  .player-info .role { font-size: 0.75rem; color: var(--text-muted); }
  
  .stat-badge { background: rgba(var(--team-primary-rgb, 148, 163, 184), 0.12); color: var(--team-primary, var(--text-primary)); padding: 4px 8px; border-radius: 4px; font-family: var(--font-sports); font-size: 0.85rem; font-weight: 600; }

  .btn-confirm { background: linear-gradient(135deg, var(--team-primary, var(--color-batting)), var(--team-secondary, var(--color-batting-dark))); color: white; padding: 14px; border-radius: 8px; font-weight: 700; margin-top: auto; }
  .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Scorecards */
  .scorecard-list { display: flex; flex-direction: column; gap: 8px; }
  .scorecard-item {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    padding: 12px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .scorecard-item.team-themed {
    background: var(--team-bg, linear-gradient(135deg, rgba(var(--team-primary-rgb, 148, 163, 184), 0.12), rgba(var(--team-primary-rgb, 148, 163, 184), 0.04)));
    border: 1px solid rgba(var(--team-primary-rgb, 148, 163, 184), 0.25);
    border-left: 4px solid var(--team-primary, #3b82f6);
  }

  .scorecard-item.team-themed .player-name {
    color: var(--team-primary, var(--text-primary));
  }

  .scorecard-item.team-themed .player-score {
    color: var(--team-secondary, var(--text-secondary));
  }

  .scorecard-item.team-themed .avatar-wrapper {
    border-color: var(--team-primary, var(--accent-sapphire));
  }

  .scorecard-item.team-themed .faction-badge-mini {
    border-color: var(--team-primary, var(--accent-sapphire));
    background: var(--team-primary, var(--bg-primary));
    color: #fff;
  }
  
  .scorecard-item.active { border-color: rgba(var(--team-primary-rgb, 148, 163, 184), 0.45); box-shadow: 0 0 8px rgba(var(--team-primary-rgb, 148, 163, 184), 0.15); }
  .scorecard-item.active-bowl { border-color: rgba(var(--team-primary-rgb, 148, 163, 184), 0.45); box-shadow: 0 0 8px rgba(var(--team-primary-rgb, 148, 163, 184), 0.15); }

    .top-row { display: flex; justify-content: space-between; align-items: center; }
    
    .player-identity {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .avatar-wrapper {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      border: 2px solid rgba(var(--team-primary-rgb, 148, 163, 184), 0.3);
    }
    
    .player-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    
    .faction-badge-mini {
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 18px;
      height: 18px;
      background: var(--bg-primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      border: 1px solid rgba(var(--team-primary-rgb, 148, 163, 184), 0.25);
    }
    
    .player-name { font-weight: 600; font-size: 0.95rem; color: var(--text-secondary); }
    .player-name.highlight { color: var(--team-primary, var(--accent-emerald)); }
  .player-name.highlight-bowl { color: var(--team-primary, var(--accent-sapphire)); }

  .player-score { font-family: var(--font-sports); font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); }
  .player-score.highlight { color: var(--team-primary, var(--accent-emerald)); }
  .player-score.highlight-bowl { color: var(--team-primary, var(--accent-sapphire)); }
  .player-score .balls, .player-score .overs { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); }

  .status { font-size: 0.75rem; font-style: italic; }
  .status.out { color: var(--color-danger); }
  .status.waiting { color: var(--text-muted); }
  .status.playing { color: var(--team-primary, var(--accent-emerald)); font-weight: 600; font-style: normal; display: flex; align-items: center; gap: 6px; }
  .status.playing-bowl { color: var(--team-primary, var(--accent-sapphire)); font-weight: 600; font-style: normal; display: flex; align-items: center; gap: 6px; }

  /* Center Pane Elements */
  .scoreboard-panel {
    background: linear-gradient(to bottom right, var(--color-bg-panel), var(--color-bg-dark));
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 24px;
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
  }
  .scoreboard-panel::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--color-batting), var(--color-bowling));
  }

  .scoreboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .innings-label { font-size: 0.85rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .match-teams-vs { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; }
  .match-teams-vs .vs { color: var(--text-muted); font-size: 0.75rem; }
  .conditions-mini { display: flex; gap: 12px; font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--color-border); }

  .action-panel {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-lg);
    flex: 1;
  }
  .ready-title { color: var(--color-batting); font-size: 1.5rem; margin-bottom: 24px; }
  .break-title { color: var(--color-accent); font-size: 1.5rem; margin-bottom: 16px; }
  .target-text { font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 24px; }
  .target-text strong { color: var(--text-primary); font-size: 1.25rem; }
  .win-title { color: var(--color-batting); font-size: 2rem; margin-bottom: 16px; }
  .final-score { font-family: var(--font-sports); font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 24px; }
  .final-score .vs { font-family: var(--font-sports); font-size: 0.9rem; color: var(--text-muted); margin: 0 10px; }
  
  .waiting-title { color: var(--color-accent); font-size: 1.25rem; margin-bottom: 8px; }
  .waiting-desc { color: var(--text-muted); }

  .controls-panel {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 16px;
    box-shadow: var(--shadow-md);
  }

  @media (max-width: 768px) {
    .controls-panel {
      position: sticky;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 100;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      padding-bottom: env(safe-area-inset-bottom); /* Account for iPhone X notch */
    }
  }

  .commentary-panel {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    box-shadow: var(--shadow-md);
    min-height: 450px;
  }
  
  .commentary-header {
    background: rgba(0,0,0,0.2);
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .live-bowler { color: var(--color-bowling); text-transform: none; font-size: 0.9rem; }
  
  .commentary-content {
    flex: 1;
    overflow-y: auto;
    background: var(--color-bg-dark); /* Slightly darker for commentary feed */
  }

  /* Animations */
  @keyframes spin { 100% { transform: rotate(360deg); } }
  .spinner { width: 40px; height: 40px; border: 4px solid var(--color-accent); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
  .spinner.large { width: 60px; height: 60px; border-width: 6px; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .pulse-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--color-batting); animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  .pulse-dot.bowl { background: var(--color-bowling); }

  .match-rewards-panel { background: rgba(var(--accent-emerald-rgb), 0.1); border: 1px solid var(--success); border-radius: 12px; padding: 20px; margin: 20px auto; width: 100%; max-width: 800px; text-align: left; }
  .match-rewards-panel h4 { color: var(--success); font-size: 1.5rem; margin-top: 0; margin-bottom: 16px; text-align: center; }
  .rewards-grid { display: flex; gap: 24px; flex-wrap: wrap; }
  .reward-col { flex: 1; min-width: 200px; background: var(--color-bg-panel); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border); }
  .reward-col h5 { margin-top: 0; margin-bottom: 12px; font-size: 1.1rem; color: var(--text-primary); border-bottom: 1px solid var(--color-border); padding-bottom: 8px; }
  .reward-col p { margin: 8px 0; font-size: 0.95rem; color: var(--text-secondary); display: flex; justify-content: space-between; }
  .reward-col .money { color: var(--success); font-weight: bold; font-family: var(--font-sports); font-size: 1.1rem; }
  .potm-col { border-color: var(--accent-amethyst); background: rgba(var(--accent-amethyst-rgb), 0.05); }
  .potm-col h5 { color: var(--accent-amethyst); border-bottom-color: rgba(var(--accent-amethyst-rgb), 0.2); }
  .potm-name { font-weight: bold; color: var(--text-primary) !important; font-size: 1.1rem !important; }
  .potm-team { font-weight: normal; color: var(--text-muted); font-size: 0.9rem; }
  .potm-stats { font-style: italic; color: var(--text-muted) !important; }
  /* Drawer Styles */
  .drawer-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    backdrop-filter: blur(4px);
  }
  .drawer {
    position: fixed;
    bottom: 0;
    left: 0; right: 0;
    height: 70vh;
    background: var(--color-bg-panel);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    z-index: 101;
    box-shadow: 0 -10px 25px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out forwards;
    border: 1px solid var(--color-border);
    border-bottom: none;
    max-width: 800px;
    margin: 0 auto;
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .drawer-header {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    background: rgba(0,0,0,0.2);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
  }
  .btn-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0 10px;
    line-height: 1;
    transition: color 0.2s;
  }
  .btn-close:hover { color: var(--color-danger); }
  .drawer-content {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }
  .btn-drawer-toggle {
    background: rgba(255,255,255,0.05);
    color: var(--text-secondary);
    border: 1px solid var(--color-border);
    padding: 12px;
    border-radius: 8px;
    margin-top: 16px;
    width: 100%;
    font-weight: 600;
    transition: all 0.2s;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
  }
  .btn-drawer-toggle:hover {
    background: rgba(255,255,255,0.1);
    color: var(--text-primary);
  }

  .scorecard-item {
    position: relative;
    overflow: hidden;
  }

  .player-select-btn {
    position: relative;
    overflow: visible;
  }

  .scorecard-item::after {
    content: attr(data-faction);
    position: absolute;
    bottom: -8px;
    right: -5px;
    font-size: 40px;
    font-family: 'Cinzel', serif;
    font-weight: 700;
    text-transform: uppercase;
    opacity: 0.08;
    pointer-events: none;
    z-index: 0;
  }

  .player-select-btn::after {
    content: attr(data-faction);
    position: absolute;
    bottom: -8px;
    right: -5px;
    font-size: 40px;
    font-family: 'Cinzel', serif;
    font-weight: 700;
    text-transform: uppercase;
    opacity: 0.08;
    pointer-events: none;
    z-index: -1;
  }

  .scorecard-item > *, .player-select-btn > * {
    position: relative;
    z-index: 1;
  }

  .scorecard-item[data-faction="human"] { border-left: 3px solid var(--team-primary, var(--accent-human)); }
  .scorecard-item[data-faction="human"]::after { color: var(--team-primary, var(--accent-human)); }

  .scorecard-item[data-faction="elf"] { border-left: 3px solid var(--team-primary, var(--accent-elf)); }
  .scorecard-item[data-faction="elf"]::after { color: var(--team-primary, var(--accent-elf)); }

  .scorecard-item[data-faction="orc"] { border-left: 3px solid var(--team-primary, var(--accent-orc)); }
  .scorecard-item[data-faction="orc"]::after { color: var(--team-primary, var(--accent-orc)); }

  .scorecard-item[data-faction="dwarf"] { border-left: 3px solid var(--team-primary, var(--accent-dwarf)); }
  .scorecard-item[data-faction="dwarf"]::after { color: var(--team-primary, var(--accent-dwarf)); }

  .scorecard-item[data-faction="goblin"] { border-left: 3px solid var(--team-primary, var(--accent-goblin)); }
  .scorecard-item[data-faction="goblin"]::after { color: var(--team-primary, var(--accent-goblin)); }

  .scorecard-item[data-faction="nightelf"] { border-left: 3px solid var(--team-primary, var(--accent-nightelf)); }
  .scorecard-item[data-faction="nightelf"]::after { color: var(--team-primary, var(--accent-nightelf)); }

  .faction-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 10px;
    margin-right: 4px;
    border: 1px solid;
    background: var(--bg-tertiary);
  }
  .faction-human { border-color: var(--accent-human); box-shadow: 0 0 5px rgba(9, 105, 218, 0.4); }
  .faction-elf { border-color: var(--accent-elf); box-shadow: 0 0 5px rgba(26, 127, 55, 0.4); }
  .faction-orc { border-color: var(--accent-orc); box-shadow: 0 0 5px rgba(207, 34, 46, 0.4); }
  .faction-dwarf { border-color: var(--accent-dwarf); box-shadow: 0 0 5px rgba(154, 103, 0, 0.4); }
  .faction-goblin { border-color: var(--accent-goblin); box-shadow: 0 0 5px rgba(130, 80, 223, 0.4); }
  .faction-nightelf { border-color: var(--accent-nightelf); box-shadow: 0 0 5px rgba(5, 152, 188, 0.4); }
  .faction-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 10px;
    margin-right: 4px;
    border: 1px solid;
    background: var(--bg-tertiary);
  }
  .faction-human { border-color: var(--accent-human); box-shadow: 0 0 5px rgba(9, 105, 218, 0.4); }
  .faction-elf { border-color: var(--accent-elf); box-shadow: 0 0 5px rgba(26, 127, 55, 0.4); }
  .faction-orc { border-color: var(--accent-orc); box-shadow: 0 0 5px rgba(207, 34, 46, 0.4); }
  .faction-dwarf { border-color: var(--accent-dwarf); box-shadow: 0 0 5px rgba(154, 103, 0, 0.4); }
  .faction-goblin { border-color: var(--accent-goblin); box-shadow: 0 0 5px rgba(137, 87, 229, 0.4); }
  .faction-nightelf { border-color: var(--accent-nightelf); box-shadow: 0 0 5px rgba(5, 152, 188, 0.4); }

  .impact-animation-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: none; /* Allow clicks to pass through */
    animation: fadeInOut 1.5s ease-out forwards;
  }
  .impact-animation-overlay.wicket { animation-duration: 1.5s; }
  .impact-animation-overlay.four, .impact-animation-overlay.six { animation-duration: 1s; }

  .impact-graphic {
    font-family: 'Cinzel', serif;
    font-size: 8rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 0 20px rgba(255,255,255,0.8);
    transform: scale(0.5);
    opacity: 0;
    animation: graphicScaleIn 0.5s ease-out 0.1s forwards;
  }
  .impact-animation-overlay.wicket .impact-graphic { color: var(--danger); text-shadow: 0 0 20px rgba(var(--accent-ruby-rgb), 0.8); }
  .impact-animation-overlay.four .impact-graphic { color: var(--accent-dwarf); text-shadow: 0 0 20px rgba(var(--accent-gold-rgb), 0.8); }
  .impact-animation-overlay.six .impact-graphic { color: var(--success); text-shadow: 0 0 20px rgba(var(--accent-emerald-rgb), 0.8); }

  .impact-subtext {
    font-family: 'Inter', sans-serif;
    font-size: 2.5rem;
    color: white;
    text-transform: uppercase;
    letter-spacing: 5px;
    opacity: 0;
    transform: translateY(20px);
    animation: subtextSlideIn 0.5s ease-out 0.3s forwards;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes graphicScaleIn {
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes subtextSlideIn {
    to { transform: translateY(0); opacity: 1; }
  }

  .floating-suggestion {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }

  .suggestion-toggle {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--bg-surface);
    border: none;
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s, background 0.2s;
  }

  .suggestion-toggle:hover {
    transform: scale(1.1);
    background: var(--warning);
  }

  .suggestion-content {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    width: 250px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: slideInUp 0.3s ease-out forwards;
    transform-origin: bottom right;
  }

  .suggestion-content h4 {
    margin: 0 0 8px 0;
    color: var(--color-accent);
    font-size: 1rem;
    font-family: 'Cinzel', serif;
  }

  .suggestion-content p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.4;
  }

  @keyframes slideInUp {
    from { opacity: 0; transform: translateY(20px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .batsman-card.on-strike {
    position: relative;
    box-shadow: 0 0 15px rgba(var(--team-primary-rgb, 59, 130, 246), 0.6) !important;
    border-width: 3px;
    transform: scale(1.02);
  }
  .striker-icon {
    font-size: 1.2rem;
    margin-left: 6px;
    filter: drop-shadow(0 0 5px rgba(255,255,255,0.5));
  }
  .left-badge {
    right: auto !important;
    left: -5px !important;
    z-index: 5;
  }
  .skill-badge {
    z-index: 5;
  }


  .teams-matchup-header {
    background: var(--bg-surface);
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  }

  .bubble {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1rem;
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border: 2px solid var(--border-color);
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .bubble.dot {
    background: var(--text-muted);
    color: var(--bg-primary);
    border-color: rgba(255,255,255,0.2);
  }
  .bubble.runs {
    background: #3b82f6; /* Blue for regular runs */
    color: white;
    border-color: #2563eb;
  }
  .bubble.four {
    background: #22c55e; /* Green for four */
    color: white;
    border-color: #16a34a;
  }
  .bubble.six {
    background: #a855f7; /* Purple for six */
    color: white;
    border-color: #9333ea;
  }
  .bubble.wicket {
    background: #ef4444; /* Red for wicket */
    color: white;
    border-color: #dc2626;
  }

</style>