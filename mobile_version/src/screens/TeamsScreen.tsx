/**
 * TeamsScreen.tsx
 * Ported from: src/routes/teams/+page.svelte
 *
 * Franchise Directory:
 *   - Sidebar: All 8 teams listed with team logo + name
 *   - Detail panel: Selected team's roster, stats, personality, strength, top players
 *   - Role filter: all / batsman / bowler / allrounder / wicketkeeper
 * Uses calculateTeamStrength() and getCrowdFavourites() from core modules.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, useThemeColors, darkColors } from '../utils/theme';
import { calculateTeamStrength, PERSONALITY_DESCRIPTIONS } from '../core/teamBuilder';
import { getCrowdFavourites } from '../core/fanSystem';
import { TeamLogo } from '../components/TeamLogo';
import { PlayerCard } from '../components/PlayerCard';

interface Props {
  onBack: () => void;
}

const ROLE_FILTERS = ['all', 'batsman', 'bowler', 'allrounder', 'wicketkeeper'];

export const TeamsScreen: React.FC<Props> = ({ onBack }) => {
  const styles = useStyles(stylesCreator);
  const { teams } = useGame();
  const userTeam = useMemo(() => teams.find(t => t.isUserTeam), [teams]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(userTeam?.id || teams[0]?.id || '');
  const [filterRole, setFilterRole] = useState('all');

  const selectedTeam = useMemo(() => teams.find(t => t.id === selectedTeamId), [teams, selectedTeamId]);
  const teamStrength = useMemo(() => selectedTeam ? calculateTeamStrength(selectedTeam) : null, [selectedTeam]);

  const crowdFavouriteIds = useMemo(
    () => new Set((selectedTeam ? getCrowdFavourites(selectedTeam, 3) : []).map(p => p.id)),
    [selectedTeam]
  );

  const topPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    return [...selectedTeam.players]
      .sort((a, b) => {
        const aTotal = a.stats.batting + a.stats.bowling + a.stats.technique + a.stats.power;
        const bTotal = b.stats.batting + b.stats.bowling + b.stats.technique + b.stats.power;
        return bTotal - aTotal;
      })
      .slice(0, 3);
  }, [selectedTeam]);

  const displayedPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    if (filterRole === 'all') return selectedTeam.players;
    return selectedTeam.players.filter(p => p.role === filterRole);
  }, [selectedTeam, filterRole]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>🛡️ Franchise Directory</Text>
          <Text style={styles.subtitle}>Browse league teams, coaches, personalities, and rosters.</Text>
        </View>
      </View>

      {/* Horizontal Teams badges row */}
      <View style={styles.teamsRowContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.teamsRowContent}
        >
          {teams.map(team => {
            const isActive = selectedTeamId === team.id;
            return (
              <TouchableOpacity
                key={team.id}
                style={[
                  styles.teamBadge,
                  isActive && styles.teamBadgeActive,
                  { borderBottomColor: team.colorPrimary }
                ]}
                onPress={() => {
                  setSelectedTeamId(team.id);
                  setFilterRole('all');
                }}
              >
                <TeamLogo logo={team.logo || 'logo_shield'} size={20} />
                <Text style={[styles.teamBadgeText, isActive && styles.teamBadgeTextActive]} numberOfLines={1}>
                  {team.isUserTeam ? '⭐ ' : ''}{team.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Detail Panel */}
      {selectedTeam ? (
        <FlatList
          style={styles.detail}
          contentContainerStyle={{ paddingBottom: 24 }}
          data={displayedPlayers}
          keyExtractor={item => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListHeaderComponent={
            <View>
              {/* Team Header */}
              <View style={[styles.detailHeader, { borderLeftColor: selectedTeam.colorPrimary }]}>
                <TeamLogo logo={selectedTeam.logo || 'logo_shield'} size={48} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.detailTeamName}>{selectedTeam.name}</Text>
                  <Text style={styles.detailCoach}>Coach: {selectedTeam.coach}</Text>
                  <Text style={styles.detailFaction}>
                    Faction: {selectedTeam.faction?.toUpperCase()} • {selectedTeam.personality}
                  </Text>
                </View>
              </View>

              {/* Strength bars */}
              {teamStrength && (
                <View style={styles.strengthCard}>
                  <Text style={styles.strengthTitle}>Team Strength</Text>
                  {Object.entries(teamStrength).map(([key, val]) => (
                    <View key={key} style={styles.strengthRow}>
                      <Text style={styles.strengthLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                      <View style={styles.strengthBarBg}>
                        <View style={[styles.strengthBarFill, { width: `${Math.min(100, Number(val))}%`, backgroundColor: selectedTeam.colorPrimary }]} />
                      </View>
                      <Text style={styles.strengthValue}>{Math.round(Number(val))}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Top Players */}
              {topPlayers.length > 0 && (
                <View style={styles.topPlayersCard}>
                  <Text style={styles.sectionLabel}>⭐ Top 3 Players</Text>
                  {topPlayers.map(p => (
                    <View key={p.id} style={styles.topPlayerRow}>
                      <Text style={styles.topPlayerName}>
                        {crowdFavouriteIds.has(p.id) ? '❤️ ' : ''}{p.name}
                      </Text>
                      <Text style={styles.topPlayerStats}>
                        Bat {p.stats.batting} | Bowl {p.stats.bowling} | {p.role}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Role filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleFilterRow}>
                {ROLE_FILTERS.map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleChip, filterRole === role && styles.roleChipActive]}
                    onPress={() => setFilterRole(role)}
                  >
                    <Text style={[styles.roleChipText, filterRole === role && styles.roleChipTextActive]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Player list */}
              <Text style={styles.sectionLabel}>
                Roster ({displayedPlayers.length} players)
              </Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const isStartingXI = selectedTeam?.playing11?.includes(p.id);
            const isCaptain = selectedTeam?.captain === p.id;
            const isKeeper = selectedTeam?.wicketKeeper === p.id;
            const isReserve = selectedTeam?.reservePlayer === p.id;

            return (
              <PlayerCard
                player={p}
                isStartingXI={isStartingXI}
                isCaptain={isCaptain}
                isKeeper={isKeeper}
                isReserve={isReserve}
                teamColorPrimary={selectedTeam?.colorPrimary}
                teamColorSecondary={selectedTeam?.colorSecondary}
              />
            );
          }}
        />
      ) : (
        <View style={styles.emptyDetail}>
          <Text style={styles.emptyText}>Select a team to view details.</Text>
        </View>
      )}
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
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  subtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2, maxWidth: 220 },
  body: { flex: 1 },
  teamsRowContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  teamsRowContent: {
    paddingHorizontal: THEME.spacing.md,
    gap: 8,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 3,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  teamBadgeActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  teamBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  teamBadgeTextActive: {
    color: colors.text,
    fontWeight: 'bold',
  },
  // Detail panel
  detail: { flex: 1, padding: THEME.spacing.sm },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: THEME.spacing.sm,
  },
  detailTeamName: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  detailCoach: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  detailFaction: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  strengthCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.sm,
  },
  strengthTitle: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 6 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  strengthLabel: { width: 60, fontSize: 11, color: colors.textSecondary },
  strengthBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: { height: 6, borderRadius: 3 },
  strengthValue: { width: 28, fontSize: 11, color: colors.textMuted, textAlign: 'right' },
  topPlayersCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  topPlayerRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topPlayerName: { fontSize: 12, fontWeight: '600', color: colors.text },
  topPlayerStats: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  // Role filter chips
  roleFilterRow: { marginBottom: THEME.spacing.sm },
  roleChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    marginRight: 6,
  },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleChipText: { fontSize: 11, color: colors.textSecondary },
  roleChipTextActive: { color: '#fff', fontWeight: 'bold' },
  // Player rows
  playerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  playerName: { fontSize: 12, fontWeight: '600', color: colors.text },
  playerRole: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  playerStatCol: { alignItems: 'flex-end', justifyContent: 'center' },
  playerStat: { fontSize: 10, color: colors.textMuted },
  emptyDetail: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
