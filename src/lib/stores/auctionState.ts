import { writable, get } from 'svelte/store';
import type { Player } from '../models/player';
import { teamStore, playerStore, gamePhase } from './gameState';
import { MAX_SQUAD_SIZE } from '../core/retentionSystem';

export interface LogEntry {
    message: string;
    timestamp: number;
    teamId?: string;
    type?: 'bid' | 'sold' | 'unsold' | 'system';
}

export interface AuctionState {
    isActive: boolean;
    availablePlayers: Player[];
    currentPlayerIndex: number;
    currentPlayer: Player | null;
    currentBid: number;
    currentBidderId: string | null; // teamId
    timer: number;
    auctionLog: LogEntry[];
    isRTMActive: boolean;
    rtmEligibleTeamId: string | null;
    lastAiBidderId: string | null;
    showAiBidFlash: boolean;
}

function createAuctionStore() {
    const initialState: AuctionState = {
        isActive: false,
        availablePlayers: [],
        currentPlayerIndex: 0,
        currentPlayer: null,
        currentBid: 0,
        currentBidderId: null,
        timer: 0,
        auctionLog: [],
        isRTMActive: false,
        rtmEligibleTeamId: null,
        lastAiBidderId: null,
        showAiBidFlash: false
    };

    const { subscribe, set, update } = writable<AuctionState>(initialState);

    let tickInterval: any = null;
    let aiFlashTimeout: any = null;

    const engine = {
        subscribe,
        set,
        update,
        
        initialize: () => {
            const players = get(playerStore).filter(p => p.isAvailable && !p.retiring);
            // Group and shuffle players by role, or just sort by base value
            const sortedPlayers = [...players].sort((a, b) => b.marketValue - a.marketValue);
            
            set({
                ...initialState,
                isActive: true,
                availablePlayers: sortedPlayers,
                currentPlayerIndex: 0,
                currentPlayer: sortedPlayers[0] || null,
                currentBid: sortedPlayers[0] ? sortedPlayers[0].marketValue : 0,
                currentBidderId: null,
                timer: 5,
                auctionLog: [{ message: 'Auction has started!', timestamp: Date.now(), type: 'system' }]
            });
        },

        startTimer: () => {
            if (tickInterval) clearInterval(tickInterval);
            tickInterval = setInterval(() => {
                const s = get(engine);
                if (s.isActive && !s.isRTMActive && s.timer > 0) {
                    // Random AI bid logic - let AI decide if they want to bid 
                    // Give human a chance, AI waits a bit
                    if (Math.random() < 0.6) {
                        engine.processAIBids();
                    }
                }

                update(state => {
                    if (!state.isActive || state.isRTMActive) return state;
                    
                    if (state.timer > 0) {
                        return { ...state, timer: state.timer - 1 };
                    } else {
                        // Timer hit 0!
                        clearInterval(tickInterval);
                        setTimeout(() => engine.resolveCurrentPlayer(), 0);
                        return state;
                    }
                });
            }, 1000);
        },

        stopTimer: () => {
            if (tickInterval) clearInterval(tickInterval);
        },

        placeBid: (teamId: string, amount?: number, isAiBid = false) => {
            update(state => {
                if (!state.currentPlayer) return state;
                
                // Calculate next bid amount if not specified
                let nextBid = amount;
                if (!nextBid) {
                    if (state.currentBid === state.currentPlayer.marketValue && state.currentBidderId === null) {
                        nextBid = state.currentBid; // Initial bid is base price
                    } else {
                        // Increments: 500 if < 10k, 1000 if < 50k, 2000 if > 50k
                        let inc = 500;
                        if (state.currentBid >= 50000) inc = 2000;
                        else if (state.currentBid >= 10000) inc = 1000;
                        nextBid = state.currentBid + inc;
                    }
                }

                // Check budget and squad size
                const teams = get(teamStore);
                const team = teams.find(t => t.id === teamId);
                if (!team || team.budget < nextBid || team.players.length >= MAX_SQUAD_SIZE) {
                    return state; // Can't afford or squad is full
                }

                engine.log(`${team.name} bids $${nextBid.toLocaleString()}`, teamId, 'bid');
                
                // Clear any existing AI flash timeout
                if (aiFlashTimeout) clearTimeout(aiFlashTimeout);

                let newState: AuctionState = {
                    ...state,
                    currentBid: nextBid,
                    currentBidderId: teamId,
                    timer: 5, // Reset timer on new bid
                    showAiBidFlash: false, // Reset flash on any new bid by default
                    lastAiBidderId: null, // Reset last AI bidder by default
                };

                if (isAiBid) {
                    newState.showAiBidFlash = true;
                    newState.lastAiBidderId = teamId;
                    aiFlashTimeout = setTimeout(() => {
                        update(s => ({ ...s, showAiBidFlash: false }));
                    }, 500); // Flash for 0.5 seconds
                }
                
                return newState;
            });
            engine.startTimer();
        },

        processAIBids: () => {
            const state = get(engine);
            if (!state.currentPlayer || state.timer <= 0 || state.isRTMActive) return;

            const teams = get(teamStore);
            const player = state.currentPlayer;
            
            // Simple AI logic: AI calculates a "max willingness to pay"
            // based on base stats + potential and team's current budget
            
            let bestBidder = null;
            let highestWillingness = 0;

            teams.forEach(t => {
                if (t.isUserTeam || t.id === state.currentBidderId) return;
                
                // Don't bid if roster is full
                if (t.players.length >= MAX_SQUAD_SIZE) return;

                // Max willingness depends on budget and player stats
                const playerValueScore = player.stats.batting + player.stats.bowling + player.stats.power + player.stats.technique;
                let maxWilling = player.marketValue * (1 + (playerValueScore / 100));
                
                // Adjust based on roster needs
                const roleCount = t.players.filter(p => p.role === player.role).length;
                if (roleCount < 2) maxWilling *= 1.5; // Need this role badly
                else if (roleCount > 5) maxWilling *= 0.5; // Don't need this role

                // Never bid more than 30% of budget on one player unless desperate
                maxWilling = Math.min(maxWilling, t.budget * 0.3);

                const currentRequiredBid = (state.currentBid === player.marketValue && state.currentBidderId === null) ? player.marketValue : state.currentBid + (state.currentBid >= 50000 ? 2000 : (state.currentBid >= 10000 ? 1000 : 500));

                if (maxWilling >= currentRequiredBid && maxWilling > highestWillingness) {
                    highestWillingness = maxWilling;
                    bestBidder = t;
                }
            });

            // Random chance to actually place the bid now or wait
            if (bestBidder && Math.random() > 0.4) {
                const calculatedNextBidAmount = (state.currentBid === player.marketValue && state.currentBidderId === null) ? player.marketValue : state.currentBid + (state.currentBid >= 50000 ? 2000 : (state.currentBid >= 10000 ? 1000 : 500));
                engine.placeBid((bestBidder as any).id, calculatedNextBidAmount, true); // Pass true to indicate AI bid
                return true; // Return true if someone wanted to bid
            }
            return false;
        },

        fastForwardPlayer: () => {
            engine.stopTimer();
            let biddingWar = true;
            let safetyCounter = 0;
            // Force AI to bid until max willingness is reached
            while(biddingWar && safetyCounter < 50) {
                biddingWar = engine.processAIBids() ?? false;
                safetyCounter++;
            }
            // Resolve immediately without delay
            engine.resolveCurrentPlayer(true);
        },

        autoComplete: () => {
            engine.stopTimer();
            let state = get(engine);
            while(state.isActive && state.currentPlayer) {
                let biddingWar = true;
                let safetyCounter = 0;
                while(biddingWar && safetyCounter < 50) {
                    biddingWar = engine.processAIBids() ?? false;
                    safetyCounter++;
                }
                engine.resolveCurrentPlayer(true);
                state = get(engine);
            }
            gamePhase.set('tournament');
        },

        resolveCurrentPlayer: (instant = false) => {
            const state = get(engine);
            if (!state.currentPlayer) return;

            if (state.currentBidderId) {
                const teams = get(teamStore);
                const winningTeam = teams.find(t => t.id === state.currentBidderId);
                engine.log(`SOLD! ${state.currentPlayer.name} goes to ${winningTeam?.name} for $${state.currentBid.toLocaleString()}`, state.currentBidderId!, 'sold');
                
                // Assign player
                teamStore.update(ts => ts.map(t => {
                    if (t.id === state.currentBidderId) {
                        return { ...t, budget: t.budget - state.currentBid, players: [...t.players, { ...state.currentPlayer!, isAvailable: false }] };
                    }
                    return t;
                }));

                playerStore.update(ps => ps.map(p => p.id === state.currentPlayer?.id ? { ...p, isAvailable: false } : p));
            } else {
                engine.log(`UNSOLD. ${state.currentPlayer.name} returns to the pool.`, undefined, 'unsold');
            }

            if (instant) {
                engine.nextPlayer(true);
            } else {
                setTimeout(() => engine.nextPlayer(), 2000);
            }
        },

        nextPlayer: (instant = false) => {
            update(state => {
                const nextIndex = state.currentPlayerIndex + 1;
                const nextP = state.availablePlayers[nextIndex];
                
                if (nextP) {
                    if(!instant) engine.log(`Now on the block: ${nextP.name} (Base Price: $${nextP.marketValue.toLocaleString()})`, undefined, 'system');
                    return {
                        ...state,
                        currentPlayerIndex: nextIndex,
                        currentPlayer: nextP,
                        currentBid: nextP.marketValue,
                        currentBidderId: null,
                        timer: 5,
                        isRTMActive: false,
                        rtmEligibleTeamId: null
                    };
                } else {
                    engine.log('Auction Complete!', undefined, 'system');
                    return { ...state, isActive: false, currentPlayer: null };
                }
            });
            if (get(engine).isActive && !instant) {
                engine.startTimer();
            } else if (!get(engine).isActive && !instant) {
                // Transition to tournament
                setTimeout(() => {
                    gamePhase.set('tournament');
                }, 3000);
            }
        },

        log: (message: string, teamId?: string, type?: 'bid' | 'sold' | 'unsold' | 'system') => {
            update(state => ({
                ...state,
                auctionLog: [{ message, teamId, type, timestamp: Date.now() }, ...state.auctionLog].slice(0, 10)
            }));
        }
    };

    return engine;
}

export const auctionStore = createAuctionStore();