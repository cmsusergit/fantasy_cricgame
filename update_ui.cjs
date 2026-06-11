const fs = require('fs');
const path = require('path');

// 1. Update app.css
let cssPath = path.join(__dirname, 'src/app.css');
let css = fs.readFileSync(cssPath, 'utf8');

const cssReplacements = [
    [/padding: 0\.5rem 0\.75rem;/g, 'padding: 0.75rem 1rem;'],
    [/padding: 0\.75rem 0\.85rem;/g, 'padding: 0.85rem 1rem;'],
    [/padding: 0\.25rem 0\.5rem;/g, 'padding: 0.35rem 0.6rem;'],
    [/padding: 0\.75rem;/g, 'padding: 1rem;'],
    [/padding: 0\.75rem 1rem;/g, 'padding: 1rem 1.25rem;'],
    [/padding: 0\.5rem;/g, 'padding: 0.75rem;'],
    [/padding: 0\.45rem 0\.7rem;/g, 'padding: 0.6rem 0.85rem;'],
    [/padding: 0\.5rem 0\.75rem !important;/g, 'padding: 0.75rem 1rem !important;'],
    [/padding: 0\.75rem !important;/g, 'padding: 1rem !important;'],
    
    // Remove shadows
    [/--shadow-sm: .*/g, '--shadow-sm: none;'],
    [/--shadow-md: .*/g, '--shadow-md: none;'],
    [/--shadow-lg: .*/g, '--shadow-lg: none;'],
    [/--shadow-glow-[a-z]+: .*/g, (match) => {
        let name = match.split(':')[0];
        return `${name}: none;`;
    }],
    [/box-shadow: [^;]+;/g, 'box-shadow: none;']
];

for (const [pattern, repl] of cssReplacements) {
    css = css.replace(pattern, repl);
}
fs.writeFileSync(cssPath, css);

// 2. Walk all Svelte files to remove box-shadow and soften padding
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(path.join(__dirname, 'src'), (filePath) => {
    if (filePath.endsWith('.svelte')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        const svelteReplacements = [
            [/padding:\s*12px;/g, 'padding: 16px;'],
            [/padding:\s*10px;/g, 'padding: 14px;'],
            [/padding:\s*10px 24px;/g, 'padding: 14px 28px;'],
            [/padding:\s*12px 16px;/g, 'padding: 16px 20px;'],
            [/padding:\s*24px 12px;/g, 'padding: 28px 16px;'],
            [/padding:\s*0 12px;/g, 'padding: 0 16px;'],
            [/padding:\s*0\.75rem !important;/g, 'padding: 1rem !important;'],
            [/padding:\s*0\.5rem 0\.75rem !important;/g, 'padding: 0.75rem 1rem !important;'],
            
            // Shadows removal
            [/box-shadow:\s*[^!]+!important;/g, 'box-shadow: none !important;'],
            [/box-shadow:\s*[^;]+;/g, 'box-shadow: none;']
        ];

        for (const [pattern, repl] of svelteReplacements) {
            content = content.replace(pattern, repl);
        }

        if (content !== original) {
            fs.writeFileSync(filePath, content);
        }
    }
});

console.log('UI updated: Padding increased and shadows removed.');
