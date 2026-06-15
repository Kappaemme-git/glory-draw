import { poisson, randomRng, weightedPick, clamp } from './random';
import { ratingsFromPicks, ratingsFromRoster } from './ratings';
import type { DraftPick, GroupStanding, MatchEvent, MatchResult, Opponent, PenaltyKick, Player, Roster, SimulationResult, TeamRatings } from '../types';

const knockoutPath = [
  { phase: 'Round of 16', baseTarget: 70, spread: 9 },
  { phase: 'Quarter-final', baseTarget: 73, spread: 10 },
  { phase: 'Semi-final', baseTarget: 76, spread: 10 },
  { phase: 'Final', baseTarget: 80, spread: 10 },
];

function randomTarget(baseTarget: number, spread: number, ownOverall?: number): number {
  const rng = randomRng();
  const swing = Math.round((rng() - rng()) * spread);
  const rubberBand = ownOverall ? Math.round((ownOverall - baseTarget) * 0.1) : 0;
  return clamp(baseTarget + swing + rubberBand, 58, 94);
}

function pickOpponent(rosters: Roster[], target: number, used: Set<string>, yearBias?: number): Opponent {
  const rng = randomRng();
  const pool = rosters.filter((roster) => !used.has(roster.id));
  const available = pool.length > 0 ? pool : rosters;
  const rated = available.map((roster) => ({ roster, ratings: ratingsFromRoster(roster) }));
  // Opponents play their best XI, so select against that real match rating instead of raw roster strength.
  const near = rated.filter(({ ratings }) => Math.abs(ratings.overall - target) <= 7);
  const values = near.length >= 8 ? near : rated;
  const weights = values.map(({ roster, ratings }) => {
    const strengthDistance = Math.abs(ratings.overall - target);
    const yearDistance = yearBias ? Math.abs(roster.year - yearBias) / 20 : 0;
    const chaos = 0.88 + rng() * 0.34;
    return (1 / (1 + strengthDistance * 0.9 + yearDistance * 0.5)) * chaos;
  });
  const { roster, ratings } = weightedPick(rng, values, weights);
  used.add(roster.id);
  return {
    roster,
    attack: ratings.attack || roster.strength,
    defense: ratings.defense || roster.strength,
    overall: ratings.overall || roster.strength,
  };
}

function expectedGoals(attack: number, defense: number, overallDelta: number): number {
  return clamp(1.22 + (attack - defense) * 0.032 + overallDelta * 0.01, 0.34, 3.7);
}

function matchForm(rng: () => number, ownOverall: number, opponentOverall: number): number {
  const normalSwing = (rng() - rng()) * 6.5;
  const upsetSpark = ownOverall < opponentOverall && rng() < 0.2 ? rng() * 5 : 0;
  const favoriteNerves = ownOverall > opponentOverall && rng() < 0.12 ? -rng() * 3.5 : 0;
  return normalSwing + upsetSpark + favoriteNerves;
}

function playMatch(
  phase: string,
  ratings: TeamRatings,
  opponent: Opponent,
  lineup: Player[],
  knockout: boolean,
  youBench: string[]
): MatchResult {
  const rng = randomRng();
  const ourForm = matchForm(rng, ratings.overall, opponent.overall);
  const theirForm = matchForm(rng, opponent.overall, ratings.overall);
  const formDelta = ourForm - theirForm;
  let gf = poisson(
    rng,
    expectedGoals(ratings.attack + ourForm, opponent.defense + theirForm, ratings.overall - opponent.overall + formDelta)
  );
  let ga = poisson(
    rng,
    expectedGoals(opponent.attack + theirForm, ratings.defense + ourForm, opponent.overall - ratings.overall - formDelta)
  );
  let advanced = knockout ? gf > ga : true;
  let penalties: MatchResult['penalties'];

  if (gf === ga) {
    penalties = simulatePenaltyShootout(rng, ratings, opponent, lineup);
    if (knockout) advanced = penalties.won;
  }

  const outcome = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  const scorers = pickScorers(lineup, gf);
  const conceded = pickOpponentScorers(opponent.roster.players, ga);

  return {
    phase,
    opponent,
    gf,
    ga,
    outcome,
    advanced: knockout ? advanced : true,
    penalties,
    scorers,
    conceded,
    events: matchEvents(
      rng,
      scorers,
      conceded,
      penalties,
      lineup.map((player) => player.displayName),
      opponent.roster.players.map((player) => player.displayName),
      youBench
    ),
  };
}

function scorerWeight(player: Player): number {
  const primary = player.positions[0];
  const role =
    primary === 'ST'
      ? 1.2
      : primary === 'RW' || primary === 'LW'
        ? 1.05
        : primary === 'AM'
          ? 0.85
          : primary === 'CM' || primary === 'RM' || primary === 'LM'
            ? 0.48
            : primary === 'DM'
              ? 0.26
              : primary === 'CB' || primary === 'RB' || primary === 'LB'
                ? 0.12
                : 0.01;
  return Math.max(0.01, role * player.overall);
}

function pickScorers(players: Player[], goals: number): string[] {
  if (goals <= 0 || players.length === 0) return [];
  const rng = randomRng();
  const weights = players.map(scorerWeight);
  return Array.from({ length: goals }, () => weightedPick(rng, players, weights).displayName);
}

function pickOpponentScorers(players: Player[], goals: number): string[] {
  if (goals <= 0 || players.length === 0) return [];
  const rng = randomRng();
  const outfield = players.filter((player) => !player.positions.includes('GK'));
  const pool = outfield.length > 0 ? outfield : players;
  const weights = pool.map((player) => scorerWeight(player));
  return Array.from({ length: goals }, () => weightedPick(rng, pool, weights).displayName);
}

function penaltyTakerWeight(player: Player): number {
  const primary = player.positions[0];
  const role =
    primary === 'ST'
      ? 1.18
      : primary === 'RW' || primary === 'LW' || primary === 'AM'
        ? 1.05
        : primary === 'CM' || primary === 'RM' || primary === 'LM'
          ? 0.86
          : primary === 'DM'
            ? 0.7
            : primary === 'CB' || primary === 'RB' || primary === 'LB'
              ? 0.5
              : 0.18;
  return Math.max(0.01, role * player.overall);
}

function pickPenaltyTakers(rng: () => number, players: Player[], needed: number): Player[] {
  if (players.length === 0) return [];
  const outfield = players.filter((player) => !player.positions.includes('GK'));
  const pool = outfield.length > 0 ? outfield : players;
  let available = [...pool];
  const takers: Player[] = [];

  while (takers.length < needed) {
    if (available.length === 0) available = [...pool];
    const player = weightedPick(rng, available, available.map(penaltyTakerWeight));
    takers.push(player);
    available = available.filter((candidate) => candidate.id !== player.id);
  }

  return takers;
}

function penaltyChance(player: Player, teamOverall: number, opponentOverall: number, kickIndex: number): number {
  const rolePressure =
    player.positions[0] === 'ST' || player.positions[0] === 'RW' || player.positions[0] === 'LW' || player.positions[0] === 'AM'
      ? 0.015
      : player.positions.includes('GK')
        ? -0.08
        : 0;
  const pressure = kickIndex >= 8 ? -0.025 : kickIndex >= 4 ? -0.01 : 0;
  return clamp(0.74 + (player.overall - 75) * 0.004 + (teamOverall - opponentOverall) * 0.0025 + rolePressure + pressure, 0.56, 0.92);
}

function simulatePenaltyShootout(
  rng: () => number,
  ratings: TeamRatings,
  opponent: Opponent,
  lineup: Player[]
): NonNullable<MatchResult['penalties']> {
  const maxKicksPerTeam = 13;
  const takers = {
    you: pickPenaltyTakers(rng, lineup, maxKicksPerTeam),
    opponent: pickPenaltyTakers(rng, opponent.roster.players, maxKicksPerTeam),
  };
  const order: Array<'you' | 'opponent'> = rng() < 0.5 ? ['you', 'opponent'] : ['opponent', 'you'];
  const score = { you: 0, opponent: 0 };
  const taken = { you: 0, opponent: 0 };
  const kicks: PenaltyKick[] = [];

  const takeKick = (team: 'you' | 'opponent', forcedScored?: boolean) => {
    const opponentTeam = team === 'you' ? 'opponent' : 'you';
    const player = takers[team][taken[team] % takers[team].length];
    const teamOverall = team === 'you' ? ratings.overall : opponent.overall;
    const opponentOverall = team === 'you' ? opponent.overall : ratings.overall;
    const scored = forcedScored ?? rng() < penaltyChance(player, teamOverall, opponentOverall, kicks.length);

    taken[team] += 1;
    if (scored) score[team] += 1;

    kicks.push({
      order: kicks.length + 1,
      minute: 91 + kicks.length,
      team,
      player: player.displayName,
      scored,
      score: `${score.you}-${score.opponent}`,
      suddenDeath: taken.you > 5 || taken.opponent > 5,
    });

    return opponentTeam;
  };

  const isSettledInsideFive = () => {
    const youMax = score.you + Math.max(0, 5 - taken.you);
    const opponentMax = score.opponent + Math.max(0, 5 - taken.opponent);
    return score.you > opponentMax || score.opponent > youMax;
  };

  for (let turn = 0; turn < 10; turn++) {
    takeKick(order[turn % 2]);
    if (isSettledInsideFive()) break;
  }

  while (score.you === score.opponent && taken.you < maxKicksPerTeam && taken.opponent < maxKicksPerTeam) {
    takeKick(order[0]);
    takeKick(order[1]);
  }

  if (score.you === score.opponent) {
    const forcedWinner = rng() < clamp(0.5 + (ratings.overall - opponent.overall) * 0.012, 0.1, 0.9) ? 'you' : 'opponent';
    const forcedLoser = forcedWinner === 'you' ? 'opponent' : 'you';
    if (order[0] === forcedWinner) {
      takeKick(forcedWinner, true);
      takeKick(forcedLoser, false);
    } else {
      takeKick(forcedLoser, false);
      takeKick(forcedWinner, true);
    }
  }

  return {
    won: score.you > score.opponent,
    score: `${score.you}-${score.opponent}`,
    kicks,
  };
}

function goalMinute(rng: () => number): number {
  const roll = rng();
  if (roll < 0.07) return 1 + Math.floor(rng() * 14);
  if (roll > 0.88) return 76 + Math.floor(rng() * 15);
  return 15 + Math.floor(rng() * 61);
}

const CARD_REASONS = [
  'Late tackle',
  'Reckless challenge',
  'Holding',
  'Dissent',
  'Time-wasting',
  'Handball',
  'Rough play',
  'Tactical foul',
  'Shirt pull',
];

const KIND_RANK = { goal: 0, card: 1, sub: 2, penalties: 3 };

function makeSubs(
  rng: () => number,
  team: 'you' | 'opponent',
  onPitch: string[],
  bench: string[]
): MatchEvent[] {
  if (bench.length === 0 || onPitch.length === 0) return [];
  const count = 2 + Math.floor(rng() * 2); // 2–3 changes
  const subs: MatchEvent[] = [];
  const usedIn = new Set<string>();
  const usedOut = new Set<string>();

  for (let i = 0; i < count; i++) {
    const inPool = bench.filter((name) => !usedIn.has(name) && !onPitch.includes(name));
    const outPool = onPitch.filter((name) => !usedOut.has(name));
    if (inPool.length === 0 || outPool.length === 0) break;
    const playerIn = inPool[Math.floor(rng() * inPool.length)];
    const playerOut = outPool[Math.floor(rng() * outPool.length)];
    usedIn.add(playerIn);
    usedOut.add(playerOut);
    subs.push({
      id: `sub-${team}-${i}`,
      kind: 'sub',
      minute: 55 + Math.floor(rng() * 33),
      team,
      player: playerIn,
      playerOut,
      text: `Sub: ${playerIn} on for ${playerOut}`,
    });
  }
  return subs;
}

function matchEvents(
  rng: () => number,
  scorers: string[],
  conceded: string[],
  penalties: MatchResult['penalties'],
  youNames: string[],
  oppNames: string[],
  youBench: string[]
): MatchEvent[] {
  const events: MatchEvent[] = [];

  const addGoal = (team: 'you' | 'opponent', player: string, mates: string[], index: number) => {
    const others = mates.filter((name) => name !== player);
    const assist = others.length > 0 && rng() < 0.6 ? others[Math.floor(rng() * others.length)] : undefined;
    events.push({
      id: `goal-${team}-${index}`,
      kind: 'goal',
      minute: goalMinute(rng),
      team,
      player,
      assist,
      score: '',
      text: '',
    });
  };

  scorers.forEach((player, index) => addGoal('you', player, youNames, index));
  conceded.forEach((player, index) => addGoal('opponent', player, oppNames, index));

  // bookings
  const cardCount = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < cardCount; i++) {
    const team = rng() < 0.5 ? 'you' : 'opponent';
    const pool = team === 'you' ? youNames : oppNames;
    if (pool.length === 0) continue;
    const player = pool[Math.floor(rng() * pool.length)];
    const red = rng() < 0.06;
    events.push({
      id: `card-${team}-${i}`,
      kind: 'card',
      minute: 8 + Math.floor(rng() * 82),
      team,
      player,
      reason: CARD_REASONS[Math.floor(rng() * CARD_REASONS.length)],
      cardType: red ? 'red' : 'yellow',
      text: `${red ? 'Red' : 'Yellow'} card: ${player}`,
    });
  }

  // substitutions (you = same-nation reserves; opponent = back of the squad)
  events.push(...makeSubs(rng, 'you', youNames, youBench));
  events.push(...makeSubs(rng, 'opponent', oppNames.slice(0, 11), oppNames.slice(11)));

  events.sort((a, b) => a.minute - b.minute || KIND_RANK[a.kind] - KIND_RANK[b.kind]);

  // running scoreline on goal events
  let gf = 0;
  let ga = 0;
  for (const event of events) {
    if (event.kind !== 'goal') continue;
    if (event.team === 'you') gf += 1;
    else ga += 1;
    event.score = `${gf}-${ga}`;
    event.text = event.team === 'you' ? `Goal: ${event.player}` : `Conceded: ${event.player}`;
  }

  if (penalties) {
    penalties.kicks.forEach((kick) => {
      events.push({
        id: `penalty-${kick.order}`,
        kind: 'penalties',
        minute: kick.minute,
        team: kick.team,
        player: kick.player,
        penaltyScored: kick.scored,
        score: kick.score,
        text: `${kick.player} ${kick.scored ? 'scores' : 'misses'}`,
      });
    });

    const lastKick = penalties.kicks[penalties.kicks.length - 1];
    events.push({
      id: 'penalties-result',
      kind: 'penalties',
      minute: (lastKick?.minute ?? 91) + 1,
      team: penalties.won ? 'you' : 'opponent',
      score: penalties.score,
      penaltyFinal: true,
      text: penalties.won ? `Won on penalties ${penalties.score}` : `Lost on penalties ${penalties.score}`,
    });
  }

  return events;
}

function groupTable(ownMatches: MatchResult[], opponents: Opponent[]): GroupStanding[] {
  const rng = randomRng();
  const rows = [
    {
      id: 'YOU',
      label: 'You',
      pts: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      you: true,
    },
    ...opponents.map((opponent) => ({
      id: opponent.roster.id,
      label: `${opponent.roster.teamName} ${opponent.roster.year}`,
      pts: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      you: false,
    })),
  ];

  for (let index = 0; index < ownMatches.length; index++) {
    const match = ownMatches[index];
    const you = rows[0];
    const them = rows[index + 1];
    you.gf += match.gf;
    you.ga += match.ga;
    them.gf += match.ga;
    them.ga += match.gf;
    if (match.gf > match.ga) you.pts += 3;
    else if (match.gf < match.ga) them.pts += 3;
    else {
      you.pts += 1;
      them.pts += 1;
    }
  }

  for (let i = 0; i < opponents.length; i++) {
    for (let j = i + 1; j < opponents.length; j++) {
      const left = opponents[i];
      const right = opponents[j];
      const gf = poisson(rng, expectedGoals(left.attack, right.defense, left.overall - right.overall));
      const ga = poisson(rng, expectedGoals(right.attack, left.defense, right.overall - left.overall));
      const leftRow = rows[i + 1];
      const rightRow = rows[j + 1];
      leftRow.gf += gf;
      leftRow.ga += ga;
      rightRow.gf += ga;
      rightRow.ga += gf;
      if (gf > ga) leftRow.pts += 3;
      else if (gf < ga) rightRow.pts += 3;
      else {
        leftRow.pts += 1;
        rightRow.pts += 1;
      }
    }
  }

  for (const row of rows) row.gd = row.gf - row.ga;
  return rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (rng() > 0.5 ? 1 : -1));
}

export function simulateWorldCup(formation: string, picks: DraftPick[], rosters: Roster[]): SimulationResult {
  const ratings = ratingsFromPicks(formation, picks);
  const lineup = picks.map((pick) => pick.player);
  const used = new Set(picks.map((pick) => pick.sourceRoster.id));
  const avgYear = Math.round(picks.reduce((sum, pick) => sum + pick.sourceRoster.year, 0) / Math.max(1, picks.length));

  // your bench: same-nation reserves from each pick's source squad
  const lineupIds = new Set(picks.map((pick) => pick.player.playerId));
  const benchByName = new Map<string, string>();
  for (const pick of picks) {
    const sourceRoster = rosters.find((roster) => roster.id === pick.sourceRoster.id);
    if (!sourceRoster) continue;
    for (const player of sourceRoster.players) {
      if (!lineupIds.has(player.playerId)) benchByName.set(player.playerId, player.displayName);
    }
  }
  const youBench = [...benchByName.values()];

  // group opponents scale to the player's level so the group is a beatable gate
  // (opponents field their best XI, ~+4 over team strength, so target strength accordingly)
  const dynamicGroupTargets = [ratings.overall - 20, ratings.overall - 15, ratings.overall - 10].map((target) =>
    clamp(Math.round(target), 50, 74)
  );
  const groupOpponents = dynamicGroupTargets.map((target) => pickOpponent(rosters, target, used, avgYear));
  const matches: MatchResult[] = groupOpponents.map((opponent, index) =>
    playMatch(`Group ${index + 1}`, ratings, opponent, lineup, false, youBench)
  );

  const table = groupTable(matches, groupOpponents);
  const groupPosition = table.findIndex((row) => row.you) + 1;
  if (groupPosition > 2) {
    return summarize(matches, ratings, 'Group stage', table, groupPosition);
  }

  for (const phase of knockoutPath) {
    const target = randomTarget(phase.baseTarget, phase.spread, ratings.overall);
    const opponent = pickOpponent(rosters, target, used, avgYear);
    const match = playMatch(phase.phase, ratings, opponent, lineup, true, youBench);
    matches.push(match);
    if (!match.advanced) return summarize(matches, ratings, phase.phase, table, groupPosition);
  }

  return summarize(matches, ratings, null, table, groupPosition);
}

function summarize(
  matches: MatchResult[],
  ratings: TeamRatings,
  eliminatedPhase: string | null,
  groupTable: GroupStanding[],
  groupPosition: number
): SimulationResult {
  const wins = matches.filter((match) => match.gf > match.ga || match.penalties?.won).length;
  const draws = matches.filter((match) => match.gf === match.ga && !match.penalties).length;
  const losses = matches.filter((match) => match.gf < match.ga || match.penalties?.won === false).length;
  const gf = matches.reduce((sum, match) => sum + match.gf, 0);
  const ga = matches.reduce((sum, match) => sum + match.ga, 0);

  return {
    champion: eliminatedPhase === null,
    eliminatedPhase,
    groupPosition,
    groupTable,
    record: `${wins}-${draws}-${losses}`,
    wins,
    draws,
    losses,
    gf,
    ga,
    ratings,
    matches,
  };
}
