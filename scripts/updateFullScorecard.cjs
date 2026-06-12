const fs = require('fs');
const path = 'src/lib/components/match/FullScorecard.svelte';
let content = fs.readFileSync(path, 'utf8');

// Remove tab controls HTML
const tabControlsRegex = /<div class="tab-controls">[\s\S]*?<\/div>\s*<div class="drawer-content">/;
content = content.replace(tabControlsRegex, '<div class="drawer-content">');

// Remove {#if activeTab === 'batting'}
content = content.replace(/{#if activeTab === 'batting'}/, '<div class="scorecard-grid">');

// Replace {:else} with nothing
content = content.replace(/{:else}/, '');

// Replace {/if} closing the tab block with </div>
// Looking closely, there's a {/if} closing activeTab. 
// Before the </div> of .drawer-content
content = content.replace(/    \{\/if\}\n  <\/div>\n<\/div>/, '    </div>\n  </div>\n</div>');

// Add grid css
const cssReplace = `  .full-scorecard {`;
const gridCss = `  .scorecard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 16px;
  }

  @media (max-width: 900px) {
    .scorecard-grid {
      grid-template-columns: 1fr;
    }
  }

  .full-scorecard {`;

content = content.replace(cssReplace, gridCss);

fs.writeFileSync(path, content);
console.log('FullScorecard updated to show both tables side by side.');
