<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { teamStore, scheduleStore, playerStore, saveCurrentGame } from '$lib/stores/gameState';
  import { getAvatarUrl } from '$lib/models/faction';
  import { loadActiveMatch, saveActiveMatch, clearActiveMatch } from '$lib/services/storage';
  import { gameAudio } from '$lib/services/audio';
  import { resolveBall, updateFatigueAndMorale, calculateCurrentRunRate, getOverBalls, resolveMatch } from '$lib/core/matchEngine';
  import { getAIIntent } from '$lib/core/teamBuilder';
  import type { Player } from '$lib/models/player';
  import type { Team } from '$lib/models/team';
  import type { Match, innings, IntentType, BallType } from '$lib/models/match';
  import type { ScheduledMatch, TournamentSchedule } from '$lib/core/schedule';
  import MatchControls, { type SimSpeed } from '$lib/components/match/MatchControls.svelte';
  import BallFeed from '$lib/components/match/BallFeed.svelte';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
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
  let playerStatsUpdatesObj = $state<Record<string, any> | null>(null);
  let matchFatigue: Record<string, number> = {};
  let currentBowlerIndex = $state(0);
  let ballInterval: any = null;
  
  let gameSpeed = $state<SimSpeed>('ball');

  let isComplete = $state(false);
  let currentBallType: BallType = $state('normal');
  let avoidSingles = $state(false);  
  let noMatchAvailable = $state(false);
  let lastCompletedMatch = $state<any>(null);
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

  
  let userTeam = $derived(matchTeam1?.id === 'user_team' ? matchTeam1 : matchTeam2);
  let playing11Players = $derived(
    userTeam?.playing11
      ? userTeam.playing11.map(id => userTeam.players.find(p => p.id === id)!).filter(Boolean)
      : []
  );

  let runRate = $derived(calculateCurrentRunRate(currentInningsData));
  let currentOverBalls = $derived(getOverBalls(currentInningsData));

  let showSuggestion = $state(false);
  let freeHitActive = $state(false);
  let impactUsed = $state(false);
  let replacedPlayerId = $state<string | null>(null);
  let impactPlayerId = $state<string | null>(null);
  let aiImpactUsed = $state(false);
  let aiReplacedPlayerId = $state<string | null>(null);
  let aiImpactPlayerId = $state<string | null>(null);
  let showImpactSelector = $state(false);
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
        if (!userT || !userT.playing11 || userT.playing11.length !== 11 || !userT.captain || !userT.wicketKeeper || !userT.reservePlayer) {
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
            freeHitActive = savedMatch.freeHitActive || false;
            impactUsed = savedMatch.impactUsed || false;
            replacedPlayerId = savedMatch.replacedPlayerId || null;
            impactPlayerId = savedMatch.impactPlayerId || null;
            aiImpactUsed = savedMatch.aiImpactUsed || false;
            aiReplacedPlayerId = savedMatch.aiReplacedPlayerId || null;
            aiImpactPlayerId = savedMatch.aiImpactPlayerId || null;
        } else {
            weather = getRandomWeather();
            pitch = getRandomPitch();
            phase = 'toss';
            freeHitActive = false;
            impactUsed = false;
            replacedPlayerId = null;
            impactPlayerId = null;
            aiImpactUsed = false;
            aiReplacedPlayerId = null;
            aiImpactPlayerId = null;
            clearActiveMatch();
        }
      } else {
        noMatchAvailable = true;
        const completedMatches = s.matches.filter((m: any) => 
          m.status === 'completed' && 
          (m.team1Id === 'user_team' || m.team2Id === 'user_team')
        );
        if (completedMatches.length > 0) {
           lastCompletedMatch = completedMatches[completedMatches.length - 1];
        }
      }
    }
  }

  onMount(() => {
    const unsubTeam = teamStore.subscribe(t => {
      teams = t;
      const match = currentMatch;
      if (match) {
        matchTeam1 = teams.find(team => team.id === match.team1Id) || null;
        matchTeam2 = teams.find(team => team.id === match.team2Id) || null;
      }
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
          freeHitActive,
          impactUsed,
          replacedPlayerId,
          impactPlayerId,
          aiImpactUsed,
          aiReplacedPlayerId,
          aiImpactPlayerId,
          savedAt: Date.now()
      });
  }

  onDestroy(() => {
    if (ballInterval) clearInterval(ballInterval);
    syncActiveMatchState();
  });
  
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
    } else if (phase === 'paused') {
      phase = 'playing';
      autoResume = true;
      if (ballInterval) clearInterval(ballInterval);
      ballInterval = setTimeout(playTargetedLoop, 50);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space' && (phase === 'paused' || phase === 'playing')) {
      e.preventDefault();
      togglePause();
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
      const team1 = matchTeam1;
      const team2 = matchTeam2;
      const t1Won = innings1.totalRuns > innings2.totalRuns;
      const t2Won = innings2.totalRuns > innings1.totalRuns;

      const winnerId = t1Won ? innings1.teamId : t2Won ? innings2.teamId : 'draw';
      const score1 = currentMatch.team1Id === innings1.teamId ? innings1.totalRuns : innings2.totalRuns;
      const score2 = currentMatch.team2Id === innings2.teamId ? innings2.totalRuns : innings1.totalRuns;

      // RESOLVE MATCH FIRST — mutates morale/form on local refs
      const result = resolveMatch(team1, team2, innings1, innings2, currentMatch.team1Id);
      matchResultObj = result;
      
      // Apply Earnings
      const totalEarningsTeam1 = result.sponsorshipEarnings.team1 + result.matchEarnings.team1;
      const totalEarningsTeam2 = result.sponsorshipEarnings.team2 + result.matchEarnings.team2;
      
      // Update Player Stats
      const playerStatsUpdates: Record<string, { runs: number, wickets: number, catches: number, matches: number, runOuts: number, xp: number }> = {};
      const addPlayerStat = (id: string, stat: string, value: number) => {
        if (!playerStatsUpdates[id]) playerStatsUpdates[id] = { runs: 0, wickets: 0, catches: 0, matches: 0, runOuts: 0, xp: 0 };
        (playerStatsUpdates[id] as any)[stat] += value;
      };
      
      const allPlayingIds = [...getPlaying11(team1), ...getPlaying11(team2)];
      allPlayingIds.forEach(id => {
         if (!playerStatsUpdates[id]) playerStatsUpdates[id] = { runs: 0, wickets: 0, catches: 0, matches: 1, runOuts: 0, xp: 0 };
         else playerStatsUpdates[id].matches = 1;
         
         // Participation XP
         addPlayerStat(id, 'xp', 10);
      });
      
      const getXpMultiplier = (team: any, role: string) => {
          const staff = team?.staff?.find((s: any) => s.role === role);
          if (!staff) return 1;
          return staff.tier === 'Legendary' ? 1.25 : staff.tier === 'Epic' ? 1.15 : staff.tier === 'Rare' ? 1.10 : 1.05;
      };
      
      const t1BattingMult = getXpMultiplier(team1, 'Batting Consultant');
      const t1BowlingMult = getXpMultiplier(team1, 'Bowling Consultant');
      const t2BattingMult = getXpMultiplier(team2, 'Batting Consultant');
      const t2BowlingMult = getXpMultiplier(team2, 'Bowling Consultant');

      [innings1, innings2].forEach((inn, index) => {
          const battingMult = inn.teamId === team1.id ? t1BattingMult : t2BattingMult;
          const bowlingMult = inn.teamId === team1.id ? t2BowlingMult : t1BowlingMult; // Bowling team is the opposite

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
      
      // Calculate milestones and POTM
      Object.keys(playerStatsUpdates).forEach(id => {
          const pStats = playerStatsUpdates[id];
          const teamId = team1.players.some(p => p.id === id) ? team1.id : team2.id;
          const battingMult = teamId === team1.id ? t1BattingMult : t2BattingMult;
          const bowlingMult = teamId === team1.id ? t1BowlingMult : t2BowlingMult;

          if (pStats.runs >= 100) pStats.xp += 100 * battingMult;
          else if (pStats.runs >= 50) pStats.xp += 50 * battingMult;
          
          if (pStats.wickets >= 5) pStats.xp += 100 * bowlingMult;
          else if (pStats.wickets >= 3) pStats.xp += 50 * bowlingMult;
          
          // round XP
          pStats.xp = Math.round(pStats.xp);
      });
      
      if (result.playerOfTheMatch) {
          addPlayerStat(result.playerOfTheMatch.id, 'xp', 100);
      }
      
      playerStatsUpdatesObj = playerStatsUpdates;
      
      const updatedTeamIds = new Set([team1.id, team2.id]);
      teamStore.update(tStore => tStore.map(t => {
        if (!updatedTeamIds.has(t.id)) return t;
        const localTeam = t.id === team1.id ? team1 : team2;
        return {
          ...t,
          fanProfile: localTeam.fanProfile,
          sponsorships: localTeam.sponsorships || [],
          injuries: localTeam.injuries || [],
          players: t.players.map(p => {
            const localPlayer = localTeam.players.find(lp => lp.id === p.id);
            const updates = playerStatsUpdates[p.id];
            
            const fatigue = Math.min(100, (p.fatigue || 0) + (matchFatigue[p.id] || 0));
            const morale = localPlayer ? localPlayer.morale : (p.morale || 50);
            const form = localPlayer ? localPlayer.form : (p.form || 0);
            const activeInjury = localPlayer ? (localPlayer as any).activeInjury : undefined;

            if (!updates) {
              return { ...p, fatigue, morale, form, activeInjury };
            }
            const ts = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
            return {
              ...p,
              matches: p.matches + 1,
              runsScored: p.runsScored + (updates.runs || 0),
              wickets: p.wickets + (updates.wickets || 0),
              catches: p.catches + (updates.catches || 0),
              xp: (p.xp || 0) + (updates.xp || 0),
              lifetimeXp: (p.lifetimeXp || 0) + (updates.xp || 0),
              fatigue,
              morale,
              form,
              activeInjury,
              tournamentStats: {
                runs: (ts.runs || 0) + (updates.runs || 0),
                wickets: (ts.wickets || 0) + (updates.wickets || 0),
                catches: (ts.catches || 0) + (updates.catches || 0)
              }
            };
          })
        };
      }));

      // NOW update store with wins/losses/earnings/schedule (after stats update preserves morale/form)
      if (t1Won) {
        teamStore.addWin(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
        teamStore.addLoss(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
      } else if (t2Won) {
        teamStore.addWin(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
        teamStore.addLoss(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
      }

      if (totalEarningsTeam1 > 0) teamStore.updateBudget(team1.id, totalEarningsTeam1);
      if (totalEarningsTeam2 > 0) teamStore.updateBudget(team2.id, totalEarningsTeam2);
      
      if (result.playerOfTheMatch && result.potmReward > 0) {
          teamStore.updateBudget(result.playerOfTheMatch.teamId, result.potmReward);
      }

      scheduleStore.updateMatchResult(currentMatch.id, winnerId, score1, score2);

      matchFatigue = {};
    }

    clearActiveMatch();

    const userTeamBudget = teams.find(t => t.id === 'user_team')?.budget ?? 0;
    saveCurrentGame(userTeamBudget);
  }

  function clearAnimation() {
    showImpactAnimation = false;
    impactAnimationType = null;
    if (animationTimeout) clearTimeout(animationTimeout);
    animationTimeout = null;
  }

  let reservePlayerObj = $derived(
    userTeam?.reservePlayer 
      ? userTeam.players.find(p => p.id === userTeam.reservePlayer) 
      : null
  );

  function activateImpactPlayer(replacedId: string) {
    if (!userTeam || !userTeam.reservePlayer || impactUsed) return;
    
    const impactId = userTeam.reservePlayer;
    impactPlayerId = impactId;
    replacedPlayerId = replacedId;
    impactUsed = true;
    
    gameAudio.playImpactFanfare();
    
    teamStore.update(teams => 
      teams.map(t => {
        if (t.id === userTeam.id) {
          const newPlaying11 = (t.playing11 || []).map(id => id === replacedId ? impactId : id);
          return {
            ...t,
            playing11: newPlaying11,
            captain: t.captain === replacedId ? impactId : t.captain,
            wicketKeeper: t.wicketKeeper === replacedId ? impactId : t.wicketKeeper
          };
        }
        return t;
      })
    );

    const swapInInnings = (inn: innings) => {
      let updated = false;
      let newBatsmen = [...inn.currentBatsmen] as [string, string];
      if (inn.currentBatsmen[0] === replacedId) {
        newBatsmen[0] = impactId;
        updated = true;
      }
      if (inn.currentBatsmen[1] === replacedId) {
        newBatsmen[1] = impactId;
        updated = true;
      }
      let newOrder = [...inn.battingOrder];
      if (newOrder.includes(replacedId)) {
        newOrder = newOrder.map(id => id === replacedId ? impactId : id);
        updated = true;
      }
      if (updated) {
        return {
          ...inn,
          currentBatsmen: newBatsmen,
          battingOrder: newOrder
        };
      }
      return inn;
    };

    if (currentInnings === 1) {
      innings1 = swapInInnings(innings1);
    } else {
      innings2 = swapInInnings(innings2);
    }

    if (selectedBowlerId === replacedId) {
      selectedBowlerId = impactId;
    }

    const replacedPlayer = userTeam.players.find(p => p.id === replacedId);
    const impactPlayer = userTeam.players.find(p => p.id === impactId);
    if (replacedPlayer && impactPlayer) {
      const commentaryMsg = `⚡ IMPACT PLAYER SUB: ${impactPlayer.name} replaces ${replacedPlayer.name}!`;
      const currentInn = currentInnings === 1 ? innings1 : innings2;
      const updatedInn = {
        ...currentInn,
        ballsFaced: [
          ...currentInn.ballsFaced,
          {
            ballNumber: currentInn.balls,
            over: currentInn.overs,
            ball: currentInn.balls % 6 || 6,
            batsmanId: currentInn.currentBatsmen[0] || '',
            bowlerId: selectedBowlerId || '',
            result: 'single',
            runs: 0,
            isWicket: false,
            commentary: commentaryMsg
          } as any
        ]
      };
      if (currentInnings === 1) innings1 = updatedInn;
      else innings2 = updatedInn;
    }

    syncActiveMatchState();
  }

  function triggerAiImpactPlayerCheck() {
    if (aiImpactUsed || !currentBattingTeam || !currentBowlingTeam) return;
    
    const aiTeam = currentBattingTeam.id !== 'user_team' ? currentBattingTeam : (currentBowlingTeam.id !== 'user_team' ? currentBowlingTeam : null);
    if (!aiTeam) return;

    const isBatting = aiTeam.id === currentBattingTeam.id;
    const currentInn = currentInnings === 1 ? innings1 : innings2;
    
    let shouldActivate = false;
    let roleToBringIn: 'batsman' | 'bowler' = 'batsman';
    
    if (isBatting && currentInn.wickets === 5 && currentInn.balls % 6 === 0) {
      shouldActivate = true;
      roleToBringIn = 'batsman';
    } else if (!isBatting && currentInn.balls === 0) {
      shouldActivate = true;
      roleToBringIn = 'bowler';
    }

    if (shouldActivate) {
      const p11 = getPlaying11(aiTeam);
      const reserves = aiTeam.players.filter(p => !p11.includes(p.id));
      if (reserves.length === 0) return;

      reserves.sort((a, b) => {
        if (roleToBringIn === 'batsman') {
          return b.stats.batting - a.stats.batting;
        } else {
          return b.stats.bowling - a.stats.bowling;
        }
      });
      const impactId = reserves[0].id;

      const playing11PlayersList = aiTeam.players.filter(p => p11.includes(p.id));
      playing11PlayersList.sort((a, b) => {
        if (roleToBringIn === 'batsman') {
          return a.stats.batting - b.stats.batting;
        } else {
          return a.stats.bowling - b.stats.bowling;
        }
      });

      const replacedId = playing11PlayersList[0].id;
      aiImpactPlayerId = impactId;
      aiReplacedPlayerId = replacedId;
      aiImpactUsed = true;

      teamStore.update(teams => 
        teams.map(t => {
          if (t.id === aiTeam.id) {
            const newPlaying11 = (t.playing11 || []).map(id => id === replacedId ? impactId : id);
            return {
              ...t,
              playing11: newPlaying11,
              captain: t.captain === replacedId ? impactId : t.captain,
              wicketKeeper: t.wicketKeeper === replacedId ? impactId : t.wicketKeeper
            };
          }
          return t;
        })
      );

      const swapInInnings = (inn: innings) => {
        let updated = false;
        let newBatsmen = [...inn.currentBatsmen] as [string, string];
        if (inn.currentBatsmen[0] === replacedId) {
          newBatsmen[0] = impactId;
          updated = true;
        }
        if (inn.currentBatsmen[1] === replacedId) {
          newBatsmen[1] = impactId;
          updated = true;
        }
        let newOrder = [...inn.battingOrder];
        if (newOrder.includes(replacedId)) {
          newOrder = newOrder.map(id => id === replacedId ? impactId : id);
          updated = true;
        }
        if (updated) {
          return {
            ...inn,
            currentBatsmen: newBatsmen,
            battingOrder: newOrder
          };
        }
        return inn;
      };

      if (currentInnings === 1) {
        innings1 = swapInInnings(innings1);
      } else {
        innings2 = swapInInnings(innings2);
      }

      const replacedPlayer = aiTeam.players.find(p => p.id === replacedId);
      const impactPlayer = aiTeam.players.find(p => p.id === impactId);
      if (replacedPlayer && impactPlayer) {
        const commentaryMsg = `⚡ AI IMPACT PLAYER SUB: ${impactPlayer.name} replaces ${replacedPlayer.name} for ${aiTeam.name}!`;
        const updatedInn = {
          ...currentInn,
          ballsFaced: [
            ...currentInn.ballsFaced,
            {
              ballNumber: currentInn.balls,
              over: currentInn.overs,
              ball: currentInn.balls % 6 || 6,
              batsmanId: currentInn.currentBatsmen[0] || '',
              bowlerId: selectedBowlerId || '',
              result: 'single',
              runs: 0,
              isWicket: false,
              commentary: commentaryMsg
            } as any
          ]
        };
        if (currentInnings === 1) innings1 = updatedInn;
        else innings2 = updatedInn;
      }
    }
  }
  
  function executeSingleBall() {
    if (isComplete || !currentBattingTeam || !currentBowlingTeam) {
      phase = 'paused';
      return true;
    }
    
    clearAnimation(); // Clear any previous animation
    triggerAiImpactPlayerCheck();
  
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

    const ballEvent = resolveBall(striker, bowler, currentInn.balls, totalOvers, currentActiveBattingIntent, weather as any, pitch as any, 0, freeHitActive, currentActiveBowlingIntent, avoidSingles, bowlingFieldingAvg, currentBallType, concMult, rhythmMult, getPlaying11(currentBowlingTeam));

    if (ballEvent.result === 'noball') {
      freeHitActive = true;
      gameAudio.playFreeHitSiren();
    } else if (ballEvent.result === 'wide') {
      // keep free hit active
    } else {
      freeHitActive = false;
    }

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
    
    // Trigger impact animations and sounds
    const isUserBatting = currentBattingTeam?.id === 'user_team';
    const isHome = currentMatch?.team1Id === 'user_team';

    if (ballEvent.isWicket) {
      if (isUserBatting) {
        if (isHome) {
          gameAudio.groan(1.0);
        } else {
          gameAudio.cheer(0.8);
        }
      } else {
        if (isHome) {
          gameAudio.cheer(1.0);
        } else {
          gameAudio.groan(0.7);
        }
      }
      showImpactAnimation = true;
      impactAnimationType = 'wicket';
      animationTimeout = setTimeout(clearAnimation, 1500); // Show for 1.5 seconds
    } else if (ballEvent.runs === 4) {
      if (isUserBatting) {
        if (isHome) {
          gameAudio.cheer(0.9);
        } else {
          gameAudio.cheer(0.35);
        }
      } else {
        if (isHome) {
          gameAudio.groan(0.75);
        } else {
          gameAudio.cheer(0.9);
        }
      }
      showImpactAnimation = true;
      impactAnimationType = 'four';
      animationTimeout = setTimeout(clearAnimation, 1000); // Show for 1 second
    } else if (ballEvent.runs === 6) {
      if (isUserBatting) {
        if (isHome) {
          gameAudio.cheer(1.15);
        } else {
          gameAudio.cheer(0.45);
        }
      } else {
        if (isHome) {
          gameAudio.groan(0.95);
        } else {
          gameAudio.cheer(1.15);
        }
      }
      showImpactAnimation = true;
      impactAnimationType = 'six';
      animationTimeout = setTimeout(clearAnimation, 1000); // Show for 1 second
    } else if (ballEvent.runs > 0) {
      gameAudio.batCrack();
    }
    
    const fatigueUpdates = updateFatigueAndMorale(striker, bowler, ballEvent.result, currentActiveBattingIntent, currentActiveBowlingIntent);
    striker.fatigue += fatigueUpdates.batterFatigue;
    bowler.fatigue += fatigueUpdates.bowlerFatigue;
    matchFatigue[striker.id] = (matchFatigue[striker.id] || 0) + fatigueUpdates.batterFatigue;
    matchFatigue[bowler.id] = (matchFatigue[bowler.id] || 0) + fatigueUpdates.bowlerFatigue;
    striker.morale = Math.max(0, Math.min(100, striker.morale + fatigueUpdates.batterMorale));
    bowler.morale = Math.max(0, Math.min(100, bowler.morale + fatigueUpdates.bowlerMorale));
    
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
        extras: currentInn.extras + (ballEvent.result === 'wide' || ballEvent.result === 'noball' ? ballEvent.runs : 0),
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
    
    const updatedInnings = {
      ...inn,
      battingOrder: newOrder,
      currentBatsmen: [selectedBatsmen[0], selectedBatsmen[1]] as [string, string]
    };

    if (currentInnings === 1) {
        innings1 = updatedInnings;
    } else {
        innings2 = updatedInnings;
    }
    
    const isUserBowling = currentBowlingTeam?.id === 'user_team';
    if (isUserBowling) {
        phase = 'selectOpeningBowler';
        selectedBowlerId = null;
    } else {
        phase = 'ready';
    }
    syncActiveMatchState();
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

  function getBarColor(val: number): string {
    if (val >= 70) return '#22c55e'; // Green
    if (val >= 35) return '#fbbf24'; // Yellow
    return '#ef4444'; // Red
  }


  let batsmanIntents = $state<Record<string, IntentType>>({});
  let bowlerIntents = $state<Record<string, IntentType>>({});
  
  const INTENT_LEVELS: IntentType[] = ['very_defensive', 'defensive', 'balanced', 'aggressive', 'very_aggressive'];
  const INTENT_LABELS: Record<string, string> = {
      'very_defensive': 'Very Defensive',
      'defensive': 'Defensive',
      'balanced': 'Neutral',
      'aggressive': 'Aggressive',
      'very_aggressive': 'Ultra Aggressive'
  };

  function getIntentIndex(intent: IntentType) {
      return INTENT_LEVELS.indexOf(intent) !== -1 ? INTENT_LEVELS.indexOf(intent) : 2;
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

  function getBatsmanIntentLabel(intent: IntentType) {
      if (intent === 'very_defensive') return 'Block (Very Defensive)';
      if (intent === 'very_aggressive') return 'Slog (Ultra Aggressive)';
      return INTENT_LABELS[intent] || 'Neutral';
  }

  function getBowlerIntentLabel(intent: IntentType) {
      if (intent === 'very_defensive') return 'Ultra Def (Very Defensive)';
      if (intent === 'very_aggressive') return 'Ultra Att (Ultra Aggressive)';
      return INTENT_LABELS[intent] || 'Neutral';
  }
  
  let currentActiveBattingIntent = $derived(currentInningsData.currentBatsmen[0] ? (batsmanIntents[currentInningsData.currentBatsmen[0]] || 'balanced') : 'balanced');
  let currentActiveBowlingIntent = $derived(currentLiveBowlerId ? (bowlerIntents[currentLiveBowlerId] || 'balanced') : 'balanced');

</script>

<svelte:head><title>Match - Fantasy Cricket</title></svelte:head>

<svelte:window onkeydown={handleKeydown} />

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
    <div class="full-screen-message" style="align-items: center; justify-content: center; flex-direction: column; padding: 2rem;">
      {#if lastCompletedMatch && lastCompletedMatch.result}
        <div class="message-card" style="margin-bottom: 2rem; max-width: 600px; text-align: center; border-left: 4px solid var(--color-primary);">
          <h2 style="color: var(--color-primary); margin-bottom: 1rem;">Previous Match Summary</h2>
          <p class="final-score" style="font-size: 1.5rem; margin: 1rem 0;">
             {getTeamName(lastCompletedMatch.team1Id)} {lastCompletedMatch.result.team1Score} 
             <span class="vs">vs</span> 
             {lastCompletedMatch.result.team2Score} {getTeamName(lastCompletedMatch.team2Id)}
          </p>
          <h3 class="win-title" style="color: var(--color-accent); margin-top: 1rem;">
             {lastCompletedMatch.result.winner === 'draw' ? 'Match Tied' : getTeamName(lastCompletedMatch.result.winner) + ' Won'}
          </h3>
        </div>
      {/if}
      <div class="message-card">
        <h2>No Match Scheduled Today</h2>
        <p>Check the tournament schedule for your next match.</p>
        <button class="btn-primary" onclick={handleGoHome} style="margin-top: 1rem;">Back to Dashboard</button>
      </div>
    </div>
  {:else if phase === 'loading'}
    <div class="full-screen-message"><div class="spinner"></div><h2>Loading Match...</h2></div>
  {:else if phase === 'invalidSquad'}
    <div class="full-screen-message">
      <div class="message-card error">
        <h2>Incomplete Squad</h2>
        <p>You must select exactly 11 players, a captain, a wicketkeeper, and an impact player (reserve) before you can play a match.</p>
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
    <!-- Main Two-Column Match Dashboard -->
    <div class="match-dashboard">
      <!-- Left Column -->
      <div class="match-left-column">
        
        {#if phase === 'ready' || phase === 'inningBreak' || phase === 'complete'}
          
          {#if phase !== 'ready'}
            <!-- Scoreboard Card -->
            <div class="scoreboard-card card-premium">
              <div class="matchup-header">
                <span class="team-name" style="color: {matchTeam1?.colorPrimary}">{matchTeam1?.name}</span>
                <span class="vs">vs</span>
                <span class="team-name" style="color: {matchTeam2?.colorPrimary}">{matchTeam2?.name}</span>
              </div>
              <div class="weather-pitch-bar">
                <span>{weatherEmojis[weather]} {weather}</span>
                <span class="dot-separator">•</span>
                <span>{pitchEmojis[pitch]} {pitch} pitch</span>
                {#if freeHitActive}
                  <span class="dot-separator">•</span>
                  <span class="free-hit-badge" style="color: #ef4444; font-weight: 800; animation: blink 1s infinite;">💥 FREE HIT</span>
                {/if}
              </div>
              <div class="score-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: baseline; gap: 12px;">
                  <div class="runs-wickets">
                    <span class="runs">{currentInningsData.totalRuns}</span>
                    <span class="divider">/</span>
                    <span class="wickets">{currentInningsData.wickets}</span>
                  </div>
                  <div class="overs">
                    Overs: <span class="overs-val">{currentInningsData.overs}.{currentInningsData.balls % 6}</span>
                  </div>
                </div>

                {#if currentInningsData.ballsFaced.length > 0}
                  {@const recentBalls = currentInningsData.ballsFaced.slice(-12)}
                  <div class="recent-balls-mini" style="display: flex; align-items: center; gap: 4px; margin: 0;">
                    {#each recentBalls as ball, idx}
                      {#if idx > 0 && ball.over !== recentBalls[idx - 1].over}
                        <div class="over-separator" style="width: 2px; height: 18px; background-color: var(--border-color); margin: 0 4px; align-self: center;"></div>
                      {/if}
                      <div class="bubble {ball.isWicket ? 'wicket' : ball.runs === 4 ? 'four' : ball.runs === 6 ? 'six' : ball.runs === 0 ? 'dot' : 'runs'}">
                        {ball.isWicket ? 'W' : ball.runs}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
              
              <div class="stats-row">
                <div class="stat-item">
                  <span class="label">CRR</span>
                  <span class="value">{runRate}</span>
                </div>
                {#if currentInnings === 2 && target}
                  <div class="stat-item">
                    <span class="label">Target</span>
                    <span class="value">{target}</span>
                  </div>
                  <div class="stat-item equation">
                    <span>Need {target - currentInningsData.totalRuns} off {120 - currentInningsData.balls} balls</span>
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Matchup Header Only for Ready Phase -->
            <div class="scoreboard-card card-premium matchup-only">
              <div class="matchup-header">
                <span class="team-name" style="color: {matchTeam1?.colorPrimary}">{matchTeam1?.name}</span>
                <span class="vs">vs</span>
                <span class="team-name" style="color: {matchTeam2?.colorPrimary}">{matchTeam2?.name}</span>
              </div>
              <div class="weather-pitch-bar" style="margin-top: 8px;">
                <span>{weatherEmojis[weather]} {weather}</span>
                <span class="dot-separator">•</span>
                <span>{pitchEmojis[pitch]} {pitch} pitch</span>
              </div>
            </div>
          {/if}

          <!-- Phase specific Action Cards -->
          {#if phase === 'ready'}
            <div class="action-card card-premium ready-state">
              {#if userTeam && playing11Players.length === 11}
                <div class="lineup-panel" style="width: 100%;">
                  <h3 class="lineup-title">{userTeam.name} — Playing XI</h3>
                  <div class="lineup-grid-mini">
                    {#each playing11Players as p}
                      <div class="lineup-player-badge faction-{p.faction}">
                        <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="avatar-mini" />
                        <div class="player-meta">
                          <span class="name">{p.name}</span>
                          <span class="role">{p.role} • {p.role === 'bowler' ? 'Bowler' : 'Batter'}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
              <div class="start-actions">
                <button class="btn-start-match" onclick={startPlay}>▶ Start Match</button>
              </div>
            </div>
          {:else if phase === 'inningBreak'}
            <div class="action-card card-premium break-state">
              <h2>Innings Break</h2>
              <p class="target-text">Target for {matchTeam1?.id === innings2.teamId ? matchTeam1?.name : matchTeam2?.name} is <strong>{target}</strong> runs.</p>
              <button class="btn-start-match" onclick={startSecondInnings}>▶ Start 2nd Innings</button>
            </div>
          {:else if phase === 'complete'}
            <div class="action-card card-premium complete-state">
              <h3 class="win-title" style="color: var(--color-accent); font-family: 'Cinzel', serif; font-size: 1.8rem; margin: 0 0 8px 0; text-align: center;">
                {innings2.totalRuns >= target ? getTeamName(innings2.teamId) : (innings1.totalRuns > innings2.totalRuns ? getTeamName(innings1.teamId) : 'Match Tied')}!
              </h3>
              <p class="final-score" style="font-family: var(--font-sports); font-size: 1.5rem; text-align: center; margin: 8px 0 20px 0;">
                {innings1.totalRuns}/{innings1.wickets} <span class="vs" style="font-size: 1rem; color: var(--text-muted); margin: 0 8px;">vs</span> {innings2.totalRuns}/{innings2.wickets}
              </p>
              
              {#if matchResultObj?.playerOfTheMatch}
                <div class="potm-summary" style="background: var(--bg-surface); padding: 1.25rem; border-radius: 0; margin: 0 0 16px 0; border-left: 4px solid var(--color-accent); width: 100%; box-sizing: border-box;">
                  <h4 style="margin: 0 0 0.5rem 0; color: var(--color-accent); font-family: 'Cinzel', serif;">🏅 Player of the Match</h4>
                  <div style="font-size: 1.15rem; font-weight: bold; color: var(--text-primary);">{matchResultObj.playerOfTheMatch.name}</div>
                  <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">{matchResultObj.playerOfTheMatch.stats}</div>
                </div>
              {/if}
              
              {#if playerStatsUpdatesObj}
                <div class="xp-summary" style="background: var(--bg-surface); padding: 1.25rem; border-radius: 0; margin: 0 0 16px 0; text-align: left; max-height: 180px; overflow-y: auto; width: 100%; border: 1px solid var(--border-color); box-sizing: border-box;">
                  <h4 style="margin: 0 0 0.5rem 0; color: var(--color-success); font-family: 'Cinzel', serif;">✨ Experience Points Earned</h4>
                  <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
                    <thead>
                      <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">
                        <th style="text-align: left; padding: 4px; background: transparent;">Player</th>
                        <th style="text-align: right; padding: 4px; background: transparent;">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each (Object.entries(playerStatsUpdatesObj || {}) as [string, any][]).sort((a,b) => b[1].xp - a[1].xp) as [id, stats]}
                        {#if stats.xp > 0}
                          <tr style="border-bottom: 1px solid var(--border-color-light);">
                            <td style="padding: 6px 4px;">{matchTeam1?.players.find(p => p.id === id)?.name || matchTeam2?.players.find(p => p.id === id)?.name || 'Unknown'}</td>
                            <td style="text-align: right; padding: 6px 4px; color: var(--color-success); font-weight: bold;">+{stats.xp}</td>
                          </tr>
                        {/if}
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}

              {#if matchResultObj}
                <div class="match-rewards-panel" style="margin: 0 0 20px 0; width: 100%; box-sizing: border-box; background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.3);">
                  <h4 style="color: var(--color-success); font-family: 'Cinzel', serif; text-align: center; margin-top: 0;">💰 Match Rewards</h4>
                  <div class="rewards-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="reward-col" style="padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0;">
                      <h5 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">{getTeamName(innings1.teamId)}</h5>
                      <p style="margin: 4px 0; font-size: 0.8rem; display: flex; justify-content: space-between;"><span>Earnings</span><span class="money" style="color: var(--color-success); font-weight: bold;">+${matchResultObj.matchEarnings.team1.toLocaleString()}</span></p>
                      <p style="margin: 4px 0; font-size: 0.8rem; display: flex; justify-content: space-between;"><span>Sponsors</span><span class="money" style="color: var(--color-success); font-weight: bold;">+${matchResultObj.sponsorshipEarnings.team1.toLocaleString()}</span></p>
                    </div>
                    <div class="reward-col" style="padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 0;">
                      <h5 style="margin: 0 0 8px 0; font-size: 0.95rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">{getTeamName(innings2.teamId)}</h5>
                      <p style="margin: 4px 0; font-size: 0.8rem; display: flex; justify-content: space-between;"><span>Earnings</span><span class="money" style="color: var(--color-success); font-weight: bold;">+${matchResultObj.matchEarnings.team2.toLocaleString()}</span></p>
                      <p style="margin: 4px 0; font-size: 0.8rem; display: flex; justify-content: space-between;"><span>Sponsors</span><span class="money" style="color: var(--color-success); font-weight: bold;">+${matchResultObj.sponsorshipEarnings.team2.toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              {/if}

              <button class="btn-continue" onclick={handleGoHome} style="width: 100%; text-align: center;">Continue to Dashboard</button>
            </div>
          {/if}

        {:else}
          <!-- Scoreboard Card (Interactive Play Phases) -->
          <div class="scoreboard-card card-premium">
            <div class="matchup-header">
              <span class="team-name" style="color: {matchTeam1?.colorPrimary}">{matchTeam1?.name}</span>
              <span class="vs">vs</span>
              <span class="team-name" style="color: {matchTeam2?.colorPrimary}">{matchTeam2?.name}</span>
            </div>
            <div class="weather-pitch-bar">
              <span>{weatherEmojis[weather]} {weather}</span>
              <span class="dot-separator">•</span>
              <span>{pitchEmojis[pitch]} {pitch} pitch</span>
              {#if freeHitActive}
                <span class="dot-separator">•</span>
                <span class="free-hit-badge" style="color: #ef4444; font-weight: 800; animation: blink 1s infinite;">💥 FREE HIT</span>
              {/if}
            </div>
            <div class="score-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
              <div style="display: flex; align-items: baseline; gap: 12px;">
                <div class="runs-wickets">
                  <span class="runs">{currentInningsData.totalRuns}</span>
                  <span class="divider">/</span>
                  <span class="wickets">{currentInningsData.wickets}</span>
                </div>
                <div class="overs">
                  Overs: <span class="overs-val">{currentInningsData.overs}.{currentInningsData.balls % 6}</span>
                </div>
              </div>

              {#if currentInningsData.ballsFaced.length > 0}
                {@const recentBalls = currentInningsData.ballsFaced.slice(-12)}
                <div class="recent-balls-mini" style="display: flex; align-items: center; gap: 4px; margin: 0;">
                  {#each recentBalls as ball, idx}
                    {#if idx > 0 && ball.over !== recentBalls[idx - 1].over}
                      <div class="over-separator" style="width: 2px; height: 18px; background-color: var(--border-color); margin: 0 4px; align-self: center;"></div>
                    {/if}
                    <div class="bubble {ball.isWicket ? 'wicket' : ball.runs === 4 ? 'four' : ball.runs === 6 ? 'six' : ball.runs === 0 ? 'dot' : 'runs'}">
                      {ball.isWicket ? 'W' : ball.runs}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
            
            <div class="stats-row">
              <div class="stat-item">
                <span class="label">CRR</span>
                <span class="value">{runRate}</span>
              </div>
              {#if currentInnings === 2 && target}
                <div class="stat-item">
                  <span class="label">Target</span>
                  <span class="value">{target}</span>
                </div>
                <div class="stat-item equation">
                  <span>Need {target - currentInningsData.totalRuns} off {120 - currentInningsData.balls} balls</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Active Batsmen / Batsman Selection -->
          {#if currentBattingTeam?.id === 'user_team' && (phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman')}
            <div class="selection-card card-premium">
              <div class="panel-header" style="margin-bottom: 12px;">
                <h3 style="margin: 0; font-family: 'Cinzel', serif; font-size: 1.15rem; color: var(--color-accent);">
                  {phase === 'selectOpeningBatsmen' ? '🏏 Pick 2 Opening Batsmen' : '🏏 Pick Next Batsman'}
                </h3>
              </div>
              <div class="selection-table-container">
                <table class="selection-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Faction</th>
                      <th>Role</th>
                      <th>Style</th>
                      <th>Rating</th>
                      <th>Stamina</th>
                      <th>Confidence</th>
                      <th style="text-align: center;">Select</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each getAvailableBatsmen() as p}
                      {@const isSelected = selectedBatsmen.includes(p.id)}
                      <tr class:selected={isSelected} onclick={() => toggleBatsman(p.id)}>
                        <td>
                          <div class="player-cell" style="display: flex; align-items: center; gap: 8px;">
                            <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" />
                            <span class="player-name">{p.name}</span>
                          </div>
                        </td>
                        <td>
                          <span class="faction-icon faction-{p.faction}">
                            {p.faction === 'human' ? '⚔' : p.faction === 'elf' ? '🌿' : p.faction === 'orc' ? '🪓' : p.faction === 'dwarf' ? '⛏' : p.faction === 'goblin' ? '💎' : '🌙'}
                          </span>
                        </td>
                        <td>{p.role}</td>
                        <td>{p.battingType || 'RHB'} ({p.battingRole || 'Middle Order'})</td>
                        <td class="rating-val">{p.stats.batting}</td>
                        <td>
                          <div class="bar-container">
                            <div class="bar stamina" style="width: {100 - p.fatigue}%; background-color: {getBarColor(100 - p.fatigue)};"></div>
                          </div>
                        </td>
                        <td>
                          <div class="bar-container">
                            <div class="bar confidence" style="width: {p.morale}%; background-color: {getBarColor(p.morale)};"></div>
                          </div>
                        </td>
                        <td style="text-align: center;">
                          {#if phase === 'selectOpeningBatsmen'}
                            <input type="checkbox" checked={isSelected} onchange={(e) => { e.stopPropagation(); toggleBatsman(p.id); }} style="cursor: pointer;" />
                          {:else}
                            <button class="btn-select" onclick={(e) => { e.stopPropagation(); toggleBatsman(p.id); }}>Select</button>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#if phase === 'selectOpeningBatsmen'}
                <div class="confirm-bar">
                  <button class="btn-confirm-opening" disabled={selectedBatsmen.length !== 2} onclick={confirmOpeningBatsmen}>Confirm Openers</button>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Display Active Batsmen side-by-side -->
            <div class="active-batsmen-container">
              <div class="active-batsmen-grid">
                 {#each currentInningsData.currentBatsmen.filter(id => id) as batsmanId, i}
                   {@const p = currentBattingTeam?.players.find(x => x.id === batsmanId)}
                   {@const stats = getBatsmanStats(batsmanId)}
                   {@const intent = batsmanIntents[batsmanId] || 'balanced'}
                   {#if p}
                     <div class="batsman-card-new intent-{intent} {i === 0 ? 'on-strike' : ''}">
                        <div class="batsman-avatar-ring">
                          <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                          <div class="skill-badge-mini">{p.stats.batting}</div>
                        </div>
                        <div class="batsman-details">
                          <div class="name-row">
                            <span class="name">{p.name}</span>
                            {#if i === 0}<span class="striker-icon" title="On Strike">🏏</span>{/if}
                          </div>
                          <div class="style-text">{p.battingType || 'RHB'} • {p.battingRole || 'Batsman'}</div>
                          <div class="score-text">
                            <span class="runs-scored">{stats.runs}</span>
                            <span class="balls-faced">({stats.balls})</span>
                          </div>
                          <div class="bars-side-by-side">
                            <div class="bar-wrapper">
                              <div class="bar-header">
                                <span class="bar-title">Stam</span>
                              </div>
                              <div class="mini-bar-track">
                                <div class="mini-bar-fill stamina" style="width: {100 - p.fatigue}%; background-color: {getBarColor(100 - p.fatigue)};"></div>
                              </div>
                            </div>
                            <div class="bar-wrapper">
                              <div class="bar-header">
                                <span class="bar-title">Conf</span>
                              </div>
                              <div class="mini-bar-track">
                                <div class="mini-bar-fill confidence" style="width: {p.morale}%; background-color: {getBarColor(p.morale)};"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                     </div>
                   {/if}
                 {/each}
              </div>
            </div>
          {/if}

          <!-- Active Bowler / Bowler Selection -->
          {#if currentBowlingTeam?.id === 'user_team' && (phase === 'selectOpeningBowler' || phase === 'selectNextBowler')}
            <div class="selection-card card-premium">
              <div class="panel-header" style="margin-bottom: 12px;">
                <h3 style="margin: 0; font-family: 'Cinzel', serif; font-size: 1.15rem; color: var(--color-accent);">🎯 Select Bowler</h3>
              </div>
              <div class="selection-table-container">
                <table class="selection-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Faction</th>
                      <th>Role</th>
                      <th>Style</th>
                      <th>Rating</th>
                      <th>Stamina</th>
                      <th>Confidence</th>
                      <th style="text-align: center;">Select</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each getAvailableBowlers() as p}
                      <tr onclick={() => confirmBowler(p.id)}>
                        <td>
                          <div class="player-cell" style="display: flex; align-items: center; gap: 8px;">
                            <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" />
                            <span class="player-name">{p.name}</span>
                          </div>
                        </td>
                        <td>
                          <span class="faction-icon faction-{p.faction}">
                            {p.faction === 'human' ? '⚔' : p.faction === 'elf' ? '🌿' : p.faction === 'orc' ? '🪓' : p.faction === 'dwarf' ? '⛏' : p.faction === 'goblin' ? '💎' : '🌙'}
                          </span>
                        </td>
                        <td>{p.role}</td>
                        <td>{p.bowlingType || 'Fast'}</td>
                        <td class="rating-val">{p.stats.bowling}</td>
                        <td>
                          <div class="bar-container">
                            <div class="bar stamina" style="width: {100 - p.fatigue}%; background-color: {getBarColor(100 - p.fatigue)};"></div>
                          </div>
                        </td>
                        <td>
                          <div class="bar-container">
                            <div class="bar confidence" style="width: {p.morale}%; background-color: {getBarColor(p.morale)};"></div>
                          </div>
                        </td>
                        <td style="text-align: center;">
                          <button class="btn-select">Select</button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <!-- Display Active Bowler Card -->
            {@const bowlerId = currentLiveBowlerId}
            {@const p = currentBowlingTeam?.players.find(x => x.id === bowlerId)}
            {@const stats = p ? getBowlerStats(p.id) : null}
            {@const intent = bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}
            <div class="active-bowler-container">
              {#if p && stats}
                <div class="bowler-card-new intent-{intent}">
                  <div class="bowler-avatar-ring">
                    <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                    <div class="skill-badge-mini">{p.stats.bowling}</div>
                  </div>
                  <div class="bowler-details">
                    <div class="name-row">
                      <span class="name">{p.name}</span>
                    </div>
                    <div class="style-text">{p.bowlingType || 'Fast'} • {p.role}</div>
                    <div class="score-text">
                      Figures: <span class="figures">{stats.wickets}-{stats.runs}</span>
                      <span class="overs-bowled">({stats.overs} ov)</span>
                    </div>
                    <div class="confidence-bar-wrapper">
                      <div class="bar-header">
                        <span class="bar-title">Confidence</span>
                      </div>
                      <div class="bar-track">
                        <div class="bar-fill confidence" style="width: {p.morale}%; background-color: {getBarColor(p.morale)};"></div>
                      </div>
                    </div>
                  </div>
                  <div class="bowler-right-stamina">
                    <div class="stamina-vertical-wrapper">
                      <div class="vertical-bar-track">
                        <div class="vertical-bar-fill stamina" style="height: {100 - p.fatigue}%; background-color: {getBarColor(100 - p.fatigue)};"></div>
                      </div>
                      <span class="stamina-label">STAMINA</span>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Sim Actions dock -->
          <div class="sim-actions-panel card-premium">
            <div class="actions-group">
              <button class="btn-play-pause {phase === 'playing' ? 'playing' : ''}" onclick={togglePause}>
                {phase === 'playing' ? '⏸ PAUSE' : '▶ PLAY'}
              </button>
              <button class="btn-step" onclick={playSingleBallAction} disabled={phase !== 'paused'}>
                +1 BALL
              </button>
            </div>
            <div class="speed-group">
              <span class="label">SPEED</span>
              <div class="speed-buttons">
                <button class="btn-speed {gameSpeed === 'ball' ? 'active' : ''}" onclick={() => handleSpeedChange('ball')}>1x</button>
                <button class="btn-speed {gameSpeed === 'over' ? 'active' : ''}" onclick={() => handleSpeedChange('over')}>Over</button>
                <button class="btn-speed {gameSpeed === 'instant' ? 'active' : ''}" onclick={() => handleSpeedChange('instant')}>Max</button>
              </div>
            </div>
            <div class="targets-group">
              <span class="label">SIM TO</span>
              <div class="target-buttons">
                <button class="btn-target" onclick={() => handleSimulateTarget({type: 'over'})}>OVER</button>
                <button class="btn-target" onclick={() => handleSimulateTarget({type: 'wicket'})}>WICKET</button>
                <button class="btn-target" onclick={() => handleSimulateTarget({type: 'innings'})}>INNINGS</button>
              </div>
            </div>
          </div>
        {/if}

      </div> <!-- End Left Column -->

      <!-- Right Column -->
      <div class="match-right-column">
        
        <!-- Intent Controls (Strategy Panel) -->
        <div class="intent-controls-panel card-premium">
          <div class="panel-header">
            <h3>⚡ Strategy & Intent</h3>
          </div>
          
          <!-- Batting Intent -->
          <div class="intent-section">
            <div class="intent-header">
              <span>🏏 Batting Intent</span>
              {#if currentBattingTeam?.id !== 'user_team'}
                <span class="ai-label">AI Managed</span>
              {/if}
            </div>

            {#if currentBattingTeam?.id === 'user_team'}
              {#each currentInningsData.currentBatsmen.filter(id => id) as batsmanId, i}
                {@const p = currentBattingTeam.players.find(x => x.id === batsmanId)}
                {#if p}
                  <div class="batsman-intent-row" style={i > 0 ? "margin-top: 10px; border-top: 1px dashed var(--border-color); padding-top: 10px;" : ""}>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                      <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-color); object-fit: cover;" />
                      <span class="active-player-name" style="font-weight: 700; font-size: 0.8rem; color: var(--color-accent);">
                        {p.name} {i === 0 ? '🏏 (Striker)' : '(Non-Striker)'}
                      </span>
                    </div>
                    <div class="intent-progressbar-container">
                      <button 
                        class="btn-intent-adjust" 
                        disabled={getIntentIndex(batsmanIntents[batsmanId] || 'balanced') === 0} 
                        onclick={() => changeBatsmanIntent(batsmanId, -1)}>
                        ➖
                      </button>
                      
                      <div class="intent-progressbar">
                        {#each INTENT_LEVELS as level, idx}
                          {@const currentIntent = batsmanIntents[batsmanId] || 'balanced'}
                          {@const currentIdx = getIntentIndex(currentIntent)}
                          {@const isActive = currentIdx === idx}
                          {@const isFilled = idx <= currentIdx}
                          <button 
                            class="intent-bar-segment segment-{level}" 
                            class:active={isActive}
                            class:filled={isFilled}
                            title={level === 'very_defensive' ? 'Block' : level === 'very_aggressive' ? 'Slog' : INTENT_LABELS[level]}
                            onclick={() => {
                              batsmanIntents[batsmanId] = level;
                            }}>
                          </button>
                        {/each}
                      </div>
                      
                      <button 
                        class="btn-intent-adjust" 
                        disabled={getIntentIndex(batsmanIntents[batsmanId] || 'balanced') === INTENT_LEVELS.length - 1} 
                        onclick={() => changeBatsmanIntent(batsmanId, 1)}>
                        ➕
                      </button>
                    </div>

                    <div class="intent-label-display">
                      <span class="active-intent-name {batsmanIntents[batsmanId] || 'balanced'}">
                        {getBatsmanIntentLabel(batsmanIntents[batsmanId] || 'balanced')}
                      </span>
                    </div>
                  </div>
                {/if}
              {/each}
            {:else}
              <div class="intent-progressbar-container disabled">
                <button class="btn-intent-adjust" disabled>➖</button>
                <div class="intent-progressbar">
                  {#each INTENT_LEVELS as level}
                    <div class="intent-bar-segment segment-{level} disabled"></div>
                  {/each}
                </div>
                <button class="btn-intent-adjust" disabled>➕</button>
              </div>
              <div class="intent-label-display">
                <span class="active-intent-name text-muted">AI Managed</span>
              </div>
            {/if}
          </div>

          <!-- Bowling Intent -->
          <div class="intent-section">
            <div class="intent-header">
              <span>🎯 Bowling Intent</span>
              {#if currentBowlingTeam?.id !== 'user_team'}
                <span class="ai-label">AI Managed</span>
              {/if}
            </div>

            {#if currentBowlingTeam?.id === 'user_team'}
              {@const bowlerId = currentLiveBowlerId}
              {@const activeBowler = currentBowlingTeam.players.find(p => p.id === bowlerId)}
              {#if activeBowler}
                <div class="bowler-intent-row" style="margin-top: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <img src={getAvatarUrl(activeBowler.faction, activeBowler.portraitId || 1)} alt={activeBowler.name} class="player-avatar-mini" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-color); object-fit: cover;" />
                    <span class="active-player-name" style="font-weight: 700; font-size: 0.8rem; color: var(--color-accent);">{activeBowler.name}</span>
                  </div>
                  <div class="intent-progressbar-container">
                    <button 
                      class="btn-intent-adjust" 
                      disabled={getIntentIndex(bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced') === 0} 
                      onclick={() => bowlerId && changeBowlerIntent(bowlerId, -1)}>
                      ➖
                    </button>
                    
                    <div class="intent-progressbar">
                      {#each INTENT_LEVELS as level, idx}
                        {@const currentIntent = bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}
                        {@const currentIdx = getIntentIndex(currentIntent)}
                        {@const isActive = currentIdx === idx}
                        {@const isFilled = idx <= currentIdx}
                        <button 
                          class="intent-bar-segment segment-{level}" 
                          class:active={isActive}
                          class:filled={isFilled}
                          title={level === 'very_defensive' ? 'Ultra Def' : level === 'very_aggressive' ? 'Ultra Att' : INTENT_LABELS[level]}
                          onclick={() => {
                            if (bowlerId) bowlerIntents[bowlerId] = level;
                          }}>
                        </button>
                      {/each}
                    </div>
                    
                    <button 
                      class="btn-intent-adjust" 
                      disabled={getIntentIndex(bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced') === INTENT_LEVELS.length - 1} 
                      onclick={() => bowlerId && changeBowlerIntent(bowlerId, 1)}>
                      ➕
                    </button>
                  </div>
                  
                  <div class="intent-label-display">
                    <span class="active-intent-name {bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}">
                      {getBowlerIntentLabel(bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced')}
                    </span>
                  </div>
                </div>
              {:else}
                <span class="active-player-name text-muted" style="font-size: 0.8rem; display: block; margin-top: 8px;">Select Bowler</span>
              {/if}
            {:else}
              <div class="intent-progressbar-container disabled">
                <button class="btn-intent-adjust" disabled>➖</button>
                <div class="intent-progressbar">
                  {#each INTENT_LEVELS as level}
                    <div class="intent-bar-segment segment-{level} disabled"></div>
                  {/each}
                </div>
                <button class="btn-intent-adjust" disabled>➕</button>
              </div>
              <div class="intent-label-display">
                <span class="active-intent-name text-muted">AI Managed</span>
              </div>
            {/if}
          </div>
          
          {#if userTeam && userTeam.reservePlayer && !impactUsed && (phase === 'paused' || phase === 'ready' || phase === 'selectNextBowler' || phase === 'selectNextBatsman' || phase === 'inningBreak')}
            {@const reserveObj = userTeam.players.find(p => p.id === userTeam.reservePlayer)}
            {#if reserveObj}
              <div class="impact-sub-dock" style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                <span class="sub-title" style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 6px;">⚡ Nominated Impact Sub</span>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <img src={getAvatarUrl(reserveObj.faction, reserveObj.portraitId || 1)} alt={reserveObj.name} style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-color);" />
                    <span style="font-size: 0.78rem; font-weight: bold; color: var(--color-accent);">{reserveObj.name} ({reserveObj.role})</span>
                  </div>
                  <button class="btn-activate-impact" onclick={() => showImpactSelector = true} style="background: var(--color-accent); color: white; border: none; padding: 4px 8px; font-size: 0.72rem; font-weight: bold; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                    Activate Sub
                  </button>
                </div>
              </div>
            {/if}
          {/if}
        </div>

        <!-- Live Commentary Console -->
        <div class="commentary-panel-new card-premium">
          <div class="commentary-header">
            <span>🎙️ Live Commentary Feed</span>
          </div>
          <div class="commentary-content">
            <BallFeed events={currentInningsData.ballsFaced} />
          </div>
        </div>

      </div> <!-- End Right Column -->
    </div> <!-- End match-dashboard -->

    {#if showImpactSelector && userTeam && userTeam.reservePlayer}
      {@const reserveObj = userTeam.players.find(p => p.id === userTeam.reservePlayer)}
      <div class="impact-selector-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1100;">
        <div class="modal-content" style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 20px; border-radius: 8px; max-width: 400px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
          <h3 style="margin-top: 0; font-family: 'Cinzel', serif; color: var(--color-accent); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">⚡ Select Player to Replace</h3>
          <p style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.4;">Choose which starting player <strong>{reserveObj?.name}</strong> will replace. The replaced player cannot take any further part in the match.</p>
          
          <div class="players-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; margin-bottom: 16px; border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.15);">
            {#each playing11Players as p}
              <button 
                onclick={() => {
                  activateImpactPlayer(p.id);
                  showImpactSelector = false;
                }}
                style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 12px; font-size: 0.78rem; text-align: left; cursor: pointer; border-radius: 4px; transition: all 0.2s; width: 100%;"
                onmouseover={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onmouseout={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <span>{p.name} ({p.role})</span>
                <span style="font-size: 0.7rem; color: var(--color-accent); font-weight: bold;">Replace 🔄</span>
              </button>
            {/each}
          </div>
          
          <button onclick={() => showImpactSelector = false} style="width: 100%; background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: all 0.2s;">
            Cancel
          </button>
        </div>
      </div>
    {/if}

    <!-- Full scorecard aligned at the bottom -->
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
  /* Premium Dashboard Grid Layout */
  .match-dashboard {
    display: grid;
    grid-template-columns: 7.2fr 4.8fr;
    gap: 20px;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    box-sizing: border-box;
    align-items: stretch;
  }
  
  @media (max-width: 1024px) {
    .match-dashboard {
      grid-template-columns: 1fr;
    }
  }

  .match-left-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  
  .match-right-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  
  /* Premium Cards */
  .card-premium {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%), var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    box-sizing: border-box;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  :global([data-theme="light"]) .card-premium {
    background: #ffffff;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
    border: 1px solid rgba(15, 23, 42, 0.08);
  }
  
  /* Scoreboard Card */
  .scoreboard-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .scoreboard-card .matchup-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    font-family: var(--font-sports);
    font-size: 1.4rem;
    font-weight: 800;
  }
  
  .scoreboard-card .matchup-header .vs {
    font-size: 0.95rem;
    color: var(--text-muted);
    font-weight: normal;
  }
  
  .scoreboard-card .weather-pitch-bar {
    display: flex;
    justify-content: center;
    gap: 12px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  
  .scoreboard-card .weather-pitch-bar .dot-separator {
    opacity: 0.5;
  }
  
  .scoreboard-card .score-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 4px;
  }
  
  .scoreboard-card .runs-wickets {
    font-size: 2.5rem;
    font-weight: 800;
    font-family: var(--font-sports);
    letter-spacing: -1px;
    line-height: 1;
  }
  
  .scoreboard-card .runs-wickets .wickets {
    color: var(--color-danger);
  }
  
  .scoreboard-card .overs {
    font-size: 1.1rem;
    color: var(--text-secondary);
    font-weight: 600;
  }
  
  .scoreboard-card .stats-row {
    display: flex;
    gap: 20px;
    font-size: 0.95rem;
    color: var(--text-secondary);
    border-top: 1px solid var(--border-color);
    padding-top: 12px;
    margin-top: 4px;
    align-items: center;
  }
  
  .scoreboard-card .stat-item {
    display: flex;
    gap: 6px;
  }
  
  .scoreboard-card .stat-item .label {
    color: var(--text-muted);
    font-weight: 500;
  }
  
  .scoreboard-card .stat-item .value {
    font-weight: bold;
    color: var(--text-primary);
  }
  
  .scoreboard-card .stat-item.equation {
    margin-left: auto;
    font-weight: bold;
    color: var(--color-accent);
  }
  
  /* Active Batsmen */
  .active-batsmen-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  
  @media (max-width: 640px) {
    .active-batsmen-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .batsman-card-new, .bowler-card-new {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0;
    padding: 10px;
    display: flex;
    gap: 10px;
    align-items: center;
    position: relative;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
  }
  
  :global([data-theme="light"]) .batsman-card-new,
  :global([data-theme="light"]) .bowler-card-new {
    background: #ffffff;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
    border: 1px solid rgba(15, 23, 42, 0.08);
  }
  
  .batsman-card-new.intent-defensive { border-color: #3b82f6; box-shadow: 0 0 10px rgba(59,130,246,0.15); }
  .batsman-card-new.intent-balanced { border-color: #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,0.15); }
  .batsman-card-new.intent-aggressive { border-color: #22c55e; box-shadow: 0 0 10px rgba(34,197,94,0.15); }
  .batsman-card-new.intent-very_aggressive { border-color: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,0.15); }

  .bowler-card-new.intent-defensive { border-color: #3b82f6; box-shadow: 0 0 10px rgba(59,130,246,0.15); }
  .bowler-card-new.intent-balanced { border-color: #fbbf24; box-shadow: 0 0 10px rgba(251,191,36,0.15); }
  .bowler-card-new.intent-aggressive { border-color: #22c55e; box-shadow: 0 0 10px rgba(34,197,94,0.15); }
  
  /* Highlighting striker */
  .batsman-card-new.on-strike {
    border: 2px solid var(--color-accent) !important;
    box-shadow: 0 0 16px rgba(234, 179, 8, 0.35) !important;
  }
  
  .batsman-avatar-ring, .bowler-avatar-ring {
    position: relative;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    overflow: visible;
    flex-shrink: 0;
  }
  
  .batsman-avatar-ring img, .bowler-avatar-ring img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .skill-badge-mini {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 1.5px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
    color: var(--text-primary);
  }
  
  .batsman-details, .bowler-details {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  
  .batsman-details .name-row, .bowler-details .name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .batsman-details .name, .bowler-details .name {
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .batsman-details .striker-icon {
    font-size: 1rem;
    animation: bounce 1.5s infinite;
  }
  
  .style-text {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  
  .score-text {
    font-family: var(--font-sports);
    font-size: 1.12rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .score-text .balls-faced {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: normal;
    font-family: sans-serif;
  }
  
  /* Side-by-side Progress Bars inside Batsman Card */
  .bars-side-by-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 4px;
  }
  
  .bar-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .bar-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    font-weight: bold;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  
  .mini-bar-track {
    height: 5px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .mini-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  
  .mini-bar-fill.stamina {
    background: #3b82f6;
  }
  
  .mini-bar-fill.confidence {
    background: #a855f7;
  }
  
  /* Bowler Card with Stamina on the right */
  .bowler-card-new {
    width: 100%;
    box-sizing: border-box;
  }
  
  .bowler-card-new .score-text .figures {
    color: var(--color-bowling);
  }
  
  .bowler-card-new .score-text .overs-bowled {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: normal;
    font-family: sans-serif;
  }
  
  .confidence-bar-wrapper {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .confidence-bar-wrapper .bar-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    font-weight: bold;
    color: var(--text-muted);
  }

  .confidence-bar-wrapper .bar-track {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .confidence-bar-wrapper .bar-fill {
    height: 100%;
    background: #a855f7;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  
  .bowler-right-stamina {
    display: flex;
    align-items: center;
    border-left: 1px solid var(--border-color);
    padding-left: 10px;
    height: 55px;
    margin-left: 6px;
    flex-shrink: 0;
  }
  
  .stamina-vertical-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .stamina-vertical-wrapper .stamina-percent {
    font-size: 0.75rem;
    font-weight: 700;
    color: #3b82f6;
  }
  
  .stamina-vertical-wrapper .vertical-bar-track {
    width: 8px;
    height: 30px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  
  .stamina-vertical-wrapper .vertical-bar-fill {
    width: 100%;
    background: #3b82f6;
    border-radius: 4px;
    position: absolute;
    bottom: 0;
    transition: height 0.3s ease;
  }
  
  .stamina-vertical-wrapper .stamina-label {
    font-size: 0.55rem;
    font-weight: 800;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }
  
  /* Simulator controls panel */
  .sim-actions-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .sim-actions-panel .actions-group {
    display: flex;
    gap: 12px;
  }
  
  .sim-actions-panel .btn-play-pause {
    flex-grow: 2;
    background: var(--color-accent);
    color: var(--bg-primary);
    font-size: 0.95rem;
    font-weight: 800;
    padding: 10px 16px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .sim-actions-panel .btn-play-pause.playing {
    background: var(--color-danger);
    color: white;
  }
  
  .sim-actions-panel .btn-play-pause:hover {
    transform: translateY(-1px);
    opacity: 0.95;
  }
  
  .sim-actions-panel .btn-step {
    flex-grow: 1;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 10px 14px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }
  
  .sim-actions-panel .btn-step:hover:not(:disabled) {
    background: var(--border-color);
  }
  
  .sim-actions-panel .btn-step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .sim-actions-panel .speed-group, .sim-actions-panel .targets-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--border-color);
    padding-top: 10px;
  }
  
  .sim-actions-panel .label {
    font-size: 0.75rem;
    font-weight: bold;
    color: var(--text-muted);
    letter-spacing: 0.5px;
  }
  
  .sim-actions-panel .speed-buttons, .sim-actions-panel .target-buttons {
    display: flex;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .sim-actions-panel .btn-speed, .sim-actions-panel .btn-target {
    background: transparent;
    border: none;
    border-right: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: bold;
    padding: 6px 14px;
    transition: all 0.2s;
    cursor: pointer;
  }
  
  .sim-actions-panel .btn-speed:last-child, .sim-actions-panel .btn-target:last-child {
    border-right: none;
  }
  
  .sim-actions-panel .btn-speed:hover, .sim-actions-panel .btn-target:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.03);
  }
  
  .sim-actions-panel .btn-speed.active {
    background: var(--color-bowling);
    color: white;
  }
  
  /* Intent Controls Panel */
  .intent-controls-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .intent-controls-panel .panel-header h3 {
    margin: 0;
    font-size: 1.15rem;
    font-family: var(--font-fantasy) !important;
    color: var(--color-accent);
  }
  
  .intent-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(0, 0, 0, 0.15);
    padding: 12px;
    border-radius: 0;
    border: 1px solid var(--border-color);
  }
  
  :global([data-theme="light"]) .intent-section {
    background: rgba(15, 23, 42, 0.02);
  }
  
  .intent-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    font-weight: bold;
    color: var(--text-secondary);
  }
  
  .intent-header .active-player-name {
    color: var(--color-accent);
    font-size: 0.85rem;
  }
  
  .intent-header .ai-label {
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  
  :global([data-theme="light"]) .intent-header .ai-label {
    background: rgba(15, 23, 42, 0.05);
  }
  
  .intent-progressbar-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
    background: rgba(0, 0, 0, 0.2);
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  :global([data-theme="light"]) .intent-progressbar-container {
    background: rgba(15, 23, 42, 0.04);
  }
  
  .intent-progressbar-container.disabled {
    opacity: 0.6;
  }
  
  .btn-intent-adjust {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 10px;
    transition: all 0.2s;
    user-select: none;
    padding: 0;
  }
  
  .btn-intent-adjust:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: var(--text-secondary);
    transform: scale(1.08);
  }
  
  .btn-intent-adjust:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .intent-progressbar {
    display: flex;
    flex: 1;
    gap: 6px;
    height: 12px;
    align-items: center;
  }
  
  .intent-bar-segment {
    flex: 1;
    height: 100%;
    border-radius: 3px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    padding: 0;
  }

  :global([data-theme="light"]) .intent-bar-segment {
    background: rgba(15, 23, 42, 0.08);
  }
  
  .intent-bar-segment.disabled {
    cursor: not-allowed;
  }
  
  /* Color-coded segments when filled/active */
  .intent-bar-segment.segment-very_defensive.filled {
    background: #6366f1;
    box-shadow: 0 0 6px rgba(99, 102, 241, 0.3);
  }
  .intent-bar-segment.segment-defensive.filled {
    background: #3b82f6;
    box-shadow: 0 0 6px rgba(59, 130, 246, 0.3);
  }
  .intent-bar-segment.segment-balanced.filled {
    background: #fbbf24;
    box-shadow: 0 0 6px rgba(251, 191, 36, 0.3);
  }
  .intent-bar-segment.segment-aggressive.filled {
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34, 197, 94, 0.3);
  }
  .intent-bar-segment.segment-very_aggressive.filled {
    background: #ef4444;
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.3);
  }
  
  /* Make the active segment shine brighter */
  .intent-bar-segment.active {
    transform: scaleY(1.3);
    border: 1px solid rgba(255, 255, 255, 0.4);
  }

  :global([data-theme="light"]) .intent-bar-segment.active {
    border-color: rgba(15, 23, 42, 0.4);
  }
  
  .intent-label-display {
    text-align: center;
    margin-top: 6px;
    font-size: 0.72rem;
    font-weight: 700;
  }
  
  .active-intent-name {
    padding: 2px 8px;
    border-radius: 12px;
    display: inline-block;
  }
  
  .active-intent-name.very_defensive { color: #818cf8; background: rgba(99, 102, 241, 0.1); }
  .active-intent-name.defensive { color: #60a5fa; background: rgba(59, 130, 246, 0.1); }
  .active-intent-name.balanced { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
  .active-intent-name.aggressive { color: #34d399; background: rgba(34, 197, 94, 0.1); }
  .active-intent-name.very_aggressive { color: #f87171; background: rgba(239, 68, 68, 0.1); }
  
  /* Commentary Feed Screen Adaptations */
  .commentary-panel-new {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
    min-height: 400px;
    padding: 0;
  }
  
  .commentary-panel-new .commentary-header {
    background: rgba(0, 0, 0, 0.15);
    padding: 14px 20px;
    font-weight: bold;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  
  :global([data-theme="light"]) .commentary-panel-new .commentary-header {
    background: rgba(15, 23, 42, 0.02);
  }
  
  .commentary-panel-new .commentary-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    background: var(--bg-primary);
  }
  
  :global([data-theme="light"]) .commentary-panel-new .commentary-content {
    background: #fafafb;
  }

  /* Full Scorecard Adaptation */
  .full-width-scorecard-container {
    width: 100%;
    margin-top: 24px;
    border-top: 1px solid var(--border-color);
    padding-top: 24px;
  }
  
  /* Premium Table Selection Layout */
  .selection-table-container {
    width: 100%;
    overflow-x: auto;
    margin: 12px 0;
    border: 1px solid var(--border-color);
    border-radius: 0;
    background: rgba(0, 0, 0, 0.1);
  }
  
  :global([data-theme="light"]) .selection-table-container {
    background: rgba(15, 23, 42, 0.01);
  }
  
  .selection-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    color: var(--text-primary);
    text-align: left;
  }
  
  .selection-table th {
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.2);
    font-weight: 700;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    font-size: 0.72rem;
    letter-spacing: 0.5px;
    text-align: center;
  }
  
  :global([data-theme="light"]) .selection-table th {
    background: rgba(15, 23, 42, 0.03);
  }
  
  .selection-table td {
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
    text-align: center;
  }
  
  :global([data-theme="light"]) .selection-table td {
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  }

  .selection-table th:first-child,
  .selection-table td:first-child {
    text-align: left;
  }
  
  .selection-table tbody tr {
    cursor: pointer;
    transition: background 0.15s ease;
  }
  
  .selection-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }
  
  :global([data-theme="light"]) .selection-table tbody tr:hover {
    background: rgba(15, 23, 42, 0.02);
  }
  
  .selection-table tbody tr.selected {
    background: rgba(234, 179, 8, 0.15) !important;
  }
  
  :global([data-theme="light"]) .selection-table tbody tr.selected {
    background: rgba(234, 179, 8, 0.08) !important;
  }
  
  .selection-table td .player-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .selection-table .player-avatar-mini {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    object-fit: cover;
  }
  
  .selection-table .player-name {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .selection-table .faction-cell .faction-icon {
    margin: 0;
  }
  
  .selection-table .rating-val {
    font-family: var(--font-sports);
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-accent);
  }
  
  .selection-table .bar-container {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 50px;
    text-align: left;
  }
  
  .selection-table .bar-container .bar {
    height: 6px;
    border-radius: 3px;
    flex-grow: 1;
    background: var(--bg-tertiary);
  }
  
  .selection-table .bar-container .bar.stamina {
    background: #3b82f6;
  }
  
  .selection-table .bar-container .bar.confidence {
    background: #a855f7;
  }
  
  .selection-table .bar-lbl {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-weight: bold;
    min-width: 32px;
    text-align: right;
  }
  
  .btn-select {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .selection-table tr:hover .btn-select {
    background: var(--color-bowling);
    color: white;
    border-color: var(--color-bowling);
  }
  
  .confirm-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
  
  .btn-confirm-opening {
    background: linear-gradient(135deg, var(--color-batting), var(--color-batting-dark));
    color: white;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    cursor: pointer;
  }
  
  .btn-confirm-opening:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
  
  /* Additional layout alignments */
  .matchup-only {
    padding: 16px;
  }
  
  .lineup-grid-mini {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    margin-top: 12px;
  }
  
  .lineup-player-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0;
    padding: 8px;
  }
  
  .lineup-player-badge .avatar-mini {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .lineup-player-badge .player-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  
  .lineup-player-badge .player-meta .name {
    font-size: 0.8rem;
    font-weight: bold;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .lineup-player-badge .player-meta .role {
    font-size: 0.65rem;
    color: var(--text-muted);
  }
  
  .btn-start-match {
    background: linear-gradient(135deg, var(--color-batting), var(--color-batting-dark));
    color: white;
    font-weight: 800;
    font-size: 1.1rem;
    padding: 14px 28px;
    border-radius: 10px;
    transition: transform 0.2s;
    box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
    cursor: pointer;
  }
  
  .btn-start-match:hover {
    transform: translateY(-2px);
  }
  
  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 30px;
  }
  
  .ready-state .start-actions {
    margin-top: 16px;
  }
  
  .break-state .target-text {
    font-size: 1.15rem;
    color: var(--text-secondary);
  }
  
  .break-state .target-text strong {
    color: var(--color-accent);
    font-size: 1.4rem;
  }
  
  .complete-state .final-score {
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .btn-continue {
    background: var(--color-bowling);
    color: white;
    font-weight: 700;
    padding: 12px 24px;
    border-radius: 8px;
    transition: background 0.2s;
    cursor: pointer;
  }
  
  .btn-continue:hover {
    background: var(--color-bowling-dark);
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  /* Base Variables & Theming */
  .match-page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 80px);
    background-color: var(--bg-primary);
    background-image: linear-gradient(180deg, var(--bg-primary-gradient-start) 0%, var(--bg-primary) 100%);
    position: relative;
    overflow: hidden;
  }
  
  .match-page-wrapper::before {
    display: none;
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
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 40px;
    border-radius: 0;
    text-align: center;
    max-width: 500px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
  
  .message-card h2 { font-size: 1.5rem; margin-bottom: 16px; color: var(--text-primary); }
  .message-card p { color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }
  .message-card.error h2 { color: var(--color-danger); }

  .toss-card {
    background: linear-gradient(145deg, var(--bg-secondary), var(--bg-primary));
    border: 1px solid var(--border-color);
    padding: 40px;
    border-radius: 0;
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
    border-radius: 0;
    margin-bottom: 30px;
    border: 1px solid var(--border-color);
  }

  .condition { display: flex; align-items: center; gap: 15px; }
  .condition .emoji { font-size: 2.5rem; }
  .condition .details { display: flex; flex-direction: column; text-align: left; }
  .condition .value { font-weight: 700; font-size: 1.1rem; text-transform: capitalize; }
  .condition .label { font-size: 0.8rem; color: var(--text-muted); }
  .conditions-panel .divider { width: 1px; height: 50px; background: var(--border-color); }

  .toss-prompt { font-size: 1.2rem; color: var(--text-secondary); margin-bottom: 20px; }
  .toss-actions { display: flex; gap: 16px; justify-content: center; }

  .btn-primary { background: var(--color-bowling, #3b82f6); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; transition: background 0.2s; text-decoration: none; display: inline-block; cursor: pointer; }
  .btn-primary:hover { opacity: 0.95; }
  .btn-primary.large { padding: 14px 28px; font-size: 1rem; }
  
  .btn-bat { background: #22c55e; color: white; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4); cursor: pointer; }
  .btn-bat:hover { transform: translateY(-2px); opacity: 0.95; }
  
  .btn-bowl { background: #ef4444; color: white; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4); cursor: pointer; }
  .btn-bowl:hover { transform: translateY(-2px); opacity: 0.95; }

  /* Bubble stats */
  .bubble {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1rem;
    color: white;
    background: var(--bg-tertiary);
    border: 2px solid var(--border-color);
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .bubble.dot {
    background: #64748b;
    border-color: rgba(255,255,255,0.2);
  }
  .bubble.runs {
    background: #3b82f6;
    border-color: #2563eb;
  }
  .bubble.four {
    background: #22c55e;
    border-color: #16a34a;
  }
  .bubble.six {
    background: #a855f7;
    border-color: #9333ea;
  }
  .bubble.wicket {
    background: #ef4444;
    border-color: #dc2626;
  }

  .recent-balls-mini {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  /* Overs Progress Track */
  .overs-progress-track {
    width: 100%;
    max-width: 240px;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    margin: 8px auto;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .overs-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #0284c7, #06b6d4);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* Factions details */
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
  .faction-human { border-color: #0969da; box-shadow: 0 0 5px rgba(9, 105, 218, 0.4); }
  .faction-elf { border-color: #1a7f37; box-shadow: 0 0 5px rgba(26, 127, 55, 0.4); }
  .faction-orc { border-color: #cf222e; box-shadow: 0 0 5px rgba(207, 34, 46, 0.4); }
  .faction-dwarf { border-color: #9a6700; box-shadow: 0 0 5px rgba(154, 103, 0, 0.4); }
  .faction-goblin { border-color: #8250df; box-shadow: 0 0 5px rgba(130, 80, 223, 0.4); }
  .faction-nightelf { border-color: #0598bc; box-shadow: 0 0 5px rgba(5, 152, 188, 0.4); }

  /* Wicket animations */
  .impact-animation-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: none;
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
  .impact-animation-overlay.wicket .impact-graphic { color: #ef4444; text-shadow: 0 0 20px rgba(239, 68, 68, 0.8); }
  .impact-animation-overlay.four .impact-graphic { color: #fbbf24; text-shadow: 0 0 20px rgba(251, 191, 36, 0.8); }
  .impact-animation-overlay.six .impact-graphic { color: #22c55e; text-shadow: 0 0 20px rgba(34, 197, 94, 0.8); }

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

  /* Floating suggestions tips */
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
  }

  .suggestion-content {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 0;
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

  /* Light Theme Dashboard Specific Colors overrides */
  :global([data-theme="light"]) .sim-actions-panel .btn-step {
    background: #f1f5f9;
  }
  :global([data-theme="light"]) .sim-actions-panel .speed-buttons, 
  :global([data-theme="light"]) .sim-actions-panel .target-buttons {
    background: #f8fafc;
  }
  :global([data-theme="light"]) .btn-intent {
    background: #f8fafc;
  }
  :global([data-theme="light"]) .btn-intent:hover:not(:disabled) {
    background: #e2e8f0;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
</style>