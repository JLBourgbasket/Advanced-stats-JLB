export type Direction = "min" | "max" | "range";

export type RawTeamBoxscore = {
  name: string;
  points: number;
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  pf: number;
};

export type RawPlayerBoxscore = {
  id: string;
  name: string;
  role: string;
  minutes: string;
  points: number;
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  pf: number;
  plusMinus: number;
};

export type MatchBoxscore = {
  id: string;
  date: string;
  competition: string;
  venue: string;
  team: RawTeamBoxscore;
  opponent: RawTeamBoxscore;
  players: RawPlayerBoxscore[];
  quarters: { label: string; team: number; opponent: number }[];
};

export type MetricTarget = {
  key: string;
  label: string;
  direction: Direction;
  target: number | [number, number];
  unit: "%" | "rating";
  min: number;
  max: number;
};

export type PlayerReference = {
  role: string;
  season: string;
  targets: Partial<
    Record<"ts" | "efg" | "usg" | "ast" | "tov" | "orb" | "trb", MetricTarget>
  >;
};

export type TeamMetrics = {
  possessions: number;
  ts: number;
  efg: number;
  twoPct: number;
  threePct: number;
  ftPct: number;
  threePar: number;
  ftr: number;
  orb: number;
  drb: number;
  fgast: number;
  astRatio: number;
  astTov: number;
  tov: number;
  stlRate: number;
  blkRate: number;
  ortg: number;
  drtg: number;
  net: number;
  oppTs: number;
  oppEfg: number;
  oppFtr: number;
  oppOrb: number;
  oppTov: number;
};

export type PlayerMetrics = RawPlayerBoxscore & {
  minutesDecimal: number;
  ts: number | null;
  efg: number | null;
  usg: number;
  astPct: number;
  tovPct: number | null;
  orbPct: number;
  drbPct: number;
  trbPct: number;
  threePar: number;
  ftr: number;
  pts40: number;
  reb40: number;
  ast40: number;
  stl40: number;
  blk40: number;
  ortgEstimate: number | null;
  drtgEstimate: number;
};
