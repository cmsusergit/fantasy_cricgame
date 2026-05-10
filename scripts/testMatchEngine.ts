import { generatePlayerPool, randomInt } from '../src/lib/core/draftAI';
import { resolveBall } from '../src/lib/core/matchEngine';
import type { Player } from '../src/lib/models/player';
import type { innings } from '../src/lib/models/match';

const numMatches = 1000;

function createTeam(id: string, name: string) {
    const players = generatePlayerPool(11);
    // Sort roughly: batsman, allrounder, wk, bowler
    players.sort((a, b) => {
        const order = { 'batsman': 1, 'wicketkeeper': 2, 'allrounder': 3, 'bowler': 4 };
        return order[a.role] - order[b.role];
    });
    return { id, name, players };
}

function simulateInnings(battingTeam: {players: Player[]}, bowlingTeam: {players: Player[]}, target: number = 9999): innings {
    const inn: innings = {
        teamId: battingTeam.id,
        totalRuns: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        extras: 0,
        ballsFaced: [],
        battingOrder: battingTeam.players.map(p => p.id),
        currentBatsmen: [battingTeam.players[0].id, battingTeam.players[1].id]
    };
    
    const totalOvers = 20;
    const bowlers = bowlingTeam.players.filter(p => p.role === 'bowler' || p.role === 'allrounder').slice(0, 5);
    if (bowlers.length < 5) {
        bowlers.push(...bowlingTeam.players.filter(p => !bowlers.includes(p)).slice(0, 5 - bowlers.length));
    }
    
    let currentBowlerIndex = 0;
    
    while (inn.overs < totalOvers && inn.wickets < 10 && inn.totalRuns < target) {
        const striker = battingTeam.players.find(p => p.id === inn.currentBatsmen[0])!;
        const bowler = bowlers[currentBowlerIndex % bowlers.length];
        
        const bowlingFieldingAvg = bowlingTeam.players.slice(0, 11).reduce((sum, p) => sum + (p.stats.fielding || 60), 0) / 11;
        const ballEvent = resolveBall(striker, bowler, inn.balls, totalOvers, 'balanced', 'sunny', 'balanced', 0, false, 'balanced', false, bowlingFieldingAvg);
        
        if (ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
            inn.balls++;
        }
        
        inn.totalRuns += ballEvent.runs;
        if (ballEvent.isWicket) {
            inn.wickets++;
            if (inn.wickets < 10) {
                inn.currentBatsmen[0] = inn.battingOrder[inn.wickets + 1];
            }
        } else if (ballEvent.runs % 2 === 1) {
            inn.currentBatsmen = [inn.currentBatsmen[1], inn.currentBatsmen[0]] as [string, string];
        }
        
        if (inn.balls > 0 && inn.balls % 6 === 0 && ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
            inn.overs++;
            inn.currentBatsmen = [inn.currentBatsmen[1], inn.currentBatsmen[0]] as [string, string];
            currentBowlerIndex++;
        }
        
        inn.ballsFaced.push(ballEvent);
    }
    
    return inn;
}

let totalRuns = 0;
let totalWickets = 0;
let batFirstWins = 0;
let batSecondWins = 0;
let ties = 0;

for (let i = 0; i < numMatches; i++) {
    const t1 = createTeam('t1', 'Team 1');
    const t2 = createTeam('t2', 'Team 2');
    
    const inn1 = simulateInnings(t1, t2);
    const inn2 = simulateInnings(t2, t1, inn1.totalRuns + 1);
    
    totalRuns += inn1.totalRuns + inn2.totalRuns;
    totalWickets += inn1.wickets + inn2.wickets;
    
    if (inn1.totalRuns > inn2.totalRuns) batFirstWins++;
    else if (inn2.totalRuns > inn1.totalRuns) batSecondWins++;
    else ties++;
}

console.log(`--- Match Engine Simulation Report (${numMatches} Matches) ---`);
console.log(`Average Runs per Innings: ${(totalRuns / (numMatches * 2)).toFixed(2)}`);
console.log(`Average Wickets per Innings: ${(totalWickets / (numMatches * 2)).toFixed(2)}`);
console.log(`Average Strike Rate: ${((totalRuns / (numMatches * 240)) * 100).toFixed(2)}`);
console.log(`Bat First Win %: ${((batFirstWins / numMatches) * 100).toFixed(1)}%`);
console.log(`Bat Second Win %: ${((batSecondWins / numMatches) * 100).toFixed(1)}%`);
console.log(`Tie %: ${((ties / numMatches) * 100).toFixed(1)}%`);
