const fs = require('fs');

function replaceInherit(filePath) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    content = content.replace(/font-family:\s*inherit;/g, 'font-family: var(--font-sports);');
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

replaceInherit('src/routes/match/+page.svelte');
replaceInherit('src/lib/components/match/Scoreboard.svelte');
replaceInherit('src/lib/components/match/MatchControls.svelte');

