<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { resetGame, initializeGame, saveCurrentGame } from '$lib/stores/gameState';
  
  let { children } = $props();
  let theme = $state('dark');
  let isResetting = $state(false);
  let newTeamName = $state('Your Team');
  let newManagerName = $state('You');
  let newLogoUrl = $state('');
  
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
    initializeGame(newTeamName || 'Your Team', newManagerName || 'You', newLogoUrl);
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
      <a href="/squad">Squad</a>
      <a href="/draft">Draft</a>
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
        <input id="teamName" type="text" bind:value={newTeamName} placeholder="E.g., Mumbai Indians" />
      </div>
      
      <div class="form-group">
        <label for="managerName">Manager Name</label>
        <input id="managerName" type="text" bind:value={newManagerName} placeholder="E.g., John Doe" />
      </div>
      
      <div class="form-group">
        <label for="logoUrl">Team Logo URL (Optional)</label>
        <input id="logoUrl" type="text" bind:value={newLogoUrl} placeholder="https://example.com/logo.png" />
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
  }
  
  nav a:hover {
    color: var(--text-primary);
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
  
  .modal-content h2 { margin-bottom: 8px; color: var(--text-primary); }
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
  }
  
  .btn-confirm {
    background: var(--success);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 600;
    border: none;
    cursor: pointer;
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