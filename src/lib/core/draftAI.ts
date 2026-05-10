import type { Player, PlayerRole, PlayerStats } from '../models/player';
import type { FactionType } from '../models/faction';
import { FACTIONS } from '../models/faction';

const FIRST_NAMES: Record<FactionType, string[]> = {
  human: ['Arin', 'Bryce', 'Cedric', 'Dorian', 'Elden', 'Falken', 'Garen', 'Helios', 'Ivan', 'Jareth', 'Kael', 'Lysander', 'Magnus', 'Nero', 'Orion'],
  elf: ['Aelindra', 'Belindor', 'Caelum', 'Daelis', 'Elowen', 'Faenor', 'Galadris', 'Ilyana', 'Legolas', 'Miranel', 'Naelis', 'Orophin', 'Sylvari', 'Thalion', 'Ylyndra'],
  orc: ['Grukk', 'Thrak', 'Bogrok', 'Karg', 'Morguk', 'Nazg', 'Roktar', 'Snaga', 'Uguk', 'Vrog', 'Warl', 'Zug', 'Gorbash', 'Hurk', 'Mugrog'],
  dwarf: ['Borin', 'Dwalin', 'Gimrik', 'Thorin', 'Balin', 'Kili', 'Fil', 'Kilim', 'Gror', 'Bombur', 'Glargs', 'Dori', 'Nori', 'Ori', 'Gimli'],
  goblin: ['Snik', 'Snag', 'Grib', 'Pocket', 'Waggle', 'Squeak', 'Gizmo', 'Twitch', 'Blitz', 'Nips', 'Zap', 'Fizz', 'Bibble', 'Drift', 'Pip'],
  nightelf: ['Shandris', 'Malfurion', 'Tyrande', 'Illidan', 'Kael', 'Vashj', 'Kurthos', 'Nighthawk', 'Shadowmend', 'Duskwalker', 'Starlight', 'Raven', 'Voidtouched', 'Nyx', 'Eclipse']
};

const LAST_NAMES: Record<FactionType, string[]> = {
  human: ['Stormwind', 'Ironforge', 'Brightblade', 'Shadowalker', 'Flameheart', 'Starflight', 'Frostborn', 'Goldmane', 'Silverthorn', 'Whitehall'],
  elf: ['Moonwhisper', 'Stargazer', 'Silverleaf', 'Greenshade', 'Dawnbringer', 'Nightbreeze', 'Everlasting', 'Timeless', 'Ancientheart', 'Wildwood'],
  orc: ['Bloodfist', 'Skullcrusher', 'Bonegnawer', 'Doomhammer', 'Warmonger', 'Deathbringer', 'Soulrender', 'Felhammer', 'Bloodrage', 'Thunderlord'],
  dwarf: ['Stonefist', 'Deepmine', 'Ironbeard', 'Goldvein', 'Forgefire', 'Anvilborn', 'Hammerfall', 'Stormhammer', 'Bronzeankle', 'Longbeard'],
  goblin: ['Quickfingers', 'Sparkgear', 'Tinylogue', 'Gadgetron', 'Boomco', 'Zapmore', 'Sprocketwit', 'Geargrabber', 'Cogspin', 'Tinkerton'],
  nightelf: ['Shadowdancer', 'Duskwalker', 'Voidwhisper', 'Nightbloom', 'Starlance', 'Dreadmourn', 'Moonshadow', 'Twilightfern', 'Dreamweaver', 'Ebonblade']
};

const COACH_NAMES: Record<FactionType, string[]> = {
  human: ['Coach Morgan', 'Captain Blake', 'Manager Sterling', 'Headhunter Cole', 'Director Vance'],
  elf: ['Lord Caelindor', 'Master Sylas', 'Elder Thandril', 'Keeper Aelric', 'Guide Mirenthal'],
  orc: ['Warlord Korg', 'Chieftain Grimtor', 'Leader Fang', 'Chief Rokdum', 'Boss Mog'],
  dwarf: ['Foreman Grundel', 'Master Dwyar', 'Lord Balgrim', 'Elder Stonehelm', 'Captain Bruni'],
  goblin: ['Boss Knuckles', 'Chief Twitch', 'Manager Sprocket', 'Director Zap', 'Head Nips'],
  nightelf: ['Shadowmaster Vael', 'Nightlord Osik', 'Twilight Keeper', 'Voidlord Kel', 'Dreamer Mortho']
};

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayerId(): string {
  return `p_${Date.now()}_${randomInt(1000, 9999)}`;
}

function generateStatValue(base: number, variance: number): number {
  const value = base + randomInt(-variance, variance);
  return Math.max(20, Math.min(100, value));
}

function calculatePrice(role: PlayerRole, stats: PlayerStats): number {
  const avgStat = (stats.batting + stats.bowling + stats.power + stats.technique) / 4;
  const roleBonus = role === 'allrounder' ? 1.3 : role === 'batsman' ? 1.2 : 1.0;
  // Scaled price appropriately for 20-100 stats
  return Math.floor((avgStat * 1000 + randomInt(-2000, 5000)) * roleBonus);
}

export function generatePlayer(role: PlayerRole, isYouth: boolean = false): Player {
  const faction = randomElement([
    'human', 'human', 'human',
    'elf', 'elf',
    'orc', 'orc',
    'dwarf',
    'goblin', 'goblin',
    'nightelf'
  ]) as FactionType;

  // Balanced base stats for 180-200 run target in the 20-100 scale. Youth players have much lower starting stats.
  const baseStats = {
    batsman: { batting: isYouth ? 30 : 60, bowling: 15, power: isYouth ? 25 : 50, technique: isYouth ? 30 : 60, fielding: isYouth ? 40 : 60 },
    allrounder: { batting: isYouth ? 25 : 50, bowling: isYouth ? 25 : 50, power: isYouth ? 20 : 40, technique: isYouth ? 20 : 40, fielding: isYouth ? 50 : 70 },
    bowler: { batting: 15, bowling: isYouth ? 35 : 70, power: isYouth ? 20 : 25, technique: isYouth ? 20 : 25, fielding: isYouth ? 30 : 50 },
    wicketkeeper: { batting: isYouth ? 25 : 50, bowling: 10, power: isYouth ? 20 : 40, technique: isYouth ? 35 : 70, fielding: isYouth ? 50 : 80 }
  }[role];

  // 15% chance of being WK, 10% chance of captain potential
  const isWK = role === 'batsman' && Math.random() < 0.15;
  const isCaptain = !isYouth && Math.random() < 0.10; // Youth can't be captains

  let bowlingType: any = 'none';
  if (role === 'bowler' || role === 'allrounder') {
      bowlingType = randomElement(['pacer', 'fast', 'swinger', 'spinner']);
  }

  // Increased variance for wider spread across 20-100 scale
  const stats: PlayerStats = {
    batting: generateStatValue(baseStats.batting, 15),
    bowling: generateStatValue(baseStats.bowling, 15),
    power: generateStatValue(baseStats.power, 15),
    technique: generateStatValue(baseStats.technique, 15),
    fielding: generateStatValue(baseStats.fielding, 15)
  };

  const firstName = randomElement(FIRST_NAMES[faction]);
  const lastName = randomElement(LAST_NAMES[faction]);
  const name = `${firstName} ${lastName}`;

  const battingType = Math.random() > 0.3 ? 'RHB' : 'LHB';
  
  let battingRole: 'Top Order' | 'Middle Order' | 'Finisher' | 'Tail Ender' = 'Middle Order';
  if (role === 'bowler') {
      battingRole = 'Tail Ender';
  } else if (stats.technique >= stats.power + 10) {
      battingRole = 'Top Order';
  } else if (stats.power >= stats.technique + 10) {
      battingRole = 'Finisher';
  }

  const price = isYouth ? randomInt(2000, 8000) : calculatePrice(role, stats);
  const age = isYouth ? randomInt(18, 20) : randomInt(21, 38);

  return {
    id: generatePlayerId(),
    name,
    role,
    bowlingType,
    battingType,
    battingRole,
    faction,
    stats,
    special: {
      isCaptain: isCaptain,
      captainBonus: isCaptain ? randomInt(-15, 25) : 0,
      isWicketKeeper: isWK,
      wkBonus: isWK ? randomInt(10, 25) : 0
    },
    fatigue: 0,
    morale: 50,
    isAvailable: true,
    price: price,
    form: isYouth ? 0 : randomInt(-5, 5),
    matches: isYouth ? 0 : randomInt(0, 50),
    runsScored: isYouth ? 0 : randomInt(0, 500),
    wickets: (role === 'bowler' && !isYouth) ? randomInt(0, 30) : 0,
    age: age,
    marketValue: price,
    potential: isYouth ? generateStatValue(85, 12) : generateStatValue(80, 10),
    isScouted: !isYouth, // Youth players are NOT scouted by default
    portraitId: randomInt(1, 1000),
    tournamentStats: {
      runs: 0,
      wickets: 0
    }
  };
}

export function generatePlayerPool(count: number = 30, generateYouth: boolean = false): Player[] {
  const players: Player[] = [];
  const roles: PlayerRole[] = ['batsman', 'allrounder', 'bowler', 'wicketkeeper'];
  
  for (let i = 0; i < count; i++) {
    const roleWeights = [0.35, 0.25, 0.25, 0.15];
    const roll = Math.random();
    let role: PlayerRole = 'batsman';
    let cumulative = 0;
    
    for (let j = 0; j < roles.length; j++) {
      cumulative += roleWeights[j];
      if (roll < cumulative) {
        role = roles[j];
        break;
      }
    }
    
    players.push(generatePlayer(role, generateYouth));
  }
  
  return players;
}

export function generateTeamName(faction?: FactionType): string {
  const prefixes = ['Shadow', 'Night', 'Iron', 'Steel', 'Storm', 'Blood', 'Thunder', 'Frost', 'Void', 'Star', 'Dragon', 'Phoenix', 'Titan', 'Raven', 'Wolf'];
  const suffixes = ['Strikers', 'Warriors', 'Legion', 'Guardians', 'Raiders', 'Knights', 'Scouts', 'Vanguard', 'Sentinels', 'Clash', 'Smash', 'Blaze', 'Fury', 'Rage', 'Sons', 'Band'];
  
  if (faction) {
    const factionNames: Record<FactionType, string[]> = {
      human: ['Royal', 'Noble', 'Imperial'],
      elf: ['Ancient', 'Eternal', 'Mystic'],
      orc: ['Savage', 'Fierce', 'Brutal'],
      dwarf: ['Sturdy', 'Unbreakable', 'Deep'],
      goblin: ['Quick', 'Sneaky', 'Clever'],
      nightelf: ['Dark', 'Secret', 'Silent']
    };
    return `${randomElement(factionNames[faction])} ${randomElement(suffixes)}`;
  }
  
  return `${randomElement(prefixes)} ${randomElement(suffixes)}`;
}

export function generateCoachName(faction?: FactionType): string {
  if (!faction) {
    faction = randomElement(Object.keys(FIRST_NAMES)) as FactionType;
  }
  return randomElement(COACH_NAMES[faction]);
}

export function sortPlayersByRole(players: Player[]): Record<PlayerRole, Player[]> {
  return {
    batsman: players.filter(p => p.role === 'batsman'),
    allrounder: players.filter(p => p.role === 'allrounder'),
    bowler: players.filter(p => p.role === 'bowler'),
    wicketkeeper: players.filter(p => p.role === 'wicketkeeper')
  };
}

export function filterAffordablePlayers(players: Player[], budget: number): Player[] {
  return players.filter(p => p.isAvailable && p.price <= budget);
}
