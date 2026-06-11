const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const oldLayoutStart = '<div class="match-layout-vertical">';
const oldLayoutEnd = '      </div>    </div>\n  {/if}';

const startIndex = content.indexOf(oldLayoutStart);
const endIndex = content.indexOf(oldLayoutEnd, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find layout bounds");
    process.exit(1);
}

// Keep the old layout content, just wrap it
const layoutContent = content.substring(startIndex, endIndex + '      </div>    </div>'.length);

const newWrapper = `<div class="match-dashboard">
    <div class="main-content">
      ${layoutContent}
      
      <div class="bottom-bar">
         <button class="btn-drawer-toggle" onclick={() => showScorecardDrawer = true}>
            View Full Scorecard
         </button>
      </div>
    </div>
    
    <div class="side-content">
      <div class="commentary-panel">
         <div class="commentary-header">
           <span>Live Commentary</span>
         </div>
         <div class="commentary-content">
            <BallFeed events={currentInningsData.ballsFaced} />
         </div>
      </div>
    </div>
  </div>
  
  <ScorecardDrawer bind:show={showScorecardDrawer}
                   currentInningsData={currentInningsData}
                   battingTeamPlayers={currentBattingTeam?.players || []}
                   bowlingTeamPlayers={currentBowlingTeam?.players || []}
                   battingTeamColorPrimary={currentBattingTeam?.colorPrimary}
                   battingTeamColorSecondary={currentBattingTeam?.colorSecondary}
                   bowlingTeamColorPrimary={currentBowlingTeam?.colorPrimary}
                   bowlingTeamColorSecondary={currentBowlingTeam?.colorSecondary}
   />`;

// Replace from startIndex to endIndex + '      </div>    </div>'.length
content = content.substring(0, startIndex) + newWrapper + content.substring(endIndex + '      </div>    </div>'.length);

// Also need to add the CSS for this new layout.
const newCSS = `
  .match-dashboard {
    display: grid;
    grid-template-columns: 10fr 2fr; /* 10/12 for main, 2/12 for side */
    gap: 16px;
    height: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  
  @media (max-width: 1200px) {
    .match-dashboard {
      grid-template-columns: 8fr 4fr;
    }
  }
  
  @media (max-width: 900px) {
    .match-dashboard {
      grid-template-columns: 1fr;
    }
  }

  .main-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .side-content {
    display: flex;
    flex-direction: column;
  }
  
  .commentary-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    min-height: 400px;
  }

  .commentary-header {
    background: rgba(0,0,0,0.1);
    padding: 12px 16px;
    font-weight: bold;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
  }

  .commentary-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }
  
  .bottom-bar {
    display: flex;
    justify-content: center;
    padding: 16px;
    background: var(--bg-surface);
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }
  
  .btn-drawer-toggle {
    background: linear-gradient(135deg, var(--color-batting), var(--color-batting-dark));
    color: white;
    border: none;
    padding: 12px 24px;
    font-size: 1.1rem;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .btn-drawer-toggle:hover {
    opacity: 0.9;
  }
`;

content = content.replace('<style>', '<style>\n' + newCSS);

fs.writeFileSync(path, content);
console.log('Layout replaced');
