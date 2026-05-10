import { generatePlayer } from '../src/lib/core/draftAI';
import { resolveBall } from '../src/lib/core/matchEngine';
import type { IntentType, BallResult } from '../src/lib/models/match';

// Small wrapper to inject the isolated synergy rules for testing
function resolveBallWithSynergy(batter, bowler, ball, over, battingIntent, bowlingIntent) {
    let synergyActivated = [];

    // Save original stats to restore later
    const origBatterFatigue = batter.fatigue;
    const origBatterPower = batter.stats.power;
    const origBatterTechnique = batter.stats.technique;
    const origBowlerBowling = bowler.stats.bowling;
    const origBowlerFatigue = bowler.fatigue;

    // ALREADY IMPLEMENTED (in engine but we track it here)
    if (batter.faction === 'elf' && (battingIntent === 'defensive' || battingIntent === 'very_defensive')) {
        synergyActivated.push('Elf Defense');
    }
    if (batter.faction === 'orc' && (battingIntent === 'aggressive' || battingIntent === 'very_aggressive')) {
        synergyActivated.push('Orc Batting Aggression');
    }
    if (bowler.faction === 'orc' && (bowlingIntent === 'aggressive' || bowlingIntent === 'very_aggressive')) {
        synergyActivated.push('Orc Bowling Intimidation');
    }

    // PROPOSED SYNERGIES TO MOCK
    // Human Batting: Tactical Discipline (balanced intent)
    if (batter.faction === 'human' && battingIntent === 'balanced') {
        synergyActivated.push('Human Batting Discipline');
        batter.stats.technique += 10; // Mock stability bonus
    }
    // Human Bowling: New Ball Discipline (balanced/defensive, overs 0-5)
    if (bowler.faction === 'human' && (bowlingIntent === 'balanced' || bowlingIntent === 'defensive') && over < 6) {
        synergyActivated.push('Human Bowling Discipline');
        bowler.stats.bowling += 10; // Mock boundary restriction
    }
    
    // Dwarf Batting: Deep Reserves (aggressive/very_aggressive, overs 16-19)
    if (batter.faction === 'dwarf' && over >= 16 && (battingIntent === 'aggressive' || battingIntent === 'very_aggressive')) {
        synergyActivated.push('Dwarf Batting Reserves');
        batter.fatigue = 0; // Ignore fatigue
    }
    // Dwarf Bowling: Relentless Stamina (aggressive/very_aggressive)
    if (bowler.faction === 'dwarf' && (bowlingIntent === 'aggressive' || bowlingIntent === 'very_aggressive')) {
        synergyActivated.push('Dwarf Bowling Stamina');
        bowler.fatigue = Math.max(0, bowler.fatigue - 20); // Mock fatigue reduction
    }

    // Goblin Batting: Cheeky Thieves (defensive)
    let goblinCheekyThieves = false;
    if (batter.faction === 'goblin' && battingIntent === 'defensive') {
        synergyActivated.push('Goblin Cheeky Thieves');
        goblinCheekyThieves = true;
    }
    // Goblin Bowling: Chaotic Turn (aggressive + spinner)
    let goblinChaoticTurn = false;
    if (bowler.faction === 'goblin' && bowlingIntent === 'aggressive' && bowler.bowlingType === 'spinner') {
        synergyActivated.push('Goblin Chaotic Turn');
        bowler.stats.bowling += 20; // Spike wicket taking
        goblinChaoticTurn = true; 
    }

    // Night Elf Batting: Surgical Precision (aggressive)
    if (batter.faction === 'nightelf' && battingIntent === 'aggressive') {
        synergyActivated.push('Night Elf Precision');
        batter.stats.power = batter.stats.technique; // Scale with technique instead of power
    }
    // Night Elf Bowling: Shadow of Death (overs 16-19)
    if (bowler.faction === 'nightelf' && over >= 16) {
        synergyActivated.push('Night Elf Shadow of Death');
        bowler.stats.bowling *= 1.15; // flat 1.15x multiplier
    }

    // Call resolveBall
    let event = resolveBall(batter, bowler, ball, 20, battingIntent, 'sunny', 'balanced', 0, false, bowlingIntent, false, 60, 'normal');
    
    // Post-resolve mocks
    if (goblinCheekyThieves && event.result === 'dot' && !event.isWicket) {
        event.result = 'single';
        event.runs = 1;
        event.commentary = 'Cheeky stolen single by the Goblin!';
    }
    if (goblinChaoticTurn && Math.random() < 0.05) { // Force double no-balls manually roughly
        event.result = 'noball';
        event.runs = 1;
        event.isWicket = false;
    }

    // Restore original stats
    batter.fatigue = origBatterFatigue;
    batter.stats.power = origBatterPower;
    batter.stats.technique = origBatterTechnique;
    bowler.stats.bowling = origBowlerBowling;
    bowler.fatigue = origBowlerFatigue;
    
    return { event, synergyActivated };
}

// Run 100 matches
let totalRuns = 0;
let totalWickets = 0;
let synergyStats: Record<string, number> = {};

for (let m = 0; m < 100; m++) {
    for (let inn = 0; inn < 2; inn++) {
        let runs = 0;
        let wickets = 0;
        
        let batter = generatePlayer('batsman');
        let bowler = generatePlayer('bowler');
        
        // Ensure a good mix of factions for testing by occasionally forcing them
        if (m % 6 === 0) batter.faction = 'human';
        if (m % 6 === 1) batter.faction = 'elf';
        if (m % 6 === 2) batter.faction = 'orc';
        if (m % 6 === 3) batter.faction = 'dwarf';
        if (m % 6 === 4) batter.faction = 'goblin';
        if (m % 6 === 5) batter.faction = 'nightelf';

        if (m % 6 === 5) bowler.faction = 'human';
        if (m % 6 === 4) bowler.faction = 'elf';
        if (m % 6 === 3) bowler.faction = 'orc';
        if (m % 6 === 2) bowler.faction = 'dwarf';
        if (m % 6 === 1) bowler.faction = 'goblin';
        if (m % 6 === 0) bowler.faction = 'nightelf';

        // Force a spinner occasionally to test goblin synergy
        if (bowler.faction === 'goblin' && Math.random() < 0.5) {
            bowler.bowlingType = 'spinner';
        }
        
        for (let over = 0; over < 20; over++) {
            if (wickets >= 10) break;
            
            // Auto intent logic
            let batIntent: IntentType = 'balanced';
            let bowlIntent: IntentType = 'balanced';
            
            if (over < 6) { batIntent = 'aggressive'; bowlIntent = 'defensive'; }
            else if (over >= 16) { batIntent = 'very_aggressive'; bowlIntent = 'aggressive'; }
            else { batIntent = 'balanced'; bowlIntent = 'balanced'; }

            // Occasional intent variation for testing all synergies
            if (Math.random() < 0.2) batIntent = 'defensive';
            if (Math.random() < 0.2) bowlIntent = 'aggressive';
            
            for (let ball = 0; ball < 6; ball++) {
                if (wickets >= 10) break;
                batter.fatigue += 0.3; // mock fatigue
                bowler.fatigue += 0.2;
                
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

console.log(`--- SIMULATION RESULTS (100 MATCHES / 200 INNINGS) ---`);
console.log(`Average Runs per Innings: ${(totalRuns / 200).toFixed(2)}`);
console.log(`Average Wickets per Innings: ${(totalWickets / 200).toFixed(2)}`);
console.log(`
Synergies Activated across 100 matches:`);
for (const [syn, count] of Object.entries(synergyStats).sort((a,b) => b[1] - a[1])) {
    console.log(`- ${syn}: ${count}`);
}
