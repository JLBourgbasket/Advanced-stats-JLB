import type { MatchBoxscore, MetricTarget, PlayerReference } from "./types";

export const genevaMatch: MatchBoxscore = {
  id: "jl-geneve-2026-08-29",
  date: "2026-08-29",
  competition: "Pré-saison · Court 1",
  venue: "Bourg-en-Bresse",
  team: {
    name: "JL Bourg-en-Bresse",
    points: 79,
    fgm: 22,
    fga: 50,
    threePm: 4,
    threePa: 18,
    ftm: 31,
    fta: 41,
    orb: 11,
    drb: 20,
    ast: 15,
    tov: 19,
    stl: 17,
    blk: 1,
    pf: 21,
  },
  opponent: {
    name: "Lions de Genève",
    points: 68,
    fgm: 22,
    fga: 53,
    threePm: 6,
    threePa: 20,
    ftm: 18,
    fta: 24,
    orb: 10,
    drb: 23,
    ast: 14,
    tov: 26,
    stl: 14,
    blk: 2,
    pf: 30,
  },
  quarters: [
    { label: "Q1", team: 17, opponent: 14 },
    { label: "Q2", team: 25, opponent: 18 },
    { label: "Q3", team: 22, opponent: 19 },
    { label: "Q4", team: 15, opponent: 17 },
  ],
  players: [
    { id: "jordan", name: "Keith Jordan", role: "SF/SG · two-way wing", minutes: "20:12", points: 6, fgm: 0, fga: 2, threePm: 0, threePa: 2, ftm: 6, fta: 9, orb: 1, drb: 1, ast: 0, tov: 2, stl: 0, blk: 0, pf: 3, plusMinus: 7 },
    { id: "selebangue", name: "Morgan Selebangue", role: "Guard", minutes: "13:23", points: 2, fgm: 1, fga: 1, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 2, ast: 2, tov: 1, stl: 1, blk: 0, pf: 2, plusMinus: 7 },
    { id: "nelson", name: "Adrian Nelson", role: "PF · finisher / rebounder", minutes: "18:20", points: 8, fgm: 2, fga: 9, threePm: 1, threePa: 4, ftm: 3, fta: 5, orb: 2, drb: 1, ast: 1, tov: 0, stl: 2, blk: 0, pf: 3, plusMinus: 2 },
    { id: "samuel", name: "Tyrese Samuel", role: "PF/C · switchable big", minutes: "18:05", points: 6, fgm: 3, fga: 5, threePm: 0, threePa: 1, ftm: 0, fta: 0, orb: 1, drb: 4, ast: 0, tov: 1, stl: 0, blk: 0, pf: 0, plusMinus: 1 },
    { id: "taponat", name: "Julien Taponat", role: "Guard", minutes: "1:27", points: 2, fgm: 1, fga: 1, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0, plusMinus: 0 },
    { id: "monnet", name: "Leni Monnet", role: "Guard", minutes: "4:47", points: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 1, stl: 0, blk: 0, pf: 1, plusMinus: -6 },
    { id: "walker", name: "Tyson Walker", role: "PG · primary creator", minutes: "23:17", points: 8, fgm: 4, fga: 9, threePm: 0, threePa: 2, ftm: 0, fta: 0, orb: 1, drb: 2, ast: 1, tov: 2, stl: 5, blk: 0, pf: 1, plusMinus: 6 },
    { id: "gaudoux", name: "Lionel Gaudoux", role: "C/PF · hub big", minutes: "21:08", points: 9, fgm: 3, fga: 4, threePm: 0, threePa: 0, ftm: 3, fta: 5, orb: 1, drb: 2, ast: 1, tov: 2, stl: 1, blk: 0, pf: 0, plusMinus: 10 },
    { id: "soliman", name: "Nathan Soliman", role: "SF/PF · mismatch", minutes: "23:29", points: 15, fgm: 2, fga: 6, threePm: 1, threePa: 4, ftm: 10, fta: 10, orb: 0, drb: 0, ast: 3, tov: 2, stl: 3, blk: 0, pf: 2, plusMinus: 13 },
    { id: "shedrick", name: "Kadin Shedrick", role: "C · rim runner / protector", minutes: "18:23", points: 9, fgm: 2, fga: 5, threePm: 0, threePa: 0, ftm: 5, fta: 7, orb: 3, drb: 4, ast: 3, tov: 1, stl: 0, blk: 1, pf: 2, plusMinus: 6 },
    { id: "woodbury", name: "Trey Woodbury", role: "SG/PG · secondary creator", minutes: "19:47", points: 3, fgm: 1, fga: 3, threePm: 1, threePa: 3, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 1, tov: 2, stl: 3, blk: 0, pf: 2, plusMinus: 5 },
    { id: "robineau", name: "Hugo Robineau", role: "SG/PG · creator", minutes: "17:50", points: 11, fgm: 3, fga: 5, threePm: 1, threePa: 2, ftm: 4, fta: 5, orb: 0, drb: 3, ast: 3, tov: 5, stl: 2, blk: 0, pf: 5, plusMinus: 4 },
  ],
};

const pct = (
  key: string,
  label: string,
  direction: "min" | "max" | "range",
  target: number | [number, number],
): MetricTarget => ({ key, label, direction, target, unit: "%", min: 0, max: 100 });

export const teamTargets: MetricTarget[] = [
  { ...pct("ts", "TS%", "min", 59), min: 40, max: 70 },
  { ...pct("efg", "eFG%", "min", 54.5), min: 35, max: 65 },
  { ...pct("orb", "ORB%", "min", 33), min: 10, max: 50 },
  { ...pct("drb", "DRB%", "min", 70), min: 50, max: 88 },
  { ...pct("fgast", "FGAST%", "min", 62), min: 35, max: 85 },
  { ...pct("tov", "TOV%", "max", 14.5), min: 5, max: 28 },
  { key: "ortg", label: "ORtg", direction: "min", target: 115, unit: "rating", min: 85, max: 135 },
  { key: "drtg", label: "DRtg", direction: "max", target: 110, unit: "rating", min: 85, max: 135 },
  { key: "net", label: "Net", direction: "min", target: 7, unit: "rating", min: -25, max: 25 },
  { ...pct("oppEfg", "OPP eFG%", "max", 52), min: 35, max: 65 },
  { ...pct("oppOrb", "OPP ORB%", "max", 30), min: 10, max: 50 },
  { ...pct("oppTov", "OPP TOV%", "min", 15), min: 5, max: 28 },
];

const targets = (entries: Array<[string, string, "min" | "max" | "range", number | [number, number]]>) =>
  Object.fromEntries(entries.map(([key, label, direction, target]) => [key, pct(key, label, direction, target)]));

export const playerReferences: Record<string, PlayerReference> = {
  walker: { role: "PG · primary creator", season: "2025–26 · 36 GP", targets: targets([["ts", "TS%", "min", 56], ["efg", "eFG%", "min", 52], ["usg", "USG%", "range", [20, 26]], ["ast", "AST%", "min", 23], ["tov", "TOV%", "max", 15]]) },
  robineau: { role: "SG/PG · creator", season: "2025–26 · 21 GP", targets: targets([["ts", "TS%", "min", 60], ["efg", "eFG%", "min", 56], ["usg", "USG%", "range", [22, 28]], ["ast", "AST%", "min", 20], ["tov", "TOV%", "max", 15]]) },
  woodbury: { role: "SG/PG · secondary creator", season: "2025–26 · 52 GP", targets: targets([["ts", "TS%", "min", 57], ["efg", "eFG%", "min", 55], ["usg", "USG%", "range", [15, 21]], ["ast", "AST%", "min", 15], ["tov", "TOV%", "max", 17]]) },
  jordan: { role: "SF/SG · two-way wing", season: "2024–25 · 44 GP", targets: targets([["ts", "TS%", "min", 60], ["efg", "eFG%", "min", 58], ["usg", "USG%", "range", [18, 24]], ["ast", "AST%", "min", 8], ["tov", "TOV%", "max", 14], ["trb", "TRB%", "min", 11]]) },
  soliman: { role: "SF/PF · mismatch", season: "2025–26 · 49 GP", targets: targets([["ts", "TS%", "min", 57], ["efg", "eFG%", "min", 53], ["usg", "USG%", "range", [19, 25]], ["ast", "AST%", "min", 18], ["tov", "TOV%", "max", 13], ["trb", "TRB%", "min", 12]]) },
  nelson: { role: "PF · finisher / rebounder", season: "2024–25 · 56 GP", targets: targets([["ts", "TS%", "min", 55], ["efg", "eFG%", "min", 52], ["usg", "USG%", "range", [15, 21]], ["tov", "TOV%", "max", 10], ["orb", "ORB%", "min", 9], ["trb", "TRB%", "min", 13]]) },
  samuel: { role: "PF/C · switchable big", season: "2025–26 · 22 GP", targets: targets([["ts", "TS%", "min", 59], ["efg", "eFG%", "min", 55], ["usg", "USG%", "range", [19, 25]], ["ast", "AST%", "min", 11], ["tov", "TOV%", "max", 13], ["orb", "ORB%", "min", 10], ["trb", "TRB%", "min", 15]]) },
  gaudoux: { role: "C/PF · hub big", season: "2025–26 · 38 GP", targets: targets([["ts", "TS%", "min", 60], ["efg", "eFG%", "min", 57], ["usg", "USG%", "range", [17, 23]], ["ast", "AST%", "min", 15], ["tov", "TOV%", "max", 15], ["orb", "ORB%", "min", 11], ["trb", "TRB%", "min", 14]]) },
  shedrick: { role: "C · rim runner / protector", season: "2025–26 · 14 GP", targets: targets([["ts", "TS%", "min", 62], ["efg", "eFG%", "min", 61], ["usg", "USG%", "range", [14, 20]], ["tov", "TOV%", "max", 15], ["orb", "ORB%", "min", 11], ["trb", "TRB%", "min", 13]]) },
};

