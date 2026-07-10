import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Player } from '../models/player';
import { THEME, useStyles, useThemeColors, darkColors } from '../utils/theme';
import { getPortraitAsset } from '../utils/portraitMap';

interface Props {
  player: Player;
  onPress?: () => void;
  showPrice?: boolean;
  isStartingXI?: boolean;
  isCaptain?: boolean;
  isKeeper?: boolean;
  isReserve?: boolean;
  teamColorPrimary?: string;
  teamColorSecondary?: string;
}

const PlayerCardComponent: React.FC<Props> = ({
  player,
  onPress,
  showPrice = false,
  isStartingXI = false,
  isCaptain = false,
  isKeeper = false,
  isReserve = false,
  teamColorPrimary,
  teamColorSecondary,
}) => {
  const colors = useThemeColors();
  const styles = useStyles(stylesCreator);
  const isInjured = !!player.activeInjury;
  const portrait = getPortraitAsset(player.faction, player.portraitId || 1);

  // Faction badges
  const factionIcons: Record<string, string> = {
    human: '⚔️',
    elf: '🌿',
    orc: '🪓',
    dwarf: '⛏️',
    goblin: '💎',
    nightelf: '🌙',
  };

  const factionAccentColors: Record<string, string> = {
    human: '#0969da',
    elf: '#1a7f37',
    orc: '#cf222e',
    dwarf: '#9a6700',
    goblin: '#8250df',
    nightelf: '#0598bc',
  };

  const leftBorderColor = teamColorPrimary || factionAccentColors[player.faction] || colors.primary;
  const secondaryColor = teamColorSecondary || colors.secondary;

  // Stat color helpers
  const getStatColor = (value: number) => {
    if (value >= 70) return colors.secondary; // green
    if (value >= 45) return colors.warning;   // orange
    return colors.danger;                     // red
  };

  // Form/Morale color
  const getMoraleColor = (val: number) => {
    if (val >= 70) return colors.secondary;
    if (val >= 40) return colors.textSecondary;
    return colors.danger;
  };

  // Fatigue color
  const getFatigueColor = (val: number) => {
    if (val >= 70) return colors.danger;
    if (val >= 40) return colors.warning;
    return colors.secondary;
  };

  const roleSummary = `${player.role.toUpperCase()} • ${player.battingType || 'RHB'}`;

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { borderLeftColor: leftBorderColor },
        !player.isAvailable && styles.cardUnavailable
      ]} 
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Background Faction Watermark */}
      <View style={styles.cardWatermarkContainer} pointerEvents="none">
        <Text style={styles.cardWatermarkText}>
          {player.faction.toUpperCase()} {factionIcons[player.faction] || '🛡️'}
        </Text>
      </View>
      <View style={styles.cardHeader}>
        {/* Avatar container */}
        <View style={styles.avatarContainer}>
          <Image source={portrait} style={styles.avatarImg} />
          <View style={styles.factionBadge}>
            <Text style={styles.factionBadgeText}>{factionIcons[player.faction] || '🛡️'}</Text>
          </View>
        </View>

        {/* Info Area */}
        <View style={styles.infoArea}>
          <Text style={styles.playerName} numberOfLines={1}>
            {player.name}
          </Text>
          <Text style={styles.playerRole}>{roleSummary} (Age {player.age})</Text>
          
          <View style={styles.badgeRow}>
            {isInjured && <View style={[styles.badge, styles.badgeInjured]}><Text style={styles.badgeText}>INJ</Text></View>}
            {isStartingXI && <View style={[styles.badge, styles.badgeXI]}><Text style={styles.badgeText}>XI</Text></View>}
            {isCaptain && <View style={[styles.badge, styles.badgeC]}><Text style={styles.badgeText}>C</Text></View>}
            {isKeeper && <View style={[styles.badge, styles.badgeWK]}><Text style={styles.badgeText}>WK</Text></View>}
            {isReserve && <View style={[styles.badge, styles.badgeRes]}><Text style={styles.badgeText}>RES</Text></View>}
            <View style={[styles.badge, styles.badgeXP]}><Text style={styles.badgeText}>✨ {player.xp || 0}</Text></View>
          </View>
        </View>
      </View>

      {/* Stats section */}
      <View style={styles.statsSection}>
        {/* Batting */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>BAT</Text>
          <View style={styles.statBarBg}>
            <LinearGradient
              colors={[leftBorderColor, getStatColor(player.stats.batting)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.statBarFill, { width: `${player.stats.batting}%` }]}
            />
          </View>
          <Text style={styles.statValue}>{Math.round(player.stats.batting)}</Text>
        </View>

        {/* Bowling */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>BOWL</Text>
          <View style={styles.statBarBg}>
            <LinearGradient
              colors={[leftBorderColor, getStatColor(player.stats.bowling)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.statBarFill, { width: `${player.stats.bowling}%` }]}
            />
          </View>
          <Text style={styles.statValue}>{Math.round(player.stats.bowling)}</Text>
        </View>

        {/* Power */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>PWR</Text>
          <View style={styles.statBarBg}>
            <LinearGradient
              colors={[leftBorderColor, getStatColor(player.stats.power)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.statBarFill, { width: `${player.stats.power}%` }]}
            />
          </View>
          <Text style={styles.statValue}>{Math.round(player.stats.power)}</Text>
        </View>

        {/* Technique */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>TECH</Text>
          <View style={styles.statBarBg}>
            <LinearGradient
              colors={[leftBorderColor, getStatColor(player.stats.technique)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.statBarFill, { width: `${player.stats.technique}%` }]}
            />
          </View>
          <Text style={styles.statValue}>{Math.round(player.stats.technique)}</Text>
        </View>

        {/* Fielding */}
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>FLD</Text>
          <View style={styles.statBarBg}>
            <LinearGradient
              colors={[leftBorderColor, getStatColor(player.stats.fielding || 60)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.statBarFill, { width: `${player.stats.fielding || 60}%` }]}
            />
          </View>
          <Text style={styles.statValue}>{Math.round(player.stats.fielding || 60)}</Text>
        </View>
      </View>

      {/* Mini grid: Form and Fatigue */}
      <View style={styles.miniGrid}>
        <View style={styles.miniStatBox}>
          <Text style={styles.miniStatLabel}>Form / Morale</Text>
          <Text style={[styles.miniStatValue, { color: getMoraleColor(player.morale) }]}>
            {Math.round(player.morale)}%
          </Text>
        </View>
        <View style={styles.miniStatBox}>
          <Text style={styles.miniStatLabel}>Fatigue</Text>
          <Text style={[styles.miniStatValue, { color: getFatigueColor(player.fatigue) }]}>
            {Math.round(player.fatigue)}%
          </Text>
        </View>
      </View>

      {showPrice && (
        <View style={styles.priceRow}>
          <Text style={styles.priceText}>Value: ${player.price.toLocaleString()}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  cardUnavailable: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minWidth: 0,
  },
  avatarContainer: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: `${colors.border}`,
    backgroundColor: colors.surfaceLight,
  },
  factionBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factionBadgeText: {
    fontSize: 10,
  },
  infoArea: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    flexShrink: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
  },
  playerRole: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.text,
  },
  badgeInjured: {
    backgroundColor: `${colors.danger}33`,
    borderColor: colors.danger,
  },
  badgeXI: {
    backgroundColor: `${colors.primary}33`,
    borderColor: colors.primaryLight,
  },
  badgeC: {
    backgroundColor: '#b45309', // Amber dark
    borderColor: '#f59e0b',
  },
  badgeWK: {
    backgroundColor: '#0369a1', // Sky dark
    borderColor: '#38bdf8',
  },
  badgeRes: {
    backgroundColor: '#475569',
    borderColor: '#94a3b8',
  },
  badgeXP: {
    backgroundColor: `${colors.secondary}15`,
    borderColor: colors.secondary,
  },
  statsSection: {
    marginTop: 12,
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textMuted,
    width: 36,
  },
  statBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: `${colors.border}66`,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.text,
    width: 20,
    textAlign: 'right',
  },
  miniGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: `${colors.border}44`,
  },
  miniStatBox: {
    flex: 1,
    backgroundColor: `${colors.surfaceLight}44`,
    borderWidth: 1,
    borderColor: `${colors.border}22`,
    borderRadius: 6,
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniStatLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },
  miniStatValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  priceRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.warning,
  },
  cardWatermarkContainer: {
    position: 'absolute',
    right: 12,
    bottom: 24,
    opacity: 0.08,
  },
  cardWatermarkText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
  }
});

export const PlayerCard = React.memo(PlayerCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.isStartingXI === nextProps.isStartingXI &&
    prevProps.isCaptain === nextProps.isCaptain &&
    prevProps.isKeeper === nextProps.isKeeper &&
    prevProps.isReserve === nextProps.isReserve &&
    prevProps.showPrice === nextProps.showPrice &&
    prevProps.teamColorPrimary === nextProps.teamColorPrimary &&
    prevProps.teamColorSecondary === nextProps.teamColorSecondary &&
    prevProps.player.id === nextProps.player.id &&
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.fatigue === nextProps.player.fatigue &&
    prevProps.player.morale === nextProps.player.morale &&
    prevProps.player.xp === nextProps.player.xp &&
    prevProps.player.isInjured === nextProps.player.isInjured &&
    prevProps.player.form === nextProps.player.form &&
    prevProps.player.isAvailable === nextProps.player.isAvailable &&
    prevProps.player.price === nextProps.player.price &&
    prevProps.player.stats.batting === nextProps.player.stats.batting &&
    prevProps.player.stats.bowling === nextProps.player.stats.bowling
  );
});
