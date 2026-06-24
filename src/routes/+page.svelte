<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeGame, resetGame, teamStore, tournamentStore, scheduleStore, gamePhase, currentSeason, isFirstLogin, saveCurrentGame } from '$lib/stores/gameState';
  import { getMatchesForDay, simulateAllMatchesForDay, aiMatchInnings } from '$lib/core/schedule';
  import PlayerCard from '$lib/components/team/PlayerCard.svelte';
  import type { TournamentSchedule, GameDay, ScheduledMatch } from '$lib/core/schedule';
  import { generateSponsorship, type SponsorshipContract } from '$lib/core/sponsorship';
  import { simulateInnings, calculateStandings, simulateMatch } from '$lib/core/tournamentSim';
  import { resolveMatch, postMatchMoraleUpdate, type MatchResult } from '$lib/core/matchEngine';
  import { updatePopularity, calculateHomeAdvantage } from '$lib/core/fanSystem';
  import { recoverFromInjury } from '$lib/core/injurySystem';
  import type { innings } from '$lib/models/match';
  import MatchSummary from '$lib/components/match/MatchSummary.svelte';
  import { goto } from '$app/navigation';
  import { calculateTeamStrength } from '$lib/core/teamBuilder';
  import { FACTIONS } from '$lib/models/faction';
  import { loadActiveMatch } from '$lib/services/storage';
  import TeamLogo from '$lib/components/team/TeamLogo.svelte';
  
  let teams: any[] = $state([]);
  let schedule: TournamentSchedule | null = $state(null);
  let selectedDay: number = $state(1);
  let budget: number = $state(0);
  let sponsorshipOffers: SponsorshipContract[] = $state([]);
  let showMatchResultModal: boolean = $state(false);
  let lastSimulatedInnings1: innings | null = $state(null);
  let lastSimulatedInnings2: innings | null = $state(null);
  let lastMatchResult: MatchResult | null = $state(null);
  let hasActiveMatch = $state(false);
  
  onMount(() => {
    loadActiveMatch().then(m => hasActiveMatch = !!m);
    
    const unsubTeam = teamStore.subscribe(t => {
      teams = t;
      const user = t.find((team: any) => team.isUserTeam);
      if (user) {
        budget = user.budget;
      }
    });
    const unsubSchedule = scheduleStore.subscribe(s => {
      schedule = s;
      if (s) selectedDay = s.currentDay;
    });
    
    return () => {
      unsubTeam();
      unsubSchedule();
    };
  });
  
  let userTeam = $derived(teams.find(t => t.isUserTeam));
  let winRate = $derived(userTeam ? ((userTeam.wins / (userTeam.matchesPlayed || 1)) * 100).toFixed(0) : '0');
  let fanPopularity = $derived(userTeam?.fanProfile?.popularity ?? 50);
  let homeAdvantage = $derived(userTeam?.fanProfile?.homeAdvantage ?? 0);
  let fanRevenue = $derived(userTeam?.fanProfile?.revenue ?? 0);
  let activeInjuryCount = $derived(userTeam ? userTeam.players.filter((p: any) => (p as any).activeInjury).length : 0);
  let playing11Count = $derived(userTeam?.playing11?.length ?? 0);
  let lineupReady = $derived(Boolean(userTeam?.playing11?.length === 11 && userTeam?.captain && userTeam?.wicketKeeper));
  
  let maxSponsors = $derived(
    userTeam 
      ? ((userTeam.tournamentWins > 0 || (userTeam.fanProfile?.popularityStreak || 0) >= 5) ? 2 : 1)
      : 1
  );
  let activeSponsorshipsCount = $derived(
    userTeam && userTeam.sponsorships 
      ? userTeam.sponsorships.filter((s: any) => s.active).length 
      : 0
  );
  let expiredSponsorships = $derived(
    userTeam && userTeam.sponsorships 
      ? userTeam.sponsorships.filter((s: any) => !s.active) 
      : []
  );

  $effect(() => {
    if (userTeam && activeSponsorshipsCount < maxSponsors && ($gamePhase === 'tournament' || $gamePhase === 'menu')) {
      if (sponsorshipOffers.length === 0) {
        const offers: SponsorshipContract[] = [];
        // Generate 3 unique offers
        while(offers.length < 3) {
           const newOffer = generateSponsorship(userTeam.budget);
           if (!offers.find(o => o.sponsorName === newOffer.sponsorName)) {
              offers.push(newOffer);
           }
        }
        sponsorshipOffers = offers;
      }
    } else {
      sponsorshipOffers = [];
    }
  });

  function acceptSponsorship(offer: SponsorshipContract) {
    if (!userTeam) return;
    teamStore.addSponsorship(userTeam.id, offer);
    sponsorshipOffers = []; // Clear offers
  }
  
  async function handleDismissExpiredSponsorship(sponsorshipId: string) {
    if (!userTeam) return;
    teamStore.removeSponsorship(userTeam.id, sponsorshipId);
    await saveCurrentGame(budget);
  }
  
  let currentDayGames = $derived(schedule ? getMatchesForDay(schedule, selectedDay) : []);
  let dayInfo = $derived((schedule as any)?.days.find((d: any) => d.day === selectedDay));
  let userNextMatch = $derived((schedule as any)?.matches.find((m: any) => 
    m.status === 'scheduled' && (m.team1Id === 'user_team' || m.team2Id === 'user_team') && m.day === (schedule as any)?.currentDay
  ));
  
  // Expose gamePhase for conditional UI rendering
  let phase = $derived($gamePhase);

  // Redirect to correct off-season screen if page loaded outside tournament phase
  $effect(() => {
    if (phase === 'season_end') {
      goto('/season-review');
    } else if (phase === 'retention') {
      goto('/retention');
    } else if (phase === 'scouting') {
      goto('/scouting');
    } else if (phase === 'auction') {
      goto('/auction');
    }
  });

  // Top Performers
  let allPlayers = $derived(teams.flatMap((t: any) => t.players));

  let bestBat = $derived([...allPlayers].sort((a: any,b: any) => (b.tournamentStats?.runs || 0) - (a.tournamentStats?.runs || 0))[0]);
  let bestBowl = $derived([...allPlayers].sort((a: any,b: any) => (b.tournamentStats?.wickets || 0) - (a.tournamentStats?.wickets || 0))[0]);
  let mvp = $derived([...allPlayers].sort((a: any,b: any) => ((b.tournamentStats?.runs || 0) * 1 + (b.tournamentStats?.wickets || 0) * 20) - ((a.tournamentStats?.runs || 0) * 1 + (a.tournamentStats?.wickets || 0) * 20))[0]);
  
  // Standing Details
  let standings = $derived(calculateStandings(teams));
  let userStandingIndex = $derived(standings.findIndex(s => s.teamId === userTeam?.id));
  let userStanding = $derived(standings[userStandingIndex]);

  // Helper functions
  function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getFactionEmoji(faction: string | undefined): string {
    switch (faction) {
      case 'human': return '🛡️';
      case 'elf': return '🌿';
      case 'orc': return '👹';
      case 'dwarf': return '⛏️';
      case 'goblin': return '💎';
      case 'nightelf': return '🌙';
      default: return '🏏';
    }
  }

  function getSponsorIcon(name: string): string {
    if (name.includes('Cola') || name.includes('Ale')) return '🍺';
    if (name.includes('Mining') || name.includes('Weapon')) return '⚔️';
    if (name.includes('Airways') || name.includes('Potion')) return '🧪';
    if (name.includes('Insurance')) return '🛡️';
    if (name.includes('Gadgets')) return '⚙️';
    return '🤝';
  }

  const weathers = ['☀️ Clear skies', '⛅ Overcast', '☀️ Sunny & Warm', '🍃 Breezy'];
  const pitches = ['🌱 Green Pitch', '🧱 Dry Pitch', '🌾 Dusty Pitch', '🏏 Flat Pitch'];
  function getMatchCondition(matchId: string) {
     let hash = 0;
     for (let i = 0; i < matchId.length; i++) {
        hash = matchId.charCodeAt(i) + ((hash << 5) - hash);
     }
     const weather = weathers[Math.abs(hash) % weathers.length];
     const pitch = pitches[Math.abs(hash >> 2) % pitches.length];
     return { weather, pitch };
  }

  // Create derived calendar days
  let calendarDays = $derived(() => {
    if (!schedule) return [];
    const list = [];
    for (let d = 1; d <= schedule.totalDays; d++) {
      // Prioritize user match on day d
      let m = schedule.matches.find(match => 
        (match.team1Id === 'user_team' || match.team2Id === 'user_team') && match.day === d
      );
      // Fallback to any match scheduled on day d if user is not playing
      if (!m) {
        m = schedule.matches.find(match => match.day === d);
      }
      
      let status: 'completed' | 'today' | 'tbd' = 'tbd';
      let outcome: 'W' | 'L' | 'D' | 'TBD' | 'Done' | 'TODAY' = 'TBD';
      let isHome = false;
      let opponentLogo = '🏏';
      let team1Logo = '';
      let team2Logo = '';
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
          if (m.result.winner === 'team1') winnerId = m.team1Id;
          else if (m.result.winner === 'team2') winnerId = m.team2Id;
          else winnerId = m.result.winner;

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
  });

  function quickSimulateUserMatch() {
    if (!schedule || !teams.length || !userNextMatch) return;
    
    const team1 = teams.find(t => t.id === userNextMatch.team1Id);
    const team2 = teams.find(t => t.id === userNextMatch.team2Id);
    
    if (!team1 || !team2) return;

    // Simulate match
    const innings1 = simulateInnings(team1, team2, 20);
    const target = innings1.totalRuns + 1;
    const innings2 = simulateInnings(team2, team1, 20, target);
    
    const t1Won = innings1.totalRuns > innings2.totalRuns;
    const t2Won = innings2.totalRuns > innings1.totalRuns;

    const winnerId = t1Won ? innings1.teamId : t2Won ? innings2.teamId : 'draw';
    const score1 = userNextMatch.team1Id === innings1.teamId ? innings1.totalRuns : innings2.totalRuns;
    const score2 = userNextMatch.team2Id === innings2.teamId ? innings2.totalRuns : innings1.totalRuns;

    // RESOLVE MATCH FIRST — mutates morale/form on local refs
    const result = resolveMatch(team1, team2, innings1, innings2, userNextMatch.team1Id);
    
    // Apply Earnings
    const totalEarningsTeam1 = result.sponsorshipEarnings.team1 + result.matchEarnings.team1;
    const totalEarningsTeam2 = result.sponsorshipEarnings.team2 + result.matchEarnings.team2;
    
    // Compute XP and apply to teamStore players
    const playerStatsUpdates: Record<string, { runs: number; wickets: number; catches: number; xp: number }> = {};
    const addStat = (id: string, stat: string, value: number) => {
      if (!playerStatsUpdates[id]) playerStatsUpdates[id] = { runs: 0, wickets: 0, catches: 0, xp: 0 };
      (playerStatsUpdates[id] as any)[stat] += value;
    };

    const allPlayingIds = [...team1.players.map((p: any) => p.id), ...team2.players.map((p: any) => p.id)];
    allPlayingIds.forEach(id => addStat(id, 'xp', 10));

    [innings1, innings2].forEach(inn => {
      inn.ballsFaced.forEach(ball => {
        if (ball.result !== 'wide' && ball.result !== 'noball') {
          addStat(ball.batsmanId, 'runs', ball.runs);
          addStat(ball.batsmanId, 'xp', ball.runs);
        }
        if (ball.isWicket) {
          if (ball.wicketType !== 'run out') {
            addStat(ball.bowlerId, 'wickets', 1);
            addStat(ball.bowlerId, 'xp', 15);
          }
          if ((ball.wicketType === 'caught' || ball.wicketType === 'stumped') && ball.fielderId) {
            addStat(ball.fielderId, 'catches', 1);
            addStat(ball.fielderId, 'xp', 10);
          }
        }
      });
    });

    Object.keys(playerStatsUpdates).forEach(id => {
      const ps = playerStatsUpdates[id];
      if (ps.runs >= 100) ps.xp += 100;
      else if (ps.runs >= 50) ps.xp += 50;
      if (ps.wickets >= 5) ps.xp += 100;
      else if (ps.wickets >= 3) ps.xp += 50;
      ps.xp = Math.round(ps.xp);
    });

    if (result.playerOfTheMatch) {
      addStat(result.playerOfTheMatch.id, 'xp', 100);
    }

    teamStore.update(tStore => tStore.map(t => {
      if (t.id !== team1.id && t.id !== team2.id) return t;
      const localTeam = t.id === team1.id ? team1 : team2;
      return {
        ...t,
        fanProfile: localTeam.fanProfile,
        sponsorships: localTeam.sponsorships || [],
        injuries: localTeam.injuries || [],
        players: t.players.map(p => {
          const localPlayer = localTeam.players.find((lp: any) => lp.id === p.id);
          const updates = playerStatsUpdates[p.id];
          
          const fatigue = localPlayer ? localPlayer.fatigue : (p.fatigue || 0);
          const morale = localPlayer ? localPlayer.morale : (p.morale || 50);
          const form = localPlayer ? localPlayer.form : (p.form || 0);
          const activeInjury = localPlayer ? (localPlayer as any).activeInjury : undefined;

          if (!updates) {
            return { ...p, fatigue, morale, form, activeInjury };
          }
          const ts = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
          return {
            ...p,
            matches: (p.matches || 0) + 1,
            runsScored: (p.runsScored || 0) + updates.runs,
            wickets: (p.wickets || 0) + updates.wickets,
            catches: (p.catches || 0) + updates.catches,
            xp: (p.xp || 0) + updates.xp,
            lifetimeXp: (p.lifetimeXp || 0) + updates.xp,
            fatigue,
            morale,
            form,
            activeInjury,
            tournamentStats: {
              runs: (ts.runs || 0) + updates.runs,
              wickets: (ts.wickets || 0) + updates.wickets,
              catches: (ts.catches || 0) + updates.catches
            }
          };
        })
      };
    }));

    // NOW update store with wins/schedule (after stats update preserves morale/form)
    if (t1Won) {
      teamStore.addWin(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
      teamStore.addLoss(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
    } else if (t2Won) {
      teamStore.addWin(innings2.teamId, innings2.totalRuns, innings1.totalRuns);
      teamStore.addLoss(innings1.teamId, innings1.totalRuns, innings2.totalRuns);
    }

    if (totalEarningsTeam1 > 0) teamStore.updateBudget(team1.id, totalEarningsTeam1);
    if (totalEarningsTeam2 > 0) teamStore.updateBudget(team2.id, totalEarningsTeam2);

    if (result.playerOfTheMatch) {
        teamStore.updateBudget(result.playerOfTheMatch.teamId, result.potmReward);
    }

    scheduleStore.updateMatchResult(userNextMatch.id, winnerId, score1, score2);

    lastSimulatedInnings1 = innings1;
    lastSimulatedInnings2 = innings2;
    lastMatchResult = result;
    showMatchResultModal = true;
  }

  async function closeMatchResultModal() {
    showMatchResultModal = false;
    await advanceTournament();
  }

  async function advanceTournament() {
    if (!schedule || !teams.length) return;
    
    const currentDay = schedule.currentDay;
    const nextDay = currentDay + 1;
    
    const updatedSchedule = simulateAllMatchesForDay(schedule, currentDay, teams);
    updatedSchedule.currentDay = nextDay;
    scheduleStore.set(updatedSchedule);

    const newlyCompletedMatches = updatedSchedule.matches.filter(m => m.day === currentDay && m.status === 'completed' && m.result && m.team1Id !== 'user_team' && m.team2Id !== 'user_team');
    
    // Apply post-match morale/form updates to AI match players
    for (const match of newlyCompletedMatches) {
      const innsData = aiMatchInnings[match.id];
      if (!innsData) continue;
      const team1 = teams.find(t => t.id === match.team1Id);
      const team2 = teams.find(t => t.id === match.team2Id);
      if (!team1 || !team2) continue;
      const winner = match.result!.winner === match.team1Id ? 'team1' as const : match.result!.winner === match.team2Id ? 'team2' as const : 'draw' as const;
      postMatchMoraleUpdate(team1, team2, innsData.innings1, innsData.innings2, winner);
    }
    
    // Apply fatigue recovery, injury healing, morale updates, earnings, wins/losses, and XP stats in a single atomic transaction
    teamStore.update(tStore => {
      // 1. Apply wins, losses, draws, and sponsorship/match earnings to teams
      let nextStore = tStore.map(team => {
        const match = newlyCompletedMatches.find(m => m.team1Id === team.id || m.team2Id === team.id);
        if (!match || !match.result) return team;
        
        const isTeam1 = match.team1Id === team.id;
        const runsFor = isTeam1 ? match.result.team1Score : match.result.team2Score;
        const runsAgainst = isTeam1 ? match.result.team2Score : match.result.team1Score;
        
        const baseEarnings = 10000;
        const winBonus = 50000;
        let earnings = baseEarnings;
        
        let wins = team.wins;
        let losses = team.losses;
        let draws = team.draws;
        
        const teamResult = match.result.winner === team.id ? 'win' : match.result.winner === 'draw' ? 'draw' : 'loss';
        const newPopularity = updatePopularity(team.fanProfile?.popularity || 50, teamResult, runsFor);
        const homeAdvantage = match.team1Id === team.id ? calculateHomeAdvantage(newPopularity) : 0;
        const newStreak = newPopularity > 75 ? (team.fanProfile?.popularityStreak || 0) + 1 : 0;

        if (match.result.winner === team.id) {
          wins++;
          earnings += winBonus;
        } else if (match.result.winner === 'draw') {
          draws++;
        } else {
          losses++;
        }
        
        return {
          ...team,
          wins,
          losses,
          draws,
          matchesPlayed: team.matchesPlayed + 1,
          runsFor: team.runsFor + runsFor,
          runsAgainst: team.runsAgainst + runsAgainst,
          budget: team.budget + earnings,
          fanProfile: {
            ...(team.fanProfile || { homeAdvantage: 0, popularity: 50, revenue: 0, matchBonus: 0, popularityStreak: 0 }),
            popularity: newPopularity,
            homeAdvantage,
            revenue: (team.fanProfile?.revenue || 0) + earnings,
            popularityStreak: newStreak
          }
        };
      });

      // 2. Accumulate player stats (runs, wickets, catches, XP) from simulated AI matches
      const playerStats: Record<string, { runs: number; wickets: number; catches: number; xp: number }> = {};
      const addStat = (id: string, stat: string, value: number) => {
        if (!playerStats[id]) playerStats[id] = { runs: 0, wickets: 0, catches: 0, xp: 0 };
        (playerStats[id] as any)[stat] += value;
      };

      for (const match of newlyCompletedMatches) {
        if (!match.result) continue;
        const innsData = aiMatchInnings[match.id];
        if (!innsData) continue;

        const team1 = nextStore.find(t => t.id === match.team1Id);
        const team2 = nextStore.find(t => t.id === match.team2Id);
        if (!team1 || !team2) continue;

        [...team1.players.map(p => p.id), ...team2.players.map(p => p.id)]
          .forEach(id => addStat(id, 'xp', 10));

        [innsData.innings1, innsData.innings2].forEach(inn => {
          inn.ballsFaced.forEach(ball => {
            if (ball.result !== 'wide' && ball.result !== 'noball') {
              addStat(ball.batsmanId, 'runs', ball.runs);
              addStat(ball.batsmanId, 'xp', ball.runs);
            }
            if (ball.isWicket) {
              if (ball.wicketType !== 'run out') {
                addStat(ball.bowlerId, 'wickets', 1);
                addStat(ball.bowlerId, 'xp', 15);
              }
              if ((ball.wicketType === 'caught' || ball.wicketType === 'stumped') && ball.fielderId) {
                addStat(ball.fielderId, 'catches', 1);
                addStat(ball.fielderId, 'xp', 10);
              }
            }
          });
        });
      }

      // Add milestones XP to playerStats
      Object.keys(playerStats).forEach(id => {
        const ps = playerStats[id];
        if (ps.runs >= 100) ps.xp += 100;
        else if (ps.runs >= 50) ps.xp += 50;
        if (ps.wickets >= 5) ps.xp += 100;
        else if (ps.wickets >= 3) ps.xp += 50;
        ps.xp = Math.round(ps.xp);
      });

      // 3. Update player details (fatigue, morale, form, injury, XP, performance)
      nextStore = nextStore.map(team => {
        // Find if this team had a match today
        const teamMatch = (schedule as any)?.matches.find((m: any) => 
          m.day === currentDay && 
          (m.team1Id === team.id || m.team2Id === team.id)
        );
        const playedToday = !!teamMatch;

        // Find playing 11 IDs today
        const playing11Ids = new Set<string>();
        if (playedToday) {
          if (team.isUserTeam) {
            (team.playing11 || []).forEach(id => playing11Ids.add(id));
          } else {
            const innsData = newlyCompletedMatches.find((m: any) => m.id === teamMatch?.id) 
              ? aiMatchInnings[teamMatch!.id] 
              : null;
            if (innsData) {
              const inn = innsData.innings1.teamId === team.id ? innsData.innings1 : innsData.innings2;
              (inn.battingOrder || []).slice(0, 11).forEach(id => playing11Ids.add(id));
            } else {
              (team.playing11 || team.players.slice(0, 11).map((p: any) => p.id)).forEach(id => playing11Ids.add(id));
            }
          }
        }

        const updatedPlayers = team.players.map(p => {
          // Get mutated player from the local teams copy (which has simulated fatigue and morale updates)
          const localTeam = teams.find(t => t.id === team.id);
          const localPlayer = localTeam?.players.find((lp: any) => lp.id === p.id);
          
          let fatigue = localPlayer ? localPlayer.fatigue : (p.fatigue || 0);
          let morale = localPlayer ? localPlayer.morale : (p.morale || 50);
          let form = localPlayer ? localPlayer.form : (p.form || 0);

          // Rest recovery: if player did NOT play today, fatigue decreases by 10
          const didPlay = playedToday && playing11Ids.has(p.id);
          if (!didPlay && fatigue > 0) {
            fatigue = Math.max(0, fatigue - 10);
          }

          // Morale decay: if team played today and player did NOT play, morale drops by 4% (minimum 25%)
          if (playedToday && !didPlay) {
            morale = Math.max(25, morale - 4);
            form = Math.max(-10, Math.min(10, Math.round((morale - 50) / 5)));
          }

          let player = { ...p, fatigue, morale, form };
          
          // Apply injury healing/recovery
          let activeInjury = (p as any).activeInjury;
          if (activeInjury) {
            const progressed = { ...activeInjury, currentDay: activeInjury.currentDay + 1 };
            if (progressed.currentDay >= progressed.recoveryDays) {
              player = recoverFromInjury(player);
            } else {
              player = { ...player, activeInjury: progressed };
            }
          }

          // Apply match performance stats (XP, runs, wickets, catches)
          const ps = playerStats[p.id];
          if (ps) {
            const ts = p.tournamentStats || { runs: 0, wickets: 0, catches: 0 };
            player = {
              ...player,
              matches: (p.matches || 0) + 1,
              runsScored: (p.runsScored || 0) + ps.runs,
              wickets: (p.wickets || 0) + ps.wickets,
              catches: (p.catches || 0) + ps.catches,
              xp: (p.xp || 0) + ps.xp,
              lifetimeXp: (p.lifetimeXp || 0) + ps.xp,
              tournamentStats: {
                runs: (ts.runs || 0) + ps.runs,
                wickets: (ts.wickets || 0) + ps.wickets,
                catches: (ts.catches || 0) + ps.catches
              }
            };
          }

          return player;
        });

        return { ...team, players: updatedPlayers };
      });

      return nextStore;
    });

    if (nextDay > schedule.totalDays) {
      gamePhase.set('season_end');
      goto('/season-review');
    } else {
      await saveCurrentGame(budget);
    }
  }

  let userHasAnyMatchesRemaining = $derived(
    schedule ? (schedule as any).matches.some((m: any) => 
      m.status === 'scheduled' && (m.team1Id === 'user_team' || m.team2Id === 'user_team')
    ) : false
  );

  async function fastForwardTournament() {
    if (!schedule || !teams.length) return;
    
    // Simulate all remaining matches
    let updatedSchedule = { ...schedule };
    const remainingMatches = updatedSchedule.matches.filter(m => m.status === 'scheduled');
    
    // Simulating all remaining matches
    for (const match of remainingMatches) {
      const team1 = teams.find(t => t.id === match.team1Id);
      const team2 = teams.find(t => t.id === match.team2Id);
      if (!team1 || !team2) continue;
      
      const result = simulateMatch(team1, team2);
      match.status = 'completed';
      match.result = {
        winner: result.winner,
        team1Score: result.team1Score,
        team2Score: result.team2Score
      };
      
      // Update team stats
      const runs1 = result.team1Score;
      const runs2 = result.team2Score;
      
      teamStore.update(currentTeams => 
        currentTeams.map(t => {
          if (t.id === match.team1Id) {
            const isWinner = result.winner === t.id;
            return {
              ...t,
              wins: t.wins + (isWinner ? 1 : 0),
              losses: t.losses + (isWinner ? 0 : 1),
              matchesPlayed: t.matchesPlayed + 1,
              runsFor: t.runsFor + runs1,
              runsAgainst: t.runsAgainst + runs2
            };
          }
          if (t.id === match.team2Id) {
            const isWinner = result.winner === t.id;
            return {
              ...t,
              wins: t.wins + (isWinner ? 1 : 0),
              losses: t.losses + (isWinner ? 0 : 1),
              matchesPlayed: t.matchesPlayed + 1,
              runsFor: t.runsFor + runs2,
              runsAgainst: t.runsAgainst + runs1
            };
          }
          return t;
        })
      );
    }
    
    // Set day to totalDays + 1
    updatedSchedule.currentDay = updatedSchedule.totalDays + 1;
    scheduleStore.set(updatedSchedule);
    
    gamePhase.set('season_end');
    goto('/season-review');
  }

  async function closeWelcomeModal() {
    isFirstLogin.set(false);
    await saveCurrentGame(budget);
  }

  async function goToGuide() {
    isFirstLogin.set(false);
    await saveCurrentGame(budget);
    goto('/guide');
  }
</script>

<svelte:head>
  <title>Fantasy Cricket Grand Manager</title>
</svelte:head>

<div class="dashboard-page">
  {#if $isFirstLogin}
    <div
      class="modal-overlay"
      style="z-index: 2000; padding: 14px;"
      onclick={(e) => { if (e.target === e.currentTarget) closeWelcomeModal(); }}
      onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeWelcomeModal(); }}
      role="button"
      tabindex="-1"
    >
      <div class="modal-content welcome-modal">
        <h2>Welcome, Manager!</h2>
        <p>You have just taken the reins of a brand new franchise. Before you head into the high-stakes Auction Room to draft your squad, would you like a quick tour of the rules and mechanics?</p>
        <p class="modal-note">Fantasy CricManager features unique tactical mechanics and fantasy faction synergies that are crucial to understand.</p>
        <div class="welcome-modal-btns">
          <button class="btn-cancel" onclick={closeWelcomeModal}>I know what I'm doing</button>
          <button class="btn-confirm" onclick={goToGuide}>Read Quick Start Guide</button>
        </div>
      </div>
    </div>
  {/if}

  {#if userTeam}
    {#if expiredSponsorships.length > 0}
      <div class="sponsorship-alerts-container">
        {#each expiredSponsorships as expiredSponsor}
          <div class="sponsorship-alert-banner">
            <span class="alert-emoji">⚠️</span>
            <div class="alert-content">
              <span class="alert-title">Sponsorship Expired</span>
              <span class="alert-subtext">Your contract with <strong class="text-gold">{expiredSponsor.sponsorName}</strong> has expired! Review the deals below or head to the <a href="/club" class="club-link">Club page</a> to manage facilities.</span>
            </div>
            <button class="alert-dismiss-btn" onclick={() => handleDismissExpiredSponsorship(expiredSponsor.id)}>
              Dismiss Alert
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Main Redesigned 3-Column Layout Shell -->
    <div class="dashboard-top-grid">
      
      <!-- COLUMN 1: TEAM OVERVIEW & SPONSOR -->
      <div class="col-team-sponsor">
        <!-- Team Profile Card -->
        <div class="team-profile-card">
          <div class="profile-header">
            <div class="logo-avatar" style="background: linear-gradient(135deg, {userTeam.colorPrimary} 0%, {userTeam.colorSecondary || userTeam.colorPrimary} 100%)" title={userTeam.name}>
              <TeamLogo logo={userTeam.logo || '🛡️'} size={32} />
            </div>
            <div class="profile-info">
              <h3>{userTeam.name}</h3>
              <span class="manager-lbl">Manager: {userTeam.coach || 'Alex Greenfield'}</span>
            </div>
          </div>

          <div class="profile-stats-row">
            <div class="stat-box">
              <span class="stat-val text-emerald">{userTeam.wins}</span>
              <span class="stat-lbl">Wins</span>
            </div>
            <div class="stat-box">
              <span class="stat-val text-ruby">{userTeam.losses}</span>
              <span class="stat-lbl">Losses</span>
            </div>
            <div class="stat-box">
              <span class="stat-val text-amethyst">{fanPopularity}%</span>
              <span class="stat-lbl">Fan Pop</span>
            </div>
          </div>

          <div class="profile-footer">
            <span class="trophy-icon">🏆</span>
            <span class="footer-text">
              {#if userStanding}
                {userStanding.points} pts — {getOrdinal(userStandingIndex + 1)} Place
              {:else}
                0 pts — N/A Place
              {/if}
            </span>
          </div>
        </div>

        <!-- Sponsor Details Card -->
        <div class="sponsor-status-card">
          {#if userTeam.sponsorships && userTeam.sponsorships.length > 0}
            {#each userTeam.sponsorships as sponsor}
              <div class="signed-sponsor-box {!sponsor.active ? 'expired' : ''}">
                <div class="sponsor-header">
                  <span class="sponsor-icon-large">{getSponsorIcon(sponsor.sponsorName)}</span>
                  <div>
                    <h4>{sponsor.sponsorName} {#if !sponsor.active}<span class="expired-lbl">(EXPIRED)</span>{/if}</h4>
                    <span class="sponsor-badge-type {sponsor.type}">{sponsor.type} sponsor</span>
                  </div>
                </div>
                <div class="sponsor-details-row">
                  <div class="det-item">
                    <span class="lbl">Matches</span>
                    <span class="val">{sponsor.matchesPlayed}/{sponsor.matches}</span>
                  </div>
                  <div class="det-item">
                    <span class="lbl">Earned</span>
                    <span class="val text-gold">${sponsor.earned.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <div class="no-sponsor-box">
              <span class="suitcase-icon">💼</span>
              <span class="no-sponsor-text">No sponsor signed</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- COLUMN 2: NEXT FIXTURE CARD -->
      <div class="col-next-fixture">
        <div class="next-fixture-card">
          {#if userNextMatch}
            {@const opponentTeamId = userNextMatch.team1Id === userTeam.id ? userNextMatch.team2Id : userNextMatch.team1Id}
            {@const opponentTeam = teams.find(t => t.id === opponentTeamId)}
            {@const opponentFaction = opponentTeam && opponentTeam.faction ? FACTIONS[opponentTeam.faction as keyof typeof FACTIONS] : null}
            {@const matchConditions = getMatchCondition(userNextMatch.id)}
            {@const userTeamStrength = calculateTeamStrength(userTeam)}
            {@const opponentStrength = opponentTeam ? calculateTeamStrength(opponentTeam) : null}

            <div class="fixture-header">
              <span class="lightning-icon">⚡</span>
              <span class="header-title">NEXT FIXTURE — DAY {userNextMatch.day}</span>
            </div>

            <div class="fixture-arena">
              <!-- User Team (Home/Away) -->
              <div class="team-side">
                <div class="team-badge-circle" style="background: linear-gradient(135deg, {userTeam.colorPrimary} 0%, {userTeam.colorSecondary || userTeam.colorPrimary} 100%)" title={userTeam.name}>
                  <TeamLogo logo={userTeam.logo || '🛡️'} size={36} />
                </div>
                <span class="team-title-txt">{userTeam.name}</span>
                <span class="home-away-lbl">{userNextMatch.team1Id === userTeam.id ? 'HOME' : 'AWAY'}</span>
              </div>

              <!-- VS Center -->
              <div class="vs-center">
                <span class="vs-big">VS</span>
                <span class="vs-meta-txt">T20 • Day {userNextMatch.day}</span>
              </div>

              <!-- Opponent Team -->
              <div class="team-side">
                <div class="team-badge-circle" style="background: linear-gradient(135deg, {opponentTeam?.colorPrimary || '#475569'} 0%, {opponentTeam?.colorSecondary || '#1e293b'} 100%)" title={opponentTeam?.name || 'Opponent'}>
                  <TeamLogo logo={opponentTeam?.logo || getFactionEmoji(opponentTeam?.faction) || '🛡️'} size={36} />
                </div>
                <span class="team-title-txt">{opponentTeam?.name || 'Opponent'}</span>
                <span class="home-away-lbl">{userNextMatch.team2Id === userTeam.id ? 'HOME' : 'AWAY'}</span>
              </div>
            </div>

            <div class="fixture-conditions">
              <span class="cond-item">☀️ Clear skies</span>
              <span class="cond-divider">•</span>
              <span class="cond-item">🌱 Green Pitch</span>
              <span class="cond-divider">•</span>
              <span class="cond-item">🏟️ {userNextMatch.venue.split(' ')[0]}home</span>
            </div>

            <div class="fixture-action-dock">
              <a href="/match" class="play-match-cta-btn">
                <svg class="play-svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                {hasActiveMatch ? 'CONTINUE MATCH' : 'PLAY MATCH'}
              </a>
              <button class="auto-sim-link-btn" onclick={quickSimulateUserMatch} title="Instantly simulate match">
                Auto Simulate Match ⚡
              </button>
            </div>
          {:else}
            <!-- No Matches Left / Day Done -->
            <div class="no-next-match-box">
              {#if schedule && !userHasAnyMatchesRemaining && schedule.currentDay <= schedule.totalDays}
                 <p style="color: var(--color-accent); font-weight: bold; margin-bottom: 8px; text-align: center;">🎉 All matches completed for your franchise!</p>
                 <button class="advance-day-btn" onclick={fastForwardTournament} style="background: var(--color-accent); border-color: var(--color-accent); width: 100%;" title="Simulate the rest of the matches and see final standings">
                   ⏩ Fast-Forward & Finish Season
                 </button>
              {:else}
                 <p>No upcoming matches for your team today.</p>
                 {#if phase === 'tournament' || phase === 'menu'}
                    <button class="advance-day-btn" onclick={advanceTournament}>
                      Advance to Day {schedule?.currentDay ? schedule.currentDay + 1 : ''} ➔
                    </button>
                 {/if}
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- COLUMN 3: LEAGUE STANDINGS -->
      <div class="col-standings">
        <div class="standings-card">
          <div class="standings-card-header">
            <h4>LEAGUE STANDINGS</h4>
          </div>

          <div class="mini-standings-table">
            {#each standings.slice(0, 6) as standing, i}
              {@const team = teams.find(t => t.id === standing.teamId)}
              <div class="standing-row-item" class:user-team-row={standing.teamId === userTeam.id}>
                <span class="pos-num">{i + 1}</span>
                <div class="team-name-cell">
                  <span class="faction-dot" style="background: {team?.colorPrimary || 'var(--accent-emerald)'}" title={team?.name || standing.teamName}></span>
                  <span class="team-name-truncate">{standing.teamName}</span>
                </div>
                <span class="pts-val">{standing.points}</span>
                <span class="nrr-val" class:text-emerald={standing.nrr >= 0} class:text-ruby={standing.nrr < 0}>
                  {standing.nrr >= 0 ? '+' : ''}{standing.nrr.toFixed(2)}
                </span>
              </div>
            {/each}
          </div>
        </div>
      </div>

    </div>

    <!-- TOURNAMENT CALENDAR SLIDER (Horizontal) -->
    {#if schedule}
      <section class="calendar-panel">
        <div class="panel-header">
          <h3>TOURNAMENT CALENDAR</h3>
        </div>

        <div class="calendar-scroll-wrapper">
           {#each calendarDays() as day}
            <div class="calendar-day-card" 
                 class:active-today={day.day === schedule.currentDay} 
                 class:completed={day.status === 'completed'}
                 class:future={day.day > schedule.currentDay}>
              <span class="day-num-lbl">DAY {day.day}</span>
              {#if day.hasMatch && (day.team1Id === 'user_team' || day.team2Id === 'user_team')}
                <span class="venue-pill {day.team1Id === 'user_team' ? 'home' : 'away'}">
                  {day.team1Id === 'user_team' ? '🏠 HOME' : '✈️ AWAY'}
                </span>
              {/if}
              
              {#if day.hasMatch}
                <div class="calendar-match-icons">
                  <div class="mini-logo-container">
                    <span class="mini-logo" title="{day.team1Name} (Home)" style="position: relative; display: inline-block; width: 16px; height: 16px;">
                      <TeamLogo logo={day.team1Logo} size={16} />
                      <span class="venue-logo-badge home" style="position: absolute; bottom: -4px; right: -4px; font-size: 8px;">🏠</span>
                    </span>
                    {#if day.winnerId === day.team1Id}
                      <span class="winner-crown" title="Winner">👑</span>
                    {/if}
                  </div>
                  <span class="calendar-vs">v</span>
                  <div class="mini-logo-container">
                    <span class="mini-logo" title="{day.team2Name} (Away)" style="position: relative; display: inline-block; width: 16px; height: 16px;">
                      <TeamLogo logo={day.team2Logo} size={16} />
                      <span class="venue-logo-badge away" style="position: absolute; bottom: -4px; right: -4px; font-size: 8px;">✈️</span>
                    </span>
                    {#if day.winnerId === day.team2Id}
                      <span class="winner-crown" title="Winner">👑</span>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="calendar-match-icons no-match">
                  <span class="no-match-emoji">💤</span>
                </div>
              {/if}

              {#if day.status === 'completed'}
                <span class="outcome-badge" class:win={day.outcome === 'W'} class:loss={day.outcome === 'L'} class:draw={day.outcome === 'D'} class:neutral={day.outcome === 'Done'}>
                  {day.outcome}
                </span>
              {:else if day.day === schedule.currentDay}
                <span class="outcome-badge today-lbl">TODAY</span>
              {:else}
                <span class="outcome-badge tbd-lbl">TBD</span>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- SPONSORSHIP OFFERS SECTION -->
    {#if userTeam && activeSponsorshipsCount < maxSponsors && ($gamePhase === 'tournament' || $gamePhase === 'menu') && sponsorshipOffers.length > 0}
      <section class="sponsorship-offers-panel">
        <div class="panel-header">
          <h3>🤝 SPONSORSHIP OFFERS</h3>
        </div>
        <p class="offers-desc">Review deals for the season. Sponsors provide vital operational match funds. You can sign up to {maxSponsors} contract(s).</p>
        
        <div class="offers-grid">
          {#each sponsorshipOffers as offer}
            <div class="offer-deal-card">
              <div class="offer-header">
                <span class="offer-large-icon">{getSponsorIcon(offer.sponsorName)}</span>
                <div>
                  <h4>{offer.sponsorName}</h4>
                  <span class="offer-sub">{offer.matches} match term</span>
                </div>
              </div>

              <div class="offer-stats">
                <div class="off-stat">
                  <span class="lbl">BASE / MATCH</span>
                  <span class="val text-gold">${offer.bonusAmount.toLocaleString()}</span>
                </div>
                <div class="off-stat">
                  <span class="lbl">WIN BONUS</span>
                  <span class="val text-emerald">+${offer.performanceBonus.toLocaleString()}</span>
                </div>
              </div>

              <button class="sign-deal-cta-btn" onclick={() => acceptSponsorship(offer)}>
                SIGN DEAL
              </button>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- SECONDARY ROW: SQUAD & TOP PERFORMERS -->
    <div class="dashboard-secondary-grid">
      
      <!-- SQUAD PREVIEW -->
      <section class="squad-preview-card">
        <div class="section-title-bar">
          <h3>👥 CURRENT SQUAD</h3>
          {#if phase !== 'match'}
            <button onclick={() => goto('/squad')} class="view-all-squad-btn">Manage Squad →</button>
          {/if}
        </div>
        
        <div class="horizontal-squad-slider">
          {#each (userTeam.players || []) as player}
            <div class="compact-squad-player-item">
              <PlayerCard {player} teamColorPrimary={userTeam.colorPrimary} teamColorSecondary={userTeam.colorSecondary} />
            </div>
          {:else}
            <p class="no-squad-lbl">No roster available. Go to retention/auction!</p>
          {/each}
        </div>
      </section>

      <!-- TOP PERFORMERS -->
      <section class="top-performers-card">
        <div class="section-title-bar">
          <h3>⭐ LEAGUE LEADERS</h3>
        </div>

        <div class="leaders-stack">
          <!-- BATSMAN -->
          <div class="leader-row">
            <span class="leader-lbl">BATSMAN (RUNS)</span>
            <div class="leader-info-box">
              {#if bestBat && bestBat.tournamentStats?.runs > 0}
                <span class="leader-name">{bestBat.name}</span>
                <span class="leader-score text-gold">{bestBat.tournamentStats.runs} runs</span>
              {:else}
                <span class="leader-name muted">No stats recorded</span>
                <span class="leader-score">—</span>
              {/if}
            </div>
          </div>

          <!-- BOWLER -->
          <div class="leader-row">
            <span class="leader-lbl">BOWLER (WICKETS)</span>
            <div class="leader-info-box">
              {#if bestBowl && bestBowl.tournamentStats?.wickets > 0}
                <span class="leader-name">{bestBowl.name}</span>
                <span class="leader-score text-emerald">{bestBowl.tournamentStats.wickets} wickets</span>
              {:else}
                <span class="leader-name muted">No stats recorded</span>
                <span class="leader-score">—</span>
              {/if}
            </div>
          </div>

          <!-- MVP -->
          <div class="leader-row">
            <span class="leader-lbl">VALUABLE PLAYER (POINTS)</span>
            <div class="leader-info-box">
              {#if mvp && ((mvp.tournamentStats?.runs || 0) > 0 || (mvp.tournamentStats?.wickets || 0) > 0)}
                <span class="leader-name">{mvp.name}</span>
                <span class="leader-score text-cyan">{((mvp.tournamentStats?.runs || 0) * 1 + (mvp.tournamentStats?.wickets || 0) * 20)} pts</span>
              {:else}
                <span class="leader-name muted">No stats recorded</span>
                <span class="leader-score">—</span>
              {/if}
            </div>
          </div>
        </div>
      </section>

    </div>

  {/if}
</div>

<!-- Match Result Modal for Auto-Simulate -->
{#if showMatchResultModal}
  <div
    class="modal-overlay"
    style="z-index: 1000; padding: 14px;"
    onclick={(e) => { if (e.target === e.currentTarget) closeMatchResultModal(); }}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeMatchResultModal(); }}
    role="button"
    tabindex="-1"
  >
    <div class="modal-content match-result-modal-box">
       <div class="modal-header">
         <h2>Match Result</h2>
         <button class="btn-cancel" onclick={closeMatchResultModal}>Close & Continue</button>
       </div>
       
        {#if lastMatchResult && lastSimulatedInnings1 && lastSimulatedInnings2}
           <div class="result-headline">
             <h3>
                {lastMatchResult.winner === 'team1'
                  ? teams.find(t => t.id === (lastSimulatedInnings1 as innings).teamId)?.name
                  : lastMatchResult.winner === 'team2'
                    ? teams.find(t => t.id === (lastSimulatedInnings2 as innings).teamId)?.name
                    : 'Draw'} Wins!
             </h3>
             <p class="final-score">
                {(lastSimulatedInnings1 as innings).totalRuns}/{(lastSimulatedInnings1 as innings).wickets} vs {(lastSimulatedInnings2 as innings).totalRuns}/{(lastSimulatedInnings2 as innings).wickets}
             </p>
           </div>
        {/if}

       <div class="modal-body-content">
         {#if lastSimulatedInnings1 && lastSimulatedInnings2 && teams.length > 0}
            <MatchSummary 
              inningsList={[lastSimulatedInnings1, lastSimulatedInnings2]} 
              teams={teams} 
              matchComplete={true} 
              matchResult={lastMatchResult}
            />
         {/if}
       </div>
       
       <div class="modal-footer">
          <button class="btn-confirm" onclick={closeMatchResultModal}>Continue Tournament</button>
       </div>
    </div>
  </div>
{/if}

<style>
  .sponsorship-alerts-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 8px;
    width: 100%;
  }

  .sponsorship-alert-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-left: 4px solid #ef4444;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
  }

  .alert-emoji {
    font-size: 20px;
    margin-right: 12px;
  }

  .alert-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }

  .alert-title {
    font-weight: 700;
    color: #ef4444;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }

  .alert-subtext {
    color: var(--text-primary);
    line-height: 1.4;
  }

  .alert-subtext .club-link {
    color: var(--warning);
    text-decoration: underline;
    font-weight: 600;
  }

  .alert-subtext .club-link:hover {
    color: #fbbf24;
  }

  .alert-dismiss-btn {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 11px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 16px;
    white-space: nowrap;
  }

  .alert-dismiss-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
    transform: translateY(-1px);
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Premium CricMGR Stylesheet matching ttyy.png */
  .dashboard-page {
    width: 100%;
    margin: 0 auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Grid Layouts */
  .dashboard-top-grid {
    display: grid;
    grid-template-columns: 28% 44% 28%;
    gap: 16px;
    align-items: start;
  }

  @media (max-width: 1100px) {
    .dashboard-top-grid {
      grid-template-columns: 1fr;
    }
  }

  /* COLUMN 1: TEAM OVERVIEW CARD */
  .team-profile-card {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 100%), var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 12px;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .logo-avatar {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 0 0 16px rgba(6, 182, 212, 0.2);
  }

  .profile-info h3 {
    font-family: var(--font-fantasy) !important;
    font-size: 17px;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .manager-lbl {
    font-size: 11px;
    color: var(--text-muted);
  }

  .profile-stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    background: rgba(8, 13, 22, 0.3);
    border: 1px solid rgba(148, 163, 184, 0.06);
    border-radius: 10px;
    padding: 12px 6px;
    margin-bottom: 16px;
    text-align: center;
  }

  :global([data-theme="light"]) .profile-stats-row {
    background: rgba(15, 23, 42, 0.03);
    border: 1px solid rgba(15, 23, 42, 0.06);
  }

  .stat-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-val {
    font-family: var(--font-sports) !important;
    font-size: 18px;
    font-weight: 700;
  }

  .stat-lbl {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .profile-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    padding-top: 8px;
    border-top: 1px dashed rgba(148, 163, 184, 0.08);
  }

  :global([data-theme="light"]) .profile-footer {
    border-top-color: rgba(15, 23, 42, 0.08);
  }

  .trophy-icon {
    font-size: 14px;
  }

  .footer-text {
    font-family: var(--font-fantasy);
    font-weight: 600;
  }

  /* SPONSOR STATUS CARD */
  .sponsor-status-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 16px;
    min-height: 100px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .signed-sponsor-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .signed-sponsor-box.expired {
    opacity: 0.5;
    filter: grayscale(40%);
  }

  .expired-lbl {
    color: #ef4444;
    font-size: 10px;
    margin-left: 4px;
    font-weight: 900;
  }

  .sponsor-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sponsor-icon-large {
    font-size: 24px;
  }

  .sponsor-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .sponsor-badge-type {
    font-size: 9px;
    text-transform: uppercase;
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    display: inline-block;
  }

  .sponsor-details-row {
    display: flex;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.12);
    padding: 8px 12px;
    border-radius: 8px;
  }

  :global([data-theme="light"]) .sponsor-details-row {
    background: rgba(15, 23, 42, 0.03);
  }

  .det-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .det-item .lbl {
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .det-item .val {
    font-family: var(--font-sports);
    font-size: 12px;
    font-weight: 700;
  }

  .no-sponsor-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted);
  }

  .suitcase-icon {
    font-size: 24px;
    opacity: 0.5;
  }

  .no-sponsor-text {
    font-size: 12px;
    font-family: var(--font-fantasy);
  }

  /* COLUMN 2: NEXT FIXTURE CARD */
  .next-fixture-card {
    background: linear-gradient(180deg, rgba(251, 191, 36, 0.03) 0%, rgba(251, 191, 36, 0) 100%), var(--bg-secondary);
    border: 1px solid rgba(251, 191, 36, 0.25);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    position: relative;
    box-shadow: inset 0 1px 0 rgba(251, 191, 36, 0.1);
  }

  .fixture-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }

  .lightning-icon {
    color: var(--accent-gold);
    font-size: 14px;
    animation: flash-pulse 2s infinite;
  }

  @keyframes flash-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; filter: drop-shadow(0 0 4px var(--accent-gold)); }
  }

  .header-title {
    font-family: var(--font-fantasy);
    font-size: 11px;
    color: var(--accent-gold);
    letter-spacing: 0.15em;
    font-weight: 700;
  }

  .fixture-arena {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .team-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 38%;
    text-align: center;
  }

  .team-badge-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global([data-theme="light"]) .team-badge-circle {
    border-color: rgba(15, 23, 42, 0.08);
    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
  }

  .logo-txt {
    font-size: 26px;
  }

  .team-title-txt {
    font-family: var(--font-fantasy) !important;
    font-weight: 700;
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.2;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .home-away-lbl {
    font-size: 9px;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .vs-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 24%;
  }

  .vs-big {
    font-family: var(--font-sports) !important;
    font-size: 22px;
    font-weight: 900;
    color: var(--text-muted);
    letter-spacing: 2px;
  }

  .vs-meta-txt {
    font-size: 9px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .fixture-conditions {
    display: flex;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 24px;
    background: rgba(0, 0, 0, 0.12);
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.04);
  }

  :global([data-theme="light"]) .fixture-conditions {
    background: rgba(15, 23, 42, 0.04);
    border-color: rgba(15, 23, 42, 0.04);
  }

  .cond-divider {
    opacity: 0.3;
  }

  .fixture-action-dock {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .play-match-cta-btn {
    background: #fbbf24 !important;
    color: #0b0f19 !important;
    font-family: var(--font-fantasy) !important;
    font-weight: 850 !important;
    font-size: 13px !important;
    letter-spacing: 0.1em;
    height: 44px;
    border-radius: 8px !important;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none !important;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(251, 191, 36, 0.25);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .play-match-cta-btn:hover {
    background: #f59e0b !important;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(251, 191, 36, 0.35);
  }

  .play-svg {
    width: 16px;
    height: 16px;
  }

  .auto-sim-link-btn {
    background: none !important;
    border: none !important;
    color: var(--text-muted) !important;
    font-size: 11px !important;
    cursor: pointer;
    padding: 4px !important;
    transition: all 0.2s;
    text-align: center;
  }

  .auto-sim-link-btn:hover {
    color: var(--accent-gold) !important;
    transform: scale(1.02);
  }

  .no-next-match-box {
    text-align: center;
    padding: 30px 10px;
    color: var(--text-secondary);
  }

  .advance-day-btn {
    margin-top: 16px;
    background: rgba(6, 182, 212, 0.15) !important;
    color: #06b6d4 !important;
    border: 1px solid rgba(6, 182, 212, 0.3) !important;
    padding: 10px 20px !important;
    border-radius: 8px !important;
    font-weight: 700 !important;
    cursor: pointer;
    transition: all 0.2s;
  }

  .advance-day-btn:hover {
    background: rgba(6, 182, 212, 0.25) !important;
    color: #ffffff !important;
  }

  /* COLUMN 3: LEAGUE STANDINGS */
  .standings-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 16px;
    height: 100%;
  }

  .standings-card-header {
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    padding-bottom: 10px;
    margin-bottom: 12px;
  }

  :global([data-theme="light"]) .standings-card-header {
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }

  .standings-card-header h4 {
    margin: 0;
    font-family: var(--font-fantasy);
    font-size: 12px;
    letter-spacing: 0.12em;
    color: var(--text-muted);
  }

  .mini-standings-table {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .standing-row-item {
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: 6px;
    font-size: 12px;
    transition: all 0.2s;
  }

  .standing-row-item:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  :global([data-theme="light"]) .standing-row-item:hover {
    background: rgba(15, 23, 42, 0.02);
  }

  .user-team-row {
    background: rgba(6, 182, 212, 0.12) !important;
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: #06b6d4;
    font-weight: 700;
  }

  :global([data-theme="light"]) .user-team-row {
    color: #0891b2;
    background: rgba(6, 182, 212, 0.08) !important;
  }

  .pos-num {
    width: 20px;
    font-family: var(--font-sports);
    font-weight: 700;
    color: var(--text-muted);
  }

  .user-team-row .pos-num {
    color: #06b6d4;
  }

  :global([data-theme="light"]) .user-team-row .pos-num {
    color: #0891b2;
  }

  .team-name-cell {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .faction-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .team-name-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-fantasy);
  }

  .pts-val {
    width: 24px;
    text-align: center;
    font-family: var(--font-sports);
    font-weight: 700;
  }

  .nrr-val {
    width: 44px;
    text-align: right;
    font-family: var(--font-sports);
    font-weight: 700;
  }

  .text-emerald {
    color: var(--accent-emerald) !important;
  }

  .text-ruby {
    color: var(--accent-ruby) !important;
  }

  /* TOURNAMENT CALENDAR SLIDER */
  .calendar-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 16px;
  }

  .panel-header {
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }

  :global([data-theme="light"]) .panel-header {
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }

  .panel-header h3 {
    margin: 0;
    font-family: var(--font-fantasy);
    font-size: 13px;
    letter-spacing: 0.12em;
    color: var(--text-primary);
  }

  .calendar-scroll-wrapper {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.15) transparent;
  }

  .calendar-scroll-wrapper::-webkit-scrollbar {
    height: 6px;
  }

  .calendar-scroll-wrapper::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.15);
    border-radius: 4px;
  }

  .calendar-day-card {
    flex-shrink: 0;
    width: 90px;
    background: rgba(8, 13, 22, 0.25);
    border: 1px solid rgba(148, 163, 184, 0.08);
    border-radius: 10px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .venue-pill {
    font-size: 8px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 8px;
    margin-top: -2px;
    display: inline-block;
  }

  .venue-pill.home {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .venue-pill.away {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  :global([data-theme="light"]) .calendar-day-card {
    background: rgba(15, 23, 42, 0.02);
    border-color: rgba(15, 23, 42, 0.06);
  }

  .calendar-day-card.active-today {
    border: 2px solid var(--accent-gold);
    background: rgba(245, 158, 11, 0.05);
  }

  .calendar-day-card.completed {
    opacity: 0.9;
  }

  .calendar-day-card.future {
    opacity: 0.55;
  }

  .day-num-lbl {
    font-size: 10px;
    font-weight: bold;
    color: var(--text-muted);
    font-family: var(--font-sports);
  }

  .active-today .day-num-lbl {
    color: var(--accent-gold);
  }

  .outcome-badge {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    text-align: center;
    width: 100%;
    font-family: var(--font-fantasy);
  }

  .outcome-badge.win {
    background: rgba(16, 185, 129, 0.15);
    color: var(--accent-emerald);
  }

  .outcome-badge.loss {
    background: rgba(239, 68, 68, 0.15);
    color: var(--accent-ruby);
  }

  .outcome-badge.draw {
    background: rgba(148, 163, 184, 0.15);
    color: var(--text-secondary);
  }

  .outcome-badge.neutral {
    background: rgba(148, 163, 184, 0.12);
    color: var(--text-secondary);
  }

  .outcome-badge.today-lbl {
    background: rgba(245, 158, 11, 0.15);
    color: var(--accent-gold);
  }

  .outcome-badge.tbd-lbl {
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-muted);
  }

  :global([data-theme="light"]) .outcome-badge.tbd-lbl {
    background: rgba(15, 23, 42, 0.03);
  }

  /* SPONSOR OFFERS PANEL */
  .sponsorship-offers-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 16px;
  }

  .offers-desc {
    font-size: 12px;
    color: var(--text-muted);
    margin: -8px 0 16px 0;
  }

  .offers-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  @media (max-width: 900px) {
    .offers-grid {
      grid-template-columns: 1fr;
    }
  }

  .offer-deal-card {
    background: rgba(8, 13, 22, 0.25);
    border: 1px solid rgba(148, 163, 184, 0.08);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
  }

  :global([data-theme="light"]) .offer-deal-card {
    background: rgba(15, 23, 42, 0.02);
    border-color: rgba(15, 23, 42, 0.06);
  }

  .offer-header {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .offer-large-icon {
    font-size: 26px;
  }

  .offer-header h4 {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 700;
  }

  .offer-sub {
    font-size: 10px;
    color: var(--text-muted);
  }

  .offer-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(0, 0, 0, 0.12);
    padding: 10px;
    border-radius: 8px;
  }

  :global([data-theme="light"]) .offer-stats {
    background: rgba(15, 23, 42, 0.04);
  }

  .off-stat {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
  }

  .off-stat .lbl {
    color: var(--text-muted);
    font-family: var(--font-fantasy);
  }

  .off-stat .val {
    font-family: var(--font-sports);
    font-weight: 700;
  }

  .sign-deal-cta-btn {
    background: none !important;
    border: 1px solid rgba(245, 158, 11, 0.4) !important;
    color: var(--accent-gold) !important;
    font-family: var(--font-fantasy) !important;
    font-weight: bold !important;
    padding: 10px !important;
    border-radius: 8px !important;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .sign-deal-cta-btn:hover {
    background: rgba(245, 158, 11, 0.08) !important;
    border-color: var(--accent-gold) !important;
    transform: translateY(-1px);
  }

  /* SECONDARY SECTION: SQUAD & LEADERS */
  .dashboard-secondary-grid {
    display: grid;
    grid-template-columns: 62% 35%;
    gap: 16px;
  }

  @media (max-width: 1100px) {
    .dashboard-secondary-grid {
      grid-template-columns: 1fr;
    }
  }

  .squad-preview-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 8px 12px;
    overflow: hidden;
  }

  .section-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    padding-bottom: 10px;
    margin-bottom: 16px;
  }

  :global([data-theme="light"]) .section-title-bar {
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }

  .section-title-bar h3 {
    margin: 0;
    font-family: var(--font-fantasy);
    font-size: 13px;
    letter-spacing: 0.12em;
    color: var(--text-primary);
  }

  .view-all-squad-btn {
    background: none !important;
    border: none !important;
    color: #06b6d4 !important;
    font-size: 12px !important;
    cursor: pointer;
    padding: 0 !important;
  }

  :global([data-theme="light"]) .view-all-squad-btn {
    color: #0891b2 !important;
  }

  .horizontal-squad-slider {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
    scrollbar-width: thin;
  }

  .compact-squad-player-item {
    flex-shrink: 0;
    width: 260px;
  }

  .no-squad-lbl {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
  }

  /* LEAGUE LEADERS */
  .top-performers-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 16px;
  }

  .leaders-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .leader-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .leader-lbl {
    font-family: var(--font-fantasy);
    font-size: 9px;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .leader-info-box {
    display: flex;
    justify-content: space-between;
    background: rgba(8, 13, 22, 0.25);
    border: 1px solid rgba(148, 163, 184, 0.06);
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
  }

  :global([data-theme="light"]) .leader-info-box {
    background: rgba(15, 23, 42, 0.03);
    border-color: rgba(15, 23, 42, 0.06);
  }

  .leader-name {
    font-family: var(--font-fantasy);
    font-weight: 600;
    color: var(--text-primary);
  }

  .leader-score {
    font-family: var(--font-sports);
    font-weight: 700;
  }

  .text-cyan {
    color: #06b6d4 !important;
  }

  :global([data-theme="light"]) .text-cyan {
    color: #0891b2 !important;
  }

  /* MODALS */
  .welcome-modal {
    background: var(--bg-secondary) !important;
    border: 2px solid var(--accent-gold) !important;
    border-radius: 14px;
    padding: 20px;
    max-width: 550px;
    text-align: center;
  }

  .welcome-modal h2 {
    font-family: var(--font-fantasy) !important;
    color: var(--accent-gold);
    margin-bottom: 12px;
  }

  .welcome-modal p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    margin-bottom: 12px;
  }

  .modal-note {
    font-size: 11px !important;
    color: var(--text-muted) !important;
    font-style: italic;
    margin-bottom: 20px !important;
  }

  .welcome-modal-btns {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  /* Auto-sim match result modal */
  .match-result-modal-box {
    max-width: 800px;
    background: var(--bg-primary) !important;
    border: 1px solid var(--border-color) !important;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    padding-bottom: 10px;
    margin-bottom: 16px;
  }

  :global([data-theme="light"]) .modal-header {
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }

  .modal-header h2 {
    font-family: var(--font-fantasy) !important;
    color: var(--accent-gold);
    margin: 0;
  }

  .result-headline {
    text-align: center;
    margin-bottom: 20px;
  }

  .result-headline h3 {
    font-family: var(--font-fantasy) !important;
    color: var(--accent-emerald);
    font-size: 18px;
    margin: 0 0 6px 0;
  }

  .final-score {
    font-family: var(--font-sports) !important;
    font-size: 20px;
    font-weight: 800;
    color: var(--text-secondary);
  }

  .modal-body-content {
    background: rgba(8, 13, 22, 0.5);
    border-radius: 12px;
    padding: 16px;
    max-height: 50vh;
    overflow-y: auto;
  }

  :global([data-theme="light"]) .modal-body-content {
    background: rgba(15, 23, 42, 0.03);
  }

  .modal-footer {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }

  .calendar-match-icons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 36px;
    margin: 4px 0;
  }

  .mini-logo-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(148, 163, 184, 0.06);
    border-radius: 50%;
    font-size: 13px;
  }

  :global([data-theme="light"]) .mini-logo-container {
    background: rgba(15, 23, 42, 0.02);
    border-color: rgba(15, 23, 42, 0.05);
  }

  .mini-logo {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .winner-crown {
    position: absolute;
    top: -6px;
    right: -6px;
    font-size: 9px;
    filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.5));
    animation: bounce-slow 2s infinite;
  }

  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }

  .calendar-vs {
    font-family: var(--font-sports);
    font-size: 10px;
    color: var(--text-muted);
    font-weight: bold;
    text-transform: uppercase;
  }

  .no-match-emoji {
    font-size: 16px;
    opacity: 0.6;
  }
</style>
