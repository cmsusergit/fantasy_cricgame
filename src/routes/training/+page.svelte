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
  
  function getXpUpgradeCost(currentLevel: number): { xp: number, credits: number } {
    if (currentLevel <= 50) return { xp: 100, credits: 5000 };
    if (currentLevel <= 75) return { xp: 250, credits: 15000 };
    if (currentLevel <= 90) return { xp: 500, credits: 50000 };
    return { xp: 1000, credits: 150000 };
  }

  function canXpUpgrade(stat: number): boolean {
    if (stat >= 100) return false;
    const cost = getXpUpgradeCost(stat);
    return (selectedPlayer?.xp || 0) >= cost.xp && budget >= cost.credits;
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
      const nextBudget = budget - result.cost;
      teamStore.updateBudget('user_team', -result.cost);
      teamStore.update(ts =>
        ts.map(t => ({
          ...t,
          players: t.players.map(p =>
            p.id === selectedPlayer!.id
              ? { ...p, stats: { ...p.stats, [statType]: result.newStat } }
              : p
          )
        }))
      );
      selectedPlayer = { ...selectedPlayer, stats: { ...selectedPlayer.stats, [statType]: result.newStat } };
      
      import('$lib/stores/gameState').then(({ saveCurrentGame }) => {
        saveCurrentGame(nextBudget);
      });
      
      alert(result.message);
    } else {
      alert(result.message);
    }
  }

  function handleXpUpgrade(statName: string, currentLevel: number) {
    if (!selectedPlayer || !canXpUpgrade(currentLevel)) return;
    const cost = getXpUpgradeCost(currentLevel);
    import('$lib/stores/gameState').then(({ upgradePlayerStat, saveCurrentGame }) => {
      const nextBudget = budget - cost.credits;
      upgradePlayerStat(selectedPlayer!.id, 'user_team', statName as any, cost.xp, cost.credits);
      const stats = { ...selectedPlayer!.stats };
      (stats as any)[statName] = Math.min(100, (stats as any)[statName] + 1);
      selectedPlayer = { ...selectedPlayer!, stats, xp: Math.max(0, (selectedPlayer!.xp || 0) - cost.xp) };
      
      saveCurrentGame(nextBudget);
    });
  }
</script>

<svelte:head>
  <title>Training Lab - Fantasy Cricket</title>
</svelte:head>

<div class="training-lab">
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
    <div style="border-left: 4px solid {userTeam?.colorPrimary || '#1e40af'}; padding-left: 12px;">
      <h1 style="color: {userTeam?.colorPrimary || '#1e40af'}; margin: 0 0 4px 0; font-size: 1.8rem; line-height: 1.2;">🏋️ Training Lab</h1>
      <p class="subtitle" style="margin-bottom: 0; font-size: 0.9rem; color: var(--text-secondary);">Improve your players' attributes and unlock special abilities.</p>
    </div>
  </div>
  
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
              <span class="xp-badge">✨ {player.xp || 0}</span>
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
            {@const xpCost = getXpUpgradeCost(option.currentStat)}
            {@const canXp = canXpUpgrade(option.currentStat)}
            <div class="training-card">
              <div class="training-type">{option.type}</div>
              <div class="training-stats">
                <span>{option.currentStat} → {option.newStat}</span>
                {#if option.currentStat < 100}
                  <div class="xp-alternative" class:can-afford={canXp}>
                    ✨ XP Route: {xpCost.xp} XP + ${xpCost.credits.toLocaleString()} 
                    {#if canXp}
                      <span class="save-badge">Ready!</span>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="train-actions">
                <button 
                  class="train-btn"
                  disabled={budget < option.cost}
                  onclick={() => handleTraining(option.type)}
                >
                  Train ${option.cost.toLocaleString()}
                </button>
                {#if option.currentStat < 100}
                  <button 
                    class="xp-btn"
                    disabled={!canXp}
                    onclick={() => handleXpUpgrade(option.type, option.currentStat)}
                  >
                    ✨ {xpCost.xp} XP
                  </button>
                {/if}
              </div>
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
    margin-bottom: 12px;
  }
  
  .budget-display {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 24px;
    margin-bottom: 12px;
  }
  
  .budget-display .amount {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent-dwarf);
  }
  
  .training-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  
  .players-section, .training-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
  }
  
  h2 {
    margin-bottom: 12px;
    font-size: 15px;
  }
  
  .players-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .player-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
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
    margin-bottom: 12px;
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
    gap: 10px;
  }
  
  .training-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
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
  
  .xp-badge {
    font-size: 11px;
    color: var(--accent-amethyst);
    background: rgba(var(--accent-amethyst-rgb), 0.12);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .train-actions {
    display: flex;
    gap: 6px;
    flex-direction: column;
    align-items: stretch;
  }

  .train-btn {
    background: var(--success);
    color: white;
    width: 100%;
  }
  
  .train-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .xp-btn {
    background: rgba(var(--accent-amethyst-rgb), 0.15);
    color: var(--accent-amethyst);
    border: 1px solid rgba(var(--accent-amethyst-rgb), 0.3);
    width: 100%;
  }

  .xp-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .xp-btn:hover:not(:disabled) {
    background: rgba(var(--accent-amethyst-rgb), 0.25);
  }

  .xp-alternative {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .xp-alternative.can-afford {
    color: var(--warning);
  }

  .save-badge {
    background: rgba(var(--accent-gold-rgb), 0.15);
    color: var(--warning);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    margin-left: 4px;
  }
  
  .select-prompt {
    text-align: center;
    color: var(--text-secondary);
    padding: 14px;
  }
  
  @media (max-width: 768px) {
    .training-layout {
      grid-template-columns: 1fr;
    }
  }
</style>