const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// Move Scoreboard Header to Top Section
const scoreboardHeaderRegex = /<div class="scoreboard-header">[\s\S]*?<\/div>/;
const headerMatch = content.match(scoreboardHeaderRegex);

if (headerMatch) {
    const headerHtml = headerMatch[0];
    content = content.replace(scoreboardHeaderRegex, ''); // Remove from center

    // Place it inside top-section, above everything else
    // Looking for: <div class="top-section">
    const topSectionRegex = /<div class="top-section">/;
    
    // The new header should probably look like a page header
    const topHeaderHtml = `<div class="teams-matchup-header" style="text-align: center; margin-bottom: 16px;">
          <h2 style="margin: 0; font-family: 'Cinzel', serif; font-size: 1.5rem;">
            <span style="color: {currentBattingTeam?.colorPrimary}">{currentBattingTeam?.name}</span>
            <span style="color: var(--text-muted); font-size: 1rem; margin: 0 12px;">VS</span>
            <span style="color: {currentBowlingTeam?.colorPrimary}">{currentBowlingTeam?.name}</span>
          </h2>
        </div>`;
        
    content = content.replace(topSectionRegex, '<div class="top-section">\n        ' + topHeaderHtml);
}

// Enhance the recent balls
const oldRecentBalls = `                 {#each currentInningsData.ballsFaced.slice(-6) as ball}
                    <div class="bubble {ball.isWicket ? 'wicket' : ball.runs === 4 ? 'four' : ball.runs === 6 ? 'six' : ''}">
                       {ball.isWicket ? 'W' : ball.runs}
                    </div>
                 {/each}`;

const newRecentBalls = `                 {#each currentInningsData.ballsFaced.slice(-6) as ball}
                    <div class="bubble {ball.isWicket ? 'wicket' : ball.runs === 4 ? 'four' : ball.runs === 6 ? 'six' : ball.runs === 0 ? 'dot' : ball.runs === 1 || ball.runs === 2 || ball.runs === 3 ? 'runs' : ''}">
                       {ball.isWicket ? 'W' : ball.runs}
                    </div>
                 {/each}`;
                 
content = content.replace(oldRecentBalls, newRecentBalls);

// Add the missing CSS for .bubble
const cssAdditions = `
  .teams-matchup-header {
    background: var(--bg-surface);
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  }

  .bubble {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1rem;
    color: var(--text-primary);
    background: var(--bg-tertiary);
    border: 2px solid var(--border-color);
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .bubble.dot {
    background: var(--text-muted);
    color: var(--bg-primary);
    border-color: rgba(255,255,255,0.2);
  }
  .bubble.runs {
    background: #3b82f6; /* Blue for regular runs */
    color: white;
    border-color: #2563eb;
  }
  .bubble.four {
    background: #22c55e; /* Green for four */
    color: white;
    border-color: #16a34a;
  }
  .bubble.six {
    background: #a855f7; /* Purple for six */
    color: white;
    border-color: #9333ea;
  }
  .bubble.wicket {
    background: #ef4444; /* Red for wicket */
    color: white;
    border-color: #dc2626;
  }
`;

content = content.replace('</style>', cssAdditions + '\n</style>');

fs.writeFileSync(path, content);
console.log('Match UI V3 applied');
