import { useMemo } from 'react';
import { useGame } from '../state/GameContext';

export const darkColors = {
  background: '#090d16',      // Dark obsidian background
  surface: '#121826',         // Card surface dark blue-grey
  surfaceLight: '#1d263b',    // Lighter card surface
  border: '#1f2a45',          // Subtle border outline
  text: '#ffffff',            // White title text
  textSecondary: '#94a3b8',   // Cool grey description text
  textMuted: '#64748b',       // Dimmest label text
  
  // Brand & UI Accents
  primary: '#6366f1',         // Electric Indigo
  primaryLight: '#818cf8',
  secondary: '#10b981',       // Mint Emerald
  warning: '#f59e0b',         // Warm Amber
  danger: '#ef4444',          // Crimson Red
  info: '#06b6d4',             // Cyan
  
  // Faction specific accent colors (Hex)
  factions: {
    human: '#0969da',
    elf: '#1a7f37',
    orc: '#cf222e',
    dwarf: '#9a6700',
    goblin: '#8250df',
    nightelf: '#0598bc'
  }
};

export const lightColors = {
  background: '#f5f2eb',      // Warm light sand background
  surface: '#faf9f6',         // Soft clean card surface
  surfaceLight: '#e7e2d4',    // Elevated section surface
  border: '#cfcac0',          // Muted light border
  text: '#0f172a',            // Dark slate text
  textSecondary: '#334155',   // Medium slate text
  textMuted: '#64748b',       // Neutral grey text
  
  // Brand & UI Accents
  primary: '#4f46e5',         // Royal Indigo
  primaryLight: '#6366f1',
  secondary: '#059669',       // Clean Emerald
  warning: '#ea580c',         // Rich Amber
  danger: '#dc2626',          // Red
  info: '#0891b2',             // Dark Cyan
  
  // Faction specific accent colors (Hex)
  factions: {
    human: '#0969da',
    elf: '#1a7f37',
    orc: '#cf222e',
    dwarf: '#9a6700',
    goblin: '#8250df',
    nightelf: '#0598bc'
  }
};

export const THEME = {
  colors: darkColors, // fallback static reference
  
  fonts: {
    regular: 'System',          // Default iOS/Android system font
    medium: 'System',
    bold: 'System',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 20,
    round: 9999,
  },
  
  shadows: {
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    hard: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 10,
    }
  }
};

export function useStyles<T>(stylesCreator: (colors: typeof darkColors) => T): T {
  const { theme } = useGame();
  const colors = theme === 'light' ? lightColors : darkColors;
  return useMemo(() => stylesCreator(colors), [theme]);
}

export function useThemeColors() {
  const { theme } = useGame();
  return theme === 'light' ? lightColors : darkColors;
}
