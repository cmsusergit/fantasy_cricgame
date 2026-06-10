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
  avatarStyle: string;
  avatarBg: string;
}

export const FACTIONS: Record<FactionType, Faction> = {
  human: {
    type: 'human',
    name: 'Humans',
    description: 'Balanced all-rounders - baseline faction',
    modifiers: { tech: 1.00, power: 1.00, fatigue: 1.00 },
    baseRisk: 4.4,
    archetype: 'balanced',
    avatarStyle: 'adventurer',
    avatarBg: '0969da' // accent-human
  },
  elf: {
    type: 'elf',
    name: 'Elves',
    description: 'Technical specialists - better technique reduces wickets',
    modifiers: { tech: 1.02, power: 0.95, fatigue: 1.01 },
    baseRisk: 4.4,
    archetype: 'tech',
    avatarStyle: 'lorelei',
    avatarBg: '1a7f37' // accent-elf
  },
  orc: {
    type: 'orc',
    name: 'Orcs',
    description: 'Power hitters - high boundaries but higher wicket risk',
    modifiers: { tech: 0.95, power: 1.15, fatigue: 0.94 },
    baseRisk: 4.4,
    archetype: 'power',
    avatarStyle: 'personas',
    avatarBg: 'cf222e' // accent-orc
  },
  dwarf: {
    type: 'dwarf',
    name: 'Dwarves',
    description: 'Powerful batters - balanced power/technique',
    modifiers: { tech: 0.98, power: 1.10, fatigue: 0.92 },
    baseRisk: 4.4,
    archetype: 'power',
    avatarStyle: 'micah',
    avatarBg: '9a6700' // accent-dwarf
  },
  goblin: {
    type: 'goblin',
    name: 'Goblins',
    description: 'High-risk high-reward - volatile but powerful',
    modifiers: { tech: 0.92, power: 1.18, fatigue: 1.02 },
    baseRisk: 4.4,
    archetype: 'power',
    avatarStyle: 'thumbs',
    avatarBg: '8250df' // accent-goblin
  },
  nightelf: {
    type: 'nightelf',
    name: 'Night Elves',
    description: 'Precise technicians - consistent batting',
    modifiers: { tech: 1.02, power: 0.98, fatigue: 0.92 },
    baseRisk: 4.4,
    archetype: 'tech',
    avatarStyle: 'avataaars',
    avatarBg: '0598bc' // accent-nightelf
  }
};

export function getFactionModifier(faction: FactionType): FactionModifier {
  return FACTIONS[faction].modifiers;
}

export function getFactionArchetype(faction: FactionType): 'balanced' | 'tech' | 'power' {
  return FACTIONS[faction].archetype;
}

const FACTION_PORTRAIT_COUNTS: Record<FactionType, number> = {
  dwarf: 36,
  elf: 16,
  goblin: 25,
  human: 16,
  nightelf: 16,
  orc: 30
};

export function getAvatarUrl(factionType: FactionType, portraitId: number): string {
  const maxCount = FACTION_PORTRAIT_COUNTS[factionType] || 1;
  const localId = (portraitId % maxCount).toString().padStart(3, '0');
  return `/assets/factionportrit/${factionType}/tile${localId}.png`;
}