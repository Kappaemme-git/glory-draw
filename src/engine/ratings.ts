import { formations } from './formations';
import type { DraftPick, Player, Position, Roster, Slot, TeamRatings } from '../types';

const attackWeights: Record<Position, number> = {
  GK: 0,
  RB: 0.16,
  LB: 0.16,
  CB: 0.04,
  DM: 0.35,
  CM: 0.56,
  AM: 0.84,
  RM: 0.68,
  LM: 0.68,
  RW: 1,
  LW: 1,
  ST: 1.08,
};

const defenseWeights: Record<Position, number> = {
  GK: 1.15,
  RB: 0.86,
  LB: 0.86,
  CB: 1,
  DM: 0.82,
  CM: 0.46,
  AM: 0.18,
  RM: 0.32,
  LM: 0.32,
  RW: 0.08,
  LW: 0.08,
  ST: 0.05,
};

function weightedAverage(items: { value: number; weight: number }[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
}

export function slotById(formation: string, id: string): Slot | null {
  return formations[formation]?.find((slot) => slot.id === id) ?? null;
}

export function canPlay(player: Player, position: Position): boolean {
  return player.positions.includes(position);
}

export function ratingsFromPicks(formation: string, picks: DraftPick[]): TeamRatings {
  const slots = formations[formation];
  const rows = picks
    .map((pick) => {
      const slot = slots.find((candidate) => candidate.id === pick.slotId);
      return slot ? { slot, player: pick.player } : null;
    })
    .filter(Boolean) as { slot: Slot; player: Player }[];

  if (rows.length === 0) return { attack: 0, defense: 0, overall: 0 };

  const attack = weightedAverage(
    rows.map(({ slot, player }) => ({
      value: player.overall,
      weight: attackWeights[slot.position],
    }))
  );
  const defense = weightedAverage(
    rows.map(({ slot, player }) => ({
      value: player.overall,
      weight: defenseWeights[slot.position],
    }))
  );
  const overall = Math.round(rows.reduce((sum, row) => sum + row.player.overall, 0) / rows.length);

  return { attack, defense, overall };
}

export function ratingsFromRoster(roster: Roster): TeamRatings {
  const sorted = [...roster.players].sort((a, b) => b.overall - a.overall);
  const formation = formations['4-3-3'];
  const picked = new Set<string>();
  const picks: DraftPick[] = [];

  for (const slot of formation) {
    const player = sorted.find((candidate) => !picked.has(candidate.id) && canPlay(candidate, slot.position));
    if (!player) continue;
    picked.add(player.id);
    picks.push({
      slotId: slot.id,
      player,
      sourceRoster: {
        id: roster.id,
        teamCode: roster.teamCode,
        teamName: roster.teamName,
        year: roster.year,
        strength: roster.strength,
      },
    });
  }

  const ratings = ratingsFromPicks('4-3-3', picks);
  if (picks.length < 8) {
    return {
      attack: roster.strength,
      defense: roster.strength,
      overall: roster.strength,
    };
  }
  return ratings;
}

export function openSlots(formation: string, picks: DraftPick[]): Slot[] {
  const used = new Set(picks.map((pick) => pick.slotId));
  return formations[formation].filter((slot) => !used.has(slot.id));
}

export function eligibleSlots(formation: string, picks: DraftPick[], player: Player): Slot[] {
  return openSlots(formation, picks).filter((slot) => canPlay(player, slot.position));
}
