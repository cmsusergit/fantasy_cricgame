const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const oldControls = `<div class="play-controls-row">
                 <button class="btn-play-pause" onclick={togglePause}>
                    {phase === 'paused' ? '▶ Play' : '⏸ Pause'}
                 </button>
                 <select class="speed-select" bind:value={gameSpeed}>
                    <option value="ball">Normal Speed</option>
                    <option value="fast">Fast</option>
                    <option value="instant">Instant</option>
                 </select>
                 <button class="btn-action" onclick={playSingleBallAction} disabled={phase !== 'paused'}>Play 1 Ball</button>
             </div>`;

const newControls = `<div class="slick-controls">
                <div class="control-group">
                   <button class="slick-btn icon {phase === 'playing' ? 'active' : ''}" onclick={togglePause} title={phase === 'paused' ? 'Play' : 'Pause'}>
                      {phase === 'paused' ? '▶' : '⏸'}
                   </button>
                   <button class="slick-btn icon" onclick={playSingleBallAction} disabled={phase !== 'paused'} title="Play 1 Ball">
                      +1
                   </button>
                </div>
                <div class="control-group">
                   <button class="slick-btn {gameSpeed === 'ball' ? 'active' : ''}" onclick={() => gameSpeed = 'ball'}>1x</button>
                   <button class="slick-btn {gameSpeed === 'fast' ? 'active' : ''}" onclick={() => gameSpeed = 'fast'}>2x</button>
                   <button class="slick-btn {gameSpeed === 'instant' ? 'active' : ''}" onclick={() => gameSpeed = 'instant'}>Max</button>
                </div>
                <div class="control-group">
                   <button class="slick-btn" onclick={() => handleSimulateTarget({type: 'over'})} title="Simulate Over">Ov</button>
                   <button class="slick-btn" onclick={() => handleSimulateTarget({type: 'wicket'})} title="Simulate to Wicket">Wk</button>
                   <button class="slick-btn" onclick={() => handleSimulateTarget({type: 'innings'})} title="Simulate Innings">Inn</button>
                </div>
             </div>`;

content = content.replace(oldControls, newControls);

const oldCSS = `.play-controls-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }

  .btn-play-pause, .btn-action {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: var(--color-accent);
    color: white;
    font-weight: bold;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .btn-play-pause:hover, .btn-action:hover:not(:disabled) {
    opacity: 0.9;
  }
  .btn-action:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }

  .speed-select {
    padding: 6px;
    border-radius: 6px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    font-size: 0.9rem;
  }`;

const newCSS = `.slick-controls {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-top: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .control-group {
    display: flex;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .slick-btn {
    background: transparent;
    border: none;
    border-right: 1px solid var(--border-color);
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .slick-btn:last-child {
    border-right: none;
  }

  .slick-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.05);
    color: var(--text-primary);
  }

  .slick-btn.active {
    background: var(--color-batting);
    color: var(--bg-surface);
  }

  .slick-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .slick-btn.icon {
    font-size: 1rem;
    padding: 4px 12px;
  }`;

content = content.replace(oldCSS, newCSS);

fs.writeFileSync(path, content);
console.log('Match controls updated');
