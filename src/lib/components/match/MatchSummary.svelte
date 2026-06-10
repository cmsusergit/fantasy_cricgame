<script lang="ts">
  import type { Team } from '$lib/models/team';
  import type { innings, BallEvent } from '$lib/models/match';
  import BallFeed from './BallFeed.svelte';

  export let inningsList: innings[];
  export let teams: Team[];
  export let matchComplete: boolean = false;
  export let matchResult: any = null;

  $: userTeam = teams.find(t => t.isUserTeam) || null;
  $: userTeamId = userTeam?.id || null;
  $: fanUpdateLabels = userTeamId && inningsList[0]
    ? (inningsList[0].teamId === userTeamId
      ? { first: 'Your club', second: 'Opponent club' }
      : { first: 'Opponent club', second: 'Your club' })
    : { first: 'Team 1', second: 'Team 2' };

  let expandedDetails = -1;

  function toggleDetails(inningsIndex: number) {
      if (expandedDetails === inningsIndex) {
          expandedDetails = -1;
      } else {
          expandedDetails = inningsIndex;
      }
  }

  function getTeam(teamId: string) {
      return teams.find(t => t.id === teamId);
  }

  function getPlayerName(teamId: string, playerId: string) {
      const team = getTeam(teamId);
      if (!team) return 'Unknown';
      const player = team.players.find(p => p.id === playerId);
      return player ? player.name : 'Unknown';
  }

  function getBattingStats(inn: innings, teamId: string) {
      const batters = new Map();
      
      inn.battingOrder.forEach(pId => {
          batters.set(pId, { id: pId, name: getPlayerName(teamId, pId), runs: 0, balls: 0, fours: 0, sixes: 0, out: false, outType: '', bowler: '' });
      });

      inn.ballsFaced.forEach(b => {
          if (!batters.has(b.batsmanId)) {
              batters.set(b.batsmanId, { id: b.batsmanId, name: getPlayerName(teamId, b.batsmanId), runs: 0, balls: 0, fours: 0, sixes: 0, out: false, outType: '', bowler: '' });
          }
          const stats = batters.get(b.batsmanId);
          if (b.result !== 'wide') {
              stats.balls++;
              stats.runs += b.runs;
              if (b.result === 'four') stats.fours++;
              if (b.result === 'six') stats.sixes++;
          }
          if (b.isWicket) {
              stats.out = true;
              stats.outType = b.wicketType;
              stats.bowler = getPlayerName(teams.find(t => t.id !== teamId)?.id || '', b.bowlerId);
          }
      });
      
      return Array.from(batters.values()).filter(b => b.balls > 0 || inn.currentBatsmen.includes(b.id));
  }

  function getBowlingStats(inn: innings, bowlingTeamId: string) {
      const bowlers = new Map();
      
      inn.ballsFaced.forEach(b => {
          if (!bowlers.has(b.bowlerId)) {
              bowlers.set(b.bowlerId, { id: b.bowlerId, name: getPlayerName(bowlingTeamId, b.bowlerId), balls: 0, runs: 0, wickets: 0, wides: 0, noballs: 0 });
          }
          const stats = bowlers.get(b.bowlerId);
          stats.runs += b.runs;
          if (b.result !== 'wide' && b.result !== 'noball') {
              stats.balls++;
          } else if (b.result === 'wide') {
              stats.wides++;
          } else if (b.result === 'noball') {
              stats.noballs++;
          }
          if (b.isWicket && b.wicketType !== 'run out') {
              stats.wickets++;
          }
      });
      
      return Array.from(bowlers.values()).map(b => ({
          ...b,
          overs: `${Math.floor(b.balls / 6)}.${b.balls % 6}`,
          econ: b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '0.0'
      }));
  }

  function calculatePlayerOfTheMatch() {
      if (!matchComplete) return null;
      let bestPlayer = null;
      let highestScore = -1;

      const evaluate = (inn: innings, batTeamId: string, bowlTeamId: string) => {
          const batStats = getBattingStats(inn, batTeamId);
          const bowlStats = getBowlingStats(inn, bowlTeamId);

          batStats.forEach(b => {
              const score = b.runs + (b.fours * 1) + (b.sixes * 2);
              if (score > highestScore) { highestScore = score; bestPlayer = b.name; }
          });
          
          bowlStats.forEach(b => {
              const score = (b.wickets * 25) + (b.balls > 0 && b.runs / b.balls < 1 ? 10 : 0); // 25 pts per wicket
              if (score > highestScore) { highestScore = score; bestPlayer = b.name; }
          });
      };

      evaluate(inningsList[0], inningsList[0].teamId, teams.find(t => t.id !== inningsList[0].teamId)?.id || '');
      if (inningsList.length > 1 && inningsList[1].ballsFaced.length > 0) {
          evaluate(inningsList[1], inningsList[1].teamId, teams.find(t => t.id !== inningsList[1].teamId)?.id || '');
      }

      return bestPlayer;
  }

  const pom = matchResult?.playerOfTheMatch?.name || calculatePlayerOfTheMatch();

</script>

<div class="match-summary">
    {#if matchComplete && pom}
        <div class="pom-card">
            <p class="eyebrow">Broadcast highlight</p>
            <h3>Player of the Match</h3>
            <p class="pom-name">{typeof pom === 'string' ? pom : pom.name}</p>
            {#if matchResult?.playerOfTheMatch?.stats}
              <p class="pom-stats">{matchResult.playerOfTheMatch.stats}</p>
            {/if}
        </div>
    {/if}

    {#each inningsList as inn, index}
        {#if inn.ballsFaced.length > 0}
            {@const team = getTeam(inn.teamId)}
            {@const bowlTeam = teams.find(t => t.id !== inn.teamId)}
            <div class="innings-card">
                <div class="innings-header">
                    <h4>{team?.name} Innings</h4>
                    <span class="innings-score">{inn.totalRuns}/{inn.wickets} <small>({Math.floor(inn.balls/6)}.{inn.balls%6} ov)</small></span>
                </div>

                <div class="commentary-toggle">
                    <button class="btn-toggle" on:click={() => toggleDetails(index)}>
                        {expandedDetails === index ? 'Hide' : 'Show'} Detailed Scorecard
                    </button>
                </div>

                {#if expandedDetails === index}
                <div class="scorecard">
                    <table class="batting-table">
                        <thead>
                            <tr>
                                <th class="text-left">Batter</th>
                                <th></th>
                                <th>R</th>
                                <th>B</th>
                                <th>4s</th>
                                <th>6s</th>
                                <th>SR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each getBattingStats(inn, inn.teamId) as batter}
                                <tr>
                                    <td class="text-left font-semibold {batter.out ? '' : 'not-out'}">{batter.name}</td>
                                    <td class="text-left text-sm text-gray-400">
                                        {#if batter.out}
                                            b {batter.bowler}
                                        {:else}
                                            not out
                                        {/if}
                                    </td>
                                    <td class="font-bold">{batter.runs}</td>
                                    <td>{batter.balls}</td>
                                    <td>{batter.fours}</td>
                                    <td>{batter.sixes}</td>
                                    <td>{batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '0.0'}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>

                    <table class="bowling-table mt-4">
                        <thead>
                            <tr>
                                <th class="text-left">Bowler</th>
                                <th>O</th>
                                <th>R</th>
                                <th>W</th>
                                <th>Econ</th>
                                <th>Wd</th>
                                <th>Nb</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each getBowlingStats(inn, bowlTeam?.id || '') as bowler}
                                <tr>
                                    <td class="text-left font-semibold">{bowler.name}</td>
                                    <td>{bowler.overs}</td>
                                    <td>{bowler.runs}</td>
                                    <td class="font-bold text-blue-400">{bowler.wickets}</td>
                                    <td>{bowler.econ}</td>
                                    <td>{bowler.wides}</td>
                                    <td>{bowler.noballs}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
                
                <div class="detailed-analysis">
                    <h5>Ball-by-Ball Commentary</h5>
                    <div class="commentary-scroll">
                        <BallFeed events={inn.ballsFaced.slice().reverse()} />
                    </div>
                </div>
                {/if}
            </div>
        {/if}
    {/each}

    {#if matchComplete && matchResult}
      <div class="afterglow-grid">
        {#if matchResult.fanUpdates}
          <div class="afterglow-card info">
            <p class="eyebrow">Crowd pulse</p>
            <h4>Fan impact</h4>
            <div class="afterglow-row">
              <span>{fanUpdateLabels.first} popularity</span>
              <strong>{matchResult.fanUpdates.team1?.popularity ?? '-'}</strong>
            </div>
            <div class="afterglow-row">
              <span>{fanUpdateLabels.first} home advantage</span>
              <strong>{matchResult.fanUpdates.team1?.homeAdvantage ?? 0}</strong>
            </div>
            <div class="afterglow-row">
              <span>{fanUpdateLabels.second} popularity</span>
              <strong>{matchResult.fanUpdates.team2?.popularity ?? '-'}</strong>
            </div>
            <div class="afterglow-row">
              <span>{fanUpdateLabels.second} home advantage</span>
              <strong>{matchResult.fanUpdates.team2?.homeAdvantage ?? 0}</strong>
            </div>
          </div>
        {/if}

        {#if matchResult.injuries?.length}
          <div class="afterglow-card danger">
            <p class="eyebrow">Medical report</p>
            <h4>Post-match injuries</h4>
            <div class="injury-list">
              {#each matchResult.injuries as injury}
                <div class="afterglow-row">
                  <span>{injury.playerName}</span>
                  <strong>{injury.type}</strong>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
</div>

<style>
    .match-summary {
        display: grid;
        gap: 1rem;
        width: 100%;
    }

    .pom-card,
    .afterglow-card,
    .innings-card {
        position: relative;
        overflow: hidden;
        padding: 1rem;
        border-radius: 18px;
        background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
            var(--bg-surface);
        border: 1px solid rgba(148, 163, 184, 0.14);
        box-shadow: none;
    }

    .pom-card {
        display: grid;
        gap: 0.35rem;
        text-align: center;
        background:
            linear-gradient(135deg, rgba(var(--accent-gold-rgb), 0.16), rgba(var(--accent-fire-rgb), 0.1)),
            var(--bg-surface);
        border-color: rgba(var(--accent-gold-rgb), 0.24);
    }

    .pom-card h3 {
        color: var(--warning);
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
    }

    .pom-name {
        font-size: clamp(1.4rem, 2.6vw, 2rem);
        font-weight: 800;
    }

    .pom-stats {
        color: var(--text-secondary);
        font-size: 0.92rem;
    }

    .innings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.8rem;
        padding-bottom: 0.85rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .innings-header h4 {
        font-size: 1.05rem;
        color: var(--text-primary);
    }

    .innings-score {
        font-size: 1.1rem;
        font-weight: 800;
    }

    .innings-score small {
        font-size: 0.85rem;
        color: var(--text-muted);
        font-weight: 500;
    }

    .scorecard {
        padding-top: 0.85rem;
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        text-align: center;
        font-size: 0.92rem;
    }

    th {
        padding: 0.55rem 0.5rem;
        color: var(--text-muted);
        font-weight: 600;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }

    td {
        padding: 0.7rem 0.5rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .text-left {
        text-align: left;
    }

    .font-semibold {
        font-weight: 600;
    }

    .font-bold {
        font-weight: 700;
    }

    .text-sm {
        font-size: 0.85rem;
    }

    .text-gray-400 {
        color: var(--text-muted);
    }

    .text-blue-400 {
        color: var(--info);
    }

    .not-out {
        color: var(--success);
    }

    .commentary-toggle {
        display: flex;
        justify-content: center;
        padding: 0.75rem 0 0;
    }

    .btn-toggle {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(148, 163, 184, 0.14);
        color: var(--text-primary);
        padding: 0.75rem 1rem;
        border-radius: 999px;
        font-weight: 700;
    }

    .btn-toggle:hover {
        border-color: rgba(var(--accent-sapphire-rgb), 0.32);
        background: rgba(var(--accent-sapphire-rgb), 0.12);
    }

    .detailed-analysis {
        padding-top: 1rem;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
    }

    .detailed-analysis h5 {
        margin-bottom: 0.8rem;
        color: var(--text-secondary);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
    }

    .commentary-scroll {
        max-height: 280px;
        overflow-y: auto;
        padding-right: 0.35rem;
    }

    .afterglow-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
    }

    .afterglow-card {
        display: grid;
        gap: 0.5rem;
    }

    .afterglow-card.info {
        border-color: rgba(var(--accent-sapphire-rgb), 0.24);
        background:
            linear-gradient(180deg, rgba(var(--accent-sapphire-rgb), 0.08), rgba(255, 255, 255, 0)),
            var(--bg-surface);
    }

    .afterglow-card.danger {
        border-color: rgba(var(--accent-ruby-rgb), 0.24);
        background:
            linear-gradient(180deg, rgba(var(--accent-ruby-rgb), 0.08), rgba(255, 255, 255, 0)),
            var(--bg-surface);
    }

    .afterglow-card h4 {
        font-size: 1rem;
    }

    .afterglow-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.55rem 0;
        border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    }

    .afterglow-row:last-child {
        border-bottom: 0;
        padding-bottom: 0;
    }

    .injury-list {
        display: grid;
        gap: 0.35rem;
    }
</style>
