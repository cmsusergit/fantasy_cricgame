<script lang="ts">
  import { onMount } from 'svelte';
  import { teamStore } from '$lib/stores/gameState';
  import type { Team } from '$lib/models/team';

  let userTeam = $state<Team | null>(null);

  onMount(() => {
    const unsub = teamStore.subscribe(teams => {
      userTeam = teams.find(t => t.isUserTeam) || null;
    });
    return unsub;
  });

  let totalSquadValue = $derived(userTeam?.players.reduce((sum, p) => sum + p.price, 0) || 0);
  let totalPlayerSalaries = $derived(userTeam?.players.reduce((sum, p) => sum + p.price * 0.05, 0) || 0); // Assuming 5% of market value as annual salary
  let totalStaffSalaries = $derived(250000); // Placeholder for staff salaries
  let totalMatchEarningsEst = $derived((userTeam?.matchesPlayed || 0) * 10000 + (userTeam?.wins || 0) * 50000);
</script>

<svelte:head>
  <title>Budget & Finance - Fantasy Cricket</title>
</svelte:head>

<div class="budget-page">
  <div class="header">
    <h1>Finance Hub</h1>
    <a href="/" class="back-btn">← Back to Dashboard</a>
  </div>

  {#if userTeam}
    <div class="summary-cards">
      <div class="card current-balance">
        <h3>Current Balance</h3>
        <div class="amount">${userTeam.budget.toLocaleString()}</div>
      </div>
      <div class="card squad-value">
        <h3>Total Squad Value</h3>
        <div class="amount">${totalSquadValue.toLocaleString()}</div>
      </div>
      <div class="card match-earnings">
        <h3>Est. Match Earnings</h3>
        <div class="amount">${totalMatchEarningsEst.toLocaleString()}</div>
      </div>
    </div>

    <div class="details-grid">
      <section class="income-section">
        <h2>Income Overview</h2>
        <div class="income-item">
          <span class="label">Estimated Match Earnings:</span>
          <span class="value money">${totalMatchEarningsEst.toLocaleString()}</span>
        </div>
        {#if userTeam.sponsorships && userTeam.sponsorships.length > 0}
          <div class="income-item">
            <span class="label">Sponsorships:</span>
            <span class="value money">${userTeam.sponsorships.reduce((sum, s) => sum + s.earned, 0).toLocaleString()}</span>
          </div>
        {/if}
        <!-- Add other income sources here -->
      </section>

      <section class="expenditure-section">
        <h2>Expenditure Overview</h2>
        <div class="expenditure-item">
          <span class="label">Player Salaries (Annual):</span>
          <span class="value money">-${totalPlayerSalaries.toLocaleString()}</span>
        </div>
        <div class="expenditure-item">
          <span class="label">Staff Salaries (Annual):</span>
          <span class="value money">-${totalStaffSalaries.toLocaleString()}</span>
        </div>
        <!-- Add other expenditure items here -->
      </section>
      
      <section class="sponsors-section">
        <h2>Active Sponsorships</h2>
        {#if userTeam.sponsorships && userTeam.sponsorships.length > 0}
          <div class="sponsor-list">
            {#each userTeam.sponsorships as sponsor}
              <div class="sponsor-card {sponsor.type}">
                <div class="sponsor-header">
                  <h4>{sponsor.sponsorName}</h4>
                  <span class="badge {sponsor.type}">{sponsor.type.toUpperCase()}</span>
                </div>
                <div class="sponsor-stats">
                  <div class="stat">
                    <span class="label">Matches Left</span>
                    <span class="value">{sponsor.matches - sponsor.matchesPlayed}</span>
                  </div>
                  <div class="stat">
                    <span class="label">Total Earned</span>
                    <span class="value money">${sponsor.earned.toLocaleString()}</span>
                  </div>
                </div>
                <div class="sponsor-terms">
                  <p><strong>Base Bonus:</strong> ${sponsor.bonusAmount.toLocaleString()} per match</p>
                  <p><strong>Performance Bonus:</strong> Up to ${Math.round(sponsor.performanceBonus * 1.5).toLocaleString()}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="no-data">No active sponsorships.</p>
        {/if}
      </section>

      <section class="players-section">
        <h2>Squad Valuation</h2>
        <div class="player-list">
          {#each [...userTeam.players].sort((a, b) => b.price - a.price) as player}
            <div class="player-row">
              <span class="name">{player.name}</span>
              <span class="role">{player.role}</span>
              <span class="price money">${player.price.toLocaleString()}</span>
            </div>
          {/each}
        </div>
      </section>
    </div>
  {:else}
    <div class="loading">Loading Finance Data...</div>
  {/if}
</div>

<style>
  .budget-page { max-width: 1000px; margin: 0 auto; padding: 14px; font-family: sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .header h1 { margin: 0; color: var(--text-primary); font-size: 1rem; }
  .back-btn { color: var(--text-secondary); text-decoration: none; font-weight: bold; }
  .back-btn:hover { color: var(--text-primary); }

  .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .card { background: var(--bg-secondary); padding: 14px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center; }
  .card h3 { margin: 0 0 12px 0; color: var(--text-secondary); font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; }
  .card .amount { font-size: 1rem; font-weight: 900; font-family: monospace; }
  
  .current-balance { border-color: var(--success); background: rgba(34, 197, 94, 0.05); }
  .current-balance .amount { color: var(--success); }
  .squad-value .amount { color: var(--info); }
  .match-earnings .amount { color: var(--warning); }

  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 768px) { .details-grid { grid-template-columns: 1fr; } }

  h2 { margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 12px; }

  .sponsor-list { display: flex; flex-direction: column; gap: 10px; }
  .sponsor-card { background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; }
  .sponsor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .sponsor-header h4 { margin: 0; font-size: 1.1rem; }
  .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
  .badge.bonus { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  .badge.performance { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
  .badge.hybrid { background: rgba(168, 85, 247, 0.2); color: #c084fc; }

  .sponsor-stats { display: flex; gap: 10px; margin-bottom: 12px; padding: 14px; background: rgba(0,0,0,0.2); border-radius: 6px; }
  .stat { display: flex; flex-direction: column; }
  .stat .label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 4px; }
  .stat .value { font-weight: bold; font-size: 1rem; }

  .sponsor-terms p { margin: 4px 0; font-size: 0.9rem; color: var(--text-secondary); }
  .sponsor-terms strong { color: var(--text-primary); }

  .player-list { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
  .player-row { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-color); }
  .player-row:last-child { border-bottom: none; }
  .player-row:nth-child(even) { background: var(--bg-tertiary); }
  .player-row .name { flex: 2; font-weight: 600; }
  .player-row .role { flex: 1; color: var(--text-secondary); font-size: 0.9rem; }
  .player-row .price { flex: 1; text-align: right; }

  .money { font-family: monospace; color: var(--success); }
  .no-data { color: var(--text-muted); font-style: italic; }

  .income-section, .expenditure-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
  }
  .income-item, .expenditure-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border-color);
  }
  .income-item:last-child, .expenditure-item:last-child {
    border-bottom: none;
  }
  .income-item .label, .expenditure-item .label {
    color: var(--text-secondary);
  }
  .income-item .value, .expenditure-item .value {
    font-weight: bold;
  }
  .expenditure-item .value {
    color: var(--danger);
  }
</style>