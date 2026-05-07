import fs from 'fs/promises';
import path from 'path';

// Using the background colors we defined for the dark theme in the CSS
const factions = {
  human: { style: 'adventurer', bg: '2c2c2c' }, // generic dark bg
  elf: { style: 'lorelei', bg: '2c2c2c' },
  orc: { style: 'personas', bg: '2c2c2c' },
  dwarf: { style: 'micah', bg: '2c2c2c' },
  goblin: { style: 'thumbs', bg: '2c2c2c' },
  nightelf: { style: 'avataaars', bg: '2c2c2c' }
};

async function downloadImages() {
  const dir = path.join(process.cwd(), 'sample_portraits');
  
  for (const [faction, config] of Object.entries(factions)) {
    for (let i = 1; i <= 5; i++) {
      // Create a unique but consistent seed for each player
      const seed = `${faction}_hero_${i}_seed_abc`;
      
      // Constructing the URL. Adding some parameters like radius to make them circular
      const url = `https://api.dicebear.com/9.x/${config.style}/svg?seed=${seed}&backgroundColor=${config.bg}&radius=50`;
      
      console.log(`Downloading ${faction} avatar ${i}...`);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const svg = await response.text();
        
        await fs.writeFile(path.join(dir, `${faction}_${i}.svg`), svg);
      } catch (err) {
        console.error(`Failed to download ${faction} ${i}:`, err);
      }
    }
  }
  
  // Create an HTML file to easily view the results in the browser
  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Faction Avatar Previews</title>
        <style>
            body { background: #1a1a1a; color: #e0d8c7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; }
            .faction-row { margin-bottom: 40px; }
            .faction-title { border-bottom: 2px solid #554a3f; padding-bottom: 10px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
            .avatar-container { display: flex; gap: 20px; }
            .avatar { width: 120px; height: 120px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
            /* Mocking some of the faction borders from our game */
            .border-human { border: 3px solid #3498db; }
            .border-elf { border: 3px solid #4CAF50; }
            .border-orc { border: 3px solid #e74c3c; }
            .border-dwarf { border: 3px solid #c2b083; }
            .border-goblin { border: 3px solid #9b59b6; }
            .border-nightelf { border: 3px solid #1abc9c; }
        </style>
    </head>
    <body>
        <h1>DiceBear Faction Avatar Previews</h1>
        <p>Testing styles for each of the 6 factions.</p>
  `;

  for (const faction of Object.keys(factions)) {
    html += `<div class="faction-row">
               <h2 class="faction-title">${faction} (${factions[faction].style})</h2>
               <div class="avatar-container">
`;
    for (let i = 1; i <= 5; i++) {
      html += `<img class="avatar border-${faction}" src="${faction}_${i}.svg" alt="${faction} ${i}" />`;
    }
    html += `  </div>
             </div>`;
  }
  html += `</body></html>`;
  
  await fs.writeFile(path.join(dir, 'index.html'), html);
  console.log('\n✅ Done! Open the file at "sample_portraits/index.html" in your browser to view the results.');
}

downloadImages();
