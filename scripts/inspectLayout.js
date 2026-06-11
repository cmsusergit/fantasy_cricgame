const fs = require('fs');
let content = fs.readFileSync('src/routes/match/+page.svelte', 'utf8');

const match = content.match(/<div class="match-layout-vertical">[\s\S]*?<\/div>[\s\n]*<\/div>[\s\n]*\{\/if\}/);
if (match) {
   console.log("Found layout end.");
} else {
   console.log("Could not match the full block.");
}
