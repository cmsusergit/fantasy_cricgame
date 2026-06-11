const fs = require('fs');

let css = fs.readFileSync('src/app.css', 'utf-8');

// Replace body font
css = css.replace(/body\s*\{[\s\S]*?font-family:\s*"Inter",\s*sans-serif;/g, (match) => {
    return match.replace('"Inter", sans-serif;', 'var(--font-ui);');
});

// Create a rule for headers and numbers
css += `
h1, h2, h3, h4, h5, h6, .fantasy-heading {
  font-family: var(--font-fantasy);
  letter-spacing: 0.02em;
}

.sports-number, .stat-value, .run-rate, .player-score, .bubble, .scorecard-item {
  font-family: var(--font-sports);
}

.lore-text, p.description {
  font-family: var(--font-body);
}
`;

css = css.replace(/font-family:\s*["']Space Grotesk["'][^;]*;/g, 'font-family: var(--font-fantasy);');
css = css.replace(/font-family:\s*["']Inter["'][^;]*;/g, 'font-family: var(--font-ui);');

fs.writeFileSync('src/app.css', css);
console.log('Fonts updated in app.css');
