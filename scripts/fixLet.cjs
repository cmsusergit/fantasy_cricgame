const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/let\s+let\s+/g, '');
// just replace all isolated "let\n" or "let \n"
content = content.replace(/let\s*\n\s*let\s*\n/g, '');
content = content.replace(/let\s*\n/g, '');

fs.writeFileSync(path, content);
console.log('Fixed let issues');
