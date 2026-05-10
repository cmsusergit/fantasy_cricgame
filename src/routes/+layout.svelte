<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { resetGame, initializeGame, saveCurrentGame, gamePhase } from '$lib/stores/gameState';
  
  let { children } = $props();
  let theme = $state('dark');
  let isResetting = $state(false);
  let newTeamName = $state('Your Team');
  let newManagerName = $state('You');
  let newCoat = $state('🛡️');
  
  const teamAdjectives = ['Mighty', 'Super', 'Royal', 'Flying', 'Golden', 'Fierce', 'Cosmic', 'Thunder', 'Shadow'];
  const teamNouns = ['Lions', 'Eagles', 'Titans', 'Warriors', 'Knights', 'Dragons', 'Strikers', 'Phoenix', 'Panthers'];
  const managerFirstNames = ['John', 'Mike', 'David', 'Chris', 'James', 'Sarah', 'Emma', 'Alex', 'Liam', 'Sophia'];
  const managerLastNames = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Miller', 'Moore'];

  const predefinedCoats = ['🛡️', '🦅', '🦁', '🐺', '⚔️', '👑', '🐉', '⚓', '⚡', '🏹'];

  function randomizeTeam() {
    newTeamName = `${teamAdjectives[Math.floor(Math.random() * teamAdjectives.length)]} ${teamNouns[Math.floor(Math.random() * teamNouns.length)]}`;
  }

  function randomizeManager() {
    newManagerName = `${managerFirstNames[Math.floor(Math.random() * managerFirstNames.length)]} ${managerLastNames[Math.floor(Math.random() * managerLastNames.length)]}`;
  }
  
  onMount(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    theme = saved;
    document.documentElement.setAttribute('data-theme', theme);
    initializeGame();
  });
  
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  function handleReset() {
    isResetting = true;
  }

  function confirmReset() {
    resetGame();
    initializeGame(newTeamName || 'Your Team', newManagerName || 'You', newCoat);
    saveCurrentGame(100000);
    isResetting = false;
    window.location.href = '/';
  }

  function cancelReset() {
    isResetting = false;
  }
</script>

<div class="app">
  <header>
    <nav>
      <a href="/">Dashboard</a>
      <a href="/teams">League Teams</a>
      <a href="/club">Club Management</a>
      <a href="/guide" style="color: var(--accent-gold);">📖 Guide</a>
      
      {#if $gamePhase !== 'match'}
        <a href="/squad">Squad</a>
      {/if}
      
      {#if $gamePhase === 'auction'}
        <a href="/auction" style="color: var(--warning);">Live Auction</a>
      {/if}
      
      {#if $gamePhase === 'scouting'}
        <a href="/scouting" style="color: var(--info);">Scouting</a>
      {/if}
      
      {#if $gamePhase === 'retention'}
        <a href="/retention" style="color: var(--danger);">Retention</a>
      {/if}
      
      {#if $gamePhase === 'season_end'}
        <a href="/season-review" style="color: var(--success);">Season Review</a>
      {/if}

      <a href="/training">Training</a>
      <a href="/tournament">Tournament</a>
    </nav>
    <div style="display: flex; gap: 12px; align-items: center;">
      <button class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors" onclick={handleReset} title="Reset Game Progress">
        Reset Game
      </button>
      <button class="theme-toggle" onclick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  </header>
  
  <main>
    {@render children()}
  </main>
</div>

{#if isResetting}
  <div class="modal-overlay">
    <div class="modal-content">
      <h2>Reset Game</h2>
      <p class="text-slate-400 mb-4">Starting a new game will erase all current progress.</p>
      
      <div class="form-group">
        <label for="teamName">Team Name</label>
        <div style="display: flex; gap: 8px;">
          <input id="teamName" type="text" bind:value={newTeamName} placeholder="E.g., Mumbai Indians" style="flex: 1;" />
          <button class="dice-btn" onclick={randomizeTeam} title="Randomize Team Name">🎲</button>
        </div>
      </div>
      
      <div class="form-group">
        <label for="managerName">Manager Name</label>
        <div style="display: flex; gap: 8px;">
          <input id="managerName" type="text" bind:value={newManagerName} placeholder="E.g., John Doe" style="flex: 1;" />
          <button class="dice-btn" onclick={randomizeManager} title="Randomize Manager Name">🎲</button>
        </div>
      </div>
      
      <div class="form-group">
        <label>Coat of Arms</label>
        <div style="display: flex; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
          {#each predefinedCoats as coat}
            <button 
              class="logo-option" 
              class:selected={newCoat === coat} 
              onclick={() => newCoat = coat}
              style="font-size: 2rem; padding: 0; width: 48px; height: 48px; border: 2px solid {newCoat === coat ? 'var(--success)' : 'var(--border-color)'}; border-radius: 8px; background: var(--bg-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center;"
            >
              {coat}
            </button>
          {/each}
        </div>
        <input id="logoUrl" type="text" bind:value={newCoat} placeholder="Or enter custom emoji/character..." style="font-size: 1.5rem;" />
      </div>
      
      <div class="modal-actions">
        <button class="btn-cancel" onclick={cancelReset}>Cancel</button>
        <button class="btn-confirm" onclick={confirmReset}>Start New Game</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: 'Lora', serif; /* Fallback if global fails */
  }
  
  header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 12px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  nav {
    display: flex;
    gap: 24px;
    max-width: 1200px;
  }
  
  nav a {
    color: var(--text-secondary);
    font-weight: 600;
    transition: color 0.2s ease;
    font-family: 'Cinzel', serif; /* Use fantasy heading font for nav */
    letter-spacing: 0.5px;
  }
  
  nav a:hover {
    color: var(--accent-gold); /* Fantasy hover color */
    text-decoration: none;
  }
  
  .theme-toggle {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    font-size: 18px;
    padding: 6px 12px;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .theme-toggle:hover {
    background: var(--bg-primary);
  }
  
  main {
    flex: 1;
    padding: 24px;
  }
  
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }
  
  .modal-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 32px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  }
  
  .modal-content h2 { margin-bottom: 8px; color: var(--text-primary); font-family: 'Cinzel', serif; }
  .modal-content p { color: var(--text-secondary); margin-bottom: 24px; font-size: 0.95rem; }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .form-group label { font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); }
  .form-group input {
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 1rem;
    font-family: 'Lora', serif;
  }
  
  .dice-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 1.2rem;
    padding: 0 12px;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .dice-btn:hover {
    background: var(--bg-secondary);
  }
  
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
  }
  
  .btn-cancel {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 10px 16px;
    border-radius: 6px;
    font-weight: 600;
    border: 1px solid var(--border-color);
    cursor: pointer;
    font-family: inherit;
  }
  
  .btn-confirm {
    background: var(--success);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  
  @media (max-width: 640px) {
    header {
      flex-direction: column;
      gap: 16px;
      padding: 16px;
    }
    
    nav {
      width: 100%;
      justify-content: center;
      flex-wrap: wrap;
      gap: 12px 16px;
    }
    
    header > div {
      width: 100%;
      justify-content: center;
    }
  }
</style>