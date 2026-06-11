const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const badConstBlock = `           <div class="active-bowler-row">
              {@const bowlerId = currentLiveBowlerId}
              {@const p = currentBowlingTeam?.players.find(x => x.id === bowlerId)}
              {@const stats = p ? getBowlerStats(p.id) : null}
              {@const intent = bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}`;

const goodConstBlock = `              {@const bowlerId = currentLiveBowlerId}
              {@const p = currentBowlingTeam?.players.find(x => x.id === bowlerId)}
              {@const stats = p ? getBowlerStats(p.id) : null}
              {@const intent = bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}
           <div class="active-bowler-row">`;

content = content.replace(badConstBlock, goodConstBlock);

fs.writeFileSync(path, content);
console.log('Fixed const position');
