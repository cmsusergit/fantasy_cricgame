<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { teamStore, playerStore, currentSeason, gamePhase, saveCurrentGame } from '$lib/stores/gameState';
  import { generatePlayerPool } from '$lib/core/draftAI';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { Player } from '$lib/models/player';
  import type { Team } from '$lib/models/team';

  const SCOUT_COST = 500;

  let teams = $state<Team[]>([]);
  let userTeam = $derived(teams.find(t => t.isUserTeam));
  let season = $state(1);
  let players = $state<Player[]>([]);
  
  let youthPlayers = $derived(players.filter(p => !p.isScouted && p.age <= 20));
  let currentBudget = $state(100000);
  let errorMsg = $state('');
  let successMsg = $state('');

  onMount(() => {
    const unsubT = teamStore.subscribe(t => {
        teams = t;
        const ut = t.find(x => x.isUserTeam);
        if (ut) currentBudget = ut.budget;
    });
    const unsubP = playerStore.subscribe(p => players = p);
    const unsubS = currentSeason.subscribe(s => season = s);
    
    if ($gamePhase !== 'scouting') {
        goto('/');
    }

    // Generate youth academy players if they don't exist for this season
    if (youthPlayers.length === 0) {
        const newYouths = generatePlayerPool(12, true); // Generate 12 youth players
        playerStore.update(p => [...p, ...newYouths]);
    }

    return () => { unsubT(); unsubP(); unsubS(); };
  });

  async function scoutPlayer(playerId: string) {
    if (currentBudget < SCOUT_COST) {
        errorMsg = `Not enough budget. Scouting costs $${SCOUT_COST}.`;
        setTimeout(() => errorMsg = '', 3000);
        return;
    }

    // Deduct cost
    teamStore.update(tStore => 
        tStore.map(t => {
            if (t.isUserTeam) return { ...t, budget: t.budget - SCOUT_COST };
            return t;
        })
    );

    // Reveal player stats
    playerStore.update(pStore => 
        pStore.map(p => {
            if (p.id === playerId) return { ...p, isScouted: true };
            return p;
        })
    );
    
    await saveCurrentGame(currentBudget - SCOUT_COST);

    successMsg = 'Scout report completed!';
    setTimeout(() => successMsg = '', 2000);
  }

  function proceedToAuction() {
    gamePhase.set('auction');
    goto('/auction');
  }

</script>

<svelte:head>
  <title>Youth Academy Scouting - Fantasy Cricket</title>
</svelte:head>

<div class="scouting-page">
  <header class="page-header">
    <h1>Youth Academy & Scouting</h1>
    <p class="subtitle">Season {season + 1} Draft Prospects</p>
    
    <div class="budget-panel">
        <span class="budget-label">Available Budget:</span>
        <span class="budget-value">${currentBudget.toLocaleString()}</span>
    </div>
  </header>

  {#if errorMsg}
    <div class="toast error">{errorMsg}</div>
  {/if}
  {#if successMsg}
    <div class="toast success">{successMsg}</div>
  {/if}

  <div class="info-banner">
    ℹ️ <strong>Scouting Network:</strong> These young prospects (Age 18-20) are entering the upcoming auction. Their true stats and potential are hidden. Send a scout for <strong>${SCOUT_COST}</strong> to reveal their exact attributes.
  </div>

  <div class="players-grid">
    {#each youthPlayers as player}
      <div class="scout-card">
         <div class="player-header">
            <span class="faction-icon">{player.faction === 'human' ? '⚔' : player.faction === 'elf' ? '🌿' : player.faction === 'orc' ? '🪓' : player.faction === 'dwarf' ? '⛏' : player.faction === 'goblin' ? '💎' : '🌙'}</span>
            <div class="player-info">
              <span class="name">{player.name}</span>
              <span class="role">{player.role} • Age {player.age}</span>
            </div>
         </div>
         
         <div class="hidden-stats">
            <div class="mystery-box">
                <span class="question-mark">?</span>
                <span class="mystery-text">Stats Unknown</span>
            </div>
            <p class="estimate-text">Projected Role: {player.battingRole || player.bowlingType}</p>
         </div>

         <button class="btn-scout" onclick={() => scoutPlayer(player.id)}>
            🔍 Send Scout (${SCOUT_COST})
         </button>
      </div>
    {/each}
    {#if youthPlayers.length === 0}
      <div class="empty-state">
         <h3>All prospects scouted!</h3>
         <p>You have full visibility on all upcoming youth players.</p>
      </div>
    {/if}
  </div>

  <div class="actions">
    <button class="btn-primary large" onclick={proceedToAuction}>Proceed to Auction</button>
  </div>
</div>

<style>
  .scouting-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px;
  }

  .page-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 16px;
  }

  .page-header h1 {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-bottom: 16px;
  }

  .budget-panel {
    background: rgba(35, 134, 54, 0.15);
    border: 1px solid var(--success);
    padding: 12px 24px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .budget-label { color: var(--text-secondary); font-size: 0.9rem; text-transform: uppercase; }
  .budget-value { color: var(--success); font-size: 1rem; font-weight: 800; font-family: monospace; }

  .info-banner {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid var(--info);
    color: var(--info);
    padding: 16px 24px;
    border-radius: 8px;
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .toast {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    z-index: 100;
    box-shadow: none;
    animation: slideIn 0.3s ease-out;
  }

  .toast.error { background: var(--danger); }
  .toast.success { background: var(--success); }

  @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .scout-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .scout-card:hover {
    transform: translateY(-4px);
    box-shadow: none;
  }

  .player-header {
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 12px;
  }

  .faction-icon {
    font-size: 1rem;
    background: var(--bg-tertiary);
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  .player-info { display: flex; flex-direction: column; }
  .player-info .name { font-weight: 700; font-size: 1rem; }
  .player-info .role { font-size: 0.85rem; color: var(--text-secondary); text-transform: capitalize; }

  .hidden-stats {
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 120px;
  }

  .mystery-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }

  .question-mark {
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1;
    opacity: 0.5;
  }

  .mystery-text { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  
  .estimate-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 4px 12px;
    border-radius: 12px;
    text-transform: capitalize;
  }

  .btn-scout {
    background: var(--info);
    color: white;
    border: none;
    padding: 14px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-scout:hover { background: #2563eb; }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 14px;
    background: var(--bg-tertiary);
    border-radius: 12px;
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    justify-content: center;
  }

  .btn-primary.large {
    background: var(--success);
    color: white;
    padding: 16px 32px;
    font-size: 1.1rem;
    font-weight: 700;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    box-shadow: none;
    transition: transform 0.2s;
  }

  .btn-primary.large:hover {
    transform: translateY(-2px);
    background: #1e702e;
  }

</style>