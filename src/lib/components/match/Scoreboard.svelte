<script lang="ts">
  import type { innings } from '$lib/models/match';
  
  interface Props {
    inningsData: innings;
    battingTeamName: string;
    target?: number;
  }
  
  let { inningsData, battingTeamName, target = undefined }: Props = $props();
  
  let totalOvers = $derived(Math.floor(inningsData.balls / 6));
  let ballsInOver = $derived(inningsData.balls % 6);
  let runRate = $derived(inningsData.balls > 0 ? ((inningsData.totalRuns / inningsData.balls) * 6).toFixed(2) : '0.00');
  let reqRate = $derived(target !== undefined && inningsData.balls < 120 ? (((target - inningsData.totalRuns) / (120 - inningsData.balls)) * 6).toFixed(2) : null);
</script>

<div class="scoreboard">
  <div class="team-name">{battingTeamName}</div>
  
  <div class="score-main">
    <span class="runs">{inningsData.totalRuns}</span>
    <span class="separator">/</span>
    <span class="wickets">{inningsData.wickets}</span>
    <span class="overs">({totalOvers}.{ballsInOver})</span>
  </div>
  
  <div class="stats-row">
    <div class="stat">
      <span class="label">Run Rate</span>
      <span class="value">{runRate}</span>
    </div>
    {#if target}
      <div class="stat target">
        <span class="label">Target</span>
        <span class="value">{target}</span>
      </div>
    {/if}
    {#if reqRate}
      <div class="stat required">
        <span class="label">Req Rate</span>
        <span class="value">{reqRate}</span>
      </div>
    {/if}
  </div>
  
  {#if inningsData.extras > 0}
    <div class="extras">Extras: {inningsData.extras}</div>
  {/if}
</div>

<style>
  .scoreboard {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .team-name {
    font-size: 14px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .score-main {
    font-size: 36px;
    font-weight: 700;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
  }

  .runs {
    color: var(--text-primary);
  }

  .separator {
    color: var(--text-secondary);
  }

  .wickets {
    color: var(--danger);
  }

  .overs {
    font-size: 18px;
    color: var(--text-secondary);
    margin-left: 8px;
  }

  .stats-row {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat .label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .stat .value {
    font-size: 18px;
    font-weight: 600;
  }

  .stat.required .value {
    color: var(--accent-nightelf);
  }

  .stat.target .value {
    color: var(--warning);
  }

  .extras {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 8px;
  }
</style>