export type InjuryType = 'minor' | 'moderate' | 'severe';
export type BodyPart = 'batting_arm' | 'bowling_arm' | 'leg' | 'back' | 'shoulder';

export interface Injury {
  id: string;
  playerId: string;
  playerName: string;
  type: InjuryType;
  bodyPart: BodyPart;
  name?: string; // e.g. "Hamstring Pull"
  statPenalty: number;
  recoveryDays: number;
  currentDay: number;
  contracted: number;
}

export interface InjuryDetails {
  name: string;
  bodyPart: BodyPart;
  type: InjuryType;
  minMatches: number;
  maxMatches: number;
}

export const COMMON_CRICKET_INJURIES: InjuryDetails[] = [
  { name: 'Hamstring Pull', bodyPart: 'leg', type: 'moderate', minMatches: 2, maxMatches: 4 },
  { name: 'Groin Strain', bodyPart: 'leg', type: 'minor', minMatches: 1, maxMatches: 3 },
  { name: 'Side Strain', bodyPart: 'back', type: 'moderate', minMatches: 3, maxMatches: 5 },
  { name: 'Ankle Sprain', bodyPart: 'leg', type: 'moderate', minMatches: 2, maxMatches: 4 },
  { name: 'Finger Fracture', bodyPart: 'batting_arm', type: 'severe', minMatches: 5, maxMatches: 8 },
  { name: 'Shoulder Dislocation', bodyPart: 'shoulder', type: 'severe', minMatches: 6, maxMatches: 10 },
  { name: 'Back Spasms', bodyPart: 'back', type: 'minor', minMatches: 1, maxMatches: 2 },
  { name: 'Knee Ligament Tear', bodyPart: 'leg', type: 'severe', minMatches: 8, maxMatches: 12 },
  { name: 'Rotator Cuff Strain', bodyPart: 'shoulder', type: 'moderate', minMatches: 3, maxMatches: 5 },
  { name: 'Elbow Tendonitis', bodyPart: 'bowling_arm', type: 'minor', minMatches: 1, maxMatches: 3 }
];

export const INJURY_TYPES: Record<InjuryType, { statPenalty: number; recoveryDays: [number, number] }> = {
  minor: { statPenalty: 2, recoveryDays: [1, 3] },
  moderate: { statPenalty: 5, recoveryDays: [3, 7] },
  severe: { statPenalty: 10, recoveryDays: [7, 14] }
};

export const BODY_PARTS: BodyPart[] = ['batting_arm', 'bowling_arm', 'leg', 'back', 'shoulder'];

export function rollPlayerInjury(player: any): Injury | null {
  const fatigue = player.fatigue || 0;
  const age = player.age || 25;
  
  if (fatigue < 15) return null;
  
  // Players with higher age and high fatigue have a higher chance of injury
  const ageFactor = 1.0 + Math.max(0, age - 22) * 0.05;
  const injuryChance = (fatigue / 100) * 0.06 * ageFactor;
  
  if (Math.random() < injuryChance) {
    const roll = Math.random();
    let type: InjuryType = 'minor';
    if (roll < 0.15) {
      type = 'severe';
    } else if (roll < 0.50) {
      type = 'moderate';
    }
    
    return createCricketInjury(type, player.id, player.name);
  }
  
  return null;
}

function createCricketInjury(type: InjuryType, playerId: string, playerName: string): Injury {
  const possibleInjuries = COMMON_CRICKET_INJURIES.filter(inj => inj.type === type);
  const selected = possibleInjuries[Math.floor(Math.random() * possibleInjuries.length)] || COMMON_CRICKET_INJURIES[0];
  
  const config = INJURY_TYPES[type];
  const recoveryDays = selected.minMatches + Math.floor(Math.random() * (selected.maxMatches - selected.minMatches + 1));
  
  return {
    id: `injury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    playerName,
    type,
    bodyPart: selected.bodyPart,
    name: selected.name,
    statPenalty: config.statPenalty,
    recoveryDays,
    currentDay: 0,
    contracted: Date.now()
  };
}

export function rollForInjury(fatigue: number = 0): Injury | null {
  const roll = Math.random();
  const injuryChance = 0.05 + Math.min(1, fatigue / 100) * 0.45; // 5% base, up to 50% at fatigue 100
  
  if (roll < injuryChance * (1 / 6)) {
    return createInjury('severe');
  } else if (roll < injuryChance * (3 / 6)) {
    return createInjury('moderate');
  } else if (roll < injuryChance) {
    return createInjury('minor');
  }
  
  return null;
}

function createInjury(type: InjuryType): Injury {
  const config = INJURY_TYPES[type];
  const bodyPart = BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];
  const recoveryDays = config.recoveryDays[0] + Math.floor(Math.random() * (config.recoveryDays[1] - config.recoveryDays[0]));
  
  const typePossibleInjuries = COMMON_CRICKET_INJURIES.filter(inj => inj.type === type);
  const selected = typePossibleInjuries[Math.floor(Math.random() * typePossibleInjuries.length)] || { name: 'Muscle Strain' };
  
  return {
    id: `injury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId: '',
    playerName: '',
    type,
    bodyPart,
    name: selected.name,
    statPenalty: config.statPenalty,
    recoveryDays,
    currentDay: 0,
    contracted: Date.now()
  };
}

export function applyInjuryToPlayer(player: any, injury: Injury): any {
  let affectedStat: string = 'batting';
  
  if (injury.bodyPart === 'bowling_arm') {
    affectedStat = 'bowling';
  } else if (injury.bodyPart === 'leg') {
    affectedStat = 'power';
  } else if (injury.bodyPart === 'back') {
    affectedStat = 'technique';
  }
  
  return {
    ...player,
    stats: {
      ...player.stats,
      [affectedStat]: Math.max(1, player.stats[affectedStat] - injury.statPenalty)
    },
    isInjured: true,
    activeInjury: injury
  };
}

export function recoverFromInjury(player: any): any {
  if (!player.activeInjury) return player;
  
  const injury = player.activeInjury;
  let affectedStat: string = 'batting';
  if (injury.bodyPart === 'bowling_arm') affectedStat = 'bowling';
  else if (injury.bodyPart === 'leg') affectedStat = 'power';
  else if (injury.bodyPart === 'back') affectedStat = 'technique';
  
  return {
    ...player,
    stats: {
      ...player.stats,
      [affectedStat]: Math.min(100, (player.stats[affectedStat] || 0) + injury.statPenalty)
    },
    isInjured: false,
    activeInjury: null
  };
}

export function updateInjuryRecovery(injuries: Injury[]): Injury[] {
  return injuries.map(injury => ({
    ...injury,
    currentDay: injury.currentDay + 1
  })).filter(injury => injury.currentDay < injury.recoveryDays);
}

export function getInjuryMessage(injury: Injury, result: 'win' | 'loss'): string {
  const messages: Record<string, string[]> = {
    minor: [
      `${injury.playerName} played through the pain.`,
      `${injury.playerName} felt some discomfort.`
    ],
    moderate: [
      `${injury.playerName} struggled with the injury.`,
      `${injury.playerName} was clearly hampered.`
    ],
    severe: [
      `${injury.playerName} couldn't perform at full capacity.`,
      `${injury.playerName}'s injury showed today.`
    ]
  };
  
  const typeMessages = messages[injury.type];
  if (injury.currentDay >= injury.recoveryDays - 1) {
    return `${injury.playerName} is recovering well and will be back soon!`;
  }
  
  return typeMessages[Math.floor(Math.random() * typeMessages.length)];
}