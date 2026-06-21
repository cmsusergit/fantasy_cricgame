<script lang="ts">
  
  
  import type { innings, BallEvent } from '$lib/models/match';
  import type { Player } from '$lib/models/player';

  
    export let innings1: innings;
  export let innings2: innings | null = null;
  export let team1: any;
  export let team2: any;
  export let currentInnings: number;

  let activeInnings: 1 | 2 = 1;

  // React to currentInnings changing
  $: {
     activeInnings = currentInnings as 1 | 2;
  }

  $: displayInnings = activeInnings === 1 ? innings1 : innings2;
  $: displayBattingTeam = activeInnings === 1 ? (innings1.teamId === team1.id ? team1 : team2) : (innings2?.teamId === team1.id ? team1 : team2);
  $: displayBowlingTeam = activeInnings === 1 ? (innings1.teamId === team1.id ? team2 : team1) : (innings2?.teamId === team1.id ? team2 : team1);

  $: battingTeamColorPrimary = displayBattingTeam?.colorPrimary || '#3b82f6';
  $: bowlingTeamColorPrimary = displayBowlingTeam?.colorPrimary || '#fbbf24';


  let activeTab: 'batting' | 'bowling' = 'batting';



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
    outFielderId?: string;
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

    const batsmanOrder: string[] = [];

    // Initialize batsman stats in batting order from innings battingOrder
    if (inningsData.battingOrder) {
      inningsData.battingOrder.forEach((pid: string) => {
        batsmanOrder.push(pid);
        batsmanStats[pid] = {
          playerId: pid, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false,
        };
      });
    }
    // Append any remaining squad players not in batting order
    displayBattingTeam?.players.forEach((player: Player) => {
      if (!batsmanStats[player.id]) {
        batsmanOrder.push(player.id);
        batsmanStats[player.id] = {
          playerId: player.id, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false,
        };
      }
    });

    // Initialize stats for all players in the bowling team
    displayBowlingTeam?.players.forEach((player: Player) => {
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
          batsmanStats[ball.batsmanId].outFielderId = ball.fielderId;
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
      stats.overs = Math.floor(stats.balls / 6) + (stats.balls % 6) / 10;
      stats.maidens = 0;
    });

    // Compute first-appearance order for bowlers from ballsFaced
    const bowlerFirstAppearance: Record<string, number> = {};
    inningsData.ballsFaced.forEach((ball: BallEvent, index: number) => {
      if (bowlerFirstAppearance[ball.bowlerId] === undefined) {
        bowlerFirstAppearance[ball.bowlerId] = index;
      }
    });

    // Sort bowlers by first appearance in the innings
    const sortedBowlers = Object.values(bowlerStats)
      .sort((a, b) => (bowlerFirstAppearance[a.playerId] ?? Infinity) - (bowlerFirstAppearance[b.playerId] ?? Infinity));

    return {
      batsmanScorecards: batsmanOrder.map(id => batsmanStats[id]),
      bowlerScorecards: sortedBowlers,
    };
  }

  function formatDismissal(stats: BatsmanScorecard, displayBowlingTeamPlayers: Player[]) {
    if (!stats.isOut) return 'not out';
    const bowler = displayBowlingTeamPlayers.find(p => p.id === stats.outBowlerId)?.name || 'Unknown';
    const fielder = displayBowlingTeamPlayers.find(p => p.id === stats.outFielderId)?.name || 'Unknown';
    
    switch (stats.outType) {
      case 'bowled': return `b ${bowler}`;
      case 'caught': 
        if (stats.outFielderId && stats.outFielderId !== stats.outBowlerId) {
            return `c ${fielder} b ${bowler}`;
        }
        return `c & b ${bowler}`;
      case 'lbw': return `lbw b ${bowler}`;
      case 'stumped': return `st ${stats.outFielderId ? fielder : 'WK'} b ${bowler}`;
      case 'run out': return `run out (${stats.outFielderId ? fielder : 'Unknown'})`;
      default: return stats.outType;
    }
  }

  $: scorecard = displayInnings ? calculateScorecardStats(displayInnings, [...(displayBattingTeam?.players || []), ...(displayBowlingTeam?.players || [])]) : { batsmanScorecards: [], bowlerScorecards: [] };
</script>

<div class="full-scorecard" style="--batting-primary: {battingTeamColorPrimary}; --bowling-primary: {bowlingTeamColorPrimary};">
    <div class="drawer-header">
    <h2 id="full-scorecard-title" style="color: {battingTeamColorPrimary};">Full Scorecard</h2>
  </div>

  {#if innings2 && innings2.ballsFaced && innings2.ballsFaced.length > 0 || currentInnings === 2}
    <div class="innings-tabs">
      <button class="innings-tab-btn" class:active={activeInnings === 1} onclick={() => activeInnings = 1}>
        1st Innings ({innings1.teamId === team1.id ? team1.name : team2.name})
      </button>
      <button class="innings-tab-btn" class:active={activeInnings === 2} onclick={() => activeInnings = 2}>
        2nd Innings ({innings2?.teamId === team1.id ? team1.name : team2.name})
      </button>
    </div>
  {/if}

  <div class="drawer-content">
    <div class="scorecard-grid">
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
              {@const player = displayBattingTeam?.players.find((p: Player) => p.id === stats.playerId)}
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
                      {formatDismissal(stats, displayBowlingTeam?.players || [])}
                    {:else if stats.balls === 0}
                      did not bat
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
              {@const player = displayBowlingTeam?.players.find((p: Player) => p.id === stats.playerId)}
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
    </div>
  </div>
</div>

<style>
  .scorecard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 16px;
  }

  @media (max-width: 900px) {
    .scorecard-grid {
      grid-template-columns: 1fr;
    }
  }

  .full-scorecard {
    width: 100%;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    margin-top: 24px;
    overflow: hidden;
  }

  .drawer-header {
    background: rgba(0,0,0,0.1);
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

  .innings-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    background: rgba(0,0,0,0.05);
  }
  .innings-tab-btn {
    flex: 1;
    padding: 14px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-muted);
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
  }
  .innings-tab-btn:hover {
    color: var(--text-primary);
  }
  .innings-tab-btn.active {
    color: var(--batting-primary);
    border-bottom-color: var(--batting-primary);
  }
</style>