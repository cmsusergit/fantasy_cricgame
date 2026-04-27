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
  
  <div class="standings-table">
    <h2>Standings</h2>
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
  
  <div class="matches-section">
    <div class="matches-header">
      <h2>Upcoming Matches</h2>
      <a href="/" class="button-link">Go to Dashboard to Advance Day</a>
    </div>
    
    <div class="matches-grid">
      {#each scheduledMatches as match}
        <div class="match-card">
          <div class="match-teams">
            <span>{match.team1Name}</span>
            <span class="vs">vs</span>
            <span>{match.team2Name}</span>
          </div>
          <span class="day-badge">Day {match.day}</span>
        </div>
      {/each}
    </div>
    
    {#if completedMatches.length > 0}
      <h3>Completed</h3>
      <div class="matches-grid">
        {#each completedMatches as match}
          <div class="match-card completed">
            <div class="match-teams">
              <span>{match.team1Name}</span>
              <span class="vs">vs</span>
              <span>{match.team2Name}</span>
            </div>
            {#if match.result}
            <span class="winner">
              Won by {match.result.winner === match.team1Id ? match.team1Name : match.team2Name}
            </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tournament-page {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  h1 { margin-bottom: 4px; }
  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 24px;
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
  
  @media (max-width: 768px) {
    .matches-grid {
      grid-template-columns: 1fr;
    }
  }
</style>