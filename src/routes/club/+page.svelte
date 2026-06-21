<script lang="ts">
  import { onMount } from 'svelte';
  import { teamStore, saveCurrentGame } from '$lib/stores/gameState';
  import { generateStaffMarket } from '$lib/core/staffSystem';
  import { FACILITY_UPGRADE_COSTS, FACILITY_MAINTENANCE_COSTS } from '$lib/models/staff';
  import type { StaffMember } from '$lib/models/staff';
  
  let teams = $state<any[]>([]);
  let userTeam = $derived(teams.find((t: any) => t.isUserTeam));
  
  let clubBudget = $derived(userTeam?.budget || 0);
  let facilities = $derived(userTeam?.facilities || { stadiumLevel: 1, trainingLevel: 1, medicalLevel: 1 });
  let staff = $derived(userTeam?.staff || []);
  
  let staffMarket = $state<StaffMember[]>([]);
  let message = $state<string>('');
  
  onMount(() => {
    const unsub = teamStore.subscribe(t => {
      teams = t;
    });
    // Generate a fresh market each time the page loads for now
    staffMarket = generateStaffMarket(6);
    return unsub;
  });

  function showMessage(msg: string, duration = 3000) {
    message = msg;
    setTimeout(() => message = '', duration);
  }

  async function handleUpgrade(facility: 'stadium' | 'training' | 'medical') {
    if (!userTeam) return;
    const currentLevel = facilities[`${facility}Level` as keyof typeof facilities];
    if (currentLevel >= 5) {
      showMessage(`Max level reached for ${facility}.`);
      return;
    }
    const cost = FACILITY_UPGRADE_COSTS[facility][currentLevel];
    if (clubBudget >= cost) {
      teamStore.upgradeFacility(userTeam.id, facility, cost);
      await saveCurrentGame(userTeam.budget);
      showMessage(`${facility.charAt(0).toUpperCase() + facility.slice(1)} upgraded to Level ${currentLevel + 1}!`);
    } else {
      showMessage(`Not enough operating budget to upgrade ${facility}. Cost: $${cost.toLocaleString()}`);
    }
  }

  async function handleHire(member: StaffMember) {
    if (!userTeam) return;
    if (clubBudget >= member.hiringCost) {
      teamStore.hireStaff(userTeam.id, member, member.hiringCost);
      staffMarket = staffMarket.filter(s => s.id !== member.id);
      await saveCurrentGame(userTeam.budget);
      showMessage(`${member.name} hired!`);
    } else {
      showMessage(`Not enough budget to hire ${member.name}. Need $${member.hiringCost.toLocaleString()}`);
    }
  }

  async function handleFire(member: StaffMember) {
    if (!userTeam) return;
    const severance = member.salary * 0.25;
    if (clubBudget >= severance) {
      teamStore.fireStaff(userTeam.id, member.id, severance);
      await saveCurrentGame(userTeam.budget);
      showMessage(`${member.name} fired. Paid $${severance.toLocaleString()} severance.`);
    } else {
      showMessage(`Not enough budget to pay severance ($${severance.toLocaleString()}).`);
    }
  }
</script>

<svelte:head>
  <title>Club Management - Fantasy Cricket</title>
</svelte:head>

<div class="club-page">
  <div class="header">
    <h1>🏢 Club Management</h1>
    <p class="subtitle">Upgrade facilities and manage backroom staff.</p>
  </div>
  
  <div class="budget-panel">
    <div class="budget-item">
      <span class="budget-label">Transfer Budget</span>
      <span class="budget-value transfer">${userTeam?.budget.toLocaleString()}</span>
    </div>

  </div>

  {#if message}
    <div class="toast-message">
      {message}
    </div>
  {/if}

  <div class="grid-layout">
    <div class="column">
      <h2>Facilities</h2>
      <div class="facility-grid">
        <div class="facility-card">
          <div class="facility-header">
            <h3>🏟️ Stadium</h3>
            <span class="level-badge">Lvl {facilities.stadiumLevel}</span>
          </div>
          <p class="desc">Increases match-day ticket revenue and sponsorships.</p>
          <p class="cost-info">Maintenance: ${FACILITY_MAINTENANCE_COSTS.stadium[facilities.stadiumLevel - 1].toLocaleString()}/yr</p>
          {#if facilities.stadiumLevel < 5}
            <button class="primary" onclick={() => handleUpgrade('stadium')}>
              Upgrade to Lvl {facilities.stadiumLevel + 1} (${FACILITY_UPGRADE_COSTS.stadium[facilities.stadiumLevel].toLocaleString()})
            </button>
          {:else}
            <button class="secondary" disabled>Max Level</button>
          {/if}
        </div>

        <div class="facility-card">
          <div class="facility-header">
            <h3>🏋️ Training Grounds</h3>
            <span class="level-badge">Lvl {facilities.trainingLevel}</span>
          </div>
          <p class="desc">Improves Youth Academy prospects and XP gains.</p>
          <p class="cost-info">Maintenance: ${FACILITY_MAINTENANCE_COSTS.training[facilities.trainingLevel - 1].toLocaleString()}/yr</p>
          {#if facilities.trainingLevel < 5}
            <button class="primary" onclick={() => handleUpgrade('training')}>
              Upgrade to Lvl {facilities.trainingLevel + 1} (${FACILITY_UPGRADE_COSTS.training[facilities.trainingLevel].toLocaleString()})
            </button>
          {:else}
            <button class="secondary" disabled>Max Level</button>
          {/if}
        </div>

        <div class="facility-card">
          <div class="facility-header">
            <h3>🏥 Medical Center</h3>
            <span class="level-badge">Lvl {facilities.medicalLevel}</span>
          </div>
          <p class="desc">Speeds up injury recovery and reduces fatigue.</p>
          <p class="cost-info">Maintenance: ${FACILITY_MAINTENANCE_COSTS.medical[facilities.medicalLevel - 1].toLocaleString()}/yr</p>
          {#if facilities.medicalLevel < 5}
            <button class="primary" onclick={() => handleUpgrade('medical')}>
              Upgrade to Lvl {facilities.medicalLevel + 1} (${FACILITY_UPGRADE_COSTS.medical[facilities.medicalLevel].toLocaleString()})
            </button>
          {:else}
            <button class="secondary" disabled>Max Level</button>
          {/if}
        </div>
      </div>
    </div>

    <div class="column">
      <h2>Your Staff</h2>
      <div class="staff-grid">
        {#if staff.length === 0}
          <p class="empty-state">No staff members hired.</p>
        {:else}
          {#each staff as member}
            <div class="staff-card tier-{member.tier.toLowerCase()}">
              <div class="staff-info">
                <h4>{member.name}</h4>
                <span class="role">{member.role} ({member.tier})</span>
                <p class="effect">{member.effectDescription}</p>
                <span class="salary">Salary: ${member.salary.toLocaleString()}/yr</span>
              </div>
              <button class="danger" onclick={() => handleFire(member)}>Fire</button>
            </div>
          {/each}
        {/if}
      </div>

      <h2 style="margin-top: 16px;">Job Market</h2>
      <div class="staff-grid">
        {#if staffMarket.length === 0}
          <p class="empty-state">Market is currently empty.</p>
        {:else}
          {#each staffMarket as member}
            <div class="staff-card tier-{member.tier.toLowerCase()}">
              <div class="staff-info">
                <h4>{member.name}</h4>
                <span class="role">{member.role} ({member.tier})</span>
                <p class="effect">{member.effectDescription}</p>
                <div class="costs">
                  <span class="cost">Hire: ${member.hiringCost.toLocaleString()}</span>
                  <span class="salary">Salary: ${member.salary.toLocaleString()}/yr</span>
                </div>
              </div>
              <button class="primary" onclick={() => handleHire(member)}>Hire</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .club-page {
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 60px;
  }
  
  .header {
    margin-bottom: 12px;
  }
  
  .subtitle {
    color: var(--text-secondary);
  }
  
  .budget-panel {
    display: flex;
    gap: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
  }
  
  .budget-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  
  .budget-label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: bold;
  }
  
  .budget-value {
    font-size: 28px;
    font-family: monospace;
    font-weight: 700;
  }
  
  .budget-value.transfer { color: var(--text-primary); }
  .budget-value.operating { color: var(--success); }
  
  .toast-message {
    background: var(--accent-shadow);
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-weight: bold;
    text-align: center;
    animation: fadeInOut 3s forwards;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  
  .grid-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: start;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .facility-grid,
  .staff-grid {
    display: grid;
    gap: 10px;
    align-items: stretch;
  }

  .facility-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .staff-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
  
  .facility-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
  }
  
  .facility-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .facility-header h3 {
    margin: 0;
  }
  
  .level-badge {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
  }
  
  .desc {
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
    min-height: 2.8em;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .cost-info {
    font-size: 12px;
    color: var(--warning);
    margin-bottom: 12px;
  }

  .facility-card button {
    margin-top: auto;
  }
  
  .staff-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    height: 100%;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-left: 4px solid var(--border-color);
    border-radius: 8px;
    padding: 14px;
  }

  .staff-card button {
    align-self: start;
  }
  
  .staff-card.tier-common { border-left-color: #bdc3c7; }
  .staff-card.tier-rare { border-left-color: #3498db; }
  .staff-card.tier-epic { border-left-color: #9b59b6; }
  .staff-card.tier-legendary { border-left-color: #f1c40f; }
  
  .staff-info h4 {
    margin: 0 0 4px 0;
    font-size: 16px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .staff-info .role {
    font-size: 12px;
    color: var(--text-secondary);
    display: block;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .staff-info .effect {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.45;
    margin: 0 0 8px 0;
    min-height: 2.9em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .costs {
    display: flex;
    gap: 10px;
    font-size: 12px;
    flex-wrap: wrap;
  }
  
  .cost { color: var(--danger); }
  .salary { color: var(--warning); }
  
  .empty-state {
    color: var(--text-muted);
    font-style: italic;
  }

  .staff-grid .empty-state {
    grid-column: 1 / -1;
  }

  @media (max-width: 768px) {
    .grid-layout {
      grid-template-columns: 1fr;
    }
    .facility-grid,
    .staff-grid {
      grid-template-columns: 1fr;
    }
    .budget-panel {
      flex-direction: column;
    }
  }
</style>
