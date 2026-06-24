<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { gameAudio } from '$lib/services/audio';
  import { page } from '$app/stores';
  import {
    currentDay,
    currentSeason,
    gamePhase,
    initializeGame,
    resetGame,
    saveCurrentGame,
    teamStore,
    type GamePhase,
    TEAM_COLORS
  } from '$lib/stores/gameState';
  import type { Team } from '$lib/models/team';
  import TeamLogo from '$lib/components/team/TeamLogo.svelte';

  let { children } = $props();

  let theme = $state<'dark' | 'light'>('dark');
  let isResetting = $state(false);
  let newTeamName = $state('Your Team');
  let newManagerName = $state('You');
  let designBgShape = $state('shield');
  let designBgColor = $state('#1e40af');
  let designSymbol = $state('valkyrie_helmet');
  let designSymbolColor = $state('#fbbf24');

  const customLogoString = $derived(`custom|${designBgShape}|${designBgColor}|${designSymbol}|${designSymbolColor}`);
  let teams = $state<Team[]>([]);
  let startWithAuctionOption = $state(false);
  let selectedColorIndex = $state(0);

  let showSettingsModal = $state(false);
  let showMoreMenu = $state(false);
  let audioEnabled = $state(false);
  let crowdVolume = $state(0.5);
  let dialogueVolume = $state(0.5);

  function openSettings() {
    audioEnabled = gameAudio.getAudioEnabled();
    crowdVolume = gameAudio.getCrowdVolume();
    dialogueVolume = gameAudio.getDialogueVolume();
    showSettingsModal = true;
  }

  function closeSettings() {
    showSettingsModal = false;
  }

  function handleAudioToggle(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    audioEnabled = checked;
    gameAudio.setAudioEnabled(checked);
  }

  function handleCrowdVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    crowdVolume = val;
    gameAudio.setCrowdVolume(val);
  }

  function handleDialogueVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    dialogueVolume = val;
    gameAudio.setDialogueVolume(val);
  }

  const teamAdjectives = ['Mighty', 'Royal', 'Cosmic', 'Thunder', 'Steel', 'Golden', 'Shadow', 'Silver'];
  const teamNouns = ['Lions', 'Eagles', 'Titans', 'Warriors', 'Knights', 'Dragons', 'Strikers', 'Panthers'];
  const managerFirstNames = ['John', 'Mike', 'David', 'Chris', 'James', 'Sarah', 'Emma', 'Alex'];
  const managerLastNames = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Miller', 'Moore'];
  const designSymbols = [
    'unicorn', 'dragon_fire', 'dragon_serpent', 'wizard_magic', 'tree_of_life',
    'ram_horns', 'demon_horns', 'valkyrie_helmet', 'gargoyle_statue', 'gargoyle_wings',
    'archer_bow', 'elven_bow', 'hunter_bow', 'siren_tail', 'crest_ornament',
    'crest_filigree', 'shield_filigree', 'crown_filigree', 'star_filigree', 'mystic_symbol',
    'sword', 'crown', 'lightning', 'star', 'wolf', 'dragon'
  ];

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
    { href: '/guide', label: 'Guide', accent: 'warning' },
    { href: '#settings', label: 'Settings', accent: 'warning' }
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

  const mobilePrimaryItems = $derived(
    visibleNavItems.filter(item => !['Training', 'Budget', 'Tournament', 'Teams', 'Review', 'Guide', 'Settings'].includes(item.label)).slice(0, 4)
  );

  const mobileMoreItems = $derived([
    ...visibleNavItems.filter(item => ['Training', 'Budget', 'Tournament', 'Teams', 'Review', 'Guide', 'Settings'].includes(item.label)),
    ...visibleNavItems.filter(item => !['Training', 'Budget', 'Tournament', 'Teams', 'Review', 'Guide', 'Settings'].includes(item.label)).slice(4)
  ]);

  const isMoreActive = $derived(
    mobileMoreItems.some(item => {
      if (item.href === '#settings') return showSettingsModal;
      return isActiveRoute($page.url.pathname, item.href);
    })
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
    await initializeGame(newTeamName || 'Your Team', newManagerName || 'You', customLogoString, startWithAuctionOption, selectedColorIndex);
    await saveCurrentGame(4000000);
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


  function getNavIcon(label: string): string {
    switch (label) {
      case 'Dashboard':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"/></svg>`;
      case 'Squad':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
      case 'Match':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
      case 'Auction':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg>`;
      case 'Training':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
      case 'Club':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;
      case 'Budget':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
      case 'Tournament':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
      case 'Teams':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`;
      case 'Guide':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`;
      case 'Settings':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"/></svg>`;
    }
  }
</script>

  <div class="page-shell-wrapper">
    <!-- Desktop Sticky Left Sidebar (hidden on mobile) -->
    <aside class="sidebar-left">
      <div class="sidebar-brand-header">
        <div class="brand-logo-group">
          <div class="logo-circle">
            <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2c1.5 3 2.5 6.5 2.5 10S13.5 19 12 22" />
              <path d="M12 2C10.5 5 9.5 8.5 9.5 12S10.5 19 12 22" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <div class="logo-text">CRIC<span class="mgr-cyan">MGR</span></div>
        </div>
        <button class="collapse-arrow-btn" aria-label="Collapse sidebar">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <!-- Quick Stats Pane (Matches ttyy.png style) -->
      <div class="sidebar-stats">
        <div class="stat-row">
          <span class="label">DAY</span>
          <span class="val text-gold">{$currentDay}</span>
        </div>
        <!-- Season display removed as requested -->
        <div class="stat-row">
          <span class="label">BUDGET</span>
          <span class="val text-emerald">${userTeam ? userTeam.budget.toLocaleString() : '0'}</span>
        </div>
        <div class="stat-row">
          <span class="label">RECORD</span>
          <span class="val">{userTeam ? `${userTeam.wins}W • ${userTeam.losses}L` : '0W • 0L'}</span>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="Sidebar navigation">
        {#each visibleNavItems as item}
          <a
            href={item.href}
            class="sidebar-nav-item"
            data-active={item.href === '#settings' ? showSettingsModal : isActiveRoute($page.url.pathname, item.href)}
            onclick={(e) => {
              if (item.href === '#settings') {
                e.preventDefault();
                openSettings();
              }
            }}
          >
            <span class="nav-icon">{@html getNavIcon(item.label)}</span>
            <span class="nav-label">{item.label}</span>
            {#if item.href !== '#settings' && isActiveRoute($page.url.pathname, item.href)}
              <span class="active-indicator-dot"></span>
            {/if}
          </a>
        {/each}
      </nav>
    </aside>

    <!-- Right side content area -->
    <div class="content-wrapper">
      <!-- Sticky Mobile Header (only active on mobile/tablet) -->
      <header class="mobile-topbar">
        <div class="logo-text">CRIC<span class="mgr-cyan">MGR</span></div>
        
        <div class="mobile-stats-row">
          <div class="m-stat"><span class="m-lbl">D</span><span class="m-val text-gold">{$currentDay}</span></div>
          <!-- Season display removed as requested -->
          <div class="m-stat"><span class="m-lbl">B</span><span class="m-val text-emerald">${userTeam ? (userTeam.budget / 1000).toFixed(0) : '0'}k</span></div>
          <div class="m-stat"><span class="m-lbl">R</span><span class="m-val">{userTeam ? `${userTeam.wins}W-${userTeam.losses}L` : '0-0'}</span></div>
        </div>

        <div class="mobile-topbar-actions">
          <button class="m-action-btn" onclick={openSettings} title="Settings">
            ⚙️
          </button>
        </div>
      </header>

      <!-- Page contents container -->
      <main class="page-container shell-content">
        {#key $page.url.pathname}
          <div in:fade={{ duration: 160, delay: 80 }} out:fade={{ duration: 120 }}>
            {@render children()}
          </div>
        {/key}
        
        <footer class="app-footer" style="margin-top: 40px; padding: 20px 0; border-top: 1px solid var(--border-color); text-align: center; font-size: 0.85rem; color: var(--text-secondary); opacity: 0.8;">
          <p>© 2026 cmsusergit. All rights reserved.</p>
        </footer>
      </main>

      <!-- More Menu Drawer (Mobile) -->
      {#if showMoreMenu}
        <div
          class="more-menu-backdrop"
          onclick={() => (showMoreMenu = false)}
          onkeydown={(e) => { if (e.key === 'Escape') showMoreMenu = false; }}
          role="button"
          tabindex="-1"
          aria-label="Close menu"
        ></div>

        <div class="more-menu-drawer surface-strong" transition:fade={{ duration: 150 }}>
          <div class="more-menu-header">
            <h3>More Features</h3>
            <button class="more-menu-close" onclick={() => showMoreMenu = false}>✕</button>
          </div>
          <div class="more-menu-grid">
            {#each mobileMoreItems as item}
              <a
                href={item.href}
                class="more-menu-item"
                onclick={(e) => {
                  showMoreMenu = false;
                  if (item.href === '#settings') {
                    e.preventDefault();
                    openSettings();
                  }
                }}
                data-active={item.href === '#settings' ? showSettingsModal : isActiveRoute($page.url.pathname, item.href)}
              >
                <span class="more-icon">{@html getNavIcon(item.label)}</span>
                <span class="more-label">{item.label}</span>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Mobile Bottom Tab Navigation -->
      <nav class="mobile-nav-bar" aria-label="Mobile navigation">
        {#each mobilePrimaryItems as item}
          <a
            href={item.href}
            class="mobile-nav-tab"
            data-active={isActiveRoute($page.url.pathname, item.href)}
          >
            <span class="tab-icon">{@html getNavIcon(item.label)}</span>
            <span class="tab-label">{item.label}</span>
          </a>
        {/each}
        {#if mobileMoreItems.length > 0}
          <button
            class="mobile-nav-tab more-toggle-btn"
            data-active={isMoreActive}
            onclick={() => (showMoreMenu = !showMoreMenu)}
            aria-label="More options"
            aria-expanded={showMoreMenu}
            type="button"
          >
            <span class="tab-icon">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </span>
            <span class="tab-label">More</span>
          </button>
        {/if}
      </nav>
    </div>
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

        <div class="designer-panel surface-strong" style="padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px;">
          
          <div style="display: flex; gap: 16px; align-items: center; justify-content: center; padding: 10px; background: rgba(0,0,0,0.25); border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <span class="small-label" style="margin-bottom: 0; font-weight: bold; color: var(--text-primary);">Emblem Preview:</span>
            <div style="width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border-radius: 50%; border: 1px solid var(--border-color);">
              <TeamLogo logo={customLogoString} size={72} />
            </div>
          </div>

          <!-- Shape Selector -->
          <div>
            <span class="small-label">Base Shape</span>
            <div class="command-row" style="flex-wrap: wrap; gap: 6px; margin-top: 4px;">
              {#each ['shield', 'circle', 'diamond', 'hexagon'] as shape}
                <button
                  class="btn-secondary"
                  class:is-active={designBgShape === shape}
                  onclick={() => designBgShape = shape}
                  style="flex: 1; text-transform: capitalize; padding: 6px 12px; font-size: 0.85rem; height: auto;"
                  type="button"
                >
                  {shape}
                </button>
              {/each}
            </div>
          </div>

          <!-- Symbol Selector -->
          <div>
            <span class="small-label">Emblem Symbol</span>
            <div style="max-height: 180px; overflow-y: auto; padding: 6px; border: 1px solid rgba(148, 163, 184, 0.08); border-radius: 6px; background: rgba(0,0,0,0.15); margin-top: 4px;">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; justify-items: center;">
                {#each designSymbols as symbol}
                  <button
                    class="btn-secondary"
                    class:is-active={designSymbol === symbol}
                    onclick={() => designSymbol = symbol}
                    style="width: 48px; height: 48px; padding: 0; display: flex; align-items: center; justify-content: center;"
                    title={symbol.replace('_', ' ')}
                    type="button"
                  >
                    <TeamLogo logo={`custom|shield|#1e293b|${symbol}|#cbd5e1`} size={46} />
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <!-- Color Options -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <span class="small-label">Base Color</span>
              <div class="color-picker-row" style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                <input type="color" bind:value={designBgColor} style="width: 2.2rem; height: 2.2rem; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer; background: none; padding: 0;" />
                <input type="text" bind:value={designBgColor} style="flex: 1; height: 2.2rem; font-size: 0.85rem; padding: 4px 8px; border-radius: 4px;" />
              </div>
            </div>
            
            <div>
              <span class="small-label">Symbol Color</span>
              <div class="color-picker-row" style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                <input type="color" bind:value={designSymbolColor} style="width: 2.2rem; height: 2.2rem; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer; background: none; padding: 0;" />
                <input type="text" bind:value={designSymbolColor} style="flex: 1; height: 2.2rem; font-size: 0.85rem; padding: 4px 8px; border-radius: 4px;" />
              </div>
            </div>
          </div>

        </div>

        <!-- Start Mode Selection -->
        <div class="field-group">
          <span class="small-label">Starting Setup</span>
          <div class="command-row" style="gap: 16px; margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; color: var(--text-primary);">
              <input type="radio" name="startMode" checked={!startWithAuctionOption} onchange={() => startWithAuctionOption = false} style="width: 1rem; height: 1rem; accent-color: var(--color-accent);" />
              <span>Predefined Balanced Squad</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; color: var(--text-primary);">
              <input type="radio" name="startMode" checked={startWithAuctionOption} onchange={() => startWithAuctionOption = true} style="width: 1rem; height: 1rem; accent-color: var(--color-accent);" />
              <span>Inaugural Squad Auction</span>
            </label>
          </div>
        </div>

        <!-- Color Scheme Selection -->
        <div class="field-group" style="margin-bottom: 0.75rem;">
          <span class="small-label">Team Color Scheme</span>
          <div class="command-row" style="flex-wrap: wrap; gap: 8px; margin-top: 4px;">
            {#each TEAM_COLORS as color, idx}
              <button
                class="color-scheme-btn"
                class:is-active={selectedColorIndex === idx}
                onclick={() => (selectedColorIndex = idx)}
                style="width: 3rem; height: 2.2rem; padding: 4px; border-radius: 4px; border: 2px solid {selectedColorIndex === idx ? 'var(--color-accent)' : 'var(--border-color)'}; background: {color.primary}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 2px;"
                title="Select Color Scheme"
                type="button"
              >
                <span style="width: 10px; height: 10px; border-radius: 50%; background: {color.secondary}; display: inline-block;"></span>
              </button>
            {/each}
          </div>
        </div>

        <div class="command-row" style="justify-content: flex-end; margin-top: 0.5rem;">
          <button class="btn-secondary" onclick={cancelReset}>Cancel</button>
          <button class="btn-primary" onclick={confirmReset}>Start New Game</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showSettingsModal}
  <div
    class="modal-backdrop"
    onclick={(e) => { if (e.target === e.currentTarget) closeSettings(); }}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeSettings(); }}
    role="button"
    tabindex="-1"
  >
    <div class="modal-card surface-strong" style="max-width: 420px; width: 90%;">
      <div class="section-title" style="margin-bottom: 1.25rem;">
        <div>
          <p class="eyebrow">Settings</p>
          <h2>Preferences & Audio</h2>
        </div>
      </div>

      <div class="stack" style="gap: 1.25rem;">
        <!-- Theme Setting -->
        <div class="field-group">
          <span class="small-label">Color Theme</span>
          <button class="btn-secondary" onclick={toggleTheme} style="width: 100%; text-align: left; justify-content: flex-start; gap: 8px;">
            {#if theme === 'dark'}
              <span class="sys-btn-icon">☀</span> Light Mode
            {:else}
              <span class="sys-btn-icon">☾</span> Dark Mode
            {/if}
          </button>
        </div>

        <!-- Audio Enabled -->
        <div class="field-group" style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 1.25rem; margin-bottom: 0;">
          <span class="small-label" style="margin-bottom: 0;">Enable Game Sound</span>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; user-select: none;">
            <input type="checkbox" checked={audioEnabled} onchange={handleAudioToggle} style="opacity: 0; width: 0; height: 0;" />
            <span class="slider-toggle" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: {audioEnabled ? 'var(--color-accent)' : 'var(--border-color)'}; transition: .3s; border-radius: 24px; display: flex; align-items: center; padding: 2px;">
              <span style="width: 20px; height: 20px; border-radius: 50%; background-color: white; transition: .3s; transform: translateX({audioEnabled ? '20px' : '0px'});"></span>
            </span>
          </label>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem; opacity: {audioEnabled ? 1 : 0.5}; pointer-events: {audioEnabled ? 'auto' : 'none'}; transition: opacity 0.2s; border-top: 1px dashed var(--border-color); padding-top: 1.25rem;">
          <!-- Crowd Volume -->
          <div class="field-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.35rem; font-family: var(--font-fantasy); text-transform: uppercase; letter-spacing: 0.16em;">
              <span>Crowd Cheer & Groan</span>
              <span class="text-gold">{Math.round(crowdVolume * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={crowdVolume} oninput={handleCrowdVolumeChange} style="width: 100%; accent-color: var(--color-accent); cursor: pointer;" aria-label="Crowd volume slider" />
          </div>

          <!-- Dialogue Volume -->
          <div class="field-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.35rem; font-family: var(--font-fantasy); text-transform: uppercase; letter-spacing: 0.16em;">
              <span>Commentary Voice (TTS)</span>
              <span class="text-gold">{Math.round(dialogueVolume * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={dialogueVolume} oninput={handleDialogueVolumeChange} style="width: 100%; accent-color: var(--color-accent); cursor: pointer;" aria-label="Commentary voice volume slider" />
          </div>
        </div>

        <!-- System Reset -->
        <div class="field-group" style="border-top: 1px solid var(--border-color); padding-top: 1.25rem; margin-bottom: 0;">
          <span class="small-label">System Actions</span>
          <button class="btn-secondary reset-btn-theme" onclick={() => { closeSettings(); handleReset(); }} style="width: 100%; text-align: left; justify-content: flex-start; gap: 8px; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2);">
            <span class="sys-btn-icon">🔄</span> Reset Game progress
          </button>
        </div>

        <div class="command-row" style="justify-content: flex-end; margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
          <button class="btn-primary" onclick={closeSettings} style="min-width: 80px;">Save & Close</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Premium Sidebar Layout System */
  .page-shell-wrapper {
    display: flex;
    min-height: 100vh;
    background: var(--bg-primary);
    position: relative;
  }

  .sidebar-left {
    width: 250px;
    background: #080d16;
    border-right: 1px solid rgba(148, 163, 184, 0.08);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
    z-index: 100;
    flex-shrink: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-brand-header {
    height: 70px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  }

  .brand-logo-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-circle {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.3);
  }

  .logo-circle svg {
    width: 18px;
    height: 18px;
  }

  .logo-text {
    font-family: var(--font-sports);
    font-weight: 800;
    font-size: 19px;
    letter-spacing: 1px;
    color: #ffffff;
  }

  .mgr-cyan {
    color: #06b6d4;
  }

  .collapse-arrow-btn {
    border: none;
    background: none;
    padding: 6px;
    color: var(--text-muted);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .collapse-arrow-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary);
  }

  .sidebar-stats {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.06);
    background: rgba(14, 24, 41, 0.2);
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .stat-row .label {
    font-family: var(--font-fantasy);
    color: var(--text-muted);
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .stat-row .val {
    font-family: var(--font-sports);
    font-weight: 700;
    color: var(--text-primary);
    font-size: 14px;
  }

  .stat-row .text-gold {
    color: var(--accent-gold);
  }

  .stat-row .text-emerald {
    color: var(--accent-emerald);
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 14px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sidebar-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    color: var(--text-secondary);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    border: 1px solid transparent;
  }

  .sidebar-nav-item:hover {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-primary);
    transform: translateX(2px);
  }

  .sidebar-nav-item[data-active="true"] {
    background: rgba(6, 182, 212, 0.12);
    border-color: rgba(6, 182, 212, 0.22);
    color: #06b6d4;
    font-weight: 600;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }

  .nav-icon :global(svg) {
    width: 18px;
    height: 18px;
  }

  .nav-label {
    font-family: var(--font-fantasy);
    font-size: 13px;
    letter-spacing: 0.02em;
  }

  .active-indicator-dot {
    position: absolute;
    right: 14px;
    width: 6px;
    height: 6px;
    background-color: #06b6d4;
    border-radius: 50%;
    box-shadow: 0 0 8px #06b6d4;
  }

  .sys-btn-icon {
    font-size: 14px;
  }

  .content-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .mobile-topbar {
    display: none;
    height: 60px;
    padding: 0 16px;
    background: #080d16;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    position: sticky;
    top: 0;
    z-index: 95;
    align-items: center;
    justify-content: space-between;
  }

  .mobile-stats-row {
    display: flex;
    gap: 12px;
    background: rgba(255, 255, 255, 0.02);
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.05);
  }

  .m-stat {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 3px;
    font-family: var(--font-sports);
    font-weight: 700;
  }

  .m-lbl {
    font-family: var(--font-fantasy);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: normal;
  }

  .m-val {
    color: var(--text-primary);
  }

  .m-val.text-gold {
    color: var(--accent-gold);
  }

  .m-val.text-emerald {
    color: var(--accent-emerald);
  }

  .mobile-topbar-actions {
    display: flex;
    gap: 6px;
  }

  .m-action-btn {
    border: 1px solid rgba(148, 163, 184, 0.08);
    background: rgba(255, 255, 255, 0.02);
    padding: 6px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
  }

  .mobile-nav-bar {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: rgba(8, 13, 22, 0.94);
    backdrop-filter: blur(12px);
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    z-index: 99;
    grid-template-columns: repeat(5, 1fr);
    padding: 0 4px;
  }

  .mobile-nav-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 10px;
    transition: all 0.2s;
  }

  .mobile-nav-tab :global(svg) {
    width: 20px;
    height: 20px;
    transition: transform 0.2s;
  }

  .mobile-nav-tab:hover {
    color: var(--text-primary);
  }

  .mobile-nav-tab[data-active="true"] {
    color: #06b6d4;
    font-weight: 600;
  }

  .mobile-nav-tab[data-active="true"] :global(svg) {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 4px rgba(6, 182, 212, 0.4));
  }

  .tab-label {
    font-family: var(--font-fantasy);
  }

  /* Responsive Rules */
  @media (max-width: 1023px) {
    .sidebar-left {
      display: none !important;
    }
    .mobile-topbar {
      display: flex;
    }
    .mobile-nav-bar {
      display: grid;
    }
    .shell-content {
      padding-bottom: 75px !important;
    }
  }

  /* Reset layout css from old layout */
  .page-container {
    padding: 16px;
    max-width: none !important;
    width: 100% !important;
  }

  /* Light Theme Specific Layout Overrides */
  :global([data-theme="light"]) .sidebar-left {
    background: #ffffff;
    border-right: 1px solid rgba(15, 23, 42, 0.08);
  }

  :global([data-theme="light"]) .sidebar-brand-header {
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  :global([data-theme="light"]) .logo-text {
    color: #0f172a;
  }

  :global([data-theme="light"]) .sidebar-stats {
    background: rgba(15, 23, 42, 0.02);
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  :global([data-theme="light"]) .sidebar-nav-item:hover {
    background: rgba(15, 23, 42, 0.03);
  }

  :global([data-theme="light"]) .sidebar-nav-item[data-active="true"] {
    background: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.16);
    color: #0891b2;
  }

  :global([data-theme="light"]) .mobile-topbar {
    background: #ffffff;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  }

  :global([data-theme="light"]) .mobile-stats-row {
    background: rgba(15, 23, 42, 0.02);
    border: 1px solid rgba(15, 23, 42, 0.05);
  }

  :global([data-theme="light"]) .mobile-stats-row .m-val {
    color: #0f172a;
  }

  :global([data-theme="light"]) .m-action-btn {
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: rgba(15, 23, 42, 0.02);
  }

  :global([data-theme="light"]) .mobile-nav-bar {
    background: rgba(255, 255, 255, 0.94);
    border-top: 1px solid rgba(15, 23, 42, 0.08);
  }

  :global([data-theme="light"]) .mobile-nav-tab[data-active="true"] {
    color: #0891b2;
  }

  /* Mobile More Menu Drawer */
  .more-menu-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    z-index: 97;
  }

  .more-menu-drawer {
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    background: rgba(8, 13, 22, 0.96);
    backdrop-filter: blur(20px);
    border-top: 1px solid rgba(148, 163, 184, 0.1);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    padding: 16px;
    z-index: 98;
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
  }

  .more-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    padding-bottom: 8px;
  }

  .more-menu-header h3 {
    font-size: 14px;
    font-family: var(--font-fantasy);
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0;
  }

  .more-menu-close {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
  }

  .more-menu-close:hover {
    color: var(--text-primary);
  }

  .more-menu-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .more-menu-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 6px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.05);
    background: rgba(255, 255, 255, 0.02);
    text-decoration: none;
    color: var(--text-secondary);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .more-menu-item:hover,
  .more-menu-item[data-active="true"] {
    background: rgba(6, 182, 212, 0.12);
    border-color: rgba(6, 182, 212, 0.22);
    color: #06b6d4;
    font-weight: 600;
  }

  .more-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
  }

  .more-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .more-label {
    font-family: var(--font-fantasy);
    font-size: 11px;
    text-align: center;
  }

  /* Light Theme overrides for More Menu */
  :global([data-theme="light"]) .more-menu-drawer {
    background: rgba(255, 255, 255, 0.98);
    border-top: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.15);
  }

  :global([data-theme="light"]) .more-menu-header {
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  :global([data-theme="light"]) .more-menu-header h3 {
    color: #0f172a;
  }

  :global([data-theme="light"]) .more-menu-item {
    border: 1px solid rgba(15, 23, 42, 0.06);
    background: rgba(15, 23, 42, 0.01);
    color: var(--text-secondary);
  }

  :global([data-theme="light"]) .more-menu-item:hover,
  :global([data-theme="light"]) .more-menu-item[data-active="true"] {
    background: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.16);
    color: #0891b2;
  }

  .mobile-nav-tab.more-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    width: 100%;
    padding: 0;
  }
</style>


