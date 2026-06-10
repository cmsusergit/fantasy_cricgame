<script lang="ts">
  import type { Player } from '$lib/models/player';
  import { FACTIONS, getAvatarUrl } from '$lib/models/faction';
  import { getEffectiveStats } from '$lib/models/player';
  
  interface Props {
    player: Player;
    onClose: () => void;
    allowRename?: boolean;
    onRename?: (newName: string) => void;
  }
  
  let { player, onClose, allowRename = false, onRename }: Props = $props();

  let isEditingName = $state(false);
  let editNameValue = $state(player.name);

  function startEdit(e: Event) {
    e.stopPropagation();
    isEditingName = true;
    editNameValue = player.name;
  }

  function saveEdit(e: Event) {
    e.stopPropagation();
    isEditingName = false;
    if (editNameValue.trim() && editNameValue !== player.name) {
      onRename?.(editNameValue.trim());
    }
  }

  function cancelEdit(e: Event) {
    e.stopPropagation();
    isEditingName = false;
  }
  
  let faction = $derived(FACTIONS[player.faction]);
  let avatarUrl = $derived(getAvatarUrl(player.faction, player.portraitId || 1));
  let effectiveStats = $derived(getEffectiveStats(player));
  let activeInjury = $derived((player as any).activeInjury);
  
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
        {#if isEditingName}
          <div class="edit-name-container" onclick={(e) => e.stopPropagation()}>
            <input type="text" class="edit-name-input" bind:value={editNameValue} maxlength="30" onkeydown={(e) => e.key === 'Enter' && saveEdit(e)} />
            <button class="icon-btn save-btn" onclick={saveEdit} title="Save">✓</button>
            <button class="icon-btn cancel-btn" onclick={cancelEdit} title="Cancel">✕</button>
          </div>
        {:else}
          <h2>
            {player.name}
            {#if allowRename}
              <button class="icon-btn edit-btn" onclick={startEdit} title="Edit Name">✎</button>
            {/if}
          </h2>
        {/if}
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
    {#if player.retiring}
      <div class="badge retire">Retiring</div>
    {/if}
    {#if activeInjury}
      <div class="badge injury">Injury: {activeInjury.type} • {activeInjury.bodyPart.replace('_', ' ')}</div>
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
        <div class="stat-row">
          <span class="stat-label">Fielding</span>
          <span class="stat-value {getStatClass(effectiveStats.fielding || 60)}">{effectiveStats.fielding || 60}</span>
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
        <div class="stat-row">
          <span class="stat-label">Fielding</span>
          <span class="stat-value">{player.stats.fielding || 60}</span>
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
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(2, 6, 23, 0.72);
    backdrop-filter: blur(14px);
    z-index: 1000;
  }

  .modal {
    position: relative;
    width: min(100%, 760px);
    max-height: calc(100vh - 2rem);
    overflow: auto;
    padding: 1.4rem;
    border-radius: 14px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
      var(--bg-elevated);
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: none;
  }

  .close-btn {
    position: sticky;
    top: 0;
    margin-left: auto;
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(148, 163, 184, 0.16);
    color: var(--text-secondary);
    font-size: 1.3rem;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--text-primary);
    border-color: rgba(var(--accent-sapphire-rgb), 0.34);
    background: rgba(var(--accent-sapphire-rgb), 0.1);
  }

  .player-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  }

  .avatar-container {
    position: relative;
    width: 104px;
    height: 104px;
    flex: 0 0 auto;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 999px;
    object-fit: cover;
    background: var(--bg-secondary);
    border: 2px solid rgba(255, 255, 255, 0.08);
  }

  .modal[data-faction="human"] .avatar-img {
    box-shadow: none;
  }

  .modal[data-faction="elf"] .avatar-img {
    box-shadow: none;
  }

  .modal[data-faction="orc"] .avatar-img {
    box-shadow: none;
  }

  .modal[data-faction="dwarf"] .avatar-img {
    box-shadow: none;
  }

  .modal[data-faction="goblin"] .avatar-img {
    box-shadow: none;
  }

  .modal[data-faction="nightelf"] .avatar-img {
    box-shadow: none;
  }

  .faction-badge {
    position: absolute;
    right: 0.15rem;
    bottom: 0.15rem;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: var(--bg-secondary);
    box-shadow: none;
  }

  .player-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .player-info h2 {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: clamp(1.4rem, 3vw, 2rem);
  }

  .role {
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .faction {
    color: var(--text-muted);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }

  .edit-name-container {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .edit-name-input {
    width: min(100%, 16rem);
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
  }

  .icon-btn {
    width: 2.1rem;
    height: 2.1rem;
    padding: 0;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(148, 163, 184, 0.16);
    color: var(--text-secondary);
  }

  .icon-btn.edit-btn {
    opacity: 0;
    font-size: 0.95rem;
  }

  h2:hover .icon-btn.edit-btn {
    opacity: 1;
  }

  .icon-btn.edit-btn:hover {
    color: var(--info);
    background: rgba(var(--accent-sapphire-rgb), 0.12);
  }

  .icon-btn.save-btn {
    color: var(--success);
  }

  .icon-btn.save-btn:hover {
    background: rgba(var(--accent-emerald-rgb), 0.12);
  }

  .icon-btn.cancel-btn {
    color: var(--danger);
  }

  .icon-btn.cancel-btn:hover {
    background: rgba(var(--accent-ruby-rgb), 0.12);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-right: 0.5rem;
    margin-bottom: 0.6rem;
    padding: 0.4rem 0.7rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    border: 1px solid rgba(148, 163, 184, 0.16);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-secondary);
  }

  .badge.captain {
    background: rgba(var(--accent-gold-rgb), 0.14);
    color: var(--warning);
    border-color: rgba(var(--accent-gold-rgb), 0.24);
  }

  .badge.wk {
    background: rgba(var(--accent-sapphire-rgb), 0.14);
    color: var(--info);
    border-color: rgba(var(--accent-sapphire-rgb), 0.24);
  }

  .badge.retire {
    background: rgba(var(--accent-fire-rgb), 0.14);
    color: var(--accent-fire);
    border-color: rgba(var(--accent-fire-rgb), 0.24);
  }

  .badge.injury {
    background: rgba(var(--accent-ruby-rgb), 0.14);
    color: var(--danger);
    border-color: rgba(var(--accent-ruby-rgb), 0.24);
  }

  .stats-section {
    margin-bottom: 1rem;
  }

  .stats-section h3 {
    margin-bottom: 0.7rem;
    color: var(--text-secondary);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .stat-item {
    display: grid;
    gap: 0.25rem;
    padding: 0.8rem 0.9rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.12);
  }

  .stat-label {
    display: block;
    color: var(--text-muted);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .stat-value {
    font-size: 1.05rem;
    font-weight: 700;
  }

  .stat-value.high {
    color: var(--success);
  }

  .stat-value.medium {
    color: var(--warning);
  }

  .stat-value.low {
    color: var(--danger);
  }

  .meta-section {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .meta-item {
    display: grid;
    gap: 0.25rem;
    padding: 0.85rem 0.9rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.12);
    text-align: center;
  }

  .meta-label {
    display: block;
    color: var(--text-muted);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .meta-value {
    font-weight: 700;
  }

  .meta-value.positive {
    color: var(--success);
  }

  .meta-value.negative,
  .meta-value.danger {
    color: var(--danger);
  }

  .career-section h3 {
    margin-bottom: 0.7rem;
    color: var(--text-secondary);
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .career-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .career-item {
    display: grid;
    gap: 0.25rem;
    padding: 0.85rem 0.9rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.12);
    text-align: center;
  }

  .career-label {
    display: block;
    color: var(--text-muted);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .career-value {
    font-size: 1rem;
    font-weight: 700;
  }

  .faction-bonus {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 10px;
    background: rgba(var(--accent-sapphire-rgb), 0.08);
    border: 1px solid rgba(var(--accent-sapphire-rgb), 0.18);
  }

  .faction-bonus h3 {
    margin-bottom: 0.35rem;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-secondary);
  }

  .faction-bonus p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  @media (max-width: 680px) {
    .modal {
      padding: 1rem;
    }

    .player-header {
      align-items: flex-start;
    }

    .avatar-container {
      width: 84px;
      height: 84px;
    }

    .stats-grid,
    .meta-section,
    .career-stats {
      grid-template-columns: 1fr;
    }
  }
</style>
