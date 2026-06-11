const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const newCSS = `
  /* New Vertical Layout Styles */
  .match-layout-vertical {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    padding: 16px;
    box-sizing: border-box;
  }
  
  .top-section, .bottom-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .center-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .active-batsmen-row {
    display: flex;
    justify-content: center;
    gap: 24px;
    width: 100%;
  }

  .batsman-card, .bowler-card {
    display: flex;
    background: var(--bg-surface);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 12px;
    gap: 16px;
    min-width: 300px;
    align-items: center;
    transition: box-shadow 0.3s ease, border-color 0.3s ease;
  }
  
  .batsman-card.intent-defensive { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59,130,246,0.3); }
  .batsman-card.intent-balanced { border-color: #fbbf24; box-shadow: 0 0 15px rgba(251,191,36,0.3); }
  .batsman-card.intent-aggressive { border-color: #22c55e; box-shadow: 0 0 15px rgba(34,197,94,0.3); }
  .batsman-card.intent-very_aggressive { border-color: #ef4444; box-shadow: 0 0 15px rgba(239,68,68,0.3); }
  
  .bowler-card.intent-defensive { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59,130,246,0.3); }
  .bowler-card.intent-balanced { border-color: #fbbf24; box-shadow: 0 0 15px rgba(251,191,36,0.3); }
  .bowler-card.intent-aggressive { border-color: #22c55e; box-shadow: 0 0 15px rgba(34,197,94,0.3); }
  .bowler-card.intent-very_aggressive { border-color: #ef4444; box-shadow: 0 0 15px rgba(239,68,68,0.3); }

  .b-avatar-col, .bw-avatar-col {
    position: relative;
    width: 64px;
    height: 64px;
  }

  .avatar-ring {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid var(--text-muted);
    overflow: hidden;
  }

  .player-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .skill-badge {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
    color: white;
    border: 2px solid var(--bg-surface);
  }
  .skill-badge.high { background: #22c55e; }
  .skill-badge.med { background: #f97316; }
  .skill-badge.low { background: #ef4444; }

  .b-info-col, .bw-info-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .b-name, .bw-name { font-weight: bold; font-size: 1.1rem; color: var(--text-primary); }
  .b-style, .bw-style { font-size: 0.8rem; color: var(--text-muted); }
  .b-score { font-size: 1.2rem; font-weight: bold; color: var(--text-primary); }
  .b-balls { font-size: 0.9rem; color: var(--text-muted); font-weight: normal; }

  .b-form-bar-container, .b-meter-container {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 4px;
  }
  .b-form-bar { height: 100%; background: linear-gradient(90deg, #f59e0b, #22c55e); transition: width 0.3s ease; }
  
  .b-meter-fill.stamina { height: 100%; background: #3b82f6; transition: width 0.3s ease; }
  .b-meter-fill.confidence { height: 100%; background: #a855f7; transition: width 0.3s ease; }

  .meter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
  }
  .meter-label { width: 60px; color: var(--text-muted); }
  .b-meter-container { flex: 1; }

  .b-aggression-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .bw-aggression-col.horizontal {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .btn-agg {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  .btn-agg:hover:not(:disabled) { background: var(--color-accent); color: white; }
  .btn-agg:disabled { opacity: 0.5; cursor: not-allowed; }

  .agg-slider-track {
    background: var(--bg-tertiary);
    border-radius: 4px;
    position: relative;
    overflow: hidden;
  }
  .agg-slider-track.vertical { width: 8px; height: 60px; }
  .agg-slider-track.horizontal-track { width: 100px; height: 8px; }

  .agg-slider-fill {
    position: absolute;
    transition: all 0.3s ease;
  }
  .agg-slider-track.vertical .agg-slider-fill {
    bottom: 0;
    left: 0;
    width: 100%;
  }
  .agg-slider-track.horizontal-track .agg-slider-fill {
    top: 0;
    left: 0;
    height: 100%;
  }

  .agg-slider-fill.intent-defensive { background: #3b82f6; }
  .agg-slider-fill.intent-balanced { background: #fbbf24; }
  .agg-slider-fill.intent-aggressive { background: #22c55e; }
  .agg-slider-fill.intent-very_aggressive { background: #ef4444; }

  .agg-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: bold;
    text-align: center;
    width: max-content;
  }

  .scoreboard-main {
    background: var(--bg-surface);
    border-radius: 16px;
    padding: 24px;
    min-width: 400px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .scoreboard-header {
    font-family: 'Cinzel', serif;
    font-size: 1.2rem;
    font-weight: bold;
  }

  .score-display {
    text-align: center;
  }

  .main-score {
    font-size: 3rem;
    font-weight: bold;
    font-family: 'Cinzel', serif;
    color: var(--text-primary);
  }
  
  .main-score .wickets-val { color: var(--color-danger); }
  .main-score .overs-val { font-size: 1.2rem; color: var(--text-muted); font-family: sans-serif; }

  .rates {
    display: flex;
    gap: 16px;
    justify-content: center;
    font-size: 1.1rem;
    color: var(--text-secondary);
  }

  .chase-equation {
    margin-top: 8px;
    font-weight: bold;
    color: var(--warning);
    font-size: 1.1rem;
  }

  .play-controls-row {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .btn-play-pause, .btn-action {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background: var(--color-accent);
    color: white;
    font-weight: bold;
    cursor: pointer;
  }
  .btn-play-pause:hover, .btn-action:hover:not(:disabled) {
    opacity: 0.9;
  }
  .btn-action:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }

  .speed-select {
    padding: 8px;
    border-radius: 8px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .recent-balls-mini {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  
  .active-bowler-row {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  /* Pulse Animations */
  @keyframes pulse1 { 0% { transform: scale(1); } 50% { transform: scale(1.02); } 100% { transform: scale(1); } }
  @keyframes pulse2 { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
  @keyframes pulse3 { 0% { transform: scale(1); } 50% { transform: scale(1.06); } 100% { transform: scale(1); } }
  @keyframes pulse4 { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
  @keyframes pulse5 { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }

  .pulse-anim-1 { animation: pulse1 2s infinite; }
  .pulse-anim-2 { animation: pulse2 2s infinite; }
  .pulse-anim-3 { animation: pulse3 1.5s infinite; }
  .pulse-anim-4 { animation: pulse4 1.5s infinite; }
  .pulse-anim-5 { animation: pulse5 1s infinite; }
  
  /* Selection styling fix */
  .horizontal-list { display: flex; gap: 12px; overflow-x: auto; padding: 8px; justify-content: center; }
  .player-select-btn.mini { flex-direction: column; width: 120px; text-align: center; }
  .player-avatar-mini { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; }
  .mini-info { display: flex; flex-direction: column; gap: 4px; align-items: center; }
`;

content = content.replace('<style>', '<style>\n' + newCSS);
fs.writeFileSync(path, content);
console.log('CSS updated');
