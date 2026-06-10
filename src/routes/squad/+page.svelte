<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { teamStore, saveCurrentGame, gamePhase } from '$lib/stores/gameState';
  import type { Player } from '$lib/models/player';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import { MAX_SQUAD_SIZE } from '$lib/core/retentionSystem';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';

  let teams: any[] = $state([]);
  let userTeam = $derived(teams.find((t: any) => t.isUserTeam));
  
  let playing11: string[] = $state([]);
  let captain: string = $state('');
  let wicketKeeper: string = $state('');
  let saveMessage: string = $state('');
  
  let filterRole: string = $state('all');
  let searchQuery: string = $state('');

  let dndPlayers: Player[] = $state([]);

  onMount(() => {
    let currentPhase;
    const unsubPhase = gamePhase.subscribe(v => currentPhase = v);
    unsubPhase(); // Immediately unsubscribe after getting the value
    
    if (currentPhase === 'match') {
       goto('/');
       return;
    }
    const unsub = teamStore.subscribe(t => {
      teams = t;
      const userT = t.find((team: any) => team.isUserTeam);
      if (userT) {
        if (playing11.length === 0) { // Only initialize playing11 once
          playing11 = userT.playing11 || [];
          captain = userT.captain || '';
          wicketKeeper = userT.wicketKeeper || '';
        }
        dndPlayers = [...userT.players]; // Initialize dndPlayers
      }
    });
    return unsub;
  });

  // Filter and search logic applied to dndPlayers
  let displayedPlayers = $derived((() => {
    if (!userTeam) return [];
    
    return dndPlayers.filter(p => 
      (filterRole === 'all' || p.role === filterRole) &&
      (searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  })());

  function handleDndConsider(e: CustomEvent<DndEvent<Player>>) {
    dndPlayers = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<Player>>) {
    dndPlayers = e.detail.items;
    playing11 = dndPlayers.filter(p => playing11.includes(p.id)).map(p => p.id);
  }
  
  function togglePlayerSelection(player: Player) {
    const playerId = player.id;
    if (playing11.includes(playerId)) {
      playing11 = playing11.filter(id => id !== playerId);
      if (captain === playerId) captain = '';
      if (wicketKeeper === playerId) wicketKeeper = '';
    } else {
      if (playing11.length < 11) {
        playing11 = [...playing11, playerId];
      }
    }
  }

  function quickSelect() {
    if (!userTeam || userTeam.players.length < 11) {
      saveMessage = "Not enough players in roster (need at least 11).";
      setTimeout(() => saveMessage = '', 3000);
      return;
    }
    
    playing11 = [];
    captain = '';
    wicketKeeper = '';

    const players = [...userTeam.players] as Player[];
    
    players.sort((a, b) => {
      const aScore = a.stats.batting + a.stats.bowling + a.stats.technique + a.stats.power;
      const bScore = b.stats.batting + b.stats.bowling + b.stats.technique + b.stats.power;
      return bScore - aScore;
    });

    const batsmen = players.filter(p => p.role === 'batsman');
    const bowlers = players.filter(p => p.role === 'bowler');
    const allrounders = players.filter(p => p.role === 'allrounder');
    const wks = players.filter(p => p.role === 'wicketkeeper' || p.special.isWicketKeeper);

    const selected = new Set<string>();

    const addPlayers = (list: Player[], count: number) => {
      let added = 0;
      for (const p of list) {
        if (added >= count) break;
        if (!selected.has(p.id)) {
          selected.add(p.id);
          added++;
        }
      }
    };

    addPlayers(wks, 1);
    addPlayers(batsmen, 4);
    addPlayers(bowlers, 4);
    addPlayers(allrounders, 2);

    for (const p of players) {
      if (selected.size >= 11) break;
      selected.add(p.id);
    }

    playing11 = Array.from(selected);

    const captainCandidate = players.find(p => playing11.includes(p.id) && p.special.isCaptain);
    captain = captainCandidate ? captainCandidate.id : playing11[0];

    const wkCandidate = players.find(p => playing11.includes(p.id) && (p.role === 'wicketkeeper' || p.special.isWicketKeeper));
    wicketKeeper = wkCandidate ? wkCandidate.id : playing11[0];
  }
  
  async function saveSquad() {
    if (!userTeam) return;
    if (playing11.length !== 11) {
      saveMessage = "Please select exactly 11 players.";
      setTimeout(() => saveMessage = '', 3000);
      return;
    }
    if (!captain) {
      saveMessage = "Please select a captain.";
      setTimeout(() => saveMessage = '', 3000);
      return;
    }
    if (!wicketKeeper) {
      saveMessage = "Please select a wicket keeper.";
      setTimeout(() => saveMessage = '', 3000);
      return;
    }
    
    teamStore.setPlaying11(userTeam.id, playing11, captain, wicketKeeper);
    await saveCurrentGame(userTeam.budget);
    saveMessage = "Squad saved successfully! Redirecting to match...";
    setTimeout(() => {
      saveMessage = '';
      goto('/match');
    }, 1000);
  }
</script>

<svelte:head>
  <title>Squad Management - Fantasy Cricket</title>
</svelte:head>

<div class="squad-page">
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
    <div>
      <h1>🛡️ Squad Selection</h1>
      <p class="subtitle" style="margin-bottom: 0;">Strategize and finalize your playing 11 for the upcoming match.</p>
    </div>
    <div style="text-align: right;">
      <span style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Roster Size</span>
      <div style="font-size: 1rem; font-family: 'Cinzel', serif; font-weight: bold; color: {userTeam?.players.length === MAX_SQUAD_SIZE ? 'var(--warning)' : 'var(--text-primary)'};">
        {userTeam?.players.length || 0} <span style="font-size: 1rem; color: var(--text-muted);">/ {MAX_SQUAD_SIZE}</span>
      </div>
    </div>
  </div>
  
  <div class="budget-display">
    <span class="label">Playing 11 Selected:</span>
    <span class="amount" class:full={playing11.length === 11}>
      {playing11.length} <span style="font-size: 16px; color: var(--text-secondary);">/ 11</span>
    </span>
  </div>

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
      <option value="wicketkeeper">Wicket Keeper</option>
    </select>
    <button class="secondary" onclick={quickSelect} style="margin-left: auto;">
      Quick Fill
    </button>
  </div>

  {#if userTeam && userTeam.players.length > 0}
    <div class="players-grid" use:dndzone={{ items: displayedPlayers }} onconsider={handleDndConsider} onfinalize={handleDndFinalize}>
      {#each displayedPlayers as player (player.id)}
        {@const isSelected = playing11.includes(player.id)}
        {@const isCaptain = captain === player.id}
        {@const isWk = wicketKeeper === player.id}
        
        <div class="player-wrapper">
          {#if isCaptain || isWk}
            <div class="role-badges" aria-hidden="true">
              {#if isCaptain}
                <div class="role-badge captain" title="Captain">C</div>
              {/if}
              {#if isWk}
                <div class="role-badge wk" title="Wicket Keeper">WK</div>
              {/if}
            </div>
          {/if}
          <PlayerCard 
            {player} 
            selected={isSelected}
            hideAvailability={true}
            actionText="Add to 11"
            selectedActionText="Remove from 11"
            onSelect={() => togglePlayerSelection(player)}
            allowRename={true}
            onRename={(newName) => teamStore.renamePlayer('user_team', player.id, newName)}
            teamColorPrimary={userTeam?.colorPrimary}
            teamColorSecondary={userTeam?.colorSecondary}
          >
            <div class="player-controls" style="margin-top: 8px;">
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <label class="control-label {isCaptain ? 'active' : ''} {!isSelected ? 'disabled' : ''}" onclick={(e) => e.stopPropagation()}>
                <input 
                  type="radio" 
                  name="captain"
                  checked={isCaptain}
                  onchange={() => captain = player.id}
                  disabled={!isSelected}
                />
                Captain
              </label>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
              <label class="control-label {isWk ? 'active' : ''} {!isSelected ? 'disabled' : ''}" onclick={(e) => e.stopPropagation()}>
                <input 
                  type="radio" 
                  name="wicketKeeper"
                  checked={isWk}
                  onchange={() => wicketKeeper = player.id}
                  disabled={!isSelected}
                />
                WK
              </label>
            </div>
          </PlayerCard>
        </div>
      {/each}
    </div>
  {:else if userTeam}
    <div class="empty-state">
      <div class="empty-icon">📉</div>
      <h2>Your roster is empty!</h2>
      <p>Head over to the Draft room to sign players and build your ultimate team.</p>
              <button class="primary" onclick={() => goto('/auction')}>Enter Auction Room</button>    </div>
  {/if}

  {#if playing11.length > 0}
    <div class="selection-summary">
      <h3>Selection Status</h3>
      <div class="status-details">
        <span class="status-item">Players: <strong>{playing11.length}/11</strong></span>
        <span class="status-item">Captain: <strong class={captain ? 'success' : 'error'}>{captain ? 'Selected' : 'Missing'}</strong></span>
        <span class="status-item">Wicket Keeper: <strong class={wicketKeeper ? 'success' : 'error'}>{wicketKeeper ? 'Selected' : 'Missing'}</strong></span>
      </div>
      
      {#if saveMessage}
        <div class="message {saveMessage.includes('successfully') ? 'success' : 'error'}">
          {saveMessage}
        </div>
      {/if}

      <button 
        class="primary bid-btn" 
        disabled={playing11.length !== 11 || !captain || !wicketKeeper}
        onclick={saveSquad}
      >
        Save Lineup
      </button>
    </div>
  {/if}
</div>

<style>
  .squad-page {
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 120px;
  }
  
  h1 {
    margin-bottom: 4px;
  }
  
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
  
  .budget-display .label {
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .budget-display .amount {
    font-size: 15px;
    font-weight: 700;
    color: var(--warning);
  }
  
  .budget-display .amount.full {
    color: var(--success);
  }
  
  .filters {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    align-items: center;
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
    max-width: 400px;
  }
  
  .filters select {
    min-width: 150px;
  }
  
  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 10px;
    align-items: stretch;
    margin-bottom: 16px;
  }

  .player-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-width: 0;
  }

  .role-badges {
    position: absolute;
    top: 0.65rem;
    right: 0.75rem;
    display: flex;
    gap: 0.35rem;
    z-index: 2;
    pointer-events: none;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.9rem;
    height: 1.45rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    box-shadow: none;
  }

  .role-badge.captain {
    background: rgba(var(--accent-gold-rgb), 0.94);
    color: #211300;
    border-color: rgba(var(--accent-gold-rgb), 0.34);
  }

  .role-badge.wk {
    background: rgba(var(--accent-sapphire-rgb), 0.94);
    color: #071425;
    border-color: rgba(var(--accent-sapphire-rgb), 0.34);
  }

  .player-controls {
    display: flex;
    gap: 8px;
  }
  
  .control-label {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .control-label:hover:not(.disabled) {
    border-color: var(--text-primary);
  }
  
  .control-label.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .control-label.active {
    background: rgba(35, 134, 54, 0.1);
    border-color: var(--success);
    color: var(--success);
  }
  
  .selection-summary {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    padding: 14px;
    z-index: 100;
  }
  
  .selection-summary h3 {
    margin-bottom: 12px;
  }
  
  .status-details {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
    font-size: 14px;
  }
  
  .status-item strong {
    color: var(--text-primary);
  }
  
  .status-item strong.success { color: var(--success); }
  .status-item strong.error { color: var(--danger); }
  
  .bid-btn {
    width: 100%;
    max-width: 200px;
    position: absolute;
    top: 20px;
    right: 20px;
  }

  .message {
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }
  
  .message.success { color: var(--success); }
  .message.error { color: var(--danger); }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    margin-top: 12px;
  }
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  
  .empty-state h2 {
    font-size: 15px;
    margin-bottom: 12px;
  }
  
  .empty-state p {
    color: var(--text-secondary);
    margin-bottom: 12px;
  }
  
  @media (max-width: 768px) {
    .players-grid {
      grid-template-columns: 1fr;
    }
    
    .filters {
      flex-direction: column;
      align-items: stretch;
    }
    
    .filters input {
      max-width: 100%;
    }
    
    .bid-btn {
      position: static;
      margin-top: 12px;
      max-width: 100%;
    }
  }
</style>
