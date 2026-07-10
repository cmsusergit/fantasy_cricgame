export type TrainingType = 'batting' | 'bowling' | 'power' | 'technique';

export interface TrainingSession {
  playerId: string;
  type: TrainingType;
  cost: number;
  statGain: number;
  date: number;
}

export interface TrainingLabConfig {
  baseCost: number;
  statGain: number;
  maxLevel: number;
}

export const TRAINING_CONFIG: Record<TrainingType, TrainingLabConfig> = {
  batting: {
    baseCost: 15000,
    statGain: 2,
    maxLevel: 20
  },
  bowling: {
    baseCost: 15000,
    statGain: 2,
    maxLevel: 20
  },
  power: {
    baseCost: 15000,
    statGain: 2,
    maxLevel: 20
  },
  technique: {
    baseCost: 15000,
    statGain: 2,
    maxLevel: 20
  }
};

export function calculateTrainingCost(
  currentStat: number,
  trainingType: TrainingType
): number {
  const config = TRAINING_CONFIG[trainingType];
  const level = Math.floor(currentStat / 5);
  const levelMultiplier = 1 + (level * 0.1);
  return Math.floor(config.baseCost * levelMultiplier);
}

export function trainPlayer(
  player: any,
  trainingType: TrainingType
): { success: boolean; newStat: number; cost: number; message: string } {
  const config = TRAINING_CONFIG[trainingType];
  
  if (player.stats[trainingType] >= config.maxLevel * 5) {
    return {
      success: false,
      newStat: player.stats[trainingType],
      cost: 0,
      message: `${player.name} has reached maximum ${trainingType} level!`
    };
  }
  
  const cost = calculateTrainingCost(player.stats[trainingType], trainingType);
  
  return {
    success: true,
    newStat: player.stats[trainingType] + config.statGain,
    cost: cost,
    message: `${player.name} gained +${config.statGain} ${trainingType}!`
  };
}

export function getTrainingOptions(player: any): Array<{
  type: TrainingType;
  cost: number;
  currentStat: number;
  newStat: number;
}> {
  const options: Array<{
    type: TrainingType;
    cost: number;
    currentStat: number;
    newStat: number;
  }> = [];
  
  const statMap: Record<string, TrainingType> = {
    batting: 'batting',
    bowling: 'bowling',
    power: 'power',
    technique: 'technique'
  };
  
  for (const [stat, type] of Object.entries(statMap)) {
    if (player.stats[stat] !== undefined) {
      const current = player.stats[stat];
      const cost = calculateTrainingCost(current, type);
      const config = TRAINING_CONFIG[type];
      
      options.push({
        type,
        cost,
        currentStat: current,
        newStat: Math.min(current + config.statGain, config.maxLevel * 5)
      });
    }
  }
  
  return options;
}