<script lang="ts">
  import { onMount } from 'svelte';
  import { teamStore } from '$lib/stores/gameState';
  import { getTrainingOptions, trainPlayer, calculateTrainingCost } from '$lib/core/trainingLab';
  import type { Player } from '$lib/models/player';
  
  let teams = $state<any[]>([]);
  let selectedPlayer = $state<Player | null>(null);
  let trainingOptions = $state<any[]>([]);
  
  onMount(() => {
    const unsub = teamStore.subscribe(t => {
      teams = t;
    });
    return () => unsub();
  });
  
  let userTeam = $derived(teams.find(t => t.isUserTeam));
  let budget = $derived(userTeam?.budget || 0);
  
  function selectPlayer(player: Player) {
    selectedPlayer = player;
    if (player) {
      trainingOptions = getTrainingOptions(player);
    }
  }
  
  function handleTraining(statType: string) {
    if (!selectedPlayer) return;
    
    const option = trainingOptions.find(o => o.type === statType);
    if (!option) return;
    
    if (budget < option.cost) {
      alert('Not enough budget!');
      return;
    }
    
    const result = trainPlayer(selectedPlayer, statType as any);
    if (result.success) {
      teamStore.updateBudget('user_team', -result.cost);
      selectedPlayer = { ...selectedPlayer, stats: { ...selectedPlayer.stats, [statType]: result.newStat } };
      alert(result.message);
    } else {
      alert(result.message);
    }
  }
</script>

<svelte:head>
  <title>Training Lab - Fantasy Cricket</title>
</svelte:head>

<div class="training-lab">
  <h1>🏋️ Training Lab</h1>
  <p class="subtitle">Improve your players' stats</p>
  
  <div class="budget-display">
    <span class="label">Training Budget:</span>
    <span class="amount">${budget.toLocaleString()}</span>
  </div>
  
  <div class="training-layout">
    <div class="players-section">
      <h2>Your Players</h2>
      <div class="players-list">
        {#if userTeam}
          {#each userTeam.players as player}
            <button 
              class="player-row"
              class:selected={selectedPlayer?.id === player.id}
              onclick={() => selectPlayer(player)}
            >
              <span class="name">{player.name}</span>
              <span class="role">{player.role} • {player.battingType || 'RHB'} • {player.battingRole || 'Middle Order'}{player.bowlingType && player.bowlingType !== 'none' ? ` • ${player.bowlingType}` : ''}</span>
              <span class="faction">{player.faction}</span>
              {#if player.special?.isCaptain}
                <span class="captain-badge">C</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
    
    <div class="training-section">
      <h2>Training Options</h2>
      
      {#if selectedPlayer}
        <div class="selected-player">
          <h3>{selectedPlayer.name}</h3>
          <div class="current-stats">
            <div class="stat">Batting: {selectedPlayer.stats.batting}</div>
            <div class="stat">Bowling: {selectedPlayer.stats.bowling}</div>
            <div class="stat">Power: {selectedPlayer.stats.power}</div>
            <div class="stat">Technique: {selectedPlayer.stats.technique}</div>
          </div>
        </div>
        
        <div class="training-options">
          {#each trainingOptions as option}
            <div class="training-card">
              <div class="training-type">{option.type}</div>
              <div class="training-stats">
                <span>{option.currentStat} → {option.newStat}</span>
              </div>
              <button 
                class="train-btn"
                disabled={budget < option.cost}
                onclick={() => handleTraining(option.type)}
              >
                Train (${option.cost.toLocaleString()})
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="select-prompt">Select a player to see training options</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .training-lab {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  h1 { margin-bottom: 4px; }
  .subtitle {
    color: var(--text-secondary);
    margin-bottom: 24px;
  }
  
  .budget-display {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 24px;
    margin-bottom: 24px;
  }
  
  .budget-display .amount {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent-dwarf);
  }
  
  .training-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  
  .players-section, .training-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
  }
  
  h2 {
    margin-bottom: 16px;
    font-size: 18px;
  }
  
  .players-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .player-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
  }
  
  .player-row:hover {
    border-color: var(--success);
  }
  
  .player-row.selected {
    background: rgba(35, 134, 54, 0.2);
    border-color: var(--success);
  }
  
  .player-row .name {
    flex: 1;
    font-weight: 600;
  }
  
  .player-row .role {
    font-size: 12px;
    color: var(--text-secondary);
  }
  
  .player-row .faction {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: capitalize;
  }
  
  .captain-badge {
    background: var(--warning);
    color: var(--bg-primary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: bold;
  }
  
  .selected-player {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .current-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  
  .current-stats .stat {
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .training-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .training-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: 6px;
  }
  
  .training-type {
    text-transform: capitalize;
    font-weight: 600;
    width: 80px;
  }
  
  .training-stats {
    flex: 1;
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .train-btn {
    background: var(--success);
    color: white;
  }
  
  .train-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .select-prompt {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px;
  }
  
  @media (max-width: 768px) {
    .training-layout {
      grid-template-columns: 1fr;
    }
  }
</style>