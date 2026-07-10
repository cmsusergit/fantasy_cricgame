import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, darkColors } from '../utils/theme';
import { Award, TrendingUp, Heart, ArrowRight } from 'lucide-react-native';
import type { SeasonAwards } from '../core/seasonTransition';
import type { Player } from '../models/player';

export const SeasonReview: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const { resolveSeasonEnd, setGamePhase, players } = useGame();
  
  const [processing, setProcessing] = useState(true);
  const [awards, setAwards] = useState<SeasonAwards | null>(null);
  const [retiredPlayers, setRetiredPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Resolve season-end results on mount
    const results = resolveSeasonEnd();
    setAwards(results);
    
    // Find retiring players
    const retiring = players.filter(p => p.retiring);
    setRetiredPlayers(retiring);
    
    setProcessing(false);
  }, []);

  const handleProceed = () => {
    setGamePhase('retention');
  };

  if (processing || !awards) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>Processing League Stats & Awards...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>COMPLETED SEASON REVIEW</Text>
        <Text style={styles.headerTitle}>Awards & Financial Recap</Text>
      </View>

      {/* Financial Breakdown */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Financial Summary</Text>
        <View style={styles.finRow}>
          <Text style={styles.finLabel}>League Standing Finish</Text>
          <Text style={styles.finVal}>#{awards.finalStanding}</Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.finLabel}>Franchise Prize Cash</Text>
          <Text style={[styles.finVal, { color: THEME.colors.secondary }]}>
            +${awards.prizeMoney.toLocaleString()}
          </Text>
        </View>
        <View style={styles.finRow}>
          <Text style={styles.finLabel}>Salaries & Maintenance Paid</Text>
          <Text style={[styles.finVal, { color: THEME.colors.danger }]}>
            -${awards.salaryPaid.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Award Winners */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>League MVP & Leaders</Text>
        
        {awards.mvp && (
          <View style={styles.awardCard}>
            <View style={styles.awardHeader}>
              <Award size={16} stroke={THEME.colors.warning} />
              <Text style={styles.awardTitleText}>MOST VALUABLE PLAYER</Text>
            </View>
            <Text style={styles.awardPlayerName}>{awards.mvp.name}</Text>
            <Text style={styles.awardPlayerDesc}>
              {awards.mvp.role.toUpperCase()} • Runs: {awards.mvp.runsScored} / Wkts: {awards.mvp.wickets}
            </Text>
          </View>
        )}

        {awards.topScorer && (
          <View style={styles.awardCard}>
            <View style={styles.awardHeader}>
              <Award size={16} stroke={THEME.colors.primaryLight} />
              <Text style={styles.awardTitleText}>ORANGE CAP (RUNS)</Text>
            </View>
            <Text style={styles.awardPlayerName}>{awards.topScorer.name}</Text>
            <Text style={styles.awardPlayerDesc}>
              Runs Scored: {awards.topScorer.runsScored} (career)
            </Text>
          </View>
        )}

        {awards.topWicketTaker && (
          <View style={styles.awardCard}>
            <View style={styles.awardHeader}>
              <Award size={16} stroke={THEME.colors.info} />
              <Text style={styles.awardTitleText}>PURPLE CAP (WICKETS)</Text>
            </View>
            <Text style={styles.awardPlayerName}>{awards.topWicketTaker.name}</Text>
            <Text style={styles.awardPlayerDesc}>
              Wickets Taken: {awards.topWicketTaker.wickets} (career)
            </Text>
          </View>
        )}
      </View>

      {/* Playstyle recalculation list */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Team Playstyle Shifts</Text>
        {awards.teamPlaystyleChanges.map((change, idx) => (
          <View key={idx} style={styles.playstyleRow}>
            <Text style={styles.playstyleTeamName}>{change.teamName}</Text>
            <View style={styles.playstyleShifts}>
              <Text style={styles.shiftLabel}>
                Style: {change.oldPlaystyle === change.newPlaystyle ? (
                  <Text style={styles.newText}>{change.newPlaystyle}</Text>
                ) : (
                  <Text>
                    <Text style={styles.oldText}>{change.oldPlaystyle}</Text> ➔ <Text style={styles.newText}>{change.newPlaystyle}</Text>
                  </Text>
                )}
              </Text>
              <Text style={styles.shiftLabel}>
                Rating: {'⭐'.repeat(change.newStars)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Retirements panel */}
      {retiredPlayers.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Career Retirements</Text>
          <Text style={styles.helperText}>
            The following players have hung up their boots and are removed from active pools:
          </Text>
          {retiredPlayers.map((p, idx) => (
            <View key={idx} style={styles.retiredRow}>
              <Heart size={14} stroke={THEME.colors.danger} />
              <Text style={styles.retiredName}>
                {p.name} (Age {p.age}) - {p.role.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Proceed */}
      <TouchableOpacity style={styles.proceedButton} onPress={handleProceed}>
        <Text style={styles.proceedButtonText}>Proceed to Retentions</Text>
        <ArrowRight size={20} stroke="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: THEME.spacing.md,
    paddingTop: THEME.spacing.xl + 20,
    paddingBottom: THEME.spacing.xl,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: THEME.spacing.md,
    fontSize: 14,
  },
  header: {
    marginBottom: THEME.spacing.md,
  },
  headerSubtitle: {
    color: colors.primaryLight,
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 2,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.md,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}88`,
    paddingBottom: 6,
  },
  finRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  finLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  finVal: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  awardCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  awardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  awardTitleText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: 'bold',
  },
  awardPlayerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  awardPlayerDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  playstyleRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}44`,
  },
  playstyleTeamName: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  playstyleShifts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  shiftLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  oldText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  newText: {
    color: colors.info,
    fontWeight: '600',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: THEME.spacing.sm,
  },
  retiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  retiredName: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  proceedButton: {
    height: 52,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: THEME.spacing.md,
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
