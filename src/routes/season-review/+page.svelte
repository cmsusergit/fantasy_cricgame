<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { teamStore, playerStore, currentSeason, gamePhase, saveCurrentGame } from '$lib/stores/gameState';
  import { processSeasonEnd, type SeasonAwards } from '$lib/core/seasonTransition';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { Player } from '$lib/models/player';
  import type { Team } from '$lib/models/team';

  let awards = $state<SeasonAwards | null>(null);
  let retiringPlayers = $state<Player[]>([]);
  let processing = $state(true);

  onMount(async () => {
    let teams: Team[] = [];
    let players: Player[] = [];
    
    // We need to run this outside of the reactive context to avoid loops
    const unsubT = teamStore.subscribe(t => teams = t);
    const unsubP = playerStore.subscribe(p => players = p);
    
    unsubT();
    unsubP();

    const userTeam = teams.find(t => t.isUserTeam);
    
    if (userTeam && $gamePhase === 'season_end') {
      awards = processSeasonEnd(teams, players, userTeam.id);
      
      // Fetch retiring players
      playerStore.subscribe(p => {
         retiringPlayers = p.filter(x => x.retiring);
      })();
      
      // Fetch updated budget after processSeasonEnd
      let updatedUserTeam: Team | undefined;
      teamStore.subscribe(t => { updatedUserTeam = t.find(x => x.isUserTeam); })();
      await saveCurrentGame(updatedUserTeam?.budget || 0); 
      processing = false;
    } else {
      // If we got here normally without being in season_end phase, go back
      if ($gamePhase !== 'season_end') {
         goto('/');
      }
    }
  });

  function proceedToOffSeason() {
    gamePhase.set('retention');
    goto('/retention');
  }
</script>

<svelte:head>
  <title>Season Review - Fantasy Cricket</title>
</svelte:head>

<div class="review-page">
  {#if processing}
    <div class="loading">
      <div class="spinner"></div>
      <h2>Processing Season Data...</h2>
    </div>
  {:else if awards}
    <header class="review-header">
      <h1>Season {$currentSeason} Completed!</h1>
      <p class="subtitle">Here is the review of the season</p>
    </header>

    <div class="dashboard-grid">
      <!-- Financials & Standings Summary -->
      <section class="panel financial-panel">
        <h2>Financial Review</h2>
        <div class="stat-card">
          <span class="label">Final Standing</span>
          <span class="value standing">{awards.finalStanding}</span>
        </div>
        <div class="stat-card highlight">
          <span class="label">Prize Money Earned</span>
          <span class="value money">+${awards.prizeMoney.toLocaleString()}</span>
        </div>
        <div class="stat-card negative">
          <span class="label">Salaries Paid</span>
          <span class="value money">-${(awards.salaryPaid || 0).toLocaleString()}</span>
        </div>
      </section>

      <!-- Awards -->
      <section class="panel awards-panel">
        <h2>Season Awards</h2>
        <div class="awards-grid">
          {#if awards.mvp}
            <div class="award-card mvp">
              <span class="award-title">🏆 Most Valuable Player</span>
              <PlayerCard player={awards.mvp} hideAvailability={true} />
            </div>
          {/if}
          {#if awards.topScorer}
            <div class="award-card">
              <span class="award-title">🏏 Top Run Scorer</span>
              <PlayerCard player={awards.topScorer} hideAvailability={true} />
            </div>
          {/if}
          {#if awards.topWicketTaker}
            <div class="award-card">
              <span class="award-title">🎯 Top Wicket Taker</span>
              <PlayerCard player={awards.topWicketTaker} hideAvailability={true} />
            </div>
          {/if}
        </div>
      </section>

      <!-- Retirements -->
      {#if retiringPlayers.length > 0}
        <section class="panel retirements-panel">
          <h2>Player Retirements</h2>
          <p class="info-text">The following players have announced their retirement from all formats of the game.</p>
          <div class="retiring-grid">
            {#each retiringPlayers.slice(0, 4) as p}
               <div class="retired-item">
                  <span class="name">{p.name}</span>
                  <span class="age">Age {p.age}</span>
               </div>
            {/each}
            {#if retiringPlayers.length > 4}
               <div class="retired-item more">...and {retiringPlayers.length - 4} more</div>
            {/if}
          </div>
        </section>
      {/if}
    </div>

    <div class="actions">
      <button class="btn-primary" onclick={proceedToOffSeason}>Proceed to Off-Season</button>
    </div>
  {/if}
</div>

<style>
  .review-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid var(--accent-dwarf);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin { 100% { transform: rotate(360deg); } }

  .review-header {
    text-align: center;
    margin-bottom: 12px;
    background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
    padding: 14px;
    border-radius: 16px;
    border: 1px solid var(--border-color);
  }

  .review-header h1 {
    font-size: 1rem;
    color: var(--warning);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  .panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 14px;
  }

  .panel h2 {
    font-size: 1rem;
    margin-bottom: 16px;
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 10px;
  }

  .stat-card {
    background: var(--bg-tertiary);
    padding: 14px;
    border-radius: 8px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-card.highlight {
    border-color: var(--success);
    background: rgba(35, 134, 54, 0.1);
  }

  .stat-card.negative {
    border-color: var(--danger);
    background: rgba(218, 54, 51, 0.1);
  }

  .stat-card .label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .stat-card .value {
    font-size: 1rem;
    font-weight: 800;
    font-family: monospace;
  }

  .stat-card .money { color: var(--success); }
  .stat-card.negative .money { color: var(--danger); }
  .stat-card .standing { color: var(--info); }

  .awards-grid {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .award-card {
    flex: 1;
    min-width: 250px;
    background: var(--bg-tertiary);
    padding: 14px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .award-card.mvp {
    border: 2px solid var(--warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .award-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    text-align: center;
  }

  .retirements-panel {
    grid-column: 1 / -1;
  }

  .info-text {
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .retiring-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .retired-item {
    background: var(--bg-tertiary);
    padding: 16px 20px;
    border-radius: 6px;
    display: flex;
    gap: 10px;
    align-items: center;
    border-left: 3px solid var(--danger);
  }

  .retired-item .name { font-weight: 600; }
  .retired-item .age { color: var(--text-muted); font-size: 0.85rem; }
  .retired-item.more { border-left: none; background: transparent; font-style: italic; }

  .actions {
    display: flex;
    justify-content: center;
    margin-top: 12px;
  }

  .btn-primary {
    background: var(--success);
    color: white;
    font-size: 1rem;
    font-weight: 700;
    padding: 16px 32px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: none;
    transition: transform 0.2s;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    background: #1e702e;
  }

  @media (max-width: 900px) {
    .dashboard-grid { grid-template-columns: 1fr; }
  }
</style>