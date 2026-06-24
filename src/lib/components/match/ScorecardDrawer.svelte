<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import type { innings, BallEvent } from '$lib/models/match';
  import type { Player } from '$lib/models/player';

  export let show: boolean;
  export let currentInningsData: innings;
  export let battingTeamPlayers: Player[];
  export let bowlingTeamPlayers: Player[];
  export let battingTeamColorPrimary: string = '#3b82f6';
  export let bowlingTeamColorPrimary: string = '#3b82f6';

  let activeTab: 'batting' | 'bowling' = 'batting';

  const drawerPosition = tweened(100, {
    duration: 300,
    easing: cubicOut
  });

  $: {
    if (show) {
      drawerPosition.set(0);
    } else {
      drawerPosition.set(100);
    }
  }

  interface BatsmanScorecard {
    playerId: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    isOut: boolean;
    outType?: string;
    outBowlerId?: string;
  }

  interface BowlerScorecard {
    playerId: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
    balls: number; // Keep track of balls to convert to overs later
  }

  function calculateScorecardStats(inningsData: innings, allPlayers: Player[]) {
    const batsmanStats: Record<string, BatsmanScorecard> = {};
    const bowlerStats: Record<string, BowlerScorecard> = {};

    // Initialize stats for all players in the batting team
    battingTeamPlayers.forEach(player => {
      batsmanStats[player.id] = {
        playerId: player.id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false,
      };
    });

    // Initialize stats for all players in the bowling team
    bowlingTeamPlayers.forEach(player => {
      bowlerStats[player.id] = {
        playerId: player.id,
        overs: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        economy: 0,
        balls: 0,
      };
    });

    inningsData.ballsFaced.forEach((ball: BallEvent) => {
      // Batsman stats
      if (batsmanStats[ball.batsmanId]) {
        batsmanStats[ball.batsmanId].runs += ball.runs;
        batsmanStats[ball.batsmanId].balls += 1;
        if (ball.result === 'four') batsmanStats[ball.batsmanId].fours += 1;
        if (ball.result === 'six') batsmanStats[ball.batsmanId].sixes += 1;
        if (ball.isWicket) {
          batsmanStats[ball.batsmanId].isOut = true;
          batsmanStats[ball.batsmanId].outType = ball.wicketType;
          batsmanStats[ball.batsmanId].outBowlerId = ball.bowlerId;
        }
        batsmanStats[ball.batsmanId].strikeRate = batsmanStats[ball.batsmanId].balls > 0 
          ? (batsmanStats[ball.batsmanId].runs / batsmanStats[ball.batsmanId].balls) * 100 
          : 0;
      }

      // Bowler stats
      if (bowlerStats[ball.bowlerId]) {
        bowlerStats[ball.bowlerId].runs += ball.runs;
        bowlerStats[ball.bowlerId].balls += 1;
        if (ball.isWicket) {
          bowlerStats[ball.bowlerId].wickets += 1;
        }
        
        // Calculate overs and maidens - this is tricky and usually done by an external utility
        // For simplicity, we'll just store total balls and convert later.
        // A maiden over means 6 consecutive balls from a bowler where 0 runs were scored.
        // This is hard to track per ball without looking at previous balls.
        // For now, let's keep it simple and calculate economy based on runs and balls.
        bowlerStats[ball.bowlerId].economy = bowlerStats[ball.bowlerId].balls > 0
          ? (bowlerStats[ball.bowlerId].runs / (bowlerStats[ball.bowlerId].balls / 6))
          : 0;
      }
    });

    // Convert total balls to overs for bowlers and calculate maidens (simplified)
    Object.values(bowlerStats).forEach(stats => {
      stats.overs = Math.floor(stats.balls / 6) + (stats.balls % 6) / 10; // e.g., 5.3 overs
      // Simplified maiden calculation (needs more advanced logic to be truly accurate)
      // For a real game, you'd track runs per over.
      // For now, let's assume 0 maidens, or implement a basic check per over
      // A proper maiden calculation would need to check each full over for runs.
      // This is left as an exercise for a more complex match engine.
      stats.maidens = 0; // Placeholder
    });

    return {
      batsmanScorecards: Object.values(batsmanStats),
      bowlerScorecards: Object.values(bowlerStats),
    };
  }

  function formatDismissal(stats: BatsmanScorecard, bowlingTeamPlayers: Player[]) {
    if (!stats.isOut) return 'not out';
    const bowler = bowlingTeamPlayers.find(p => p.id === stats.outBowlerId)?.name || 'Unknown';
    switch (stats.outType) {
      case 'bowled': return `b ${bowler}`;
      case 'caught': return `c & b ${bowler}`; // Assuming 'c & b' for caught and bowled for simplicity as fielder not tracked
      case 'lbw': return `lbw b ${bowler}`;
      case 'stumped': return `st b ${bowler}`;
      case 'run out': return `run out`;
      default: return stats.outType;
    }
  }

  $: scorecard = currentInningsData ? calculateScorecardStats(currentInningsData, [...battingTeamPlayers, ...bowlingTeamPlayers]) : { batsmanScorecards: [], bowlerScorecards: [] };
</script>

<div
  class="scorecard-drawer"
  class:show
  style="transform: translateX({$drawerPosition}%); --batting-primary: {battingTeamColorPrimary}; --bowling-primary: {bowlingTeamColorPrimary};"
  role="dialog"
  aria-modal="true"
  aria-labelledby="scorecard-drawer-title"
>
  <div class="drawer-header">
    <h2 id="scorecard-drawer-title" style="color: {battingTeamColorPrimary};">Full Scorecard</h2>
    <button class="close-btn" onclick={() => (show = false)}>×</button>
  </div>

  <div class="tab-controls">
    <button class="tab-btn" class:active={activeTab === 'batting'} onclick={() => (activeTab = 'batting')}
      >Batting</button
    >
    <button class="tab-btn" class:active={activeTab === 'bowling'} onclick={() => (activeTab = 'bowling')}
      >Bowling</button
    >
  </div>

  <div class="drawer-content">
    {#if activeTab === 'batting'}
      <div class="scorecard-table">
        <h3>Batting Scorecard</h3>
        <table>
          <thead>
            <tr>
              <th>Batsman</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
              <th>Dismissal</th>
            </tr>
          </thead>
          <tbody>
            {#each scorecard.batsmanScorecards as stats}
              {@const player = battingTeamPlayers.find(p => p.id === stats.playerId)}
              {#if player}
                <tr>
                  <td class="batsman-name">{player.name}</td>
                  <td>{stats.runs}</td>
                  <td>{stats.balls}</td>
                  <td>{stats.fours}</td>
                  <td>{stats.sixes}</td>
                  <td>{stats.strikeRate.toFixed(1)}</td>
                  <td>
                    {#if stats.isOut}
                      {formatDismissal(stats, bowlingTeamPlayers)}
                    {:else}
                      not out
                    {/if}
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="scorecard-table">
        <h3>Bowling Scorecard</h3>
        <table>
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>M</th>
              <th>R</th>
              <th>W</th>
              <th>ER</th>
            </tr>
          </thead>
          <tbody>
            {#each scorecard.bowlerScorecards as stats}
              {@const player = bowlingTeamPlayers.find(p => p.id === stats.playerId)}
              {#if player && stats.balls > 0}
                <tr>
                  <td class="bowler-name">{player.name}</td>
                  <td>{stats.overs.toFixed(1)}</td>
                  <td>{stats.maidens}</td>
                  <td>{stats.runs}</td>
                  <td>{stats.wickets}</td>
                  <td>{stats.economy.toFixed(2)}</td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .scorecard-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 100%;
    max-width: 600px; /* Adjust as needed */
    height: 100%;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s ease-out;
  }

  .scorecard-drawer.show {
    transform: translateX(0);
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
  }

  .tab-controls {
    display: flex;
    border-bottom: 1px solid var(--border-color);
  }

  .tab-btn {
    flex: 1;
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover {
    color: var(--text-primary);
  }

  .tab-btn.active {
    color: var(--batting-primary, var(--color-accent));
    border-bottom-color: var(--batting-primary, var(--color-accent));
    font-weight: 600;
  }

  .drawer-content {
    flex-grow: 1;
    padding: 16px;
    overflow-y: auto;
  }

  .scorecard-table {
    width: 100%;
  }

  .scorecard-table h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 1.2rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }

  th,
  td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    background: var(--bg-tertiary);
    font-weight: 600;
    color: var(--text-secondary);
  }

  td.batsman-name, td.bowler-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  tbody tr:hover {
    background: var(--bg-tertiary);
  }
</style>