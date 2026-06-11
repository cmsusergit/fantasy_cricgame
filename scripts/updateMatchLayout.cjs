const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// Replace import
content = content.replace(
  "import ScorecardDrawer from '$lib/components/match/ScorecardDrawer.svelte';",
  "import FullScorecard from '$lib/components/match/FullScorecard.svelte';"
);

// Remove showScorecardDrawer state
content = content.replace(/let showScorecardDrawer = \$state\(false\);\n?/, "");

// Replace grid-template-columns
content = content.replace(/grid-template-columns: 10fr 2fr;/g, "grid-template-columns: 7fr 5fr;");
content = content.replace(/grid-template-columns: 8fr 4fr;/g, "grid-template-columns: 7fr 5fr;"); 

// Remove bottom-bar and ScorecardDrawer component
const bottomBarStart = content.indexOf('<div class="bottom-bar">');
if(bottomBarStart > -1) {
    const bottomBarEnd = content.indexOf('</div>', bottomBarStart + 20) + 6;
    content = content.substring(0, bottomBarStart) + content.substring(bottomBarEnd);
}

const drawerHtml = `<ScorecardDrawer bind:show={showScorecardDrawer}
                   currentInningsData={currentInningsData}
                   battingTeamPlayers={currentBattingTeam?.players || []}
                   bowlingTeamPlayers={currentBowlingTeam?.players || []}
                   battingTeamColorPrimary={currentBattingTeam?.colorPrimary}
                   battingTeamColorSecondary={currentBattingTeam?.colorSecondary}
                   bowlingTeamColorPrimary={currentBowlingTeam?.colorPrimary}
                   bowlingTeamColorSecondary={currentBowlingTeam?.colorSecondary}
   />`;

content = content.replace(drawerHtml, '');
// Fallback if formatting was different
content = content.replace(/<ScorecardDrawer[\s\S]*?\/>/, '');

const fullScorecardHtml = `<FullScorecard 
                   currentInningsData={currentInningsData}
                   battingTeamPlayers={currentBattingTeam?.players || []}
                   bowlingTeamPlayers={currentBowlingTeam?.players || []}
                   battingTeamColorPrimary={currentBattingTeam?.colorPrimary}
                   battingTeamColorSecondary={currentBattingTeam?.colorSecondary}
                   bowlingTeamColorPrimary={currentBowlingTeam?.colorPrimary}
                   bowlingTeamColorSecondary={currentBowlingTeam?.colorSecondary}
         />`;

const marker = `    </div>\n    \n    <div class="side-content">`;
if (content.includes(marker)) {
    content = content.replace(marker, `\n      ${fullScorecardHtml}\n    </div>\n    \n    <div class="side-content">`);
} else {
    // regex fallback
    content = content.replace(/(<\/div>\s*<div class="side-content">)/, `\n      ${fullScorecardHtml}\n    $1`);
}

fs.writeFileSync(path, content);
console.log('+page.svelte updated.');