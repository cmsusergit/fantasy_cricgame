import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useGame } from '../state/GameContext';
import { THEME, useStyles, darkColors } from '../utils/theme';
import { Calendar, Trophy, Users, Briefcase, Play, SkipForward, ArrowLeft, PlusCircle, Edit, Star, Shield, AlertCircle, Settings, Menu, HelpCircle } from 'lucide-react-native';
import { FACILITY_UPGRADE_COSTS, StaffMember } from '../models/staff';
import { generateStaffMarket } from '../core/staffSystem';
import { generateSponsorship, SponsorshipContract } from '../core/sponsorship';
import { trainPlayer, getTrainingOptions } from '../core/trainingLab';
import type { Player } from '../models/player';
import type { Team } from '../models/team';
import { TrainingScreen } from './TrainingScreen';
import { BudgetScreen } from './BudgetScreen';
import { TournamentScreen } from './TournamentScreen';
import { TeamsScreen } from './TeamsScreen';
import { gameAudio } from '../utils/audio';
import { PlayerCard } from '../components/PlayerCard';
import { TeamLogo } from '../components/TeamLogo';
import { loadActiveMatch } from '../utils/storage';

export const Dashboard: React.FC = () => {
  const styles = useStyles(stylesCreator);
  const { 
    teams, 
    userTeam, 
    currentDay, 
    currentSeason, 
    schedule,
    players: globalPlayers,
    advanceToNextDay,
    updateMatchResult,
    resetGame,
    setGamePhase,
    upgradePlayerStat,
    renamePlayer,
    updateTeamLineup,
    trainPlayerStat,
    upgradeFacility,
    hireStaff,
    fireStaff,
    addSponsorship,
    removeSponsorship,
    theme,
    setTheme
  } = useGame();

  const [activeTab, setActiveTab] = useState<'schedule' | 'standings' | 'squad' | 'office' | 'settings'>('schedule');
  const [subScreen, setSubScreen] = useState<'training' | 'budget' | 'tournament' | 'teams' | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [sponsorshipOffers, setSponsorshipOffers] = useState<SponsorshipContract[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSimulatingDay, setIsSimulatingDay] = useState(false);

  // Audio settings states (synchronized with gameAudio service on tab load)
  const [audioEnabled, setAudioEnabled] = useState(gameAudio.getAudioEnabled());
  const [crowdVol, setCrowdVol] = useState(gameAudio.getCrowdVolume());
  const [dialogueVol, setDialogueVol] = useState(gameAudio.getDialogueVolume());

  // Starting XI selectors states
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [lineup11, setLineup11] = useState<string[]>([]);
  const [lineupCaptain, setLineupCaptain] = useState<string>('');
  const [lineupKeeper, setLineupKeeper] = useState<string>('');
  const [lineupReserve, setLineupReserve] = useState<string>('');

  // Roster Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Staff Market state
  const [staffMarket, setStaffMarket] = useState<StaffMember[]>([]);
  const [hasActiveMatch, setHasActiveMatch] = useState(false);

  useEffect(() => {
    async function checkActiveMatch() {
      try {
        const savedMatch = await loadActiveMatch();
        const todayMatchesList = schedule?.matches.filter(m => m.day === currentDay) || [];
        const todayUserMatch = todayMatchesList.find(m => m.team1Id === 'user_team' || m.team2Id === 'user_team');
        if (savedMatch && todayUserMatch && savedMatch.matchId === todayUserMatch.id && savedMatch.phase !== 'complete') {
          setHasActiveMatch(true);
        } else {
          setHasActiveMatch(false);
        }
      } catch (err) {
        console.error(err);
        setHasActiveMatch(false);
      }
    }
    checkActiveMatch();
  }, [currentDay, schedule]);

  useEffect(() => {
    if (activeTab === 'office' && staffMarket.length === 0) {
      setStaffMarket(generateStaffMarket(6));
    }
  }, [activeTab, staffMarket.length]);

  // Auto-sponsor offer generator matching Svelte logic
  const maxSponsors = useMemo(() => {
    if (!userTeam) return 1;
    return (userTeam.tournamentWins > 0 || (userTeam.fanProfile?.popularityStreak || 0) >= 5) ? 2 : 1;
  }, [userTeam]);

  const activeSponsorsCount = useMemo(() => {
    if (!userTeam) return 0;
    return (userTeam.sponsorships || []).filter((s: any) => s.active).length;
  }, [userTeam]);

  useEffect(() => {
    if (userTeam && activeSponsorsCount < maxSponsors) {
      if (sponsorshipOffers.length === 0) {
        const offers: SponsorshipContract[] = [];
        while (offers.length < 3) {
          const offer = generateSponsorship(userTeam.budget);
          if (!offers.find(o => o.sponsorName === offer.sponsorName)) {
            offers.push(offer);
          }
        }
        setSponsorshipOffers(offers);
      }
    } else {
      setSponsorshipOffers([]);
    }
  }, [userTeam, activeSponsorsCount, maxSponsors, sponsorshipOffers.length]);

  const filteredPlayers = useMemo(() => {
    if (!userTeam) return [];
    return userTeam.players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filterRole === 'all' || p.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [userTeam, searchQuery, filterRole]);

  const handleOpenLineup = () => {
    if (userTeam) {
      setLineup11(userTeam.playing11 || []);
      setLineupCaptain(userTeam.captain || '');
      setLineupKeeper(userTeam.wicketKeeper || '');
      setLineupReserve(userTeam.reservePlayer || '');
      setShowLineupModal(true);
    }
  };

  const handleQuickSelect = () => {
    if (!userTeam) return;

    // Filter out injured players
    const healthyPlayers = userTeam.players.filter(p => !p.activeInjury);
    if (healthyPlayers.length < 11) {
      Alert.alert('Incomplete Roster', 'Not enough healthy players available (need at least 11).');
      return;
    }

    // Sort by rating descending
    const sorted = [...healthyPlayers].sort((a, b) => {
      const ratingA = (a.stats.batting + a.stats.bowling) / 2;
      const ratingB = (b.stats.batting + b.stats.bowling) / 2;
      return ratingB - ratingA;
    });

    // Select top 11
    const selectedIds = sorted.slice(0, 11).map(p => p.id);
    setLineup11(selectedIds);

    // Captain is the highest overall rated player in starting XI
    setLineupCaptain(selectedIds[0]);

    // Keeper is the highest overall rated wicketkeeper in Starting XI, if any; otherwise pick any player
    const keepers = sorted.slice(0, 11).filter(p => p.role === 'wicketkeeper');
    if (keepers.length > 0) {
      setLineupKeeper(keepers[0].id);
    } else {
      setLineupKeeper(selectedIds[selectedIds.length - 1]); // fallback
    }

    // Reserve is the 12th player
    const reserveCandidate = sorted[11];
    if (reserveCandidate) {
      setLineupReserve(reserveCandidate.id);
    } else {
      setLineupReserve('');
    }
  };

  const handleSaveLineup = () => {
    if (lineup11.length !== 11) {
      Alert.alert('Invalid Lineup', 'You must select exactly 11 players for your Starting XI.');
      return;
    }
    if (!lineupCaptain) {
      Alert.alert('Invalid Lineup', 'You must nominate a team Captain.');
      return;
    }
    if (!lineupKeeper) {
      Alert.alert('Invalid Lineup', 'You must nominate a Wicketkeeper.');
      return;
    }
    updateTeamLineup(lineup11, lineupCaptain, lineupKeeper, lineupReserve);
    setShowLineupModal(false);
    Alert.alert('Lineup Saved', 'Starting XI configuration has been updated successfully.');
  };

  // Calendar browsing state
  const [viewingDay, setViewingDay] = useState(currentDay);

  useEffect(() => {
    setViewingDay(currentDay);
  }, [currentDay]);

  const todayMatches = useMemo(() => {
    return schedule?.matches.filter(m => m.day === viewingDay) || [];
  }, [schedule, viewingDay]);

  const userMatch = useMemo(() => {
    return schedule?.matches.find(m => (m.team1Id === 'user_team' || m.team2Id === 'user_team') && m.day === currentDay);
  }, [schedule, currentDay]);

  const userHasPlayedToday = userMatch ? userMatch.status === 'completed' : true;

  // Derived calendar days matching Svelte logic
  const calendarDays = useMemo(() => {
    if (!schedule) return [];
    const list = [];
    
    const getFactionEmoji = (faction: string | undefined): string => {
      switch (faction) {
        case 'human': return '🛡️';
        case 'elf': return '🌿';
        case 'orc': return '👹';
        case 'dwarf': return '⛏️';
        case 'goblin': return '💎';
        case 'nightelf': return '🌙';
        default: return '🏏';
      }
    };

    for (let d = 1; d <= schedule.totalDays; d++) {
      // Prioritize user match on day d
      let m = schedule.matches.find(match => 
        (match.team1Id === 'user_team' || match.team2Id === 'user_team') && match.day === d
      );
      // Fallback to any match scheduled on day d
      if (!m) {
        m = schedule.matches.find(match => match.day === d);
      }
      
      let status: 'completed' | 'today' | 'tbd' = 'tbd';
      let outcome: 'W' | 'L' | 'D' | 'TBD' | 'Done' | 'TODAY' = 'TBD';
      let isHome = false;
      let opponentLogo = '🏏';
      let team1Logo = '🛡️';
      let team2Logo = '🛡️';
      let team1Id = '';
      let team2Id = '';
      let team1Name = '';
      let team2Name = '';
      let winnerId = '';
      let hasMatch = false;

      if (m) {
        hasMatch = true;
        team1Id = m.team1Id;
        team2Id = m.team2Id;
        
        const t1 = teams.find(t => t.id === m.team1Id);
        const t2 = teams.find(t => t.id === m.team2Id);
        team1Logo = t1 ? (t1.logo || getFactionEmoji(t1.faction)) : '🛡️';
        team2Logo = t2 ? (t2.logo || getFactionEmoji(t2.faction)) : '🛡️';
        team1Name = t1 ? t1.name : m.team1Name;
        team2Name = t2 ? t2.name : m.team2Name;
        
        isHome = m.team1Id === 'user_team';
        if (m.team1Id === 'user_team' || m.team2Id === 'user_team') {
          const oppId = isHome ? m.team2Id : m.team1Id;
          const oppTeam = teams.find(t => t.id === oppId);
          opponentLogo = getFactionEmoji(oppTeam?.faction);
        } else {
          opponentLogo = t2 ? getFactionEmoji(t2.faction) : '🏏';
        }

        if (m.status === 'completed' && m.result) {
          status = 'completed';
          winnerId = m.result.winner;

          const involvesUser = m.team1Id === 'user_team' || m.team2Id === 'user_team';
          if (!involvesUser) {
            outcome = 'Done';
          } else {
            if (winnerId === 'draw') outcome = 'D';
            else if (winnerId === 'user_team') outcome = 'W';
            else outcome = 'L';
          }
        } else if (d === schedule.currentDay) {
          status = 'today';
          outcome = 'TODAY';
        }
      } else {
        if (d === schedule.currentDay) {
          status = 'today';
          outcome = 'TODAY';
        }
      }

      list.push({ 
        day: d, 
        status, 
        outcome, 
        isHome, 
        opponentLogo,
        hasMatch,
        team1Id,
        team2Id,
        team1Logo,
        team2Logo,
        team1Name,
        team2Name,
        winnerId
      });
    }
    return list;
  }, [schedule, teams, currentDay]);

  // Standings
  const standings = useMemo(() => {
    return teams.map(t => {
      const played = t.matchesPlayed;
      const pts = t.wins * 2;
      const nrr = played > 0 ? (t.runsFor / (played * 20)) - (t.runsAgainst / (played * 20)) : 0;
      return {
        id: t.id,
        name: t.name,
        played,
        wins: t.wins,
        losses: t.losses,
        pts,
        nrr,
        colorPrimary: t.colorPrimary
      };
    }).sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
  }, [teams]);

  // League leaders
  const topRunScorers = useMemo(() => {
    const allPlayers = teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name })));
    return allPlayers
      .filter(p => (p.tournamentStats?.runs || 0) > 0)
      .sort((a, b) => (b.tournamentStats?.runs || 0) - (a.tournamentStats?.runs || 0))
      .slice(0, 5);
  }, [teams]);

  const topWicketTakers = useMemo(() => {
    const allPlayers = teams.flatMap(t => t.players.map(p => ({ ...p, teamName: t.name })));
    return allPlayers
      .filter(p => (p.tournamentStats?.wickets || 0) > 0)
      .sort((a, b) => (b.tournamentStats?.wickets || 0) - (a.tournamentStats?.wickets || 0))
      .slice(0, 5);
  }, [teams]);

  const handleSimulateAI = () => {
    const uncompletedUserMatch = todayMatches.find(m => 
      m.status !== 'completed' && 
      (m.team1Id === 'user_team' || m.team2Id === 'user_team')
    );

    if (uncompletedUserMatch) {
      Alert.alert('Simulate Day', 'You have a match scheduled today! You must play it manually.');
    } else {
      if (currentDay >= 45) {
        // Season review transition
        Alert.alert('Season Complete!', 'The tournament schedule is finished. Proceeding to Season Review.', [
          { text: 'Confirm', onPress: () => setGamePhase('season_end') }
        ]);
      } else {
        setIsSimulatingDay(true);
        setTimeout(() => {
          advanceToNextDay();
          setIsSimulatingDay(false);
        }, 800);
      }
    }
  };

  const handlePlayMatch = () => {
    if (!userMatch) return;
    setGamePhase('match');
  };

  const handleOpenPlayerDetails = (player: Player) => {
    setSelectedPlayer(player);
    setNewName(player.name);
    setIsPlayerModalOpen(true);
  };

  const handleRenamePlayer = () => {
    if (!selectedPlayer || !newName.trim()) return;
    renamePlayer(selectedPlayer.id, newName);
    setSelectedPlayer(prev => prev ? { ...prev, name: newName } : null);
    Alert.alert('Success', 'Player renamed successfully.');
  };

  // XP Stats Upgrade Cost
  const getXpUpgradeCost = (currentLevel: number): { xp: number, credits: number } => {
    if (currentLevel <= 50) return { xp: 100, credits: 5000 };
    if (currentLevel <= 75) return { xp: 250, credits: 15000 };
    if (currentLevel <= 90) return { xp: 500, credits: 50000 };
    return { xp: 1000, credits: 150000 };
  };

  const handleXpUpgrade = (statName: 'batting' | 'bowling' | 'power' | 'technique' | 'fielding', level: number) => {
    if (!selectedPlayer || !userTeam) return;
    const cost = getXpUpgradeCost(level);

    if ((selectedPlayer.xp || 0) < cost.xp || userTeam.budget < cost.credits) {
      Alert.alert('Cannot Upgrade', 'Insufficient XP or budget available.');
      return;
    }

    upgradePlayerStat(selectedPlayer.id, 'user_team', statName, cost.xp, cost.credits);
    
    // Update local modal state
    setSelectedPlayer(prev => {
      if (!prev) return null;
      return {
        ...prev,
        xp: Math.max(0, (prev.xp || 0) - cost.xp),
        stats: {
          ...prev.stats,
          [statName]: Math.min(100, prev.stats[statName] + 1)
        }
      };
    });

    Alert.alert('Upgraded!', `${statName.toUpperCase()} increased by 1!`);
  };

  const handleCashTraining = (statName: 'batting' | 'bowling' | 'power' | 'technique' | 'fielding') => {
    if (!selectedPlayer || !userTeam) return;
    const options = getTrainingOptions(selectedPlayer);
    const option = options.find(o => o.type === statName);
    
    if (!option) return;

    if (userTeam.budget < option.cost) {
      Alert.alert('Cannot Train', 'Insufficient budget.');
      return;
    }

    const res = trainPlayer(selectedPlayer, statName as any);
    if (res.success) {
      trainPlayerStat(selectedPlayer.id, statName, res.cost, res.newStat - selectedPlayer.stats[statName]);

      setSelectedPlayer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          stats: {
            ...prev.stats,
            [statName]: res.newStat
          }
        };
      });
      Alert.alert('Training Finished', res.message);
    } else {
      Alert.alert('Failed', res.message);
    }
  };

  // Facility Upgrade
  const handleUpgradeFacility = (facility: 'stadium' | 'training' | 'medical') => {
    if (!userTeam) return;
    const nextLvl = (facility === 'stadium' ? userTeam.facilities.stadiumLevel : (facility === 'training' ? userTeam.facilities.trainingLevel : userTeam.facilities.medicalLevel)) + 1;
    if (nextLvl > 5) {
      Alert.alert('Max Level', 'This facility is already at maximum level.');
      return;
    }
    const cost = FACILITY_UPGRADE_COSTS[facility][nextLvl - 1];
    
    if (userTeam.budget < cost) {
      Alert.alert('Insufficient Purse', `Upgrading costs $${cost.toLocaleString()}.`);
      return;
    }

    Alert.alert(
      'Upgrade Facility',
      `Upgrade ${facility.toUpperCase()} to Level ${nextLvl}? Cost: $${cost.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => {
          upgradeFacility(facility, cost);
          Alert.alert('Upgraded!', `Your ${facility.toUpperCase()} has been upgraded to Level ${nextLvl}.`);
        }}
      ]
    );
  };

  // Sponsorship search
  const handleSearchSponsor = () => {
    if (!userTeam) return;
    // Original formula: max 1 sponsor normally; max 2 if won a tournament OR popularityStreak >= 5
    const maxSponsors = (userTeam.tournamentWins > 0 || (userTeam.fanProfile?.popularityStreak || 0) >= 5) ? 2 : 1;
    if ((userTeam.sponsorships || []).filter((s: any) => s.active).length >= maxSponsors) {
      Alert.alert('Max Contracts', `You can only hold ${maxSponsors} active sponsorship${maxSponsors > 1 ? 's' : ''}. Win a tournament or build 5-match popularity to unlock a second slot.`);
      return;
    }

    const sponsor = generateSponsorship(userTeam.budget);
    Alert.alert(
      'Sponsor Offer',
      `Sponsor: ${sponsor.sponsorName}\nType: ${sponsor.type.toUpperCase()}\nBase payout: $${sponsor.bonusAmount.toLocaleString()}/match\nDuration: ${sponsor.matches} matches`,
      [
        { text: 'Reject', style: 'cancel' },
        { text: 'Sign Contract', onPress: () => {
          addSponsorship(sponsor);
          Alert.alert('Signed!', `Contract signed with ${sponsor.sponsorName}.`);
        }}
      ]
    );
  };

  const getSponsorIcon = (name: string): string => {
    if (name.includes('Cola') || name.includes('Ale')) return '🍺';
    if (name.includes('Mining') || name.includes('Weapon')) return '⚔️';
    if (name.includes('Airways') || name.includes('Potion')) return '🧪';
    if (name.includes('Insurance')) return '🛡️';
    if (name.includes('Gadgets')) return '⚙️';
    return '🤝';
  };

  const handleAcceptDashboardSponsor = (offer: SponsorshipContract) => {
    addSponsorship(offer);
    setSponsorshipOffers([]);
    Alert.alert('Signed Deal', `Contract with ${offer.sponsorName} signed successfully!`);
  };

  const handleDismissSponsorship = (sponsorshipId: string) => {
    removeSponsorship(sponsorshipId);
    Alert.alert('Dismissed', 'Sponsorship slot cleared successfully.');
  };

  // Staff Management
  const handleHireStaff = (member: StaffMember) => {
    if (!userTeam) return;
    
    if (userTeam.budget < member.hiringCost) {
      Alert.alert('Insufficient Purse', `Hiring this staff member costs $${member.hiringCost.toLocaleString()}.`);
      return;
    }

    const hasRoleAlready = userTeam.staff.some(s => s.role === member.role);
    if (hasRoleAlready) {
      Alert.alert('Role Occupied', `You already have a ${member.role} hired. You must fire them first to hire a new candidate.`);
      return;
    }

    Alert.alert(
      'Hire Staff Member',
      `Hire ${member.name} as ${member.role}? \nHiring fee: $${member.hiringCost.toLocaleString()}\nSalary: $${member.salary.toLocaleString()}/yr`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hire', onPress: () => {
          hireStaff(member, member.hiringCost);
          setStaffMarket(prev => prev.filter(s => s.id !== member.id));
          Alert.alert('Hired!', `${member.name} joined your franchise staff board.`);
        }}
      ]
    );
  };

  const handleFireStaff = (member: StaffMember) => {
    if (!userTeam) return;
    const severance = Math.floor(member.salary * 0.25);
    
    if (userTeam.budget < severance) {
      Alert.alert('Severance Unaffordable', `Firing requires paying $${severance.toLocaleString()} severance fee (25% salary), which exceeds your current budget.`);
      return;
    }

    Alert.alert(
      'Fire Staff Member',
      `Are you sure you want to fire ${member.name}?\nSeverance Fee (25% salary): $${severance.toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Fire Staff', style: 'destructive', onPress: () => {
          fireStaff(member.id, severance);
          Alert.alert('Fired', `${member.name} was dismissed from your staff.`);
        }}
      ]
    );
  };

  return (
    <>
      {/* Sub-screen routing — rendered above the Dashboard */}
      {subScreen === 'training' && <TrainingScreen onBack={() => setSubScreen(null)} />}
      {subScreen === 'budget' && <BudgetScreen onBack={() => setSubScreen(null)} />}
      {subScreen === 'tournament' && <TournamentScreen onBack={() => setSubScreen(null)} />}
      {subScreen === 'teams' && <TeamsScreen onBack={() => setSubScreen(null)} />}
      {subScreen !== null ? null : (

    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.seasonText}>SEASON {currentSeason}</Text>
          <Text style={styles.teamNameText} numberOfLines={1}>{userTeam?.name || 'My Franchise'}</Text>
          <Text style={styles.coachText} numberOfLines={1}>Coach: {userTeam?.coach} • {userTeam?.faction?.toUpperCase()}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.budgetCard}>
            <Text style={styles.budgetText}>Purse</Text>
            <Text style={styles.budgetVal}>${userTeam?.budget.toLocaleString() || '0'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.headerMenuBtn} 
            onPress={() => setShowMoreMenu(true)}
            activeOpacity={0.7}
          >
            <Menu size={20} stroke="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView style={styles.scrollArea}>

        {activeTab === 'schedule' && (
          <View style={styles.panel}>
            {/* Horizontal Calendar Slider */}
            <View style={styles.calendarPanel}>
              <Text style={styles.calendarPanelTitle}>TOURNAMENT CALENDAR</Text>
              <ScrollView 
                horizontal={true} 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.calendarScrollContent}
                nestedScrollEnabled={true}
                directionalLockEnabled={true}
                canCancelContentTouches={true}
              >
                {calendarDays.map(day => {
                  const isActive = day.day === viewingDay;
                  const isToday = day.day === currentDay;
                  const isCompleted = day.status === 'completed';
                  
                  return (
                    <TouchableOpacity 
                      key={day.day}
                      style={[
                        styles.calendarDayCard,
                        isActive && styles.calendarDayCardActive,
                        isToday && !isActive && styles.calendarDayCardToday,
                        isCompleted && styles.calendarDayCardCompleted
                      ]}
                      onPress={() => setViewingDay(day.day)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.calendarDayNum, isActive && { color: '#eab308' }]}>DAY {day.day}</Text>
                      
                      {day.hasMatch && (day.team1Id === 'user_team' || day.team2Id === 'user_team') && (
                        <View style={[styles.venuePill, day.team1Id === 'user_team' ? styles.venueHome : styles.venueAway]}>
                          <Text style={styles.venuePillText}>
                            {day.team1Id === 'user_team' ? 'HOME' : 'AWAY'}
                          </Text>
                        </View>
                      )}

                      {day.hasMatch ? (
                        <View style={styles.calendarMatchIcons}>
                          {/* Team 1 logo + winner crown */}
                          <View style={styles.miniLogoContainer}>
                            <TeamLogo logo={day.team1Logo} size={16} />
                            {isCompleted && day.winnerId === day.team1Id && (
                              <Text style={styles.winnerCrown}>👑</Text>
                            )}
                          </View>
                          
                          <Text style={styles.calendarVs}>v</Text>
                          
                          {/* Team 2 logo + winner crown */}
                          <View style={styles.miniLogoContainer}>
                            <TeamLogo logo={day.team2Logo} size={16} />
                            {isCompleted && day.winnerId === day.team2Id && (
                              <Text style={styles.winnerCrown}>👑</Text>
                            )}
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.calendarMatchIcons, { justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 16 }}>💤</Text>
                        </View>
                      )}

                      {/* Outcome Badge */}
                      <View style={[
                        styles.outcomeBadge,
                        day.outcome === 'W' && styles.outcomeWin,
                        day.outcome === 'L' && styles.outcomeLoss,
                        day.outcome === 'D' && styles.outcomeDraw,
                        day.outcome === 'Done' && styles.outcomeNeutral,
                        day.outcome === 'TODAY' && styles.outcomeToday,
                        day.outcome === 'TBD' && styles.outcomeTbd,
                      ]}>
                        <Text style={[
                          styles.outcomeBadgeText,
                          day.outcome === 'W' && { color: '#4ade80' },
                          day.outcome === 'L' && { color: '#f87171' },
                          day.outcome === 'D' && { color: '#94a3b8' },
                          day.outcome === 'Done' && { color: '#38bdf8' },
                          day.outcome === 'TODAY' && { color: '#facc15' },
                          day.outcome === 'TBD' && { color: '#64748b' },
                        ]}>
                          {day.outcome}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sponsorship Offers Section */}
            {activeSponsorsCount < maxSponsors && sponsorshipOffers.length > 0 && (
              <View style={styles.offersPanel}>
                <Text style={styles.dashboardSectionTitle}>🤝 SPONSORSHIP OFFERS</Text>
                <Text style={styles.offersDescText}>
                  Review deals for the season. Sponsors provide vital operational match funds. (Max Slots: {maxSponsors})
                </Text>
                <ScrollView 
                  horizontal={true} 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.offersScrollContent}
                  nestedScrollEnabled={true}
                  directionalLockEnabled={true}
                  canCancelContentTouches={true}
                >
                  {sponsorshipOffers.map(offer => (
                    <View key={offer.sponsorName} style={styles.offerCardHorizontal}>
                      <View style={styles.offerHeaderRow}>
                        <Text style={{ fontSize: 24 }}>{getSponsorIcon(offer.sponsorName)}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.offerSponsorName} numberOfLines={1}>{offer.sponsorName}</Text>
                          <Text style={styles.offerTermText}>{offer.matches} match contract</Text>
                        </View>
                      </View>
                      <View style={styles.offerDetailsRow}>
                        <View style={styles.offerDetailItem}>
                          <Text style={styles.offerDetailLabel}>BASE/MATCH</Text>
                          <Text style={styles.offerDetailVal}>${offer.bonusAmount.toLocaleString()}</Text>
                        </View>
                        <View style={styles.offerDetailItem}>
                          <Text style={styles.offerDetailLabel}>WIN BONUS</Text>
                          <Text style={[styles.offerDetailVal, { color: '#4ade80' }]}>+${offer.performanceBonus.toLocaleString()}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.signContractBtn} 
                        onPress={() => handleAcceptDashboardSponsor(offer)}
                      >
                        <Text style={styles.signContractBtnText}>SIGN DEAL</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Active Sponsorships Summary */}
            {userTeam?.sponsorships && userTeam.sponsorships.length > 0 && (
              <View style={styles.activeSponsorsDashboardPanel}>
                <Text style={styles.dashboardSectionTitle}>📊 ACTIVE PARTNERSHIPS</Text>
                {userTeam.sponsorships.map((s: SponsorshipContract) => {
                  const isExpired = s.matchesPlayed >= s.matches;
                  return (
                    <View key={s.id} style={[styles.signedSponsorRow, isExpired && styles.signedSponsorRowExpired]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Text style={{ fontSize: 22 }}>{getSponsorIcon(s.sponsorName)}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.signedSponsorName}>{s.sponsorName}</Text>
                          <Text style={styles.signedSponsorTerm}>{s.matchesPlayed}/{s.matches} matches completed</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.signedSponsorPayout}>${s.bonusAmount.toLocaleString()}/match</Text>
                        <Text style={styles.signedSponsorEarned}>Earned: ${s.earned?.toLocaleString() || '0'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.dayHeader}>
              <TouchableOpacity 
                style={[styles.dayNavBtn, viewingDay <= 1 && styles.dayNavBtnDisabled]} 
                onPress={() => setViewingDay(prev => Math.max(1, prev - 1))}
                disabled={viewingDay <= 1}
              >
                <Text style={styles.dayNavBtnText}>◀</Text>
              </TouchableOpacity>
              <View style={styles.dayTitleCol}>
                <Text style={styles.dayTitle}>Day {viewingDay} / 45</Text>
                {viewingDay === currentDay ? (
                  <Text style={styles.todayIndicator}>TODAY</Text>
                ) : (
                  <TouchableOpacity onPress={() => setViewingDay(currentDay)}>
                    <Text style={styles.jumpTodayText}>Jump to Today</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity 
                style={[styles.dayNavBtn, viewingDay >= 45 && styles.dayNavBtnDisabled]} 
                onPress={() => setViewingDay(prev => Math.min(45, prev + 1))}
                disabled={viewingDay >= 45}
              >
                <Text style={styles.dayNavBtnText}>▶</Text>
              </TouchableOpacity>
            </View>

            {todayMatches.length === 0 ? (
              <Text style={styles.noMatches}>No matches scheduled for today.</Text>
            ) : (
              todayMatches.map(m => {
                const isUser = m.team1Id === 'user_team' || m.team2Id === 'user_team';
                const isCompleted = m.status === 'completed';
                return (
                  <View key={m.id} style={[styles.matchCard, isUser && { borderColor: THEME.colors.primary, borderWidth: 1.5 }]}>
                    <View style={styles.matchTeams}>
                      <Text style={[styles.teamName, isUser && { fontWeight: 'bold' }]}>{m.team1Name}</Text>
                      <Text style={styles.vsText}>vs</Text>
                      <Text style={[styles.teamName, isUser && { fontWeight: 'bold' }]}>{m.team2Name}</Text>
                    </View>
                    <View style={styles.matchStatus}>
                      {isCompleted ? (
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedText}>Completed</Text>
                          {m.result && (
                            <Text style={styles.resultText}>
                              Winner: {m.result.winner === 'user_team' ? 'You' : (teams.find(t => t.id === m.result?.winner)?.name || 'AI')}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.scheduledBadge}>
                          <Text style={styles.scheduledText}>Scheduled</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* Quick Actions */}
            <View style={styles.actionsBox}>
              {userMatch && !userHasPlayedToday ? (
                <TouchableOpacity style={styles.playButton} onPress={handlePlayMatch}>
                  <Play size={18} stroke="#fff" />
                  <Text style={styles.playButtonText}>{hasActiveMatch ? 'Continue Match' : 'Play Franchise Match'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.simButton} onPress={handleSimulateAI}>
                  <SkipForward size={18} stroke="#fff" />
                  <Text style={styles.simButtonText}>Simulate AI & Next Day</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {activeTab === 'standings' && (
          <View>
            {/* Standings Table */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>League Standings</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, { flex: 4 }]}>Team</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>P</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>W</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>L</Text>
                <Text style={[styles.thText, { flex: 1.5, textAlign: 'center' }]}>Pts</Text>
                <Text style={[styles.thText, { flex: 2, textAlign: 'right' }]}>NRR</Text>
              </View>
              {standings.map((team, idx) => (
                <View key={team.id} style={styles.tr}>
                  <View style={styles.teamCol}>
                    <View style={[styles.colorIndicator, { backgroundColor: team.colorPrimary }]} />
                    <Text style={styles.tdTextName} numberOfLines={1}>{team.name}</Text>
                  </View>
                  <Text style={[styles.tdText, { flex: 1, textAlign: 'center' }]}>{team.played}</Text>
                  <Text style={[styles.tdText, { flex: 1, textAlign: 'center' }]}>{team.wins}</Text>
                  <Text style={[styles.tdText, { flex: 1, textAlign: 'center' }]}>{team.losses}</Text>
                  <Text style={[styles.tdText, { flex: 1.5, textAlign: 'center', fontWeight: 'bold' }]}>{team.pts}</Text>
                  <Text style={[styles.tdText, { flex: 2, textAlign: 'right' }]}>{team.nrr.toFixed(3)}</Text>
                </View>
              ))}
            </View>

            {/* Run / Wicket leaders */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>🏏 Top Run Scorers</Text>
              {topRunScorers.map((p, i) => (
                <View key={p.id} style={styles.leaderRow}>
                  <Text style={styles.leaderText}>{i + 1}. {p.name} ({p.teamName})</Text>
                  <Text style={styles.leaderScore}>{p.tournamentStats?.runs || 0} Runs</Text>
                </View>
              ))}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>🎯 Top Wicket Takers</Text>
              {topWicketTakers.map((p, i) => (
                <View key={p.id} style={styles.leaderRow}>
                  <Text style={styles.leaderText}>{i + 1}. {p.name} ({p.teamName})</Text>
                  <Text style={styles.leaderScore}>{p.tournamentStats?.wickets || 0} Wkts</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'squad' && (
          <View>
            {/* Starters Status Banner */}
            <View style={[styles.panel, styles.lineupStatusPanel]}>
              <View style={styles.lineupStatusRow}>
                <View style={styles.lineupTextCol}>
                  <Text style={styles.panelTitle}>Lineup Status</Text>
                  {userTeam?.playing11 && userTeam.playing11.length === 11 && userTeam.captain && userTeam.wicketKeeper ? (
                    <Text style={styles.statusSuccessText}>🏆 Lineup Ready for Match!</Text>
                  ) : (
                    <Text style={styles.statusWarningText}>⚠️ Lineup Incomplete: Need 11 players, 1 Captain, and 1 Wicketkeeper.</Text>
                  )}
                </View>
                <TouchableOpacity style={styles.manageLineupBtn} onPress={handleOpenLineup}>
                  <Text style={styles.manageLineupBtnText}>Edit Lineup</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search & Filters */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Search & Filters</Text>
              <TextInput
                style={styles.searchBar}
                placeholder="Search player name..."
                placeholderTextColor={THEME.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <View style={styles.filterRoleRow}>
                {['all', 'batsman', 'bowler', 'allrounder', 'wicketkeeper'].map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.filterRoleBtn, filterRole === role && styles.filterRoleBtnActive]}
                    onPress={() => setFilterRole(role)}
                  >
                    <Text style={[styles.filterRoleBtnText, filterRole === role && styles.filterRoleBtnTextActive]}>
                      {role === 'all' ? 'All' : role === 'allrounder' ? 'AR' : role === 'wicketkeeper' ? 'WK' : role.charAt(0).toUpperCase() + role.slice(1, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Players List */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Squad Roster ({filteredPlayers.length} Players)</Text>
              {filteredPlayers.map(p => {
                const isStartingXI = userTeam?.playing11?.includes(p.id);
                const isCaptain = userTeam?.captain === p.id;
                const isKeeper = userTeam?.wicketKeeper === p.id;
                const isReserve = userTeam?.reservePlayer === p.id;

                return (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isStartingXI={isStartingXI}
                    isCaptain={isCaptain}
                    isKeeper={isKeeper}
                    isReserve={isReserve}
                    teamColorPrimary={userTeam?.colorPrimary}
                    teamColorSecondary={userTeam?.colorSecondary}
                    onPress={() => handleOpenPlayerDetails(p)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Fullscreen Lineup Configuration Modal */}
        <Modal visible={showLineupModal} animationType="slide" transparent={true} onRequestClose={() => setShowLineupModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.lineupModalContent}>
              <Text style={styles.modalTitle}>🏏 Starting XI Lineup Manager</Text>
              
              {/* Validation Feedback Header */}
              <View style={[styles.validationBanner, lineup11.length === 11 && lineupCaptain && lineupKeeper ? styles.validationBannerSuccess : styles.validationBannerWarn]}>
                <Text style={styles.validationBannerText}>
                  Selected starters: {lineup11.length} / 11 {lineup11.length !== 11 && '⚠️'}
                </Text>
                <Text style={styles.validationSubText}>
                  Captain: {lineupCaptain ? userTeam?.players.find(p => p.id === lineupCaptain)?.name : 'None ⚠️'} • Keeper: {lineupKeeper ? userTeam?.players.find(p => p.id === lineupKeeper)?.name : 'None ⚠️'}
                </Text>
              </View>

              {/* Action row */}
              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.quickSelectBtn} onPress={handleQuickSelect}>
                  <Text style={styles.quickSelectBtnText}>⚡ Auto Select Best XI</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable list of players */}
              <ScrollView style={styles.modalScrollArea}>
                {userTeam?.players.map(p => {
                  const isChecked = lineup11.includes(p.id);
                  const isC = lineupCaptain === p.id;
                  const isWK = lineupKeeper === p.id;
                  const isRes = lineupReserve === p.id;
                  const isInjured = !!p.activeInjury;

                  const handleToggleSelection = () => {
                    if (isInjured) {
                      Alert.alert('Player Injured', `${p.name} is currently injured and must rest.`);
                      return;
                    }
                    if (isChecked) {
                      setLineup11(prev => prev.filter(id => id !== p.id));
                      if (lineupCaptain === p.id) setLineupCaptain('');
                      if (lineupKeeper === p.id) setLineupKeeper('');
                    } else {
                      if (lineup11.length >= 11) {
                        Alert.alert('Limit Reached', 'You can only select up to 11 players in your starting lineup.');
                        return;
                      }
                      setLineup11(prev => [...prev, p.id]);
                      setLineupReserve(prev => prev === p.id ? '' : prev);
                    }
                  };

                  const handleSetCaptain = () => {
                    if (!isChecked) {
                      Alert.alert('Not In Lineup', 'Only starting XI players can be nominated as Captain.');
                      return;
                    }
                    setLineupCaptain(p.id);
                  };

                  const handleSetKeeper = () => {
                    if (!isChecked) {
                      Alert.alert('Not In Lineup', 'Only starting XI players can be nominated as Wicketkeeper.');
                      return;
                    }
                    setLineupKeeper(p.id);
                  };

                  const handleToggleReserve = () => {
                    if (isChecked) {
                      Alert.alert('Starting XI Player', 'Starting XI players cannot be set as reserves.');
                      return;
                    }
                    setLineupReserve(isRes ? '' : p.id);
                  };

                  return (
                    <View key={p.id} style={[styles.lineupPlayerRow, isChecked && styles.lineupPlayerRowChecked, isInjured && styles.lineupPlayerRowDisabled]}>
                      <TouchableOpacity style={styles.lineupRowTapArea} onPress={handleToggleSelection} disabled={isInjured}>
                        <View style={[styles.checkboxCircle, isChecked && styles.checkboxCircleChecked]}>
                          {isChecked && <Text style={styles.checkmarkIcon}>✓</Text>}
                        </View>
                        <View style={styles.lineupRowInfo}>
                          <Text style={[styles.lineupPlayerName, isInjured && styles.textDisabled]}>
                            {p.name} {isInjured && '🤕'}
                          </Text>
                          <Text style={styles.lineupPlayerRole}>
                            {p.role.toUpperCase()} • Rating: {Math.round((p.stats.batting + p.stats.bowling)/2)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {isChecked ? (
                        <View style={styles.lineupRoleControls}>
                          <TouchableOpacity style={[styles.roleSetBtn, isC && styles.roleSetBtnActive]} onPress={handleSetCaptain}>
                            <Text style={[styles.roleSetBtnText, isC && styles.roleSetBtnTextActive]}>C</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.roleSetBtn, isWK && styles.roleSetBtnActive]} onPress={handleSetKeeper}>
                            <Text style={[styles.roleSetBtnText, isWK && styles.roleSetBtnTextActive]}>WK</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={[styles.reserveSetBtn, isRes && styles.reserveSetBtnActive]} onPress={handleToggleReserve} disabled={isInjured}>
                          <Text style={[styles.reserveSetBtnText, isRes && styles.reserveSetBtnTextActive]}>
                            {isRes ? 'Reserve' : 'Set Res'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Save & Cancel buttons */}
              <View style={styles.modalSaveRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowLineupModal(false)}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveLineup}>
                  <Text style={styles.modalConfirmBtnText}>Save Lineup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {activeTab === 'office' && (
          <View>
            {/* Facilities Panel */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Facilities Upgrades</Text>
              <View style={styles.facilityOption}>
                <View>
                  <Text style={styles.facLabel}>Stadium level (Lvl {userTeam?.facilities.stadiumLevel || 1})</Text>
                  <Text style={styles.facDesc}>Increases matchday attendance fan revenue</Text>
                </View>
                <TouchableOpacity style={styles.upgradeBtn} onPress={() => handleUpgradeFacility('stadium')}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.facilityOption}>
                <View>
                  <Text style={styles.facLabel}>Training Lab (Lvl {userTeam?.facilities.trainingLevel || 1})</Text>
                  <Text style={styles.facDesc}>Reduces attribute training cost in lab</Text>
                </View>
                <TouchableOpacity style={styles.upgradeBtn} onPress={() => handleUpgradeFacility('training')}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.facilityOption}>
                <View>
                  <Text style={styles.facLabel}>Medical Room (Lvl {userTeam?.facilities.medicalLevel || 1})</Text>
                  <Text style={styles.facDesc}>Shortens injury recovery times considerably</Text>
                </View>
                <TouchableOpacity style={styles.upgradeBtn} onPress={() => handleUpgradeFacility('medical')}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sponsorship contracts */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Active Sponsorships</Text>
              {(userTeam?.sponsorships || []).map((s: SponsorshipContract, idx: number) => {
                const isExpired = s.matchesPlayed >= s.matches;
                return (
                  <View key={s.id} style={styles.sponsorItem}>
                    <View style={styles.sponsorInfoCol}>
                      <Text style={styles.sponsorName}>
                        {s.sponsorName} {isExpired && <Text style={styles.expiredSponsorBadge}>EXPIRED</Text>}
                      </Text>
                      <Text style={styles.sponsorDesc}>
                        Type: {s.type.toUpperCase()} • Payout: ${s.bonusAmount.toLocaleString()}/match ({s.matchesPlayed}/{s.matches} Played)
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.dismissSponsorBtn} 
                      onPress={() => handleDismissSponsorship(s.id)}
                    >
                      <Text style={styles.dismissSponsorText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              {/* Add slot button — show when below max */}
              {(() => {
                const maxSp = (userTeam?.tournamentWins ?? 0) > 0 || ((userTeam?.fanProfile?.popularityStreak ?? 0) >= 5) ? 2 : 1;
                const activeCount = (userTeam?.sponsorships || []).filter((s: any) => s.active).length;
                return activeCount < maxSp ? (
                  <TouchableOpacity style={styles.searchSponsorBtn} onPress={handleSearchSponsor}>
                    <PlusCircle size={16} stroke="#fff" />
                    <Text style={styles.searchSponsorBtnText}>Search Sponsorship Offer</Text>
                  </TouchableOpacity>
                ) : null;
              })()}
            </View>

            {/* Hired Staff */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Your Franchise Staff</Text>
              {(userTeam?.staff || []).length === 0 ? (
                <Text style={styles.emptyStateText}>No staff members hired.</Text>
              ) : (
                (userTeam?.staff || []).map((member: StaffMember) => (
                  <View key={member.id} style={[styles.staffCardMobile, styles.tierBorderCommon, member.tier === 'Rare' && styles.tierBorderRare, member.tier === 'Epic' && styles.tierBorderEpic, member.tier === 'Legendary' && styles.tierBorderLegendary]}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffNameText}>{member.name}</Text>
                      <Text style={styles.staffRoleText}>{member.role} ({member.tier})</Text>
                      <Text style={styles.staffEffectText}>{member.effectDescription}</Text>
                      <Text style={styles.staffSalaryText}>Salary: ${member.salary.toLocaleString()}/yr</Text>
                    </View>
                    <TouchableOpacity style={styles.fireStaffBtn} onPress={() => handleFireStaff(member)}>
                      <Text style={styles.fireStaffText}>Fire</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Job Market */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Staff Job Market</Text>
              {staffMarket.length === 0 ? (
                <Text style={styles.emptyStateText}>Job market is currently empty.</Text>
              ) : (
                staffMarket.map((member: StaffMember) => (
                  <View key={member.id} style={[styles.staffCardMobile, styles.tierBorderCommon, member.tier === 'Rare' && styles.tierBorderRare, member.tier === 'Epic' && styles.tierBorderEpic, member.tier === 'Legendary' && styles.tierBorderLegendary]}>
                    <View style={styles.staffInfo}>
                      <Text style={styles.staffNameText}>{member.name}</Text>
                      <Text style={styles.staffRoleText}>{member.role} ({member.tier})</Text>
                      <Text style={styles.staffEffectText}>{member.effectDescription}</Text>
                      <View style={styles.staffCostRow}>
                        <Text style={styles.staffCostText}>Hire: ${member.hiringCost.toLocaleString()}</Text>
                        <Text style={styles.staffSalaryText}>Salary: ${member.salary.toLocaleString()}/yr</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.hireStaffBtn} onPress={() => handleHireStaff(member)}>
                      <Text style={styles.hireStaffText}>Hire</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={{ paddingBottom: 24 }}>
            {/* Preferences Section */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Preferences</Text>
              <View style={styles.settingItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>App Theme</Text>
                  <Text style={styles.settingDesc}>Choose visual theme (Light or Dark)</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.toggleBtnCommon, theme === 'light' ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                  onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                >
                  <Text style={styles.toggleBtnText}>{theme === 'light' ? 'LIGHT' : 'DARK'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Audio Settings Section */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Preferences & Audio</Text>
              
              {/* Enable Audio Toggle */}
              <View style={styles.settingItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Sound Effects & TTS</Text>
                  <Text style={styles.settingDesc}>Enable matchday crowd noise and commentary</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.toggleBtnCommon, audioEnabled ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                  onPress={() => {
                    const nextVal = !audioEnabled;
                    setAudioEnabled(nextVal);
                    gameAudio.setAudioEnabled(nextVal);
                  }}
                >
                  <Text style={styles.toggleBtnText}>{audioEnabled ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              {/* Crowd Volume Controller */}
              <View style={styles.volumeControllerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Crowd Volume</Text>
                  <Text style={styles.settingDesc}>Intensity of spectators cheering and gasping</Text>
                </View>
                <View style={styles.volumeStepper}>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => {
                      const nextVol = Math.max(0, parseFloat((crowdVol - 0.1).toFixed(1)));
                      setCrowdVol(nextVol);
                      gameAudio.setCrowdVolume(nextVol);
                    }}
                  >
                    <Text style={styles.stepperText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.volumeValueText}>{Math.round(crowdVol * 100)}%</Text>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => {
                      const nextVol = Math.min(1.0, parseFloat((crowdVol + 0.1).toFixed(1)));
                      setCrowdVol(nextVol);
                      gameAudio.setCrowdVolume(nextVol);
                    }}
                  >
                    <Text style={styles.stepperText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dialogue Volume Controller */}
              <View style={styles.volumeControllerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Dialogue Volume</Text>
                  <Text style={styles.settingDesc}>Loudness of speech-synthesized commentary</Text>
                </View>
                <View style={styles.volumeStepper}>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => {
                      const nextVol = Math.max(0, parseFloat((dialogueVol - 0.1).toFixed(1)));
                      setDialogueVol(nextVol);
                      gameAudio.setDialogueVolume(nextVol);
                    }}
                  >
                    <Text style={styles.stepperText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.volumeValueText}>{Math.round(dialogueVol * 100)}%</Text>
                  <TouchableOpacity 
                    style={styles.stepperBtn} 
                    onPress={() => {
                      const nextVol = Math.min(1.0, parseFloat((dialogueVol + 0.1).toFixed(1)));
                      setDialogueVol(nextVol);
                      gameAudio.setDialogueVolume(nextVol);
                    }}
                  >
                    <Text style={styles.stepperText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Reset Franchise Button */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Danger Zone</Text>
              <Text style={styles.dangerZoneDesc}>Permanently clear all save files and reset career progression.</Text>
              <TouchableOpacity style={styles.dangerResetBtn} onPress={resetGame}>
                <Text style={styles.dangerResetBtnText}>Reset Franchise Career</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity 
          style={[styles.bottomTab, activeTab === 'schedule' && styles.activeBottomTab]} 
          onPress={() => { setActiveTab('schedule'); setSubScreen(null); }}
        >
          <Calendar size={20} stroke={activeTab === 'schedule' ? THEME.colors.primaryLight : THEME.colors.textSecondary} />
          <Text style={[styles.bottomTabText, activeTab === 'schedule' && styles.activeBottomTabText]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.bottomTab, activeTab === 'squad' && styles.activeBottomTab]} 
          onPress={() => { setActiveTab('squad'); setSubScreen(null); }}
        >
          <Users size={20} stroke={activeTab === 'squad' ? THEME.colors.primaryLight : THEME.colors.textSecondary} />
          <Text style={[styles.bottomTabText, activeTab === 'squad' && styles.activeBottomTabText]}>Squad</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.bottomTab, activeTab === 'office' && styles.activeBottomTab]} 
          onPress={() => { setActiveTab('office'); setSubScreen(null); }}
        >
          <Briefcase size={20} stroke={activeTab === 'office' ? THEME.colors.primaryLight : THEME.colors.textSecondary} />
          <Text style={[styles.bottomTabText, activeTab === 'office' && styles.activeBottomTabText]}>Club</Text>
        </TouchableOpacity>

        {userMatch && !userHasPlayedToday ? (
          <TouchableOpacity 
            style={[styles.bottomTab, styles.matchTabBlink]} 
            onPress={handlePlayMatch}
          >
            <Play size={20} stroke="#eab308" />
            <Text style={[styles.bottomTabText, { color: '#eab308', fontWeight: 'bold' }]}>{hasActiveMatch ? 'CONTINUE MATCH' : 'PLAY MATCH'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.bottomTab, activeTab === 'standings' && styles.activeBottomTab]} 
            onPress={() => { setActiveTab('standings'); setSubScreen(null); }}
          >
            <Trophy size={20} stroke={activeTab === 'standings' ? THEME.colors.primaryLight : THEME.colors.textSecondary} />
            <Text style={[styles.bottomTabText, activeTab === 'standings' && styles.activeBottomTabText]}>Standings</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.bottomTab, showMoreMenu && styles.activeBottomTab]} 
          onPress={() => setShowMoreMenu(true)}
        >
          <Menu size={20} stroke={showMoreMenu ? THEME.colors.primaryLight : THEME.colors.textSecondary} />
          <Text style={[styles.bottomTabText, showMoreMenu && styles.activeBottomTabText]}>More</Text>
        </TouchableOpacity>
      </View>

      {/* More Options Modal (Slide-up Drawer) */}
      <Modal
        visible={showMoreMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity 
          style={styles.moreMenuBackdrop} 
          activeOpacity={1} 
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenuDrawer}>
            <View style={styles.moreMenuHeader}>
              <Text style={styles.moreMenuTitle}>More Options</Text>
              <TouchableOpacity onPress={() => setShowMoreMenu(false)}>
                <Text style={styles.moreMenuCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.moreMenuGrid}>
              <TouchableOpacity 
                style={styles.moreMenuItem} 
                onPress={() => { setShowMoreMenu(false); setSubScreen('training'); }}
              >
                <View style={styles.moreIconWrapper}><Users size={20} stroke="#4ade80" /></View>
                <Text style={styles.moreItemLabel}>🏋️ Training Lab</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreMenuItem} 
                onPress={() => { setShowMoreMenu(false); setSubScreen('budget'); }}
              >
                <View style={styles.moreIconWrapper}><Briefcase size={20} stroke="#fbbf24" /></View>
                <Text style={styles.moreItemLabel}>🪙 Finance/Purse</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreMenuItem} 
                onPress={() => { setShowMoreMenu(false); setSubScreen('tournament'); }}
              >
                <View style={styles.moreIconWrapper}><Trophy size={20} stroke="#60a5fa" /></View>
                <Text style={styles.moreItemLabel}>🏆 Tournament</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreMenuItem} 
                onPress={() => { setShowMoreMenu(false); setSubScreen('teams'); }}
              >
                <View style={styles.moreIconWrapper}><Shield size={20} stroke="#c084fc" /></View>
                <Text style={styles.moreItemLabel}>🛡️ Other Teams</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreMenuItem} 
                onPress={() => { setShowMoreMenu(false); setActiveTab('settings'); setSubScreen(null); }}
              >
                <View style={styles.moreIconWrapper}><Settings size={20} stroke="#94a3b8" /></View>
                <Text style={styles.moreItemLabel}>⚙️ Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.moreMenuItem} 
                onPress={() => { setShowMoreMenu(false); setShowGuideModal(true); }}
              >
                <View style={styles.moreIconWrapper}><HelpCircle size={20} stroke="#22d3ee" /></View>
                <Text style={styles.moreItemLabel}>📖 Game Guide</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.moreMenuItem, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]} 
                onPress={() => {
                  setShowMoreMenu(false);
                  Alert.alert(
                    'Exit Career',
                    'Your franchise progress is auto-saved. Return to selection menu?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Exit to Menu', style: 'destructive', onPress: () => resetGame() }
                    ]
                  );
                }}
              >
                <View style={styles.moreIconWrapper}><ArrowLeft size={20} stroke="#ef4444" /></View>
                <Text style={[styles.moreItemLabel, { color: '#f87171' }]}>🚪 Exit Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Game Guide Modal */}
      <Modal
        visible={showGuideModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowGuideModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>📖 CricMgr Game Guide</Text>
            
            <ScrollView style={{ marginVertical: 12, paddingRight: 4 }}>
              <Text style={styles.guideHeading}>🎮 Match Play Tactics</Text>
              <Text style={styles.guideText}>
                Adjust player intent levels on-strike. High intent generates more runs but depletes stamina and increases wicket risk. Lower intent builds confidence and preserves wickets.
              </Text>
              
              <Text style={styles.guideHeading}>⚔️ Faction Specialties</Text>
              <Text style={styles.guideText}>
                • Human: Balanced, high technique modifiers.{"\n"}
                • Elf: Agile, great technique but lower power.{"\n"}
                • Orc: Raw power, high batting/bowling strength, low technique.{"\n"}
                • Dwarf: Sturdy, slow fatigue drain, excellent technique.{"\n"}
                • Goblin: High finance growth, average skill modifiers.{"\n"}
                • Undead: High morale streak bonuses.
              </Text>
              
              <Text style={styles.guideHeading}>🏋️ Training & Upgrades</Text>
              <Text style={styles.guideText}>
                Train players in the Training Lab using XP gained from match performances, or cash from sponsorships. Upgrade your training facilities to increase efficiency.
              </Text>
              
              <Text style={styles.guideHeading}>🪙 Budget & Sponsorships</Text>
              <Text style={styles.guideText}>
                Manage your team salary and budget. Accept sponsorship contracts to earn cash. Make sure you don't run out of funds or you won't be able to buy new players!
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowGuideModal(false)}>
              <Text style={styles.closeModalBtnText}>Close Guide</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>



      {/* Interactive Player Detail modal sheet */}
      {selectedPlayer && (
        <Modal
          visible={isPlayerModalOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPlayerModalOpen(false)}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Player Roster Management</Text>
              
              {/* Renaming */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Player Name</Text>
                <View style={styles.renameRow}>
                  <TextInput
                    style={styles.renameInput}
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <TouchableOpacity style={styles.renameBtn} onPress={handleRenamePlayer}>
                    <Text style={styles.renameBtnText}>Rename</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Stats panel */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Stats & Upgrades (Purse: ${userTeam?.budget.toLocaleString()} • XP: ✨ {selectedPlayer.xp})</Text>
                
                {(['batting', 'bowling', 'power', 'technique', 'fielding'] as const).map(stat => {
                  const level = selectedPlayer.stats[stat];
                  const xpCost = getXpUpgradeCost(level);
                  
                  return (
                    <View key={stat} style={styles.statUpgradeRow}>
                      <Text style={styles.statNameText}>{stat.toUpperCase()}: {level}</Text>
                      
                      <View style={styles.statActionButtons}>
                        {/* Cash training */}
                        <TouchableOpacity style={styles.cashTrainBtn} onPress={() => handleCashTraining(stat)}>
                          <Text style={styles.cashTrainBtnText}>Train $20k</Text>
                        </TouchableOpacity>

                        {/* XP upgrade */}
                        <TouchableOpacity 
                          style={[styles.xpUpgradeBtn, (selectedPlayer.xp < xpCost.xp) && styles.xpUpgradeBtnDisabled]}
                          disabled={selectedPlayer.xp < xpCost.xp}
                          onPress={() => handleXpUpgrade(stat, level)}
                        >
                          <Text style={styles.xpUpgradeBtnText}>✨ {xpCost.xp} XP</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsPlayerModalOpen(false)}>
                <Text style={styles.closeModalBtnText}>Close Management</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {isSimulatingDay && (
        <Modal transparent animationType="fade" visible={isSimulatingDay}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16
          }}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Simulating Matchday Results...</Text>
          </View>
        </Modal>
      )}
    </View>
      )}
    </>
  );
};

const stylesCreator = (colors: typeof darkColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  quickNavBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickNavText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
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
  headerMenuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonText: {
    color: colors.primaryLight,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  teamNameText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  coachText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  budgetCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 6,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetText: {
    color: colors.textMuted,
    fontSize: 10,
  },
  budgetVal: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
    padding: THEME.spacing.md,
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
    borderBottomColor: `${colors.border}66`,
    paddingBottom: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  dayTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  noMatches: {
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: THEME.spacing.md,
  },
  matchCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchTeams: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamName: {
    color: colors.text,
    fontSize: 14,
    width: '40%',
  },
  vsText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  matchStatus: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  completedBadge: {
    alignItems: 'flex-end',
  },
  completedText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  resultText: {
    color: colors.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  scheduledBadge: {
    backgroundColor: `${colors.warning}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${colors.warning}33`,
  },
  scheduledText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionsBox: {
    marginTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  playButton: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  simButton: {
    height: 48,
    backgroundColor: colors.surfaceLight,
    borderRadius: THEME.borderRadius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  simButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 6,
  },
  thText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}44`,
    alignItems: 'center',
  },
  teamCol: {
    flex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tdTextName: {
    color: colors.text,
    fontSize: 13,
  },
  tdText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}44`,
  },
  leaderText: {
    color: colors.text,
    fontSize: 13,
  },
  leaderScore: {
    color: colors.warning,
    fontWeight: 'bold',
    fontSize: 13,
  },
  playerCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}88`,
  },
  playerNameText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerDetailText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  skillsSummary: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  skillBadgeText: {
    backgroundColor: colors.surfaceLight,
    color: colors.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  facilityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}44`,
  },
  facLabel: {
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  facDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  upgradeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
  },
  upgradeBtnDisabled: {
    backgroundColor: colors.border,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  sponsorItem: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    padding: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sponsorName: {
    color: colors.secondary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  sponsorDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  searchSponsorBtn: {
    height: 40,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  searchSponsorBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  floatingReset: {
    position: 'absolute',
    bottom: THEME.spacing.md,
    right: THEME.spacing.md,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: THEME.spacing.md,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    ...THEME.shadows.soft,
  },
  resetText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: THEME.spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: THEME.spacing.md,
    ...THEME.shadows.hard,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: THEME.spacing.md,
    textAlign: 'center',
  },
  modalSection: {
    marginBottom: THEME.spacing.md,
  },
  modalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  renameRow: {
    flexDirection: 'row',
    gap: 8,
  },
  renameInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    height: 40,
    color: colors.text,
    paddingHorizontal: 10,
  },
  renameBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 4,
    justifyContent: 'center',
  },
  renameBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  statUpgradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}44`,
  },
  statNameText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  statActionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  cashTrainBtn: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
  },
  cashTrainBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  xpUpgradeBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
  },
  xpUpgradeBtnDisabled: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  xpUpgradeBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    height: 44,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
  },
  closeModalBtnText: {
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  lineupStatusPanel: {
    borderWidth: 1,
    borderColor: `${colors.primary}44`,
  },
  lineupStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
  },
  lineupTextCol: {
    flex: 1,
  },
  statusSuccessText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statusWarningText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  manageLineupBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manageLineupBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchBar: {
    backgroundColor: colors.surfaceLight,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: THEME.spacing.sm,
  },
  filterRoleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterRoleBtn: {
    flex: 1,
    height: 32,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRoleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterRoleBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterRoleBtnTextActive: {
    color: '#fff',
  },
  playerInfoCol: {
    flex: 1,
    paddingRight: THEME.spacing.sm,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  roleBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeXI: {
    backgroundColor: colors.secondary,
  },
  badgeC: {
    backgroundColor: colors.warning,
  },
  badgeWK: {
    backgroundColor: colors.primaryLight,
  },
  badgeRes: {
    backgroundColor: colors.textSecondary,
  },
  badgeInjured: {
    backgroundColor: colors.danger,
  },
  badgeTextSmall: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  lineupModalContent: {
    backgroundColor: colors.surface,
    borderRadius: THEME.borderRadius.md,
    width: '100%',
    height: '92%',
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  validationBanner: {
    padding: THEME.spacing.sm,
    borderRadius: 4,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
  },
  validationBannerWarn: {
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}44`,
  },
  validationBannerSuccess: {
    backgroundColor: `${colors.secondary}15`,
    borderColor: `${colors.secondary}44`,
  },
  validationBannerText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  validationSubText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: THEME.spacing.sm,
  },
  quickSelectBtn: {
    backgroundColor: `${colors.secondary}22`,
    borderWidth: 1,
    borderColor: `${colors.secondary}55`,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickSelectBtnText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  modalScrollArea: {
    flex: 1,
    marginBottom: THEME.spacing.md,
  },
  lineupPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}44`,
    paddingHorizontal: 6,
  },
  lineupPlayerRowChecked: {
    backgroundColor: `${colors.primary}08`,
  },
  lineupPlayerRowDisabled: {
    opacity: 0.6,
  },
  lineupRowTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleChecked: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary,
  },
  checkmarkIcon: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  lineupRowInfo: {
    flex: 1,
  },
  lineupPlayerName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  lineupPlayerRole: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  lineupRoleControls: {
    flexDirection: 'row',
    gap: 6,
  },
  roleSetBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleSetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleSetBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  roleSetBtnTextActive: {
    color: '#fff',
  },
  reserveSetBtn: {
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reserveSetBtnActive: {
    backgroundColor: colors.textSecondary,
    borderColor: colors.textSecondary,
  },
  reserveSetBtnText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  reserveSetBtnTextActive: {
    color: '#fff',
  },
  textDisabled: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  modalSaveRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.secondary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.md,
  },
  dayNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNavBtnDisabled: {
    opacity: 0.3,
  },
  dayNavBtnText: {
    color: '#fff',
    fontSize: 12,
  },
  dayTitleCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayIndicator: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: 2,
  },
  jumpTodayText: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  sponsorInfoCol: {
    flex: 1,
  },
  expiredSponsorBadge: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: `${colors.danger}22`,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 6,
  },
  dismissSponsorBtn: {
    backgroundColor: `${colors.danger}22`,
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissSponsorText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyStateText: {
    color: colors.textMuted,
    fontStyle: 'italic',
    fontSize: 12,
    paddingVertical: 10,
  },
  staffCardMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: 6,
    padding: 10,
    marginBottom: THEME.spacing.sm,
    gap: 8,
  },
  tierBorderCommon: {
    borderLeftColor: '#bdc3c7',
  },
  tierBorderRare: {
    borderLeftColor: '#3498db',
  },
  tierBorderEpic: {
    borderLeftColor: '#9b59b6',
  },
  tierBorderLegendary: {
    borderLeftColor: '#f1c40f',
  },
  staffInfo: {
    flex: 1,
  },
  staffNameText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  staffRoleText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
    fontWeight: '600',
  },
  staffEffectText: {
    color: colors.text,
    fontSize: 11,
    marginTop: 4,
  },
  staffSalaryText: {
    color: colors.warning,
    fontSize: 10,
    marginTop: 2,
    fontWeight: 'bold',
  },
  fireStaffBtn: {
    backgroundColor: `${colors.danger}22`,
    borderWidth: 1,
    borderColor: `${colors.danger}44`,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fireStaffText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: 'bold',
  },
  staffCostRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  staffCostText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  hireStaffBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hireStaffText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Settings layout styles
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
  },
  volumeControllerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}33`,
  },
  settingLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    paddingRight: 16,
  },
  themeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: `${colors.primary}33`,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  themeBadgeText: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: 'bold',
  },
  toggleBtnCommon: {
    width: 60,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  toggleBtnInactive: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  volumeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  volumeValueText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    width: 42,
    textAlign: 'center',
  },
  dangerZoneDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  dangerResetBtn: {
    height: 44,
    backgroundColor: `${colors.danger}22`,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerResetBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: 'bold',
  },

  // ─── Sticky Bottom Tab Bar Styles ─────────────────────────────
  bottomTabBar: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 4,
  },
  bottomTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  activeBottomTab: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  bottomTabText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
  },
  activeBottomTabText: {
    color: colors.primaryLight,
    fontWeight: 'bold',
  },
  matchTabBlink: {
    backgroundColor: `${colors.warning}15`,
  },

  // ─── More Options Slide-up Drawer Styles ───────────────────────
  moreMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  moreMenuDrawer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 32,
  },
  moreMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  moreMenuTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  moreMenuCloseText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  moreMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  moreMenuItem: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 8,
  },
  moreIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreItemLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // ─── Game Guide Styles ─────────────────────────────────────────
  guideHeading: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  guideText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },

  // ─── Horizontally Scrollable Calendar Slider Styles ───────────
  calendarPanel: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
    paddingBottom: 10,
    height: 154,
  },
  calendarPanelTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  calendarScrollContent: {
    paddingRight: 16,
    gap: 8,
  },
  calendarDayCard: {
    width: 90,
    height: 112,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarDayCardActive: {
    borderColor: colors.primaryLight,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5,
  },
  calendarDayCardToday: {
    borderColor: '#eab308',
  },
  calendarDayCardCompleted: {
    opacity: 0.85,
  },
  calendarDayNum: {
    color: colors.text,
    fontSize: 9,
    fontWeight: 'bold',
  },
  venuePill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    marginTop: 2,
  },
  venueHome: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  venueAway: {
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  venuePillText: {
    fontSize: 7,
    fontWeight: '800',
    color: colors.text,
  },
  calendarMatchIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    height: 20,
  },
  miniLogoContainer: {
    position: 'relative',
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLogoText: {
    fontSize: 12,
  },
  winnerCrown: {
    position: 'absolute',
    top: -8,
    right: -4,
    fontSize: 7,
  },
  calendarVs: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: 'bold',
  },
  outcomeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  outcomeBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },
  outcomeWin: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.2)',
  },
  outcomeLoss: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.2)',
  },
  outcomeDraw: {
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderColor: 'rgba(148,163,184,0.2)',
  },
  outcomeNeutral: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderColor: 'rgba(56,189,248,0.2)',
  },
  outcomeToday: {
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderColor: 'rgba(250,204,21,0.2)',
  },
  outcomeTbd: {
    backgroundColor: 'rgba(100,116,139,0.04)',
    borderColor: 'rgba(100,116,139,0.1)',
  },

  // ─── Sponsorship UI Styles on Dashboard ───────────────────────
  dashboardSectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  offersPanel: {
    marginTop: 4,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
  },
  offersDescText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  offersScrollContent: {
    paddingRight: 16,
    paddingLeft: 4,
    gap: 8,
  },
  offerCardHorizontal: {
    width: 160,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  offerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerSponsorName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  offerTermText: {
    color: colors.textMuted,
    fontSize: 9,
  },
  offerDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 6,
  },
  offerDetailItem: {
    alignItems: 'flex-start',
  },
  offerDetailLabel: {
    fontSize: 7,
    fontWeight: '800',
    color: colors.textMuted,
  },
  offerDetailVal: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.secondary,
    marginTop: 1,
  },
  signContractBtn: {
    height: 30,
    backgroundColor: colors.primary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  signContractBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeSponsorsDashboardPanel: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}66`,
  },
  signedSponsorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  signedSponsorRowExpired: {
    opacity: 0.5,
    borderColor: colors.border,
  },
  signedSponsorName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  signedSponsorTerm: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  signedSponsorPayout: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  signedSponsorEarned: {
    color: '#4ade80',
    fontSize: 10,
    marginTop: 1,
  },
});
