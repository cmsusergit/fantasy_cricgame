<script lang="ts">
  import { onMount } from 'svelte';
  import { teamStore } from '$lib/stores/gameState';
  import type { Team } from '$lib/models/team';
  import { calculateTeamStrength, PERSONALITY_DESCRIPTIONS } from '$lib/core/teamBuilder';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import { FACTIONS } from '$lib/models/faction';
  import { getCrowdFavourites } from '$lib/core/fanSystem';

  let teams = $state<Team[]>([]);
  let selectedTeamId = $state<string>('');
  
  onMount(() => {
    const unsub = teamStore.subscribe(t => {
      teams = t;
      if (t.length > 0 && !selectedTeamId) {
        // Default to user team or first team
        const userTeam = t.find((team: any) => team.isUserTeam);
        selectedTeamId = userTeam ? userTeam.id : t[0].id;
      }
    });
    return unsub;
  });

  let selectedTeam = $derived(teams.find(t => t.id === selectedTeamId));
  let teamStrength = $derived(selectedTeam ? calculateTeamStrength(selectedTeam) : null);
  
  let filterRole = $state<string>('all');
  
  let displayedPlayers = $derived((() => {
    if (!selectedTeam) return [];
    let players = selectedTeam.players;
    if (filterRole !== 'all') {
      players = players.filter(p => p.role === filterRole);
    }
    return players;
  })());

  let crowdFavouriteIds = $derived(new Set(
    (selectedTeam ? getCrowdFavourites(selectedTeam, 3) : []).map(p => p.id)
  ));

  let topPlayers = $derived((() => {
      if (!selectedTeam) return [];
      return [...selectedTeam.players].sort((a, b) => {
          const aTotal = a.stats.batting + a.stats.bowling + a.stats.technique + a.stats.power;
          const bTotal = b.stats.batting + b.stats.bowling + b.stats.technique + b.stats.power;
          return bTotal - aTotal;
      }).slice(0, 3);
  })());

  function getFactionColor(factionType: string | undefined) {
      if (!factionType) return 'var(--border-color)';
      const mapping: Record<string, string> = {
          'human': 'var(--accent-human)',
          'elf': 'var(--accent-elf)',
          'orc': 'var(--accent-orc)',
          'dwarf': 'var(--accent-dwarf)',
          'goblin': 'var(--accent-goblin)',
          'nightelf': 'var(--accent-nightelf)'
      };
      return mapping[factionType] || 'var(--border-color)';
  }

  function getFactionName(factionType: string | undefined) {
      if (!factionType) return 'Unknown';
      return FACTIONS[factionType as keyof typeof FACTIONS]?.name || 'Unknown';
  }

  function hexToRgb(hex: string): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '148, 163, 184';
  }
</script>

<svelte:head>
  <title>League Teams - Fantasy Cricket</title>
</svelte:head>

<div class="teams-page">
  <div class="teams-sidebar">
    <h3>Franchises</h3>
    <div class="team-list">
      {#each teams as team}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="team-selector-item" class:active={selectedTeamId === team.id} onclick={() => selectedTeamId = team.id} style="border-left-color: {team.colorPrimary}">
          <div class="team-name">{team.name} {team.isUserTeam ? '(You)' : ''}</div>
          <div class="team-faction">{getFactionName(team.faction)}</div>
        </div>
      {/each}
    </div>
  </div>

  <div class="team-details">
    {#if selectedTeam && teamStrength}
      <div class="team-header" style="border-top: 4px solid {selectedTeam.colorPrimary}; background: linear-gradient(135deg, {selectedTeam.colorPrimary}15, {selectedTeam.colorSecondary}30);">
        <div class="header-main">
          <h1 style="color: {selectedTeam.colorPrimary}">{selectedTeam.name}</h1>
          <div class="coach-badge">Coach: {selectedTeam.coach}</div>
        </div>
        <div class="team-meta">
          <div class="meta-item">
            <span class="label">Playstyle</span>
            <span class="value">{selectedTeam.personality}</span>
            <span class="desc" style="font-size: 0.7em; color: var(--text-secondary); display: block;">{PERSONALITY_DESCRIPTIONS[selectedTeam.personality]}</span>
          </div>
          <div class="meta-item">
            <span class="label">Overall Rating</span>
            <span class="value stars">{'⭐'.repeat(teamStrength.stars)}{'☆'.repeat(5 - teamStrength.stars)}</span>
          </div>
        </div>
      </div>

      <div class="analysis-panel" style="--team-primary: {selectedTeam.colorPrimary}; --team-secondary: {selectedTeam.colorSecondary}; --team-primary-rgb: {hexToRgb(selectedTeam.colorPrimary)}; --team-secondary-rgb: {hexToRgb(selectedTeam.colorSecondary)};">
        <div class="strength-bars">
          <h3 style="color: {selectedTeam.colorPrimary};">Squad Strength Assessment</h3>
          <div class="stat-row">
            <span class="stat-label">Batting</span>
            <div class="stat-bar">
              <div class="stat-bar-fill team-fill" style="width: {teamStrength.batting}%"></div>
            </div>
            <span class="stat-value">{teamStrength.batting}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Bowling</span>
            <div class="stat-bar">
              <div class="stat-bar-fill team-fill" style="width: {teamStrength.bowling}%"></div>
            </div>
            <span class="stat-value">{teamStrength.bowling}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Fielding</span>
            <div class="stat-bar">
              <div class="stat-bar-fill team-fill" style="width: {teamStrength.fielding}%"></div>
            </div>
            <span class="stat-value">{teamStrength.fielding}</span>
          </div>
        </div>

        <div class="star-players">
          <h3>Key Players</h3>
          <div class="key-players-list">
             {#each topPlayers as p}
                 <div class="key-player-row">
                     <span class="p-name">{p.name}</span>
                     <span class="p-role">{p.role}</span>
                 </div>
             {/each}
          </div>
        </div>
      </div>

      <div class="roster-section">
        <div class="roster-header">
          <h3>Full Roster ({selectedTeam.players.length})</h3>
          <select bind:value={filterRole} class="role-filter">
            <option value="all">All Roles</option>
            <option value="batsman">Batsman</option>
            <option value="allrounder">All-rounder</option>
            <option value="bowler">Bowler</option>
            <option value="wicketkeeper">Wicket Keeper</option>
          </select>
        </div>
        
        <div class="players-grid">
          {#each displayedPlayers as player}
            <div class="player-wrapper">
              {#if crowdFavouriteIds.has(player.id)}
                <div class="cf-badge" title="Crowd Favourite">⭐</div>
              {/if}
              <PlayerCard {player} hideAvailability={true} teamColorPrimary={selectedTeam.colorPrimary} teamColorSecondary={selectedTeam.colorSecondary} />
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .teams-page {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    gap: 10px;
    padding-bottom: 60px;
  }
  
  .teams-sidebar {
    width: 250px;
    flex-shrink: 0;
  }
  
  .teams-sidebar h3 {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .team-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .team-selector-item {
    padding: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-left-width: 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .team-selector-item:hover {
    background: var(--bg-tertiary);
  }
  
  .team-selector-item.active {
    background: var(--bg-tertiary);
    border-color: var(--text-primary);
    box-shadow: 0 0 8px rgba(var(--team-primary-rgb, 30, 64, 175), 0.15);
  }
  
  .team-name {
    font-weight: 600;
    font-size: 14px;
  }
  
  .team-faction {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
  }
  
  .team-details {
    flex: 1;
  }
  
  .team-header {
    background: var(--bg-secondary);
    padding: 14px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .header-main h1 {
    margin-bottom: 8px;
  }
  
  .coach-badge {
    display: inline-block;
    background: var(--bg-tertiary);
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 14px;
    color: var(--text-secondary);
  }
  
  .team-meta {
    display: flex;
    gap: 10px;
    text-align: right;
  }
  
  .meta-item {
    display: flex;
    flex-direction: column;
  }
  
  .meta-item .label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  
  .meta-item .value {
    font-size: 15px;
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .meta-item .value.stars {
    color: var(--warning);
  }
  
  .analysis-panel {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  
  .strength-bars, .star-players {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
  }
  
  .strength-bars h3, .star-players h3 {
    margin-bottom: 12px;
    font-size: 16px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  
  .stat-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  
  .stat-label {
    width: 60px;
    font-size: 14px;
    font-weight: 600;
  }
  
  .stat-bar {
    flex: 1;
    background: var(--bg-tertiary);
    border-radius: 4px;
    height: 12px;
    overflow: hidden;
  }
  
  .stat-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
  }
  
  .stat-bar-fill.high { background: var(--success); }
  .stat-bar-fill.medium { background: var(--warning); }
  .stat-bar-fill.low { background: var(--danger); }
  .stat-bar-fill.team-fill {
    background: linear-gradient(90deg, rgba(var(--team-primary-rgb, 30, 64, 175), 0.95), rgba(var(--team-secondary-rgb, 251, 191, 36), 0.85));
  }
  
  .stat-value {
    width: 30px;
    text-align: right;
    font-family: monospace;
    font-size: 16px;
    font-weight: bold;
  }
  
  .key-players-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .key-player-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-radius: 6px;
    border-left: 3px solid var(--team-primary, var(--accent-sapphire));
  }
  
  .key-player-row .p-name {
    font-weight: 600;
    font-size: 14px;
  }
  
  .key-player-row .p-role {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .roster-section h3 { margin-bottom: 12px; }

  .roster-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
  }

  .role-filter {
      padding: 6px 12px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
  }
  
  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  .player-wrapper {
    position: relative;
  }

  .cf-badge {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    font-size: 1rem;
    z-index: 2;
    pointer-events: none;
    filter: drop-shadow(0 0 3px rgba(255, 200, 0, 0.5));
  }

  @media (max-width: 768px) {
    .teams-page {
      flex-direction: column;
    }
    .teams-sidebar {
      width: 100%;
      display: flex;
      overflow-x: auto;
    }
    .team-list {
      flex-direction: row;
    }
    .analysis-panel {
      grid-template-columns: 1fr;
    }
    .team-meta {
      flex-direction: column;
      gap: 10px;
      text-align: left;
    }
  }
</style>