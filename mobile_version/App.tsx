import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, ActivityIndicator, View, Text } from 'react-native';
import { GameProvider, useGame } from './src/state/GameContext';
import { MainMenu } from './src/screens/MainMenu';
import { Dashboard } from './src/screens/Dashboard';
import { AuctionFlow } from './src/screens/AuctionFlow';
import { MatchFlow } from './src/screens/MatchFlow';
import { SeasonReview } from './src/screens/SeasonReview';
import { RetentionBoard } from './src/screens/RetentionBoard';
import { ScoutingAcademy } from './src/screens/ScoutingAcademy';
import { THEME, useStyles, darkColors } from './src/utils/theme';

const GameRouter: React.FC = () => {
  const { gamePhase, isLoading } = useGame();
  const styles = useStyles(stylesCreator);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>Loading Save Progress...</Text>
      </View>
    );
  }

  // State-driven routing shell
  switch (gamePhase) {
    case 'menu':
      return <MainMenu />;
    case 'auction':
      return <AuctionFlow />;
    case 'match':
      return <MatchFlow />;
    case 'season_end':
      return <SeasonReview />;
    case 'retention':
      return <RetentionBoard />;
    case 'scouting':
      return <ScoutingAcademy />;
    case 'tournament':
    case 'draft':
    case 'trading':
    default:
      return <Dashboard />;
  }
};

const AppContent: React.FC = () => {
  const { theme } = useGame();
  const styles = useStyles(stylesCreator);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <GameRouter />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: THEME.spacing.md,
    fontSize: 14,
    fontWeight: '500',
  }
});
