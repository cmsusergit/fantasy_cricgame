export type SponsorshipType = 'performance' | 'bonus' | 'hybrid';

export interface SponsorshipContract {
  id: string;
  sponsorName: string;
  type: SponsorshipType;
  bonusAmount: number;
  performanceBonus: number;
  matches: number;
  matchesPlayed: number;
  earned: number;
  active: boolean;
}

export const SPONSORS = [
  { name: 'Orca Cola', minBudget: 10000, type: 'bonus' as SponsorshipType },
  { name: 'Dwarf Mining Co.', minBudget: 15000, type: 'performance' as SponsorshipType },
  { name: 'Elven Airways', minBudget: 20000, type: 'hybrid' as SponsorshipType },
  { name: 'Goblin Gadgets', minBudget: 8000, type: 'bonus' as SponsorshipType },
  { name: 'Night Elf Insurance', minBudget: 25000, type: 'performance' as SponsorshipType },
  { name: 'Human Healthcare', minBudget: 18000, type: 'hybrid' as SponsorshipType }
];

export function generateSponsorship(teamBudget: number): SponsorshipContract {
  const availableSponsors = SPONSORS.filter(s => s.minBudget <= teamBudget);
  const sponsor = availableSponsors[Math.floor(Math.random() * availableSponsors.length)];
  
  const baseMatchWorth = Math.floor(teamBudget / 10);
  
  return {
    id: `sponsor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sponsorName: sponsor.name,
    type: sponsor.type,
    bonusAmount: sponsor.type === 'bonus' ? baseMatchWorth * 2 : baseMatchWorth,
    performanceBonus: sponsor.type === 'performance' ? baseMatchWorth : baseMatchWorth * 0.5,
    matches: Math.floor(5 + Math.random() * 10),
    matchesPlayed: 0,
    earned: 0,
    active: true
  };
}

export function calculateSponsorshipEarnings(
  contract: SponsorshipContract,
  matchResult: 'win' | 'loss' | 'draw',
  runsScored: number,
  wicketsTaken: number
): number {
  if (!contract.active) return 0;
  
  let earnings = 0;
  
  if (contract.type === 'bonus') {
    earnings = contract.bonusAmount;
  } else if (contract.type === 'performance') {
    earnings = contract.performanceBonus;
    if (matchResult === 'win') earnings *= 1.5;
    if (matchResult === 'loss') earnings *= 0.5;
    earnings += (runsScored / 10);
    earnings += (wicketsTaken * 5);
  } else {
    const performance = contract.performanceBonus * 0.5;
    const bonus = contract.bonusAmount * 0.5;
    earnings = matchResult === 'win' ? bonus + performance : bonus + (performance * 0.3);
  }
  
  return Math.floor(earnings);
}

export function updateSponsorship(contract: SponsorshipContract, earnings: number): SponsorshipContract {
  const newMatches = contract.matchesPlayed + 1;
  const newEarned = contract.earned + earnings;
  const stillActive = newMatches < contract.matches;
  
  return {
    ...contract,
    matchesPlayed: newMatches,
    earned: newEarned,
    active: stillActive
  };
}

export function getSponsorshipValue(contract: SponsorshipContract): number {
  if (!contract.active) return 0;
  
  let totalPotential = 0;
  const remaining = contract.matches - contract.matchesPlayed;
  
  if (contract.type === 'bonus') {
    totalPotential = remaining * contract.bonusAmount;
  } else if (contract.type === 'performance') {
    totalPotential = remaining * contract.performanceBonus * 1.2;
  } else {
    totalPotential = remaining * (contract.bonusAmount + contract.performanceBonus) * 0.75;
  }
  
  return Math.floor(totalPotential);
}