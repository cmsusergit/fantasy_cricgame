const fs = require('fs');

const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '<!-- Main Horizontal 3-Pane Match Layout -->';
const endMarker = '    </div>\n  {/if}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  // We'll replace it in the next step
  console.log('Found markers.');
} else {
  console.log('Markers not found.', startIndex, endIndex);
}
