<script lang="ts">
  import type { IntentType, BallType, innings, BallEvent } from '$lib/models/match';
  import { getBallClass, getBallLabel } from '$lib/core/matchEngine';
  
  interface Props {
    isPaused: boolean;
    onPause: () => void;
    onPlaySingleBall: () => void;
    onSimulateTarget: (target: { type: 'over' | 'innings' | 'wicket' | 'specific_over', value?: number }) => void;
    speed: 'instant' | 'ball' | 'over';
    autoPlayDelay: number;
    onSpeedChange: (speed: 'instant' | 'ball' | 'over') => void;
    onAutoPlayDelayChange: (delay: number) => void;
    currentInningsData: innings;
    runRate: string | number;
    currentOverBalls: BallEvent[];
    battingIntent: IntentType;
    bowlingIntent: IntentType;
    ballType: BallType;
    currentBowlerType: string;
    avoidSingles: boolean;
    isUserBatting: boolean;
    isUserBowling: boolean;
    onBattingIntentChange: (intent: IntentType) => void;
    onBowlingIntentChange: (intent: IntentType) => void;
    onBallTypeChange?: (ballType: BallType) => void;
    onAvoidSinglesChange: (avoidSingles: boolean) => void;
    currentSuggestion?: string;
  }
  
  export type SimSpeed = 'instant' | 'ball' | 'over';
  
  let { 
    isPaused, 
    onPause,
    onPlaySingleBall,
    onSimulateTarget,
    speed = $bindable(),
    autoPlayDelay,
    onSpeedChange,
    onAutoPlayDelayChange,
    currentInningsData,
    runRate,
    currentOverBalls,
    battingIntent, 
    bowlingIntent, 
    ballType, 
    currentBowlerType, 
    avoidSingles, 
    isUserBatting, 
    isUserBowling, 
    onBattingIntentChange, 
    onBowlingIntentChange, 
    onBallTypeChange, 
    onAvoidSinglesChange,
    currentSuggestion = ""
  }: Props = $props();

  let targetOver = $state(15);
</script>

<div class="match-controls-slim">
  {#if currentSuggestion}
  <div class="ai-suggestion-box">
    <p class="suggestion-text">{currentSuggestion}</p>
  </div>
  {/if}
  
    <div class="middle-this-over">
        <div class="run-rate-mini">
          RR: <span>{runRate}</span>
        </div>
        {#if currentOverBalls.length > 0}
        <div class="separator"></div>
        <div class="bubbles">
          {#each currentOverBalls as ball}
            <div class="bubble {getBallClass(ball)}">
              {getBallLabel(ball)}
            </div>
          {/each}
        </div>
        {/if}
      </div>

    <div class="speed-group">
      <span class="speed-label">Speed:</span>
      <button class="speed-btn {speed === 'ball' ? 'active' : ''}" onclick={() => onSpeedChange('ball')} title="Ball by Ball">Ball</button>
      <button class="speed-btn {speed === 'over' ? 'active' : ''}" onclick={() => onSpeedChange('over')} title="Over by Over">Over</button>
      <button class="speed-btn {speed === 'instant' ? 'active' : ''}" onclick={() => onSpeedChange('instant')} title="Instant">Fast</button>
    </div>
    <div class="speed-group">
      <span class="speed-label">Anim:</span>
      <button class="speed-btn {autoPlayDelay === 2000 ? 'active' : ''}" onclick={() => onAutoPlayDelayChange(2000)}>0.5x</button>
      <button class="speed-btn {autoPlayDelay === 1000 ? 'active' : ''}" onclick={() => onAutoPlayDelayChange(1000)}>1x</button>
      <button class="speed-btn {autoPlayDelay === 500 ? 'active' : ''}" onclick={() => onAutoPlayDelayChange(500)}>2x</button>
      <button class="speed-btn {autoPlayDelay === 250 ? 'active' : ''}" onclick={() => onAutoPlayDelayChange(250)}>4x</button>
    </div>
    
    {#if isPaused}
    <div class="speed-group simulation-group">
        <button class="speed-btn action-btn bg-emerald-600 hover:bg-emerald-500 text-white" onclick={onPlaySingleBall}>Play 1 Ball</button>
        <button class="speed-btn action-btn bg-indigo-600 hover:bg-indigo-500 text-white" onclick={() => onSimulateTarget({ type: 'over' })}>Sim Over</button>
        <button class="speed-btn action-btn bg-orange-600 hover:bg-orange-500 text-white" onclick={() => onSimulateTarget({ type: 'wicket' })}>Sim to Wicket</button>
        <button class="speed-btn action-btn bg-slate-700 hover:bg-slate-600 text-slate-200" onclick={() => onSimulateTarget({ type: 'innings' })}>Sim Innings</button>
    </div>
    <div class="speed-group simulation-group">
        <span class="speed-label" style="width: auto;">Sim to Over:</span>
        <input type="number" bind:value={targetOver} min="1" max="20" class="slim-over-input" />
        <button class="speed-btn action-btn bg-sky-600 hover:bg-sky-500 text-white" style="border-top-left-radius: 0; border-bottom-left-radius: 0;" onclick={() => onSimulateTarget({ type: 'specific_over', value: targetOver })}>Go</button>
    </div>
    {:else}
    <div class="speed-group simulation-group">
        <button class="speed-btn action-btn bg-rose-600 hover:bg-rose-500 text-white w-full" onclick={onPause}>Pause Simulation</button>
    </div>
    {/if}
</div>

<style>
  .match-controls-slim {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-secondary);
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    margin-top: 16px; /* Space from scoreboard */
    margin-bottom: 16px; /* Space from commentary */
  }
  .speed-group {
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: center;
  }
  .simulation-group {
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .speed-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 40px;
    text-align: right;
    margin-right: 4px;
  }
  .speed-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 2px 6px;
    font-size: 0.65rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .speed-btn:hover { background: var(--bg-surface); color: var(--text-primary); }
  .speed-btn.active {
    background: rgba(var(--accent-sapphire-rgb), 0.2);
    border-color: rgba(var(--accent-sapphire-rgb), 0.4);
    color: var(--info);
    font-weight: 600;
  }
  .speed-btn.action-btn { padding: 3px 8px; font-size: 0.7rem; min-width: unset; }
  .slim-over-input {
    width: 45px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    text-align: center;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    outline: none;
    font-weight: bold;
    font-size: 0.7rem;
    padding: 3px;
    margin: 0 4px;
  }
  /* middle-this-over styles */
  .middle-this-over {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 8px 0;
    background: var(--bg-tertiary);
    padding: 4px 12px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    min-height: 28px;
  }
  .middle-this-over .run-rate-mini {
    font-size: 0.75rem;
    font-weight: bold;
    color: var(--text-secondary);
  }
  .middle-this-over .run-rate-mini span {
    color: var(--text-primary);
  }
  .middle-this-over .separator {
    width: 1px;
    height: 16px;
    background: var(--border-color);
  }
  .middle-this-over .bubbles {
    display: flex;
    gap: 4px;
  }
  .middle-this-over .bubble {
    width: 20px;
    height: 20px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    font-size: 0.65rem;
    font-weight: 800;
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(148, 163, 184, 0.14);
  }
  .middle-this-over .bubble.dot {
    opacity: 0.72;
    color: var(--text-muted);
  }
  .middle-this-over .bubble.runs {
    background: rgba(var(--accent-sapphire-rgb), 0.14);
    color: var(--info);
  }
  .middle-this-over .bubble.four {
    background: rgba(var(--accent-gold-rgb), 0.14);
    color: var(--warning);
  }
  .middle-this-over .bubble.six {
    background: rgba(var(--accent-emerald-rgb), 0.14);
    color: var(--success);
  }
  .middle-this-over .bubble.wicket {
    background: rgba(var(--accent-ruby-rgb), 0.14);
    color: var(--danger);
  }
  .middle-this-over .bubble.extra {
    background: rgba(var(--accent-amethyst-rgb), 0.14);
    color: var(--accent-goblin);
  }

  .ai-suggestion-box {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 8px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
    text-align: center;
  }

  .suggestion-text {
    margin: 0;
    color: var(--text-primary);
  }
</style>