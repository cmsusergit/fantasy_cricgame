import type { FactionType } from './faction';

export type StaffRole = 'Head Coach' | 'Physiotherapist' | 'Batting Consultant' | 'Bowling Consultant';
export type StaffTier = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  tier: StaffTier;
  faction: FactionType;
  salary: number; // Cost per season
  hiringCost: number; // One-time cost
  effectDescription: string;
}

export interface TeamFacilities {
  stadiumLevel: number; // 1-5
  trainingLevel: number; // 1-5
  medicalLevel: number; // 1-5
}

export const FACILITY_UPGRADE_COSTS = {
  stadium: [0, 500000, 1500000, 3000000, 6000000],
  training: [0, 300000, 800000, 2000000, 4000000],
  medical: [0, 200000, 600000, 1500000, 3000000],
};

export const FACILITY_MAINTENANCE_COSTS = {
  stadium: [10000, 50000, 150000, 300000, 600000],
  training: [5000, 30000, 80000, 200000, 400000],
  medical: [5000, 20000, 60000, 150000, 300000],
};
