import { defaultFormation } from './formations';
import { pick, randomRng, weightedPick } from './random';
import { eligibleSlots } from './ratings';
import type { DraftPick, DraftState, Player, Roster } from '../types';

type RerollAxis = 'team' | 'year';
const maxRerolls = 3;

export function createDraft(formation = defaultFormation): DraftState {
  return {
    formation,
    rollIndex: 0,
    rerollsLeft: maxRerolls,
    currentRoster: null,
    recentRosterIds: [],
    picks: [],
  };
}

export function rollRoster(state: DraftState, rosters: Roster[]): DraftState {
  const rng = randomRng();
  const recent = new Set(state.recentRosterIds);
  const pickedTeams = new Set(state.picks.map((pick) => pick.sourceRoster.teamCode));
  const available = rosters.filter((roster) => !recent.has(roster.id) && !pickedTeams.has(roster.teamCode));
  const pool = available.length > 0 ? available : rosters;

  const weights = pool.map((roster) => {
    if (roster.strength >= 88) return 0.55;
    if (roster.strength >= 82) return 0.85;
    if (roster.strength <= 66) return 1.35;
    return 1.15;
  });

  const currentRoster = weightedPick(rng, pool, weights);

  return {
    ...state,
    currentRoster,
    rollIndex: state.rollIndex + 1,
    recentRosterIds: [...state.recentRosterIds, currentRoster.id].slice(-8),
  };
}

export function rerollRoster(state: DraftState, rosters: Roster[], axis: RerollAxis): DraftState {
  if (!state.currentRoster) return state;
  if (state.rerollsLeft <= 0) return state;

  const rng = randomRng();
  const current = state.currentRoster;
  const recent = new Set(state.recentRosterIds);
  const pickedTeams = new Set(state.picks.map((pick) => pick.sourceRoster.teamCode));

  const pool = rosters.filter((roster) => {
    if (roster.id === current.id) return false;
    if (recent.has(roster.id)) return false;
    if (axis === 'team') return roster.year === current.year && !pickedTeams.has(roster.teamCode);
    return roster.teamCode === current.teamCode;
  });

  const fallback = rosters.filter((roster) => {
    if (roster.id === current.id) return false;
    if (axis === 'team') return roster.year === current.year;
    return roster.teamCode === current.teamCode;
  });

  const options = pool.length > 0 ? pool : fallback;
  if (options.length === 0) return state;

  const weights = options.map((roster) => {
    if (axis === 'team') {
      if (roster.strength <= 66) return 1.3;
      if (roster.strength >= 86) return 0.7;
      return 1;
    }
    return 1 / (1 + Math.abs(roster.strength - current.strength) * 0.08);
  });

  const currentRoster = weightedPick(rng, options, weights);

  return {
    ...state,
    currentRoster,
    rollIndex: state.rollIndex + 1,
    rerollsLeft: state.rerollsLeft - 1,
    recentRosterIds: [...state.recentRosterIds, currentRoster.id].slice(-8),
  };
}

export function pickPlayer(state: DraftState, player: Player, slotId?: string): DraftState {
  if (!state.currentRoster) return state;
  if (state.picks.some((pick) => pick.player.playerId === player.playerId)) return state;

  const slots = eligibleSlots(state.formation, state.picks, player);
  const chosenSlot = slotId ? slots.find((slot) => slot.id === slotId) : slots[0];
  if (!chosenSlot) return state;

  const nextPick: DraftPick = {
    slotId: chosenSlot.id,
    player,
    sourceRoster: {
      id: state.currentRoster.id,
      teamCode: state.currentRoster.teamCode,
      teamName: state.currentRoster.teamName,
      year: state.currentRoster.year,
      strength: state.currentRoster.strength,
    },
  };

  return {
    ...state,
    picks: [...state.picks, nextPick],
    currentRoster: null,
  };
}

export function removePick(state: DraftState, slotId: string): DraftState {
  return {
    ...state,
    picks: state.picks.filter((pick) => pick.slotId !== slotId),
  };
}

export function autoPickEmergency(state: DraftState): DraftState {
  if (!state.currentRoster) return state;
  const rng = randomRng();
  const eligible = state.currentRoster.players.filter((player) => eligibleSlots(state.formation, state.picks, player).length > 0);
  if (eligible.length === 0) return state;
  const player = pick(rng, eligible);
  return pickPlayer(state, player);
}

export function isComplete(state: DraftState): boolean {
  return state.picks.length >= 11;
}

// Build (or finish) a full XI automatically: roll a roster, pick an eligible
// player weighted toward quality, repeat until the lineup is complete.
export function autoDraft(state: DraftState, rosters: Roster[]): DraftState {
  let next = state;
  let guard = 0;

  while (!isComplete(next) && guard < 600) {
    guard += 1;
    if (!next.currentRoster) {
      next = rollRoster(next, rosters);
    }

    const roster = next.currentRoster;
    const eligible = roster
      ? roster.players.filter((player) => eligibleSlots(next.formation, next.picks, player).length > 0)
      : [];

    if (eligible.length === 0) {
      next = { ...next, currentRoster: null };
      continue;
    }

    const rng = randomRng();
    const weights = eligible.map((player) => Math.max(1, player.overall - 45));
    const player = weightedPick(rng, eligible, weights);
    next = pickPlayer(next, player);
  }

  return { ...next, currentRoster: null };
}
