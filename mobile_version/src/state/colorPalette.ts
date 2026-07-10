import type { Player } from '../models/player';

export interface TeamColorPalette {
  primary: string;
  secondary: string;
  primaryRgb: string;
  secondaryRgb: string;
}

export const TEAM_COLORS: TeamColorPalette[] = [
  { primary: '#1e40af', secondary: '#fbbf24', primaryRgb: '30, 64, 175', secondaryRgb: '251, 191, 36' },
  { primary: '#dc2626', secondary: '#f59e0b', primaryRgb: '220, 38, 38', secondaryRgb: '245, 158, 11' },
  { primary: '#059669', secondary: '#6366f1', primaryRgb: '5, 150, 105', secondaryRgb: '99, 102, 241' },
  { primary: '#7c3aed', secondary: '#ec4899', primaryRgb: '124, 58, 237', secondaryRgb: '236, 72, 153' },
  { primary: '#ea580c', secondary: '#1e293b', primaryRgb: '234, 88, 12', secondaryRgb: '30, 41, 59' },
  { primary: '#0891b2', secondary: '#f97316', primaryRgb: '8, 145, 178', secondaryRgb: '249, 115, 22' },
  { primary: '#be185d', secondary: '#14b8a6', primaryRgb: '190, 24, 93', secondaryRgb: '20, 184, 166' },
  { primary: '#4f46e5', secondary: '#a855f7', primaryRgb: '79, 70, 229', secondaryRgb: '168, 85, 247' },
];

export function selectInitialPlaying11(players: Player[]): { playing11: string[], captain: string, wicketKeeper: string, reservePlayer?: string } {
  const batsmen = [...players].filter(p => p.role === 'batsman').sort((a, b) => b.stats.batting - a.stats.batting);
  const wks = [...players].filter(p => p.role === 'wicketkeeper').sort((a, b) => b.stats.batting - a.stats.batting);
  const allrounders = [...players].filter(p => p.role === 'allrounder').sort((a, b) => (b.stats.batting + b.stats.bowling) - (a.stats.batting + a.stats.bowling));
  const bowlers = [...players].filter(p => p.role === 'bowler').sort((a, b) => b.stats.bowling - a.stats.bowling);

  // Balanced 11: 4 Batsmen, 1 Wicketkeeper, 2 All-rounders, 4 Bowlers
  const selectedWk = wks[0];
  const selectedBatsmen = batsmen.slice(0, 4);
  const selectedArs = allrounders.slice(0, 2);
  const selectedBowlers = bowlers.slice(0, 4);

  const playing11Players = [
    ...selectedBatsmen,
    selectedWk,
    ...selectedArs,
    ...selectedBowlers
  ].filter(Boolean);

  // Fallback if needed to reach 11
  while (playing11Players.length < 11 && playing11Players.length < players.length) {
    const remaining = players.filter(p => !playing11Players.some(sel => sel.id === p.id));
    if (remaining.length === 0) break;
    remaining.sort((a, b) => Math.max(b.stats.batting, b.stats.bowling) - Math.max(a.stats.batting, a.stats.bowling));
    playing11Players.push(remaining[0]);
  }

  const playing11 = playing11Players.map(p => p.id);

  // Choose Captain: prioritize isCaptain flag, otherwise highest overall skill
  let captain = playing11Players.find(p => p.special?.isCaptain)?.id;
  if (!captain) {
    const sortedBySkill = [...playing11Players].sort((a, b) => 
      Math.max(b.stats.batting, b.stats.bowling) - Math.max(a.stats.batting, a.stats.bowling)
    );
    captain = sortedBySkill[0]?.id || playing11[0];
  }

  // Choose WicketKeeper
  const wicketKeeper = selectedWk?.id || playing11Players.find(p => p.special?.isWicketKeeper)?.id || playing11[0];

  // Nominate 1 reserve player from those not in starting 11
  const reserveCandidates = players.filter(p => !playing11.includes(p.id));
  const reservePlayer = reserveCandidates[0]?.id;

  return { playing11, captain, wicketKeeper, reservePlayer };
}
