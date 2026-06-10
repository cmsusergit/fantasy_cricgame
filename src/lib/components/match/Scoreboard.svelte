<script lang="ts">
  import type { innings, BallEvent, IntentType } from '$lib/models/match';
  import { calculateCurrentRunRate, getOverBalls, calculateRequiredRunRate } from '$lib/core/matchEngine';
  import type { BallType } from '$lib/models/match';

  const weatherEmojis: Record<string, string> = { sunny: '☀️', cloudy: '⛅', rain: '🌧️', storm: '⛈️' };
  const pitchEmojis: Record<string, string> = { flat: '🎯', balanced: '⚖️', turning: '🔄', seaming: '🌊', bouncing: '🏐' };

  interface Props {
    ballType?: BallType;
    currentBowlerType?: string;
    avoidSingles?: boolean;
    onBallTypeChange?: (ballType: BallType) => void;
    onAvoidSinglesChange?: (avoidSingles: boolean) => void;
    inningsData: innings;
    battingTeamName: string;
    target?: number;
    battingIntent?: IntentType;
    bowlingIntent?: IntentType;
    isUserBatting?: boolean;
    isUserBowling?: boolean;
    onBattingIntentChange?: (intent: IntentType) => void;
    onBowlingIntentChange?: (intent: IntentType) => void;
    weather: string;
    pitch: string;
  }
  
  let { inningsData, battingTeamName, target = undefined, battingIntent = 'balanced', bowlingIntent = 'balanced', isUserBatting = false, isUserBowling = false, onBattingIntentChange, onBowlingIntentChange, ballType = 'normal', currentBowlerType = 'none', avoidSingles = false, onBallTypeChange, onAvoidSinglesChange, weather, pitch }: Props = $props();

  const intentValues: IntentType[] = ['very_aggressive', 'aggressive', 'balanced', 'defensive', 'very_defensive'];
  const intentLabels = ['V.Agg', 'Agg', 'Bal', 'Def', 'V.Def'];
</script>

<div class="scoreboard">
  <div class="score-and-intents">
    <div class="conditions-mini">
        <span title="Weather">{weatherEmojis[weather]} {weather}</span>
        <span class="separator">|</span>
        <span title="Pitch">{pitchEmojis[pitch]} {pitch}</span>
    </div>
    <div class="team-name-big">{battingTeamName}</div>
    <div class="intent-column">
      <span class="intent-title">Batting Intent</span>
      <div class="intent-segments">
        {#each intentValues as intent, i}
          <button class="segment {battingIntent === intent ? 'active-bat' : ''}" disabled={!isUserBatting} onclick={() => onBattingIntentChange?.(intent)} title={!isUserBatting ? 'AI controlled' : ''}>
            {intentLabels[i]}
          </button>
        {/each}
      </div>
      {#if isUserBatting}
        <label class="tactic-mini">
          <input type="checkbox" checked={avoidSingles} onchange={(e) => onAvoidSinglesChange?.(e.currentTarget.checked)} />
          <span style="font-size: 0.55rem; color: var(--text-secondary);">No Singles</span>
        </label>
      {/if}
    </div>

    <div class="score-main-wrap">
      <div class="score-main">
        <span class="runs">{inningsData.totalRuns}</span>
        <span class="separator">/</span>
        <span class="wickets">{inningsData.wickets}</span>
      </div>
      <div class="overs">({inningsData.overs}.{inningsData.balls % 6} Overs)</div>
    </div>

    <div class="intent-column">
      <span class="intent-title">Bowling Intent</span>
      <div class="intent-segments">
        {#each intentValues as intent, i}
          <button class="segment {bowlingIntent === intent ? 'active-bowl' : ''}" disabled={!isUserBowling} onclick={() => onBowlingIntentChange?.(intent)} title={!isUserBowling ? 'AI controlled' : ''}>
            {intentLabels[i]}
          </button>
        {/each}
      </div>
      {#if isUserBowling && currentBowlerType !== 'none'}
        <select class="tactic-mini-select" value={ballType} onchange={(e) => onBallTypeChange?.(e.currentTarget.value as BallType)}>
            <option value="normal">Normal</option>
            {#if currentBowlerType === 'fast' || currentBowlerType === 'pacer'}
                <option value="bouncer">Bouncer</option>
                <option value="yorker">Yorker</option>
                <option value="slower">Slower</option>
            {/if}
            {#if currentBowlerType === 'swinger'}
                <option value="inswinger">Inswing</option>
                <option value="outswinger">Outswing</option>
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
      {/if}
    </div>
  </div>
  
  {#if target}
  <div class="stats-row">
    <div class="stat target">
      <span class="label">Target</span>
      <span class="value">{target}</span>
    </div>
  </div>
  {/if}
  
  {#if inningsData.extras > 0}
    <div class="extras">Extras: {inningsData.extras}</div>
  {/if}
</div>

<style>
  .scoreboard {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 0;
    border-radius: 12px;
    background: transparent;
  }

  .conditions-mini {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: 8px;
    padding: 4px 8px;
    grid-column: 1 / -1; /* Span across all columns */
    margin-bottom: 8px;
  }
  .conditions-mini .separator {
    color: var(--text-muted);
    opacity: 0.5;
  }

  .team-name-big {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    text-align: center;
    margin-bottom: 8px; /* Added spacing */
    grid-column: 1 / -1; /* Span across all columns */
  }

  .score-and-intents {
    display: grid; /* Changed to grid */
    grid-template-columns: 70px 1fr 70px; /* Layout for intents and score */
    gap: 16px; /* Spacing between columns */
    align-items: center;
    background: var(--bg-surface); /* Added background */
    border: 1px solid var(--border-color); /* Added border */
    border-radius: 12px;
    padding: 12px;
  }

  .intent-column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%; /* Make it fill the grid column */
  }

  .intent-title {
    font-size: 0.6rem;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: center;
    font-weight: bold;
    letter-spacing: 0.05em;
  }

  .intent-segments {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .segment {
    background: transparent;
    border: none;
    padding: 6px 2px;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .segment:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .segment:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .segment.active-bat {
    background: var(--success);
    color: #fff;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    animation: pulse-bat 1.5s infinite;
  }
  
  .segment.active-bat:disabled {
    background: rgba(16, 185, 129, 0.6);
  }

  .segment.active-bowl {
    background: var(--info);
    color: #fff;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
    animation: pulse-bowl 1.5s infinite;
  }
  
    .segment.active-bowl:disabled {
      background: rgba(59, 130, 246, 0.6);
    }
  
    .score-main-wrap {    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .score-main {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    justify-content: center;
  }

  .runs {
    font-size: clamp(3rem, 6vw, 4.5rem);
    font-weight: 800;
    line-height: 1;
    color: var(--text-primary);
  }

  .separator,
  .wickets {
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    font-weight: 700;
  }

  .separator {
    color: var(--text-secondary);
  }

  .wickets {
    color: var(--danger);
  }

  .overs {
    font-size: 1rem;
    color: var(--text-muted);
    font-family: "Space Grotesk", sans-serif;
    margin-top: 4px;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
    gap: 0.6rem;
  }

  .stat {
    display: grid;
    gap: 0.2rem;
    align-items: center;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.12);
    text-align: center;
  }

  .stat .label {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .stat .value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat.target .value {
    color: var(--warning);
  }

  .extras {
    font-size: 0.85rem;
    color: var(--text-secondary);
    padding: 0.65rem 0.8rem;
    border-radius: 10px;
    background: rgba(var(--accent-sapphire-rgb), 0.08);
    border: 1px solid rgba(var(--accent-sapphire-rgb), 0.14);
  }

  .tactic-mini {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    margin-top: 4px;
    cursor: pointer;
  }
  .tactic-mini input { width: 10px; height: 10px; margin:0; }
  .tactic-mini-select {
    margin-top: 4px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text-primary);
    font-size: 0.55rem;
    padding: 2px;
    border-radius: 4px;
    width: 100%;
    outline: none;
  }

  @keyframes pulse-bat {
    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }

  @keyframes pulse-bowl {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
</style>