export type InjuryType = 'minor' | 'moderate' | 'severe';
export type BodyPart = 'batting_arm' | 'bowling_arm' | 'leg' | 'back' | 'shoulder';

export interface Injury {
  id: string;
  playerId: string;
  playerName: string;
  type: InjuryType;
  bodyPart: BodyPart;
  statPenalty: number;
  recoveryDays: number;
  currentDay: number;
  contracted: number;
}

export const INJURY_TYPES: Record<InjuryType, { statPenalty: number; recoveryDays: [number, number] }> = {
  minor: { statPenalty: 2, recoveryDays: [1, 3] },
  moderate: { statPenalty: 5, recoveryDays: [3, 7] },
  severe: { statPenalty: 10, recoveryDays: [7, 14] }
};

export const BODY_PARTS: BodyPart[] = ['batting_arm', 'bowling_arm', 'leg', 'back', 'shoulder'];

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
  
  return {
    id: `injury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId: '',
    playerName: '',
    type,
    bodyPart,
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