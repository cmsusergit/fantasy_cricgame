<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import {
    currentDay,
    currentSeason,
    gamePhase,
    initializeGame,
    resetGame,
    saveCurrentGame,
    teamStore,
    type GamePhase
  } from '$lib/stores/gameState';
  import type { Team } from '$lib/models/team';

  let { children } = $props();

  let theme = $state<'dark' | 'light'>('dark');
  let isResetting = $state(false);
  let newTeamName = $state('Your Team');
  let newManagerName = $state('You');
  let newCoat = $state('🛡️');
  let teams = $state<Team[]>([]);

  const teamAdjectives = ['Mighty', 'Royal', 'Cosmic', 'Thunder', 'Steel', 'Golden', 'Shadow', 'Silver'];
  const teamNouns = ['Lions', 'Eagles', 'Titans', 'Warriors', 'Knights', 'Dragons', 'Strikers', 'Panthers'];
  const managerFirstNames = ['John', 'Mike', 'David', 'Chris', 'James', 'Sarah', 'Emma', 'Alex'];
  const managerLastNames = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Miller', 'Moore'];
  const predefinedCoats = ['🛡️', '🦅', '🦁', '🐺', '⚔️', '👑', '🐉', '⚓', '⚡', '🏹'];

  type NavItem = {
    href: string;
    label: string;
    accent: string;
    showWhen?: (phase: GamePhase) => boolean;
  };

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', accent: 'info' },
    { href: '/match', label: 'Match', accent: 'danger' },
    { href: '/squad', label: 'Squad', accent: 'brand', showWhen: (phase: GamePhase) => phase !== 'match' },
    { href: '/auction', label: 'Auction', accent: 'warning', showWhen: (phase: GamePhase) => phase === 'auction' },
    { href: '/retention', label: 'Retention', accent: 'danger', showWhen: (phase: GamePhase) => phase === 'retention' },
    { href: '/scouting', label: 'Scouting', accent: 'info', showWhen: (phase: GamePhase) => phase === 'scouting' },
    { href: '/club', label: 'Club', accent: 'brand' },
    { href: '/training', label: 'Training', accent: 'success' },
    { href: '/budget', label: 'Budget', accent: 'warning' },
    { href: '/tournament', label: 'Tournament', accent: 'brand' },
    { href: '/teams', label: 'Teams', accent: 'brand' },
    { href: '/season-review', label: 'Review', accent: 'success', showWhen: (phase: GamePhase) => phase === 'season_end' },
    { href: '/guide', label: 'Guide', accent: 'warning' }
  ];

  onMount(() => {
    const saved = localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
    theme = saved;
    document.documentElement.setAttribute('data-theme', theme);

    const unsubTeams = teamStore.subscribe((value) => {
      teams = value;
    });

    void initializeGame();

    return () => {
      unsubTeams();
    };
  });

  const userTeam = $derived(teams.find((team) => team.isUserTeam));
  const visibleNavItems = $derived(
    navItems.filter((item) => !item.showWhen || item.showWhen($gamePhase))
  );

  function randomizeTeam() {
    newTeamName = `${teamAdjectives[Math.floor(Math.random() * teamAdjectives.length)]} ${teamNouns[Math.floor(Math.random() * teamNouns.length)]}`;
  }

  function randomizeManager() {
    newManagerName = `${managerFirstNames[Math.floor(Math.random() * managerFirstNames.length)]} ${managerLastNames[Math.floor(Math.random() * managerLastNames.length)]}`;
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  function handleReset() {
    isResetting = true;
  }

  async function confirmReset() {
    await resetGame();
    await initializeGame(newTeamName || 'Your Team', newManagerName || 'You', newCoat);
    await saveCurrentGame(100000);
    isResetting = false;
    window.location.href = '/';
  }

  function cancelReset() {
    isResetting = false;
  }

  function getPhaseLabel(phase: GamePhase): string {
    switch (phase) {
      case 'menu':
        return 'Front Office';
      case 'tournament':
        return 'Tournament Day';
      case 'match':
        return 'Live Match';
      case 'season_end':
        return 'Season Review';
      case 'retention':
        return 'Retention Board';
      case 'scouting':
        return 'Scouting Network';
      case 'trading':
        return 'Trading Desk';
      case 'auction':
        return 'Auction House';
      default:
        return phase;
    }
  }

  function isActiveRoute(pathname: string, href: string) {
    return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  }
</script>

<div class="page-shell">
  <header class="topbar">
    <div class="shell-brand">
      <div class="shell-brand-mark">FC</div>
      <div class="shell-brand-copy">
        <p class="eyebrow">Fantasy CricManager</p>
        <h1>War Room</h1>
        <p>{getPhaseLabel($gamePhase)}</p>
      </div>
    </div>

    <div class="shell-meta">
      <span class="badge info">Season {$currentSeason}</span>
      <span class="badge success">Day {$currentDay}</span>
      <span class="badge warning">{getPhaseLabel($gamePhase)}</span>
      {#if userTeam}
        <span class="badge">Budget ${userTeam.budget.toLocaleString()}</span>
        <span class="badge">Ops ${userTeam.operatingBudget.toLocaleString()}</span>
        <span class="badge info">{userTeam.fanProfile?.popularity ?? 50}% Crowd</span>
      {/if}
    </div>

    <div class="shell-actions">
      <button class="shell-button" onclick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button class="reset-button" onclick={handleReset} title="Reset game progress">
        Reset Game
      </button>
    </div>
  </header>

  <nav class="shell-nav glass-card" aria-label="Primary navigation">
    {#each visibleNavItems as item}
      <a
        href={item.href}
        class="nav-item"
        data-active={isActiveRoute($page.url.pathname, item.href)}
      >
        {item.label}
      </a>
    {/each}
  </nav>

  <main class="page-container shell-content">
    {#key $page.url.pathname}
      <div in:fade={{ duration: 160, delay: 80 }} out:fade={{ duration: 120 }}>
        {@render children()}
      </div>
    {/key}
  </main>

  <nav class="mobile-nav glass-card" aria-label="Mobile navigation">
    {#each visibleNavItems as item}
      <a
        href={item.href}
        class="mobile-nav-item"
        data-active={isActiveRoute($page.url.pathname, item.href)}
      >
        {item.label}
      </a>
    {/each}
  </nav>
</div>

{#if isResetting}
  <div class="modal-backdrop">
    <div class="modal-card surface-strong">
      <div class="section-title" style="margin-bottom: 1rem;">
        <div>
          <p class="eyebrow">System reset</p>
          <h2>Start a new franchise</h2>
        </div>
      </div>
      <p class="section-subtitle" style="margin-bottom: 1.25rem;">
        A reset clears the current save and rebuilds the league from scratch.
      </p>

      <div class="stack">
        <div class="field-group">
          <label class="small-label" for="teamName">Team Name</label>
          <div class="command-row">
            <input id="teamName" type="text" bind:value={newTeamName} placeholder="E.g., Mumbai Indians" />
            <button class="btn-secondary" onclick={randomizeTeam} title="Randomize team name">🎲</button>
          </div>
        </div>

        <div class="field-group">
          <label class="small-label" for="managerName">Manager Name</label>
          <div class="command-row">
            <input id="managerName" type="text" bind:value={newManagerName} placeholder="E.g., John Doe" />
            <button class="btn-secondary" onclick={randomizeManager} title="Randomize manager name">🎲</button>
          </div>
        </div>

        <div class="field-group">
          <label class="small-label">Coat of Arms</label>
          <div class="command-row" style="flex-wrap: wrap;">
            {#each predefinedCoats as coat}
              <button
                class="btn-secondary"
                class:is-active={newCoat === coat}
                onclick={() => (newCoat = coat)}
                style="font-size: 1.35rem; width: 3rem; height: 3rem; padding: 0;"
                aria-label={`Select ${coat}`}
              >
                {coat}
              </button>
            {/each}
          </div>
          <input id="logoUrl" type="text" bind:value={newCoat} placeholder="Or enter a custom emoji or character" />
        </div>

        <div class="command-row" style="justify-content: flex-end; margin-top: 0.5rem;">
          <button class="btn-secondary" onclick={cancelReset}>Cancel</button>
          <button class="btn-primary" onclick={confirmReset}>Start New Game</button>
        </div>
      </div>
    </div>
  </div>
{/if}
