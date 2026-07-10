import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, darkColors } from '../utils/theme';
import { Eye, ShieldAlert, CheckCircle, ArrowRight } from 'lucide-react-native';

export const ScoutingAcademy: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const { 
    players, 
    userTeam, 
    scoutPlayer, 
    startAuctionPhase 
  } = useGame();

  const SCOUT_COST = 500;

  // Filter youth prospects entering the draft
  const prospects = useMemo(() => {
    return players.filter(p => p.age <= 20 && p.isAvailable && !p.retiring);
  }, [players]);

  const currentBudget = userTeam?.budget || 0;

  const handleScoutPlayer = (playerId: string, name: string) => {
    if (currentBudget < SCOUT_COST) {
      Alert.alert('Purse Depleted', `Scouting requires $${SCOUT_COST.toLocaleString()} cash.`);
      return;
    }

    Alert.alert(
      'Scout Player',
      `Send a scout to evaluate ${name}? Cost: $${SCOUT_COST.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Scout', 
          onPress: () => {
            const res = scoutPlayer(playerId);
            if (res.success) {
              Alert.alert('Scout Report', `Scout report completed for ${name}! Attributes and potential have been revealed.`);
            } else {
              Alert.alert('Error', res.message);
            }
          }
        }
      ]
    );
  };

  const handleProceedToAuction = () => {
    Alert.alert(
      'Proceed to Auction',
      'Are you ready to enter the live Player Auction room? Unscouted prospects will remain hidden.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Enter Auction', 
          onPress: () => {
            startAuctionPhase();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>FRANCHISE OFFICE</Text>
        <Text style={styles.title}>Scouting Network</Text>
      </View>

      {/* Brief info */}
      <View style={styles.infoBox}>
        <ShieldAlert size={20} stroke={THEME.colors.info} />
        <Text style={styles.infoText}>
          These youth prospects (Age 18-20) are entering the draft pool. Send scouts for ${SCOUT_COST.toLocaleString()} to reveal their true stats and potential.
        </Text>
      </View>

      {/* Roster area */}
      <ScrollView style={styles.scrollArea}>
        {prospects.length === 0 ? (
          <Text style={styles.noProspectsText}>No prospects available for scouting.</Text>
        ) : (
          prospects.map(p => {
            const isScouted = p.isScouted;
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.factionText}>{p.faction.toUpperCase()}</Text>
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={styles.playerDesc}>
                      {p.role.toUpperCase()} • Age {p.age} • Value: ${p.marketValue.toLocaleString()}
                    </Text>
                  </View>
                  
                  {isScouted ? (
                    <View style={styles.scoutedBadge}>
                      <CheckCircle size={14} stroke={THEME.colors.secondary} />
                      <Text style={styles.scoutedText}>Scouted</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.scoutBtn} 
                      onPress={() => handleScoutPlayer(p.id, p.name)}
                    >
                      <Eye size={14} stroke="#fff" />
                      <Text style={styles.scoutBtnText}>Scout ${SCOUT_COST}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>BATTING</Text>
                    <Text style={styles.statVal}>{isScouted ? p.stats.batting : '??'}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>BOWLING</Text>
                    <Text style={styles.statVal}>{isScouted ? p.stats.bowling : '??'}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>POWER</Text>
                    <Text style={styles.statVal}>{isScouted ? p.stats.power : '??'}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>TECH</Text>
                    <Text style={styles.statVal}>{isScouted ? p.stats.technique : '??'}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>POTENTIAL</Text>
                    <Text style={[styles.statVal, isScouted && { color: THEME.colors.warning }]}>
                      {isScouted ? `${p.potential}` : '??'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerInfoRow}>
          <Text style={styles.pursetText}>Purses remaining: ${currentBudget.toLocaleString()}</Text>
          <Text style={styles.pursetText}>Draft Pool: {prospects.length} Players</Text>
        </View>
        <TouchableOpacity style={styles.proceedBtn} onPress={handleProceedToAuction}>
          <Text style={styles.proceedText}>Proceed to Player Auction</Text>
          <ArrowRight size={18} stroke="#fff" />
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
  subtitle: {
    color: colors.primaryLight,
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
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
  infoText: {
    color: colors.textSecondary,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: THEME.spacing.md,
  },
  noProspectsText: {
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: THEME.spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
    paddingBottom: 8,
    marginBottom: 8,
  },
  factionText: {
    color: colors.primaryLight,
    fontWeight: 'bold',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  playerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  playerDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  scoutBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  scoutBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scoutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoutedText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  statVal: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
  footer: {
    backgroundColor: colors.surface,
    padding: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.sm,
  },
  pursetText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  proceedBtn: {
    height: 50,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  proceedText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  }
});
