// Self-contained Scaled Match Engine Simulation

const FACTIONS = {
    human: { modifiers: { tech: 1.00, power: 1.00, fatigue: 1.00 } },
    elf: { modifiers: { tech: 1.02, power: 0.95, fatigue: 1.01 } },
    orc: { modifiers: { tech: 0.95, power: 1.15, fatigue: 0.94 } },
    dwarf: { modifiers: { tech: 0.98, power: 1.10, fatigue: 0.92 } },
    goblin: { modifiers: { tech: 0.92, power: 1.18, fatigue: 1.02 } },
    nightelf: { modifiers: { tech: 1.02, power: 0.98, fatigue: 0.92 } }
};

const INTENT_MULTIPLIERS = {
    very_defensive: 0.1,
    defensive: 0.2,
    balanced: 1.0,
    aggressive: 3.5,
    very_aggressive: 5.5
};

const BOWLING_INTENT_EFFECT = {
    very_defensive: 1.3,
    defensive: 1.15,
    balanced: 1.0,
    aggressive: 0.85,
    very_aggressive: 0.7
};

const WEATHER_EFFECTS = {
    sunny: { batting: 1.05, bowling: 0.95, wicketChance: 1.0 }
};

const PITCH_EFFECTS = {
    balanced: { batting: 1.0, bowling: 1.0, spin: 1.0, seam: 1.0 }
};

const T20_RULES = {
    POWERPLAY_START: 0,
    POWERPLAY_END: 5,
    NO_BALL_CHANCE: 0.02,
    WIDE_CHANCE: 0.025
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function randomRoll(range) {
    return Math.floor(Math.random() * (range * 2 + 1)) - range;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPitchSynergyMultiplier(bowlingType, pitch) {
    return 1.0; // simplified for balanced pitch
}

function getEffectiveStatsScaled(player) {
    const faction = FACTIONS[player.faction];
    let batting = player.stats.batting * faction.modifiers.tech;
    let power = player.stats.power * faction.modifiers.power;
    let technique = player.stats.technique * faction.modifiers.tech;
    
    batting *= 1.0; power *= 1.0; // Form modifier assumed 0 (1.0)
    
    if (player.special.isCaptain) {
      technique += player.special.captainBonus;
      batting += player.special.captainBonus * 0.5;
    }
    
    if (player.special.isWicketKeeper) {
      technique += player.special.wkBonus;
    }
    
    return {
      batting: Math.round(batting),
      bowling: player.stats.bowling,
      power: Math.round(power),
      technique: Math.round(technique),
      fielding: player.stats.fielding
    };
}

function calculateWicketChanceScaled(batter, bowler, intent, currentOver, totalOvers) {
    const batterStats = getEffectiveStatsScaled(batter);
    const bowlerStats = getEffectiveStatsScaled(bowler);
    const faction = FACTIONS[batter.faction];
    const intentMult = INTENT_MULTIPLIERS[intent];
    const fatigueMult = 1 + (batter.fatigue / 100 * 0.2 * currentOver / totalOvers);
    
    const batterMoraleMod = 1.0;
    const bowlerMoraleMod = 1.0;
    
    const baseChance = 0.07; // Reduced from 0.09
    // === SCALED DOWN CONSTANTS ===
    // Originally 0.0005 and 0.0004 for 10-20 stats. Now 0.0001 and 0.00008 for 20-100 stats.
    const techReduction = (batterStats.technique * batterMoraleMod) * 0.00012; // slightly more reduction
    const synergyMult = 1.0;
    const bowlerBoost = (bowlerStats.bowling * bowlerMoraleMod * synergyMult) * 0.00007; // slightly less boost
    const weatherMod = 1.0;
    
    const wicketChance = (baseChance * intentMult) + (faction.modifiers.fatigue * (batter.fatigue / 100) * 0.2 * fatigueMult) 
                     - techReduction + bowlerBoost;
    
    return clamp(wicketChance * weatherMod, 0.02, 0.16);
}

function calculateShotQualityScaled(batter, bowler, intent, isLastOver, bowlingEffort = 1.0) {
    const batterStats = getEffectiveStatsScaled(batter);
    const bowlerStats = getEffectiveStatsScaled(bowler);
    const weatherMod = WEATHER_EFFECTS.sunny;
    const pitchMod = PITCH_EFFECTS.balanced;
    
    const batterMoraleMod = 1.0;
    const bowlerMoraleMod = 1.0;
  
    const effectiveBowling = bowlerStats.bowling * bowlerMoraleMod * 1.0;
    const fatigueFactor = 1 - (batter.fatigue / 350);
    const lastOverBonus = isLastOver ? 0.03 : 0;
    
    const battingIntentBonus = intent === 'aggressive' ? 0.08 : intent === 'defensive' ? -0.05 : 0;
    
    // === SCALED DOWN CONSTANTS ===
    // Originally 0.08
    const techMitigation = batterStats.technique * batterMoraleMod * 0.016;
    const netTypeAdvantage = Math.max(0, 0 - techMitigation);
    
    // Originally 0.22, 0.11, 0.09, 0.04
    const battingPower = (batterStats.batting * 0.055 + batterStats.power * 0.028) * batterMoraleMod * fatigueFactor;
    const bowlingDefense = (effectiveBowling * 0.018 + bowlerStats.technique * bowlerMoraleMod * 0.008) * bowlingEffort + netTypeAdvantage;
    
    const baseShot = (battingPower * weatherMod.batting * pitchMod.batting - bowlingDefense - 0) * (1 + 0 + battingIntentBonus);
    
    return clamp(baseShot * (1 + lastOverBonus) + randomRoll(4), -5, 35);
}

function determineBallResult(shotQuality, isFreeHit = false, isPowerplay = false) {
    let baseShotQuality = shotQuality;
    if (isFreeHit) baseShotQuality += 3;
    if (isPowerplay) baseShotQuality += 2.5;
    
    if (baseShotQuality > 20) return { result: 'six', runs: 6 };
    else if (baseShotQuality > 5) return { result: 'four', runs: 4 };
    else if (baseShotQuality > -3) return { result: 'single', runs: 1 };
    else return { result: 'dot', runs: 0 };
}

function resolveBallScaled(batter, bowler, currentBalls, totalOvers, battingIntent) {
    const ballNumber = currentBalls + 1;
    const currentOver = Math.floor(currentBalls / 6);
    const isLastOver = currentOver >= totalOvers - 1;
    const isPowerplay = currentOver >= T20_RULES.POWERPLAY_START && currentOver <= T20_RULES.POWERPLAY_END;
    
    const bowlingEffort = BOWLING_INTENT_EFFECT.balanced;
    
    if (Math.random() < T20_RULES.NO_BALL_CHANCE) {
      const shot = calculateShotQualityScaled(batter, bowler, battingIntent, isLastOver, bowlingEffort);
      return { result: 'noball', runs: 1 + (shot > 10 ? 1 : 0), isWicket: false };
    }
  
    if (Math.random() < T20_RULES.WIDE_CHANCE) {
      return { result: 'wide', runs: 1, isWicket: false };
    }
  
    const wicketChance = calculateWicketChanceScaled(batter, bowler, battingIntent, currentOver, totalOvers) * bowlingEffort;
  
    if (Math.random() < wicketChance) {
      // SCALED DOWN MULTIPLIER
      const dropChance = Math.max(0.02, 0.25 - (60 * 0.003)); 
      if (Math.random() < dropChance) {
           const dropRuns = randomInt(1, 2);
           return { result: dropRuns === 1 ? 'single' : 'dot', runs: dropRuns, isWicket: false };
      }
      return { result: 'wicket', runs: 0, isWicket: true };
    }
  
    const shotQuality = calculateShotQualityScaled(batter, bowler, battingIntent, isLastOver, bowlingEffort);
    let { result, runs } = determineBallResult(shotQuality, false, isPowerplay);
  
    return { result, runs, isWicket: false };
}

function generatePlayerScaled(role) {
    // === SCALED UP CONSTANTS (Approx 5x) ===
    const baseStats = {
      batsman: { batting: 60, bowling: 15, power: 50, technique: 60, fielding: 60 },
      allrounder: { batting: 50, bowling: 50, power: 40, technique: 40, fielding: 70 },
      bowler: { batting: 15, bowling: 70, power: 25, technique: 25, fielding: 50 },
      wicketkeeper: { batting: 50, bowling: 10, power: 40, technique: 70, fielding: 80 }
    }[role];
  
    return {
      id: Math.random().toString(),
      name: "Player",
      role,
      faction: 'human',
      bowlingType: role === 'bowler' ? 'fast' : 'none',
      stats: {
        batting: Math.max(20, Math.min(100, baseStats.batting + randomInt(-20, 20))),
        bowling: Math.max(20, Math.min(100, baseStats.bowling + randomInt(-20, 20))),
        power: Math.max(20, Math.min(100, baseStats.power + randomInt(-20, 20))),
        technique: Math.max(20, Math.min(100, baseStats.technique + randomInt(-20, 20))),
        fielding: Math.max(20, Math.min(100, baseStats.fielding + randomInt(-20, 20)))
      },
      special: {
        isCaptain: false,
        captainBonus: 0,
        isWicketKeeper: role === 'wicketkeeper',
        wkBonus: role === 'wicketkeeper' ? 20 : 0
      },
      fatigue: 0,
      morale: 50,
      form: 0
    };
}

function generateTeam() {
    const players = [];
    for(let i=0; i<5; i++) players.push(generatePlayerScaled('batsman'));
    players.push(generatePlayerScaled('wicketkeeper'));
    for(let i=0; i<2; i++) players.push(generatePlayerScaled('allrounder'));
    for(let i=0; i<3; i++) players.push(generatePlayerScaled('bowler'));
    return { players };
}

function simulateInningsScaled(battingTeam, bowlingTeam, target = 9999) {
    const inn = { totalRuns: 0, wickets: 0, overs: 0, balls: 0 };
    let currentBatsmen = [0, 1];
    let nextBatsmanIdx = 2;
    let currentBowlerIdx = 6;
    
    while (inn.overs < 20 && inn.wickets < 10 && inn.totalRuns < target) {
        const striker = battingTeam.players[currentBatsmen[0]];
        const bowler = bowlingTeam.players[currentBowlerIdx];
        
        const intent = inn.overs < 6 ? 'aggressive' : inn.overs >= 15 ? 'very_aggressive' : 'balanced';
        
        const ball = resolveBallScaled(striker, bowler, inn.balls, 20, intent);
        
        if (ball.result !== 'wide' && ball.result !== 'noball') {
            inn.balls++;
        }
        
        inn.totalRuns += ball.runs;
        
        if (ball.isWicket) {
            inn.wickets++;
            if (inn.wickets < 10) {
                currentBatsmen[0] = nextBatsmanIdx++;
            }
        } else if (ball.runs % 2 === 1) {
            currentBatsmen = [currentBatsmen[1], currentBatsmen[0]];
        }
        
        if (inn.balls > 0 && inn.balls % 6 === 0 && ball.result !== 'wide' && ball.result !== 'noball') {
            inn.overs++;
            currentBatsmen = [currentBatsmen[1], currentBatsmen[0]];
            currentBowlerIdx = 6 + (inn.overs % 5);
        }
    }
    return inn;
}

const numMatches = 1000;
let totalRuns = 0;
let totalWickets = 0;

for(let i=0; i<numMatches; i++) {
    const team1 = generateTeam();
    const team2 = generateTeam();
    
    const inn1 = simulateInningsScaled(team1, team2);
    const inn2 = simulateInningsScaled(team2, team1, inn1.totalRuns + 1);
    
    totalRuns += inn1.totalRuns + inn2.totalRuns;
    totalWickets += inn1.wickets + inn2.wickets;
}

console.log(`--- SCALED Match Engine Simulation Report (${numMatches} Matches) ---`);
console.log(`Stats Range used: 20 - 100`);
console.log(`Average Runs per Innings: ${(totalRuns / (numMatches * 2)).toFixed(2)}`);
console.log(`Average Wickets per Innings: ${(totalWickets / (numMatches * 2)).toFixed(2)}`);
console.log(`Average Strike Rate: ${((totalRuns / (numMatches * 240)) * 100).toFixed(2)}`);