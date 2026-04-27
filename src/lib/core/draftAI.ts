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
  return Math.max(10, Math.min(99, value));
}

function calculatePrice(role: PlayerRole, stats: PlayerStats): number {
  const avgStat = (stats.batting + stats.bowling + stats.power + stats.technique) / 4;
  const roleBonus = role === 'allrounder' ? 1.3 : role === 'batsman' ? 1.2 : 1.0;
  // Lower base, scaled price appropriately
  return Math.floor((avgStat * 5000 + randomInt(-2000, 5000)) * roleBonus);
}

export function generatePlayer(role: PlayerRole): Player {
  const faction = randomElement([
    'human', 'human', 'human',
    'elf', 'elf',
    'orc', 'orc',
    'dwarf',
    'goblin', 'goblin',
    'nightelf'
  ]) as FactionType;

  // Balanced base stats for 180-200 run target
  const baseStats = {
    batsman: { batting: 12, bowling: 5, power: 10, technique: 12 },
    allrounder: { batting: 10, bowling: 10, power: 8, technique: 8 },
    bowler: { batting: 5, bowling: 14, power: 9, technique: 8 },
    wicketkeeper: { batting: 10, bowling: 4, power: 8, technique: 14 }
  }[role];

  // 15% chance of being WK, 10% chance of captain potential
  const isWK = role === 'batsman' && Math.random() < 0.15;
  const isCaptain = Math.random() < 0.10;

  // Reduced variance for more balanced gameplay
  const stats: PlayerStats = {
    batting: generateStatValue(baseStats.batting, 5),
    bowling: generateStatValue(baseStats.bowling, 4),
    power: generateStatValue(baseStats.power, 4),
    technique: generateStatValue(baseStats.technique, 4)
  };

  const firstName = randomElement(FIRST_NAMES[faction]);
  const lastName = randomElement(LAST_NAMES[faction]);
  const name = `${firstName} ${lastName}`;

  return {
    id: generatePlayerId(),
    name,
    role,
    faction,
    stats,
    special: {
      isCaptain: isCaptain,
      captainBonus: isCaptain ? randomInt(-3, 5) : 0,
      isWicketKeeper: isWK,
      wkBonus: isWK ? randomInt(2, 5) : 0
    },
    fatigue: 0,
    morale: 50,
    isAvailable: true,
    price: calculatePrice(role, stats),
    form: randomInt(-5, 5),
    matches: randomInt(0, 50),
    runsScored: randomInt(0, 500),
    wickets: role === 'bowler' ? randomInt(0, 30) : 0
  };
}

export function generatePlayerPool(count: number = 30): Player[] {
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
    
    players.push(generatePlayer(role));
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
