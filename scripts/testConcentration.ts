import { generatePlayerPool, randomInt } from '../src/lib/core/draftAI';
import { resolveBall } from '../src/lib/core/matchEngine';
import type { Player } from '../src/lib/models/player';
import type { innings } from '../src/lib/models/match';

const numMatches = 1000;

function createTeam(id: string, name: string) {
    const players = generatePlayerPool(11);
    // Sort roughly: batsman, allrounder, wk, bowler
    players.sort((a, b) => {
        const order: Record<string, number> = { 'batsman': 1, 'wicketkeeper': 2, 'allrounder': 3, 'bowler': 4 };
        return (order[a.role] || 5) - (order[b.role] || 5);
    });
    return { id, name, players };
}

// Trackers
let totalRuns = 0;
let totalWickets = 0;
let batFirstWins = 0;
let batSecondWins = 0;
let ties = 0;
let allOuts = 0;
let highestScore = 0;
let lowestScore = 9999;
let totalFours = 0;
let totalSixes = 0;
let totalDots = 0;
let totalBallsFaced = 0;

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
        currentBatsmen: [battingTeam.players[0].id, battingTeam.players[1].id],
        batsmanConcentration: {},
        bowlerRhythm: {}
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
        
        if (!inn.batsmanConcentration) inn.batsmanConcentration = {};
        if (inn.batsmanConcentration[striker.id] === undefined) inn.batsmanConcentration[striker.id] = 0;
        let conc = inn.batsmanConcentration[striker.id];
        let concMult = 1.0 + (conc / 100) * 0.15;

        if (!inn.bowlerRhythm) inn.bowlerRhythm = {};
        if (inn.bowlerRhythm[bowler.id] === undefined) inn.bowlerRhythm[bowler.id] = 0;
        let rhythm = inn.bowlerRhythm[bowler.id];
        let rhythmMult = 1.0 + (rhythm / 100) * 0.15;

        const ballEvent = resolveBall(striker, bowler, inn.balls, totalOvers, 'balanced', 'sunny', 'balanced', 0, false, 'balanced', false, bowlingFieldingAvg, 'normal', concMult, rhythmMult);
        
        if (ballEvent.result === 'dot') {
            conc = Math.max(0, conc - 5);
            rhythm = Math.min(100, rhythm + 5);
            totalDots++;
        } else if (ballEvent.runs === 4) {
            conc = Math.min(100, conc + 15);
            rhythm = Math.max(0, rhythm - 10);
            totalFours++;
        } else if (ballEvent.runs === 6) {
            conc = Math.min(100, conc + 15);
            rhythm = Math.max(0, rhythm - 10);
            totalSixes++;
        } else if (ballEvent.runs > 0) {
            conc = Math.min(100, conc + 5);
        }
        
        if (ballEvent.result === 'wide' || ballEvent.result === 'noball') {
            rhythm = Math.max(0, rhythm - 5);
        }
        if (ballEvent.isWicket) {
            rhythm = Math.min(100, rhythm + 25);
        }

        inn.batsmanConcentration[striker.id] = conc;
        inn.bowlerRhythm[bowler.id] = rhythm;

        if (ballEvent.result !== 'wide' && ballEvent.result !== 'noball') {
            inn.balls++;
            totalBallsFaced++;
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
    
    // Only track these metrics for full innings (Team 1, or Team 2 if they didn't win prematurely)
    // Wait, highest/lowest score should consider all completed innings or just target-chasing ones?
    // A target chasing innings might end prematurely at 150/2 in 12 overs, dragging the average/lowest down.
    // It's better to just track stats for the 1st innings to get the true "team potential" distribution.
    if (target === 9999) {
        if (inn.wickets === 10) allOuts++;
        if (inn.totalRuns > highestScore) highestScore = inn.totalRuns;
        if (inn.totalRuns < lowestScore) lowestScore = inn.totalRuns;
    }

    return inn;
}

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

const totalInnings = numMatches * 2;

console.log(`--- Deep Match Engine Analysis (${numMatches} Matches / ${totalInnings} Innings) ---`);
console.log(`Average Runs per Innings: ${(totalRuns / totalInnings).toFixed(2)}`);
console.log(`Average Wickets per Innings: ${(totalWickets / totalInnings).toFixed(2)}`);
console.log(`Highest Score (1st Innings): ${highestScore}`);
console.log(`Lowest Score (1st Innings): ${lowestScore}`);
console.log(`All-Out % (1st Innings): ${((allOuts / numMatches) * 100).toFixed(2)}%`);
console.log(`Average Strike Rate: ${((totalRuns / totalBallsFaced) * 100).toFixed(2)}`);
console.log(`Dot Ball %: ${((totalDots / totalBallsFaced) * 100).toFixed(2)}%`);
console.log(`Average Fours per Innings: ${(totalFours / totalInnings).toFixed(2)}`);
console.log(`Average Sixes per Innings: ${(totalSixes / totalInnings).toFixed(2)}`);
console.log(`Bat First Win %: ${((batFirstWins / numMatches) * 100).toFixed(1)}%`);
console.log(`Bat Second Win %: ${((batSecondWins / numMatches) * 100).toFixed(1)}%`);
console.log(`Tie %: ${((ties / numMatches) * 100).toFixed(1)}%`);