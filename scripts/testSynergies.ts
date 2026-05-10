import { generatePlayer } from '../src/lib/core/draftAI';
import { resolveBall } from '../src/lib/core/matchEngine';
import type { IntentType, BallResult } from '../src/lib/models/match';

// Small wrapper to inject the isolated synergy rules
function resolveBallWithSynergy(batter, bowler, ball, over, battingIntent, bowlingIntent) {
    let originalFactionBatter = batter.faction;
    let originalFactionBowler = bowler.faction;
    
    // We will track if the synergy fired
    let synergyActivated = [];

    // Temporary apply synergy logic into the intents / stats for the test
    let modifiedBattingIntent = battingIntent;
    let modifiedBowlingIntent = bowlingIntent;

    // ELVEN SYNERGY (Defense)
    if (batter.faction === 'elf' && (battingIntent === 'defensive' || battingIntent === 'very_defensive')) {
        synergyActivated.push('Elf Defense');
    }

    // ORCISH SYNERGY (Aggression)
    if (batter.faction === 'orc' && (battingIntent === 'aggressive' || battingIntent === 'very_aggressive')) {
        synergyActivated.push('Orc Aggression');
    }

    // HUMAN SYNERGY (Discipline)
    if (bowler.faction === 'human' && (bowlingIntent === 'balanced' || bowlingIntent === 'defensive') && over < 6) {
        synergyActivated.push('Human Discipline');
    }

    // DWARF SYNERGY (Deep Reserves)
    if (batter.faction === 'dwarf' && over >= 16 && (battingIntent === 'aggressive' || battingIntent === 'very_aggressive')) {
        synergyActivated.push('Dwarf Reserves');
        batter.fatigue = 0; // Simulate ignoring fatigue
    }
    
    // GOBLIN SYNERGY (Chaotic Turn)
    if (bowler.faction === 'goblin' && bowlingIntent === 'aggressive' && bowler.bowlingType === 'spinner') {
        synergyActivated.push('Goblin Chaos');
    }

    const event = resolveBall(batter, bowler, ball, 20, battingIntent, 'sunny', 'balanced', 0, false, bowlingIntent, false, 60, 'normal');
    
    return { event, synergyActivated };
}

// Run 10 matches
let totalRuns = 0;
let totalWickets = 0;
let synergyStats = {};

for (let m = 0; m < 10; m++) {
    for (let inn = 0; inn < 2; inn++) {
        let runs = 0;
        let wickets = 0;
        
        let batter = generatePlayer('batsman');
        let bowler = generatePlayer('bowler');
        
        for (let over = 0; over < 20; over++) {
            if (wickets >= 10) break;
            
            // Auto intent logic
            let batIntent: IntentType = 'balanced';
            let bowlIntent: IntentType = 'balanced';
            
            if (over < 6) batIntent = 'aggressive';
            if (over >= 16) batIntent = 'very_aggressive';
            
            for (let ball = 0; ball < 6; ball++) {
                if (wickets >= 10) break;
                batter.fatigue += 0.3; // mock fatigue
                
                const { event, synergyActivated } = resolveBallWithSynergy(batter, bowler, ball, over, batIntent, bowlIntent);
                runs += event.runs;
                if (event.isWicket) wickets++;
                
                synergyActivated.forEach(syn => {
                    synergyStats[syn] = (synergyStats[syn] || 0) + 1;
                });
            }
        }
        totalRuns += runs;
        totalWickets += wickets;
    }
}

console.log(`Average Runs per Innings: ${totalRuns / 20}`);
console.log(`Average Wickets per Innings: ${totalWickets / 20}`);
console.log(`Synergies Activated across 10 matches:`, synergyStats);
