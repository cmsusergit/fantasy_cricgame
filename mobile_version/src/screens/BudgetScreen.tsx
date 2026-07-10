/**
 * BudgetScreen.tsx
 * Ported from: src/routes/budget/+page.svelte
 * 
 * Displays:
 *   - Current balance, total squad value, estimated match earnings
 *   - Income overview (match earnings + sponsorships)
 *   - Expenditure overview (player salaries @10% of value, staff salaries, facility maintenance)
 *   - Sponsorship cap: max 1 normally, max 2 after tournament win or 5+ popularityStreak
 * Exactly mirrors the original Svelte budget page logic.
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, useThemeColors, darkColors } from '../utils/theme';
import { FACILITY_MAINTENANCE_COSTS } from '../models/staff';

interface Props {
  onBack: () => void;
}

export const BudgetScreen: React.FC<Props> = ({ onBack }) => {
  const styles = useStyles(stylesCreator);
  const colors = useThemeColors();
  const { userTeam } = useGame();

  // All derived values from Svelte budget/+page.svelte
  const totalSquadValue = useMemo(
    () => userTeam?.players.reduce((sum, p) => sum + p.price, 0) || 0,
    [userTeam]
  );

  const totalPlayerSalaries = useMemo(
    () => userTeam?.players.reduce((sum, p) => sum + p.price * 0.10, 0) || 0,
    [userTeam]
  );

  const totalStaffSalaries = useMemo(
    () => userTeam?.staff?.reduce((sum, s) => sum + s.salary, 0) || 0,
    [userTeam]
  );

  const totalMatchEarningsEst = useMemo(
    () => (userTeam?.matchesPlayed || 0) * 10000 + (userTeam?.wins || 0) * 50000,
    [userTeam]
  );

  // Exact same formula as Svelte budget/+page.svelte line 19-23
  const maxSponsors = useMemo(() => {
    if (!userTeam) return 1;
    return (userTeam.tournamentWins > 0 || (userTeam.fanProfile?.popularityStreak || 0) >= 5) ? 2 : 1;
  }, [userTeam]);

  const activeSponsorshipsCount = useMemo(
    () => userTeam?.sponsorships?.filter((s: any) => s.active).length || 0,
    [userTeam]
  );

  const sponsorshipEarnings = useMemo(
    () => userTeam?.sponsorships?.reduce((sum: number, s: any) => sum + (s.earned || 0), 0) || 0,
    [userTeam]
  );

  // Facility maintenance (from models/staff FACILITY_MAINTENANCE_COSTS)
  const facilityCosts = useMemo(() => {
    if (!userTeam?.facilities) return 0;
    const f = userTeam.facilities;
    const stadiumCost = FACILITY_MAINTENANCE_COSTS.stadium[f.stadiumLevel - 1] || 0;
    const trainCost = FACILITY_MAINTENANCE_COSTS.training[f.trainingLevel - 1] || 0;
    const medCost = FACILITY_MAINTENANCE_COSTS.medical[f.medicalLevel - 1] || 0;
    return stadiumCost + trainCost + medCost;
  }, [userTeam]);

  const totalExpenditure = totalPlayerSalaries + totalStaffSalaries + facilityCosts;
  const totalIncome = totalMatchEarningsEst + sponsorshipEarnings;

  const FinanceRow: React.FC<{
    label: string; value: number; positive?: boolean; bold?: boolean;
  }> = ({ label, value, positive, bold }) => (
    <View style={styles.financeRow}>
      <Text style={[styles.financeLabel, bold && styles.financeBold]}>{label}:</Text>
      <Text style={[styles.financeValue, bold && styles.financeBold, positive ? styles.financePositive : styles.financeNegative]}>
        {positive ? '+' : '-'}${Math.abs(value).toLocaleString()}
      </Text>
    </View>
  );

  if (!userTeam) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>🪙 Finance Hub</Text>
          <Text style={styles.subtitle}>Manage your franchise's budget, contracts, and sponsorships.</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: colors.primary }]}>
            <Text style={styles.summaryLabel}>Current Balance</Text>
            <Text style={[styles.summaryAmount, { color: colors.primaryLight }]}>
              ${userTeam.budget.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.secondary }]}>
            <Text style={styles.summaryLabel}>Squad Value</Text>
            <Text style={[styles.summaryAmount, { color: colors.secondary }]}>
              ${totalSquadValue.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: colors.primaryLight }]}>
            <Text style={styles.summaryLabel}>Est. Match Earn.</Text>
            <Text style={[styles.summaryAmount, { color: colors.primaryLight }]}>
              ${totalMatchEarningsEst.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Income Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income Overview</Text>
          <FinanceRow label="Est. Match Earnings" value={totalMatchEarningsEst} positive />
          {sponsorshipEarnings > 0 && (
            <FinanceRow label="Sponsorships" value={sponsorshipEarnings} positive />
          )}
          <FinanceRow label="Total Income (Est.)" value={totalIncome} positive bold />
        </View>

        {/* Expenditure Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenditure Overview</Text>
          <FinanceRow label="Player Salaries (Annual @10%)" value={totalPlayerSalaries} />
          {totalStaffSalaries > 0 && (
            <FinanceRow label="Staff Salaries (Annual)" value={totalStaffSalaries} />
          )}
          {facilityCosts > 0 && (
            <FinanceRow label="Facility Maintenance" value={facilityCosts} />
          )}
          <FinanceRow label="Total Expenditure (Est.)" value={totalExpenditure} bold />
        </View>

        {/* Sponsorship Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sponsorship Contracts</Text>
          <View style={styles.sponsorCapRow}>
            <Text style={styles.sponsorCapLabel}>Active Slots:</Text>
            <Text style={styles.sponsorCapValue}>{activeSponsorshipsCount} / {maxSponsors}</Text>
          </View>
          {maxSponsors === 1 && (
            <Text style={styles.sponsorHint}>
              💡 Win a tournament or build a 5-match popularity streak to unlock a second sponsorship slot.
            </Text>
          )}
          {userTeam.sponsorships?.length > 0 ? (
            userTeam.sponsorships.map((s: any) => (
              <View key={s.id} style={styles.sponsorRow}>
                <Text style={styles.sponsorName}>{s.sponsorName}</Text>
                <Text style={styles.sponsorDetail}>
                  ${s.bonusAmount.toLocaleString()}/match • {s.matchesPlayed}/{s.matches} played
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active sponsorships.</Text>
          )}
        </View>

        {/* Facilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facility Levels</Text>
          {[
            { name: 'Stadium', key: 'stadiumLevel', emoji: '🏟️' },
            { name: 'Training', key: 'trainingLevel', emoji: '🏋️' },
            { name: 'Medical', key: 'medicalLevel', emoji: '⚕️' },
          ].map(f => {
            const level = (userTeam.facilities as any)?.[f.key] || 1;
            const maint = (FACILITY_MAINTENANCE_COSTS as any)[f.key.replace('Level', '')]?.[level - 1] || 0;
            return (
              <View key={f.key} style={styles.facilityRow}>
                <Text style={styles.facilityName}>{f.emoji} {f.name}</Text>
                <View style={styles.facilityRight}>
                  <Text style={styles.facilityLevel}>Lv {level}</Text>
                  <Text style={styles.facilityCost}>-${maint.toLocaleString()}/season</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 4,
  },
  backBtnText: { color: colors.textSecondary, fontSize: 13 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2, maxWidth: 260 },
  content: { flex: 1, padding: THEME.spacing.md },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  summaryAmount: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: THEME.spacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  financeLabel: { fontSize: 13, color: colors.textSecondary },
  financeValue: { fontSize: 13, fontWeight: '600' },
  financeBold: { fontWeight: 'bold', color: colors.text, fontSize: 14 },
  financePositive: { color: colors.primaryLight },
  financeNegative: { color: colors.danger },

  sponsorCapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  sponsorCapLabel: { fontSize: 13, color: colors.textSecondary },
  sponsorCapValue: { fontSize: 13, fontWeight: 'bold', color: colors.text },
  sponsorHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 16,
  },
  sponsorRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sponsorName: { fontSize: 13, fontWeight: '600', color: colors.text },
  sponsorDetail: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: 12, color: colors.textMuted, paddingVertical: 6 },
  facilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  facilityName: { fontSize: 13, color: colors.text },
  facilityRight: { alignItems: 'flex-end' },
  facilityLevel: { fontSize: 13, fontWeight: 'bold', color: colors.primaryLight },
  facilityCost: { fontSize: 11, color: colors.danger },
});
