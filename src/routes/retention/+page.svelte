<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { teamStore, playerStore, currentSeason, gamePhase } from '$lib/stores/gameState';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { Player } from '$lib/models/player';
  import type { Team } from '$lib/models/team';
  import { 
    isMegaAuction, 
    calculateRetentionCost, 
    MEGA_AUCTION_MAX_RETENTIONS, 
    MEGA_AUCTION_RETENTION_COSTS,
    MAX_SQUAD_SIZE,
    processRetentions,
    releaseUnretainedPlayersToPool
  } from '$lib/core/retentionSystem';

  let teams = $state<Team[]>([]);
  let userTeam = $derived(teams.find(t => t.isUserTeam));
  let season = $state(1);
  let isMega = $derived(isMegaAuction(season + 1)); // We are preparing for the NEXT season

  let selectedPlayerIds = $state<string[]>([]);
  let currentBudget = $state(100000);
  let errorMsg = $state('');

  onMount(() => {
    const unsubT = teamStore.subscribe(t => {
        teams = t;
        const ut = t.find(x => x.isUserTeam);
        if (ut) currentBudget = ut.budget;
    });
    const unsubS = currentSeason.subscribe(s => season = s);
    
    if ($gamePhase !== 'retention') {
        goto('/');
    }

    return () => { unsubT(); unsubS(); };
  });

  let totalCost = $derived.by(() => {
    if (!userTeam) return 0;
    let cost = 0;
    selectedPlayerIds.forEach((id, index) => {
       const p = userTeam.players.find(x => x.id === id);
       if (p) cost += calculateRetentionCost(index, p, isMega);
    });
    return cost;
  });

  let remainingBudget = $derived(currentBudget - totalCost);
  
  let maxAllowed = $derived(isMega ? MEGA_AUCTION_MAX_RETENTIONS : MAX_SQUAD_SIZE);

  function togglePlayer(id: string) {
    if (selectedPlayerIds.includes(id)) {
        selectedPlayerIds = selectedPlayerIds.filter(x => x !== id);
        errorMsg = '';
    } else {
        const p = userTeam?.players.find(x => x.id === id);
        if (p?.retiring) {
            errorMsg = `${p.name} is retiring and cannot be retained.`;
            setTimeout(() => errorMsg = '', 3000);
            return;
        }
        if (selectedPlayerIds.length >= maxAllowed) {
            errorMsg = `Cannot retain more than ${maxAllowed} players.`;
            setTimeout(() => errorMsg = '', 3000);
            return;
        }
        
        // Prevent if adding this player would exceed budget
        const nextCost = calculateRetentionCost(selectedPlayerIds.length, p!, isMega);
        if (totalCost + nextCost > currentBudget) {
            errorMsg = `Not enough budget to retain ${p?.name} ($${nextCost.toLocaleString()}).`;
            setTimeout(() => errorMsg = '', 3000);
            return;
        }

        selectedPlayerIds = [...selectedPlayerIds, id];
        errorMsg = '';
    }
  }

  function confirmRetentions() {
    if (!userTeam) return;
    
    const result = processRetentions(userTeam.id, selectedPlayerIds, isMega, currentBudget);
    
    if (result.success) {
        releaseUnretainedPlayersToPool();
        gamePhase.set('scouting'); // Transition to next phase
        goto('/scouting'); 
    } else {
        errorMsg = result.message;
        setTimeout(() => errorMsg = '', 3000);
    }
  }

  function formatCost(index: number, player: Player): string {
    return `$${calculateRetentionCost(index, player, isMega).toLocaleString()}`;
  }

</script>

<svelte:head>
  <title>Retention Board - Fantasy Cricket</title>
</svelte:head>

<div class="retention-page">
  <header class="page-header">
    <h1>{isMega ? 'Mega Auction' : 'Mini Auction'} Retention Board</h1>
    <p class="subtitle">Select the players you want to keep. Unselected players will be released into the global auction pool.</p>
    {#if isMega}
        <div class="mega-warning">
            ⚠️ <strong>Mega Auction Rules Apply!</strong> You can retain a maximum of {MEGA_AUCTION_MAX_RETENTIONS} players. Retention costs are strictly tiered: 
            {MEGA_AUCTION_RETENTION_COSTS.map(c => `$${(c/1000)}k`).join(', ')}.
        </div>
    {:else}
        <div class="mini-info">
            ℹ️ <strong>Mini Auction Rules Apply!</strong> You can retain as many players as you want up to your squad limit. The cost to retain is the player's current Market Value.
        </div>
    {/if}
  </header>

  {#if errorMsg}
    <div class="error-toast">{errorMsg}</div>
  {/if}

  {#if userTeam}
    <div class="retention-layout">
      <!-- Left Panel: Roster -->
      <div class="roster-panel">
        <h2>Your Squad ({userTeam.players.length})</h2>
        <div class="players-grid">
          {#each userTeam.players as player}
             <!-- Re-use PlayerCard but wrap it in a selectable container -->
             <button class="player-wrapper {selectedPlayerIds.includes(player.id) ? 'selected' : ''} {player.retiring ? 'disabled' : ''}" 
                     onclick={() => togglePlayer(player.id)}
                     disabled={player.retiring}>
                 
                 <div class="card-overlay">
                    {#if selectedPlayerIds.includes(player.id)}
                       <div class="selection-badge">✓ Retained ({selectedPlayerIds.indexOf(player.id) + 1})</div>
                    {:else if player.retiring}
                       <div class="selection-badge retiring">Retiring</div>
                    {/if}
                 </div>

                 <PlayerCard {player} hideAvailability={true} teamColorPrimary={userTeam?.colorPrimary} teamColorSecondary={userTeam?.colorSecondary} />
                 
                 <div class="retention-cost-preview">
                     {#if player.retiring}
                        <span class="cost retiring">Retiring</span>
                     {:else if isMega}
                        <span class="cost">Tiered Cost</span>
                        <span class="value">MV: ${player.marketValue.toLocaleString()}</span>
                     {:else}
                        <span class="cost">Retain Cost:</span>
                        <span class="value">${player.marketValue.toLocaleString()}</span>
                     {/if}
                 </div>
             </button>
          {/each}
        </div>
      </div>

      <!-- Right Panel: Financial Impact -->
      <div class="finance-panel">
        <div class="sticky-tracker">
            <h2>Retention Impact</h2>
            
            <div class="tracker-stats">
                <div class="stat-row">
                    <span>Starting Purse:</span>
                    <span class="value starting">${currentBudget.toLocaleString()}</span>
                </div>
                
                <div class="stat-row retentions-list">
                    <span>Retained Players ({selectedPlayerIds.length}/{maxAllowed}):</span>
                    {#each selectedPlayerIds as id, idx}
                        {@const p = userTeam.players.find(x => x.id === id)}
                        {#if p}
                            <div class="retained-player-line">
                                <span>{idx + 1}. {p.name}</span>
                                <span class="deduction">-{formatCost(idx, p)}</span>
                            </div>
                        {/if}
                    {/each}
                    {#if selectedPlayerIds.length === 0}
                        <div class="empty-state">No players selected</div>
                    {/if}
                </div>

                <div class="stat-row total-deduction">
                    <span>Total Retention Cost:</span>
                    <span class="value negative">-${totalCost.toLocaleString()}</span>
                </div>
                
                <div class="stat-row final-purse">
                    <span>Available Auction Purse:</span>
                    <span class="value positive">${remainingBudget.toLocaleString()}</span>
                </div>
            </div>

            <div class="action-container">
                <button class="btn-confirm" onclick={confirmRetentions}>
                    Confirm Retentions & Release Squad
                </button>
                <p class="warning-text">This action cannot be undone. All unselected players will enter the auction.</p>
            </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .retention-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 14px;
  }

  .page-header {
    margin-bottom: 16px;
    text-align: center;
  }

  .page-header h1 {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin-bottom: 16px;
  }

  .mega-warning {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid var(--warning);
    color: var(--warning);
    padding: 14px;
    border-radius: 8px;
    max-width: 800px;
    margin: 0 auto;
  }

  .mini-info {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid var(--info);
    color: var(--info);
    padding: 14px;
    border-radius: 8px;
    max-width: 800px;
    margin: 0 auto;
  }

  .error-toast {
    background: var(--danger);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 100;
    box-shadow: none;
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .retention-layout {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  /* Left Panel */
  .roster-panel {
    flex: 1;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 14px;
  }

  .roster-panel h2 {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .player-wrapper {
    position: relative;
    background: transparent;
    border: 3px solid transparent;
    border-radius: 12px;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    display: flex;
    flex-direction: column;
  }

  .player-wrapper:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: none;
  }

  .player-wrapper.selected {
    border-color: var(--success);
    box-shadow: none;
  }

  .player-wrapper.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: grayscale(100%);
  }

  .card-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
  }

  .selection-badge {
    background: var(--success);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 700;
    box-shadow: none;
  }

  .selection-badge.retiring {
    background: var(--danger);
  }

  .retention-cost-preview {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-top: none;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    padding: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: -4px; /* Pull up to attach to card */
  }

  .retention-cost-preview .cost { font-size: 0.85rem; color: var(--text-secondary); }
  .retention-cost-preview .value { font-weight: 700; color: var(--text-primary); }
  .retention-cost-preview .retiring { color: var(--danger); font-weight: 700; }

  /* Right Panel */
  .finance-panel {
    flex: 0 0 380px;
    position: relative;
  }

  .sticky-tracker {
    position: sticky;
    top: 24px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 14px;
    box-shadow: none;
  }

  .sticky-tracker h2 {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
    font-size: 1rem;
  }

  .tracker-stats {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
  }

  .stat-row .value { font-weight: 800; font-family: monospace; font-size: 1.1rem; }
  .value.starting { color: var(--text-primary); }
  .value.negative { color: var(--danger); }
  .value.positive { color: var(--success); font-size: 1rem; }

  .retentions-list {
    flex-direction: column;
    align-items: stretch;
    background: rgba(0,0,0,0.1);
    padding: 14px;
    border-radius: 8px;
    gap: 8px;
    border: 1px dashed var(--border-color);
  }

  .retentions-list > span {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
    font-weight: 600;
  }

  .retained-player-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.95rem;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .retained-player-line .deduction {
    color: var(--danger);
    font-family: monospace;
  }

  .empty-state {
    font-size: 0.9rem;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: 14px;
  }

  .total-deduction {
    padding-top: 16px;
    border-top: 2px solid var(--border-color);
  }

  .final-purse {
    margin-top: 8px;
    padding: 14px;
    background: rgba(35, 134, 54, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(35, 134, 54, 0.3);
  }

  .action-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-confirm {
    background: var(--success);
    color: white;
    font-size: 1rem;
    font-weight: 700;
    padding: 14px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: none;
    transition: transform 0.2s, background 0.2s;
    width: 100%;
  }

  .btn-confirm:hover {
    transform: translateY(-2px);
    background: #1e702e;
  }

  .warning-text {
    font-size: 0.85rem;
    color: var(--warning);
    text-align: center;
    margin: 0;
  }

  @media (max-width: 1024px) {
    .retention-layout {
        flex-direction: column;
    }
    .finance-panel {
        flex: auto;
        width: 100%;
        order: -1; /* Move to top on mobile */
    }
    .sticky-tracker {
        position: relative;
        top: 0;
    }
  }
</style>