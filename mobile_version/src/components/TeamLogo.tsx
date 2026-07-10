import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

interface Props {
  logo: string;
  size?: number;
}

// Shape SVG paths — same as Svelte TeamLogo.svelte
const SHAPES: Record<string, string> = {
  shield:  'M12 2L3 6v6c0 5.5 4.5 10 9 10s9-4.5 9-10V6l-9-4z',
  circle:  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  diamond: 'M12 2L2 12l10 10 10-10L12 2z',
  hexagon: 'M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z',
};

// Symbol emoji/text fallbacks for each symbol key (since RN can't render 1MB SVG paths)
const SYMBOL_EMOJI: Record<string, string> = {
  unicorn:        '🦄',
  dragon_fire:    '🔥',
  dragon_serpent: '🐍',
  wizard_magic:   '🧙',
  tree_of_life:   '🌳',
  ram_horns:      '🐏',
  demon_horns:    '😈',
  valkyrie_helmet:'⚔️',
  gargoyle_statue:'🗿',
  gargoyle_wings: '🦇',
  archer_bow:     '🏹',
  elven_bow:      '🏹',
  hunter_bow:     '🏹',
  siren_tail:     '🧜',
  crest_ornament: '✨',
  crest_filigree: '👑',
  shield_filigree:'🛡️',
  crown_filigree: '👑',
  star_filigree:  '⭐',
  mystic_symbol:  '🔮',
  sword:          '⚔️',
  crown:          '👑',
  lightning:      '⚡',
  star:           '⭐',
  wolf:           '🐺',
  dragon:         '🐉',
};

const TeamLogoComponent: React.FC<Props> = ({ logo = 'logo_shield', size = 24 }) => {
  const isCustom = logo.startsWith('custom|');

  if (!isCustom) {
    if (!logo.startsWith('logo_')) {
      // Render fallback emoji character
      return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: size * 0.8, lineHeight: size, textAlign: 'center' }}>{logo}</Text>
        </View>
      );
    }
    // Default: plain shield
    return (
      <Svg viewBox="0 0 24 24" width={size} height={size}>
        <Path d={SHAPES.shield} fill="#1e40af" />
      </Svg>
    );
  }

  const parts = logo.split('|');
  const bgShape  = parts[1] || 'shield';
  const bgColor  = parts[2] || '#1e40af';
  const symbol   = parts[3] || 'sword';
  const symColor = parts[4] || '#fbbf24';

  const shapePath = SHAPES[bgShape] || SHAPES.shield;
  const emoji = SYMBOL_EMOJI[symbol] || '🏏';
  const emojiSize = Math.round(size * 0.45);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background shape */}
      <Svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={{ position: 'absolute' }}
      >
        <Path d={shapePath} fill={bgColor} />
      </Svg>
      {/* Symbol emoji centered on top */}
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 2, textAlign: 'center' }}>
        {emoji}
      </Text>
    </View>
  );
};

export const TeamLogo = React.memo(TeamLogoComponent);
