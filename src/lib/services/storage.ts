const STORAGE_KEY = 'fantasy_cricket_save';

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

// Flexible interface for future database expansion
export interface StorageProvider {
  saveGame(data: GameSave): Promise<boolean>;
  loadGame(): Promise<GameSave | null>;
  clearSave(): Promise<void>;
  hasExistingSave(): Promise<boolean>;
}

class LocalStorageProvider implements StorageProvider {
  async saveGame(data: GameSave): Promise<boolean> {
    try {
      const saveData: GameSave = {
        ...data,
        version: '1.4.2',
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      console.error('Failed to save game to localStorage:', e);
      return false;
    }
  }

  async loadGame(): Promise<GameSave | null> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      return JSON.parse(data) as GameSave;
    } catch (e) {
      console.error('Failed to load game from localStorage:', e);
      return null;
    }
  }

  async clearSave(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }

  async hasExistingSave(): Promise<boolean> {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
}

// Current active provider
const currentProvider: StorageProvider = new LocalStorageProvider();

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

export function exportSave(): string {
  const data = localStorage.getItem(STORAGE_KEY);
  return data || '';
}

export function importSave(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    if (parsed.version) {
      localStorage.setItem(STORAGE_KEY, data);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to import save:', e);
    return false;
  }
}