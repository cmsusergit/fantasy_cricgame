import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fantasy_cricket_save';
const STORAGE_KEY_MATCH = 'fantasy_cricket_active_match';

export interface ActiveMatchState {
  matchId: string;
  phase: string;
  innings1: any;
  innings2: any;
  currentInnings: number;
  target: number;
  weather: string;
  pitch: string;
  tossWinner: string | null;
  tossChoice: 'bat' | 'bowl' | null;
  currentBowlerIndex: number;
  selectedBatsmen: string[];
  selectedBowlerId: string | null;
  placeholderBatsman: string | null;
  pendingBowlerSelection: boolean;
  freeHitActive: boolean;
  impactUsed: boolean;
  replacedPlayerId: string | null;
  impactPlayerId: string | null;
  aiImpactUsed: boolean;
  aiReplacedPlayerId: string | null;
  aiImpactPlayerId: string | null;
  savedAt: number;
}

export interface GameSave {
  version: string;
  userTeamId: string;
  teams: any[];
  players: any[];
  tournamentMatches: any[];
  schedule?: any;
  currentDay: number;
  currentSeason: number;
  gamePhase: string;
  isFirstLogin?: boolean;
  userBudget: number;
  savedAt: number;
}

export interface StorageProvider {
  saveGame(data: GameSave): Promise<boolean>;
  loadGame(): Promise<GameSave | null>;
  clearSave(): Promise<void>;
  hasExistingSave(): Promise<boolean>;
  saveActiveMatch(data: ActiveMatchState): Promise<boolean>;
  loadActiveMatch(): Promise<ActiveMatchState | null>;
  clearActiveMatch(): Promise<void>;
}

class AsyncStorageProvider implements StorageProvider {
  async saveGame(data: GameSave): Promise<boolean> {
    try {
      const saveData: GameSave = {
        ...data,
        version: '1.4.2',
        savedAt: Date.now()
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('Failed to save game to AsyncStorage:', e);
      return false;
    }
  }

  async loadGame(): Promise<GameSave | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data) as GameSave;
    } catch (e) {
      console.error('Failed to load game from AsyncStorage:', e);
      return null;
    }
  }

  async clearSave(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear save:', e);
    }
  }

  async hasExistingSave(): Promise<boolean> {
    try {
      const item = await AsyncStorage.getItem(STORAGE_KEY);
      return item !== null;
    } catch (e) {
      return false;
    }
  }

  async saveActiveMatch(data: ActiveMatchState): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_MATCH, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save active match to AsyncStorage:', e);
      return false;
    }
  }

  async loadActiveMatch(): Promise<ActiveMatchState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_MATCH);
      if (!data) return null;
      return JSON.parse(data) as ActiveMatchState;
    } catch (e) {
      console.error('Failed to load active match from AsyncStorage:', e);
      return null;
    }
  }

  async clearActiveMatch(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_MATCH);
    } catch (e) {
      console.error('Failed to clear active match:', e);
    }
  }
}

const currentProvider: StorageProvider = new AsyncStorageProvider();

export async function saveGame(data: GameSave): Promise<boolean> {
  return currentProvider.saveGame(data);
}

export async function loadGame(): Promise<GameSave | null> {
  return currentProvider.loadGame();
}

export async function clearSave(): Promise<void> {
  return currentProvider.clearSave();
}

export async function hasExistingSave(): Promise<boolean> {
  return currentProvider.hasExistingSave();
}

export async function saveActiveMatch(data: ActiveMatchState): Promise<boolean> {
  return currentProvider.saveActiveMatch(data);
}

export async function loadActiveMatch(): Promise<ActiveMatchState | null> {
  return currentProvider.loadActiveMatch();
}

export async function clearActiveMatch(): Promise<void> {
  return currentProvider.clearActiveMatch();
}

export async function exportSave(): Promise<string> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data || '';
  } catch (e) {
    return '';
  }
}

export async function importSave(data: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(data);
    if (parsed.version) {
      await AsyncStorage.setItem(STORAGE_KEY, data);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to import save:', e);
    return false;
  }
}

const STORAGE_KEY_THEME = 'fantasy_cricket_theme';

export async function saveTheme(theme: 'light' | 'dark'): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_THEME, theme);
  } catch (e) {
    console.error('Failed to save theme:', e);
  }
}

export async function loadTheme(): Promise<'light' | 'dark'> {
  try {
    const theme = await AsyncStorage.getItem(STORAGE_KEY_THEME);
    return (theme === 'light' ? 'light' : 'dark');
  } catch (e) {
    return 'dark';
  }
}
