<script lang="ts">
  import type { Player } from '$lib/models/player';
  import { FACTIONS, getAvatarUrl } from '$lib/models/faction';
  import { teamStore } from '$lib/stores/gameState';
  
  interface Props {
    player: Player;
    showPrice?: boolean;
    onSelect?: (player: Player) => void;
    selected?: boolean;
    actionText?: string;
    selectedActionText?: string;
    children?: import('svelte').Snippet;
    hideAvailability?: boolean;
    allowRename?: boolean;
    onRename?: (newName: string) => void;
    teamColorPrimary?: string;
    teamColorSecondary?: string;
  }
  
    let {
      player,
      showPrice = false,
      onSelect,
      selected = false,
      actionText = 'Select',
      selectedActionText = 'Deselect',
      children,
      hideAvailability = false,
      allowRename = false,
      onRename,
      teamColorPrimary,
      teamColorSecondary
    }: Props = $props();
    
    let teams = $state<any[]>([]);
    $effect(() => {
      return teamStore.subscribe(t => {
        teams = t;
      });
    });
    
    let userTeam = $derived(teams.find((t: any) => t.isUserTeam));
    let isUserPlayer = $derived(userTeam?.players?.some((p: any) => p.id === player.id));
    let canUpgradeAny = $derived(isUserPlayer && player.xp >= 100 && userTeam?.budget >= 5000 && Object.values(player.stats).some(v => typeof v === 'number' && v < 100));
    
    let isEditingName = $state(false);
    let editNameValue = $state('');
    $effect(() => {
      editNameValue = player.name;
    });

    function hexToRgb(hex: string): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '148, 163, 184';
    }
  
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
  let roleSummary = $derived(
    `Age: ${player.age} • ${player.role} • ${player.battingType || 'RHB'} • ${player.battingRole || 'Middle Order'}${
      player.bowlingType && player.bowlingType !== 'none' ? ` • ${player.bowlingType}` : ''
    }`
  );
  let activeInjury = $derived((player as any).activeInjury);
  
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
  style={teamColorPrimary ? `--team-primary: ${teamColorPrimary}; --team-secondary: ${teamColorSecondary ?? '#6b7280'}; --team-primary-rgb: ${hexToRgb(teamColorPrimary)}; --team-secondary-rgb: ${hexToRgb(teamColorSecondary ?? '#6b7280')}; --card-bg: linear-gradient(180deg, ${(teamColorSecondary ?? '#6b7280')}10, transparent 40%), var(--bg-surface);` : ''}
  onclick={(e) => {
    if ((e.target as HTMLElement).closest('.edit-name-container')) return;
    if (onSelect && (hideAvailability || player.isAvailable)) onSelect(player);
  }}
  role="button"
  aria-disabled={!(onSelect && (hideAvailability || player.isAvailable))}
  tabindex={onSelect && (hideAvailability || player.isAvailable) ? 0 : -1}
  onkeydown={(e) => {
    if ((e.target as HTMLElement).closest('.edit-name-container')) return;
    if (e.key === 'Enter' && onSelect && (hideAvailability || player.isAvailable)) onSelect(player);
  }}
>
  <div class="player-header">
    <div class="avatar-container">
      <img src={avatarUrl} alt={player.name} class="avatar-img" />
      <div class="faction-badge" title="Faction: {faction.name}">
        {player.faction === 'human' ? '⚔' : player.faction === 'elf' ? '🌿' : player.faction === 'orc' ? '🪓' : player.faction === 'dwarf' ? '⛏' : player.faction === 'goblin' ? '💎' : '🌙'}
      </div>
    </div>
    <div class="player-info">
      {#if isEditingName}
        <div class="edit-name-container">
          <input type="text" class="edit-name-input" bind:value={editNameValue} maxlength="30" onkeydown={(e) => e.key === 'Enter' && saveEdit(e)} />
          <button class="icon-btn save-btn" onclick={saveEdit} title="Save">✓</button>
          <button class="icon-btn cancel-btn" onclick={cancelEdit} title="Cancel">✕</button>
        </div>
      {:else}
        <span class="name" title={player.name}>
          <span class="name-text">{player.name}</span>
          {#if allowRename}
            <button class="icon-btn edit-btn" onclick={startEdit} title="Edit Name">✎</button>
          {/if}
        </span>
      {/if}
      <span class="role" title={roleSummary}>{roleSummary}</span>
      <div class="status-row">
        {#if !hideAvailability}
          <span class="status-pill {player.isAvailable ? 'available' : 'locked'}">{player.isAvailable ? 'Available' : 'Locked'}</span>
        {/if}
        {#if player.retiring}
          <span class="status-pill retiring">Retiring</span>
        {/if}
        {#if activeInjury}
          <span class="status-pill injury" title="{activeInjury.name || activeInjury.type} injury ({activeInjury.recoveryDays - activeInjury.currentDay} matches left to skip)">
            🤕 {activeInjury.name || 'Injured'}: {activeInjury.recoveryDays - activeInjury.currentDay}m left
          </span>
        {/if}
        <span class="status-pill xp" class:can-upgrade={canUpgradeAny} title={canUpgradeAny ? 'Can afford an upgrade!' : `${player.xp || 0} XP`}>
          ✨ {player.xp || 0}
        </span>
      </div>
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
    <div class="stat-row" title="Fielding: Determines ability to take catches and save runs.">
      <span class="stat-label">Field</span>
      <div class="stat-bar">
        <div class="stat-bar-fill {getStatClass(player.stats.fielding || 60)}" style="width: {player.stats.fielding || 60}%"></div>
      </div>
      <span class="stat-value">{Math.round(player.stats.fielding || 60)}</span>
    </div>
    
    <div class="mini-grid">
       <div class="mini-stat" title="Morale/Form: Higher morale improves performance.">
          <span class="stat-label">Form</span>
          <span class="stat-value" style="color: {player.morale > 70 ? 'var(--success)' : player.morale < 40 ? 'var(--danger)' : 'var(--text-secondary)'}">{Math.round(player.morale)}%</span>
       </div>
       <div class="mini-stat" title="Fatigue: High fatigue reduces performance and increases injury risk.">
          <span class="stat-label">Fatigue</span>
          <span class="stat-value" style="color: {player.fatigue > 70 ? 'var(--danger)' : player.fatigue > 40 ? 'var(--warning)' : 'var(--success)'}">{Math.round(player.fatigue)}%</span>
       </div>
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
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    height: 100%;
    align-self: stretch;
    padding: 1rem;
    border-radius: 12px;
    cursor: pointer;
    background: var(--card-bg,
      linear-gradient(180deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.03), rgba(255, 255, 255, 0)),
      var(--bg-surface)
    );
    border: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: none;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      border-color 160ms ease,
      background-color 160ms ease;
  }

  .player-card::before {
    content: "";
    position: absolute;
    inset: auto -15% -25% auto;
    width: 150px;
    height: 150px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(var(--team-secondary-rgb, 255, 191, 36), 0.12), transparent 68%);
    pointer-events: none;
    opacity: 0.8;
  }

  .player-card::after {
    content: attr(data-faction);
    position: absolute;
    right: -0.2rem;
    bottom: -0.65rem;
    font-family: "Space Grotesk", sans-serif;
    font-size: 4.8rem;
    font-weight: 700;
    letter-spacing: -0.1em;
    text-transform: uppercase;
    opacity: 0.045;
    pointer-events: none;
    color: var(--team-primary, var(--accent-sapphire));
  }

  .player-card:hover {
    transform: translateY(-3px);
    border-color: rgba(var(--team-primary-rgb, 59, 130, 246), 0.34);
    box-shadow: none;
  }

  .player-card.selected {
    border-color: rgba(var(--team-primary-rgb, 30, 64, 175), 0.42);
    box-shadow: none;
    background:
      linear-gradient(180deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.08), rgba(255, 255, 255, 0)),
      var(--bg-surface);
  }

  .player-card.unavailable {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .player-card[data-faction="human"] {
    border-left: 3px solid var(--team-primary, var(--accent-human));
  }

  .player-card[data-faction="elf"] {
    border-left: 3px solid var(--team-primary, var(--accent-elf));
  }

  .player-card[data-faction="orc"] {
    border-left: 3px solid var(--team-primary, var(--accent-orc));
  }

  .player-card[data-faction="dwarf"] {
    border-left: 3px solid var(--team-primary, var(--accent-dwarf));
  }

  .player-card[data-faction="goblin"] {
    border-left: 3px solid var(--team-primary, var(--accent-goblin));
  }

  .player-card[data-faction="nightelf"] {
    border-left: 3px solid var(--team-primary, var(--accent-nightelf));
  }

  .player-header,
  .stats,
  .price,
  .select-btn {
    position: relative;
    z-index: 1;
  }

  .player-header {
    display: flex;
    gap: 0.9rem;
    align-items: flex-start;
  }

  .avatar-container {
    position: relative;
    width: 48px;
    height: 48px;
    flex: 0 0 auto;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 999px;
    object-fit: cover;
    border: 2px solid rgba(var(--team-primary-rgb, 30, 64, 175), 0.3);
    background: var(--bg-secondary);
  }

  .player-card[data-faction="human"] .avatar-img {
    box-shadow: 0 0 6px rgba(var(--team-primary-rgb, 30, 64, 175), 0.2);
  }

  .player-card[data-faction="elf"] .avatar-img {
    box-shadow: 0 0 6px rgba(var(--team-primary-rgb, 30, 64, 175), 0.2);
  }

  .player-card[data-faction="orc"] .avatar-img {
    box-shadow: 0 0 6px rgba(var(--team-primary-rgb, 30, 64, 175), 0.2);
  }

  .player-card[data-faction="dwarf"] .avatar-img {
    box-shadow: 0 0 6px rgba(var(--team-primary-rgb, 30, 64, 175), 0.2);
  }

  .player-card[data-faction="goblin"] .avatar-img {
    box-shadow: 0 0 6px rgba(var(--team-primary-rgb, 30, 64, 175), 0.2);
  }

  .player-card[data-faction="nightelf"] .avatar-img {
    box-shadow: 0 0 6px rgba(var(--team-primary-rgb, 30, 64, 175), 0.2);
  }

  .faction-badge {
    position: absolute;
    right: -0.15rem;
    bottom: -0.15rem;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--bg-elevated);
    border: 1px solid rgba(var(--team-primary-rgb, 30, 64, 175), 0.25);
    font-size: 0.72rem;
    box-shadow: none;
  }

  .player-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.2rem;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--team-primary, var(--text-primary));
  }

  .name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-info .role {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .status-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.4rem;
    margin-top: 0.25rem;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .status-row::-webkit-scrollbar {
    display: none;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.28rem 0.55rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .status-pill.available {
    background: rgba(var(--accent-emerald-rgb), 0.12);
    color: var(--accent-emerald);
    border-color: rgba(var(--accent-emerald-rgb), 0.24);
  }

  .status-pill.locked {
    background: rgba(148, 163, 184, 0.08);
    color: var(--text-muted);
    border-color: rgba(148, 163, 184, 0.16);
  }

  .status-pill.retiring {
    background: rgba(var(--accent-gold-rgb), 0.12);
    color: var(--warning);
    border-color: rgba(var(--accent-gold-rgb), 0.24);
  }

  .status-pill.injury {
    background: rgba(var(--accent-ruby-rgb), 0.12);
    color: var(--danger);
    border-color: rgba(var(--accent-ruby-rgb), 0.24);
  }

  .status-pill.xp {
    background: rgba(var(--accent-amethyst-rgb), 0.12);
    color: var(--accent-amethyst);
    border-color: rgba(var(--accent-amethyst-rgb), 0.24);
  }

  .status-pill.xp.can-upgrade {
    background: rgba(var(--accent-gold-rgb), 0.2);
    color: var(--warning);
    border-color: rgba(var(--accent-gold-rgb), 0.4);
    animation: xp-pulse 2s ease-in-out infinite;
  }

  @keyframes xp-pulse {
    0%, 100% { box-shadow: 0 0 4px rgba(var(--accent-gold-rgb), 0.3); }
    50% { box-shadow: 0 0 12px rgba(var(--accent-gold-rgb), 0.6); }
  }

  .edit-name-container {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .edit-name-input {
    width: min(100%, 13rem);
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
  }

  .icon-btn {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--surface-outline);
    color: var(--text-secondary);
  }

  .icon-btn.edit-btn {
    opacity: 0;
  }

  .player-card:hover .icon-btn.edit-btn {
    opacity: 1;
  }

  .icon-btn.edit-btn:hover {
    color: rgba(var(--team-primary-rgb, 30, 64, 175), 0.9);
    background: rgba(var(--team-primary-rgb, 30, 64, 175), 0.12);
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

  .stats {
    display: grid;
    gap: 0.55rem;
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .stat-label {
    width: 3.25rem;
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .stat-bar {
    flex: 1;
    height: 0.45rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .stat-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.9), rgba(var(--team-secondary-rgb, 251, 191, 36), 0.8));
  }

  .stat-bar-fill.high {
    background: linear-gradient(90deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.95), rgba(var(--team-secondary-rgb, 251, 191, 36), 0.85));
  }

  .stat-bar-fill.medium {
    background: linear-gradient(90deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.7), rgba(var(--team-secondary-rgb, 251, 191, 36), 0.6));
  }

  .stat-bar-fill.low {
    background: linear-gradient(90deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.5), rgba(var(--team-secondary-rgb, 251, 191, 36), 0.4));
  }

  .stat-value {
    width: 2rem;
    text-align: right;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .mini-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    padding-top: 0.45rem;
    border-top: 1px solid rgba(var(--team-primary-rgb, 30, 64, 175), 0.18);
  }

  .mini-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    background: rgba(var(--team-primary-rgb, 30, 64, 175), 0.04);
    border: 1px solid rgba(var(--team-primary-rgb, 30, 64, 175), 0.14);
  }

  .price {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--warning);
  }

  .select-btn {
    width: 100%;
    margin-top: 0.25rem;
  }

  .select-btn.selected {
    background: linear-gradient(180deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.98), rgba(var(--team-primary-rgb, 30, 64, 175), 0.78));
    color: #fff;
  }

  @media (max-width: 720px) {
    .player-header {
      align-items: flex-start;
    }

    .mini-grid {
      grid-template-columns: 1fr;
    }
  }

  :global([data-theme="light"]) .player-card {
    border-color: rgba(15, 23, 42, 0.08);
  }
  :global([data-theme="light"]) .icon-btn {
    background: rgba(15, 23, 42, 0.03);
  }
  :global([data-theme="light"]) .stat-bar {
    background: rgba(15, 23, 42, 0.05);
  }
</style>
