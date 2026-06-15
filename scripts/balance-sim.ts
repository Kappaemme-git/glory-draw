import { readFileSync } from 'node:fs';
import { createDraft, isComplete, pickPlayer, rollRoster } from '../src/engine/draft';
import { eligibleSlots, ratingsFromPicks } from '../src/engine/ratings';
import { simulateWorldCup } from '../src/engine/simulate';
import type { Dataset, DraftState, Player } from '../src/types';

const dataset = JSON.parse(readFileSync('public/data/worldcup-rosters.json', 'utf8')) as Dataset;

type PickProfile = 'best' | 'balanced' | 'underdog';

function makeDraft(profile: PickProfile = 'best'): DraftState {
  let draft = createDraft('4-3-3');
  let attempts = 0;

  while (!isComplete(draft)) {
    attempts += 1;
    if (attempts > 300) throw new Error('Could not complete a balance-test draft after 300 rolls.');

    draft = rollRoster(draft, dataset.rosters);
    if (!draft.currentRoster) throw new Error('Roll did not produce a roster.');

    const used = new Set(draft.picks.map((pick) => pick.player.playerId));
    const candidates = draft.currentRoster.players
      .filter((player) => !used.has(player.playerId))
      .map((player) => ({
        player,
        slots: eligibleSlots(draft.formation, draft.picks, player),
      }))
      .filter((row) => row.slots.length > 0)
      .sort((a, b) => b.player.overall - a.player.overall) as { player: Player; slots: ReturnType<typeof eligibleSlots> }[];

    if (candidates.length === 0) continue;
    const candidate =
      profile === 'underdog'
        ? candidates[Math.max(0, candidates.length - 2)]
        : profile === 'balanced'
          ? candidates[Math.floor(candidates.length * 0.35)]
          : candidates[0];

    draft = pickPlayer(draft, candidate.player, candidate.slots[0].id);
  }

  return draft;
}

function count(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

function runProfile(profile: PickProfile, runs: number) {
  const draft = makeDraft(profile);
  const overall = ratingsFromPicks(draft.formation, draft.picks).overall;
  const phases: string[] = [];
  const knockoutWins: number[] = [];

  for (let index = 0; index < runs; index++) {
    const result = simulateWorldCup(draft.formation, draft.picks, dataset.rosters);
    phases.push(result.champion ? 'Champion' : result.eliminatedPhase ?? 'Champion');
    knockoutWins.push(
      result.matches
        .slice(3)
        .filter((match) => (match.penalties ? match.penalties.won : match.gf > match.ga)).length
    );
  }

  return {
    runs,
    overall,
    phases: count(phases),
    averageKnockoutWins: average(knockoutWins),
  };
}

const randomPhases: string[] = [];
const randomOveralls: number[] = [];

for (let index = 0; index < 200; index++) {
  const draft = makeDraft('best');
  randomOveralls.push(ratingsFromPicks(draft.formation, draft.picks).overall);
  const result = simulateWorldCup(draft.formation, draft.picks, dataset.rosters);
  if (result.groupTable.length !== 4 || result.groupPosition < 1 || result.groupPosition > 4) {
    throw new Error('Invalid group table from simulation.');
  }
  randomPhases.push(result.champion ? 'Champion' : result.eliminatedPhase ?? 'Champion');
}

const fixedDraft = makeDraft('best');
const fixedOverall = ratingsFromPicks(fixedDraft.formation, fixedDraft.picks).overall;
const fixedPhases: string[] = [];

for (let index = 0; index < 300; index++) {
  const result = simulateWorldCup(fixedDraft.formation, fixedDraft.picks, dataset.rosters);
  fixedPhases.push(result.champion ? 'Champion' : result.eliminatedPhase ?? 'Champion');
}

console.log(
  JSON.stringify(
    {
      randomDrafts: {
        runs: randomPhases.length,
        averageOverall: average(randomOveralls),
        phases: count(randomPhases),
      },
      fixedDraft: {
        runs: fixedPhases.length,
        overall: fixedOverall,
        phases: count(fixedPhases),
      },
      profiles: {
        underdog: runProfile('underdog', 300),
        balanced: runProfile('balanced', 300),
        best: runProfile('best', 300),
      },
    },
    null,
    2
  )
);
