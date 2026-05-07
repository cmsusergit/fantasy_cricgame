<script lang="ts">
  import type { Player } from '$lib/models/player';
  import { FACTIONS, getAvatarUrl } from '$lib/models/faction';
  import { getEffectiveStats } from '$lib/models/player';
  
  interface Props {
    player: Player;
    onClose: () => void;
  }
  
  let { player, onClose }: Props = $props();
  
  let faction = $derived(FACTIONS[player.faction]);
  let avatarUrl = $derived(getAvatarUrl(player.faction, player.portraitId || 1));
  let effectiveStats = $derived(getEffectiveStats(player));
  
  function getStatClass(value: number): string {
    if (value >= 70) return 'high';
    if (value >= 45) return 'medium';
    return 'low';
  }
</script>

<div class="modal-overlay" onclick={onClose} role="dialog">
  <div class="modal" onclick={(e) => e.stopPropagation()} role="document" data-faction={player.faction}>
    <button class="close-btn" onclick={onClose}>×</button>
    
    <div class="player-header">
      <div class="avatar-container">
        <img src={avatarUrl} alt={player.name} class="avatar-img" />
        <div class="faction-badge" title="Faction: {faction.name}">
          {player.faction === 'human' ? '⚔' : player.faction === 'elf' ? '🌿' : player.faction === 'orc' ? '🪓' : player.faction === 'dwarf' ? '⛏' : player.faction === 'goblin' ? '💎' : '🌙'}
        </div>
      </div>
      <div class="player-info">
        <h2>{player.name}</h2>
        <span class="role">{player.role} • {player.battingType || 'RHB'} • {player.battingRole || 'Middle Order'}{player.bowlingType && player.bowlingType !== 'none' ? ` • ${player.bowlingType}` : ''}</span>
        <span class="faction">{faction.name}</span>
      </div>
    </div>
    
    {#if player.special.isCaptain}
      <div class="badge captain">Captain</div>
    {/if}
    {#if player.special.isWicketKeeper}
      <div class="badge wk">Wicket Keeper</div>
    {/if}
    
    <div class="stats-section">
      <h3>Current Stats</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Batting</span>
          <span class="stat-value {getStatClass(effectiveStats.batting)}">{effectiveStats.batting}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Bowling</span>
          <span class="stat-value {getStatClass(effectiveStats.bowling)}">{effectiveStats.bowling}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Power</span>
          <span class="stat-value {getStatClass(effectiveStats.power)}">{effectiveStats.power}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Technique</span>
          <span class="stat-value {getStatClass(effectiveStats.technique)}">{effectiveStats.technique}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Fielding</span>
          <span class="stat-value {getStatClass(effectiveStats.fielding || 10)}">{effectiveStats.fielding || 10}</span>
        </div>
      </div>
    </div>
    
    <div class="stats-section">
      <h3>Base Stats</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Batting</span>
          <span class="stat-value">{player.stats.batting}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Bowling</span>
          <span class="stat-value">{player.stats.bowling}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Power</span>
          <span class="stat-value">{player.stats.power}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Technique</span>
          <span class="stat-value">{player.stats.technique}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Fielding</span>
          <span class="stat-value">{player.stats.fielding || 10}</span>
        </div>
      </div>
    </div>
    
    <div class="meta-section">
      <div class="meta-item">
        <span class="meta-label">Form</span>
        <span class="meta-value {player.form >= 0 ? 'positive' : 'negative'}">{player.form >= 0 ? '+' : ''}{player.form}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Fatigue</span>
        <span class="meta-value {player.fatigue > 70 ? 'danger' : ''}">{player.fatigue.toFixed(0)}%</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Morale</span>
        <span class="meta-value">{player.morale}</span>
      </div>
    </div>
    
    <div class="career-section">
      <h3>Career Stats</h3>
      <div class="career-stats">
        <div class="career-item">
          <span class="career-label">Matches</span>
          <span class="career-value">{player.matches}</span>
        </div>
        <div class="career-item">
          <span class="career-label">Runs</span>
          <span class="career-value">{player.runsScored}</span>
        </div>
        <div class="career-item">
          <span class="career-label">Wickets</span>
          <span class="career-value">{player.wickets}</span>
        </div>
      </div>
    </div>
    
    <div class="faction-bonus">
      <h3>Faction Bonus</h3>
      <p>Tech: ×{faction.modifiers.tech.toFixed(2)}, Power: ×{faction.modifiers.power.toFixed(2)}, Fatigue Buildup: ×{faction.modifiers.fatigue.toFixed(2)}</p>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
    max-width: 450px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }
  
  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .player-header {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
  }
  
  .avatar-container {
    position: relative;
    width: 90px;
    height: 90px;
    flex-shrink: 0;
  }
  
  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    background: var(--bg-secondary);
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  }
  
  .faction-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    background: var(--bg-primary);
    border: 2px solid var(--border-color);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  
  .modal[data-faction="human"] .avatar-img { border: 3px solid var(--accent-human); box-shadow: 0 0 20px rgba(9, 105, 218, 0.3); }
  .modal[data-faction="elf"] .avatar-img { border: 3px solid var(--accent-elf); box-shadow: 0 0 20px rgba(26, 127, 55, 0.3); }
  .modal[data-faction="orc"] .avatar-img { border: 3px solid var(--accent-orc); box-shadow: 0 0 20px rgba(207, 34, 46, 0.3); }
  .modal[data-faction="dwarf"] .avatar-img { border: 3px solid var(--accent-dwarf); box-shadow: 0 0 20px rgba(154, 103, 0, 0.3); }
  .modal[data-faction="goblin"] .avatar-img { border: 3px solid var(--accent-goblin); box-shadow: 0 0 20px rgba(130, 80, 223, 0.3); }
  .modal[data-faction="nightelf"] .avatar-img { border: 3px solid var(--accent-nightelf); box-shadow: 0 0 20px rgba(5, 152, 188, 0.3); }
  
  .player-info h2 {
    margin: 0;
    font-size: 20px;
  }
  
  .role {
    color: var(--text-secondary);
    text-transform: capitalize;
  }
  
  .faction {
    color: var(--accent-elf);
    font-size: 14px;
  }
  
  .badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-right: 8px;
    margin-bottom: 16px;
  }
  
  .badge.captain {
    background: var(--warning);
    color: #000;
  }
  
  .badge.wk {
    background: var(--info);
    color: #fff;
  }
  
  .stats-section {
    margin-bottom: 16px;
  }
  
  .stats-section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--text-secondary);
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  
  .stat-item {
    background: var(--bg-secondary);
    padding: 8px;
    border-radius: 4px;
    text-align: center;
  }
  
  .stat-label {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  
  .stat-value {
    font-size: 16px;
    font-weight: 600;
  }
  
  .stat-value.high { color: var(--success); }
  .stat-value.medium { color: var(--warning); }
  .stat-value.low { color: var(--danger); }
  
  .meta-section {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
  }
  
  .meta-item {
    flex: 1;
    text-align: center;
  }
  
  .meta-label {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
  }
  
  .meta-value {
    font-weight: 600;
  }
  
  .meta-value.positive { color: var(--success); }
  .meta-value.negative { color: var(--danger); }
  .meta-value.danger { color: var(--danger); }
  
  .career-section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--text-secondary);
  }
  
  .career-stats {
    display: flex;
    gap: 16px;
  }
  
  .career-item {
    flex: 1;
    background: var(--bg-secondary);
    padding: 8px;
    border-radius: 4px;
    text-align: center;
  }
  
  .career-label {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
  }
  
  .career-value {
    font-size: 14px;
    font-weight: 600;
  }
  
  .faction-bonus {
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    text-align: center;
  }
  
  .faction-bonus h3 {
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .faction-bonus p {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0;
  }
</style>
