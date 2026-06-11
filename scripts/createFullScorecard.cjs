const fs = require('fs');

let content = fs.readFileSync('src/lib/components/match/ScorecardDrawer.svelte', 'utf8');

// Remove tweening/drawer logic
content = content.replace(/import \{ tweened \} from 'svelte\/motion';/, '');
content = content.replace(/import \{ cubicOut \} from 'svelte\/easing';/, '');
content = content.replace(/export let show: boolean;/, '');

const tweenLogic = `  const drawerPosition = tweened(100, {
    duration: 300,
    easing: cubicOut
  });

  $: {
    if (show) {
      drawerPosition.set(0);
    } else {
      drawerPosition.set(100);
    }
  }`;
content = content.replace(tweenLogic, '');

// Replace drawer HTML with standard container
content = content.replace(/<div\s+class="scorecard-drawer"\s+class:show\s+style="transform: translateX\(\{\$drawerPosition\}%\); --batting-primary: \{battingTeamColorPrimary\}; --bowling-primary: \{bowlingTeamColorPrimary\};"\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby="scorecard-drawer-title"\s+>/, `<div class="full-scorecard" style="--batting-primary: {battingTeamColorPrimary}; --bowling-primary: {bowlingTeamColorPrimary};">`);
content = content.replace(/<button class="close-btn".*?<\/button>/, '');
content = content.replace(/id="scorecard-drawer-title"/, 'id="full-scorecard-title"');

// Fix CSS
const cssReplace = `  .scorecard-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 100%;
    max-width: 600px; /* Adjust as needed */
    height: 100%;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s ease-out;
  }

  .scorecard-drawer.show {
    transform: translateX(0);
  }`;
content = content.replace(cssReplace, `  .full-scorecard {
    width: 100%;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    margin-top: 24px;
    overflow: hidden;
  }`);

// Add some extra CSS to handle padding since we don't have the drawer header anymore
content = content.replace('.drawer-header {', '.drawer-header {\n    background: rgba(0,0,0,0.1);');

fs.writeFileSync('src/lib/components/match/FullScorecard.svelte', content);
console.log('FullScorecard.svelte created.');
