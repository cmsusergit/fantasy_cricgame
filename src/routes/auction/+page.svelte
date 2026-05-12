<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { teamStore, playerStore, gamePhase } from '$lib/stores/gameState';
  import { auctionStore } from '$lib/stores/auctionState';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { Team } from '$lib/models/team';

  let userTeam = $derived($teamStore.find((t: Team) => t.isUserTeam));
  let state = $derived($auctionStore);
  
  let currentBudget = $derived(userTeam?.budget || 0);
  
  let nextBidAmount = $derived.by(() => {
     if (!state.currentPlayer) return 0;
     if (state.currentBid === state.currentPlayer.marketValue && state.currentBidderId === null) {
         return state.currentBid;
     }
     let inc = 500;
     if (state.currentBid >= 50000) inc = 2000;
     else if (state.currentBid >= 10000) inc = 1000;
     return state.currentBid + inc;
  });

  onMount(() => {
    if ($gamePhase !== 'auction') {
      goto('/');
    } else {
      if (!state.isActive) {
         auctionStore.initialize();
         auctionStore.startTimer();
      }
    }
  });

  onDestroy(() => {
    auctionStore.stopTimer();
  });

  function handleBid() {
     if (userTeam) {
        auctionStore.placeBid(userTeam.id, nextBidAmount);
     }
  }

  function skipToTournament() {
      // Emergency escape hatch to end auction and fill rosters automatically
      auctionStore.stopTimer();
      gamePhase.set('tournament');
      goto('/');
  }

  let winnerName = $derived(state.currentBidderId ? $teamStore.find((t: Team) => t.id === state.currentBidderId)?.name : 'Nobody');

  let logListContainer: HTMLDivElement;

  $effect(() => {
    // Scroll to bottom of log when new entries are added
    if (logListContainer) {
      logListContainer.scrollTop = logListContainer.scrollHeight;
    }
  });
</script>

<svelte:head>
  <title>Live Auction - Fantasy Cricket</title>
</svelte:head>

<div class="auction-page">
  <header class="header">
    <h1>Live Mega Auction</h1>
    <div class="purse-display">
       <span>Your Purse:</span>
       <strong class={currentBudget < nextBidAmount ? 'danger' : 'success'}>${currentBudget.toLocaleString()}</strong>
    </div>
  </header>

  {#if state.isActive && state.currentPlayer}
    <div class="auction-layout">
      <!-- Left: Player on Block -->
      <div class="main-stage">
         <div class="stage-header">
             Lot #{state.currentPlayerIndex + 1} - {state.currentPlayer.role.toUpperCase()}
         </div>
         <div class="player-showcase">
             <PlayerCard player={state.currentPlayer} hideAvailability={true} />
         </div>
      </div>

      <!-- Right: Bidding War -->
      <div class="bidding-sidebar">
         <div class="bid-status">
             {#if state.showAiBidFlash && state.lastAiBidderId}
                {@const aiBidderTeam = $teamStore.find(t => t.id === state.lastAiBidderId)}
                <div class="ai-bid-flash">
                   {aiBidderTeam?.name} Bids!
                </div>
             {/if}
             <h2>Current Bid</h2>
             <div class="bid-amount">${state.currentBid.toLocaleString()}</div>
             <div class="bidder">{winnerName}</div>
         </div>
         
         <div class="timer-container">
             <div class="timer-bar" style="width: {(state.timer / 5) * 100}%" class:warning={state.timer <= 2}></div>
             <span class="timer-text">{state.timer}s</span>
         </div>

         <div class="bid-actions">
            <button class="btn-bid" onclick={handleBid} disabled={currentBudget < nextBidAmount || state.currentBidderId === userTeam?.id}>
               Bid ${nextBidAmount.toLocaleString()}
            </button>
            <div style="display: flex; gap: 8px; margin-top: 8px;">
               <button class="btn-pass" onclick={() => auctionStore.fastForwardPlayer()} style="flex: 1; padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 8px; font-weight: bold; cursor: pointer;">Pass (Auto-Bid)</button>
               <button class="btn-end" onclick={() => { auctionStore.autoComplete(); skipToTournament(); }} style="flex: 1; padding: 12px; background: var(--danger); border: none; color: white; border-radius: 8px; font-weight: bold; cursor: pointer;">End Auction</button>
            </div>
            {#if currentBudget < nextBidAmount}
               <p class="error-msg">Insufficient Funds!</p>
            {/if}
            {#if state.currentBidderId === userTeam?.id}
               <p class="info-msg">You have the highest bid.</p>
            {/if}
         </div>

         <div class="auction-log">
             <h3>Activity Log</h3>
             <div class="log-list-wrapper" bind:this={logListContainer}>
               <ul class="log-list">
                   {#each state.auctionLog as log}
                      <li class="log-entry" 
                          class:user-bid={log.type === 'bid' && log.teamId === userTeam?.id}
                          class:ai-bid={log.type === 'bid' && log.teamId !== userTeam?.id}
                          class:sold={log.type === 'sold'}
                          class:unsold={log.type === 'unsold'}
                          class:system={log.type === 'system'}>
                         {log.message}
                      </li>
                   {/each}
               </ul>
             </div>
         </div>
      </div>
    </div>
  {:else if !state.isActive && state.auctionLog.length > 0}
    <div class="auction-complete">
       <h2>Auction Concluded!</h2>
       <button class="btn-bid" onclick={skipToTournament}>Proceed to Tournament</button>
    </div>
  {:else}
    <div class="loading">Loading Auction Engine...</div>
  {/if}
</div>

<style>
  .auction-page { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; background: var(--bg-secondary); padding: 16px 24px; border-radius: 12px; border: 1px solid var(--border-color); }
  .header h1 { color: var(--warning); margin: 0; font-size: 2rem; text-transform: uppercase; letter-spacing: 1px; }
  .purse-display { font-size: 1.25rem; font-weight: 600; display: flex; gap: 12px; align-items: center; }
  .purse-display .success { color: var(--success); font-size: 1.5rem; font-family: monospace; }
  .purse-display .danger { color: var(--danger); font-size: 1.5rem; font-family: monospace; }
  
  .auction-layout { display: flex; gap: 24px; height: 75vh; min-height: 600px; }
  
  .main-stage { flex: 2; background: radial-gradient(circle at center, var(--bg-tertiary), var(--bg-secondary)); border: 2px solid var(--warning); border-radius: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow: hidden; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.15); perspective: 1000px; }
  .stage-header { position: absolute; top: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); padding: 12px; text-align: center; font-weight: 800; letter-spacing: 2px; color: var(--text-muted); border-bottom: 1px solid rgba(245, 158, 11, 0.3); z-index: 10; }
  .player-showcase { 
    transform: scale(1.3); transform-origin: center; z-index: 10; 
    animation: card-appear 0.8s ease-out forwards;
    transform-style: preserve-3d;
    backface-visibility: hidden;
  }
  
  @keyframes card-appear {
    0% { transform: scale(0.8) translateY(50px) rotateX(15deg); opacity: 0; }
    100% { transform: scale(1.3) translateY(0) rotateX(0deg); opacity: 1; }
  }
  
  .bidding-sidebar { flex: 1; display: flex; flex-direction: column; gap: 16px; }
  .bid-status { background: var(--bg-secondary); padding: 32px 24px; border-radius: 12px; text-align: center; border: 1px solid var(--border-color); position: relative; overflow: hidden; }
  .bid-status h2 { font-size: 1rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .bid-amount { font-size: 3rem; font-weight: 900; color: var(--success); font-family: monospace; margin-bottom: 8px; }
  .bidder { font-size: 1.25rem; font-weight: 700; color: var(--info); }
  
  .timer-container { background: var(--bg-tertiary); height: 40px; border-radius: 20px; position: relative; overflow: hidden; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; }
  .timer-bar { position: absolute; top: 0; left: 0; bottom: 0; background: var(--success); transition: width 1s linear, background-color 0.3s; z-index: 1; }
  .timer-bar.warning { background: var(--danger); animation: pulse-red 1s infinite alternate; }
  
  .timer-text { position: relative; z-index: 2; font-weight: 800; font-family: monospace; font-size: 1.2rem; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); color: white; }
  
  .bid-actions { background: var(--bg-secondary); padding: 24px; border-radius: 12px; border: 1px solid var(--border-color); text-align: center; }
  .btn-bid { width: 100%; padding: 20px; font-size: 1.5rem; font-weight: 800; background: var(--info); color: white; border: none; border-radius: 12px; cursor: pointer; transition: transform 0.1s, background 0.2s; text-transform: uppercase; box-shadow: 0 6px 0 #1e40af; margin-bottom: 8px; }
  .btn-bid:active:not(:disabled) { transform: translateY(6px); box-shadow: none; }
  .btn-bid:hover:not(:disabled) { background: #3b82f6; filter: brightness(1.1); }
  .btn-bid:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; box-shadow: none; transform: none; border: 1px solid var(--border-color); }
  
  .error-msg { color: var(--danger); font-weight: 600; font-size: 0.9rem; }
  .info-msg { color: var(--success); font-weight: 600; font-size: 0.9rem; }
  
  .auction-log { flex: 1; background: var(--bg-secondary); border-radius: 12px; border: 1px solid var(--border-color); display: flex; flex-direction: column; overflow: hidden; }
  .auction-log h3 { padding: 12px 16px; margin: 0; background: rgba(0,0,0,0.2); border-bottom: 1px solid var(--border-color); font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted); }
  .log-list-wrapper {
    flex: 1;
    overflow-y: auto;
    max-height: 200px; /* Adjust as needed */
  }
  .log-list { list-style: none; padding: 0; margin: 0; }
  .log-entry { padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem; color: var(--text-secondary); }
  .log-entry.user-bid { color: var(--info); font-weight: 600; }
  .log-entry.ai-bid { color: var(--warning); }
  .log-entry.sold { color: var(--success); font-weight: 700; background: rgba(var(--accent-emerald-rgb), 0.1); }
  .log-entry.unsold { color: var(--danger); font-weight: 700; background: rgba(var(--accent-ruby-rgb), 0.1); }
  .log-entry.system { color: var(--text-muted); font-style: italic; }
  
  .auction-complete { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; background: var(--bg-secondary); border-radius: 16px; border: 2px solid var(--success); }
  @keyframes pulse-red {
    from { background-color: var(--danger); }
    to { background-color: var(--accent-ruby-rgb); }
  }
</style>