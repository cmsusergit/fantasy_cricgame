import type { Player } from '../models/player';
import type { Team } from '../models/team';

export interface FanProfile {
  homeAdvantage: number;
  popularity: number;
  revenue: number;
  matchBonus: number;
}

export function initializeFanProfile(): FanProfile {
  return {
    homeAdvantage: 0,
    popularity: 50,
    revenue: 0,
    matchBonus: 0
  };
}

export function updatePopularity(
  current: number,
  matchResult: 'win' | 'loss' | 'draw',
  performance: number
): number {
  let change = 0;
  
  if (matchResult === 'win') {
    change = 3 + Math.floor(performance / 10);
  } else if (matchResult === 'draw') {
    change = 1;
  } else {
    change = -2;
  }
  
  return Math.max(0, Math.min(100, current + change));
}

export function calculateHomeAdvantage(popularity: number): number {
  return Math.floor(popularity / 20);
}

export function calculateMatchRevenue(
  popularity: number,
  matchResult: 'win' | 'loss' | 'draw',
  ticketPrice: number,
  attendance: number
): number {
  const baseRevenue = ticketPrice * attendance;
  const popularityMultiplier = 1 + (popularity / 200);
  const resultMultiplier = matchResult === 'win' ? 1.3 : matchResult === 'draw' ? 1.0 : 0.8;
  
  return Math.floor(baseRevenue * popularityMultiplier * resultMultiplier);
}

export function getPopularityTier(popularity: number): string {
  if (popularity >= 80) return 'Legendary';
  if (popularity >= 60) return 'Popular';
  if (popularity >= 40) return 'Average';
  if (popularity >= 20) return 'Low';
  return 'Unknown';
}

export function getHomeAdvantageDescription(advantage: number): string {
  if (advantage >= 4) return 'Massive home advantage';
  if (advantage >= 2) return 'Strong home support';
  if (advantage >= 1) return 'Minor home advantage';
  return 'Neutral venue';
}

export function getCrowdFavourites(team: Team, count: number = 3): Player[] {
  if (!team.players || team.players.length === 0) return [];
  return [...team.players]
    .sort((a, b) => {
      const aScore = (a.runsScored || 0) + (a.wickets || 0) * 25 + (a.form || 0) * 5 + (a.morale || 50);
      const bScore = (b.runsScored || 0) + (b.wickets || 0) * 25 + (b.form || 0) * 5 + (b.morale || 50);
      return bScore - aScore;
    })
    .slice(0, count);
}

export function isCrowdFavourite(player: Player, team: Team): boolean {
  const favourites = getCrowdFavourites(team, 3);
  return favourites.some(p => p.id === player.id);
}