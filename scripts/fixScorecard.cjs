const fs = require('fs');
const path = 'src/lib/components/match/FullScorecard.svelte';
let content = fs.readFileSync(path, 'utf8');

// Restore the {:else} inside the loop
content = content.replace(/{formatDismissal\(stats, bowlingTeamPlayers\)}\s+not out/, '{formatDismissal(stats, bowlingTeamPlayers)}\n                    {:else}\n                      not out');

// Remove the {:else} before the bowling scorecard
content = content.replace(/    \{:else\}\n      <div class="scorecard-table">\n        <h3>Bowling Scorecard<\/h3>/, '      <div class="scorecard-table">\n        <h3>Bowling Scorecard</h3>');

fs.writeFileSync(path, content);
console.log('Fixed FullScorecard structure');
