const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src/app.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replacements to tighten UI
const replacements = [
    [/padding: 0\.85rem 1rem;/g, 'padding: 0.5rem 0.75rem;'],
    [/padding: 0\.85rem 0\.9rem;/g, 'padding: 0.5rem 0.75rem;'],
    [/padding: 1rem 1\.1rem;/g, 'padding: 0.75rem 0.85rem;'],
    [/padding: 1\.25rem;/g, 'padding: 1rem;'],
    [/padding: 1rem 1\.25rem;/g, 'padding: 0.75rem 1rem;'],
    [/padding: 0\.75rem;/g, 'padding: 0.5rem;'],
    [/padding: 0\.7rem 0\.95rem;/g, 'padding: 0.45rem 0.7rem;'],
    [/padding: 0\.8rem 0\.95rem;/g, 'padding: 0.5rem 0.75rem;'],
    [/padding: 0\.45rem 0\.75rem;/g, 'padding: 0.25rem 0.5rem;'],
    [/gap: 1\.25rem;/g, 'gap: 1rem;'],
    [/gap: 1rem;\s*margin-bottom: 1rem;/g, 'gap: 0.75rem;\n  margin-bottom: 0.75rem;'],
    [/gap: 0\.75rem;/g, 'gap: 0.5rem;'],
    [/gap: 1rem;/g, 'gap: 0.75rem;'],
    [/gap: 0\.6rem;/g, 'gap: 0.5rem;'],
    [/font-size: clamp\(1rem, 1\.25vw, 1\.25rem\);/g, 'font-size: clamp(0.9rem, 1vw, 1.1rem);'],
    [/font-size: 0\.72rem;/g, 'font-size: 0.65rem;'],
    [/font-size: clamp\(1\.25rem, 2vw, 1\.75rem\);/g, 'font-size: clamp(1.1rem, 1.5vw, 1.35rem);'],
    [/font-size: 1\.1rem;/g, 'font-size: 1rem;'],
    [/font-size: 0\.86rem;/g, 'font-size: 0.75rem;'],
    [/padding-bottom: 7rem;/g, 'padding-bottom: 5rem;'],
    [/height: 96px;/g, 'height: 72px;'],
    [/padding: 1\.25rem !important;/g, 'padding: 1rem !important;'],
    [/padding: 0\.85rem 1rem !important;/g, 'padding: 0.5rem 0.75rem !important;'],
    [/padding: 0\.9rem 1rem !important;/g, 'padding: 0.5rem 0.75rem !important;'],
    [/height: 118px;/g, 'height: 80px;'],
    [/padding-bottom: 8\.5rem;/g, 'padding-bottom: 6rem;'],
    [/padding: 1rem;/g, 'padding: 0.75rem;'], // General 1rem padding to 0.75rem
    [/padding: 0\.9rem;/g, 'padding: 0.75rem;'],
    [/(body \{[\s\S]*?font-family: "Inter", sans-serif;)/, '$1\n  font-size: 14px;'],
    [/padding: 0\.8rem 1rem !important;/g, 'padding: 0.5rem 0.75rem !important;'],
    [/padding: 1rem !important;/g, 'padding: 0.75rem !important;']
];

for (const [pattern, replacement] of replacements) {
    css = css.replace(pattern, replacement);
}

fs.writeFileSync(cssPath, css);
console.log('CSS updated successfully');