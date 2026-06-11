const fs = require('fs');

let css = fs.readFileSync('src/app.css', 'utf-8');

// 1. Update the @import
css = css.replace(/@import url\([^)]+\);/, '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Philosopher:ital,wght@0,400;0,700;1,400;1,700&family=Rajdhani:wght@500;600;700&display=swap");');

// 2. Update variables in :root
css = css.replace(/--font-fantasy:\s*[^;]+;/, '--font-fantasy: "Philosopher", sans-serif;');
css = css.replace(/--font-sports:\s*[^;]+;/, '--font-sports: "Rajdhani", sans-serif;');
css = css.replace(/--font-body:\s*[^;]+;/, '--font-body: "Inter", sans-serif;');

// 3. Remove the old block first to avoid duplication
css = css.replace(/h1, h2, h3, h4, h5, h6, \.fantasy-heading \{[\s\S]*?\}\s*\.sports-number[\s\S]*?\}\s*\.lore-text[\s\S]*?\}/, '');

// 4. Clean up any trailing whitespace at the end of the file
css = css.trim();

// 5. Append the robust block
css += `

/* Global Typography Overrides */
body {
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6, 
.title, .heading, .player-name, .team-name, .faction-name, 
.fantasy-heading, .modal-title, .section-title, .pane-header h3 {
  font-family: var(--font-fantasy) !important;
  letter-spacing: 0.02em;
}

.sports-number, .stat-value, .run-rate, .player-score, 
.bubble, .scorecard-item, .stat-badge, .final-score, 
.price, .money, .runs, .wickets, .overs, .stat-label {
  font-family: var(--font-sports) !important;
}

.lore-text, p.description, .manager-guide, .commentary-text {
  font-family: var(--font-body) !important;
}
`;

fs.writeFileSync('src/app.css', css);
console.log('Updated app.css with new fantasy/sports fonts and robust selectors.');