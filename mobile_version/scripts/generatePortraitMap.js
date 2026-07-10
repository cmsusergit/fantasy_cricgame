const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets/factionportrit');
const targetFile = path.join(__dirname, '../src/utils/portraitMap.ts');

const factions = ['dwarf', 'elf', 'goblin', 'human', 'nightelf', 'orc'];
let output = `// Auto-generated portrait map for Expo asset compilation. Do not edit manually.
export const PORTRAITS: Record<string, any> = {
`;

factions.forEach(faction => {
  const factionDir = path.join(assetsDir, faction);
  if (fs.existsSync(factionDir)) {
    const files = fs.readdirSync(factionDir).filter(f => f.endsWith('.png'));
    files.forEach(file => {
      const id = file.replace('tile', '').replace('.png', '');
      const key = `${faction}_${id}`;
      output += `  '${key}': require('../../assets/factionportrit/${faction}/${file}'),\n`;
    });
  }
});

output += `};\n\n`;
output += `export function getPortraitAsset(faction: string, portraitId: number): any {\n`;
output += `  const FACTION_PORTRAIT_COUNTS: Record<string, number> = {\n`;
output += `    dwarf: 36,\n`;
output += `    elf: 16,\n`;
output += `    goblin: 16,\n`;
output += `    human: 16,\n`;
output += `    nightelf: 25,\n`;
output += `    orc: 30\n`;
output += `  };\n`;
output += `  const maxCount = FACTION_PORTRAIT_COUNTS[faction] || 1;\n`;
output += `  const localId = (portraitId % maxCount).toString().padStart(3, '0');\n`;
output += `  const key = \`\${faction}_\${localId}\`;\n`;
output += `  return PORTRAITS[key] || PORTRAITS['human_000'];\n`;
output += `}\n`;

fs.writeFileSync(targetFile, output);
console.log('✅ Generated src/utils/portraitMap.ts');
