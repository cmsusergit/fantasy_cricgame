<script lang="ts">
  import type { innings, BallEvent } from '$lib/models/match';
  
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

  let currentOverBalls = $derived.by(() => {
    const balls = inningsData.ballsFaced;
    if (balls.length === 0) return [];
    
    let currentOverIndex = inningsData.overs;
    
    if (ballsInOver === 0 && balls.length > 0) {
      currentOverIndex = inningsData.overs - 1;
    }
    
    return balls.filter(b => b.over === currentOverIndex);
  });

  function getBallLabel(ball: BallEvent): string {
    if (ball.isWicket) return 'W';
    if (ball.result === 'wide') return `${ball.runs}wd`;
    if (ball.result === 'noball') return `${ball.runs}nb`;
    return ball.runs.toString();
  }

  function getBallClass(ball: BallEvent): string {
    if (ball.isWicket) return 'wicket';
    if (ball.result === 'wide' || ball.result === 'noball') return 'extra';
    if (ball.runs === 4) return 'four';
    if (ball.runs === 6) return 'six';
    if (ball.runs === 0) return 'dot';
    return 'runs';
  }
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

  {#if currentOverBalls.length > 0}
    <div class="over-timeline">
      <span class="over-label">This Over:</span>
      <div class="bubbles">
        {#each currentOverBalls as ball}
          <div class="bubble {getBallClass(ball)}">
            {getBallLabel(ball)}
          </div>
        {/each}
      </div>
    </div>
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

  .over-timeline {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px dashed var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .over-label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .bubbles {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .bubble {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .bubble.dot { background-color: #64748b; }
  .bubble.runs { background-color: #3b82f6; }
  .bubble.four { background-color: #10b981; }
  .bubble.six { background-color: #8b5cf6; }
  .bubble.wicket { background-color: #ef4444; }
  .bubble.extra { background-color: #f59e0b; color: #1e293b; }
</style>