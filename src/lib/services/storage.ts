const STORAGE_KEY = 'fantasy_cricket_save';

export interface GameSave {
  version: string;
  userTeamId: string;
  teams: any[];
  players: any[];
  tournamentMatches: any[];
  schedule?: any;
  currentDay: number;
  userBudget: number;
  savedAt: number;
}

export function saveGame(data: GameSave): boolean {
  try {
    const saveData: GameSave = {
      ...data,
      version: '1.4.2',
      savedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) {
    console.error('Failed to save game:', e);
    return false;
  }
}

export function loadGame(): GameSave | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as GameSave;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasExistingSave(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
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