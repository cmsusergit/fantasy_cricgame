<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeGame, resetGame, teamStore, playerStore, tournamentStore, scheduleStore } from '$lib/stores/gameState';
  import { getMatchesForDay, simulateAllMatchesForDay } from '$lib/core/schedule';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { TournamentSchedule, GameDay, ScheduledMatch } from '$lib/core/schedule';
  
  let teams = $state<any[]>([]);
  let players = $state<any[]>([]);
  let schedule = $state<TournamentSchedule | null>(null);
  let day = $state(1);
  let budget = $state(100000);
  let selectedDay = $state(1);
  
  onMount(() => {
    
    const unsubTeam = teamStore.subscribe(t => {
      teams = t;
      const user = t.find((team: any) => team.isUserTeam);
      if (user) budget = user.budget;
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
  
  let currentDayGames = $derived(schedule ? getMatchesForDay(schedule, selectedDay) : []);
  let dayInfo = $derived(schedule?.days.find(d => d.day === selectedDay));
  let userNextMatch = $derived(schedule?.matches.find(m => 
    m.status === 'scheduled' && (m.team1Id === 'user_team' || m.team2Id === 'user_team')
  ));
  
  function advanceTournament() {
    if (!schedule || !teams.length) return;
    
    const currentDay = schedule.currentDay;
    const nextDay = currentDay + 1;
    
    const updatedSchedule = simulateAllMatchesForDay(schedule, currentDay, teams);
    updatedSchedule.currentDay = nextDay;
    scheduleStore.set(updatedSchedule);

    const newlyCompletedMatches = updatedSchedule.matches.filter(m => m.day === currentDay && m.status === 'completed' && m.result);
    
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
              if (match.result.winner === t1.id) {
                  nextStore[t1Index] = { ...t1, wins: t1.wins + 1, matchesPlayed: t1.matchesPlayed + 1, runsFor: t1.runsFor + match.result.team1Score, runsAgainst: t1.runsAgainst + match.result.team2Score };
                  nextStore[t2Index] = { ...t2, losses: t2.losses + 1, matchesPlayed: t2.matchesPlayed + 1, runsFor: t2.runsFor + match.result.team2Score, runsAgainst: t2.runsAgainst + match.result.team1Score };
              } else if (match.result.winner === t2.id) {
                  nextStore[t2Index] = { ...t2, wins: t2.wins + 1, matchesPlayed: t2.matchesPlayed + 1, runsFor: t2.runsFor + match.result.team2Score, runsAgainst: t2.runsAgainst + match.result.team1Score };
                  nextStore[t1Index] = { ...t1, losses: t1.losses + 1, matchesPlayed: t1.matchesPlayed + 1, runsFor: t1.runsFor + match.result.team1Score, runsAgainst: t1.runsAgainst + match.result.team2Score };
              }
          }
      }

      return nextStore;
    });
  }
</script>

<svelte:head>
  <title>Fantasy Cricket Grand Manager</title>
</svelte:head>

<div class="dashboard">
  <header class="hero">
    <div class="hero-content">
      <h1>🏏 Fantasy Cricket</h1>
      <p class="tagline">Grand Manager v1.4.2</p>
    </div>
    <div class="season-badge">
      <span>Season 2026</span>
    </div>
  </header>

  {#if userTeam}
    <section class="team-overview">
      <div class="team-header">
        <div class="team-info" style="display: flex; gap: 16px; align-items: center;">
          {#if userTeam.logo}
            <img src={userTeam.logo} alt="Team Logo" style="width: 56px; height: 56px; border-radius: 12px; object-fit: cover;" />
          {/if}
          <div>
            <h2 style="margin-bottom: 0;">{userTeam.name}</h2>
            <span class="coach">{userTeam.coach}</span>
          </div>
        </div>
        <div class="team-badges">
          <span class="badge win-rate">{winRate}% Win Rate</span>
          <span class="badge matches">{userTeam.matchesPlayed || 0} Matches</span>
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card budget">
          <span class="stat-icon">💰</span>
          <div class="stat-content">
            <span class="stat-value">${budget.toLocaleString()}</span>
            <span class="stat-label">Budget</span>
          </div>
        </div>
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
  {/if}

  {#if schedule}
    <section class="schedule-section">
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
                <span class="team">{match.team1Name}</span>
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
      
      <button class="advance-btn" onclick={advanceTournament}>
        Advance to Day {schedule.currentDay + 1}
      </button>
    </section>
  {/if}

  <section class="squad-preview">
    <div class="section-header">
      <h3>👥 Current Squad</h3>
      <a href="/squad" class="view-all">Manage Squad →</a>
    </div>
    <div class="players-scroll-container">
      <div class="players-flex">
        {#each (userTeam?.players || []) as player}
          <div class="compact-player-card">
            <PlayerCard {player} />
          </div>
        {:else}
          <p class="no-players">No players in squad. Go to draft!</p>
        {/each}
      </div>
    </div>
  </section>

  {#if availablePlayers.length > 0}
    <section class="marketplace">
      <div class="section-header">
        <h3>Transfer Market</h3>
        <a href="/draft" class="view-all">View All →</a>
      </div>
      <div class="players-grid">
        {#each availablePlayers.slice(0, 4) as player}
          <PlayerCard {player} showPrice />
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard { max-width: 1100px; margin: 0 auto; }
  .hero { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px 32px; margin-bottom: 24px; }
  .hero h1 { font-size: 32px; margin-bottom: 4px; }
  .tagline { color: var(--text-secondary); font-size: 14px; }
  .season-badge { background: var(--success); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 600; }
  .team-overview { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .team-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .team-info h2 { font-size: 24px; margin-bottom: 4px; }
  .coach { color: var(--text-secondary); }
  .team-badges { display: flex; gap: 8px; }
  .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .win-rate { background: rgba(35, 134, 54, 0.2); color: var(--success); }
  .matches { background: var(--bg-tertiary); color: var(--text-secondary); }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .stat-card { display: flex; align-items: center; gap: 12px; background: var(--bg-tertiary); padding: 16px; border-radius: 8px; }
  .stat-icon { font-size: 24px; }
  .stat-content { display: flex; flex-direction: column; }
  .stat-value { font-size: 20px; font-weight: 700; }
  .stat-label { font-size: 12px; color: var(--text-secondary); }
  .stat-card.budget .stat-value { color: var(--accent-dwarf); }
  .marketplace { margin-bottom: 24px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .view-all { font-size: 14px; color: var(--success); }
  .players-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .dashboard-footer { text-align: center; padding: 20px; }
  @media (max-width: 768px) { .stats-grid, .players-grid { grid-template-columns: repeat(2, 1fr); } .hero { flex-direction: column; gap: 16px; text-align: center; } .team-header { flex-direction: column; gap: 12px; } }
  .schedule-section {
    background: var(--bg-secondary);
    border: 2px solid var(--accent-elf); /* Highlight border */
    border-radius: 12px;
    padding: 24px; /* Increased padding */
    margin-bottom: 24px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); /* Add shadow */
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px; /* Increased margin */
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 15px;
  }
  .section-header h3 {
    font-size: 1.5rem; /* Larger font */
    color: var(--text-primary);
  }
  .day-info { padding: 12px; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 16px; }
  .day-info.rest { border-left: 3px solid var(--warning); }
  .day-info.training { border-left: 33px solid var(--success); }
  .day-info.auction { border-left: 3px solid var(--info); }
  .day-type { font-weight: 600; display: block; }
  .day-desc { font-size: 13px; color: var(--text-secondary); }
  .matches-list { display: flex; flex-direction: column; gap: 8px; }
  .match-card { padding: 12px; background: var(--bg-tertiary); border-radius: 6px; border-left: 3px solid var(--border-color); }
  .match-card.user-match { border-left-color: var(--success); background: rgba(35, 134, 54, 0.1); }
  .match-card.completed { opacity: 0.7; }
  .match-teams { display: flex; gap: 8px; align-items: center; }
  .match-teams .team { font-weight: 500; }
  .match-teams .vs { color: var(--text-secondary); font-size: 12px; }
  .match-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
  .status-badge { padding: 2px 6px; border-radius: 3px; background: var(--bg-secondary); }
  .advance-btn { width: 100%; margin-top: 12px; padding: 12px; background: var(--info); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
  .advance-btn:hover { opacity: 0.9; }
  .no-matches { text-align: center; color: var(--text-secondary); padding: 20px; }
  
  /* Calendar UI Styles */
  
  .day-details { margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-color); }
  .day-details h4 { margin-bottom: 12px; font-size: 16px; }

  /* Squad Preview UI Styles */
  .players-scroll-container {
    overflow-x: auto;
    padding-bottom: 16px;
    margin-bottom: 24px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) var(--bg-secondary);
  }
  .players-scroll-container::-webkit-scrollbar { height: 8px; }
  .players-scroll-container::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
  .players-scroll-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
  
  .players-flex {
    display: flex;
    gap: 16px;
    width: max-content;
  }
  .compact-player-card {
    width: 280px;
    flex-shrink: 0;
  }
  .no-players { color: var(--text-secondary); font-style: italic; }
</style>