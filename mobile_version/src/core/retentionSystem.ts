import type { Player } from '../models/player';
import type { Team } from '../models/team';

// Mega Auction rules: Max 5 retentions. Costs are fixed tiers.
export const MEGA_AUCTION_RETENTION_COSTS = [15000, 12000, 8000, 5000, 3000];
export const MEGA_AUCTION_MAX_RETENTIONS = 5;

// Mini Auction rules: No max retentions (up to squad limit). Cost is current market value.
export const MAX_SQUAD_SIZE = 25;

export function isMegaAuction(season: number): boolean {
  // Mega auction every 3 seasons (e.g., season 1, 4, 7...)
  return season % 3 === 1;
}

export function calculateRetentionCost(playerIndex: number, player: Player, isMega: boolean): number {
  if (isMega) {
    return MEGA_AUCTION_RETENTION_COSTS[playerIndex] || 0;
  } else {
    // In mini auction, it costs their current market value to retain
    return player.marketValue;
  }
}

export function processRetentions(
  teamId: string, 
  retainedPlayerIds: string[], 
  isMega: boolean, 
  currentBudget: number,
  players: Player[],
  teams: Team[]
): { success: boolean, message: string, newBudget: number, updatedTeams: Team[], updatedPlayers: Player[] } {
    let totalCost = 0;
    const retainedPlayers = retainedPlayerIds.map(id => players.find(p => p.id === id)).filter(p => p !== undefined) as Player[];

    if (isMega && retainedPlayers.length > MEGA_AUCTION_MAX_RETENTIONS) {
        return { 
          success: false, 
          message: `Cannot retain more than ${MEGA_AUCTION_MAX_RETENTIONS} players in a Mega Auction.`, 
          newBudget: currentBudget,
          updatedTeams: teams,
          updatedPlayers: players
        };
    }
    
    if (!isMega && retainedPlayers.length > MAX_SQUAD_SIZE) {
        return { 
          success: false, 
          message: `Cannot retain more than ${MAX_SQUAD_SIZE} players.`, 
          newBudget: currentBudget,
          updatedTeams: teams,
          updatedPlayers: players
        };
    }

    for (let i = 0; i < retainedPlayers.length; i++) {
        totalCost += calculateRetentionCost(i, retainedPlayers[i], isMega);
    }

    if (totalCost > currentBudget) {
        return { 
          success: false, 
          message: `Not enough budget. Retention cost: $${totalCost.toLocaleString()}, Budget: $${currentBudget.toLocaleString()}`, 
          newBudget: currentBudget,
          updatedTeams: teams,
          updatedPlayers: players
        };
    }

    // Apply retentions for user team
    let nextTeams = teams.map(t => {
        if (t.id === teamId) {
            const newRoster = t.players.filter(p => retainedPlayerIds.includes(p.id));
            return { ...t, budget: t.budget - totalCost, players: newRoster, retainedPlayers: retainedPlayerIds };
        }
        return t;
    });

    // Apply AI retentions
    nextTeams = processAIRetentions(isMega, nextTeams, players);

    // Collect all IDs that are currently retained by ANY team
    const allRetainedIds = new Set<string>();
    nextTeams.forEach(t => {
        t.players.forEach(p => allRetainedIds.add(p.id));
    });

    // Make all players not in the retained set available in the global pool, and remove retiring players
    const nextPlayers = players
        .filter(p => !p.retiring) // Permanently remove retiring players
        .map(p => {
            if (!allRetainedIds.has(p.id)) {
                return { ...p, isAvailable: true };
            }
            return { ...p, isAvailable: false };
        });

    return { 
      success: true, 
      message: 'Retentions confirmed successfully.', 
      newBudget: currentBudget - totalCost,
      updatedTeams: nextTeams,
      updatedPlayers: nextPlayers
    };
}

function processAIRetentions(isMega: boolean, teams: Team[], players: Player[]): Team[] {
    return teams.map(t => {
        if (t.isUserTeam) return t; // Skip user

        const retainedIds: string[] = [];
        let budgetSpent = 0;
        const availableBudget = t.budget;

        // Sort AI players by overall value/stats to retain the best ones
        const sortedRoster = [...t.players].sort((a, b) => {
            const aValue = (a.stats.batting + a.stats.bowling + a.stats.power + a.stats.technique) + (a.marketValue / 1000);
            const bValue = (b.stats.batting + b.stats.bowling + b.stats.power + b.stats.technique) + (b.marketValue / 1000);
            return bValue - aValue;
        });

        const maxToRetain = isMega ? MEGA_AUCTION_MAX_RETENTIONS : 15; // AI retains up to 15 in mini auction

        for (let i = 0; i < Math.min(sortedRoster.length, maxToRetain); i++) {
            const p = sortedRoster[i];
            if (p.retiring) continue;

            const cost = calculateRetentionCost(retainedIds.length, p, isMega);
            
            // Simple AI logic: retain if they can afford it and it leaves them with decent budget for auction
            if (budgetSpent + cost < availableBudget * 0.6) {
                retainedIds.push(p.id);
                budgetSpent += cost;
            }
        }

        const newRoster = t.players.filter(p => retainedIds.includes(p.id));
        return { ...t, budget: t.budget - budgetSpent, players: newRoster, retainedPlayers: retainedIds };
    });
}