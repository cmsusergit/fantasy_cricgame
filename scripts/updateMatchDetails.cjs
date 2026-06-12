const fs = require('fs');
const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// 1. Update selection grid to 4 columns
content = content.replace(
  /grid-template-columns: repeat\(auto-fit, minmax\(110px, 1fr\)\);/g,
  'grid-template-columns: repeat(4, 1fr);'
);

// 2. Expand details in the Batting Selection list
const oldBatSelection = `<div class="mini-info">
                          <span class="name">{p.name}</span>
                          <span class="stat-badge">Bat: {p.stats.batting}</span>
                       </div>`;
const newBatSelection = `<div class="mini-info">
                          <span class="name">{p.name}</span>
                          <span class="role-desc">{p.role} • {p.battingType || 'RHB'}</span>
                          <span class="stat-badge">Bat: {p.stats.batting}</span>
                          <div class="mini-meters">
                              <div class="meter-bar stamina" style="width: {100 - p.fatigue}%" title="Stamina"></div>
                              <div class="meter-bar morale" style="width: {p.morale}%" title="Morale"></div>
                          </div>
                       </div>`;
content = content.replace(oldBatSelection, newBatSelection);

// 3. Expand details in the Bowling Selection list
const oldBowlSelection = `<div class="mini-info">
                            <span class="name">{p.name}</span>
                            <span class="stat-badge">Bowl: {p.stats.bowling}</span>
                         </div>`;
const newBowlSelection = `<div class="mini-info">
                            <span class="name">{p.name}</span>
                            <span class="role-desc">{p.role} • {p.bowlingType || 'Fast'}</span>
                            <span class="stat-badge">Bowl: {p.stats.bowling}</span>
                            <div class="mini-meters">
                                <div class="meter-bar stamina" style="width: {100 - p.fatigue}%" title="Stamina"></div>
                                <div class="meter-bar morale" style="width: {p.morale}%" title="Morale"></div>
                            </div>
                         </div>`;
content = content.replace(oldBowlSelection, newBowlSelection);

// 4. Expand details in Active Batsman Card
const oldBatsmanInfo = `<div class="b-info-col">
                       <div class="b-name">{p.name} {#if i === 0}<span class="striker-icon" title="On Strike">🏏</span>{/if}</div>
                       <div class="b-style">{p.battingType || 'RHB'}</div>
                       <div class="b-score">{stats.runs} <span class="b-balls">({stats.balls})</span></div>
                       <div class="b-form-bar-container"><div class="b-form-bar" style="width: {p.morale}%"></div></div>
                    </div>`;
const newBatsmanInfo = `<div class="b-info-col">
                       <div class="b-name">{p.name} {#if i === 0}<span class="striker-icon" title="On Strike">🏏</span>{/if}</div>
                       <div class="b-style">{p.battingType || 'RHB'} • {p.battingRole || 'Batsman'}</div>
                       <div class="b-score">{stats.runs} <span class="b-balls">({stats.balls})</span></div>
                       <div class="bw-meters">
                           <div class="meter-row">
                               <span class="meter-label">Stamina</span>
                               <div class="b-meter-container"><div class="b-meter-fill stamina" style="width: {100 - p.fatigue}%"></div></div>
                           </div>
                           <div class="meter-row">
                               <span class="meter-label">Confidence</span>
                               <div class="b-meter-container"><div class="b-meter-fill confidence" style="width: {p.morale}%"></div></div>
                           </div>
                       </div>
                    </div>`;
content = content.replace(oldBatsmanInfo, newBatsmanInfo);

// 5. Expand details in Active Bowler Card
const oldBowlerInfo = `<div class="bw-info-col">
                      <div class="bw-name">{p.name}</div>
                      <div class="bw-style">{p.bowlingType || 'Fast'}</div>
                      <div class="bw-stats">{stats.wickets}-{stats.runs} ({stats.overs})</div>`;
const newBowlerInfo = `<div class="bw-info-col">
                      <div class="bw-name">{p.name}</div>
                      <div class="bw-style">{p.bowlingType || 'Fast'} • {p.role}</div>
                      <div class="bw-stats">{stats.wickets}-{stats.runs} ({stats.overs})</div>`;
content = content.replace(oldBowlerInfo, newBowlerInfo);

// 6. CSS additions for new elements
const extraCSS = `
  .role-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .mini-meters {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 2px;
    margin-top: 6px;
  }
  .meter-bar {
    height: 4px;
    border-radius: 2px;
  }
  .meter-bar.stamina {
    background: #3b82f6;
  }
  .meter-bar.morale {
    background: #a855f7;
  }
`;
content = content.replace('</style>', extraCSS + '\n</style>');

fs.writeFileSync(path, content);
console.log('Match UI Details updated');
