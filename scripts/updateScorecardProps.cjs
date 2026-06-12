const fs = require('fs');

// Update FullScorecard.svelte
const scorecardPath = 'src/lib/components/match/FullScorecard.svelte';
let scorecardContent = fs.readFileSync(scorecardPath, 'utf8');

const newProps = `  export let innings1: innings;
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
`;

// remove old props
scorecardContent = scorecardContent.replace(/export let currentInningsData: innings;[\s\S]*?export let bowlingTeamColorSecondary: string = '#fbbf24';/, newProps);

// replace scorecard calculation
scorecardContent = scorecardContent.replace(/\$: scorecard = .*?;/, `$: scorecard = displayInnings ? calculateScorecardStats(displayInnings, [...(displayBattingTeam?.players || []), ...(displayBowlingTeam?.players || [])]) : { batsmanScorecards: [], bowlerScorecards: [] };`);

// Update the template to include tabs
const tabsHtml = `  <div class="drawer-header">
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
  {/if}`;

scorecardContent = scorecardContent.replace(/<div class="drawer-header">[\s\S]*?<\/div>/, tabsHtml);

// replace all instances of battingTeamPlayers with displayBattingTeam?.players
scorecardContent = scorecardContent.replace(/battingTeamPlayers/g, 'displayBattingTeam?.players');
// replace all instances of bowlingTeamPlayers with displayBowlingTeam?.players
scorecardContent = scorecardContent.replace(/bowlingTeamPlayers/g, 'displayBowlingTeam?.players');

// Add CSS for innings-tabs
const cssAdd = `
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
  }`;

scorecardContent = scorecardContent.replace('</style>', cssAdd + '\n</style>');
fs.writeFileSync(scorecardPath, scorecardContent);

// Update match/+page.svelte
const matchPath = 'src/routes/match/+page.svelte';
let matchContent = fs.readFileSync(matchPath, 'utf8');

const oldScorecard = /<FullScorecard[\s\S]*?\/>/;
const newScorecard = `<FullScorecard 
                   innings1={innings1}
                   innings2={innings2}
                   team1={matchTeam1}
                   team2={matchTeam2}
                   currentInnings={currentInnings}
         />`;

matchContent = matchContent.replace(oldScorecard, newScorecard);
fs.writeFileSync(matchPath, matchContent);

console.log('Update complete');
