/**
 * TrainingScreen.tsx
 * Ported from: src/routes/training/+page.svelte
 * 
 * Allows selecting a player and training their stats via:
 *   - Credit-based training (trainPlayer from trainingLab)
 *   - XP-based upgrades (upgradePlayerStat from GameContext)
 * Exactly mirrors the original Svelte training lab logic.
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles } from '../utils/theme';
import { getTrainingOptions, trainPlayer } from '../core/trainingLab';
import type { Player } from '../models/player';

interface Props {
  onBack: () => void;
}

// Exact same XP upgrade cost table as Svelte training/+page.svelte
function getXpUpgradeCost(currentLevel: number): { xp: number; credits: number } {
  if (currentLevel <= 50) return { xp: 100, credits: 5000 };
  if (currentLevel <= 75) return { xp: 250, credits: 15000 };
  if (currentLevel <= 90) return { xp: 500, credits: 50000 };
  return { xp: 1000, credits: 150000 };
}

const STAT_LABELS: Record<string, string> = {
  batting: 'Batting',
  bowling: 'Bowling',
  power: 'Power',
  technique: 'Technique',
  fielding: 'Fielding',
};

export const TrainingScreen: React.FC<Props> = ({ onBack }) => {
  const styles = useStyles(stylesCreator);
  const { userTeam, upgradePlayerStat, trainPlayerStat, saveCurrentGame } = useGame();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const budget = userTeam?.budget || 0;

  const trainingOptions = useMemo(() => {
    if (!selectedPlayer) return [];
    return getTrainingOptions(selectedPlayer);
  }, [selectedPlayer]);

  const canXpUpgrade = (stat: number): boolean => {
    if (stat >= 100) return false;
    const cost = getXpUpgradeCost(stat);
    return (selectedPlayer?.xp || 0) >= cost.xp && budget >= cost.credits;
  };

  const handleTraining = (statType: string) => {
    if (!selectedPlayer || !userTeam) return;
    const option = trainingOptions.find(o => o.type === statType);
    if (!option) return;

    if (budget < option.cost) {
      Alert.alert('Not Enough Budget', `Training costs $${option.cost.toLocaleString()}.`);
      return;
    }

    const result = trainPlayer(selectedPlayer, statType as any);
    if (result.success) {
      const currentStat = (selectedPlayer.stats as any)[statType] ?? 0;
      const increment = result.newStat - currentStat;
      trainPlayerStat(selectedPlayer.id, statType as any, result.cost, increment);
      setSelectedPlayer(prev => prev ? {
        ...prev,
        stats: { ...prev.stats, [statType]: result.newStat }
      } : null);
      Alert.alert('Training Complete', result.message);
    } else {
      Alert.alert('Training Failed', result.message);
    }
  };

  const handleXpUpgrade = (statName: string, currentLevel: number) => {
    if (!selectedPlayer || !userTeam || !canXpUpgrade(currentLevel)) return;
    const cost = getXpUpgradeCost(currentLevel);
    upgradePlayerStat(selectedPlayer.id, 'user_team', statName as any, cost.xp, cost.credits);
    setSelectedPlayer(prev => prev ? {
      ...prev,
      stats: { ...prev.stats, [statName]: Math.min(100, currentLevel + 1) },
      xp: Math.max(0, (prev.xp || 0) - cost.xp)
    } : null);
    Alert.alert('Upgrade Applied', `${statName} raised to ${Math.min(100, currentLevel + 1)}!`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>🏋️ Training Lab</Text>
          <Text style={styles.subtitle}>Budget: ${budget.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Player List */}
        <Text style={styles.sectionLabel}>Select Player</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerRow}>
          {(userTeam?.players || []).map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.playerChip, selectedPlayer?.id === p.id && styles.playerChipActive]}
              onPress={() => setSelectedPlayer(p)}
            >
              <Text style={[styles.playerChipName, selectedPlayer?.id === p.id && styles.playerChipNameActive]}>
                {p.name}
              </Text>
              <Text style={styles.playerChipRole}>{p.role}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Training Options */}
        {selectedPlayer ? (
          <View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerInfoName}>{selectedPlayer.name}</Text>
              <Text style={styles.playerInfoDetail}>
                {selectedPlayer.role.toUpperCase()} • XP: {selectedPlayer.xp || 0} • Faction: {selectedPlayer.faction}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Stats & Training</Text>
            {(Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map(stat => {
              const currentLevel = (selectedPlayer.stats as any)[stat] ?? 0;
              const trainingOpt = trainingOptions.find(o => o.type === stat);
              const xpCost = getXpUpgradeCost(currentLevel);
              const xpEligible = canXpUpgrade(currentLevel);

              return (
                <View key={stat} style={styles.statRow}>
                  <View style={styles.statInfo}>
                    <Text style={styles.statName}>{STAT_LABELS[stat]}</Text>
                    <View style={styles.statBarBg}>
                      <View style={[styles.statBarFill, { width: `${currentLevel}%` }]} />
                    </View>
                    <Text style={styles.statValue}>{currentLevel}/100</Text>
                  </View>
                  <View style={styles.statActions}>
                    {trainingOpt && (
                      <TouchableOpacity
                        style={[styles.trainBtn, budget < trainingOpt.cost && styles.trainBtnDisabled]}
                        onPress={() => handleTraining(stat)}
                        disabled={budget < trainingOpt.cost}
                      >
                        <Text style={styles.trainBtnText}>Train</Text>
                        <Text style={styles.trainBtnCost}>${trainingOpt.cost.toLocaleString()}</Text>
                      </TouchableOpacity>
                    )}
                    {currentLevel < 100 && (
                      <TouchableOpacity
                        style={[styles.xpBtn, !xpEligible && styles.trainBtnDisabled]}
                        onPress={() => handleXpUpgrade(stat, currentLevel)}
                        disabled={!xpEligible}
                      >
                        <Text style={styles.xpBtnText}>XP+1</Text>
                        <Text style={styles.xpBtnCost}>{xpCost.xp}xp</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Select a player above to view training options.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const stylesCreator = (colors: typeof THEME.colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingTop: THEME.spacing.lg,
    paddingBottom: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: THEME.spacing.sm,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  backBtnText: { color: colors.textSecondary, fontSize: 13 },
  headerTitle: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  content: { flex: 1, padding: THEME.spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: THEME.spacing.sm,
  },
  playerRow: { marginBottom: THEME.spacing.md },
  playerChip: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  playerChipActive: {
    borderColor: colors.primaryLight,
    backgroundColor: `${colors.primary}33`,
  },
  playerChipName: { fontSize: 12, fontWeight: 'bold', color: colors.textSecondary },
  playerChipNameActive: { color: colors.text },
  playerChipRole: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  playerInfo: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerInfoName: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  playerInfoDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: THEME.spacing.sm,
  },
  statInfo: { flex: 1 },
  statName: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 },
  statBarBg: {
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  statBarFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  statValue: { fontSize: 11, color: colors.textMuted },
  statActions: { flexDirection: 'row', gap: 6 },
  trainBtn: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  trainBtnDisabled: { opacity: 0.4 },
  trainBtnText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  trainBtnCost: { fontSize: 9, color: 'rgba(255,255,255,0.75)' },
  xpBtn: {
    backgroundColor: `${colors.secondary}cc`,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  xpBtnText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  xpBtnCost: { fontSize: 9, color: 'rgba(255,255,255,0.75)' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyStateText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
