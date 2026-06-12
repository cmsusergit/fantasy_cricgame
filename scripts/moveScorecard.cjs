const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const scorecardStart = content.indexOf('<FullScorecard ');
if (scorecardStart === -1) {
  console.log('Scorecard not found');
  process.exit(1);
}

const scorecardEndMarker = '         />';
let scorecardEnd = content.indexOf(scorecardEndMarker, scorecardStart);
if (scorecardEnd === -1) {
  console.log('Scorecard end not found');
  process.exit(1);
}
scorecardEnd += scorecardEndMarker.length;

const scorecardBlock = content.substring(scorecardStart, scorecardEnd);

// Remove the block from its current location
content = content.substring(0, scorecardStart) + content.substring(scorecardEnd);

// Find the end of match-dashboard
const dashboardEndMarker = '    </div>\n  </div>'; // side-content closing and match-dashboard closing
const dashboardEndIdx = content.indexOf(dashboardEndMarker);

if (dashboardEndIdx !== -1) {
    const insertIdx = dashboardEndIdx + dashboardEndMarker.length;
    content = content.substring(0, insertIdx) + '\n\n  <div class="full-width-scorecard-container">\n    ' + scorecardBlock + '\n  </div>' + content.substring(insertIdx);
} else {
    // fallback regex matching side-content end and match-dashboard end
    const fallbackMatch = content.match(/<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\{\/if\}/);
    if(fallbackMatch) {
       console.log("Using fallback match");
       const insertIdx = fallbackMatch.index + '</div>\n  </div>'.length; // approx
       // We'll just replace the whole matched string
       const matchedStr = fallbackMatch[0];
       // it's actually:
       // </div> (commentary-panel)
       // </div> (side-content)
       // </div> (match-dashboard)
       // {/if} (else block end)
       const replaceStr = matchedStr.replace(/<\/div>\n\s*<\/div>\n\s*<\/div>/, '</div>\n    </div>\n  </div>\n\n  <div class="full-width-scorecard-container" style="margin-top: 24px; padding-bottom: 24px;">\n    ' + scorecardBlock + '\n  </div>');
       content = content.replace(fallbackMatch[0], replaceStr);
    } else {
       console.log("Could not find insertion point");
       process.exit(1);
    }
}

fs.writeFileSync(path, content);
console.log('Scorecard moved');
