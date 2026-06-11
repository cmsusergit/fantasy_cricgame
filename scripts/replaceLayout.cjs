const fs = require('fs');

const path = 'src/routes/match/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '<!-- Main Horizontal 3-Pane Match Layout -->';
const endMarker = '    </div>\n  {/if}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf('    </div>\n  {/if}', startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log('Markers not found.');
  process.exit(1);
}

const newLayout = `<!-- Main Vertical Match Layout -->
    <div class="match-layout-vertical">
      
      <!-- TOP PANE: Batting Team Controls -->
      <div class="top-section">
        {#if currentBattingTeam?.id === 'user_team' && (phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman')}
          <!-- selection UI reused from before -->
          <div class="selection-container batting-selection">
             <div class="selection-prompt">{phase === 'selectOpeningBatsmen' ? 'Pick 2 Openers' : 'Pick Next Batsman'}</div>
             <div class="selection-list horizontal-list">
                {#each getAvailableBatsmen() as p}
                   {@const isSelected = selectedBatsmen.includes(p.id)}
                   <button class="player-select-btn mini" class:selected={isSelected} onclick={() => toggleBatsman(p.id)}>
                       <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" />
                       <div class="mini-info">
                          <span class="name">{p.name}</span>
                          <span class="stat-badge">Bat: {p.stats.batting}</span>
                       </div>
                   </button>
                 {/each}
             </div>
             {#if phase === 'selectOpeningBatsmen'}
               <button class="btn-confirm" disabled={selectedBatsmen.length !== 2} onclick={confirmOpeningBatsmen}>Confirm Openers</button>
             {/if}
          </div>
        {:else}
          <div class="active-batsmen-row">
             {#each currentInningsData.currentBatsmen.filter(id => id) as batsmanId}
               {@const p = currentBattingTeam?.players.find(x => x.id === batsmanId)}
               {@const stats = getBatsmanStats(batsmanId)}
               {@const intent = batsmanIntents[batsmanId] || 'balanced'}
               {#if p}
                 <div class="batsman-card intent-{intent}">
                    <div class="b-avatar-col">
                      <div class="avatar-ring">
                        <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                        <div class="skill-badge {p.stats.batting >= 70 ? 'high' : p.stats.batting >= 40 ? 'med' : 'low'}">{p.stats.batting}</div>
                      </div>
                    </div>
                    <div class="b-info-col">
                       <div class="b-name">{p.name}</div>
                       <div class="b-style">{p.battingType || 'RHB'}</div>
                       <div class="b-score">{stats.runs} <span class="b-balls">({stats.balls})</span></div>
                       <div class="b-form-bar-container"><div class="b-form-bar" style="width: {p.morale}%"></div></div>
                    </div>
                    <div class="b-aggression-col">
                       <button class="btn-agg" onclick={() => changeBatsmanIntent(batsmanId, 1)} disabled={!currentBattingTeam?.isUserTeam}>+</button>
                       <div class="agg-slider-track vertical">
                           <div class="agg-slider-fill intent-{intent}" style="height: {(getIntentIndex(intent) / 3) * 100}%"></div>
                       </div>
                       <button class="btn-agg" onclick={() => changeBatsmanIntent(batsmanId, -1)} disabled={!currentBattingTeam?.isUserTeam}>-</button>
                       <div class="agg-label">{INTENT_LABELS[intent]}</div>
                    </div>
                 </div>
               {/if}
             {/each}
          </div>
        {/if}
      </div>
      
      <!-- CENTER PANE: Match Context -->
      <div class="center-section">
        {#if phase === 'ready'}
          <div class="action-panel centered">
            <h2 class="ready-title">Match Ready</h2>
            <button class="btn-start" onclick={startPlay}>▶ Start Match</button>
          </div>
        {:else if phase === 'inningBreak'}
          <div class="action-panel centered">
            <h2 class="break-title">Innings Break</h2>
            <p class="target-text">Target for {matchTeam1?.id === innings2.teamId ? matchTeam1?.name : matchTeam2?.name} is <strong>{target}</strong> runs.</p>
            <button class="btn-start" onclick={startSecondInnings}>▶ Start 2nd Innings</button>
          </div>
        {:else if phase === 'complete'}
          <div class="action-panel centered">
            <h3 class="win-title">{innings2.totalRuns >= target ? getTeamName(innings2.teamId) : getTeamName(innings1.teamId)} Wins!</h3>
            <p class="final-score">{innings1.totalRuns}/{innings1.wickets} <span class="vs">vs</span> {innings2.totalRuns}/{innings2.wickets}</p>
            <button class="btn-primary" onclick={handleGoHome}>Continue to Dashboard</button>
          </div>
        {:else if phase === 'selectOpeningBatsmen' || phase === 'selectNextBatsman' || phase === 'selectOpeningBowler' || phase === 'selectNextBowler'}
          <div class="action-panel centered">
            <h3 style="color: var(--color-accent);">Waiting for Selection...</h3>
          </div>
        {:else}
          <div class="scoreboard-main animated-score">
             <div class="scoreboard-header">
               <span>{currentBattingTeam?.name}</span> <span class="vs">vs</span> <span>{currentBowlingTeam?.name}</span>
             </div>
             <div class="score-display">
                <div class="main-score">
                  <span class="runs-val">{currentInningsData.totalRuns}</span>/<span class="wickets-val">{currentInningsData.wickets}</span>
                  <span class="overs-val">({currentInningsData.overs}.{currentInningsData.balls % 6})</span>
                </div>
                <div class="rates">
                    <span class="crr">CRR: {runRate}</span>
                    {#if currentInnings === 2 && target}
                       <span class="req">Target: {target}</span>
                    {/if}
                </div>
                {#if currentInnings === 2 && target}
                   <div class="chase-equation">Need {target - currentInningsData.totalRuns} from {120 - currentInningsData.balls} balls</div>
                {/if}
             </div>
             
             <div class="play-controls-row">
                 <button class="btn-play-pause" onclick={togglePause}>
                    {phase === 'paused' ? '▶ Play' : '⏸ Pause'}
                 </button>
                 <select class="speed-select" bind:value={gameSpeed}>
                    <option value="ball">Normal Speed</option>
                    <option value="fast">Fast</option>
                    <option value="instant">Instant</option>
                 </select>
                 <button class="btn-action" onclick={playSingleBallAction} disabled={phase !== 'paused'}>Play 1 Ball</button>
             </div>
             
             <!-- Recent Balls -->
             <div class="recent-balls-mini">
                 {#each currentInningsData.ballsFaced.slice(-6) as ball}
                    <div class="bubble {ball.isWicket ? 'wicket' : ball.runs === 4 ? 'four' : ball.runs === 6 ? 'six' : ''}">
                       {ball.isWicket ? 'W' : ball.runs}
                    </div>
                 {/each}
             </div>
          </div>
        {/if}
      </div>

      <!-- BOTTOM PANE: Bowling Controls -->
      <div class="bottom-section">
        {#if currentBowlingTeam?.id === 'user_team' && (phase === 'selectOpeningBowler' || phase === 'selectNextBowler')}
           <div class="selection-container bowling-selection">
              <div class="selection-prompt">Select Bowler</div>
              <div class="selection-list horizontal-list">
                 {#each getAvailableBowlers() as p}
                     <button class="player-select-btn mini" onclick={() => confirmBowler(p.id)}>
                         <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar-mini" />
                         <div class="mini-info">
                            <span class="name">{p.name}</span>
                            <span class="stat-badge">Bowl: {p.stats.bowling}</span>
                         </div>
                     </button>
                  {/each}
              </div>
           </div>
        {:else}
           <div class="active-bowler-row">
              {@const bowlerId = currentLiveBowlerId}
              {@const p = currentBowlingTeam?.players.find(x => x.id === bowlerId)}
              {@const stats = p ? getBowlerStats(p.id) : null}
              {@const intent = bowlerId ? (bowlerIntents[bowlerId] || 'balanced') : 'balanced'}
              
              {#if p && stats}
                <div class="bowler-card intent-{intent}">
                   <div class="bw-avatar-col pulse-anim-{Math.floor(p.morale / 20)}">
                     <img src={getAvatarUrl(p.faction, p.portraitId || 1)} alt={p.name} class="player-avatar" />
                     <div class="skill-badge {p.stats.bowling >= 70 ? 'high' : p.stats.bowling >= 40 ? 'med' : 'low'}">{p.stats.bowling}</div>
                   </div>
                   <div class="bw-info-col">
                      <div class="bw-name">{p.name}</div>
                      <div class="bw-style">{p.bowlingType || 'Fast'}</div>
                      <div class="bw-stats">{stats.wickets}-{stats.runs} ({stats.overs})</div>
                      
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
                   </div>
                   <div class="bw-aggression-col horizontal">
                      <div class="agg-label">{INTENT_LABELS[intent]}</div>
                      <button class="btn-agg" onclick={() => changeBowlerIntent(p.id, -1)} disabled={!currentBowlingTeam?.isUserTeam}>-</button>
                      <div class="agg-slider-track horizontal-track">
                          <div class="agg-slider-fill intent-{intent}" style="width: {(getIntentIndex(intent) / 3) * 100}%"></div>
                      </div>
                      <button class="btn-agg" onclick={() => changeBowlerIntent(p.id, 1)} disabled={!currentBowlingTeam?.isUserTeam}>+</button>
                   </div>
                </div>
              {/if}
           </div>
        {/if}
      </div>`;

content = content.substring(0, startIndex) + newLayout + content.substring(endIndex);
fs.writeFileSync(path, content);
console.log('Layout replaced');
