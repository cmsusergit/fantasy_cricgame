<script lang="ts">
  import type { Team } from '$lib/models/team';
  import type { innings, BallEvent } from '$lib/models/match';
  import BallFeed from './BallFeed.svelte';

  export let inningsList: innings[];
  export let teams: Team[];
  export let matchComplete: boolean = false;

  let expandedCommentary = -1;

  function toggleCommentary(inningsIndex: number) {
      if (expandedCommentary === inningsIndex) {
          expandedCommentary = -1;
      } else {
          expandedCommentary = inningsIndex;
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

  const pom = calculatePlayerOfTheMatch();

</script>

<div class="match-summary">
    {#if matchComplete && pom}
        <div class="pom-card">
            <h3>🏆 Player of the Match</h3>
            <p class="pom-name">{pom}</p>
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
                
                <div class="commentary-toggle">
                    <button class="btn-toggle" on:click={() => toggleCommentary(index)}>
                        {expandedCommentary === index ? 'Hide' : 'Show'} Detailed Analysis
                    </button>
                </div>
                
                {#if expandedCommentary === index}
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
</div>

<style>
    .match-summary { display: flex; flex-direction: column; gap: 24px; width: 100%; }
    
    .pom-card {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1));
        border: 1px solid rgba(245, 158, 11, 0.5);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
    }
    .pom-card h3 { color: var(--warning); margin-bottom: 8px; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px; }
    .pom-name { font-size: 1.8rem; font-weight: 800; color: white; }

    .innings-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        overflow: hidden;
    }

    .innings-header {
        background: rgba(0,0,0,0.2);
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border-color);
    }
    .innings-header h4 { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin: 0; }
    .innings-score { font-size: 1.25rem; font-weight: 800; color: var(--text-primary); }
    .innings-score small { font-size: 0.9rem; font-weight: 400; color: var(--text-muted); }

    .scorecard { padding: 20px; overflow-x: auto; }
    
    table { width: 100%; border-collapse: collapse; text-align: center; font-size: 0.95rem; }
    th { padding: 8px; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border-color); }
    td { padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    
    .text-left { text-align: left; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .text-sm { font-size: 0.85rem; }
    .text-gray-400 { color: var(--text-muted); }
    .text-blue-400 { color: var(--info); }
    
    .not-out { color: var(--success); }
    .mt-4 { margin-top: 16px; }

    .commentary-toggle {
        padding: 12px 20px;
        background: rgba(0,0,0,0.1);
        border-top: 1px solid var(--border-color);
        text-align: center;
    }
    .btn-toggle {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.2s;
    }
    .btn-toggle:hover { background: var(--border-color); }

    .detailed-analysis {
        padding: 20px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-primary);
    }
    .detailed-analysis h5 { color: var(--text-primary); margin-bottom: 16px; font-size: 1.1rem; }
    .commentary-scroll {
        max-height: 300px;
        overflow-y: auto;
        padding-right: 10px;
    }
</style>
