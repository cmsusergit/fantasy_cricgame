/**
 * TournamentScreen.tsx
 * Ported from: src/routes/tournament/+page.svelte
 *
 * Tabs: Standings | Schedule | Stats
 *   - Standings: Full league table from calculateStandings()
 *   - Schedule: All matches grouped by day, filterable by team
 *   - Stats: Top run scorers and top wicket takers from tournamentStats
 * Exactly mirrors the original Svelte tournament page logic.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, useThemeColors, darkColors } from '../utils/theme';
import { calculateStandings } from '../core/tournamentSim';

interface Props {
  onBack: () => void;
}

type TourTab = 'standings' | 'schedule' | 'stats';

export const TournamentScreen: React.FC<Props> = ({ onBack }) => {
  const styles = useStyles(stylesCreator);
  const { teams, schedule } = useGame();
  const [activeTab, setActiveTab] = useState<TourTab>('standings');
  const [scheduleFilterTeam, setScheduleFilterTeam] = useState('all');

  const standings = useMemo(() => calculateStandings(teams), [teams]);
  const userTeam = useMemo(() => teams.find(t => t.isUserTeam), [teams]);
  const allMatches = useMemo(() => schedule?.matches || [], [schedule]);

  // Grouped schedule filtered by team
  const filteredGrouped = useMemo(() => {
    let result = allMatches;
    if (scheduleFilterTeam !== 'all') {
      result = result.filter(m => m.team1Id === scheduleFilterTeam || m.team2Id === scheduleFilterTeam);
    }
    const grouped = new Map<number, typeof allMatches>();
    for (const m of result) {
      if (!grouped.has(m.day)) grouped.set(m.day, []);
      grouped.get(m.day)!.push(m);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [allMatches, scheduleFilterTeam]);

  // Top 10 run scorers and wicket takers (only players with stats)
  const topRunScorers = useMemo(() => {
    return teams
      .flatMap(t => t.players.map(p => ({ ...p, teamName: t.name })))
      .filter(p => (p.tournamentStats?.runs || 0) > 0)
      .sort((a, b) => (b.tournamentStats?.runs || 0) - (a.tournamentStats?.runs || 0))
      .slice(0, 10);
  }, [teams]);

  const topWicketTakers = useMemo(() => {
    return teams
      .flatMap(t => t.players.map(p => ({ ...p, teamName: t.name })))
      .filter(p => (p.tournamentStats?.wickets || 0) > 0)
      .sort((a, b) => (b.tournamentStats?.wickets || 0) - (a.tournamentStats?.wickets || 0))
      .slice(0, 10);
  }, [teams]);

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>🏆 Tournament</Text>
          <Text style={styles.subtitle}>8-Team Round Robin • Advance Days in Dashboard</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['standings', 'schedule', 'stats'] as TourTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* STANDINGS TAB */}
        {activeTab === 'standings' && (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, { flex: 2 }]}>Team</Text>
              <Text style={styles.thCell}>P</Text>
              <Text style={styles.thCell}>W</Text>
              <Text style={styles.thCell}>L</Text>
              <Text style={styles.thCell}>Pts</Text>
              <Text style={styles.thCell}>NRR</Text>
            </View>
            {standings.map((s: any, idx: number) => {
              const t = teams.find(t => t.id === s.teamId);
              const isUser = s.teamId === userTeam?.id;
              return (
                <View
                  key={s.teamId}
                  style={[styles.tableRow, isUser && styles.tableRowUser, idx === standings.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.colorDot, { backgroundColor: t?.colorPrimary || THEME.colors.primary }]} />
                    <Text style={[styles.tdCell, isUser && styles.tdCellUser, { flex: 1 }]} numberOfLines={1}>
                      {idx + 1}. {s.teamName}
                    </Text>
                  </View>
                  <Text style={[styles.tdCell, isUser && styles.tdCellUser]}>{s.played}</Text>
                  <Text style={[styles.tdCell, isUser && styles.tdCellUser]}>{s.wins}</Text>
                  <Text style={[styles.tdCell, isUser && styles.tdCellUser]}>{s.losses}</Text>
                  <Text style={[styles.tdCellBold, isUser && styles.tdCellUser]}>{s.points}</Text>
                  <Text style={[styles.tdCell, isUser && styles.tdCellUser]}>{(s.nrr || 0).toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <View>
            {/* Team filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, scheduleFilterTeam === 'all' && styles.filterChipActive]}
                onPress={() => setScheduleFilterTeam('all')}
              >
                <Text style={[styles.filterChipText, scheduleFilterTeam === 'all' && styles.filterChipTextActive]}>All Teams</Text>
              </TouchableOpacity>
              {teams.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.filterChip, scheduleFilterTeam === t.id && styles.filterChipActive, { borderColor: t.colorPrimary }]}
                  onPress={() => setScheduleFilterTeam(t.id)}
                >
                  <Text style={[styles.filterChipText, scheduleFilterTeam === t.id && styles.filterChipTextActive]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredGrouped.length === 0 ? (
              <Text style={styles.emptyText}>No matches found.</Text>
            ) : (
              filteredGrouped.map(([day, matches]) => (
                <View key={day} style={styles.dayGroup}>
                  <Text style={styles.dayLabel}>Day {day}</Text>
                  {matches.map(m => {
                    const isCompleted = m.status === 'completed';
                    return (
                      <View key={m.id} style={[styles.matchCard, isCompleted && styles.matchCardCompleted]}>
                        <View style={styles.matchTeams}>
                          <Text style={styles.matchTeamName} numberOfLines={1}>{getTeamName(m.team1Id)}</Text>
                          <Text style={styles.matchVs}>vs</Text>
                          <Text style={styles.matchTeamName} numberOfLines={1}>{getTeamName(m.team2Id)}</Text>
                        </View>
                        {isCompleted && (m as any).winnerId && (
                          <Text style={styles.matchResult}>
                            🏆 {getTeamName((m as any).winnerId)} won
                            {(m as any).team1Score != null && (m as any).team2Score != null
                              ? ` • ${(m as any).team1Score} - ${(m as any).team2Score}`
                              : ''}
                          </Text>
                        )}
                        {!isCompleted && (
                          <Text style={styles.matchScheduledBadge}>Scheduled</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <View>
            <Text style={styles.statsSectionTitle}>🏏 Top Run Scorers</Text>
            {topRunScorers.length === 0 ? (
              <Text style={styles.emptyText}>No stats yet — play some matches first.</Text>
            ) : (
              topRunScorers.map((p, i) => (
                <View key={p.id} style={styles.statRow}>
                  <Text style={styles.statRank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statName}>{p.name}</Text>
                    <Text style={styles.statTeam}>{(p as any).teamName}</Text>
                  </View>
                  <Text style={styles.statValue}>{p.tournamentStats?.runs || 0} runs</Text>
                </View>
              ))
            )}

            <Text style={styles.statsSectionTitle}>🎯 Top Wicket Takers</Text>
            {topWicketTakers.length === 0 ? (
              <Text style={styles.emptyText}>No wickets recorded yet.</Text>
            ) : (
              topWicketTakers.map((p, i) => (
                <View key={p.id} style={styles.statRow}>
                  <Text style={styles.statRank}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statName}>{p.name}</Text>
                    <Text style={styles.statTeam}>{(p as any).teamName}</Text>
                  </View>
                  <Text style={styles.statValue}>{p.tournamentStats?.wickets || 0} wkts</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
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
    marginTop: 4,
  },
  backBtnText: { color: colors.textSecondary, fontSize: 13 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: colors.primaryLight },
  tabText: { fontSize: 13, color: colors.textSecondary },
  activeTabText: { color: colors.primaryLight, fontWeight: 'bold' },
  content: { flex: 1, padding: THEME.spacing.md },
  // Standings table
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableRowUser: { backgroundColor: `${colors.primary}18` },
  thCell: { flex: 1, fontSize: 11, fontWeight: 'bold', color: colors.textMuted, textAlign: 'center' },
  tdCell: { flex: 1, fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  tdCellBold: { flex: 1, fontSize: 12, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
  tdCellUser: { color: colors.text, fontWeight: '600' },
  colorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  // Schedule
  filterRow: { marginBottom: THEME.spacing.sm },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.textSecondary },
  filterChipTextActive: { color: '#fff', fontWeight: 'bold' },
  dayGroup: { marginBottom: THEME.spacing.md },
  dayLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primaryLight,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchCardCompleted: { opacity: 0.8 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchTeamName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  matchVs: { fontSize: 11, color: colors.textMuted, paddingHorizontal: 4 },
  matchResult: { fontSize: 11, color: colors.primaryLight, marginTop: 4 },
  matchScheduledBadge: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyText: { fontSize: 13, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },
  // Stats
  statsSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  statRank: { fontSize: 13, color: colors.textMuted, width: 24 },
  statName: { fontSize: 13, fontWeight: '600', color: colors.text },
  statTeam: { fontSize: 11, color: colors.textSecondary },
  statValue: { fontSize: 13, fontWeight: 'bold', color: colors.primaryLight },
});
