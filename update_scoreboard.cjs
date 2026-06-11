const fs = require('fs');

const sbPath = 'src/lib/components/match/Scoreboard.svelte';
let sb = fs.readFileSync(sbPath, 'utf8');

sb = sb.replace(
  'interface Props {',
  `import type { BallType } from '$lib/models/match';

  interface Props {
    ballType?: BallType;
    currentBowlerType?: string;
    avoidSingles?: boolean;
    onBallTypeChange?: (ballType: BallType) => void;
    onAvoidSinglesChange?: (avoidSingles: boolean) => void;`
);

sb = sb.replace(
  'let { inningsData',
  `let { inningsData, battingTeamName, target = undefined, battingIntent = \'balanced\', bowlingIntent = \'balanced\', isUserBatting = false, isUserBowling = false, onBattingIntentChange, onBowlingIntentChange, ballType = \'normal\', currentBowlerType = \'none\', avoidSingles = false, onBallTypeChange, onAvoidSinglesChange }: Props = $props();`
);

const oldIntents = `    <div class="intent-column">
      <span class="intent-title">Batting Intent</span>
      <div class="intent-segments">
        {#each intentValues as intent, i}
          <button class="segment {battingIntent === intent ? 'active-bat' : ''}" disabled={!isUserBatting} onclick={() => onBattingIntentChange?.(intent)} title={!isUserBatting ? 'AI controlled' : ''}>
            {intentLabels[i]}
          </button>
        {/each}
      </div>
    </div>

    <div class="score-main-wrap">
      <div class="score-main">
        <span class="runs">{inningsData.totalRuns}</span>
        <span class="separator">/</span>
        <span class="wickets">{inningsData.wickets}</span>
      </div>
      <div class="overs">({totalOvers}.{ballsInOver} Overs)</div>
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
    </div>`;

const newIntents = `    <div class="intent-column">
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
      <div class="overs">({totalOvers}.{ballsInOver} Overs)</div>
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
        <select class="tactic-mini-select" value={ballType} onchange={(e) => onBallTypeChange?.(e.currentTarget.value)}>
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
    </div>`;

sb = sb.replace(oldIntents, newIntents);

// And we need to add the CSS for .tactic-mini and .tactic-mini-select
sb = sb + `
<style>
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
</style>
`;

// But wait, there's already a <style> block. Better to insert before </style>
sb = sb.replace('</style>', `
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
</style>`);

fs.writeFileSync(sbPath, sb);
