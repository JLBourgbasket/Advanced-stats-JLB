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
  orb: number;
  drb: number;
  fgast: number;
  astRatio: number;
  tov: number;
  ortg: number;
  drtg: number;
  net: number;
  oppEfg: number;
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
  trbPct: number;
  ortgEstimate: number | null;
  drtgEstimate: number;
};

