"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Crosshair,
  Gauge,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteMatchButton } from "@/components/delete-match-button";
import { calculatePlayerMetrics, calculateTeamMetrics, formatMetric, parseMinutes } from "@/lib/stats/engine";
import type { MatchBoxscore, PlayerMetrics, RawPlayerBoxscore, RawTeamBoxscore, TeamMetrics } from "@/lib/stats/types";

type Tone = "threat" | "opportunity" | "watch" | "neutral";
type SampleSize = 1 | 3 | 5 | 10;
type AggregatedPlayer = PlayerMetrics & {
  games: number;
  mpg: number;
  ppg: number;
  rpg: number;
  pointsShare: number;
  shotShare: number;
};

const pct = (made: number, attempted: number) => attempted > 0 ? (100 * made) / attempted : 0;

function toneClasses(tone: Tone) {
  if (tone === "threat") return "border-red-200 bg-red-50 text-red-950";
  if (tone === "opportunity") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "watch") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-stone-200 bg-stone-50 text-stone-950";
}

function ScoutingCard({ label, value, copy, tone }: { label: string; value: string; copy: string; tone: Tone }) {
  const Icon = tone === "threat" ? AlertTriangle : tone === "opportunity" ? TrendingDown : tone === "watch" ? Target : ShieldCheck;
  return <article className={`border p-4 ${toneClasses(tone)}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.1em]">{label}</span><Icon className="size-4" /></div><div className="mt-3 text-3xl font-black tabular-nums">{value}</div><p className="mt-2 text-xs leading-5 opacity-75">{copy}</p></article>;
}

function StatLine({ label, value, benchmark, tone = "neutral" }: { label: string; value: string; benchmark?: string; tone?: Tone }) {
  return <div className="flex items-center justify-between gap-3 border-b border-stone-200 py-2.5 last:border-0"><div><div className="text-xs font-bold">{label}</div>{benchmark && <div className="mt-0.5 text-[10px] text-stone-400">{benchmark}</div>}</div><span className={`font-condensed text-lg font-black tabular-nums ${tone === "threat" ? "text-red-800" : tone === "opportunity" ? "text-emerald-700" : tone === "watch" ? "text-amber-700" : ""}`}>{value}</span></div>;
}

function SignalCard({ title, detail, tone, index }: { title: string; detail: string; tone: Tone; index: number }) {
  const Icon = tone === "threat" ? AlertTriangle : tone === "opportunity" ? CheckCircle2 : Target;
  return <div className={`border-l-4 p-4 ${toneClasses(tone)}`}><div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center bg-white text-xs font-black">{index}</span><div><div className="flex items-center gap-2 text-sm font-black"><Icon className="size-4" />{title}</div><p className="mt-1 text-xs leading-5 opacity-75">{detail}</p></div></div></div>;
}

function FactorRow({ label, team, opponent, note }: { label: string; team: number; opponent: number; note: string }) {
  const maximum = Math.max(team, opponent, 1) * 1.12;
  return <div className="border-b border-stone-200 py-3 last:border-0"><div className="mb-2 flex items-center justify-between"><div><span className="text-xs font-black">{label}</span><span className="ml-2 text-[10px] text-stone-400">{note}</span></div><div className="text-xs tabular-nums"><strong className="text-[#d71920]">{formatMetric(team)}%</strong><span className="mx-2 text-stone-300">/</span><strong>{formatMetric(opponent)}%</strong></div></div><div className="space-y-1"><div className="h-2 bg-stone-100"><div className="h-full bg-[#d71920]" style={{ width: `${(100 * team) / maximum}%` }} /></div><div className="h-2 bg-stone-100"><div className="h-full bg-stone-800" style={{ width: `${(100 * opponent) / maximum}%` }} /></div></div></div>;
}

function PlayerScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name?: string; usage?: number; efficiency?: number; minutes?: number; points?: number } }> }) {
  const player = payload?.[0]?.payload;
  if (!active || !player) return null;
  return <div className="border border-stone-300 bg-white p-3 text-xs shadow-lg"><div className="font-black">{player.name}</div><div className="mt-2 space-y-1 text-stone-600"><div>USG% : <strong>{formatMetric(player.usage ?? 0)}</strong></div><div>TS% : <strong>{formatMetric(player.efficiency ?? 0)}</strong></div><div>MIN/m : <strong>{formatMetric(player.minutes ?? 0)}</strong></div><div>PTS/m : <strong>{formatMetric(player.points ?? 0)}</strong></div></div></div>;
}

function addTeamTotals(matches: MatchBoxscore[], side: "team" | "opponent"): RawTeamBoxscore {
  const first = matches[0][side];
  const result: RawTeamBoxscore = { name: first.name, points: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0 };
  for (const match of matches) {
    const source = match[side];
    for (const key of ["points", "fgm", "fga", "threePm", "threePa", "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk", "pf"] as const) result[key] += source[key];
  }
  return result;
}

function minutesString(total: number) {
  const minutes = Math.floor(total);
  const seconds = Math.round((total - minutes) * 60);
  return `${minutes}:${String(seconds === 60 ? 0 : seconds).padStart(2, "0")}`;
}

function aggregateSample(matches: MatchBoxscore[]) {
  const team = addTeamTotals(matches, "team");
  const opponent = addTeamTotals(matches, "opponent");
  const playerMap = new Map<string, { raw: RawPlayerBoxscore; games: number; totalMinutes: number }>();
  for (const match of matches) {
    for (const player of match.players) {
      const key = player.name.trim().toLocaleLowerCase("fr");
      const current = playerMap.get(key) ?? {
        raw: { ...player, minutes: "0:00", points: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0, plusMinus: 0 },
        games: 0,
        totalMinutes: 0,
      };
      const minutes = parseMinutes(player.minutes);
      current.totalMinutes += minutes;
      if (minutes > 0) current.games += 1;
      for (const stat of ["points", "fgm", "fga", "threePm", "threePa", "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk", "pf", "plusMinus"] as const) current.raw[stat] += player[stat];
      current.raw.minutes = minutesString(current.totalMinutes);
      playerMap.set(key, current);
    }
  }
  const players = [...playerMap.values()].map((entry) => entry.raw);
  const aggregateMatch: MatchBoxscore = { ...matches[0], id: `sample-${matches[0].id}`, team, opponent, players, quarters: [] };
  const metrics = calculateTeamMetrics(aggregateMatch);
  const playerMetrics = calculatePlayerMetrics(aggregateMatch).map((player): AggregatedPlayer => {
    const source = playerMap.get(player.name.trim().toLocaleLowerCase("fr"))!;
    const games = Math.max(1, source.games);
    return { ...player, games: source.games, mpg: source.totalMinutes / games, ppg: player.points / games, rpg: (player.orb + player.drb) / games, pointsShare: pct(player.points, team.points), shotShare: pct(player.fga, team.fga) };
  });
  return { team, opponent, metrics, players: playerMetrics };
}

function buildSignals(metrics: TeamMetrics, players: AggregatedPlayer[], games: number) {
  const threats: Array<{ title: string; detail: string; score: number }> = [];
  const opportunities: Array<{ title: string; detail: string; score: number }> = [];
  if (metrics.orb >= 33) threats.push({ title: "Pression au rebond offensif", detail: `${formatMetric(metrics.orb)}% de rebonds offensifs : priorité au box-out collectif.`, score: metrics.orb - 33 });
  if (metrics.efg >= 54.5) threats.push({ title: "Adresse effective élevée", detail: `${formatMetric(metrics.efg)}% d’eFG sur l’échantillon.`, score: metrics.efg - 54.5 });
  if (metrics.ftr >= 35) threats.push({ title: "Accès fréquent aux lancers", detail: `${formatMetric(metrics.ftr)} lancers tentés pour 100 tirs de champ.`, score: (metrics.ftr - 35) / 2 });
  if (!metrics.fgastValid) threats.push({ title: "Création collective à vérifier", detail: `Ratio brut ${formatMetric(metrics.fgastRaw)}% : les passes décisives dépassent les paniers réussis dans la source. Cet indicateur n’est pas interprété.`, score: 100 });
  else if (metrics.fgast >= 62) threats.push({ title: "Création collective", detail: `${formatMetric(metrics.fgast)}% des paniers sont assistés.`, score: (metrics.fgast - 62) / 2 });
  if (metrics.ortg < 105) opportunities.push({ title: "Production offensive contenue", detail: `ORtg ${formatMetric(metrics.ortg)} : sous le seuil de référence de 105.`, score: 105 - metrics.ortg });
  if (metrics.efg < 50.5) opportunities.push({ title: "Efficacité de tir fragile", detail: `${formatMetric(metrics.efg)}% d’eFG, avec ${formatMetric(metrics.threePct)}% à trois points.`, score: 50.5 - metrics.efg });
  if (metrics.tov >= 15) opportunities.push({ title: "Ballons perdus provoquables", detail: `${formatMetric(metrics.tov)}% de possessions terminées par une perte de balle.`, score: metrics.tov - 15 });
  if (metrics.ftPct < 70) opportunities.push({ title: "Faible rendement aux lancers", detail: `${formatMetric(metrics.ftPct)}% aux lancers francs.`, score: (70 - metrics.ftPct) / 2 });
  if (metrics.drb < 70) opportunities.push({ title: "Rebond défensif attaquable", detail: `${formatMetric(metrics.drb)}% de rebonds défensifs sécurisés.`, score: 70 - metrics.drb });
  const activePlayers = players.filter((player) => player.minutesDecimal > 0);
  const rebounder = [...activePlayers].sort((a, b) => b.orbPct - a.orbPct)[0];
  const scorer = [...activePlayers].sort((a, b) => b.ppg - a.ppg)[0];
  if (rebounder?.orbPct >= 12) threats.push({ title: `Rebond : ${rebounder.name}`, detail: `${formatMetric(rebounder.orbPct)}% ORB et ${formatMetric(rebounder.rpg)} rebonds par match.`, score: rebounder.orbPct - 8 });
  if (scorer && scorer.ppg >= 12) threats.push({ title: `Scoreur : ${scorer.name}`, detail: `${formatMetric(scorer.ppg)} points par match, TS% ${formatMetric(scorer.ts)}.`, score: scorer.ppg - 8 });
  if (threats.length === 0) threats.push({ title: "Menace à confirmer", detail: `Échantillon de ${games} match${games > 1 ? "s" : ""} : aucune force collective nettement au-dessus des seuils.`, score: 0 });
  if (opportunities.length === 0) opportunities.push({ title: "Peu de faiblesse nette", detail: "Aucun indicateur collectif n’est très inférieur aux références retenues.", score: 0 });
  return { threats: threats.sort((a, b) => b.score - a.score).slice(0, 3), opportunities: opportunities.sort((a, b) => b.score - a.score).slice(0, 3) };
}

function buildGamePlan(metrics: TeamMetrics, players: AggregatedPlayer[]) {
  const keys: string[] = [];
  if (metrics.orb >= 33) keys.push("Sécuriser le rebond défensif à cinq avant de déclencher la transition.");
  if (metrics.tov >= 15) keys.push("Augmenter la pression sur les porteurs et fermer les premières lignes de passe.");
  if (metrics.efg < 50.5) keys.push("Protéger la raquette, contester sans faute et accepter uniquement les tirs extérieurs identifiés comme faibles.");
  if (metrics.ftr >= 35) keys.push("Défendre verticalement et limiter les fautes sur les joueurs qui attaquent le cercle.");
  if (metrics.fgastValid && metrics.fgast >= 62) keys.push("Casser le rythme des premières passes et forcer davantage de création individuelle tardive.");
  const creator = [...players].filter((player) => player.minutesDecimal > 0).sort((a, b) => b.ast40 - a.ast40)[0];
  if (creator) keys.push(`Préparer le plan de pression sur ${creator.name}, premier créateur estimé (${formatMetric(creator.ast40)} AST/40).`);
  return keys.slice(0, 4);
}

function playerRole(player: AggregatedPlayer) {
  if (player.orbPct >= 12) return "Rebondeur offensif";
  if (player.ast40 >= 6) return "Créateur";
  if (player.threePa >= 3 && pct(player.threePm, player.threePa) >= 36) return "Shooteur";
  if (player.ppg >= 12) return "Scoreur";
  return "Rotation à surveiller";
}

export function ScoutingPanel({ matches, selectedId, onSelect, canDelete = false, onDelete }: { matches: MatchBoxscore[]; selectedId: string; onSelect: (id: string) => void; canDelete?: boolean; onDelete?: (match: MatchBoxscore) => void }) {
  const [sampleSize, setSampleSize] = useState<SampleSize>(1);
  const match = matches.find((item) => item.id === selectedId) ?? matches[0];
  const availableForTeam = match ? matches.filter((item) => item.team.name === match.team.name) : [];
  const sample = availableForTeam.slice(0, sampleSize);
  const aggregate = useMemo(() => sample.length > 0 ? aggregateSample(sample) : null, [sample]);

  if (!match || !aggregate) return <section className="panel grid min-h-72 place-items-center p-6 text-center"><div><Crosshair className="mx-auto size-10 text-stone-400" /><h2 className="mt-4 text-2xl font-black">Aucun rapport adverse</h2><p className="mt-2 text-sm text-stone-500">Importez puis validez un boxscore dans l’onglet Imports.</p></div></section>;

  const { team, opponent, metrics } = aggregate;
  const players = [...aggregate.players].sort((a, b) => b.usg - a.usg);
  const activePlayers = players.filter((player) => player.minutesDecimal > 0);
  const threats = [...activePlayers].sort((a, b) => (b.ppg + b.usg * 0.35 + (b.ts ?? 0) * 0.12 + b.orbPct * 0.25) - (a.ppg + a.usg * 0.35 + (a.ts ?? 0) * 0.12 + a.orbPct * 0.25)).slice(0, 4);
  const signals = buildSignals(metrics, players, sample.length);
  const gamePlan = buildGamePlan(metrics, players);
  const pace = metrics.possessions / sample.length;
  const trendData = [...sample].reverse().map((item) => {
    const itemMetrics = calculateTeamMetrics(item);
    return { date: item.date.slice(5).split("-").reverse().join("/"), ORtg: Number(itemMetrics.ortg.toFixed(1)), DRtg: Number(itemMetrics.drtg.toFixed(1)), Net: Number(itemMetrics.net.toFixed(1)) };
  });
  const shotData = [
    { zone: "2 pts", réussis: (team.fgm - team.threePm) / sample.length, manqués: (team.fga - team.threePa - team.fgm + team.threePm) / sample.length },
    { zone: "3 pts", réussis: team.threePm / sample.length, manqués: (team.threePa - team.threePm) / sample.length },
    { zone: "LF", réussis: team.ftm / sample.length, manqués: (team.fta - team.ftm) / sample.length },
  ];
  const playerMapData = activePlayers.map((player) => ({ name: player.name, usage: Number(player.usg.toFixed(1)), efficiency: Number((player.ts ?? 0).toFixed(1)), minutes: player.mpg, points: player.ppg }));
  const twoPointPoints = 2 * (team.fgm - team.threePm);
  const threePointPoints = 3 * team.threePm;
  const totalScoring = Math.max(1, twoPointPoints + threePointPoints + team.ftm);

  return <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
    <aside className="panel print-hidden h-fit p-4 xl:sticky xl:top-5"><p className="eyebrow">Rapports disponibles</p><div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">{matches.map((item) => <div key={item.id} className={`flex items-start border ${item.id === match.id ? "border-[#d71920] bg-red-50" : "border-stone-200 hover:bg-stone-50"}`}><button type="button" onClick={() => onSelect(item.id)} className="min-w-0 flex-1 p-3 text-left"><div className="font-bold">{item.team.name}</div><div className="mt-1 text-xs text-stone-500">vs {item.opponent.name} · {item.date.split("-").reverse().join("/")}</div></button>{canDelete && onDelete && <div className="p-1.5"><DeleteMatchButton label={`${item.team.name} contre ${item.opponent.name}`} onDelete={() => onDelete(item)} /></div>}</div>)}</div></aside>

    <div className="space-y-5">
      <section className="panel p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Rapport de scouting · {sample.length} match{sample.length > 1 ? "s" : ""}</p><h2 className="mt-2 text-3xl font-black">{match.team.name}</h2><p className="mt-1 text-sm text-stone-500">Match sélectionné : vs {match.opponent.name} · {match.competition}</p></div><div className="text-right"><div className="font-condensed text-4xl font-black">{match.team.points}–{match.opponent.points}</div><div className="mt-1 text-xs text-stone-500">{match.date.split("-").reverse().join("/")}</div></div></div><div className="print-hidden mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4"><span className="mr-2 text-xs font-bold text-stone-500">ÉCHANTILLON</span>{([1, 3, 5, 10] as const).map((size) => { const disabled = availableForTeam.length < size; return <button key={size} disabled={disabled} onClick={() => setSampleSize(size)} className={`border px-3 py-1 text-xs font-bold ${sampleSize === size ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"} ${disabled ? "cursor-not-allowed opacity-35" : ""}`}>{size} match{size > 1 ? "s" : ""}</button>; })}<span className="ml-auto text-xs text-stone-500">Moyennes pondérées sur les matchs disponibles.</span></div></section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-[#d71920]" /><div><p className="eyebrow">À contrôler</p><h3 className="mt-1 text-xl font-black">Menaces principales</h3></div></div><div className="mt-4 space-y-2">{signals.threats.map((signal, index) => <SignalCard key={signal.title} title={signal.title} detail={signal.detail} tone="threat" index={index + 1} />)}</div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><div><p className="eyebrow">À exploiter</p><h3 className="mt-1 text-xl font-black">Opportunités JL</h3></div></div><div className="mt-4 space-y-2">{signals.opportunities.map((signal, index) => <SignalCard key={signal.title} title={signal.title} detail={signal.detail} tone="opportunity" index={index + 1} />)}</div></article>
      </section>

      <section className="panel p-5 sm:p-6"><div className="flex items-center gap-2"><Target className="size-5 text-[#d71920]" /><div><p className="eyebrow">Hypothèses fondées sur le boxscore</p><h3 className="mt-1 text-xl font-black">Clés du plan de match JL</h3></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{gamePlan.map((key, index) => <div key={key} className="flex gap-3 border border-stone-200 bg-stone-50 p-4"><span className="grid size-7 shrink-0 place-items-center bg-stone-950 text-xs font-black text-white">{index + 1}</span><p className="text-sm font-semibold leading-6">{key}</p></div>)}</div></section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ScoutingCard label="ORtg" value={formatMetric(metrics.ortg)} copy="Référence JL : menace ≥ 115" tone={metrics.ortg >= 115 ? "threat" : metrics.ortg < 105 ? "opportunity" : "watch"} />
        <ScoutingCard label="DRtg" value={formatMetric(metrics.drtg)} copy="Solidité défensive si ≤ 110" tone={metrics.drtg <= 110 ? "threat" : metrics.drtg >= 115 ? "opportunity" : "watch"} />
        <ScoutingCard label="Net" value={`${metrics.net > 0 ? "+" : ""}${formatMetric(metrics.net)}`} copy="Différentiel pour 100 possessions" tone={metrics.net >= 7 ? "threat" : metrics.net < 0 ? "opportunity" : "watch"} />
        <ScoutingCard label="Rythme" value={formatMetric(pace)} copy="Possessions estimées par match" tone="neutral" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><Zap className="size-5 text-[#d71920]" /><div><p className="eyebrow">Production</p><h3 className="mt-1 text-xl font-black">Identité offensive</h3></div></div><div className="mt-4 grid grid-cols-2 gap-x-5"><StatLine label="TS%" value={`${formatMetric(metrics.ts)}%`} benchmark="JL cible ≥ 59%" tone={metrics.ts >= 59 ? "threat" : metrics.ts < 55 ? "opportunity" : "watch"} /><StatLine label="eFG%" value={`${formatMetric(metrics.efg)}%`} benchmark="JL cible ≥ 54,5%" tone={metrics.efg >= 54.5 ? "threat" : metrics.efg < 50.5 ? "opportunity" : "watch"} /><StatLine label="2P%" value={`${formatMetric(metrics.twoPct)}%`} /><StatLine label="3P%" value={`${formatMetric(metrics.threePct)}%`} tone={metrics.threePct >= 37 ? "threat" : metrics.threePct < 32 ? "opportunity" : "watch"} /><StatLine label="3PAr" value={`${formatMetric(metrics.threePar)}%`} benchmark="Part des tirs pris à 3 pts" /><StatLine label="FTr" value={`${formatMetric(metrics.ftr)}%`} benchmark="LF tentés / tirs tentés" /><StatLine label="FGAST%" value={metrics.fgastValid ? `${formatMetric(metrics.fgast)}%` : "À contrôler"} benchmark={metrics.fgastValid ? "Part des paniers assistés" : `Ratio brut ${formatMetric(metrics.fgastRaw)}% · incohérence source`} tone={metrics.fgastValid && metrics.fgast >= 62 ? "threat" : metrics.fgastValid ? "neutral" : "watch"} /><StatLine label="AST/TOV" value={formatMetric(metrics.astTov, 2)} /></div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#d71920]" /><div><p className="eyebrow">Possessions</p><h3 className="mt-1 text-xl font-black">Rebond, pertes et défense</h3></div></div><div className="mt-4 grid grid-cols-2 gap-x-5"><StatLine label="ORB%" value={`${formatMetric(metrics.orb)}%`} benchmark="Menace si ≥ 33%" tone={metrics.orb >= 33 ? "threat" : metrics.orb < 27 ? "opportunity" : "watch"} /><StatLine label="DRB%" value={`${formatMetric(metrics.drb)}%`} benchmark="Attaquable si < 70%" tone={metrics.drb < 70 ? "opportunity" : "neutral"} /><StatLine label="TOV%" value={`${formatMetric(metrics.tov)}%`} benchmark="Exploitable si ≥ 15%" tone={metrics.tov >= 15 ? "opportunity" : metrics.tov < 12 ? "threat" : "watch"} /><StatLine label="STL%" value={`${formatMetric(metrics.stlRate)}%`} /><StatLine label="BLK% 2 pts" value={`${formatMetric(metrics.blkRate)}%`} /><StatLine label="OPP eFG%" value={`${formatMetric(metrics.oppEfg)}%`} tone={metrics.oppEfg <= 52 ? "threat" : "opportunity"} /><StatLine label="OPP ORB%" value={`${formatMetric(metrics.oppOrb)}%`} /><StatLine label="OPP TOV%" value={`${formatMetric(metrics.oppTov)}%`} /></div></article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><Gauge className="size-5 text-[#d71920]" /><div><p className="eyebrow">Comparaison directe</p><h3 className="mt-1 text-xl font-black">Four Factors</h3></div></div><div className="mt-4"><div className="mb-2 flex justify-end gap-4 text-[10px] font-bold"><span className="text-[#d71920]">ÉQUIPE ANALYSÉE</span><span>ADVERSAIRE</span></div><FactorRow label="eFG%" team={metrics.efg} opponent={metrics.oppEfg} note="adresse effective" /><FactorRow label="TOV%" team={metrics.tov} opponent={metrics.oppTov} note="plus bas = mieux" /><FactorRow label="ORB%" team={metrics.orb} opponent={metrics.oppOrb} note="rebond offensif" /><FactorRow label="FTr" team={metrics.ftr} opponent={metrics.oppFtr} note="accès aux lancers" /></div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><BarChart3 className="size-5 text-[#d71920]" /><div><p className="eyebrow">Volume moyen par match</p><h3 className="mt-1 text-xl font-black">Profil de tirs</h3></div></div><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={shotData}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="zone" axisLine={false} tickLine={false} fontSize={11} /><YAxis axisLine={false} tickLine={false} fontSize={11} /><Tooltip formatter={(value) => formatMetric(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="réussis" stackId="shots" fill="#d71920" /><Bar dataKey="manqués" stackId="shots" fill="#d6d0c5" /></BarChart></ResponsiveContainer></div><div className="mt-2 flex h-3 overflow-hidden"><div className="bg-stone-800" style={{ width: `${(100 * twoPointPoints) / totalScoring}%` }} /><div className="bg-[#d71920]" style={{ width: `${(100 * threePointPoints) / totalScoring}%` }} /><div className="bg-amber-500" style={{ width: `${(100 * team.ftm) / totalScoring}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-bold text-stone-500"><span>2 pts {formatMetric((100 * twoPointPoints) / totalScoring)}%</span><span>3 pts {formatMetric((100 * threePointPoints) / totalScoring)}%</span><span>LF {formatMetric((100 * team.ftm) / totalScoring)}%</span></div></article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><BarChart3 className="size-5 text-[#d71920]" /><div><p className="eyebrow">Match sélectionné</p><h3 className="mt-1 text-xl font-black">Score par quart-temps</h3></div></div><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={match.quarters}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} /><YAxis axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="team" name={match.team.name} fill="#d71920" /><Bar dataKey="opponent" name={match.opponent.name} fill="#292524" /></BarChart></ResponsiveContainer></div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">Évolution</p><h3 className="mt-1 text-xl font-black">Ratings par match</h3></div></div>{trendData.length > 1 ? <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} /><YAxis domain={[80, 140]} axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={115} stroke="#d71920" strokeDasharray="4 4" /><ReferenceLine y={110} stroke="#78716c" strokeDasharray="4 4" /><Line type="monotone" dataKey="ORtg" stroke="#d71920" strokeWidth={3} /><Line type="monotone" dataKey="DRtg" stroke="#292524" strokeWidth={3} /><Line type="monotone" dataKey="Net" stroke="#d4a64a" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <div className="mt-4 grid h-64 place-items-center border border-dashed border-stone-300 bg-stone-50 px-8 text-center text-sm leading-6 text-stone-500">Importez au moins deux matchs de {match.team.name} pour afficher l’évolution de l’ORtg, du DRtg et du Net Rating.</div>}</article>
      </section>

      <section className="panel p-5"><div className="flex items-center gap-2"><Users className="size-5 text-[#d71920]" /><div><p className="eyebrow">Usage × efficacité</p><h3 className="mt-1 text-xl font-black">Cartographie des responsabilités</h3></div></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 0 }}><CartesianGrid stroke="#e7e3db" /><XAxis type="number" dataKey="usage" name="USG%" unit="%" domain={[0, "dataMax + 5"]} fontSize={11} label={{ value: "USG%", position: "insideBottom", offset: -10 }} /><YAxis type="number" dataKey="efficiency" name="TS%" unit="%" domain={[20, 90]} fontSize={11} /><ZAxis type="number" dataKey="minutes" range={[70, 500]} name="MIN/match" /><ReferenceLine y={57} stroke="#d71920" strokeDasharray="4 4" /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={<PlayerScatterTooltip />} /><Scatter name="Joueurs" data={playerMapData} fill="#d71920" /></ScatterChart></ResponsiveContainer></div><p className="mt-2 text-xs text-stone-500">La taille du point représente les minutes par match. Survolez un point pour identifier le joueur.</p></section>

      <section><div className="mb-3"><p className="eyebrow">Priorités individuelles</p><h3 className="mt-1 text-xl font-black">Menaces à préparer</h3></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{threats.map((player, index) => <article key={player.id} className="panel overflow-hidden"><div className="flex items-center justify-between bg-stone-950 px-4 py-3 text-white"><span className="text-xs font-bold uppercase tracking-[0.1em]">Priorité {index + 1}</span><span className="text-xs text-stone-400">{playerRole(player)}</span></div><div className="p-4"><h4 className="text-lg font-black">{player.name}</h4><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><div className="text-[9px] font-bold text-stone-400">PPG</div><div className="font-black">{formatMetric(player.ppg)}</div></div><div><div className="text-[9px] font-bold text-stone-400">USG%</div><div className="font-black">{formatMetric(player.usg)}</div></div><div><div className="text-[9px] font-bold text-stone-400">TS%</div><div className="font-black">{formatMetric(player.ts)}</div></div></div><div className="mt-4 border-t border-stone-200 pt-3 text-xs leading-5 text-stone-500">{formatMetric(player.rpg)} REB/m · {formatMetric(player.ast40)} AST/40 · {formatMetric(player.tovPct)}% TOV</div></div></article>)}</div></section>

      <section className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-stone-200 p-5"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">Échantillon sélectionné</p><h3 className="mt-1 text-xl font-black">Tableau individuel détaillé</h3></div></div><div className="overflow-x-auto"><Table className="min-w-[1700px]"><TableHeader><TableRow className="bg-stone-50"><TableHead>Joueur</TableHead>{["MJ", "MIN", "PTS", "REB", "USG%", "TS%", "eFG%", "2P%", "3P%", "3PAr", "FTr", "AST", "AST% estim.", "TOV%", "ORB%", "DRB%", "TRB%", "PTS/40", "AST/40", "ORtg*", "DRtg*"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{players.map((player) => { const twoPm = player.fgm - player.threePm; const twoPa = player.fga - player.threePa; return <TableRow key={player.id}><TableCell><div className="font-bold">{player.name}</div><div className="text-[10px] text-stone-400">{playerRole(player)} · {formatMetric(player.pointsShare)}% pts équipe</div></TableCell><TableCell className="text-right">{player.games}</TableCell><TableCell className="text-right">{formatMetric(player.mpg)}</TableCell><TableCell className="text-right font-bold">{formatMetric(player.ppg)}</TableCell><TableCell className="text-right">{formatMetric(player.rpg)}</TableCell><TableCell className="text-right">{formatMetric(player.usg)}</TableCell><TableCell className="text-right">{formatMetric(player.ts)}</TableCell><TableCell className="text-right">{formatMetric(player.efg)}</TableCell><TableCell className="text-right">{formatMetric(pct(twoPm, twoPa))}</TableCell><TableCell className="text-right">{formatMetric(pct(player.threePm, player.threePa))}</TableCell><TableCell className="text-right">{formatMetric(player.threePar)}</TableCell><TableCell className="text-right">{formatMetric(player.ftr)}</TableCell><TableCell className="text-right font-bold">{player.ast}</TableCell><TableCell className={`text-right ${player.astPctLowSample ? "bg-amber-50 text-amber-800" : ""}`} title={`AST% estimé sur ${formatMetric(player.estimatedTeammateFieldGoals, 2)} paniers de coéquipiers`}><span aria-hidden="true">~</span>{formatMetric(player.astPct)}{player.astPctLowSample ? " ⚠" : ""}</TableCell><TableCell className="text-right">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right">{formatMetric(player.orbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.drbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.trbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.pts40)}</TableCell><TableCell className="text-right">{formatMetric(player.ast40)}</TableCell><TableCell className="text-right">{formatMetric(player.ortgEstimate)}</TableCell><TableCell className="text-right">{formatMetric(player.drtgEstimate)}</TableCell></TableRow>; })}</TableBody></Table></div><p className="border-t border-stone-200 p-4 text-[11px] leading-5 text-stone-500">AST% estim. utilise les minutes et les paniers collectifs, faute de données de rotations. « ~ » signale une estimation ; ⚠ un dénominateur inférieur à 10 paniers de coéquipiers. Les colonnes AST et AST/40 sont les repères prioritaires sur un match isolé. * ORtg/DRtg individuels = estimations boxscore, distinctes des ratings on-court.</p></section>

      <section className="panel p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#d71920]" /><div><p className="eyebrow">Périmètre du rapport</p><h3 className="mt-1 text-xl font-black">Qualité et limites des données</h3></div></div><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-900">DISPONIBLE</div><p className="mt-2 text-xs leading-5 text-emerald-800">Totaux, tirs, lancers, rebonds, création, pertes de balle, ratings estimés et tendances.</p></div><div className="border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-black text-amber-900">À INTERPRÉTER</div><p className="mt-2 text-xs leading-5 text-amber-800">Un match unique décrit une performance, pas encore une identité stable de l’équipe.</p></div><div className="border border-stone-300 bg-stone-50 p-4"><div className="text-xs font-black">NON DISPONIBLE AU BOXSCORE</div><p className="mt-2 text-xs leading-5 text-stone-600">Zones de tirs, transition, pick-and-roll, lineups, on/off et séquences tactiques.</p></div></div><p className="mt-4 text-xs text-stone-500">Source : boxscore OCR contrôlé et validé. Profil analysé : {team.name} face à {opponent.name} sur {sample.length} match{sample.length > 1 ? "s" : ""}.</p></section>
    </div>
  </div>;
}
