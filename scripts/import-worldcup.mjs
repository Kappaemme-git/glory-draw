import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT =
  'https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv';

const OUT_FILE = path.resolve('public/data/worldcup-rosters.json');
const OVERRIDES_FILE = path.resolve('data/player-overrides.json');
const MIN_WORLD_CUP_YEAR = 1950;

const TOP_PLAYER_OVERRIDES = new Map(
  [
    ['pelé', 97],
    ['diego maradona', 97],
    ['lionel messi', 96],
    ['ronaldo', 96],
    ['zinedine zidane', 95],
    ['johan cruyff', 95],
    ['franz beckenbauer', 95],
    ['garrincha', 95],
    ['cristiano ronaldo', 95],
    ['ronaldinho', 94],
    ['romário', 94],
    ['rivaldo', 93],
    ['kylian mbappé', 93],
    ['lothar matthäus', 93],
    ['paolo maldini', 93],
    ['andrés iniesta', 93],
    ['xavi', 93],
    ['andrea pirlo', 92],
    ['gianluigi buffon', 92],
    ['iker casillas', 92],
    ['fabio cannavaro', 92],
    ['roberto baggio', 92],
    ['thierry henry', 92],
    ['michel platini', 92],
    ['gerd müller', 92],
    ['eusébio', 92],
    ['luka modrić', 91],
    ['neymar', 91],
    ['roberto carlos', 91],
    ['cafu', 91],
    ['carles puyol', 91],
    ['sergio ramos', 91],
    ['manuel neuer', 91],
  ].map(([name, rating]) => [String(name), Number(rating)])
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift();
  if (!headers) return [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  );
}

async function getCsv(name) {
  const res = await fetch(`${ROOT}/${name}`);
  if (!res.ok) throw new Error(`Cannot fetch ${name}: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

function yearFromTournamentId(id) {
  const match = id.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hashNumber(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cleanNamePart(value) {
  const cleaned = String(value ?? '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'not applicable') return '';
  return cleaned;
}

function fullName(row) {
  return [cleanNamePart(row.given_name), cleanNamePart(row.family_name)].filter(Boolean).join(' ').trim();
}

function shortName(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0][0]}. ${parts.at(-1)}`;
}

function performanceBonus(performance) {
  const normalized = performance.toLowerCase();
  if (normalized.includes('winner')) return 19;
  if (normalized.includes('final')) return 16;
  if (normalized.includes('third') || normalized.includes('semi')) return 13;
  if (normalized.includes('quarter')) return 10;
  if (normalized.includes('round of 16')) return 7;
  if (normalized.includes('second')) return 6;
  if (normalized.includes('group')) return 3;
  return 4;
}

function mapBasePositions(positionCode, shirtNumber) {
  if (positionCode === 'GK') return ['GK'];

  if (positionCode === 'DF') {
    if (shirtNumber === 2) return ['RB', 'CB'];
    if (shirtNumber === 3) return ['LB', 'CB'];
    if (shirtNumber === 6) return ['LB', 'CB', 'DM'];
    return ['CB', 'RB', 'LB'];
  }

  if (positionCode === 'MF') {
    if (shirtNumber === 7) return ['RM', 'RW', 'CM'];
    if (shirtNumber === 10) return ['AM', 'CM', 'ST'];
    if (shirtNumber === 11) return ['LM', 'LW', 'CM'];
    if (shirtNumber === 6) return ['DM', 'CM'];
    return ['CM', 'DM', 'AM', 'RM', 'LM'];
  }

  if (positionCode === 'FW') {
    if (shirtNumber === 7) return ['RW', 'ST'];
    if (shirtNumber === 11) return ['LW', 'ST'];
    if (shirtNumber === 10) return ['AM', 'ST', 'LW'];
    return ['ST', 'RW', 'LW'];
  }

  return ['CM'];
}

function numberBoost(number, positionCode) {
  if (positionCode === 'GK' && number === 1) return 4;
  if (number === 10) return 6;
  if (number === 9) return 5;
  if (number === 7 || number === 11) return 4;
  if (number >= 18) return -3;
  if (number === 0) return -1;
  return 0;
}

function buildTeamStats(teamAppearances) {
  const stats = new Map();
  for (const row of teamAppearances) {
    if (!row.tournament_name.includes("FIFA Men's World Cup")) continue;
    const key = `${row.tournament_id}:${row.team_code}`;
    const entry =
      stats.get(key) ??
      {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
      };

    entry.played += 1;
    entry.wins += Number(row.win || 0);
    entry.draws += Number(row.draw || 0);
    entry.losses += Number(row.lose || 0);
    entry.gf += Number(row.goals_for || 0);
    entry.ga += Number(row.goals_against || 0);
    stats.set(key, entry);
  }
  return stats;
}

// Small prestige bump for traditional powerhouses so they feel a bit
// stronger and the draft/sim stays dynamic. Kept modest on purpose.
const POWERHOUSE_BOOST = {
  BRA: 4, // Brazil
  ARG: 4, // Argentina
  DEU: 4, // Germany / West Germany
  ITA: 3, // Italy
  FRA: 3, // France
  ESP: 3, // Spain
  ENG: 2, // England
  NLD: 2, // Netherlands
  URY: 2, // Uruguay
  PRT: 2, // Portugal
};

function teamStrength(performance, stats, teamCode) {
  const played = stats?.played || 0;
  const winRate = played > 0 ? stats.wins / played : 0.25;
  const gdPerMatch = played > 0 ? (stats.gf - stats.ga) / played : 0;
  const prestige = POWERHOUSE_BOOST[teamCode] ?? 0;
  return clamp(
    Math.round(61 + performanceBonus(performance) + winRate * 8 + gdPerMatch * 1.8 + prestige),
    56,
    94
  );
}

async function loadOverrides() {
  try {
    const raw = await readFile(OVERRIDES_FILE, 'utf8');
    const json = JSON.parse(raw);
    const players = Array.isArray(json.players) ? json.players : [];
    return {
      count: players.length,
      byPlayerId: new Map(players.filter((player) => player.playerId).map((player) => [player.playerId, player])),
      byName: new Map(players.filter((player) => player.name).map((player) => [normalizeName(player.name), player])),
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { count: 0, byPlayerId: new Map(), byName: new Map() };
    }
    throw error;
  }
}

function getOverride(row, name, overrides) {
  return overrides.byPlayerId.get(row.player_id) ?? overrides.byName.get(normalizeName(name)) ?? null;
}

const AWARD_BOOST = {
  'A-1': 10, // Golden Ball
  'A-2': 7, // Silver Ball
  'A-3': 5, // Bronze Ball
  'A-4': 7, // Golden Boot
  'A-5': 4, // Silver Boot
  'A-6': 3, // Bronze Boot
  'A-7': 7, // Golden Glove
  'A-8': 5, // Best Young Player
};

// Aggregate per-tournament, per-player signals from the official database:
// appearances (starter/sub), goals, individual awards, World Cup longevity.
function buildPlayerStats(playerApps, goalsCsv, awardWinners, playersCsv) {
  const isMen = (row) => row.tournament_name?.includes("FIFA Men's World Cup");

  const apps = new Map();
  const appearanceTournaments = new Set();
  for (const row of playerApps) {
    if (!isMen(row)) continue;
    appearanceTournaments.add(row.tournament_id);
    const key = `${row.tournament_id}:${row.player_id}`;
    const entry = apps.get(key) ?? { started: 0, subbed: 0 };
    entry.started += Number(row.starter || 0);
    entry.subbed += Number(row.substitute || 0);
    apps.set(key, entry);
  }

  const goals = new Map();
  for (const row of goalsCsv) {
    if (!isMen(row)) continue;
    if (Number(row.own_goal || 0) === 1) continue;
    const key = `${row.tournament_id}:${row.player_id}`;
    const weight = Number(row.penalty || 0) === 1 ? 0.6 : 1;
    goals.set(key, (goals.get(key) ?? 0) + weight);
  }

  const awardBoost = new Map();
  for (const row of awardWinners) {
    if (!isMen(row)) continue;
    const boost = AWARD_BOOST[row.award_id];
    if (!boost) continue;
    const key = `${row.tournament_id}:${row.player_id}`;
    const prev = awardBoost.get(key) ?? 0;
    awardBoost.set(key, prev === 0 ? boost : Math.max(prev, boost) + 2);
  }

  const countTournaments = new Map();
  for (const row of playersCsv) {
    const count = Number(row.count_tournaments || 0);
    if (count > 0) countTournaments.set(row.player_id, count);
  }

  return { apps, appearanceTournaments, goals, awardBoost, countTournaments };
}

function playerOverall(row, rosterStrength, override, year, playerStats, teamMatches) {
  if (override?.overallByYear?.[year]) return override.overallByYear[year];
  if (override?.overall) return override.overall;

  const name = fullName(row);
  const fallbackOverride = TOP_PLAYER_OVERRIDES.get(normalizeName(name));
  if (fallbackOverride) return fallbackOverride;

  const tid = row.tournament_id;
  const pkey = `${tid}:${row.player_id}`;
  let value = rosterStrength;

  // 1) role in the squad — biggest precision gain (1970+ has appearance data)
  if (playerStats.appearanceTournaments.has(tid)) {
    const app = playerStats.apps.get(pkey);
    const started = app?.started ?? 0;
    const subbed = app?.subbed ?? 0;
    const played = started + subbed;
    if (played === 0) {
      value -= 11; // listed in the squad but never on the pitch
    } else {
      const startShare = Math.min(1, started / Math.max(1, teamMatches));
      // centred on the squad level: a regular starter sits ~+3, a pure sub ~-2.
      value += Math.round(startShare * 5) - 2;
      if (subbed > 0 && startShare < 0.5) value += 1; // useful super-sub
    }
  } else {
    // pre-1970: no appearance data, lean on the shirt-number heuristic
    value += numberBoost(Number(row.shirt_number || 0), row.position_code);
  }

  // 2) goals scored in the tournament
  const goals = playerStats.goals.get(pkey) ?? 0;
  if (goals > 0) value += clamp(Math.round(goals * 2.2), 0, 9);

  // 3) individual awards (Golden Ball/Boot/Glove, etc.)
  value += playerStats.awardBoost.get(pkey) ?? 0;

  // 4) World Cup longevity
  const ct = playerStats.countTournaments.get(row.player_id) ?? 1;
  if (ct >= 5) value += 4;
  else if (ct === 4) value += 3;
  else if (ct === 3) value += 2;
  else if (ct === 2) value += 1;

  // tiny deterministic jitter so equal players are not perfectly tied
  value += (hashNumber(pkey) % 3) - 1;

  return clamp(Math.round(value), 47, 95);
}

function buildRosterGroups(squads, qualifiedTeams, teamAppearances, overrides, playerStats) {
  const performance = new Map();
  for (const row of qualifiedTeams) {
    if (!row.tournament_name.includes("FIFA Men's World Cup")) continue;
    performance.set(`${row.tournament_id}:${row.team_code}`, row.performance || 'group stage');
  }

  const stats = buildTeamStats(teamAppearances);
  const groups = new Map();

  for (const row of squads) {
    if (!row.tournament_name.includes("FIFA Men's World Cup")) continue;

    const year = yearFromTournamentId(row.tournament_id);
    if (!year) continue;
    if (year < MIN_WORLD_CUP_YEAR) continue;

    const key = `${row.tournament_id}:${row.team_code}`;
    const perf = performance.get(key) ?? 'group stage';
    const teamStats = stats.get(key) ?? null;
    const strength = teamStrength(perf, teamStats, row.team_code);
    const rosterId = `${row.team_code}-${year}`;

    if (!groups.has(key)) {
      groups.set(key, {
        id: rosterId,
        tournamentId: row.tournament_id,
        tournamentName: row.tournament_name,
        year,
        teamId: row.team_id,
        teamCode: row.team_code,
        teamName: row.team_name,
        performance: perf,
        strength,
        stats: teamStats ?? {
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0,
        },
        players: [],
      });
    }

    const shirtNumber = Number(row.shirt_number || 0);
    const name = fullName(row);
    const override = getOverride(row, name, overrides);
    const positions = override?.positions ?? mapBasePositions(row.position_code, shirtNumber);
    const overall = playerOverall(row, strength, override, year, playerStats, teamStats?.played ?? 0);
    const player = {
      id: `${row.tournament_id}:${row.team_code}:${row.player_id}`,
      playerId: row.player_id,
      slug: slugify(name || row.player_id),
      name,
      displayName: override?.displayName ?? shortName(name),
      teamCode: row.team_code,
      teamName: row.team_name,
      year,
      shirtNumber,
      sourcePosition: row.position_name,
      positions,
      overall,
      legend: override?.legend ?? TOP_PLAYER_OVERRIDES.has(normalizeName(name)),
    };

    groups.get(key).players.push(player);
  }

  return [...groups.values()]
    .map((roster) => ({
      ...roster,
      players: roster.players.sort((a, b) => {
        if (a.positions[0] === 'GK' && b.positions[0] !== 'GK') return -1;
        if (a.positions[0] !== 'GK' && b.positions[0] === 'GK') return 1;
        return a.shirtNumber - b.shirtNumber || b.overall - a.overall;
      }),
    }))
    .filter((roster) => roster.players.length >= 11)
    .sort((a, b) => a.year - b.year || a.teamName.localeCompare(b.teamName));
}

async function main() {
  const overrides = await loadOverrides();
  const [squads, qualifiedTeams, teamAppearances, playerApps, goalsCsv, awardWinners, playersCsv] =
    await Promise.all([
      getCsv('squads.csv'),
      getCsv('qualified_teams.csv'),
      getCsv('team_appearances.csv'),
      getCsv('player_appearances.csv'),
      getCsv('goals.csv'),
      getCsv('award_winners.csv'),
      getCsv('players.csv'),
    ]);

  const playerStats = buildPlayerStats(playerApps, goalsCsv, awardWinners, playersCsv);
  const rosters = buildRosterGroups(squads, qualifiedTeams, teamAppearances, overrides, playerStats);
  const players = rosters.reduce((sum, roster) => sum + roster.players.length, 0);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      name: 'The Fjelstul World Cup Database',
      url: 'https://github.com/jfjelstul/worldcup',
      license: 'CC-BY-SA 4.0',
      note: `Imported from public CSV files from ${MIN_WORLD_CUP_YEAR} onward. Overalls are derived from official tournament data (appearances/starts, goals, individual awards, World Cup longevity) blended with team strength, plus manual overrides in data/player-overrides.json.`,
    },
    overrides: {
      players: overrides.count,
    },
    counts: {
      rosters: rosters.length,
      players,
      teams: new Set(rosters.map((roster) => roster.teamCode)).size,
      years: [...new Set(rosters.map((roster) => roster.year))],
    },
    rosters,
  };

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload)}\n`);
  console.log(
    `Generated ${payload.counts.rosters} rosters, ${payload.counts.players} players, ${payload.counts.teams} teams.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
