import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, darkColors } from '../utils/theme';
import { Gavel, FastForward, CheckCircle, ChevronRight, Zap } from 'lucide-react-native';

export const AuctionFlow: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const {
    teams,
    userTeam,
    auctionState,
    initializeAuction,
    startAuctionTimer,
    stopAuctionTimer,
    placeAuctionBid,
    fastForwardAuctionPlayer,
    autoCompleteAuction
  } = useGame();

  const {
    isActive,
    availablePlayers,
    currentPlayerIndex,
    currentPlayer,
    currentBid,
    currentBidderId,
    timer,
    auctionLog,
    lastAiBidderId,
    showAiBidFlash
  } = auctionState;

  // Initialize and start auction on mount
  useEffect(() => {
    initializeAuction();
    return () => {
      stopAuctionTimer();
    };
  }, []);

  // Start timer once auction starts
  useEffect(() => {
    if (isActive && currentPlayer) {
      startAuctionTimer();
    }
    return () => {
      stopAuctionTimer();
    };
  }, [isActive, currentPlayer]);

  const handlePlaceBid = () => {
    placeAuctionBid('user_team');
  };

  if (!isActive || !currentPlayer) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>Configuring Players for Auction...</Text>
      </View>
    );
  }

  // Calculate next bid increment
  let nextBidIncrement = currentBid;
  if (currentBidderId !== null || currentBid !== currentPlayer.marketValue) {
    let inc = 500;
    if (currentBid >= 50000) inc = 2000;
    else if (currentBid >= 10000) inc = 1000;
    nextBidIncrement = currentBid + inc;
  }

  const currentBidderName = currentBidderId === 'user_team'
    ? 'You'
    : teams.find(t => t.id === currentBidderId)?.name || 'No Bids';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Gavel size={24} stroke={THEME.colors.primaryLight} />
          <Text style={styles.title}>Player Auction</Text>
        </View>
        <Text style={styles.progressText}>
          Player {currentPlayerIndex + 1} of {availablePlayers.length}
        </Text>
      </View>

      {/* Main Board */}
      <View style={styles.board}>
        {/* Current Player Card */}
        <View style={styles.playerCard}>
          <Text style={styles.factionLabel}>{currentPlayer.faction.toUpperCase()}</Text>
          <Text style={styles.playerName}>{currentPlayer.name}</Text>
          <Text style={styles.playerRole}>{currentPlayer.role.toUpperCase()}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>BATTING</Text>
              <Text style={styles.statVal}>{currentPlayer.stats.batting}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>BOWLING</Text>
              <Text style={styles.statVal}>{currentPlayer.stats.bowling}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>POWER</Text>
              <Text style={styles.statVal}>{currentPlayer.stats.power}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>TECH</Text>
              <Text style={styles.statVal}>{currentPlayer.stats.technique}</Text>
            </View>
          </View>
        </View>

        {/* Bidding Info Row */}
        <View style={styles.biddingRow}>
          <View style={styles.bidCard}>
            <Text style={styles.bidLabel}>Current Bid</Text>
            <Text style={styles.bidVal}>${currentBid.toLocaleString()}</Text>
            <Text style={styles.bidderText}>by {currentBidderName}</Text>
          </View>
          <View style={[styles.timerCard, showAiBidFlash && styles.flashTimerCard]}>
            <Text style={styles.timerLabel}>Countdown</Text>
            <Text style={styles.timerVal}>{timer}s</Text>
          </View>
        </View>
      </View>

      {/* Logs section */}
      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Bidding Room Logs</Text>
        <ScrollView style={styles.logScroll}>
          {auctionLog.map((log, idx) => {
            let textColor = THEME.colors.textSecondary;
            if (log.type === 'sold') textColor = THEME.colors.secondary;
            if (log.type === 'unsold') textColor = THEME.colors.danger;
            if (log.type === 'bid' && log.teamId === 'user_team') textColor = THEME.colors.primaryLight;
            return (
              <Text key={idx} style={[styles.logText, { color: textColor }]}>
                • {log.message}
              </Text>
            );
          })}
        </ScrollView>
      </View>

      {/* Control panel */}
      <View style={styles.controls}>
        {/* Validation warnings */}
        {userTeam && userTeam.players.length >= 25 && (
          <Text style={styles.warningBannerText}>⚠️ Squad limit reached! Cannot buy more players (Max 25).</Text>
        )}
        {userTeam && userTeam.budget < nextBidIncrement && (
          <Text style={styles.warningBannerText}>⚠️ Insufficient franchise budget for the next bid!</Text>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.ffButton} onPress={fastForwardAuctionPlayer}>
            <FastForward size={18} stroke="#fff" />
            <Text style={styles.ffText}>Pass / Skip Player</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.autoButton} onPress={autoCompleteAuction}>
            <Zap size={18} stroke="#fff" />
            <Text style={styles.autoText}>Auto Complete Draft</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bidIncrementGroup}>
          <TouchableOpacity 
            style={[
              styles.bidButtonFlex, 
              (userTeam && (userTeam.budget < nextBidIncrement || userTeam.players.length >= 25)) && styles.disabledBidButton
            ]} 
            onPress={handlePlaceBid}
            disabled={userTeam && (userTeam.budget < nextBidIncrement || userTeam.players.length >= 25)}
          >
            <Text style={styles.bidButtonText}>
              Bid Min (${nextBidIncrement.toLocaleString()})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.bidIncrementBtn, 
              (userTeam && (userTeam.budget < currentBid + 10000 || userTeam.players.length >= 25)) && styles.disabledIncrementBtn
            ]} 
            onPress={() => placeAuctionBid('user_team', currentBid + 10000)}
            disabled={userTeam && (userTeam.budget < currentBid + 10000 || userTeam.players.length >= 25)}
          >
            <Text style={styles.incrementText}>+$10k</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.bidIncrementBtn, 
              (userTeam && (userTeam.budget < currentBid + 25000 || userTeam.players.length >= 25)) && styles.disabledIncrementBtn
            ]} 
            onPress={() => placeAuctionBid('user_team', currentBid + 25000)}
            disabled={userTeam && (userTeam.budget < currentBid + 25000 || userTeam.players.length >= 25)}
          >
            <Text style={styles.incrementText}>+$25k</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.budgetFooter}>
          Your Budget: ${userTeam?.budget.toLocaleString()} • Squad size: {userTeam?.players.length ?? 0}/25
        </Text>
      </View>
    </View>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingTop: THEME.spacing.xl + 20,
    paddingHorizontal: THEME.spacing.md,
    paddingBottom: THEME.spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  board: {
    padding: THEME.spacing.md,
  },
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: THEME.spacing.md,
  },
  factionLabel: {
    color: colors.primaryLight,
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  playerName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  playerRole: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
    marginBottom: THEME.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: `${colors.border}88`,
    paddingTop: THEME.spacing.md,
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  statVal: {
    fontSize: 16,
    color: colors.text,
    fontWeight: 'bold',
    marginTop: 2,
  },
  biddingRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  bidCard: {
    flex: 2,
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bidLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  bidVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.secondary,
    marginTop: 2,
  },
  bidderText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timerCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashTimerCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  timerLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  timerVal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
  },
  logContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    marginHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: THEME.spacing.md,
    maxHeight: 180,
  },
  logTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  controls: {
    backgroundColor: colors.surface,
    padding: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  ffButton: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ffText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  autoButton: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autoText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  warningBannerText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  bidIncrementGroup: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  bidButtonFlex: {
    flex: 2,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.soft,
  },
  disabledBidButton: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  bidButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bidIncrementBtn: {
    flex: 1,
    height: 50,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledIncrementBtn: {
    borderColor: colors.border,
    opacity: 0.5,
  },
  incrementText: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  budgetFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
  }
});
