<script lang="ts">
  import { onMount } from 'svelte';
  import { teamStore, scheduleStore } from '$lib/stores/gameState';
  import { calculateStandings } from '$lib/core/tournamentSim';
  import type { Team } from '$lib/models/team';
  import type { TournamentSchedule, ScheduledMatch } from '$lib/core/schedule';
  
  let teams = $state<Team[]>([]);
  let schedule = $state<TournamentSchedule | null>(null);
  let standings = $state<any[]>([]);
  
  onMount(() => {
    const unsubT = teamStore.subscribe(t => {
      teams = t;
      standings = calculateStandings(t);
    });
    const unsubS = scheduleStore.subscribe(s => matches = s);
    
    return () => {
      unsubT();
      unsubS();
    };
  });
  
  let userTeam = $derived(teams.find(t => t.isUserTeam));
  let userStandings = $derived(standings.find(s => s.teamId === userTeam?.id));
  
  let matches = $state<TournamentSchedule | null>(null);
  
  let allMatches = $derived(matches?.matches || []);
  let scheduledMatches = $derived(allMatches.filter(m => m.status === 'scheduled').slice(0, 10));
  let completedMatches = $derived([...allMatches.filter(m => m.status === 'completed')].reverse().slice(0, 10));

  let activeTab = $state('standings');
  let scheduleFilterTeam = $state('all');

  let filteredSchedule = $derived((() => {
    let result = allMatches;
    if (scheduleFilterTeam !== 'all') {
      result = result.filter(m => m.team1Id === scheduleFilterTeam || m.team2Id === scheduleFilterTeam);
    }
    
    // Group by day
    const grouped = new Map<number, ScheduledMatch[]>();
    for (const m of result) {
      if (!grouped.has(m.day)) grouped.set(m.day, []);
      grouped.get(m.day)!.push(m);
    }
    
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  })());

  let topRunScorers = $derived((() => {
    const allPlayers = teams.flatMap(t => t.players.map(p => ({...p, teamName: t.name})));
    return allPlayers.sort((a, b) => (b.tournamentStats?.runs || 0) - (a.tournamentStats?.runs || 0)).slice(0, 10);
  })());

  let topWicketTakers = $derived((() => {
    const allPlayers = teams.flatMap(t => t.players.map(p => ({...p, teamName: t.name})));
    return allPlayers.sort((a, b) => (b.tournamentStats?.wickets || 0) - (a.tournamentStats?.wickets || 0)).slice(0, 10);
  })());
</script>

<svelte:head>
  <title>Tournament - Fantasy Cricket</title>
</svelte:head>

<div class="tournament-page">
  <h1>🏆 Tournament</h1>
  <p class="subtitle">8-Team Round Robin (Advance Days in Dashboard)</p>
  
  {#if userStandings}
    <div class="user-standings">
      <span class="position">#{standings.indexOf(userStandings) + 1}</span>
      <span class="team-name">{userTeam?.name}</span>
      <span class="stats">{userStandings.wins}W - {userStandings.losses}L</span>
    </div>
  {/if}
  
  <div class="tabs">
    <button class:active={activeTab === 'standings'} onclick={() => activeTab = 'standings'}>Standings</button>
    <button class:active={activeTab === 'schedule'} onclick={() => activeTab = 'schedule'}>Full Schedule</button>
    <button class:active={activeTab === 'leaders'} onclick={() => activeTab = 'leaders'}>League Leaders</button>
  </div>

  {#if activeTab === 'standings'}
    <div class="standings-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>L</th>
            <th>Points</th>
            <th>NRR</th>
          </tr>
        </thead>
        <tbody>
          {#each standings as standing, i}
            <tr class:user-team={standing.teamId === userTeam?.id}>
              <td>{i + 1}</td>
              <td>{standing.teamName}</td>
              <td>{standing.played}</td>
              <td>{standing.wins}</td>
              <td>{standing.losses}</td>
              <td>{standing.points}</td>
              <td>{standing.nrr.toFixed(3)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if activeTab === 'schedule'}
    <div class="schedule-tab">
      <div class="schedule-filters">
        <label>Filter by Team:</label>
        <select bind:value={scheduleFilterTeam}>
          <option value="all">All Teams</option>
          {#each teams as t}
            <option value={t.id}>{t.name}</option>
          {/each}
        </select>
      </div>

      <div class="full-schedule-list">
        {#each filteredSchedule as [day, dayMatches]}
          <div class="schedule-day-group">
            <h3 class="day-header">Day {day}</h3>
            <div class="matches-grid">
              {#each dayMatches as match}
                <div class="match-card {match.status === 'completed' ? 'completed' : ''}" class:user-match={match.team1Id === userTeam?.id || match.team2Id === userTeam?.id}>
                  <div class="match-teams">
                    <span>{match.team1Name} <span class="home-tag">(Home)</span></span>
                    <span class="vs">vs</span>
                    <span>{match.team2Name}</span>
                  </div>
                  {#if match.status === 'completed' && match.result}
                    <span class="winner">
                      Won by {match.result.winner === match.team1Id ? match.team1Name : match.team2Name}
                    </span>
                  {:else}
                    <span class="day-badge">Scheduled</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if activeTab === 'leaders'}
    <div class="leaders-tab">
      <div class="leaderboard-grid">
        <div class="leaderboard-card">
          <h2>🏏 Top Run Scorers</h2>
          <table>
            <thead><tr><th>Player</th><th>Team</th><th>Runs</th></tr></thead>
            <tbody>
              {#each topRunScorers as p, i}
                <tr>
                  <td><strong>{i+1}.</strong> {p.name}</td>
                  <td style="font-size: 0.8em; color: var(--text-secondary);">{p.teamName}</td>
                  <td><strong>{p.tournamentStats?.runs || 0}</strong></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="leaderboard-card">
          <h2>🎯 Top Wicket Takers</h2>
          <table>
            <thead><tr><th>Player</th><th>Team</th><th>Wickets</th></tr></thead>
            <tbody>
              {#each topWicketTakers as p, i}
                <tr>
                  <td><strong>{i+1}.</strong> {p.name}</td>
                  <td style="font-size: 0.8em; color: var(--text-secondary);">{p.teamName}</td>
                  <td><strong>{p.tournamentStats?.wickets || 0}</strong></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tournament-page {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  h1 { margin-bottom: 4px; }
  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 32px;
  }
  
  .home-tag {
    font-size: 0.7em;
    color: var(--text-secondary);
    font-weight: normal;
    background: var(--bg-tertiary);
    padding: 2px 4px;
    border-radius: 4px;
    margin-left: 4px;
  }
  
  .user-standings {
    display: flex;
    align-items: center;
    gap: 16px;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
    border: 2px solid var(--success);
    border-radius: 8px;
    padding: 16px 24px;
    margin-bottom: 24px;
  }
  
  .user-standings .position {
    font-size: 24px;
    font-weight: 700;
  }
  
  .user-standings .team-name {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
  }
  
  .user-standings .stats {
    color: var(--text-secondary);
  }
  
  .standings-table {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 32px;
  }
  
  .standings-table h2 {
    margin-bottom: 16px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }
  
  th {
    color: var(--text-secondary);
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .user-team {
    background: rgba(35, 134, 54, 0.1);
  }
  
  .matches-section h2 {
    margin-bottom: 16px;
  }
  
  .matches-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .matches-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .match-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .match-card.completed {
    opacity: 0.7;
  }
  
  .match-teams {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }
  
  .match-teams .vs {
    color: var(--text-secondary);
  }
  
  .winner {
    font-size: 12px;
    color: var(--success);
    font-weight: 600;
  }

  .day-badge {
    font-size: 12px;
    background: var(--bg-tertiary);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .button-link {
    background: var(--info);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
  }
  
  .matches-section h3 {
    margin-bottom: 12px;
    color: var(--text-secondary);
  }
  
  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }
  
  .tabs button {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    padding: 8px 16px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
  }
  
  .tabs button.active {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-weight: 600;
  }

  .schedule-filters {
    margin-bottom: 24px;
  }
  
  .schedule-filters select {
    padding: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-radius: 4px;
    margin-left: 8px;
  }

  .schedule-day-group {
    margin-bottom: 32px;
  }
  
  .day-header {
    margin-bottom: 12px;
    color: var(--text-muted);
    border-bottom: 1px dashed var(--border-color);
    padding-bottom: 4px;
  }

  .user-match {
    border-color: var(--success) !important;
  }

  .leaderboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  
  .leaderboard-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
  }
  
  .leaderboard-card h2 {
    margin-bottom: 16px;
    font-size: 18px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  @media (max-width: 768px) {
    .matches-grid {
      grid-template-columns: 1fr;
    }
    .leaderboard-grid {
      grid-template-columns: 1fr;
    }
  }
</style>