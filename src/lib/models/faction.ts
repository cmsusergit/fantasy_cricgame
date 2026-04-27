export type FactionType = 'human' | 'elf' | 'orc' | 'dwarf' | 'goblin' | 'nightelf';

export interface FactionModifier {
  tech: number;
  power: number;
  fatigue: number;
}

export interface Faction {
  type: FactionType;
  name: string;
  description: string;
  modifiers: FactionModifier;
  baseRisk: number;
  archetype: 'balanced' | 'tech' | 'power';
}

export const FACTIONS: Record<FactionType, Faction> = {
  human: {
    type: 'human',
    name: 'Humans',
    description: 'Balanced all-rounders - baseline faction',
    modifiers: { tech: 1.00, power: 1.00, fatigue: 1.00 },
    baseRisk: 4.4,
    archetype: 'balanced'
  },
  elf: {
    type: 'elf',
    name: 'Elves',
    description: 'Technical specialists - better technique reduces wickets',
    modifiers: { tech: 1.02, power: 0.95, fatigue: 1.01 },
    baseRisk: 4.4,
    archetype: 'tech'
  },
  orc: {
    type: 'orc',
    name: 'Orcs',
    description: 'Power hitters - high boundaries but higher wicket risk',
    modifiers: { tech: 0.95, power: 1.15, fatigue: 0.94 },
    baseRisk: 4.4,
    archetype: 'power'
  },
  dwarf: {
    type: 'dwarf',
    name: 'Dwarves',
    description: 'Powerful batters - balanced power/technique',
    modifiers: { tech: 0.98, power: 1.10, fatigue: 0.92 },
    baseRisk: 4.4,
    archetype: 'power'
  },
  goblin: {
    type: 'goblin',
    name: 'Goblins',
    description: 'High-risk high-reward - volatile but powerful',
    modifiers: { tech: 0.92, power: 1.18, fatigue: 1.02 },
    baseRisk: 4.4,
    archetype: 'power'
  },
  nightelf: {
    type: 'nightelf',
    name: 'Night Elves',
    description: 'Precise technicians - consistent batting',
    modifiers: { tech: 1.02, power: 0.98, fatigue: 0.92 },
    baseRisk: 4.4,
    archetype: 'tech'
  }
};

export function getFactionModifier(faction: FactionType): FactionModifier {
  return FACTIONS[faction].modifiers;
}

export function getFactionArchetype(faction: FactionType): 'balanced' | 'tech' | 'power' {
  return FACTIONS[faction].archetype;
}