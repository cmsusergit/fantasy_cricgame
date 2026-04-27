<script lang="ts">
  import type { Player } from '$lib/models/player';
  import { FACTIONS } from '$lib/models/faction';
  
  interface Props {
    player: Player;
    showPrice?: boolean;
    onSelect?: (player: Player) => void;
    selected?: boolean;
    actionText?: string;
    selectedActionText?: string;
    children?: import('svelte').Snippet;
    hideAvailability?: boolean;
  }
  
  let { 
    player, 
    showPrice = false, 
    onSelect, 
    selected = false,
    actionText = 'Select',
    selectedActionText = '✓ Selected',
    children,
    hideAvailability = false
  }: Props = $props();
  
  let faction = $derived(FACTIONS[player.faction]);
  
  function getStatClass(value: number): string {
    if (value >= 70) return 'high';
    if (value >= 45) return 'medium';
    return 'low';
  }
</script>

<div 
  class="player-card" 
  class:selected 
  class:unavailable={!hideAvailability && !player.isAvailable} 
  data-faction={player.faction}
  onclick={() => onSelect && (hideAvailability || player.isAvailable) && onSelect(player)}
  role={onSelect && (hideAvailability || player.isAvailable) ? "button" : undefined}
  tabindex={onSelect && (hideAvailability || player.isAvailable) ? 0 : undefined}
  onkeydown={(e) => e.key === 'Enter' && onSelect && (hideAvailability || player.isAvailable) && onSelect(player)}
>
  <div class="player-header">
    <span class="faction-icon" title="Faction: {faction.name}">{player.faction === 'human' ? '⚔' : player.faction === 'elf' ? '🌿' : player.faction === 'orc' ? '🪓' : player.faction === 'dwarf' ? '⛏' : player.faction === 'goblin' ? '💎' : '🌙'}</span>
    <div class="player-info">
      <span class="name">{player.name}</span>
      <span class="role">{player.role}{player.bowlingType !== 'none' ? ` (${player.bowlingType})` : ''}</span>
    </div>
  </div>
  
  <div class="stats">
    <div class="stat-row" title="Batting: Determines run-scoring ability and consistency.">
      <span class="stat-label">Batting</span>
      <div class="stat-bar">
        <div class="stat-bar-fill {getStatClass(player.stats.batting)}" style="width: {player.stats.batting}%"></div>
      </div>
      <span class="stat-value">{Math.round(player.stats.batting)}</span>
    </div>
    <div class="stat-row" title="Bowling: Determines wicket-taking ability and economy rate.">
      <span class="stat-label">Bowling</span>
      <div class="stat-bar">
        <div class="stat-bar-fill {getStatClass(player.stats.bowling)}" style="width: {player.stats.bowling}%"></div>
      </div>
      <span class="stat-value">{Math.round(player.stats.bowling)}</span>
    </div>
    <div class="stat-row" title="Power: Affects boundary hitting (sixes/fours) and fast bowling pace.">
      <span class="stat-label">Power</span>
      <div class="stat-bar">
        <div class="stat-bar-fill {getStatClass(player.stats.power)}" style="width: {player.stats.power}%"></div>
      </div>
      <span class="stat-value">{Math.round(player.stats.power)}</span>
    </div>
    <div class="stat-row" title="Technique: Helps survive good bowling and bowl with better control/spin.">
      <span class="stat-label">Tech</span>
      <div class="stat-bar">
        <div class="stat-bar-fill {getStatClass(player.stats.technique)}" style="width: {player.stats.technique}%"></div>
      </div>
      <span class="stat-value">{Math.round(player.stats.technique)}</span>
    </div>
  </div>
  
  {#if showPrice}
    <div class="price">${player.price.toLocaleString()}</div>
  {/if}
  
  {#if onSelect && (hideAvailability || player.isAvailable)}
    <button class="select-btn {selected ? 'selected' : ''}" onclick={(e) => { e.stopPropagation(); onSelect(player); }}>
      {selected ? selectedActionText : actionText}
    </button>
  {/if}
  
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .player-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .player-card:hover {
    border-color: var(--text-secondary);
  }
  
  .player-card.selected {
    border-color: var(--success);
    background: rgba(35, 134, 54, 0.1);
  }
  
  .player-card.unavailable {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .player-card[data-faction="human"] { border-left: 3px solid var(--accent-human); }
  .player-card[data-faction="elf"] { border-left: 3px solid var(--accent-elf); }
  .player-card[data-faction="orc"] { border-left: 3px solid var(--accent-orc); }
  .player-card[data-faction="dwarf"] { border-left: 3px solid var(--accent-dwarf); }
  .player-card[data-faction="goblin"] { border-left: 3px solid var(--accent-goblin); }
  .player-card[data-faction="nightelf"] { border-left: 3px solid var(--accent-nightelf); }
  
  .player-header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .faction-icon {
    font-size: 24px;
  }
  
  .player-info {
    display: flex;
    flex-direction: column;
  }
  
  .name {
    font-weight: 600;
    font-size: 14px;
  }
  
  .role {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: capitalize;
  }
  
  .stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .stat-label {
    font-size: 11px;
    color: var(--text-secondary);
    width: 50px;
  }
  
  .stat-bar {
    flex: 1;
    background: var(--bg-tertiary);
    border-radius: 2px;
    height: 6px;
    overflow: hidden;
  }
  
  .stat-bar-fill {
    height: 100%;
    border-radius: 2px;
  }
  
  .stat-bar-fill.high { background: var(--success); }
  .stat-bar-fill.medium { background: var(--warning); }
  .stat-bar-fill.low { background: var(--danger); }
  
  .stat-value {
    font-size: 11px;
    width: 25px;
    text-align: right;
  }
  
  .price {
    margin-top: 12px;
    font-size: 16px;
    font-weight: 700;
    color: var(--accent-dwarf);
  }
  
  .select-btn {
    width: 100%;
    margin-top: 12px;
  }
  
  .select-btn.selected {
    background: var(--danger);
    color: white;
  }
</style>