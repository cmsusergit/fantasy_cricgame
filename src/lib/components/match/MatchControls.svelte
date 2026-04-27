<script lang="ts">
  import type { IntentType } from '$lib/models/match';
  
  export type SimSpeed = 'ball' | 'over' | 'instant';
  
  interface Props {
    speed: SimSpeed;
    isPaused: boolean;
    battingIntent: IntentType;
    bowlingIntent: IntentType;
    avoidSingles: boolean;
    onSpeedChange: (speed: SimSpeed) => void;
    onPauseToggle: () => void;
    onBattingIntentChange: (intent: IntentType) => void;
    onBowlingIntentChange: (intent: IntentType) => void;
    onAvoidSinglesChange: (avoidSingles: boolean) => void;
    onPlaySingleBall: () => void;
    onPlaySingleOver: () => void;
  }
  
  let { 
    speed = $bindable('ball'), 
    isPaused = false,
    battingIntent = 'balanced',
    bowlingIntent = 'balanced',
    avoidSingles = false,
    onSpeedChange, 
    onPauseToggle,
    onBattingIntentChange,
    onBowlingIntentChange,
    onAvoidSinglesChange,
    onPlaySingleBall,
    onPlaySingleOver
  }: Props = $props();
</script>

<div class="match-controls">
  {#if isPaused}
    <div class="flex gap-2">
      <button class="primary bg-emerald-600 hover:bg-emerald-500 text-white" onclick={onPlaySingleBall}>
        🏏 Play 1 Ball
      </button>
      <button class="primary bg-indigo-600 hover:bg-indigo-500 text-white" onclick={onPlaySingleOver}>
        ⚪ Play 1 Over
      </button>
      <button class="secondary bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600" onclick={onPauseToggle}>
        ▶ Auto Play
      </button>
    </div>
  {:else}
    <button class="danger bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors" onclick={onPauseToggle}>
      ⏸ Stop Auto Play
    </button>
  {/if}
  
  <div class="speed-buttons ml-4">
    <button 
      class:active={speed === 'ball'} 
      class="secondary"
      onclick={() => onSpeedChange('ball')}
      title="Ball by Ball"
    >
      🔵 Ball
    </button>
    <button 
      class:active={speed === 'over'} 
      class="secondary"
      onclick={() => onSpeedChange('over')}
      title="Over by Over"
    >
      ⚪ Over
    </button>
    <button 
      class:active={speed === 'instant'} 
      class="secondary"
      onclick={() => onSpeedChange('instant')}
      title="Instant"
    >
      ⚡ Fast
    </button>
  </div>
  
  <div class="intent-controls">
    <div class="intent-group">
      <label>🏏 Bat:</label>
      <select value={battingIntent} onchange={(e) => onBattingIntentChange(e.currentTarget.value as IntentType)}>
        <option value="defensive">🛡️ Def</option>
        <option value="balanced">⚖️ Bal</option>
        <option value="aggressive">🔥 Agg</option>
      </select>
    </div>
    
    <div class="intent-group" style="margin-left: 8px;">
      <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
        <input type="checkbox" checked={avoidSingles} onchange={(e) => onAvoidSinglesChange(e.currentTarget.checked)} />
        Avoid Singles
      </label>
    </div>
    
    <div class="intent-group">
      <label>🎯 Bowl:</label>
      <select value={bowlingIntent} onchange={(e) => onBowlingIntentChange(e.currentTarget.value as IntentType)}>
        <option value="defensive">🛡️ Def</option>
        <option value="balanced">⚖️ Bal</option>
        <option value="aggressive">🔥 Agg</option>
      </select>
    </div>
  </div>
</div>

<style>
  .match-controls {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    padding: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }
  
  .speed-buttons {
    display: flex;
    gap: 4px;
  }
  
  .speed-buttons button {
    padding: 6px 10px;
    font-size: 12px;
    min-width: 55px;
  }
  
  .speed-buttons button.active {
    background: var(--success);
    color: white;
  }
  
  .intent-controls {
    display: flex;
    gap: 12px;
    margin-left: auto;
  }
  
  .intent-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .intent-group label {
    font-size: 11px;
    color: var(--text-secondary);
  }
  
  .intent-group select {
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
  }
  
  .intent-group select:focus {
    outline: none;
    border-color: var(--success);
  }
</style>