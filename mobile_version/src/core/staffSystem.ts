import type { StaffMember, StaffRole, StaffTier } from '../models/staff';
import type { FactionType } from '../models/faction';

const STAFF_FIRST_NAMES: Record<FactionType, string[]> = {
  human: ['Coach', 'Dr.', 'Master', 'Sir', 'Madam'],
  elf: ['Elder', 'Keeper', 'Guide', 'Seer', 'Healer'],
  orc: ['Boss', 'Chief', 'Warlord', 'Shaman', 'Bloodletter'],
  dwarf: ['Foreman', 'Master', 'Elder', 'Smith', 'Stoneshaper'],
  goblin: ['Chief', 'Doc', 'Tinker', 'Sneak', 'Fixer'],
  nightelf: ['Shadow', 'Nightlord', 'Moon', 'Star', 'Dusk']
};

const STAFF_LAST_NAMES = ['Smith', 'Storm', 'Stone', 'Leaf', 'Fire', 'Shadow', 'Gear', 'Brew', 'Ward', 'Heart'];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStaffName(faction: FactionType): string {
  const first = randomElement(STAFF_FIRST_NAMES[faction]) || 'Coach';
  const last = randomElement(STAFF_LAST_NAMES);
  return `${first} ${last}`;
}

export function generateStaffMarket(count: number = 5): StaffMember[] {
  const market: StaffMember[] = [];
  const roles: StaffRole[] = ['Head Coach', 'Physiotherapist', 'Batting Consultant', 'Bowling Consultant'];
  const factions: FactionType[] = ['human', 'elf', 'orc', 'dwarf', 'goblin', 'nightelf'];
  
  for (let i = 0; i < count; i++) {
    const role = randomElement(roles);
    const faction = randomElement(factions);
    
    // Determine tier
    const roll = Math.random();
    let tier: StaffTier = 'Common';
    let salaryBase = 50000;
    
    if (roll > 0.95) { tier = 'Legendary'; salaryBase = 500000; }
    else if (roll > 0.85) { tier = 'Epic'; salaryBase = 250000; }
    else if (roll > 0.50) { tier = 'Rare'; salaryBase = 100000; }

    const salary = salaryBase + randomInt(-salaryBase * 0.1, salaryBase * 0.1);
    const hiringCost = salary * 0.5;

    let effectDescription = '';
    if (role === 'Head Coach') effectDescription = `${tier} Morale Boost & Form Recovery`;
    if (role === 'Physiotherapist') effectDescription = `${tier} Fatigue Reduction & Injury Healing`;
    if (role === 'Batting Consultant') effectDescription = `${tier} Batting XP Bonus`;
    if (role === 'Bowling Consultant') effectDescription = `${tier} Bowling XP Bonus`;

    market.push({
      id: `staff_${Date.now()}_${randomInt(1000, 9999)}`,
      name: generateStaffName(faction),
      role,
      tier,
      faction,
      salary: Math.floor(salary),
      hiringCost: Math.floor(hiringCost),
      effectDescription
    });
  }
  return market;
}
