import { createWorker, OEM, PSM, type LoggerMessage } from "tesseract.js";

import type { MatchBoxscore, RawPlayerBoxscore, RawTeamBoxscore } from "@/lib/stats/types";

export type OcrSide = {
  name: string;
  team: RawTeamBoxscore;
  players: RawPlayerBoxscore[];
};

export type OcrBoxscoreDraft = {
  id: string;
  date: string;
  competition: string;
  venue: string;
  home: OcrSide;
  away: OcrSide;
  quarters: Array<{ label: string; home: number; away: number }>;
  confidence: number;
  warnings: string[];
  rawText: string;
};

type TeamTotal = Omit<RawTeamBoxscore, "name">;

const pairPattern = /(\d+)\s*-\s*(\d+)/g;

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanTeamName(value: string) {
  const cleaned = value.replace(/[|:]+$/g, "").replace(/\s+/g, " ").trim();
  if (/chalon/i.test(cleaned)) return "Chalon/Saône";
  if (/dijon/i.test(cleaned)) return "Dijon";
  return cleaned;
}

function numericToken(value: string) {
  const cleaned = value.replace(/[“”‘’'",;:.°]/g, "").trim();
  if (/^(?:o+|i\)|l\)|\(\)|10\))$/i.test(cleaned)) return 0;
  if (/^[\[({]?[4J][\])}]?$/.test(cleaned) && !/^[4]$/.test(cleaned)) return 0;
  if (/^1M$/i.test(cleaned)) return 11;
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  return null;
}

function normalizeLine(line: string) {
  return line
    .replace(/[–—]/g, "-")
    .replace(/[“”‘’]/g, "")
    .replace(/\b[Oo]-([0-9]+)\b/g, "0-$1")
    .replace(/\b([0-9]+)-[Oo]\b/g, "$1-0")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePlayerLine(source: string): RawPlayerBoxscore | null {
  const line = normalizeLine(source);
  const pairs = [...line.matchAll(pairPattern)];
  if (pairs.length < 3 || pairs[0].index === undefined || pairs[2].index === undefined) return null;

  const prefix = line.slice(0, pairs[0].index).trim().split(" ");
  if (prefix.length < 4) return null;
  const readPoints = numericToken(prefix.at(-1) ?? "");
  const minutes = numericToken(prefix.at(-2) ?? "");
  if (readPoints === null || minutes === null) return null;

  let nameEnd = prefix.length - 2;
  if (/^x+$/i.test(prefix[nameEnd - 1] ?? "")) nameEnd -= 1;
  const jersey = numericToken(prefix[0]) ?? prefix[0];
  const name = prefix.slice(1, nameEnd).join(" ").replace(/^['"]|['"]$/g, "").replace(/[.,]+$/g, "").trim();
  if (!name) return null;

  const afterFreeThrows = line.slice((pairs[2].index ?? 0) + pairs[2][0].length);
  const fields = afterFreeThrows
    .split(" ")
    .map(numericToken)
    .filter((value): value is number => value !== null);
  if (fields.length < 8) return null;
  while (fields.length < 11) fields.push(0);
  const stats = fields.slice(-11);
  const fgm = Number(pairs[0][1]);
  const threePm = Number(pairs[1][1]);
  const ftm = Number(pairs[2][1]);
  const inferredPoints = 2 * fgm + threePm + ftm;
  const points = inferredPoints >= 0 ? inferredPoints : readPoints;

  return {
    id: `${slug(name)}-${jersey}`,
    name,
    role: "Adversaire",
    minutes: `${minutes}:00`,
    points,
    fgm,
    fga: Number(pairs[0][2]),
    threePm,
    threePa: Number(pairs[1][2]),
    ftm,
    fta: Number(pairs[2][2]),
    orb: stats[0],
    drb: stats[1],
    ast: stats[3],
    pf: stats[4],
    stl: stats[6],
    tov: stats[7],
    blk: stats[8],
    plusMinus: 0,
  };
}

function parseTotalLine(source: string): TeamTotal | null {
  const line = normalizeLine(source);
  const pairs = [...line.matchAll(pairPattern)];
  if (!/^TOTAL/i.test(line) || pairs.length < 3 || pairs[0].index === undefined) return null;
  const prefixValues = line
    .slice(0, pairs[0].index)
    .replace(/^TOTAL:?/i, "")
    .trim()
    .split(" ")
    .map(numericToken)
    .filter((value): value is number => value !== null);
  const points = prefixValues.at(-1);
  if (points === undefined) return null;
  const afterFreeThrows = line.slice((pairs[2].index ?? 0) + pairs[2][0].length);
  const fields = afterFreeThrows
    .split(" ")
    .map(numericToken)
    .filter((value): value is number => value !== null);
  while (fields.length < 11) fields.push(0);
  const stats = fields.slice(-11);
  const fgm = Number(pairs[0][1]);
  const threePm = Number(pairs[1][1]);
  const readFtm = Number(pairs[2][1]);
  const fta = Number(pairs[2][2]);
  const inferredFtm = points - 2 * fgm - threePm;
  const ftm = inferredFtm >= 0 && inferredFtm <= fta ? inferredFtm : readFtm;

  return {
    points,
    fgm,
    fga: Number(pairs[0][2]),
    threePm,
    threePa: Number(pairs[1][2]),
    ftm,
    fta,
    orb: stats[0],
    drb: stats[1],
    ast: stats[3],
    pf: stats[4],
    stl: stats[6],
    tov: stats[7],
    blk: stats[8],
  };
}

function parseQuarterRows(lines: string[]) {
  const start = lines.findIndex((line) => /^Equipes?/i.test(line));
  if (start < 0) return [];
  return lines.slice(start + 1, start + 5).flatMap((source) => {
    const line = normalizeLine(source);
    const match = line.match(/^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(?:(?:Non|Oui)\s+)?(\d+)$/i);
    if (!match) return [];
    return [{ name: cleanTeamName(match[1]), quarters: match.slice(2, 6).map(Number), total: Number(match[6]) }];
  }).slice(0, 2);
}

export function parseLnbOcrText(text: string, confidence = 0): OcrBoxscoreDraft {
  const lines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);
  const quarterRows = parseQuarterRows(lines);
  const tableHeaders = lines
    .map((line, index) => (/^No\s+Joueur/i.test(line) ? index : -1))
    .filter((index) => index >= 0);
  const totalIndexes = lines
    .map((line, index) => (/^TOTAL/i.test(line) ? index : -1))
    .filter((index) => index >= 0);
  const totals = totalIndexes.map((index) => parseTotalLine(lines[index])).filter((total): total is TeamTotal => total !== null);
  const fallbackTeam = (name: string): RawTeamBoxscore => ({
    name,
    points: 0,
    fgm: 0,
    fga: 0,
    threePm: 0,
    threePa: 0,
    ftm: 0,
    fta: 0,
    orb: 0,
    drb: 0,
    ast: 0,
    tov: 0,
    stl: 0,
    blk: 0,
    pf: 0,
  });
  const playersFor = (side: number) => {
    const start = tableHeaders[side];
    const end = totalIndexes[side];
    if (start === undefined || end === undefined) return [];
    return lines.slice(start + 1, end).map(parsePlayerLine).filter((player): player is RawPlayerBoxscore => player !== null);
  };
  const homeName = quarterRows[0]?.name || "Équipe domicile";
  const awayName = quarterRows[1]?.name || "Équipe visiteuse";
  const homeTeam = totals[0] ? { name: homeName, ...totals[0] } : fallbackTeam(homeName);
  const awayTeam = totals[1] ? { name: awayName, ...totals[1] } : fallbackTeam(awayName);
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];
  if (quarterRows.length < 2) warnings.push("Noms d’équipes ou quart-temps à vérifier.");
  if (totals.length < 2) warnings.push("Totaux collectifs incomplets.");
  if (playersFor(0).length < 5 || playersFor(1).length < 5) warnings.push("Certaines lignes joueurs n’ont pas été reconnues.");
  if (!dateMatch) warnings.push("Date non reconnue : valeur du jour proposée.");
  for (const team of [homeTeam, awayTeam]) {
    if (team.ast > team.fgm) {
      warnings.push(`Passes décisives supérieures aux paniers réussis pour ${team.name} (${team.ast}/${team.fgm}) : donnée source à contrôler.`);
    }
  }

  return {
    id: crypto.randomUUID(),
    date,
    competition: "Pré-saison LNB",
    venue: homeName,
    home: { name: homeName, team: homeTeam, players: playersFor(0) },
    away: { name: awayName, team: awayTeam, players: playersFor(1) },
    quarters: [0, 1, 2, 3].map((index) => ({
      label: `Q${index + 1}`,
      home: quarterRows[0]?.quarters[index] ?? 0,
      away: quarterRows[1]?.quarters[index] ?? 0,
    })),
    confidence,
    warnings,
    rawText: text,
  };
}

export function validateOcrDraftForPublication(draft: OcrBoxscoreDraft, analyzedSide: "home" | "away") {
  const issues: string[] = [];
  const subjects = [draft.home, draft.away];
  for (const subject of subjects) {
    if (/^Équipe (?:domicile|visiteuse)$/i.test(subject.name)) issues.push(`Nom de l’équipe ${subject.name.toLowerCase()} non reconnu.`);
    if (subject.team.points <= 0 || subject.team.fga <= 0) issues.push(`Totaux collectifs manquants pour ${subject.name}.`);
    const scoreEquation = 2 * subject.team.fgm + subject.team.threePm + subject.team.ftm;
    if (subject.team.points > 0 && scoreEquation !== subject.team.points) issues.push(`Équation du score incohérente pour ${subject.name} (${scoreEquation}/${subject.team.points}).`);
  }
  const analyzed = draft[analyzedSide];
  if (analyzed.players.filter((player) => Number(player.minutes.split(":")[0] || 0) > 0).length < 5) issues.push(`Moins de cinq joueurs exploitables pour ${analyzed.name}.`);
  const playerPoints = analyzed.players.reduce((sum, player) => sum + player.points, 0);
  if (analyzed.team.points > 0 && playerPoints !== analyzed.team.points) issues.push(`Somme des points joueurs incohérente pour ${analyzed.name} (${playerPoints}/${analyzed.team.points}).`);
  if (draft.quarters.every((quarter) => quarter.home === 0 && quarter.away === 0)) issues.push("Scores par quart-temps non reconnus.");
  return issues;
}

export async function extractLnbBoxscore(file: File, onProgress?: (progress: number, status: string) => void) {
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    logger: (message: LoggerMessage) => {
      onProgress?.(Math.round(message.progress * 100), message.status);
    },
  });
  try {
    await worker.setParameters({
      // Les boxscores LNB sont des tableaux pleine page : SINGLE_BLOCK conserve
      // chaque joueur sur une seule ligne, contrairement à AUTO qui lit parfois
      // les colonnes séparément.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "200",
    });
    const result = await worker.recognize(file, { rotateAuto: true }, { text: true });
    return parseLnbOcrText(result.data.text, result.data.confidence);
  } finally {
    await worker.terminate();
  }
}

export function draftToMatch(draft: OcrBoxscoreDraft, analyzedSide: "home" | "away"): MatchBoxscore {
  const subject = analyzedSide === "home" ? draft.home : draft.away;
  const opponent = analyzedSide === "home" ? draft.away : draft.home;
  return {
    id: draft.id,
    date: draft.date,
    competition: draft.competition,
    venue: draft.venue,
    team: { ...subject.team, name: subject.name },
    opponent: { ...opponent.team, name: opponent.name },
    players: subject.players,
    quarters: draft.quarters.map((quarter) => ({
      label: quarter.label,
      team: analyzedSide === "home" ? quarter.home : quarter.away,
      opponent: analyzedSide === "home" ? quarter.away : quarter.home,
    })),
  };
}
