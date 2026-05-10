<script lang="ts">
  import type { IntentType, BallType } from '$lib/models/match';
  import type { BowlingType } from '$lib/models/player';
  
  export type SimSpeed = 'ball' | 'over' | 'instant';
  
  interface Props {
    speed: SimSpeed;
    isPaused: boolean;
    battingIntent: IntentType;
    bowlingIntent: IntentType;
    ballType?: BallType;
    currentBowlerType?: BowlingType;
    avoidSingles: boolean;
    isUserBatting: boolean;
    isUserBowling: boolean;
    autoPlayDelay: number;
    onSpeedChange: (speed: SimSpeed) => void;
    onPauseToggle: () => void;
    onBattingIntentChange: (intent: IntentType) => void;
    onBowlingIntentChange: (intent: IntentType) => void;
    onBallTypeChange?: (ballType: BallType) => void;
    onAvoidSinglesChange: (avoidSingles: boolean) => void;
    onPlaySingleBall: () => void;
    onPlaySingleOver: () => void;
    onAutoPlayDelayChange: (delay: number) => void;
  }
  
  let { 
    speed = $bindable('ball'), 
    isPaused = false,
    battingIntent = 'balanced',
    bowlingIntent = 'balanced',
    ballType = 'normal',
    currentBowlerType = 'none',
    avoidSingles = false,
    isUserBatting = true,
    isUserBowling = true,
    autoPlayDelay = 1000,
    onSpeedChange, 
    onPauseToggle,
    onBattingIntentChange,
    onBowlingIntentChange,
    onBallTypeChange,
    onAvoidSinglesChange,
    onPlaySingleBall,
    onPlaySingleOver,
    onAutoPlayDelayChange
  }: Props = $props();

  const intentValues: IntentType[] = ['very_defensive', 'defensive', 'balanced', 'aggressive', 'very_aggressive'];
  const intentLabels = ['Very Def', 'Def', 'Bal', 'Agg', 'Very Agg'];

  function handleBattingSlider(e: Event) {
      const val = parseInt((e.currentTarget as HTMLInputElement).value);
      onBattingIntentChange(intentValues[val]);
  }

  function handleBowlingSlider(e: Event) {
      const val = parseInt((e.currentTarget as HTMLInputElement).value);
      onBowlingIntentChange(intentValues[val]);
  }
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

  <div class="speed-slider-container">
    <label for="speed-slider" title="Auto Play Delay">⏱️</label>
    <input 
      id="speed-slider"
      type="range" 
      min="100" 
      max="3000" 
      step="100" 
      value={autoPlayDelay} 
      oninput={(e) => onAutoPlayDelayChange(parseInt(e.currentTarget.value))}
      title="Speed Delay ({autoPlayDelay}ms)"
    />
  </div>
  
  <div class="intent-controls" style="flex-direction: column; align-items: stretch; gap: 16px; width: 100%;">
    <div class="intent-group slider-group">
      <label style="width: 80px;">🏏 Bat:</label>
      <div class="slider-wrapper" style="flex: 1;">
          <input type="range" min="0" max="4" value={intentValues.indexOf(battingIntent)} disabled={!isUserBatting} oninput={handleBattingSlider} title={!isUserBatting ? "AI controlled" : ""} style="width: 100%;" />
          <div class="slider-labels" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
              {#each intentLabels as label}
                  <span>{label}</span>
              {/each}
          </div>
          <div class="intent-info" style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-top: 4px; font-style: italic;">
             {battingIntent === 'very_defensive' ? 'Minimum Risk, Heavy Wicket Protection. Elves excel here.' : battingIntent === 'defensive' ? 'Low Risk. Goblins excel here (Steal Singles).' : battingIntent === 'balanced' ? 'Standard Play. Humans excel here (Stability).' : battingIntent === 'aggressive' ? 'High Risk. Orcs & Night Elves excel here.' : 'Maximum Risk. Dwarves excel late game (No Fatigue).'}
          </div>
      </div>
      <div style="margin-left: 16px;">
        <label style="cursor: {isUserBatting ? 'pointer' : 'default'}; display: flex; align-items: center; gap: 4px;" title={!isUserBatting ? "AI controlled" : ""}>
          <input type="checkbox" checked={avoidSingles} disabled={!isUserBatting} onchange={(e) => onAvoidSinglesChange(e.currentTarget.checked)} />
          Avoid Singles
        </label>
      </div>
    </div>
    
    <div class="intent-group slider-group">
      <label style="width: 80px;">🎯 Bowl:</label>
      <div class="slider-wrapper" style="flex: 1;">
          <input type="range" min="0" max="4" value={intentValues.indexOf(bowlingIntent)} disabled={!isUserBowling} oninput={handleBowlingSlider} title={!isUserBowling ? "AI controlled" : ""} style="width: 100%;" />
          <div class="slider-labels" style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
              {#each intentLabels as label}
                  <span>{label}</span>
              {/each}
          </div>
          <div class="intent-info" style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-top: 4px; font-style: italic;">
             {bowlingIntent === 'very_defensive' ? 'Prevent Boundaries. Night Elves excel late game.' : bowlingIntent === 'defensive' ? 'Restrict Scoring. Humans excel early game.' : bowlingIntent === 'balanced' ? 'Standard Line & Length.' : bowlingIntent === 'aggressive' ? 'Attacking Field. Orcs & Goblins (Spin) excel here.' : 'All-out Attack. Dwarves excel here (Stamina).'}
          </div>
      </div>
      {#if currentBowlerType !== 'none'}
      <div style="margin-left: 16px;">
          <select value={ballType} disabled={!isUserBowling} onchange={(e) => onBallTypeChange?.(e.currentTarget.value as BallType)} title={!isUserBowling ? "AI controlled" : ""}>
              <option value="normal">Normal</option>
              {#if currentBowlerType === 'fast' || currentBowlerType === 'pacer'}
                  <option value="bouncer">Bouncer</option>
                  <option value="yorker">Yorker</option>
                  <option value="slower">Slower</option>
              {/if}
              {#if currentBowlerType === 'swinger'}
                  <option value="inswinger">Inswinger</option>
                  <option value="outswinger">Outswinger</option>
                  <option value="yorker">Yorker</option>
              {/if}
              {#if currentBowlerType === 'spinner'}
                  <option value="off_spin">Off Spin</option>
                  <option value="leg_spin">Leg Spin</option>
                  <option value="googly">Googly</option>
                  <option value="doosra">Doosra</option>
                  <option value="arm_ball">Arm Ball</option>
              {/if}
          </select>
      </div>
      {/if}
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

  .speed-slider-container {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
  }

  .speed-slider-container input[type=range] {
    width: 80px;
    accent-color: var(--success);
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
  
  .intent-group select, .intent-group input[type="checkbox"] {
    cursor: pointer;
  }
  
  .intent-group select {
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 12px;
  }
  
  .intent-group select:focus {
    outline: none;
    border-color: var(--success);
  }

  .intent-group select:disabled, .intent-group input[type="checkbox"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>