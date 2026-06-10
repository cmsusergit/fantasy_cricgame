<script lang="ts">
  import { goto } from '$app/navigation';
  import { gamePhase } from '$lib/stores/gameState';

  let activeTopic = $state('basics');

  const topics = [
    { id: 'basics', title: 'The Basics' },
    { id: 'economy', title: 'The Economy' },
    { id: 'intent', title: 'Match Tactics & Intent' },
    { id: 'factions', title: 'Faction Synergies' },
    { id: 'club', title: 'Club Facilities & Staff' }
  ];

  function handleCloseGuide() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goto('/');
    }
  }
</script>

<svelte:head>
  <title>Manager's Guide - Fantasy Cricket</title>
</svelte:head>

<div class="guide-page">
  <div class="header" style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <h1>📖 Manager's Guidebook</h1>
      <p class="subtitle">Master the art of fantasy cricket management.</p>
    </div>
    <button class="close-guide-btn" onclick={handleCloseGuide}>
      Close Guide
    </button>
  </div>

  <div class="guide-layout">
    <div class="sidebar">
      <h3>Topics</h3>
      <nav>
        {#each topics as topic}
          <button class="topic-btn" class:active={activeTopic === topic.id} onclick={() => activeTopic = topic.id}>
            {topic.title}
          </button>
        {/each}
      </nav>
    </div>

    <div class="content-pane">
      {#if activeTopic === 'basics'}
        <h2>The Basics</h2>
        <p>Welcome to Fantasy CricManager! In this game, you take on the role of a general manager and coach for a fantasy cricket franchise.</p>
        
        <h3>The Core Loop</h3>
        <ol>
          <li><strong>Build a Squad:</strong> Use your transfer budget in the Auction Room to acquire players from 6 different fantasy races (Humans, Elves, Orcs, Dwarves, Goblins, Night Elves).</li>
          <li><strong>Manage Your Club:</strong> Hire specialized staff and upgrade your stadium to boost your income and stats.</li>
          <li><strong>Set Your Tactics:</strong> Before and during matches, set your batting and bowling "Intent" to control risk vs reward.</li>
          <li><strong>Win the Tournament:</strong> Compete in a double round-robin league and try to top the standings!</li>
        </ol>

        <p class="pro-tip"><em>Tip: Building a balanced squad with different factions is key to long-term success. Don't just draft Orcs or you'll leak too many runs!</em></p>

      {:else if activeTopic === 'economy'}
        <h2>The Economy</h2>
        <p>Your club's finances are split into two distinct budgets to prevent you from bankrupting the club on player salaries.</p>

        <h3>💰 Transfer Budget</h3>
        <p>This is your primary war chest. It is strictly used for:</p>
        <ul>
          <li>Bidding on players in the live auction.</li>
          <li>Paying player salaries.</li>
          <li>Sending scouts to find youth players.</li>
        </ul>
        <p>You can earn more Transfer Budget through Match Fees, Win Bonuses, and Sponsorships.</p>

        <h3>🏢 Operating Budget</h3>
        <p>This budget manages your club's infrastructure and personnel. It is used for:</p>
        <ul>
          <li>Hiring Head Coaches, Physios, and Consultants.</li>
          <li>Upgrading your Stadium, Training Grounds, and Medical Center.</li>
        </ul>
        <p>Operating Budget is primarily earned through <strong>Ticket Sales</strong> when you host a home match. The higher your Stadium Level, the more you earn!</p>

      {:else if activeTopic === 'intent'}
        <h2>Match Tactics & Intent</h2>
        <p>During a match, you have access to Intent sliders. These sliders are your primary tactical tool, drastically affecting the probability of boundaries and wickets.</p>

        <h3>🏏 Batting Intent</h3>
        <p>Controls your batsman's aggression:</p>
        <ul>
          <li><strong>Very Defensive / Defensive:</strong> Reduces your chance of getting out, but makes hitting boundaries very difficult. Focuses on singles and surviving.</li>
          <li><strong>Balanced:</strong> Standard risk and reward.</li>
          <li><strong>Aggressive / Very Aggressive:</strong> Greatly increases the chance of hitting a Four or a Six, but drastically multiplies your chance of losing a wicket.</li>
        </ul>

        <h3>🎯 Bowling Intent</h3>
        <p>Controls your bowler's effort and line:</p>
        <ul>
          <li><strong>Defensive:</strong> Focuses on a tight line and length to restrict scoring. Reduces boundary probability but also lowers wicket-taking threat.</li>
          <li><strong>Balanced:</strong> Standard delivery.</li>
          <li><strong>Aggressive:</strong> Sets attacking fields and bowls aggressive lines to hunt for wickets. Increases wicket chance but also increases the chance of being hit for boundaries and bowling wides.</li>
        </ul>

      {:else if activeTopic === 'factions'}
        <h2>Faction Synergies</h2>
        <p>The smartest managers pair their tactical Intent with the correct Faction to trigger powerful synergies.</p>

        <div class="faction-grid">
          <div class="faction-card">
            <h4>🧝 Elves (Masterful Defense)</h4>
            <p><strong>Batting:</strong> When batting with <em>Defensive</em> intent, an Elf's wicket chance drops drastically. They are the ultimate anchors.</p>
          </div>
          <div class="faction-card">
            <h4>🪓 Orcs (Brutal Aggression)</h4>
            <p><strong>Batting:</strong> When batting with <em>Aggressive</em> intent, they receive a massive bonus to boundary hitting.</p>
            <p><strong>Bowling:</strong> When bowling <em>Aggressive</em>, their threat spikes, but their chance of bowling wides is doubled.</p>
          </div>
          <div class="faction-card">
            <h4>⚔️ Humans (Tactical Discipline)</h4>
            <p><strong>Batting:</strong> Gain a stability bonus when batting with <em>Balanced</em> intent.</p>
            <p><strong>Bowling:</strong> Exceptional at restricting boundaries when bowling <em>Balanced/Defensive</em> in the first 6 overs.</p>
          </div>
          <div class="faction-card">
            <h4>⛏️ Dwarves (Unbreakable)</h4>
            <p><strong>Batting:</strong> Ignore all fatigue penalties when batting <em>Aggressive</em> in the last 4 overs (Death Overs).</p>
            <p><strong>Bowling:</strong> Do not suffer extra stamina drain when bowling aggressively.</p>
          </div>
          <div class="faction-card">
            <h4>💎 Goblins (Deceptive Tricksters)</h4>
            <p><strong>Batting:</strong> When playing <em>Defensive</em>, dot balls are frequently converted into stolen singles.</p>
            <p><strong>Bowling:</strong> Goblin spinners bowling <em>Aggressive</em> get a massive wicket spike, but high No-Ball risk.</p>
          </div>
          <div class="faction-card">
            <h4>🌙 Night Elves (Shadow Assassins)</h4>
            <p><strong>Batting:</strong> When batting <em>Aggressive</em>, their boundary chance scales with Technique instead of Power, lowering risk.</p>
            <p><strong>Bowling:</strong> Receive a flat 15% boost to their bowling stats during the final 4 overs (Death Overs).</p>
          </div>
        </div>

      {:else if activeTopic === 'club'}
        <h2>Club Facilities & Staff</h2>
        <p>Visit the Club Management page to invest your Operating Budget into long-term upgrades.</p>

        <h3>Facilities (Up to Level 5)</h3>
        <ul>
          <li><strong>Stadium:</strong> Crucial for economy. Higher levels drastically increase your Ticket Sales revenue for home matches.</li>
          <li><strong>Training Grounds:</strong> Improves the base stats of youth players generated by your academy.</li>
          <li><strong>Medical Center:</strong> Reduces the maximum duration of random injuries generated during matches.</li>
        </ul>

        <h3>Backroom Staff</h3>
        <p>Hire staff from the Job Market. Each staff member demands a salary and provides passive team-wide buffs based on their rarity (Common to Legendary) and role.</p>
        <ul>
          <li><strong>Head Coach:</strong> Boosts morale recovery and form.</li>
          <li><strong>Physiotherapist:</strong> Reduces fatigue buildup and speeds up healing.</li>
          <li><strong>Consultants:</strong> Provide permanent stat XP boosts at the end of a season.</li>
        </ul>
      {/if}
    </div>
  </div>
</div>

<style>
  .guide-page {
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 60px;
  }
  
  .header {
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
  }
  
  .subtitle {
    color: var(--text-secondary);
  }
  
  .guide-layout {
    display: flex;
    gap: 10px;
  }
  
  .sidebar {
    width: 250px;
    flex-shrink: 0;
  }
  
  .sidebar h3 {
    margin-bottom: 12px;
    text-transform: uppercase;
    font-size: 14px;
    letter-spacing: 1px;
    color: var(--text-muted);
  }
  
  .sidebar nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .topic-btn {
    text-align: left;
    padding: 16px 20px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-left-width: 4px;
    border-left-color: transparent;
    color: var(--text-primary);
    border-radius: 6px;
    transition: all 0.2s ease;
  }
  
  .topic-btn:hover {
    background: var(--bg-secondary);
    border-left-color: var(--text-secondary);
  }
  
  .topic-btn.active {
    background: var(--bg-secondary);
    border-left-color: var(--success);
    font-weight: 600;
  }
  
  .content-pane {
    flex: 1;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
    line-height: 1.6;
  }

  .content-pane h2 {
    margin-bottom: 12px;
    color: var(--accent-gold);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .content-pane h3 {
    margin-top: 12px;
    margin-bottom: 12px;
    color: var(--text-primary);
  }

  .content-pane p {
    margin-bottom: 12px;
    color: var(--text-primary);
  }

  .content-pane ul, .content-pane ol {
    margin-bottom: 12px;
    padding-left: 24px;
  }

  .content-pane li {
    margin-bottom: 8px;
  }

  .pro-tip {
    padding: 14px;
    background: rgba(35, 134, 54, 0.1);
    border-left: 4px solid var(--success);
    border-radius: 4px;
    margin-top: 12px;
  }

  .faction-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }

  .faction-card {
    background: var(--bg-tertiary);
    padding: 14px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .faction-card h4 {
    margin-bottom: 8px;
    color: var(--accent-gold);
  }

  .faction-card p {
    font-size: 14px;
    margin-bottom: 8px;
  }

  .close-guide-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 10px 20px;
    font-size: 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .close-guide-btn:hover {
    background: var(--success);
    color: white;
    border-color: var(--success);
  }

  @media (max-width: 768px) {
    .guide-layout {
      flex-direction: column;
    }
    .sidebar {
      width: 100%;
    }
    .faction-grid {
      grid-template-columns: 1fr;
    }
  }
</style>