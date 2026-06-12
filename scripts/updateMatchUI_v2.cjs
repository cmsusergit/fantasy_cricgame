const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// 1. Striker Highlight
content = content.replace(
  /{#each currentInningsData\.currentBatsmen\.filter\(id => id\) as batsmanId}/,
  '{#each currentInningsData.currentBatsmen.filter(id => id) as batsmanId, i}'
);

content = content.replace(
  /<div class="batsman-card intent-\{intent\}">/g,
  `<div class="batsman-card intent-{intent} {i === 0 ? 'on-strike' : ''}">`
);

content = content.replace(
  /<div class="b-name">\{p\.name\}<\/div>/g,
  `<div class="b-name">{p.name} {#if i === 0}<span class="striker-icon" title="On Strike">🏏</span>{/if}</div>`
);

// 2. Avatar Faction and Stat Badges for Batsman
const bAvatarOld = /<div class="b-avatar-col">\s*<div class="avatar-ring">\s*<img[^>]+>\s*<div class="skill-badge[^>]+>\{p\.stats\.batting\}<\/div>\s*<\/div>\s*<\/div>/;

const bAvatarNew = `<div class="b-avatar-col">
                      <div class="avatar-ring">
                        <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                      </div>
                      <div class="faction-badge-mini left-badge faction-{p.faction}">
                          {p.faction === 'human' ? '⚔' : p.faction === 'elf' ? '🌿' : p.faction === 'orc' ? '🪓' : p.faction === 'dwarf' ? '⛏' : p.faction === 'goblin' ? '💎' : '🌙'}
                      </div>
                      <div class="skill-badge {p.stats.batting >= 70 ? 'high' : p.stats.batting >= 40 ? 'med' : 'low'}">{p.stats.batting}</div>
                    </div>`;

if(content.match(bAvatarOld)) {
    content = content.replace(bAvatarOld, bAvatarNew);
} else {
    // fallback if it didn't match exactly
    const bAvatarFallback = /<div class="b-avatar-col">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/; // wait, b-avatar-col ends after 2 or 3 divs?
    content = content.replace(/<div class="b-avatar-col">[\s\S]*?<div class="b-info-col">/, bAvatarNew + '\n                    <div class="b-info-col">');
}

// Avatar Faction and Stat Badges for Bowler
const bwAvatarOld = /<div class="bw-avatar-col pulse-anim-\{Math\.floor\(p\.morale \/ 20\)\}">[\s\S]*?<div class="bw-info-col">/;

const bwAvatarNew = `<div class="bw-avatar-col pulse-anim-{Math.floor(p.morale / 20)}">
                     <div class="avatar-ring">
                       <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                     </div>
                     <div class="faction-badge-mini left-badge faction-{p.faction}">
                         {p.faction === 'human' ? '⚔' : p.faction === 'elf' ? '🌿' : p.faction === 'orc' ? '🪓' : p.faction === 'dwarf' ? '⛏' : p.faction === 'goblin' ? '💎' : '🌙'}
                     </div>
                     <div class="skill-badge {p.stats.bowling >= 70 ? 'high' : p.stats.bowling >= 40 ? 'med' : 'low'}">{p.stats.bowling}</div>
                   </div>\n                   <div class="bw-info-col">`;

content = content.replace(bwAvatarOld, bwAvatarNew);


// 3. Center Section Expansion
content = content.replace(/\.center-section \{\s*flex: 1;\s*display: flex;\s*flex-direction: column;\s*align-items: center;/g,
  `.center-section {\n    flex: 1;\n    display: flex;\n    flex-direction: column;\n    align-items: stretch;`);

content = content.replace(/\.scoreboard-main \{\s*background: var\(--bg-surface\);\s*border-radius: 16px;\s*padding: 24px;\s*min-width: 400px;/g,
  `.scoreboard-main {\n    background: var(--bg-surface);\n    border-radius: 16px;\n    padding: 24px;\n    width: 100%;\n    box-sizing: border-box;`);


// 4. CSS Additions
const cssAdditions = `
  .batsman-card.on-strike {
    position: relative;
    box-shadow: 0 0 15px rgba(var(--team-primary-rgb, 59, 130, 246), 0.6) !important;
    border-width: 3px;
    transform: scale(1.02);
  }
  .striker-icon {
    font-size: 1.2rem;
    margin-left: 6px;
    filter: drop-shadow(0 0 5px rgba(255,255,255,0.5));
  }
  .left-badge {
    right: auto !important;
    left: -5px !important;
    z-index: 5;
  }
  .skill-badge {
    z-index: 5;
  }
`;

content = content.replace('</style>', cssAdditions + '\n</style>');

fs.writeFileSync(path, content);
console.log('Match UI updated');
