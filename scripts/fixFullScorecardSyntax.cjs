const fs = require('fs');
const path = 'src/lib/components/match/FullScorecard.svelte';
let content = fs.readFileSync(path, 'utf8');

// The replacement `bowlingTeamPlayers` to `displayBowlingTeam?.players` hit the parameter definition of formatDismissal
content = content.replace(/function formatDismissal\(stats: BatsmanScorecard, displayBowlingTeam\?\.players: Player\[\]\)/g, 'function formatDismissal(stats: BatsmanScorecard, displayBowlingTeamPlayers: Player[])');

// Update inside the function
content = content.replace(/const bowler = displayBowlingTeam\?\.players\.find/g, 'const bowler = displayBowlingTeamPlayers.find');

// And the call
content = content.replace(/{formatDismissal\(stats, displayBowlingTeam\?\.players\)}/g, '{formatDismissal(stats, displayBowlingTeam?.players || [])}');

fs.writeFileSync(path, content);
console.log('Fixed syntax error in FullScorecard');
