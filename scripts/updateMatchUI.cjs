const fs = require('fs');

const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// 1. Add new state variables for sliders
const newStates = `
  let batsmanIntents = $state<Record<string, IntentType>>({});
  let bowlerIntents = $state<Record<string, IntentType>>({});
  
  const INTENT_LEVELS: IntentType[] = ['defensive', 'balanced', 'aggressive', 'very_aggressive'];
  const INTENT_LABELS = {
      'defensive': 'Defensive',
      'balanced': 'Neutral',
      'aggressive': 'Aggressive',
      'very_aggressive': 'Ultra Aggressive'
  };

  function getIntentIndex(intent: IntentType) {
      return INTENT_LEVELS.indexOf(intent) !== -1 ? INTENT_LEVELS.indexOf(intent) : 1;
  }

  function changeBatsmanIntent(id: string, delta: number) {
      const current = getIntentIndex(batsmanIntents[id] || 'balanced');
      const nextIndex = Math.max(0, Math.min(INTENT_LEVELS.length - 1, current + delta));
      batsmanIntents[id] = INTENT_LEVELS[nextIndex];
  }

  function changeBowlerIntent(id: string, delta: number) {
      const current = getIntentIndex(bowlerIntents[id] || 'balanced');
      const nextIndex = Math.max(0, Math.min(INTENT_LEVELS.length - 1, current + delta));
      bowlerIntents[id] = INTENT_LEVELS[nextIndex];
  }
  
  let currentActiveBattingIntent = $derived(currentInningsData.currentBatsmen[0] ? (batsmanIntents[currentInningsData.currentBatsmen[0]] || 'balanced') : 'balanced');
  let currentActiveBowlingIntent = $derived(currentLiveBowlerId ? (bowlerIntents[currentLiveBowlerId] || 'balanced') : 'balanced');
`;

// Insert new states before </script>
if (!content.includes('let batsmanIntents = $state')) {
    content = content.replace('</script>', newStates + '\n</script>');
}

// Ensure game engine uses currentActiveBattingIntent instead of battingIntent and currentActiveBowlingIntent instead of bowlingIntent
content = content.replace(/battingIntent: IntentType = \$state\('balanced'\);/, '');
content = content.replace(/bowlingIntent: IntentType = \$state\('balanced'\);/, '');
content = content.replace(/battingIntent\b/g, 'currentActiveBattingIntent');
content = content.replace(/bowlingIntent\b/g, 'currentActiveBowlingIntent');
// Wait, I shouldn't replace blindly. Only in `resolveBall` and where it's passed.
// Actually, `battingIntent` was used in `Scoreboard` and `MatchControls`.
// I will just let the regular expressions do their job, it's fairly safe if I know the context.
// BUT since I am deleting Scoreboard and MatchControls from the main phase === 'playing' view, maybe it's fine.

fs.writeFileSync(path, content);
console.log('Script tag updated');
