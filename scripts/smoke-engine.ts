import { readFileSync } from 'node:fs';
import { createDraft, isComplete, pickPlayer, rerollRoster, rollRoster } from '../src/engine/draft';
import { eligibleSlots } from '../src/engine/ratings';
import { simulateWorldCup } from '../src/engine/simulate';
import type { Dataset, DraftState, Player } from '../src/types';

const dataset = JSON.parse(readFileSync('public/data/worldcup-rosters.json', 'utf8')) as Dataset;

let draft: DraftState = createDraft('4-3-3');
const brazil2002 = dataset.rosters.find((roster) => roster.id === 'BRA-2002');
if (!brazil2002) throw new Error('Expected BRA-2002 in the dataset.');
let rerollDraft: DraftState = {
  ...createDraft('4-3-3'),
  rollIndex: 1,
  currentRoster: brazil2002,
  recentRosterIds: [brazil2002.id],
};
const firstRoster = rerollDraft.currentRoster;
const teamReroll = rerollRoster(rerollDraft, dataset.rosters, 'team');
if (
  !teamReroll.currentRoster ||
  teamReroll.currentRoster.year !== firstRoster.year ||
  teamReroll.currentRoster.teamCode === firstRoster.teamCode ||
  teamReroll.rerollsLeft !== 2
) {
  throw new Error('Team reroll did not keep the same year with a different national team.');
}
const yearReroll = rerollRoster(rerollDraft, dataset.rosters, 'year');
if (
  !yearReroll.currentRoster ||
  yearReroll.currentRoster.teamCode !== firstRoster.teamCode ||
  yearReroll.currentRoster.year === firstRoster.year ||
  yearReroll.rerollsLeft !== 2
) {
  throw new Error('Year reroll did not keep the same national team with a different year.');
}
let spent = rerollDraft;
for (let index = 0; index < 3; index++) {
  const next = rerollRoster(spent, dataset.rosters, 'team');
  if (next.rerollsLeft !== spent.rerollsLeft - 1) {
    throw new Error('Reroll did not consume exactly 1 charge.');
  }
  spent = next;
}
const blocked = rerollRoster(spent, dataset.rosters, 'team');
if (spent.rerollsLeft !== 0 || blocked.currentRoster?.id !== spent.currentRoster?.id || blocked.rerollsLeft !== 0) {
  throw new Error('Reroll limit did not stop changes after 3 consumed rerolls.');
}

let attempts = 0;
while (!isComplete(draft)) {
  attempts += 1;
  if (attempts > 200) throw new Error('Draft smoke test could not complete after 200 rolls.');

  draft = rollRoster(draft, dataset.rosters);
  if (!draft.currentRoster) throw new Error('Roll did not produce a roster.');

  const used = new Set(draft.picks.map((pick) => pick.player.playerId));
  const candidate = draft.currentRoster.players
    .filter((player) => !used.has(player.playerId))
    .map((player) => ({
      player,
      slots: eligibleSlots(draft.formation, draft.picks, player),
    }))
    .filter((row) => row.slots.length > 0)
    .sort((a, b) => b.player.overall - a.player.overall)[0] as
    | { player: Player; slots: ReturnType<typeof eligibleSlots> }
    | undefined;

  if (!candidate) {
    continue;
  }

  draft = pickPlayer(draft, candidate.player, candidate.slots[0].id);
  if (draft.rerollsLeft !== 3) {
    throw new Error('Normal roll after a pick should not consume rerolls.');
  }
}

const result = simulateWorldCup(draft.formation, draft.picks, dataset.rosters);

if (result.matches.length < 3) throw new Error('Simulation produced too few matches.');
if (!Number.isFinite(result.ratings.overall) || result.ratings.overall <= 0) {
  throw new Error('Invalid team ratings.');
}
if (result.groupTable.length !== 4 || result.groupPosition < 1 || result.groupPosition > 4) {
  throw new Error('Invalid group table.');
}
const goalEvents = result.matches.reduce(
  (sum, match) => sum + match.events.filter((event) => event.kind === 'goal').length,
  0
);
if (goalEvents !== result.gf + result.ga) {
  throw new Error('Live goal events do not match the simulated score totals.');
}
if (result.matches.some((match) => match.events.some((event) => event.minute < 1 || event.minute > 120))) {
  throw new Error('Live event minute is outside the supported match clock.');
}

let penaltyShootoutSeen = false;
for (let index = 0; index < 100 && !penaltyShootoutSeen; index++) {
  const run = index === 0 ? result : simulateWorldCup(draft.formation, draft.picks, dataset.rosters);
  for (const match of run.matches) {
    if (match.gf !== match.ga) {
      if (match.penalties) throw new Error('Non-drawn match unexpectedly produced penalties.');
      continue;
    }

    penaltyShootoutSeen = true;
    if (!match.penalties?.kicks.length) throw new Error('Drawn match did not produce penalty kicks.');

    const kickEvents = match.events.filter((event) => event.kind === 'penalties' && !event.penaltyFinal);
    if (kickEvents.length !== match.penalties.kicks.length) {
      throw new Error('Penalty kick events do not match the simulated shootout.');
    }
    if (kickEvents.some((event) => !event.player || typeof event.penaltyScored !== 'boolean' || !event.score)) {
      throw new Error('Penalty kick events must include taker, scored/missed state, and shootout score.');
    }
    if (!match.events.some((event) => event.kind === 'penalties' && event.penaltyFinal && event.score === match.penalties?.score)) {
      throw new Error('Penalty shootout final event is missing or has the wrong score.');
    }
  }
}

if (!penaltyShootoutSeen) {
  throw new Error('Smoke test did not encounter a penalty shootout.');
}

console.log(
  JSON.stringify(
    {
      picks: draft.picks.length,
      overall: result.ratings.overall,
      record: result.record,
      champion: result.champion,
      matches: result.matches.length,
      firstPick: draft.picks[0]?.player.displayName,
    },
    null,
    2
  )
);
