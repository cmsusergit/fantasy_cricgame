<script lang="ts">
  import { onMount } from 'svelte';
  import { playerStore, teamStore } from '$lib/stores/gameState';
  import type { Player } from '$lib/models/player';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  
  let players = $state<Player[]>([]);
  let teams = $state<any[]>([]);
  let userBudget = $state(100000);
  let selectedPlayers = $state<Player[]>([]);
  let filterRole = $state<string>('all');
  let searchQuery = $state('');
  
  onMount(() => {
    const unsubP = playerStore.subscribe(p => {
      players = p;
    });
    const unsubT = teamStore.subscribe(t => {
      teams = t;
      const userTeam = t.find((team: any) => team.isUserTeam);
      if (userTeam) userBudget = userTeam.budget;
    });
    
    return () => {
      unsubP();
      unsubT();
    };
  });
  
  let availablePlayers = $derived(
    players.filter(p => p.isAvailable && 
      (filterRole === 'all' || p.role === filterRole) &&
      (searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );
  
  let canBid = $derived(
    selectedPlayers.length > 0 && 
    selectedPlayers.reduce((sum, p) => sum + p.price, 0) <= userBudget
  );
  
  function handleSelect(player: Player) {
    if (selectedPlayers.includes(player)) {
      selectedPlayers = selectedPlayers.filter(p => p.id !== player.id);
    } else if (selectedPlayers.length < 5) {
      selectedPlayers = [...selectedPlayers, player];
    }
  }
  
  function handleBid() {
    if (!canBid) return;
    
    let newBudget = userBudget;
    selectedPlayers.forEach(player => {
      playerStore.setPlayerUnavailable(player.id);
      teamStore.updateBudget('user_team', -player.price);
      teamStore.addPlayer('user_team', player);
      newBudget -= player.price;
    });
    
    userBudget = newBudget;
    selectedPlayers = [];
  }
</script>

<svelte:head>
  <title>Player Draft - Fantasy Cricket</title>
</svelte:head>

<div class="draft-page">
  <h1>📋 Player Draft</h1>
  <p class="subtitle">Build your roster (Draft up to 5 players per transaction)</p>
  
  <div class="budget-display">
    <span class="label">Your Budget:</span>
    <span class="amount">${userBudget.toLocaleString()}</span>
  </div>
  
  <div class="draft-layout">
    <div class="filters">
      <input 
        type="text" 
        placeholder="Search players..." 
        bind:value={searchQuery}
      />
      <select bind:value={filterRole}>
        <option value="all">All Roles</option>
        <option value="batsman">Batsman</option>
        <option value="allrounder">All-rounder</option>
        <option value="bowler">Bowler</option>
      </select>
    </div>
    
    <div class="players-grid">
      {#each availablePlayers as player}
        <PlayerCard 
          {player} 
          showPrice 
          selected={selectedPlayers.includes(player)}
          onSelect={handleSelect}
        />
      {/each}
    </div>
  </div>
  
  {#if selectedPlayers.length > 0}
    <div class="selection-summary">
      <h3>Selected Players</h3>
      <div class="selected-list">
        {#each selectedPlayers as player}
          <div class="selected-item">
            <span>{player.name}</span>
            <span class="price">${player.price.toLocaleString()}</span>
          </div>
        {/each}
      </div>
      <div class="total">
        <span>Total:</span>
        <span class="total-amount">
          ${selectedPlayers.reduce((sum, p) => sum + p.price, 0).toLocaleString()}
        </span>
      </div>
      <button 
        class="primary bid-btn" 
        disabled={!canBid}
        onclick={handleBid}
      >
        Confirm Bid
      </button>
    </div>
  {/if}
</div>

<style>
  .draft-page {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  h1 {
    margin-bottom: 4px;
  }
  
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
  
  .budget-display .label {
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .budget-display .amount {
    font-size: 24px;
    font-weight: 700;
    color: var(--accent-dwarf);
  }
  
  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }
  
  .filters input,
  .filters select {
    padding: 10px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
  }
  
  .filters input {
    flex: 1;
  }
  
  .filters select {
    min-width: 150px;
  }
  
  .players-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 32px;
  }
  
  .selection-summary {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    padding: 20px;
  }
  
  .selection-summary h3 {
    margin-bottom: 12px;
  }
  
  .selected-list {
    display: flex;
    gap: 24px;
    margin-bottom: 16px;
  }
  
  .selected-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .selected-item .price {
    font-size: 14px;
    color: var(--accent-dwarf);
  }
  
  .total {
    display: flex;
    justify-content: space-between;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }
  
  .total-amount {
    color: var(--accent-dwarf);
  }
  
  .bid-btn {
    width: 100%;
    max-width: 200px;
    float: right;
  }
  
  @media (max-width: 768px) {
    .players-grid {
      grid-template-columns: 1fr;
    }
  }
</style>