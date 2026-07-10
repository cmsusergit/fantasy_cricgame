import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, darkColors } from '../utils/theme';
import { isMegaAuction, calculateRetentionCost, MEGA_AUCTION_MAX_RETENTIONS, MEGA_AUCTION_RETENTION_COSTS } from '../core/retentionSystem';
import { Check, ClipboardList, Info, AlertTriangle } from 'lucide-react-native';

export const RetentionBoard: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const { 
    userTeam, 
    currentSeason, 
    confirmRetentions 
  } = useGame();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isMega = useMemo(() => isMegaAuction(currentSeason), [currentSeason]);

  const playersList = userTeam?.players || [];
  const maxAllowed = isMega ? MEGA_AUCTION_MAX_RETENTIONS : 25;
  const currentBudget = userTeam?.budget || 0;

  // Calculate current retention costs
  const totalCost = useMemo(() => {
    let cost = 0;
    selectedIds.forEach((id, index) => {
      const p = playersList.find(x => x.id === id);
      if (p) {
        cost += calculateRetentionCost(index, p, isMega);
      }
    });
    return cost;
  }, [selectedIds, playersList, isMega]);

  const remainingBudget = currentBudget - totalCost;

  const togglePlayer = (playerId: string) => {
    const isSelected = selectedIds.includes(playerId);
    
    if (isSelected) {
      setSelectedIds(prev => prev.filter(id => id !== playerId));
    } else {
      const player = playersList.find(p => p.id === playerId);
      if (player?.retiring) {
        Alert.alert('Cannot Retain', 'This player has announced their retirement.');
        return;
      }
      
      if (selectedIds.length >= maxAllowed) {
        Alert.alert('Max Reached', `You can retain a maximum of ${maxAllowed} players.`);
        return;
      }

      // Check budget allowance
      const playerCost = calculateRetentionCost(selectedIds.length, player!, isMega);
      if (totalCost + playerCost > currentBudget) {
        Alert.alert('Insufficient Purse', `You cannot afford this retention ($${playerCost.toLocaleString()}).`);
        return;
      }

      setSelectedIds(prev => [...prev, playerId]);
    }
  };

  const handleConfirm = () => {
    Alert.alert(
      'Confirm Retentions',
      'Are you sure you want to lock in these retentions? Unretained players will be released into the auction pool.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: () => {
            const res = confirmRetentions(selectedIds);
            if (!res.success) {
              Alert.alert('Error', res.message);
            } else {
              Alert.alert('Success', 'Retentions locked in! Entering the Scouting phase.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <ClipboardList size={22} stroke={THEME.colors.primaryLight} />
          <Text style={styles.title}>{isMega ? 'Mega' : 'Mini'} Retention Board</Text>
        </View>
        <Text style={styles.subtitle}>Preparing for Season {currentSeason}</Text>
      </View>

      {/* Rules Notice */}
      <View style={isMega ? styles.warnBox : styles.infoBox}>
        {isMega ? (
          <>
            <AlertTriangle size={18} stroke={THEME.colors.warning} />
            <Text style={styles.rulesText}>
              MEGA AUCTION: Max {MEGA_AUCTION_MAX_RETENTIONS} players. Tiered costs apply: {MEGA_AUCTION_RETENTION_COSTS.map(c => `$${c/1000}k`).join(', ')}.
            </Text>
          </>
        ) : (
          <>
            <Info size={18} stroke={THEME.colors.info} />
            <Text style={styles.rulesText}>
              MINI AUCTION: Retain up to squad capacity. Each retention costs the player's current Market Value.
            </Text>
          </>
        )}
      </View>

      {/* Main Layout split: List & Purse Tracker */}
      <ScrollView style={styles.scrollArea}>
        <View style={styles.purseCard}>
          <Text style={styles.purseTitle}>Retention Financial Impact</Text>
          <View style={styles.purseRow}>
            <Text style={styles.purseLabel}>Initial purse</Text>
            <Text style={styles.purseVal}>${currentBudget.toLocaleString()}</Text>
          </View>
          <View style={styles.purseRow}>
            <Text style={styles.purseLabel}>Retention fee deductions</Text>
            <Text style={[styles.purseVal, { color: THEME.colors.danger }]}>
              -${totalCost.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.purseRow, styles.purseRowTotal]}>
            <Text style={styles.purseTotalLabel}>Available Auction Purse</Text>
            <Text style={[styles.purseTotalVal, { color: THEME.colors.secondary }]}>
              ${remainingBudget.toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Squad Roster ({selectedIds.length}/{maxAllowed} Selected)</Text>

        {playersList.map((p, index) => {
          const isSelected = selectedIds.includes(p.id);
          const pIndex = selectedIds.indexOf(p.id);
          const pCost = isSelected ? calculateRetentionCost(pIndex, p, isMega) : calculateRetentionCost(selectedIds.length, p, isMega);

          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.playerRow,
                isSelected && styles.playerRowSelected,
                p.retiring && styles.playerRowDisabled
              ]}
              disabled={p.retiring}
              onPress={() => togglePlayer(p.id)}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerRole}>
                  {p.role.toUpperCase()} • age {p.age} {p.retiring && '• RETIRING'}
                </Text>
                <Text style={styles.playerValue}>Market Value: ${p.marketValue.toLocaleString()}</Text>
              </View>

              <View style={styles.selectionColumn}>
                {p.retiring ? (
                  <Text style={styles.retireText}>Unavailable</Text>
                ) : (
                  <>
                    <Text style={styles.costEstimateText}>
                      Cost: ${pCost.toLocaleString()}
                    </Text>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Check size={14} stroke="#fff" />}
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Confirm Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>
            Confirm Retentions & Release Squad
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: THEME.spacing.xl + 20,
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  warnBox: {
    flexDirection: 'row',
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}44`,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    margin: THEME.spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${colors.info}15`,
    borderColor: `${colors.info}44`,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    margin: THEME.spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  rulesText: {
    color: colors.textSecondary,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: THEME.spacing.md,
  },
  purseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  purseTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
    paddingBottom: 4,
  },
  purseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  purseLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  purseVal: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  purseRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 6,
  },
  purseTotalLabel: {
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  purseTotalVal: {
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: 'monospace',
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: THEME.spacing.sm,
  },
  playerRow: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerRowSelected: {
    borderColor: colors.secondary,
    borderWidth: 2,
    backgroundColor: `${colors.secondary}0a`,
  },
  playerRowDisabled: {
    opacity: 0.5,
  },
  playerInfo: {
    flex: 2,
  },
  playerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  playerRole: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  playerValue: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  selectionColumn: {
    flex: 1.2,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  costEstimateText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  retireText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: colors.surface,
    padding: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmButton: {
    height: 50,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  }
});
