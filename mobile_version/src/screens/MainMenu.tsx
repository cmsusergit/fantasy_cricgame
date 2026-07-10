import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Modal, Animated, Easing, Dimensions
} from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, darkColors } from '../utils/theme';
import { hasExistingSave } from '../utils/storage';
import { TeamLogo } from '../components/TeamLogo';
import { TEAM_COLORS } from '../state/colorPalette';

// --- Exact same constants as Svelte layout.svelte ---
const TEAM_ADJECTIVES = ['Mighty', 'Royal', 'Cosmic', 'Thunder', 'Steel', 'Golden', 'Shadow', 'Silver'];
const TEAM_NOUNS = ['Lions', 'Eagles', 'Titans', 'Warriors', 'Knights', 'Dragons', 'Strikers', 'Panthers'];
const MANAGER_FIRST_NAMES = ['John', 'Mike', 'David', 'Chris', 'James', 'Sarah', 'Emma', 'Alex'];
const MANAGER_LAST_NAMES = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Miller', 'Moore'];

const DESIGN_SHAPES = ['shield', 'circle', 'diamond', 'hexagon'] as const;
type ShapeType = typeof DESIGN_SHAPES[number];

// Exact same list as Svelte's designSymbols
const DESIGN_SYMBOLS = [
  'unicorn', 'dragon_fire', 'dragon_serpent', 'wizard_magic', 'tree_of_life',
  'ram_horns', 'demon_horns', 'valkyrie_helmet', 'gargoyle_statue', 'gargoyle_wings',
  'archer_bow', 'elven_bow', 'hunter_bow', 'siren_tail', 'crest_ornament',
  'crest_filigree', 'shield_filigree', 'crown_filigree', 'star_filigree', 'mystic_symbol',
  'sword', 'crown', 'lightning', 'star', 'wolf', 'dragon'
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PARTICLE_EMOJIS = ['🏏', '🥎', '✨', '🏆', '⚡', '⭐', '🔥'];

const FloatingParticle: React.FC<{ index: number }> = ({ index }) => {
  const animatedY = useRef(new Animated.Value(SCREEN_HEIGHT + 50)).current;
  const animatedX = useRef(new Animated.Value(Math.random() * SCREEN_WIDTH)).current;
  const scale = useRef(new Animated.Value(0.5 + Math.random() * 1.0)).current;
  const opacity = useRef(new Animated.Value(0.1 + Math.random() * 0.4)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const emoji = PARTICLE_EMOJIS[index % PARTICLE_EMOJIS.length];

  useEffect(() => {
    const startAnimation = () => {
      animatedY.setValue(SCREEN_HEIGHT + 50);
      animatedX.setValue(Math.random() * SCREEN_WIDTH);
      rotation.setValue(0);
      
      const duration = 12000 + Math.random() * 18000;
      
      Animated.parallel([
        Animated.timing(animatedY, {
          toValue: -100,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotation, {
          toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ]).start(() => {
        startAnimation();
      });
    };

    startAnimation();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        fontSize: 24,
        opacity,
        transform: [
          { translateX: animatedX },
          { translateY: animatedY },
          { scale },
          { rotate: spin }
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
};

export const BackgroundAnimation: React.FC = () => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 15 }).map((_, i) => (
        <FloatingParticle key={i} index={i} />
      ))}
    </View>
  );
};

export const MainMenu: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const { initializeGame, resetGame, hasSavedGame, continueGame } = useGame();

  const [loading, setLoading] = useState(false);

  // Game setup state — mirrors Svelte layout.svelte exactly
  const [teamName, setTeamName] = useState('Your Team');
  const [managerName, setManagerName] = useState('You');
  const [designBgShape, setDesignBgShape] = useState<ShapeType>('shield');
  const [designBgColor, setDesignBgColor] = useState('#1e40af');
  const [designSymbol, setDesignSymbol] = useState('valkyrie_helmet');
  const [designSymbolColor, setDesignSymbolColor] = useState('#fbbf24');
  const [startWithAuction, setStartWithAuction] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  // Derived: same as Svelte's customLogoString
  const customLogoString = `custom|${designBgShape}|${designBgColor}|${designSymbol}|${designSymbolColor}`;

  const handleStartGame = async () => {
    if (!teamName.trim() || !managerName.trim()) {
      Alert.alert('Required Info Missing', 'Please enter a team name and manager name.');
      return;
    }
    setLoading(true);
    try {
      await initializeGame(teamName, managerName, customLogoString, startWithAuction, selectedColorIndex);
    } catch (e) {
      Alert.alert('Initialization Failed', 'Could not start new game.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGame = () => {
    continueGame();
  };

  const handleResetSave = () => {
    Alert.alert(
      'Reset All Saves',
      'Are you sure you want to clear your existing career progress? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetGame();
          }
        }
      ]
    );
  };

  const randomizeTeam = () => {
    const adj = TEAM_ADJECTIVES[Math.floor(Math.random() * TEAM_ADJECTIVES.length)];
    const noun = TEAM_NOUNS[Math.floor(Math.random() * TEAM_NOUNS.length)];
    setTeamName(`${adj} ${noun}`);
  };

  const randomizeManager = () => {
    const first = MANAGER_FIRST_NAMES[Math.floor(Math.random() * MANAGER_FIRST_NAMES.length)];
    const last = MANAGER_LAST_NAMES[Math.floor(Math.random() * MANAGER_LAST_NAMES.length)];
    setManagerName(`${first} ${last}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: styles.container.backgroundColor }}>
      <BackgroundAnimation />
      {loading && (
        <Modal transparent animationType="fade" visible={loading}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16
          }}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Generating Franchise League...</Text>
          </View>
        </Modal>
      )}
      <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Fantasy Cricket</Text>
          <Text style={styles.subtitle}>GRAND MANAGER</Text>
        </View>

        {/* Resume save panel */}
        {hasSavedGame && (
          <View style={styles.savePanel}>
            <Text style={styles.saveTitle}>Resume Career Game</Text>
            <Text style={styles.saveDesc}>Continue your active season standing and team rosters.</Text>
            <View style={styles.saveActions}>
              <TouchableOpacity style={styles.loadButton} onPress={handleLoadGame} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Resume Game</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={handleResetSave} disabled={loading}>
                <Text style={styles.resetButtonText}>Reset Progress</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {/* Setup card — mirrors the Svelte reset modal form exactly */}
      <View style={styles.setupCard}>
        <Text style={styles.eyebrow}>System reset</Text>
        <Text style={styles.sectionTitle}>Start a new franchise</Text>
        <Text style={styles.sectionSubtitle}>
          A reset clears the current save and rebuilds the league from scratch.
        </Text>

        {/* Team Name */}
        <Text style={styles.smallLabel}>Team Name</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="E.g., Mumbai Indians"
            placeholderTextColor={THEME.colors.textMuted}
          />
          <TouchableOpacity style={styles.diceButton} onPress={randomizeTeam}>
            <Text style={styles.diceText}>🎲</Text>
          </TouchableOpacity>
        </View>

        {/* Manager Name */}
        <Text style={styles.smallLabel}>Manager Name</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            value={managerName}
            onChangeText={setManagerName}
            placeholder="E.g., John Doe"
            placeholderTextColor={THEME.colors.textMuted}
          />
          <TouchableOpacity style={styles.diceButton} onPress={randomizeManager}>
            <Text style={styles.diceText}>🎲</Text>
          </TouchableOpacity>
        </View>

        {/* Emblem Designer Panel */}
        <View style={styles.designerPanel}>

          {/* Emblem Preview */}
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Emblem Preview:</Text>
            <View style={styles.previewCircle}>
              <TeamLogo logo={customLogoString} size={72} />
            </View>
          </View>

          {/* Base Shape Selector */}
          <View>
            <Text style={styles.smallLabel}>Base Shape</Text>
            <View style={styles.shapeRow}>
              {DESIGN_SHAPES.map(shape => (
                <TouchableOpacity
                  key={shape}
                  style={[styles.shapeBtn, designBgShape === shape && styles.shapeBtnActive]}
                  onPress={() => setDesignBgShape(shape)}
                >
                  <Text style={[styles.shapeBtnText, designBgShape === shape && styles.shapeBtnTextActive]}>
                    {shape}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Symbol Selector */}
          <View>
            <Text style={styles.smallLabel}>Emblem Symbol</Text>
            <ScrollView style={styles.symbolScrollArea} nestedScrollEnabled>
              <View style={styles.symbolGrid}>
                {DESIGN_SYMBOLS.map(sym => (
                  <TouchableOpacity
                    key={sym}
                    style={[styles.symbolBtn, designSymbol === sym && styles.symbolBtnActive]}
                    onPress={() => setDesignSymbol(sym)}
                  >
                    <TeamLogo logo={`custom|shield|#1e293b|${sym}|#cbd5e1`} size={40} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Color Pickers — using hex text inputs since RN has no native color picker */}
          <View style={styles.colorRow}>
            <View style={styles.colorField}>
              <Text style={styles.smallLabel}>Base Color</Text>
              <View style={styles.colorInputRow}>
                <View style={[styles.colorSwatch, { backgroundColor: designBgColor }]} />
                <TextInput
                  style={styles.colorHexInput}
                  value={designBgColor}
                  onChangeText={v => v.startsWith('#') ? setDesignBgColor(v) : setDesignBgColor('#' + v)}
                  placeholder="#1e40af"
                  placeholderTextColor={THEME.colors.textMuted}
                  autoCapitalize="none"
                  maxLength={7}
                />
              </View>
            </View>
            <View style={styles.colorField}>
              <Text style={styles.smallLabel}>Symbol Color</Text>
              <View style={styles.colorInputRow}>
                <View style={[styles.colorSwatch, { backgroundColor: designSymbolColor }]} />
                <TextInput
                  style={styles.colorHexInput}
                  value={designSymbolColor}
                  onChangeText={v => v.startsWith('#') ? setDesignSymbolColor(v) : setDesignSymbolColor('#' + v)}
                  placeholder="#fbbf24"
                  placeholderTextColor={THEME.colors.textMuted}
                  autoCapitalize="none"
                  maxLength={7}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Starting Setup — Predefined Squad vs Auction */}
        <Text style={styles.smallLabel}>Starting Setup</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity style={styles.radioRow} onPress={() => setStartWithAuction(false)}>
            <View style={[styles.radioCircle, !startWithAuction && styles.radioCircleSelected]} />
            <Text style={styles.radioLabel}>Predefined Balanced Squad</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.radioRow} onPress={() => setStartWithAuction(true)}>
            <View style={[styles.radioCircle, startWithAuction && styles.radioCircleSelected]} />
            <Text style={styles.radioLabel}>Inaugural Squad Auction</Text>
          </TouchableOpacity>
        </View>

        {/* Team Color Scheme — 8 palette swatches from TEAM_COLORS */}
        <Text style={styles.smallLabel}>Team Color Scheme</Text>
        <View style={styles.colorSchemeRow}>
          {TEAM_COLORS.map((color, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.colorSchemeBtn,
                { backgroundColor: color.primary },
                selectedColorIndex === idx && styles.colorSchemeBtnActive
              ]}
              onPress={() => setSelectedColorIndex(idx)}
            >
              <View style={[styles.colorSchemeDot, { backgroundColor: color.secondary }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Start Button */}
        <TouchableOpacity style={styles.startButton} onPress={handleStartGame} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Start New Game</Text>
          )}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
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
  header: {
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primaryLight,
    letterSpacing: 4,
    marginTop: 4,
  },
  // Save panel
  savePanel: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: `${colors.primary}55`,
  },
  saveTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  saveDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  saveActions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  loadButton: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButton: {
    height: 48,
    paddingHorizontal: THEME.spacing.md,
    backgroundColor: `${colors.danger}22`,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
  },
  resetButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  // Setup card
  setupCard: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primaryLight,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: THEME.spacing.md,
    lineHeight: 16,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: THEME.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.xs,
    gap: THEME.spacing.sm,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    height: 44,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: THEME.spacing.sm,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  diceButton: {
    backgroundColor: colors.surfaceLight,
    height: 44,
    width: 44,
    borderRadius: THEME.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  diceText: { fontSize: 20 },
  // Emblem designer
  designerPanel: {
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: THEME.spacing.sm,
    gap: THEME.spacing.sm,
    marginVertical: THEME.spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  previewCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shapeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  shapeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
  },
  shapeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  shapeBtnText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  shapeBtnTextActive: {
    color: '#fff',
  },
  symbolScrollArea: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 6,
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  symbolBtn: {
    width: 48,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolBtnActive: {
    borderColor: colors.primaryLight,
    backgroundColor: `${colors.primary}44`,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorField: {
    flex: 1,
  },
  colorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorHexInput: {
    flex: 1,
    height: 36,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    color: colors.text,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  // Radio buttons
  radioGroup: {
    gap: 8,
    marginBottom: THEME.spacing.xs,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontSize: 14,
    color: colors.text,
  },
  // Color scheme row — 8 swatches
  colorSchemeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  colorSchemeBtn: {
    width: 44,
    height: 32,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSchemeBtnActive: {
    borderColor: colors.primaryLight,
  },
  colorSchemeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Start button
  startButton: {
    height: 52,
    backgroundColor: colors.secondary,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
