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
import { useI18n } from "@/components/i18n-provider";
import { calculatePlayerMetrics, calculateTeamMetrics, formatMetric, parseMinutes } from "@/lib/stats/engine";
import type { MatchBoxscore, PlayerMetrics, RawPlayerBoxscore, RawTeamBoxscore, TeamMetrics } from "@/lib/stats/types";

type Tone = "threat" | "opportunity" | "watch" | "neutral";
type SampleSize = 1 | 3 | 5 | 10;
type Translator = (fr: string, en: string) => string;
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

function buildSignals(metrics: TeamMetrics, players: AggregatedPlayer[], games: number, tr: Translator) {
  const threats: Array<{ title: string; detail: string; score: number }> = [];
  const opportunities: Array<{ title: string; detail: string; score: number }> = [];
  if (metrics.orb >= 33) threats.push({ title: tr("Pression au rebond offensif", "Offensive rebounding pressure"), detail: tr(`${formatMetric(metrics.orb)}% de rebonds offensifs : priorité au box-out collectif.`, `${formatMetric(metrics.orb)}% offensive rebound rate: team box-outs are a priority.`), score: metrics.orb - 33 });
  if (metrics.efg >= 54.5) threats.push({ title: tr("Adresse effective élevée", "High effective shooting"), detail: tr(`${formatMetric(metrics.efg)}% d’eFG sur l’échantillon.`, `${formatMetric(metrics.efg)}% eFG over the sample.`), score: metrics.efg - 54.5 });
  if (metrics.ftr >= 35) threats.push({ title: tr("Accès fréquent aux lancers", "Frequent free-throw access"), detail: tr(`${formatMetric(metrics.ftr)} lancers tentés pour 100 tirs de champ.`, `${formatMetric(metrics.ftr)} free throws attempted per 100 field-goal attempts.`), score: (metrics.ftr - 35) / 2 });
  if (!metrics.fgastValid) threats.push({ title: tr("Création collective à vérifier", "Team creation requires review"), detail: tr(`Ratio brut ${formatMetric(metrics.fgastRaw)}% : les passes décisives dépassent les paniers réussis dans la source. Cet indicateur n’est pas interprété.`, `Raw ratio ${formatMetric(metrics.fgastRaw)}%: assists exceed made field goals in the source. This metric is not interpreted.`), score: 100 });
  else if (metrics.fgast >= 62) threats.push({ title: tr("Création collective", "Team creation"), detail: tr(`${formatMetric(metrics.fgast)}% des paniers sont assistés.`, `${formatMetric(metrics.fgast)}% of field goals are assisted.`), score: (metrics.fgast - 62) / 2 });
  if (metrics.ortg < 105) opportunities.push({ title: tr("Production offensive contenue", "Limited offensive production"), detail: tr(`ORtg ${formatMetric(metrics.ortg)} : sous le seuil de référence de 105.`, `ORtg ${formatMetric(metrics.ortg)}: below the 105 reference threshold.`), score: 105 - metrics.ortg });
  if (metrics.efg < 50.5) opportunities.push({ title: tr("Efficacité de tir fragile", "Fragile shooting efficiency"), detail: tr(`${formatMetric(metrics.efg)}% d’eFG, avec ${formatMetric(metrics.threePct)}% à trois points.`, `${formatMetric(metrics.efg)}% eFG, with ${formatMetric(metrics.threePct)}% from three.`), score: 50.5 - metrics.efg });
  if (metrics.tov >= 15) opportunities.push({ title: tr("Ballons perdus provoquables", "Turnovers can be forced"), detail: tr(`${formatMetric(metrics.tov)}% de possessions terminées par une perte de balle.`, `${formatMetric(metrics.tov)}% of possessions end in a turnover.`), score: metrics.tov - 15 });
  if (metrics.ftPct < 70) opportunities.push({ title: tr("Faible rendement aux lancers", "Low free-throw efficiency"), detail: tr(`${formatMetric(metrics.ftPct)}% aux lancers francs.`, `${formatMetric(metrics.ftPct)}% from the free-throw line.`), score: (70 - metrics.ftPct) / 2 });
  if (metrics.drb < 70) opportunities.push({ title: tr("Rebond défensif attaquable", "Attackable defensive rebounding"), detail: tr(`${formatMetric(metrics.drb)}% de rebonds défensifs sécurisés.`, `${formatMetric(metrics.drb)}% defensive rebounds secured.`), score: 70 - metrics.drb });
  const activePlayers = players.filter((player) => player.minutesDecimal > 0);
  const rebounder = [...activePlayers].sort((a, b) => b.orbPct - a.orbPct)[0];
  const scorer = [...activePlayers].sort((a, b) => b.ppg - a.ppg)[0];
  if (rebounder?.orbPct >= 12) threats.push({ title: tr(`Rebond : ${rebounder.name}`, `Rebounding: ${rebounder.name}`), detail: tr(`${formatMetric(rebounder.orbPct)}% ORB et ${formatMetric(rebounder.rpg)} rebonds par match.`, `${formatMetric(rebounder.orbPct)}% ORB and ${formatMetric(rebounder.rpg)} rebounds per game.`), score: rebounder.orbPct - 8 });
  if (scorer && scorer.ppg >= 12) threats.push({ title: tr(`Scoreur : ${scorer.name}`, `Scorer: ${scorer.name}`), detail: tr(`${formatMetric(scorer.ppg)} points par match, TS% ${formatMetric(scorer.ts)}.`, `${formatMetric(scorer.ppg)} points per game, ${formatMetric(scorer.ts)} TS%.`), score: scorer.ppg - 8 });
  if (threats.length === 0) threats.push({ title: tr("Menace à confirmer", "Threat to confirm"), detail: tr(`Échantillon de ${games} match${games > 1 ? "s" : ""} : aucune force collective nettement au-dessus des seuils.`, `${games}-game sample: no team strength clearly above the thresholds.`), score: 0 });
  if (opportunities.length === 0) opportunities.push({ title: tr("Peu de faiblesse nette", "Few clear weaknesses"), detail: tr("Aucun indicateur collectif n’est très inférieur aux références retenues.", "No team metric is substantially below the selected benchmarks."), score: 0 });
  return { threats: threats.sort((a, b) => b.score - a.score).slice(0, 3), opportunities: opportunities.sort((a, b) => b.score - a.score).slice(0, 3) };
}

function buildGamePlan(metrics: TeamMetrics, players: AggregatedPlayer[], tr: Translator) {
  const keys: string[] = [];
  if (metrics.orb >= 33) keys.push(tr("Sécuriser le rebond défensif à cinq avant de déclencher la transition.", "Secure the defensive rebound with all five players before running in transition."));
  if (metrics.tov >= 15) keys.push(tr("Augmenter la pression sur les porteurs et fermer les premières lignes de passe.", "Increase ball pressure and close the first passing lanes."));
  if (metrics.efg < 50.5) keys.push(tr("Protéger la raquette, contester sans faute et accepter uniquement les tirs extérieurs identifiés comme faibles.", "Protect the paint, contest without fouling and concede only the identified weak perimeter shots."));
  if (metrics.ftr >= 35) keys.push(tr("Défendre verticalement et limiter les fautes sur les joueurs qui attaquent le cercle.", "Defend vertically and limit fouls on players attacking the rim."));
  if (metrics.fgastValid && metrics.fgast >= 62) keys.push(tr("Casser le rythme des premières passes et forcer davantage de création individuelle tardive.", "Disrupt early passing rhythm and force more late-clock individual creation."));
  const creator = [...players].filter((player) => player.minutesDecimal > 0).sort((a, b) => b.ast40 - a.ast40)[0];
  if (creator) keys.push(tr(`Préparer le plan de pression sur ${creator.name}, premier créateur estimé (${formatMetric(creator.ast40)} AST/40).`, `Prepare the pressure plan for ${creator.name}, the primary estimated creator (${formatMetric(creator.ast40)} AST/40).`));
  return keys.slice(0, 4);
}

function playerRole(player: AggregatedPlayer, tr: Translator) {
  if (player.orbPct >= 12) return tr("Rebondeur offensif", "Offensive rebounder");
  if (player.ast40 >= 6) return tr("Créateur", "Creator");
  if (player.threePa >= 3 && pct(player.threePm, player.threePa) >= 36) return tr("Shooteur", "Shooter");
  if (player.ppg >= 12) return tr("Scoreur", "Scorer");
  return tr("Rotation à surveiller", "Rotation player to watch");
}

export function ScoutingPanel({ matches, selectedId, onSelect, canDelete = false, onDelete }: { matches: MatchBoxscore[]; selectedId: string; onSelect: (id: string) => void; canDelete?: boolean; onDelete?: (match: MatchBoxscore) => void }) {
  const { tr } = useI18n();
  const [sampleSize, setSampleSize] = useState<SampleSize>(1);
  const match = matches.find((item) => item.id === selectedId) ?? matches[0];
  const availableForTeam = match
    ? [match, ...matches.filter((item) => item.team.name === match.team.name && item.id !== match.id)]
    : [];
  const sample = availableForTeam.slice(0, sampleSize);
  const aggregate = useMemo(() => sample.length > 0 ? aggregateSample(sample) : null, [sample]);

  if (!match || !aggregate) return <section className="panel grid min-h-72 place-items-center p-6 text-center"><div><Crosshair className="mx-auto size-10 text-stone-400" /><h2 className="mt-4 text-2xl font-black">{tr("Aucun rapport adverse", "No opponent report")}</h2><p className="mt-2 text-sm text-stone-500">{tr("Importez puis validez un boxscore dans l’onglet Imports.", "Import and validate a boxscore in the Imports tab.")}</p></div></section>;

  const { team, opponent, metrics } = aggregate;
  const players = [...aggregate.players].sort((a, b) => b.usg - a.usg);
  const activePlayers = players.filter((player) => player.minutesDecimal > 0);
  const threats = [...activePlayers].sort((a, b) => (b.ppg + b.usg * 0.35 + (b.ts ?? 0) * 0.12 + b.orbPct * 0.25) - (a.ppg + a.usg * 0.35 + (a.ts ?? 0) * 0.12 + a.orbPct * 0.25)).slice(0, 4);
  const signals = buildSignals(metrics, players, sample.length, tr);
  const gamePlan = buildGamePlan(metrics, players, tr);
  const pace = metrics.possessions / sample.length;
  const trendData = [...sample].reverse().map((item) => {
    const itemMetrics = calculateTeamMetrics(item);
    return { date: item.date.slice(5).split("-").reverse().join("/"), ORtg: Number(itemMetrics.ortg.toFixed(1)), DRtg: Number(itemMetrics.drtg.toFixed(1)), Net: Number(itemMetrics.net.toFixed(1)) };
  });
  const shotData = [
    { zone: "2 pts", made: (team.fgm - team.threePm) / sample.length, missed: (team.fga - team.threePa - team.fgm + team.threePm) / sample.length },
    { zone: "3 pts", made: team.threePm / sample.length, missed: (team.threePa - team.threePm) / sample.length },
    { zone: tr("LF", "FT"), made: team.ftm / sample.length, missed: (team.fta - team.ftm) / sample.length },
  ];
  const playerMapData = activePlayers.map((player) => ({ name: player.name, usage: Number(player.usg.toFixed(1)), efficiency: Number((player.ts ?? 0).toFixed(1)), minutes: player.mpg, points: player.ppg }));
  const twoPointPoints = 2 * (team.fgm - team.threePm);
  const threePointPoints = 3 * team.threePm;
  const totalScoring = Math.max(1, twoPointPoints + threePointPoints + team.ftm);

  return <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
    <aside className="panel print-hidden h-fit p-4 xl:sticky xl:top-5"><p className="eyebrow">{tr("Rapports disponibles", "Available reports")}</p>{!canDelete && <p className="mt-2 text-[10px] leading-4 text-stone-400">{tr("La suppression apparaît après connexion administrateur dans l’onglet Données.", "Delete controls appear after administrator login in the Data tab.")}</p>}<div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">{matches.map((item) => <div key={item.id} className={`flex items-start border ${item.id === match.id ? "border-[#d71920] bg-red-50" : "border-stone-200 hover:bg-stone-50"}`}><button type="button" onClick={() => { setSampleSize(1); onSelect(item.id); }} className="min-w-0 flex-1 p-3 text-left"><div className="font-bold">{item.team.name}</div><div className="mt-1 text-xs text-stone-500">vs {item.opponent.name} · {item.date.split("-").reverse().join("/")}</div></button>{canDelete && onDelete && <div className="p-1.5"><DeleteMatchButton label={tr(`${item.team.name} contre ${item.opponent.name}`, `${item.team.name} versus ${item.opponent.name}`)} onDelete={() => onDelete(item)} /></div>}</div>)}</div></aside>

    <div className="space-y-5">
      <section className="panel p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{tr("Rapport de scouting", "Scouting report")} · {sample.length} {tr(sample.length > 1 ? "matchs" : "match", sample.length > 1 ? "games" : "game")}</p><h2 className="mt-2 text-3xl font-black">{match.team.name}</h2><p className="mt-1 text-sm text-stone-500">{tr("Match sélectionné", "Selected game")}: vs {match.opponent.name} · {match.competition}</p></div><div className="text-right"><div className="font-condensed text-4xl font-black">{match.team.points}–{match.opponent.points}</div><div className="mt-1 text-xs text-stone-500">{match.date.split("-").reverse().join("/")}</div></div></div><div className="print-hidden mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4"><span className="mr-2 text-xs font-bold text-stone-500">{tr("ÉCHANTILLON", "SAMPLE")}</span>{([1, 3, 5, 10] as const).map((size) => { const disabled = availableForTeam.length < size; return <button key={size} disabled={disabled} onClick={() => setSampleSize(size)} className={`border px-3 py-1 text-xs font-bold ${sampleSize === size ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"} ${disabled ? "cursor-not-allowed opacity-35" : ""}`}>{size} {tr(size > 1 ? "matchs" : "match", size > 1 ? "games" : "game")}</button>; })}<span className="ml-auto text-xs text-stone-500">{tr("Moyennes pondérées sur les matchs disponibles.", "Weighted averages over available games.")}</span></div></section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("À contrôler", "Control")}</p><h3 className="mt-1 text-xl font-black">{tr("Menaces principales", "Main threats")}</h3></div></div><div className="mt-4 space-y-2">{signals.threats.map((signal, index) => <SignalCard key={signal.title} title={signal.title} detail={signal.detail} tone="threat" index={index + 1} />)}</div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><div><p className="eyebrow">{tr("À exploiter", "Exploit")}</p><h3 className="mt-1 text-xl font-black">{tr("Opportunités JL", "JL opportunities")}</h3></div></div><div className="mt-4 space-y-2">{signals.opportunities.map((signal, index) => <SignalCard key={signal.title} title={signal.title} detail={signal.detail} tone="opportunity" index={index + 1} />)}</div></article>
      </section>

      <section className="panel p-5 sm:p-6"><div className="flex items-center gap-2"><Target className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Hypothèses fondées sur le boxscore", "Boxscore-based hypotheses")}</p><h3 className="mt-1 text-xl font-black">{tr("Clés du plan de match JL", "JL game-plan keys")}</h3></div></div><div className="mt-5 grid gap-3 md:grid-cols-2">{gamePlan.map((key, index) => <div key={key} className="flex gap-3 border border-stone-200 bg-stone-50 p-4"><span className="grid size-7 shrink-0 place-items-center bg-stone-950 text-xs font-black text-white">{index + 1}</span><p className="text-sm font-semibold leading-6">{key}</p></div>)}</div></section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ScoutingCard label="ORtg" value={formatMetric(metrics.ortg)} copy={tr("Référence JL : menace ≥ 115", "JL benchmark: threat ≥ 115")} tone={metrics.ortg >= 115 ? "threat" : metrics.ortg < 105 ? "opportunity" : "watch"} />
        <ScoutingCard label="DRtg" value={formatMetric(metrics.drtg)} copy={tr("Solidité défensive si ≤ 110", "Defensive strength if ≤ 110")} tone={metrics.drtg <= 110 ? "threat" : metrics.drtg >= 115 ? "opportunity" : "watch"} />
        <ScoutingCard label="Net" value={`${metrics.net > 0 ? "+" : ""}${formatMetric(metrics.net)}`} copy={tr("Différentiel pour 100 possessions", "Differential per 100 possessions")} tone={metrics.net >= 7 ? "threat" : metrics.net < 0 ? "opportunity" : "watch"} />
        <ScoutingCard label={tr("Rythme", "Pace")} value={formatMetric(pace)} copy={tr("Possessions estimées par match", "Estimated possessions per game")} tone="neutral" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><Zap className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Production", "Production")}</p><h3 className="mt-1 text-xl font-black">{tr("Identité offensive", "Offensive identity")}</h3></div></div><div className="mt-4 grid grid-cols-2 gap-x-5"><StatLine label="TS%" value={`${formatMetric(metrics.ts)}%`} benchmark={tr("JL cible ≥ 59%", "JL target ≥ 59%")} tone={metrics.ts >= 59 ? "threat" : metrics.ts < 55 ? "opportunity" : "watch"} /><StatLine label="eFG%" value={`${formatMetric(metrics.efg)}%`} benchmark={tr("JL cible ≥ 54,5%", "JL target ≥ 54.5%")} tone={metrics.efg >= 54.5 ? "threat" : metrics.efg < 50.5 ? "opportunity" : "watch"} /><StatLine label="2P%" value={`${formatMetric(metrics.twoPct)}%`} /><StatLine label="3P%" value={`${formatMetric(metrics.threePct)}%`} tone={metrics.threePct >= 37 ? "threat" : metrics.threePct < 32 ? "opportunity" : "watch"} /><StatLine label="3PAr" value={`${formatMetric(metrics.threePar)}%`} benchmark={tr("Part des tirs pris à 3 pts", "Share of three-point attempts")} /><StatLine label="FTr" value={`${formatMetric(metrics.ftr)}%`} benchmark={tr("LF tentés / tirs tentés", "FTA / FGA")} /><StatLine label="FGAST%" value={metrics.fgastValid ? `${formatMetric(metrics.fgast)}%` : tr("À contrôler", "Review")} benchmark={metrics.fgastValid ? tr("Part des paniers assistés", "Share of assisted field goals") : tr(`Ratio brut ${formatMetric(metrics.fgastRaw)}% · incohérence source`, `Raw ratio ${formatMetric(metrics.fgastRaw)}% · source inconsistency`)} tone={metrics.fgastValid && metrics.fgast >= 62 ? "threat" : metrics.fgastValid ? "neutral" : "watch"} /><StatLine label="AST/TOV" value={formatMetric(metrics.astTov, 2)} /></div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Possessions", "Possessions")}</p><h3 className="mt-1 text-xl font-black">{tr("Rebond, pertes et défense", "Rebounding, turnovers and defense")}</h3></div></div><div className="mt-4 grid grid-cols-2 gap-x-5"><StatLine label="ORB%" value={`${formatMetric(metrics.orb)}%`} benchmark={tr("Menace si ≥ 33%", "Threat if ≥ 33%")} tone={metrics.orb >= 33 ? "threat" : metrics.orb < 27 ? "opportunity" : "watch"} /><StatLine label="DRB%" value={`${formatMetric(metrics.drb)}%`} benchmark={tr("Attaquable si < 70%", "Attackable if < 70%")} tone={metrics.drb < 70 ? "opportunity" : "neutral"} /><StatLine label="TOV%" value={`${formatMetric(metrics.tov)}%`} benchmark={tr("Exploitable si ≥ 15%", "Exploitable if ≥ 15%")} tone={metrics.tov >= 15 ? "opportunity" : metrics.tov < 12 ? "threat" : "watch"} /><StatLine label="STL%" value={`${formatMetric(metrics.stlRate)}%`} /><StatLine label="BLK% 2 pts" value={`${formatMetric(metrics.blkRate)}%`} /><StatLine label="OPP eFG%" value={`${formatMetric(metrics.oppEfg)}%`} tone={metrics.oppEfg <= 52 ? "threat" : "opportunity"} /><StatLine label="OPP ORB%" value={`${formatMetric(metrics.oppOrb)}%`} /><StatLine label="OPP TOV%" value={`${formatMetric(metrics.oppTov)}%`} /></div></article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><Gauge className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Comparaison directe", "Head-to-head comparison")}</p><h3 className="mt-1 text-xl font-black">Four Factors</h3></div></div><div className="mt-4"><div className="mb-2 flex justify-end gap-4 text-[10px] font-bold"><span className="text-[#d71920]">{tr("ÉQUIPE ANALYSÉE", "ANALYZED TEAM")}</span><span>{tr("ADVERSAIRE", "OPPONENT")}</span></div><FactorRow label="eFG%" team={metrics.efg} opponent={metrics.oppEfg} note={tr("adresse effective", "effective shooting")} /><FactorRow label="TOV%" team={metrics.tov} opponent={metrics.oppTov} note={tr("plus bas = mieux", "lower is better")} /><FactorRow label="ORB%" team={metrics.orb} opponent={metrics.oppOrb} note={tr("rebond offensif", "offensive rebounding")} /><FactorRow label="FTr" team={metrics.ftr} opponent={metrics.oppFtr} note={tr("accès aux lancers", "free-throw access")} /></div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><BarChart3 className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Volume moyen par match", "Average volume per game")}</p><h3 className="mt-1 text-xl font-black">{tr("Profil de tirs", "Shot profile")}</h3></div></div><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={shotData}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="zone" axisLine={false} tickLine={false} fontSize={11} /><YAxis axisLine={false} tickLine={false} fontSize={11} /><Tooltip formatter={(value) => formatMetric(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="made" name={tr("réussis", "made")} stackId="shots" fill="#d71920" /><Bar dataKey="missed" name={tr("manqués", "missed")} stackId="shots" fill="#d6d0c5" /></BarChart></ResponsiveContainer></div><div className="mt-2 flex h-3 overflow-hidden"><div className="bg-stone-800" style={{ width: `${(100 * twoPointPoints) / totalScoring}%` }} /><div className="bg-[#d71920]" style={{ width: `${(100 * threePointPoints) / totalScoring}%` }} /><div className="bg-amber-500" style={{ width: `${(100 * team.ftm) / totalScoring}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-bold text-stone-500"><span>2 pts {formatMetric((100 * twoPointPoints) / totalScoring)}%</span><span>3 pts {formatMetric((100 * threePointPoints) / totalScoring)}%</span><span>{tr("LF", "FT")} {formatMetric((100 * team.ftm) / totalScoring)}%</span></div></article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="panel p-5"><div className="flex items-center gap-2"><BarChart3 className="size-5 text-[#d71920]" /><div><p className="eyebrow">Match sélectionné</p><h3 className="mt-1 text-xl font-black">Score par quart-temps</h3></div></div><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={match.quarters}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} /><YAxis axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="team" name={match.team.name} fill="#d71920" /><Bar dataKey="opponent" name={match.opponent.name} fill="#292524" /></BarChart></ResponsiveContainer></div></article>
        <article className="panel p-5"><div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">Évolution</p><h3 className="mt-1 text-xl font-black">Ratings par match</h3></div></div>{trendData.length > 1 ? <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} /><YAxis domain={[80, 140]} axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={115} stroke="#d71920" strokeDasharray="4 4" /><ReferenceLine y={110} stroke="#78716c" strokeDasharray="4 4" /><Line type="monotone" dataKey="ORtg" stroke="#d71920" strokeWidth={3} /><Line type="monotone" dataKey="DRtg" stroke="#292524" strokeWidth={3} /><Line type="monotone" dataKey="Net" stroke="#d4a64a" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <div className="mt-4 grid h-64 place-items-center border border-dashed border-stone-300 bg-stone-50 px-8 text-center text-sm leading-6 text-stone-500">Importez au moins deux matchs de {match.team.name} pour afficher l’évolution de l’ORtg, du DRtg et du Net Rating.</div>}</article>
      </section>

      <section className="panel p-5"><div className="flex items-center gap-2"><Users className="size-5 text-[#d71920]" /><div><p className="eyebrow">Usage × efficacité</p><h3 className="mt-1 text-xl font-black">Cartographie des responsabilités</h3></div></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 0 }}><CartesianGrid stroke="#e7e3db" /><XAxis type="number" dataKey="usage" name="USG%" unit="%" domain={[0, "dataMax + 5"]} fontSize={11} label={{ value: "USG%", position: "insideBottom", offset: -10 }} /><YAxis type="number" dataKey="efficiency" name="TS%" unit="%" domain={[20, 90]} fontSize={11} /><ZAxis type="number" dataKey="minutes" range={[70, 500]} name="MIN/match" /><ReferenceLine y={57} stroke="#d71920" strokeDasharray="4 4" /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={<PlayerScatterTooltip />} /><Scatter name="Joueurs" data={playerMapData} fill="#d71920" /></ScatterChart></ResponsiveContainer></div><p className="mt-2 text-xs text-stone-500">La taille du point représente les minutes par match. Survolez un point pour identifier le joueur.</p></section>

      <section><div className="mb-3"><p className="eyebrow">{tr("Priorités individuelles", "Individual priorities")}</p><h3 className="mt-1 text-xl font-black">{tr("Menaces à préparer", "Threats to prepare for")}</h3></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{threats.map((player, index) => <article key={player.id} className="panel overflow-hidden"><div className="flex items-center justify-between bg-stone-950 px-4 py-3 text-white"><span className="text-xs font-bold uppercase tracking-[0.1em]">{tr("Priorité", "Priority")} {index + 1}</span><span className="text-xs text-stone-400">{playerRole(player, tr)}</span></div><div className="p-4"><h4 className="text-lg font-black">{player.name}</h4><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><div className="text-[9px] font-bold text-stone-400">PPG</div><div className="font-black">{formatMetric(player.ppg)}</div></div><div><div className="text-[9px] font-bold text-stone-400">USG%</div><div className="font-black">{formatMetric(player.usg)}</div></div><div><div className="text-[9px] font-bold text-stone-400">TS%</div><div className="font-black">{formatMetric(player.ts)}</div></div></div><div className="mt-4 border-t border-stone-200 pt-3 text-xs leading-5 text-stone-500">{formatMetric(player.rpg)} REB/{tr("m", "g")} · {formatMetric(player.ast40)} AST/40 · {formatMetric(player.tovPct)}% TOV</div></div></article>)}</div></section>

      <section className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-stone-200 p-5"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Échantillon sélectionné", "Selected sample")}</p><h3 className="mt-1 text-xl font-black">{tr("Tableau individuel détaillé", "Detailed player table")}</h3></div></div><div className="overflow-x-auto"><Table className="min-w-[1700px]"><TableHeader><TableRow className="bg-stone-50"><TableHead>{tr("Joueur", "Player")}</TableHead>{[tr("MJ", "GP"), "MIN", "PTS", "REB", "USG%", "TS%", "eFG%", "2P%", "3P%", "3PAr", "FTr", "AST", tr("AST% estim.", "est. AST%"), "TOV%", "ORB%", "DRB%", "TRB%", "PTS/40", "AST/40", "ORtg*", "DRtg*"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{players.map((player) => { const twoPm = player.fgm - player.threePm; const twoPa = player.fga - player.threePa; return <TableRow key={player.id}><TableCell><div className="font-bold">{player.name}</div><div className="text-[10px] text-stone-400">{playerRole(player, tr)} · {formatMetric(player.pointsShare)}% {tr("pts équipe", "team pts")}</div></TableCell><TableCell className="text-right">{player.games}</TableCell><TableCell className="text-right">{formatMetric(player.mpg)}</TableCell><TableCell className="text-right font-bold">{formatMetric(player.ppg)}</TableCell><TableCell className="text-right">{formatMetric(player.rpg)}</TableCell><TableCell className="text-right">{formatMetric(player.usg)}</TableCell><TableCell className="text-right">{formatMetric(player.ts)}</TableCell><TableCell className="text-right">{formatMetric(player.efg)}</TableCell><TableCell className="text-right">{formatMetric(pct(twoPm, twoPa))}</TableCell><TableCell className="text-right">{formatMetric(pct(player.threePm, player.threePa))}</TableCell><TableCell className="text-right">{formatMetric(player.threePar)}</TableCell><TableCell className="text-right">{formatMetric(player.ftr)}</TableCell><TableCell className="text-right font-bold">{player.ast}</TableCell><TableCell className={`text-right ${player.astPctLowSample ? "bg-amber-50 text-amber-800" : ""}`} title={tr(`AST% estimé sur ${formatMetric(player.estimatedTeammateFieldGoals, 2)} paniers de coéquipiers`, `AST% estimated from ${formatMetric(player.estimatedTeammateFieldGoals, 2)} teammate field goals`)}><span aria-hidden="true">~</span>{formatMetric(player.astPct)}{player.astPctLowSample ? " ⚠" : ""}</TableCell><TableCell className="text-right">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right">{formatMetric(player.orbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.drbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.trbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.pts40)}</TableCell><TableCell className="text-right">{formatMetric(player.ast40)}</TableCell><TableCell className="text-right">{formatMetric(player.ortgEstimate)}</TableCell><TableCell className="text-right">{formatMetric(player.drtgEstimate)}</TableCell></TableRow>; })}</TableBody></Table></div><p className="border-t border-stone-200 p-4 text-[11px] leading-5 text-stone-500">{tr("AST% estim. utilise les minutes et les paniers collectifs, faute de données de rotations. « ~ » signale une estimation ; ⚠ un dénominateur inférieur à 10 paniers de coéquipiers. Les colonnes AST et AST/40 sont les repères prioritaires sur un match isolé. * ORtg/DRtg individuels = estimations boxscore, distinctes des ratings on-court.", "Estimated AST% uses minutes and team field goals because rotation data is unavailable. “~” marks an estimate; ⚠ marks fewer than 10 teammate field goals in the denominator. AST and AST/40 are the primary references for a single game. * Individual ORtg/DRtg are boxscore estimates, separate from on-court ratings.")}</p></section>

      <section className="panel p-5 sm:p-6"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#d71920]" /><div><p className="eyebrow">Périmètre du rapport</p><h3 className="mt-1 text-xl font-black">Qualité et limites des données</h3></div></div><div className="mt-5 grid gap-4 md:grid-cols-3"><div className="border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-black text-emerald-900">DISPONIBLE</div><p className="mt-2 text-xs leading-5 text-emerald-800">Totaux, tirs, lancers, rebonds, création, pertes de balle, ratings estimés et tendances.</p></div><div className="border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-black text-amber-900">À INTERPRÉTER</div><p className="mt-2 text-xs leading-5 text-amber-800">Un match unique décrit une performance, pas encore une identité stable de l’équipe.</p></div><div className="border border-stone-300 bg-stone-50 p-4"><div className="text-xs font-black">NON DISPONIBLE AU BOXSCORE</div><p className="mt-2 text-xs leading-5 text-stone-600">Zones de tirs, transition, pick-and-roll, lineups, on/off et séquences tactiques.</p></div></div><p className="mt-4 text-xs text-stone-500">Source : boxscore OCR contrôlé et validé. Profil analysé : {team.name} face à {opponent.name} sur {sample.length} match{sample.length > 1 ? "s" : ""}.</p></section>
    </div>
  </div>;
}
