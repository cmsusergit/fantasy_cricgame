<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeGame, resetGame, teamStore, playerStore, tournamentStore, scheduleStore, gamePhase, currentSeason, isFirstLogin, saveCurrentGame } from '$lib/stores/gameState';
  import { getMatchesForDay, simulateAllMatchesForDay } from '$lib/core/schedule';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { TournamentSchedule, GameDay, ScheduledMatch } from '$lib/core/schedule';
  import { generateSponsorship, type SponsorshipContract } from '$lib/core/sponsorship';
  import { simulateInnings } from '$lib/core/tournamentSim';
  import { resolveMatch } from '$lib/core/matchEngine';
  import MatchSummary from '$lib/components/match/MatchSummary.svelte';
  import { goto } from '$app/navigation';
  import { calculateTeamStrength } from '$lib/core/teamBuilder';
  import { FACTIONS } from '$lib/models/faction';
  import { loadActiveMatch } from '$lib/services/storage';
  
  let teams: any[] = $state([]);
  let players: any[] = $state([]);
  let schedule = $state<TournamentSchedule | null>(null);
  let day = $state(1);
  let budget = $state(4000000);
  let operatingBudget = $state(1000000);
  let selectedDay = $state(1);
  let sponsorshipOffers: SponsorshipContract[] = $state([]);

  // Auto-Simulate Results State
  let showMatchResultModal = $state(false);
  let lastSimulatedInnings1: any = $state(null);
  let lastSimulatedInnings2: any = $state(null);
  let lastMatchResult: any = $state(null);
  let hasActiveMatch = $state(false);
  
  onMount(() => {
    loadActiveMatch().then(m => hasActiveMatch = !!m);
    
    const unsubTeam = teamStore.subscribe(t => {
      teams = t;
      const user = t.find((team: any) => team.isUserTeam);
      if (user) {
        budget = user.budget;
        operatingBudget = user.operatingBudget || 1000000;
      }
    });
    const unsubPlayer = playerStore.subscribe(p => players = p);
    const unsubSchedule = scheduleStore.subscribe(s => {
      schedule = s;
      if (s) selectedDay = s.currentDay;
    });
    
    return () => {
      unsubTeam();
      unsubPlayer();
      unsubSchedule();
    };
  });
  
  let userTeam = $derived(teams.find(t => t.isUserTeam));
  let availablePlayers = $derived(players.filter(p => p.isAvailable));
  let winRate = $derived(userTeam ? ((userTeam.wins / (userTeam.matchesPlayed || 1)) * 100).toFixed(0) : '0');
  let fanPopularity = $derived(userTeam?.fanProfile?.popularity ?? 50);
  let homeAdvantage = $derived(userTeam?.fanProfile?.homeAdvantage ?? 0);
  let fanRevenue = $derived(userTeam?.fanProfile?.revenue ?? 0);
  let activeInjuryCount = $derived(userTeam ? userTeam.players.filter((p: any) => (p as any).activeInjury).length : 0);
  let playing11Count = $derived(userTeam?.playing11?.length ?? 0);
  let lineupReady = $derived(Boolean(userTeam?.playing11?.length === 11 && userTeam?.captain && userTeam?.wicketKeeper));
  
  $effect(() => {
    const maxSponsors = userTeam?.tournamentWins > 0 ? 2 : 1;
    if (userTeam && userTeam.sponsorships && userTeam.sponsorships.length < maxSponsors && ($gamePhase === 'tournament' || $gamePhase === 'menu') && sponsorshipOffers.length === 0) {
      const offers: SponsorshipContract[] = [];
      // Generate 3 unique offers
      while(offers.length < 3) {
         const newOffer = generateSponsorship(userTeam.budget);
         if (!offers.find(o => o.sponsorName === newOffer.sponsorName)) {
            offers.push(newOffer);
         }
      }
      sponsorshipOffers = offers;
    }
  });

  function acceptSponsorship(offer: SponsorshipContract) {
    if (!userTeam) return;
    teamStore.addSponsorship(userTeam.id, offer);
    sponsorshipOffers = []; // Clear offers
  }
  
  let currentDayGames = $derived(schedule ? getMatchesForDay(schedule, selectedDay) : []);
  let dayInfo = $derived(schedule?.days.find(d => d.day === selectedDay));
  let userNextMatch = $derived(schedule?.matches.find(m => 
    m.status === 'scheduled' && (m.team1Id === 'user_team' || m.team2Id === 'user_team') && m.day === schedule?.currentDay
  ));
  
  // Expose gamePhase for conditional UI rendering
  let phase = $derived($gamePhase);

  // Top Performers
  let bestBat = $derived([...players].sort((a,b) => (b.tournamentStats?.runs || 0) - (a.tournamentStats?.runs || 0))[0]);
  let bestBowl = $derived([...players].sort((a,b) => (b.tournamentStats?.wickets || 0) - (a.tournamentStats?.wickets || 0))[0]);
  let mvp = $derived([...players].sort((a,b) => ((b.tournamentStats?.runs || 0) * 1 + (b.tournamentStats?.wickets || 0) * 20) - ((a.tournamentStats?.runs || 0) * 1 + (a.tournamentStats?.wickets || 0) * 20))[0]);
  
  function quickSimulateUserMatch() {
    if (!schedule || !teams.length || !userNextMatch) return;
    
    const team1 = teams.find(t => t.id === userNextMatch.team1Id);
    const team2 = teams.find(t => t.id === userNextMatch.team2Id);
    
    if (!team1 || !team2) return;

    // Simulate match
    const innings1 = simulateInnings(team1, team2, 20);
    const target = innings1.totalRuns + 1;
    const innings2 = simulateInnings(team2, team1, 20, target);
    
    const t1Won = innings1.totalRuns > innings2.totalRuns;
    const t2Won = innings2.totalRuns > innings1.totalRuns;

    // Update stats
    if (t1Won) {
      teamStore.addWin(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
      teamStore.addLoss(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
    } else if (t2Won) {
      teamStore.addWin(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
      teamStore.addLoss(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
    }

    const winnerId = t1Won ? innings1.teamId : t2Won ? innings2.teamId : 'draw';
    const score1 = userNextMatch.team1Id === innings1.teamId ? innings1.totalRuns : innings2.totalRuns;
    const score2 = userNextMatch.team2Id === innings2.teamId ? innings2.totalRuns : innings1.totalRuns;
    
    scheduleStore.updateMatchResult(userNextMatch.id, winnerId, score1, score2);

    const result = resolveMatch(team1, team2, innings1, innings2, userNextMatch.team1Id);
    
    // Apply Earnings
                  const totalEarningsTeam1 = result.sponsorshipEarnings.team1 + result.matchEarnings.team1;
                  const totalEarningsTeam2 = result.sponsorshipEarnings.team2 + result.matchEarnings.team2;
                  
                  if (totalEarningsTeam1 > 0) teamStore.updateBudget(team1.id, totalEarningsTeam1);
                  if (totalEarningsTeam2 > 0) teamStore.updateBudget(team2.id, totalEarningsTeam2);
                  if (result.operatingEarnings.team1 > 0) teamStore.updateOperatingBudget(team1.id, result.operatingEarnings.team1);
                  if (result.operatingEarnings.team2 > 0) teamStore.updateOperatingBudget(team2.id, result.operatingEarnings.team2);
                  
                  if (result.playerOfTheMatch) {
        teamStore.updateBudget(result.playerOfTheMatch.teamId, result.potmReward);
    }
    
    playerStore.update(pStore => {
      let updatedPlayers = [...pStore];
      const processInnings = (inn: any) => {
          inn.ballsFaced.forEach((ball: any) => {
              let batter = updatedPlayers.find(p => p.id === ball.batsmanId);
              if (batter) {
                  if (!batter.tournamentStats) batter.tournamentStats = { runs: 0, wickets: 0 };
                  if (ball.result !== 'wide' && ball.result !== 'noball') {
                      batter.tournamentStats.runs += ball.runs;
                  }
              }
              if (ball.isWicket && ball.result !== 'noball') {
                  let bowler = updatedPlayers.find(p => p.id === ball.bowlerId);
                  if (bowler) {
                      if (!bowler.tournamentStats) bowler.tournamentStats = { runs: 0, wickets: 0 };
                      bowler.tournamentStats.wickets += 1;
                  }
              }
          });
      };
      processInnings(innings1);
      processInnings(innings2);
      return updatedPlayers;
    });

    lastSimulatedInnings1 = innings1;
    lastSimulatedInnings2 = innings2;
    lastMatchResult = result;
    showMatchResultModal = true;
  }

  async function closeMatchResultModal() {
    showMatchResultModal = false;
    await advanceTournament();
  }

  async function advanceTournament() {
    if (!schedule || !teams.length) return;
    
    const currentDay = schedule.currentDay;
    const nextDay = currentDay + 1;
    
    const updatedSchedule = simulateAllMatchesForDay(schedule, currentDay, teams);
    updatedSchedule.currentDay = nextDay;
    scheduleStore.set(updatedSchedule);

    const newlyCompletedMatches = updatedSchedule.matches.filter(m => m.day === currentDay && m.status === 'completed' && m.result && m.team1Id !== 'user_team' && m.team2Id !== 'user_team');
    
    // Apply fatigue recovery and injury healing across all teams, and update match results
    teamStore.update(tStore => {
      let nextStore = tStore.map(team => {
        const updatedPlayers = team.players.map(p => {
          let fatigue = p.fatigue || 0;
          if (fatigue > 0) fatigue = Math.max(0, fatigue - 15); // Rest heals 15 fatigue per day
          let activeInjury = (p as any).activeInjury;
          if (activeInjury) {
             activeInjury.currentDay += 1;
             if (activeInjury.currentDay >= activeInjury.recoveryDays) {
                 activeInjury = null; // Healed
             }
          }
          return { ...p, fatigue, activeInjury };
        });
        return { ...team, players: updatedPlayers };
      });

      for (const match of newlyCompletedMatches) {
          if (!match.result) continue;
          const t1Index = nextStore.findIndex(t => t.id === match.team1Id);
          const t2Index = nextStore.findIndex(t => t.id === match.team2Id);
          if (t1Index !== -1 && t2Index !== -1) {
              const t1 = nextStore[t1Index];
              const t2 = nextStore[t2Index];
              
              const baseEarnings = 10000;
              const winBonus = 50000;
              let t1Earnings = baseEarnings;
              let t2Earnings = baseEarnings;
              
              if (match.result.winner === t1.id) {
                  t1Earnings += winBonus;
                  nextStore[t1Index] = { ...t1, wins: t1.wins + 1, matchesPlayed: t1.matchesPlayed + 1, runsFor: t1.runsFor + match.result.team1Score, runsAgainst: t1.runsAgainst + match.result.team2Score, budget: t1.budget + t1Earnings };
                  nextStore[t2Index] = { ...t2, losses: t2.losses + 1, matchesPlayed: t2.matchesPlayed + 1, runsFor: t2.runsFor + match.result.team2Score, runsAgainst: t2.runsAgainst + match.result.team1Score, budget: t2.budget + t2Earnings };
              } else if (match.result.winner === t2.id) {
                  t2Earnings += winBonus;
                  nextStore[t2Index] = { ...t2, wins: t2.wins + 1, matchesPlayed: t2.matchesPlayed + 1, runsFor: t2.runsFor + match.result.team2Score, runsAgainst: t2.runsAgainst + match.result.team1Score, budget: t2.budget + t2Earnings };
                  nextStore[t1Index] = { ...t1, losses: t1.losses + 1, matchesPlayed: t1.matchesPlayed + 1, runsFor: t1.runsFor + match.result.team1Score, runsAgainst: t1.runsAgainst + match.result.team2Score, budget: t1.budget + t1Earnings };
              } else {
                  nextStore[t1Index] = { ...t1, draws: t1.draws + 1, matchesPlayed: t1.matchesPlayed + 1, runsFor: t1.runsFor + match.result.team1Score, runsAgainst: t1.runsAgainst + match.result.team2Score, budget: t1.budget + t1Earnings };
                  nextStore[t2Index] = { ...t2, draws: t2.draws + 1, matchesPlayed: t2.matchesPlayed + 1, runsFor: t2.runsFor + match.result.team2Score, runsAgainst: t2.runsAgainst + match.result.team1Score, budget: t2.budget + t2Earnings };
              }
          }
      }

      return nextStore;
    });
    
    playerStore.update(pStore => {
      let updatedPlayers = [...pStore];
      for (const match of newlyCompletedMatches) {
          if (!match.result) continue;
          const team1 = teams.find(t => t.id === match.team1Id);
          const team2 = teams.find(t => t.id === match.team2Id);
          if (team1 && team2) {
              let t1Batters = team1.players.filter((p: any) => p.role === 'batsman' || p.role === 'allrounder').slice(0, 6);
              if(t1Batters.length === 0) t1Batters = team1.players.slice(0, 6);
              t1Batters.forEach((p: any) => {
                  let pStoreMatch = updatedPlayers.find(up => up.id === p.id);
                  if (pStoreMatch) {
                      if (!pStoreMatch.tournamentStats) pStoreMatch.tournamentStats = { runs: 0, wickets: 0 };
                      pStoreMatch.tournamentStats.runs += Math.floor(((match.result?.team1Score || 0) / t1Batters.length) * (0.5 + Math.random()));
                  }
              });
              
              let t2Batters = team2.players.filter((p: any) => p.role === 'batsman' || p.role === 'allrounder').slice(0, 6);
              if(t2Batters.length === 0) t2Batters = team2.players.slice(0, 6);
              t2Batters.forEach((p: any) => {
                  let pStoreMatch = updatedPlayers.find(up => up.id === p.id);
                  if (pStoreMatch) {
                      if (!pStoreMatch.tournamentStats) pStoreMatch.tournamentStats = { runs: 0, wickets: 0 };
                      pStoreMatch.tournamentStats.runs += Math.floor(((match.result?.team2Score || 0) / t2Batters.length) * (0.5 + Math.random()));
                  }
              });

              const avgWickets1 = Math.floor(Math.random() * 10);
              const avgWickets2 = Math.floor(Math.random() * 10);

              let t1Bowlers = team1.players.filter((p: any) => p.role === 'bowler' || p.role === 'allrounder').slice(0, 5);
              if (t1Bowlers.length === 0) t1Bowlers = team1.players.slice(6, 11);
              for(let i=0; i<avgWickets2; i++) {
                 let bowler = t1Bowlers[Math.floor(Math.random() * t1Bowlers.length)];
                 if (bowler) {
                    let pStoreMatch = updatedPlayers.find(up => up.id === bowler.id);
                    if (pStoreMatch) {
                        if (!pStoreMatch.tournamentStats) pStoreMatch.tournamentStats = { runs: 0, wickets: 0 };
                        pStoreMatch.tournamentStats.wickets += 1;
                    }
                 }
              }

              let t2Bowlers = team2.players.filter((p: any) => p.role === 'bowler' || p.role === 'allrounder').slice(0, 5);
              if (t2Bowlers.length === 0) t2Bowlers = team2.players.slice(6, 11);
              for(let i=0; i<avgWickets1; i++) {
                 let bowler = t2Bowlers[Math.floor(Math.random() * t2Bowlers.length)];
                 if (bowler) {
                    let pStoreMatch = updatedPlayers.find(up => up.id === bowler.id);
                    if (pStoreMatch) {
                        if (!pStoreMatch.tournamentStats) pStoreMatch.tournamentStats = { runs: 0, wickets: 0 };
                        pStoreMatch.tournamentStats.wickets += 1;
                    }
                 }
              }
          }
      }
      return updatedPlayers;
    });

    if (nextDay > schedule.totalDays) {
      gamePhase.set('season_end');
      goto('/season-review');
    } else {
      await saveCurrentGame(budget);
    }
  }
  async function closeWelcomeModal() {
    isFirstLogin.set(false);
    await saveCurrentGame(budget);
  }

  async function goToGuide() {
    isFirstLogin.set(false);
    await saveCurrentGame(budget);
    goto('/guide');
  }
</script>

<svelte:head>
  <title>Fantasy Cricket Grand Manager</title>
</svelte:head>

<div class="dashboard dashboard-grid">
  {#if $isFirstLogin}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" style="z-index: 2000; padding: 14px;" onclick={closeWelcomeModal}>
      <div class="modal-content" style="background: var(--bg-secondary); border: 2px solid var(--accent-gold); border-radius: 12px; padding: 14px; max-width: 600px; text-align: center;" onclick={(e) => e.stopPropagation()}>
        <h2 style="font-family: 'Cinzel', serif; color: var(--accent-gold); font-size: 1rem; margin-bottom: 12px;">Welcome, Manager!</h2>
        <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 12px; color: var(--text-primary);">You have just taken the reins of a brand new franchise. Before you head into the high-stakes Auction Room to draft your squad, would you like a quick tour of the rules and mechanics?</p>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px; font-style: italic;">Fantasy CricManager features unique tactical mechanics and fantasy faction synergies that are crucial to understand.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button class="btn-cancel" onclick={closeWelcomeModal} style="background: var(--bg-tertiary); color: var(--text-primary);">I know what I'm doing</button>
          <button class="btn-confirm" onclick={goToGuide} style="background: var(--success); font-weight: bold; color: white;">Read Quick Start Guide</button>
        </div>
      </div>
    </div>
  {/if}

  <header class="hero">
    <div class="hero-content">
      <h1>🏏 Fantasy Cricket</h1>
      <p class="tagline">Grand Manager v1.4.2</p>
    </div>
    <div class="season-badge">
      <span>Season {$currentSeason}</span>
    </div>
  </header>

  {#if userTeam}
    <section class="team-overview card" style="border-top: 3px solid {userTeam.colorPrimary};">
      <div class="team-header">
        <div class="team-info" style="display: flex; gap: 10px; align-items: center;">
          {#if userTeam.logo}
            <div style="font-size: 1.75rem; line-height: 1; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: var(--bg-tertiary); border-radius: 12px; border: 2px solid {userTeam.colorPrimary}40;" title="Coat of Arms">
              {userTeam.logo}
            </div>
          {/if}
          <div>
            <h2 style="margin-bottom: 0; color: {userTeam.colorPrimary};">{userTeam.name}</h2>
            <span class="coach">{userTeam.coach}</span>
          </div>
        </div>
        <div class="team-badges">
          <span class="badge win-rate">{winRate}% Win Rate</span>
          <span class="badge matches">{userTeam.matchesPlayed || 0} Matches</span>
          {#if userTeam.sponsorships && userTeam.sponsorships.length > 0}
             {#each userTeam.sponsorships as sponsor}
                 <span class="badge sponsor">🤝 {sponsor.sponsorName}</span>
             {/each}
          {/if}
        </div>
      </div>
      
      <div class="stats-grid">
        <a href="/budget" class="stat-card budget" style="text-decoration: none; cursor: pointer; transition: transform 0.2s;">
          <span class="stat-icon">💰</span>
          <div class="stat-content">
            <span class="stat-value">${budget.toLocaleString()}</span>
            <span class="stat-label">Transfer Budget</span>
          </div>
        </a>
        <a href="/club" class="stat-card budget" style="text-decoration: none; cursor: pointer; transition: transform 0.2s;">
          <span class="stat-icon">🏢</span>
          <div class="stat-content">
            <span class="stat-value">${operatingBudget.toLocaleString()}</span>
            <span class="stat-label">Operating Budget</span>
          </div>
        </a>
        <div class="stat-card wins">
          <span class="stat-icon">🏆</span>
          <div class="stat-content">
            <span class="stat-value">{userTeam.wins}</span>
            <span class="stat-label">Wins</span>
          </div>
        </div>
        <div class="stat-card losses">
          <span class="stat-icon">📉</span>
          <div class="stat-content">
            <span class="stat-value">{userTeam.losses}</span>
            <span class="stat-label">Losses</span>
          </div>
        </div>
        <div class="stat-card runs">
          <span class="stat-icon">🏃</span>
          <div class="stat-content">
            <span class="stat-value">{userTeam.runsFor || 0}</span>
            <span class="stat-label">Runs Scored</span>
          </div>
        </div>
      </div>
    </section>

    <section class="ops-strip">
      <article class="ops-card">
        <span class="ops-label">Fan Pulse</span>
        <div class="ops-value">{fanPopularity}%</div>
        <p>Home advantage {homeAdvantage.toFixed(1)} · Revenue ${fanRevenue.toLocaleString()}</p>
      </article>
      <article class="ops-card">
        <span class="ops-label">Squad Health</span>
        <div class="ops-value">{activeInjuryCount}</div>
        <p>Active injuries across the roster</p>
      </article>
      <article class="ops-card">
        <span class="ops-label">Match Readiness</span>
        <div class="ops-value">{playing11Count}/11</div>
        <p>{lineupReady ? 'Playing XI locked' : 'Set captain and keeper'}</p>
      </article>
      <article class="ops-card">
        <span class="ops-label">Revenue Mix</span>
        <div class="ops-value">${operatingBudget.toLocaleString()}</div>
        <p>{userTeam.sponsorships?.length || 0} sponsor{(userTeam.sponsorships?.length || 0) === 1 ? '' : 's'} · Transfer ${budget.toLocaleString()}</p>
      </article>
    </section>
  {/if}

  {#if userTeam && userTeam.sponsorships && userTeam.sponsorships.length < (userTeam.tournamentWins > 0 ? 2 : 1) && ($gamePhase === 'tournament' || $gamePhase === 'menu') && sponsorshipOffers.length > 0}
    <section class="sponsorship-section card">
      <div class="section-header">
        <h3>🤝 Select a Team Sponsor</h3>
      </div>
      <p class="sponsor-desc">Choose a sponsor for this season. Sponsors provide crucial funds based on your performance. You can have up to {userTeam.tournamentWins > 0 ? 2 : 1} active sponsor{userTeam.tournamentWins > 0 ? 's' : ''}.</p>
      <div class="sponsor-grid">
        {#each sponsorshipOffers as offer}
          <div class="sponsor-card">
            <h4>{offer.sponsorName}</h4>
            <div class="sponsor-type badge {offer.type}">{offer.type.toUpperCase()}</div>
            <ul class="sponsor-terms">
              <li><strong>Matches:</strong> {offer.matches}</li>
              <li><strong>Match Bonus:</strong> ${offer.bonusAmount.toLocaleString()}</li>
              <li><strong>Performance Bonus:</strong> ${offer.performanceBonus.toLocaleString()}</li>
            </ul>
            <button class="accept-btn" onclick={() => acceptSponsorship(offer)}>Sign Contract</button>
          </div>
        {/each}
      </div>
    </section>
  {/if}

    {#if schedule}
      <section class="next-match-widget card">
          {#if userNextMatch && userTeam}
              {@const opponentTeamId = userNextMatch.team1Id === userTeam.id ? userNextMatch.team2Id : userNextMatch.team1Id}
              {@const opponentTeam = teams.find(t => t.id === opponentTeamId)}
              {@const opponentStrength = opponentTeam ? calculateTeamStrength(opponentTeam) : null}
              {@const userTeamStrength = userTeam ? calculateTeamStrength(userTeam) : null}
              {@const opponentFaction = opponentTeam && opponentTeam.faction ? FACTIONS[opponentTeam.faction as keyof typeof FACTIONS] : null}

              <div class="next-match-header">
                  <h3>Next Match</h3>
                  <span class="next-match-day">Day {userNextMatch.day}</span>
              </div>

              <div class="matchup-summary">
                  <div class="team-display">
                      <span class="team-name">{userTeam.name}</span>
                      <span class="team-strength">{'⭐'.repeat(userTeamStrength?.stars || 1)}</span>
                  </div>
                  <span class="vs-text">VS</span>
                  <div class="team-display opponent">
                      {#if opponentFaction?.avatarStyle}
                          <img src="/portraits/{opponentFaction.type}_1.svg" alt={opponentFaction.name} class="opponent-avatar" />
                      {/if}
                      <span class="team-name">{opponentTeam?.name}</span>
                      <span class="team-strength">{'⭐'.repeat(opponentStrength?.stars || 1)}</span>
                  </div>
              </div>

              <p class="match-venue">at {userNextMatch.venue}</p>

              <div class="next-match-actions">
                  <a href="/match" class="btn-start-match">{hasActiveMatch ? 'CONTINUE MATCH' : 'START MATCH'}</a>
                  <button class="btn-auto-sim" onclick={quickSimulateUserMatch} title="Instantly simulate the match and advance">AUTO SIMULATE ⚡</button>
              </div>
          {:else}
              <div class="no-next-match">
                  <p>No upcoming matches for your team today.</p>
                  {#if phase === 'tournament' || phase === 'menu'}
                     <button class="advance-btn" onclick={advanceTournament}>Advance to Day {schedule?.currentDay ? schedule.currentDay + 1 : ''}</button>
                  {/if}
              </div>
          {/if}
      </section>
    <section class="schedule-section card">
      <div class="section-header">
        <h3>📅 Tournament Calendar</h3>
      </div>
      
      <div class="day-details">
        <h4>Day {selectedDay} Schedule</h4>
        {#if dayInfo}
          <div class="day-info {dayInfo.type}">
            <span class="day-type">{dayInfo.title}</span>
            <span class="day-desc">{dayInfo.description}</span>
          </div>
        {/if}
        
        <div class="matches-list">
          {#each currentDayGames as match}
            <div class="match-card {match.status}" class:user-match={match.team1Id === 'user_team' || match.team2Id === 'user_team'}>
              <div class="match-teams">
                <span class="team">{match.team1Name} <span style="font-size: 0.7em; color: var(--text-secondary);">(Home)</span></span>
                <span class="vs">vs</span>
                <span class="team">{match.team2Name}</span>
              </div>
              <div class="match-meta">
                <span class="venue">{match.venue}</span>
                <span class="status-badge">{match.status}</span>
              </div>
            </div>
          {:else}
            <p class="no-matches">No matches on this day</p>
          {/each}
        </div>
      </div>
      
      {#if phase !== 'tournament' && phase !== 'match' && phase !== 'menu'}
         <div class="off-season-alert" style="margin-top: 12px; padding: 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid var(--warning); border-radius: 8px; text-align: center; color: var(--warning); font-weight: 600;">
           Tournament is currently in the off-season phase. Please complete the off-season activities to begin the next season.
           <br>
           {#if phase === 'season_end'}
              <a href="/season-review" class="advance-btn" style="display: inline-block; width: auto; padding: 8px 16px; background: var(--success); color: white; text-decoration: none; margin-top: 12px;">Go to Season Review</a>
           {:else if phase === 'retention'}
              <a href="/retention" class="advance-btn" style="display: inline-block; width: auto; padding: 8px 16px; background: var(--danger); color: white; text-decoration: none; margin-top: 12px;">Go to Retention Board</a>
           {:else if phase === 'scouting'}
              <a href="/scouting" class="advance-btn" style="display: inline-block; width: auto; padding: 8px 16px; background: var(--info); color: white; text-decoration: none; margin-top: 12px;">Go to Scouting Network</a>
           {:else if phase === 'auction'}
              <a href="/auction" class="advance-btn" style="display: inline-block; width: auto; padding: 8px 16px; background: var(--warning); color: white; text-decoration: none; margin-top: 12px;">Go to Live Auction</a>
           {/if}
         </div>
      {/if}
    </section>
  {/if}

  <!-- Player Performance Stats replacing Transfer Market -->
      <section class="player-stats-section card">
    <div class="section-header">
      <h3>⭐ Top Performers</h3>
    </div>
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
      <div class="stat-card">
        <div class="stat-content" style="width: 100%;">
          <span class="stat-label">Best Batsman (Runs)</span>
          {#if bestBat && bestBat.tournamentStats?.runs > 0}
            <span class="stat-value">{bestBat.name}</span>
            <span style="color: var(--warning); font-weight: bold;">{bestBat.tournamentStats.runs} Runs</span>
          {:else}
            <span class="stat-value" style="color: var(--text-muted); font-size: 1rem;">N/A</span>
          {/if}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-content" style="width: 100%;">
          <span class="stat-label">Best Bowler (Wickets)</span>
          {#if bestBowl && bestBowl.tournamentStats?.wickets > 0}
            <span class="stat-value">{bestBowl.name}</span>
            <span style="color: var(--success); font-weight: bold;">{bestBowl.tournamentStats.wickets} Wickets</span>
          {:else}
            <span class="stat-value" style="color: var(--text-muted); font-size: 1rem;">N/A</span>
          {/if}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-content" style="width: 100%;">
          <span class="stat-label">Most Valuable Player</span>
          {#if mvp && ((mvp.tournamentStats?.runs || 0) > 0 || (mvp.tournamentStats?.wickets || 0) > 0)}
            <span class="stat-value">{mvp.name}</span>
            <span style="color: var(--info); font-weight: bold;">{((mvp.tournamentStats?.runs || 0) * 1 + (mvp.tournamentStats?.wickets || 0) * 20)} MVP Pts</span>
          {:else}
            <span class="stat-value" style="color: var(--text-muted); font-size: 1rem;">N/A</span>
          {/if}
        </div>
      </div>
    </div>
  </section>
  
  <section class="squad-preview card">
    <div class="section-header">
      <h3>👥 Current Squad</h3>
      {#if phase !== 'match'}
        <button onclick={() => goto('/squad')} class="view-all" style="background: none; border: none; padding: 0; cursor: pointer;">Manage Squad →</button>
      {/if}
    </div>
    <div class="players-scroll-container">
      <div class="players-flex">
        {#each (userTeam?.players || []) as player}
          <div class="compact-player-card">
            <PlayerCard {player} teamColorPrimary={userTeam?.colorPrimary} teamColorSecondary={userTeam?.colorSecondary} />
          </div>
        {:else}
          <p class="no-players">No players in squad. Go to draft!</p>
        {/each}
      </div>
    </div>
  </section>
</div>

<!-- Match Result Modal for Auto-Simulate -->
{#if showMatchResultModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" style="z-index: 1000; padding: 14px;" onclick={closeMatchResultModal}>
    <div class="modal-content" style="max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; background: var(--bg-primary);" onclick={(e) => e.stopPropagation()}>
       <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
         <h2 style="margin: 0; font-family: 'Cinzel', serif; color: var(--warning);">Match Result</h2>
         <button class="btn-cancel" onclick={closeMatchResultModal}>Close & Continue</button>
       </div>
       
       {#if lastMatchResult}
          <div style="text-align: center; margin-bottom: 12px;">
            <h3 style="font-size: 1rem; color: var(--success); margin-bottom: 8px;">
               {lastMatchResult.winner === 'team1' ? teams.find(t=>t.id === lastMatchResult.team1Id)?.name : (lastMatchResult.winner === 'team2' ? teams.find(t=>t.id === lastMatchResult.team2Id)?.name : 'Draw')} Wins!
            </h3>
            <p style="font-size: 1.1rem; color: var(--text-secondary);">
               {lastSimulatedInnings1?.totalRuns}/{lastSimulatedInnings1?.wickets} vs {lastSimulatedInnings2?.totalRuns}/{lastSimulatedInnings2?.wickets}
            </p>
          </div>
       {/if}

       <div style="background: var(--bg-secondary); border-radius: 12px; padding: 14px;">
         {#if lastSimulatedInnings1 && lastSimulatedInnings2 && teams.length > 0}
            <MatchSummary 
              inningsList={[lastSimulatedInnings1, lastSimulatedInnings2]} 
              teams={teams} 
              matchComplete={true} 
              matchResult={lastMatchResult}
            />
         {/if}
       </div>
       
       <div style="margin-top: 12px; text-align: center;">
          <button class="btn-confirm" onclick={closeMatchResultModal} style="font-size: 1rem; padding: 14px 28px;">Continue Tournament</button>
       </div>
    </div>
  </div>
{/if}

<style>
  .dashboard { width: 100%; margin: 0 auto; padding: 0 16px; }
  
  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr; /* Single column for vertical stacking */
    gap: 10px;
    margin-bottom: 12px;
  }
  
  /* Remove grid-area assignments as they are not needed for a single column */
  .team-overview { margin-bottom: 12px; }
  .next-match-widget { margin-bottom: 12px; }
  .sponsorship-section { margin-bottom: 12px; }
  .schedule-section { margin-bottom: 12px; }
  .squad-preview { margin-bottom: 12px; }
  .player-stats-section { margin-bottom: 0; } /* Last item doesn't need margin-bottom */

  .ops-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .ops-card {
    position: relative;
    overflow: hidden;
    padding: 14px;
    border-radius: 20px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
      var(--bg-surface);
    border: 1px solid rgba(148, 163, 184, 0.14);
    box-shadow: none;
  }

  .ops-label {
    display: block;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 0.7rem;
  }

  .ops-value {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 0.45rem;
  }

  .ops-card p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .next-match-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; }
  .next-match-header h3 { font-size: 1.1rem; margin: 0; color: var(--accent-gold); }
  .next-match-day { background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; }
  .matchup-summary { display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 12px; }
  .team-display { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 40%; text-align: center; }
  .team-display.opponent { color: var(--danger); }
  .team-name { font-weight: 700; font-size: 1rem; }
  .team-strength { font-size: 0.8rem; letter-spacing: 2px; }
  .vs-text { font-family: 'Cinzel', serif; font-weight: 700; color: var(--text-muted); font-size: 1.1rem; }
  .match-venue { text-align: center; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 16px; font-style: italic; }
  .next-match-actions { display: flex; flex-direction: column; gap: 10px; }
  .btn-start-match { background: var(--success); color: white; text-align: center; padding: 14px; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 1rem; box-shadow: none; animation: pulse 2s infinite; display: block; }
  .btn-start-match:hover { background: #2ea043; color: white; transform: translateY(-2px); box-shadow: none; }
  .btn-auto-sim { background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 14px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-auto-sim:hover { background: var(--info); color: white; border-color: var(--info); }
  .no-next-match { text-align: center; padding: 28px 16px; color: var(--text-secondary); background: var(--bg-surface); border-radius: 8px; border: 1px dashed var(--border-color); }
  .opponent-avatar { width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--border-color); background: var(--bg-primary); margin-bottom: 4px; }
  
  @keyframes pulse {
    0% { box-shadow: none; }
    70% { box-shadow: none; }
    100% { box-shadow: none; }
  }

  .hero { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; }
  .hero h1 { font-size: 15px; margin-bottom: 4px; }
  .tagline { color: var(--text-secondary); font-size: 14px; }
  .season-badge { background: var(--success); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
  .team-overview { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .team-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .team-info h2 { font-size: 15px; margin-bottom: 4px; }
  .coach { color: var(--text-secondary); }
  .team-badges { display: flex; gap: 8px; }
  .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .win-rate { background: rgba(35, 134, 54, 0.2); color: var(--success); }
  .matches { background: var(--bg-tertiary); color: var(--text-secondary); }
  .sponsor { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  @media (max-width: 1024px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .stats-grid { grid-template-columns: 1fr; }
  }
  .stat-card { display: flex; align-items: center; gap: 10px; background: var(--bg-tertiary); padding: 14px; border-radius: 8px; }
  .stat-icon { font-size: 15px; }
  .stat-content { display: flex; flex-direction: column; }
  .stat-value { font-size: 16px; font-weight: 700; }
  .stat-label { font-size: 12px; color: var(--text-secondary); }
  .stat-card.budget .stat-value { color: var(--accent-dwarf); }
  .marketplace { margin-bottom: 12px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .view-all { font-size: 14px; color: var(--success); }
  .players-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .dashboard-footer { text-align: center; padding: 14px; }
  @media (max-width: 768px) { .stats-grid, .players-grid { grid-template-columns: repeat(2, 1fr); } .hero { flex-direction: column; gap: 10px; text-align: center; } .team-header { flex-direction: column; gap: 10px; } }
  
  .sponsorship-section { background: var(--bg-secondary); border: 2px solid var(--info); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
  .sponsor-desc { color: var(--text-secondary); margin-bottom: 16px; font-size: 14px; }
  .sponsor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; }
  @media (max-width: 768px) {
    .sponsor-grid { grid-template-columns: 1fr; }
  }
  .sponsor-card { background: var(--bg-tertiary); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; }
  .sponsor-card h4 { margin: 0 0 8px 0; font-size: 15px; color: var(--text-primary); }
  .sponsor-type { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-bottom: 12px; width: max-content; }
  .sponsor-type.bonus { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  .sponsor-type.performance { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
  .sponsor-type.hybrid { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
  .sponsor-terms { list-style: none; padding: 0; margin: 0 0 16px 0; font-size: 13px; color: var(--text-secondary); flex-grow: 1; }
  .sponsor-terms li { margin-bottom: 4px; }
  .sponsor-terms strong { color: var(--text-primary); }
  .accept-btn { background: var(--success); color: white; border: none; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: opacity 0.2s; }
  .accept-btn:hover { opacity: 0.9; }

  .schedule-section {
    background: var(--bg-secondary);
    border: 2px solid var(--accent-elf); /* Highlight border */
    border-radius: 12px;
    padding: 14px; /* Increased padding */
    margin-bottom: 12px;
    box-shadow: none; /* Add shadow */
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px; /* Increased margin */
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 15px;
  }
  .section-header h3 {
    font-size: 1rem; /* Larger font */
    color: var(--text-primary);
  }
  .day-info { padding: 14px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 12px; }
  .day-info.rest { border-left: 3px solid var(--warning); }
  .day-info.training { border-left: 33px solid var(--success); }
  .day-info.auction { border-left: 3px solid var(--info); }
  .day-type { font-weight: 600; display: block; }
  .day-desc { font-size: 13px; color: var(--text-secondary); }
  .matches-list { display: flex; flex-direction: column; gap: 8px; }
  .match-card { padding: 14px; background: var(--bg-tertiary); border-radius: 6px; border-left: 3px solid var(--border-color); }
  .match-card.user-match { border-left-color: var(--success); background: rgba(35, 134, 54, 0.1); }
  .match-card.completed { opacity: 0.7; }
  .match-teams { display: flex; gap: 8px; align-items: center; }
  .match-teams .team { font-weight: 500; }
  .match-teams .vs { color: var(--text-secondary); font-size: 12px; }
  .match-meta { display: flex; gap: 10px; font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
  .status-badge { padding: 2px 6px; border-radius: 3px; background: var(--bg-secondary); }
  .advance-btn { width: 100%; margin-top: 12px; padding: 14px; background: var(--info); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .advance-btn:hover { opacity: 0.9; }
  .no-matches { text-align: center; color: var(--text-secondary); padding: 14px; }
  
  /* Calendar UI Styles */
  
  .day-details { margin-top: 12px; padding-top: 16px; border-top: 1px dashed var(--border-color); }
  .day-details h4 { margin-bottom: 12px; font-size: 16px; }

  /* Squad Preview UI Styles */
  .players-scroll-container {
    overflow-x: auto;
    padding-bottom: 16px;
    margin-bottom: 12px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) var(--bg-secondary);
  }
  .players-scroll-container::-webkit-scrollbar { height: 8px; }
  .players-scroll-container::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
  .players-scroll-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
  
  .players-flex {
    display: flex;
    gap: 10px;
    flex-wrap: wrap; /* Allow items to wrap */
  }
  .compact-player-card {
    width: 100%; /* Make it take full width on small screens */
    max-width: 280px; /* But keep its maximum width */
    flex-shrink: 0;
  }
  .no-players { color: var(--text-secondary); font-style: italic; }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  .modal-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 14px;
    width: 100%;
    max-width: 900px;
    box-shadow: none;
  }

  @media (max-width: 1024px) {
    .ops-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .ops-strip {
      grid-template-columns: 1fr;
    }
  }
</style>
