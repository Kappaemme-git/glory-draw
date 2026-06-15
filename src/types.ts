export type Position =
  | 'GK'
  | 'RB'
  | 'LB'
  | 'CB'
  | 'DM'
  | 'CM'
  | 'AM'
  | 'RM'
  | 'LM'
  | 'RW'
  | 'LW'
  | 'ST';

export type Player = {
  id: string;
  playerId: string;
  slug: string;
  name: string;
  displayName: string;
  teamCode: string;
  teamName: string;
  year: number;
  shirtNumber: number;
  sourcePosition: string;
  positions: Position[];
  overall: number;
  legend: boolean;
};

export type Roster = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  year: number;
  teamId: string;
  teamCode: string;
  teamName: string;
  performance: string;
  strength: number;
  stats: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    gf: number;
    ga: number;
  };
  players: Player[];
};

export type Dataset = {
  generatedAt: string;
  source: {
    name: string;
    url: string;
    license: string;
    note: string;
  };
  counts: {
    rosters: number;
    players: number;
    teams: number;
    years: number[];
  };
  rosters: Roster[];
};

export type Slot = {
  id: string;
  label: string;
  position: Position;
  x: number;
  y: number;
};

export type DraftPick = {
  slotId: string;
  player: Player;
  sourceRoster: Pick<Roster, 'id' | 'teamCode' | 'teamName' | 'year' | 'strength'>;
};

export type DraftState = {
  formation: string;
  rollIndex: number;
  rerollsLeft: number;
  currentRoster: Roster | null;
  recentRosterIds: string[];
  picks: DraftPick[];
};

export type TeamRatings = {
  attack: number;
  defense: number;
  overall: number;
};

export type Opponent = {
  roster: Roster;
  attack: number;
  defense: number;
  overall: number;
};

export type MatchResult = {
  phase: string;
  opponent: Opponent;
  gf: number;
  ga: number;
  outcome: 'W' | 'D' | 'L';
  advanced: boolean;
  penalties?: {
    won: boolean;
    score: string;
    kicks: PenaltyKick[];
  };
  scorers: string[];
  conceded: string[];
  events: MatchEvent[];
};

export type PenaltyKick = {
  order: number;
  minute: number;
  team: 'you' | 'opponent';
  player: string;
  scored: boolean;
  score: string;
  suddenDeath: boolean;
};

export type MatchEvent = {
  id: string;
  kind: 'goal' | 'card' | 'sub' | 'penalties';
  minute: number;
  team: 'you' | 'opponent';
  player?: string; // scorer · carded player · player coming ON
  assist?: string; // goal assist
  playerOut?: string; // substitution: player going OFF
  reason?: string; // card reason
  cardType?: 'yellow' | 'red';
  penaltyScored?: boolean;
  penaltyFinal?: boolean;
  score?: string;
  text: string;
};

export type GroupStanding = {
  id: string;
  label: string;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  you: boolean;
};

export type SimulationResult = {
  champion: boolean;
  eliminatedPhase: string | null;
  groupPosition: number;
  groupTable: GroupStanding[];
  record: string;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  ratings: TeamRatings;
  matches: MatchResult[];
};
