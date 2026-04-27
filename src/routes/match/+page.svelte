<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { teamStore, scheduleStore } from '$lib/stores/gameState';
  import { resolveBall, updateFatigueAndMorale, calculateRunRate, resolveMatch } from '$lib/core/matchEngine';
  import type { Player } from '$lib/models/player';
  import type { Team } from '$lib/models/team';
  import type { innings, IntentType } from '$lib/models/match';
  import type { ScheduledMatch, TournamentSchedule } from '$lib/core/schedule';
  import MatchControls, { type SimSpeed } from '$lib/components/match/MatchControls.svelte';
  import BallFeed from '$lib/components/match/BallFeed.svelte';
  import Scoreboard from '$lib/components/match/Scoreboard.svelte';
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
  let currentBowlerIndex = $state(0);
  let ballInterval: any = null;
  
  let gameSpeed: SimSpeed = $state('ball');
  let isComplete = $state(false);
  let battingIntent: IntentType = $state('balanced');
  let bowlingIntent: IntentType = $state('balanced');
  let avoidSingles = $state(false);  
  let noMatchAvailable = $state(false);
  let autoResume = $state(false);

  let selectedBatsmen = $state<string[]>([]);
  let selectedBowlerId = $state<string | null>(null);
  let pendingBowlerSelection = $state(false);
  let placeholderBatsman = $state<string | null>(null);
  
  function createEmptyInnings(): innings {
    return {
      teamId: '', totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0,
      ballsFaced: [], battingOrder: [], currentBatsmen: ['', '']
    };
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
  
  onMount(() => {
    const unsubTeam = teamStore.subscribe(t => teams = t);
    const unsubSchedule = scheduleStore.subscribe(s => {
      schedule = s;
      if (s && teams.length >= 2 && phase === 'loading') {
        const userMatch = s.matches.find(m => 
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
          weather = getRandomWeather();
          pitch = getRandomPitch();
          phase = 'toss';
        } else {
          noMatchAvailable = true;
        }
      }
    });
    
    return () => { unsubTeam(); unsubSchedule(); };
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

  function chooseToBat() {
    if (!matchTeam1 || !matchTeam2) return;
    const userIsTeam1 = matchTeam1.id === 'user_team';
    const userTeamObj = userIsTeam1 ? matchTeam1 : matchTeam2;
    const aiTeamObj = userIsTeam1 ? matchTeam2 : matchTeam1;

    const t1BattingOrder = getPlaying11(userTeamObj);
    const t2BattingOrder = getSortedBattingOrder(aiTeamObj);

    innings1 = { teamId: userTeamObj.id, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0, ballsFaced: [], battingOrder: t1BattingOrder, currentBatsmen: [t1BattingOrder[0], t1BattingOrder[1]], impactPlayer: null };
    innings2 = { teamId: aiTeamObj.id, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0, ballsFaced: [], battingOrder: t2BattingOrder, currentBatsmen: [t2BattingOrder[0], t2BattingOrder[1]], impactPlayer: null };
    
    currentInnings = 1;
    currentBowlerIndex = 0;
    target = 0;
    checkInitialSelection();
  }
  
  function chooseToBowl() {
    if (!matchTeam1 || !matchTeam2) return;
    const userIsTeam1 = matchTeam1.id === 'user_team';
    const userTeamObj = userIsTeam1 ? matchTeam1 : matchTeam2;
    const aiTeamObj = userIsTeam1 ? matchTeam2 : matchTeam1;

    const t1BattingOrder = getSortedBattingOrder(aiTeamObj);
    const t2BattingOrder = getPlaying11(userTeamObj);

    innings1 = { teamId: aiTeamObj.id, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0, ballsFaced: [], battingOrder: t1BattingOrder, currentBatsmen: [t1BattingOrder[0], t1BattingOrder[1]], impactPlayer: null };
    innings2 = { teamId: userTeamObj.id, totalRuns: 0, wickets: 0, overs: 0, balls: 0, extras: 0, ballsFaced: [], battingOrder: t2BattingOrder, currentBatsmen: [t2BattingOrder[0], t2BattingOrder[1]], impactPlayer: null };
    
    currentInnings = 1;
    currentBowlerIndex = 0;
    target = 0;
    checkInitialSelection();
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
      if (ballInterval) clearInterval(ballInterval);
    } else if (phase === 'paused') {
      phase = 'playing';
      autoResume = true;
      if (gameSpeed === 'instant') simulateFullMatch();
      else if (gameSpeed === 'over') simulateOver();
      else playAutoBall();
    }
  }
  
  function handleSpeedChange(speed: SimSpeed) {
    gameSpeed = speed;
    if (phase === 'playing') {
      if (ballInterval) clearInterval(ballInterval);
      if (speed === 'instant') simulateFullMatch();
      else if (speed === 'over') simulateOver();
      else playAutoBall();
    }
  }
  
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
      if (result.sponsorshipEarnings.team1 > 0) teamStore.updateBudget(matchTeam1.id, result.sponsorshipEarnings.team1);
      if (result.sponsorshipEarnings.team2 > 0) teamStore.updateBudget(matchTeam2.id, result.sponsorshipEarnings.team2);
    }
  }

  function executeSingleBall() {
    if (isComplete || !currentBattingTeam || !currentBowlingTeam) {
      phase = 'paused';
      return true;
    }
  
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
      phase = 'paused';
      return true;
    }
    
    const ballEvent = resolveBall(striker, bowler, currentInn.balls, totalOvers, battingIntent, weather as any, pitch as any, 0, false, bowlingIntent, avoidSingles);
    
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

    let nextBalls = currentInn.balls + 1;
    let nextOvers = currentInn.overs;
    
    if (nextBalls % 6 === 0) {
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

    if (currentInnings === 1 && (nextOvers >= totalOvers || nextWickets >= 10)) {
        currentInnings = 2;
        target = updatedInn.totalRuns + 1;
        currentBowlerIndex = 0;
        phase = 'inningBreak';
        if (ballInterval) clearInterval(ballInterval);
        return true;
    } else if (currentInnings === 2 && (updatedInn.totalRuns >= target || nextOvers >= totalOvers || nextWickets >= 10)) {
        finishMatch();
        return true;
    }

    if (needsBatsman) {
        phase = 'selectNextBatsman';
        if (ballInterval) clearInterval(ballInterval);
        if (needsBowler) pendingBowlerSelection = true;
        return true;
    } else if (needsBowler) {
        phase = 'selectNextBowler';
        if (ballInterval) clearInterval(ballInterval);
        return true;
    }
    
    return false;
  }

  function playAutoBall() {
    if (phase !== 'playing' || isComplete) return;
    executeSingleBall();
    if (!isComplete && phase === 'playing') {
      ballInterval = setTimeout(playAutoBall, 100);
    }
  }

  function simulateOver() {
    if (phase !== 'playing' || isComplete) return;
    for (let i = 0; i < 6; i++) {
      if (isComplete || phase !== 'playing') break;
      const phaseChanged = executeSingleBall();
      if (phaseChanged) break;
    }
    if (!isComplete && phase === 'playing') {
      ballInterval = setTimeout(simulateOver, 100);
    }
  }
  
  function simulateFullMatch() {
    if (phase !== 'playing' || isComplete) return;
    while (!isComplete && phase === 'playing') {
      const phaseChanged = executeSingleBall();
      if (phaseChanged) break;
    }
  }

  function playSingleBallAction() {
    if (phase === 'playing') return;
    executeSingleBall();
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
    
    if (phase === 'selectOpeningBatsmen') {
        return team.players.filter(p => inn.battingOrder.includes(p.id)).sort((a,b) => b.stats.batting - a.stats.batting);
    } else {
        const outPlayers = new Set(inn.ballsFaced.filter(b => b.isWicket).map(b => b.batsmanId));
        const nonStriker = inn.currentBatsmen[0] === placeholderBatsman ? inn.currentBatsmen[1] : inn.currentBatsmen[0];
        return team.players.filter(p => inn.battingOrder.includes(p.id) && !outPlayers.has(p.id) && p.id !== nonStriker).sort((a,b) => b.stats.batting - a.stats.batting);
    }
  }

  function toggleBatsman(id: string) {
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
        phase = 'paused';
        if (autoResume) togglePause();
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
    
    return team.players.filter(p => {
        if (!p11.includes(p.id)) return false;
        if (p.id === lastBowler) return false;
        const balls = bowlerOvers[p.id] || 0;
        if (Math.floor(balls / 6) >= 4) return false;
        return true;
    }).sort((a,b) => b.stats.bowling - a.stats.bowling);
  }

  function confirmBowler(id: string) {
    selectedBowlerId = id;
    if (phase === 'selectOpeningBowler') {
        phase = 'ready';
    } else {
        phase = 'paused';
        if (autoResume) togglePause();
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

</script>

<svelte:head><title>Match - Fantasy Cricket</title></svelte:head>

<div class="match-page-wrapper">
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
      <div class="toss-card">
        <div class="toss-header">🪙 Matchday Toss</div>
        <div class="toss-teams">{matchTeam1?.name} <span class="vs">vs</span> {matchTeam2?.name}</div>
        
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
        
        <p class="toss-prompt">You Won The Toss! Choose to:</p>
        <div class="toss-actions">
          <button class="btn-bat" onclick={chooseToBat}>🏏 Bat First</button>
          <button class="btn-bowl" onclick={chooseToBowl}>🎯 Bowl First</button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Main Horizontal 3-Pane Match Layout -->
    <div class="match-layout">
      
      <!-- LEFT PANE: Batting Team -->
      <div class="pane left-pane">
        <div class="pane-header batting-header">
          <h3>{currentBattingTeam?.name}</h3>
          <span class="role-badge">Batting</span>
        </div>
        
        <div class="pane-content">
          {#if currentBattingTeam?.id === 'user_team' && (phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman')}
            <div class="selection-container">
               <div class="selection-prompt">{phase === 'selectOpeningBatsmen' ? 'Pick 2 Openers' : 'Pick Next Batsman'}</div>
               <div class="selection-list">
                 {#each getAvailableBatsmen() as p}
                    <button class="player-select-btn {selectedBatsmen.includes(p.id) ? 'selected' : ''}"
                            onclick={() => phase === 'selectOpeningBatsmen' ? toggleBatsman(p.id) : confirmNextBatsman(p.id)}>
                        <div class="player-info">
                           <span class="name">{p.name}</span>
                           <span class="role">{p.role}</span>
                        </div>
                        <span class="stat-badge">Bat: {p.stats.batting}</span>
                    </button>
                 {/each}
               </div>
               {#if phase === 'selectOpeningBatsmen'}
                 <button class="btn-confirm" disabled={selectedBatsmen.length !== 2} onclick={confirmOpeningBatsmen}>Confirm Openers</button>
               {/if}
            </div>
          {:else}
            <div class="scorecard-list">
              {#each currentBattingTeam?.players.filter(p => getPlaying11(currentBattingTeam!).includes(p.id)) || [] as p}
                {@const stats = getBatsmanStats(p.id)}
                <div class="scorecard-item {stats.isBatting ? 'active' : ''}">
                    <div class="top-row">
                        <span class="player-name {stats.isBatting ? 'highlight' : ''}">{p.name}</span>
                        <span class="player-score {stats.isBatting ? 'highlight' : ''}">{stats.runs} <span class="balls">({stats.balls})</span></span>
                    </div>
                    {#if stats.isOut}
                       <div class="status out">b. {stats.outType}</div>
                    {:else if !stats.isBatting && stats.balls === 0}
                       <div class="status waiting">Yet to bat</div>
                    {:else if stats.isBatting}
                       <div class="status playing"><span class="pulse-dot"></span> Batting</div>
                    {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
      <!-- CENTER PANE: Play Area -->
      <div class="pane center-pane">
        
        <div class="scoreboard-panel">
           <div class="scoreboard-header">
             <span class="innings-label">{currentInnings === 1 ? '1st' : '2nd'} Innings</span>
             <div class="conditions-mini">
               <span title="Weather">{weatherEmojis[weather]} {weather}</span>
               <span class="separator">|</span>
               <span title="Pitch">{pitchEmojis[pitch]} {pitch}</span>
             </div>
           </div>
           <Scoreboard inningsData={currentInningsData} battingTeamName={currentBattingTeam?.name || ''} target={currentInnings === 2 ? target : undefined} />
        </div>

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
            <button class="btn-primary large" onclick={handleGoHome}>Continue to Dashboard</button>
          </div>
        {:else if phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman' || phase === 'selectOpeningBowler' || phase === 'selectNextBowler'}
          <div class="action-panel centered">
            <div class="spinner large"></div>
            <h2 class="waiting-title">Waiting for Selection</h2>
            <p class="waiting-desc">Please make your selection in the side panel.</p>
          </div>
        {:else}
          <div class="controls-panel">
             <MatchControls bind:speed={gameSpeed} isPaused={phase === 'paused'} {battingIntent} {bowlingIntent} {avoidSingles}
               onSpeedChange={handleSpeedChange} onPauseToggle={togglePause}
               onBattingIntentChange={(i) => battingIntent = i} onBowlingIntentChange={(i) => bowlingIntent = i} onAvoidSinglesChange={(v) => avoidSingles = v}
               onPlaySingleBall={playSingleBallAction} onPlaySingleOver={playSingleOverAction} />
          </div>
          
          <div class="commentary-panel">
             <div class="commentary-header">
               <span>Live Commentary</span>
               {#if currentLiveBowlerId}
                 {@const b = currentBowlingTeam?.players.find(x => x.id === currentLiveBowlerId)}
                 <span class="live-bowler">Bowling: {b?.name}</span>
               {/if}
             </div>
             <div class="commentary-content">
                <BallFeed events={currentInningsData.ballsFaced} />
             </div>
          </div>
        {/if}
      </div>

      <!-- RIGHT PANE: Bowling Team -->
      <div class="pane right-pane">
        <div class="pane-header bowling-header">
          <h3>{currentBowlingTeam?.name}</h3>
          <span class="role-badge">Bowling</span>
        </div>
        
        <div class="pane-content">
          {#if currentBowlingTeam?.id === 'user_team' && (phase === 'selectOpeningBowler' || phase === 'selectNextBowler')}
            <div class="selection-container">
               <div class="selection-prompt">Select Bowler for the Over</div>
               <div class="selection-list">
                 {#each getAvailableBowlers() as p}
                    <button class="player-select-btn" onclick={() => confirmBowler(p.id)}>
                        <div class="player-info">
                           <span class="name">{p.name}</span>
                           <span class="role">{p.role}</span>
                        </div>
                        <span class="stat-badge">Bowl: {p.stats.bowling}</span>
                    </button>
                 {/each}
               </div>
            </div>
          {:else}
            <div class="scorecard-list">
              {#each currentBowlingTeam?.players.filter(p => getPlaying11(currentBowlingTeam!).includes(p.id)) || [] as p}
                {@const stats = getBowlerStats(p.id)}
                {#if p.role === 'bowler' || p.role === 'allrounder' || stats.oversBowled > 0}
                <div class="scorecard-item {p.id === currentLiveBowlerId ? 'active-bowl' : ''}">
                    <div class="top-row">
                        <span class="player-name {p.id === currentLiveBowlerId ? 'highlight-bowl' : ''}">{p.name}</span>
                        <span class="player-score {p.id === currentLiveBowlerId ? 'highlight-bowl' : ''}">{stats.wickets}-{stats.runs} <span class="overs">({stats.overs})</span></span>
                    </div>
                    {#if p.id === currentLiveBowlerId}
                       <div class="status playing-bowl"><span class="pulse-dot bowl"></span> Bowling Now</div>
                    {/if}
                </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      </div>
      
    </div>
  {/if}
</div>

<style>
  /* Base Variables & Theming */
  :root {
    --color-bg-dark: var(--bg-primary, #0f172a);
    --color-bg-panel: var(--bg-secondary, #1e293b);
    --color-bg-panel-light: var(--bg-tertiary, #334155);
    --color-border: var(--border-color, #334155);
    
    --color-batting: var(--success, #10b981); /* Emerald */
    --color-batting-dark: #047857;
    --color-batting-transparent: rgba(35, 134, 54, 0.15);
    
    --color-bowling: var(--info, #3b82f6); /* Blue */
    --color-bowling-dark: #1d4ed8;
    --color-bowling-transparent: rgba(31, 111, 235, 0.15);
    
    --color-accent: var(--warning, #f59e0b); /* Amber */
    --color-danger: var(--danger, #f43f5e); /* Rose */
    
    --text-primary: var(--text-primary, #f8fafc);
    --text-secondary: var(--text-secondary, #cbd5e1);
    --text-muted: var(--text-muted, #94a3b8);
    
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .match-page-wrapper {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: var(--text-primary);
    background-color: var(--color-bg-dark);
    min-height: 100vh;
    padding: 20px;
    box-sizing: border-box;
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
    background: -webkit-linear-gradient(45deg, #f59e0b, #fbbf24);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
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
  button { font-family: inherit; cursor: pointer; border: none; outline: none; }
  .btn-primary { background: var(--color-bowling); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; transition: background 0.2s; text-decoration: none; display: inline-block; }
  .btn-primary:hover { background: var(--color-bowling-dark); }
  .btn-primary.large { padding: 14px 28px; font-size: 1rem; }
  
  .btn-bat { background: var(--color-batting); color: white; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); }
  .btn-bat:hover { transform: translateY(-2px); background: #059669; }
  
  .btn-bowl { background: var(--color-danger); color: white; padding: 14px 28px; border-radius: 12px; font-size: 1rem; font-weight: 700; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(244, 63, 94, 0.4); }
  .btn-bowl:hover { transform: translateY(-2px); background: #e11d48; }

  .btn-start { background: var(--color-batting); color: white; padding: 16px 32px; border-radius: 12px; font-size: 1.1rem; font-weight: 800; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); }
  .btn-start:hover { transform: scale(1.05); }

  /* Main Layout */
  .match-layout {
    display: flex;
    flex-direction: row;
    gap: 24px;
    height: calc(100vh - 40px);
    max-height: 900px;
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
  }

  @media (max-width: 1024px) {
    .match-layout { flex-direction: column; height: auto; max-height: none; }
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
    background: var(--color-bg-panel-light);
    border: 1px solid transparent;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s;
    color: var(--text-primary);
  }
  .player-select-btn:hover { background: #475569; }
  .player-select-btn.selected { background: var(--color-batting-dark); border-color: var(--color-batting); }
  
  .player-info { display: flex; flex-direction: column; text-align: left; }
  .player-info .name { font-weight: 600; font-size: 1rem; }
  .player-info .role { font-size: 0.75rem; color: var(--text-muted); }
  
  .stat-badge { background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; font-weight: 600; }

  .btn-confirm { background: var(--color-batting); color: white; padding: 14px; border-radius: 8px; font-weight: 700; margin-top: auto; }
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
  
  .scorecard-item.active { background: var(--color-batting-transparent); border-color: rgba(16, 185, 129, 0.3); }
  .scorecard-item.active-bowl { background: var(--color-bowling-transparent); border-color: rgba(59, 130, 246, 0.3); }

  .top-row { display: flex; justify-content: space-between; align-items: center; }
  .player-name { font-weight: 600; font-size: 0.95rem; color: var(--text-secondary); }
  .player-name.highlight { color: var(--color-batting); }
  .player-name.highlight-bowl { color: var(--color-bowling); }
  
  .player-score { font-family: monospace; font-size: 0.95rem; font-weight: 700; color: var(--text-secondary); }
  .player-score.highlight { color: var(--text-primary); }
  .player-score.highlight-bowl { color: var(--text-primary); }
  .player-score .balls, .player-score .overs { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); }

  .status { font-size: 0.75rem; font-style: italic; }
  .status.out { color: var(--color-danger); }
  .status.waiting { color: var(--text-muted); }
  .status.playing { color: var(--color-batting); font-weight: 600; font-style: normal; display: flex; align-items: center; gap: 6px; }
  .status.playing-bowl { color: var(--color-bowling); font-weight: 600; font-style: normal; display: flex; align-items: center; gap: 6px; }

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
  .innings-label { font-size: 0.85rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted); }
  .conditions-mini { display: flex; gap: 12px; font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--color-border); }
  .conditions-mini .separator { color: #475569; }

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
  .target-text strong { color: white; font-size: 1.25rem; }
  .win-title { color: var(--color-batting); font-size: 2rem; margin-bottom: 16px; }
  .final-score { font-family: monospace; font-size: 1.25rem; color: var(--text-secondary); margin-bottom: 24px; }
  .final-score .vs { font-family: sans-serif; font-size: 0.9rem; color: var(--text-muted); margin: 0 10px; }
  
  .waiting-title { color: var(--color-accent); font-size: 1.25rem; margin-bottom: 8px; }
  .waiting-desc { color: var(--text-muted); }

  .controls-panel {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 16px;
    box-shadow: var(--shadow-md);
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

</style>