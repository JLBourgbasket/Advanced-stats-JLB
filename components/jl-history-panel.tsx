"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarRange, Gauge, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculatePlayerMetrics, calculateTeamMetrics, formatMetric, parseMinutes } from "@/lib/stats/engine";
import type { MatchBoxscore, RawPlayerBoxscore, RawTeamBoxscore } from "@/lib/stats/types";

type SampleSize = 1 | 3 | 5 | 10 | "all";

const numericTeamFields = ["points", "fgm", "fga", "threePm", "threePa", "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk", "pf"] as const;

function sumTeam(matches: MatchBoxscore[], side: "team" | "opponent") {
  const total: RawTeamBoxscore = { name: matches[0][side].name, points: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0 };
  for (const match of matches) for (const field of numericTeamFields) total[field] += match[side][field];
  return total;
}

function minutesString(value: number) {
  const totalSeconds = Math.round(value * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function aggregate(matches: MatchBoxscore[]) {
  const team = sumTeam(matches, "team");
  const opponent = sumTeam(matches, "opponent");
  const playerMap = new Map<string, { raw: RawPlayerBoxscore; games: number; minutes: number }>();
  for (const match of matches) for (const player of match.players) {
    const key = player.name.trim().toLocaleLowerCase("fr");
    const current = playerMap.get(key) ?? { raw: { ...player, minutes: "0:00", points: 0, fgm: 0, fga: 0, threePm: 0, threePa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0, plusMinus: 0 }, games: 0, minutes: 0 };
    const minutes = parseMinutes(player.minutes);
    current.minutes += minutes;
    if (minutes > 0) current.games += 1;
    for (const field of ["points", "fgm", "fga", "threePm", "threePa", "ftm", "fta", "orb", "drb", "ast", "tov", "stl", "blk", "pf", "plusMinus"] as const) current.raw[field] += player[field];
    current.raw.minutes = minutesString(current.minutes);
    playerMap.set(key, current);
  }
  const aggregateMatch: MatchBoxscore = { ...matches[0], id: `history-${matches[0].id}`, team, opponent, players: [...playerMap.values()].map((entry) => entry.raw), quarters: [] };
  const players = calculatePlayerMetrics(aggregateMatch).map((player) => {
    const source = playerMap.get(player.name.trim().toLocaleLowerCase("fr"))!;
    const games = Math.max(1, source.games);
    return { ...player, games: source.games, mpg: source.minutes / games, ppg: player.points / games, rpg: (player.orb + player.drb) / games };
  }).sort((a, b) => b.ppg - a.ppg);
  return { team, opponent, metrics: calculateTeamMetrics(aggregateMatch), players };
}

function HistoryCard({ label, value, copy }: { label: string; value: string; copy: string }) {
  return <article className="border border-stone-200 bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.1em] text-stone-500">{label}</div><div className="mt-2 font-condensed text-3xl font-black tabular-nums">{value}</div><p className="mt-1 text-[11px] text-stone-400">{copy}</p></article>;
}

export function JlHistoryPanel({ matches, onOpenMatch }: { matches: MatchBoxscore[]; onOpenMatch: (match: MatchBoxscore) => void }) {
  const [sampleSize, setSampleSize] = useState<SampleSize>(1);
  const sample = sampleSize === "all" ? matches : matches.slice(0, sampleSize);
  const data = useMemo(() => sample.length > 0 ? aggregate(sample) : null, [sample]);
  if (!data) return <section className="panel grid min-h-80 place-items-center p-6 text-center"><div><CalendarRange className="mx-auto size-10 text-stone-400" /><h2 className="mt-4 text-2xl font-black">Aucun historique JL Bourg</h2><p className="mt-2 text-sm text-stone-500">Classez un import comme « Match JL Bourg » pour commencer l’historique.</p></div></section>;

  const games = sample.length;
  const wins = sample.filter((match) => match.team.points > match.opponent.points).length;
  const losses = games - wins;
  const metrics = data.metrics;
  const trend = [...sample].reverse().map((match) => { const item = calculateTeamMetrics(match); return { date: match.date.slice(5).split("-").reverse().join("/"), adversaire: match.opponent.name, ORtg: Number(item.ortg.toFixed(1)), DRtg: Number(item.drtg.toFixed(1)), Net: Number(item.net.toFixed(1)) }; });
  const pointsFor = data.team.points / games;
  const pointsAgainst = data.opponent.points / games;

  return <div className="space-y-5">
    <section className="panel p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Analyse multi-matchs</p><h2 className="mt-2 text-3xl font-black">Historique JL Bourg</h2><p className="mt-1 text-sm text-stone-500">Les statistiques sont recalculées sur les volumes cumulés, puis ramenées au nombre de matchs lorsque nécessaire.</p></div><div className="text-right"><div className="font-condensed text-4xl font-black">{wins}–{losses}</div><div className="text-xs text-stone-500">bilan sur l’échantillon</div></div></div><div className="print-hidden mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4"><span className="mr-2 text-xs font-bold text-stone-500">ÉCHANTILLON</span>{([1, 3, 5, 10] as const).map((size) => <button key={size} disabled={matches.length < size} onClick={() => setSampleSize(size)} className={`border px-3 py-1 text-xs font-bold ${sampleSize === size ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"} ${matches.length < size ? "cursor-not-allowed opacity-35" : ""}`}>{size} match{size > 1 ? "s" : ""}</button>)}<button onClick={() => setSampleSize("all")} className={`border px-3 py-1 text-xs font-bold ${sampleSize === "all" ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"}`}>Saison ({matches.length})</button></div></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><HistoryCard label="Bilan" value={`${wins}–${losses}`} copy={`${formatMetric((100 * wins) / games)}% victoires`} /><HistoryCard label="Points" value={formatMetric(pointsFor)} copy="marqués par match" /><HistoryCard label="Encaissés" value={formatMetric(pointsAgainst)} copy="par match" /><HistoryCard label="ORtg" value={formatMetric(metrics.ortg)} copy="cible ≥ 115" /><HistoryCard label="DRtg" value={formatMetric(metrics.drtg)} copy="cible ≤ 110" /><HistoryCard label="Net" value={`${metrics.net > 0 ? "+" : ""}${formatMetric(metrics.net)}`} copy="pour 100 possessions" /></section>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><article className="panel p-5"><div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">Match par match</p><h3 className="mt-1 text-xl font-black">Évolution des ratings</h3></div></div>{trend.length > 1 ? <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} /><YAxis domain={[80, 140]} axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={115} stroke="#d71920" strokeDasharray="4 4" /><ReferenceLine y={110} stroke="#78716c" strokeDasharray="4 4" /><Line type="monotone" dataKey="ORtg" stroke="#d71920" strokeWidth={3} /><Line type="monotone" dataKey="DRtg" stroke="#292524" strokeWidth={3} /><Line type="monotone" dataKey="Net" stroke="#d4a64a" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <div className="mt-4 grid h-72 place-items-center border border-dashed border-stone-300 bg-stone-50 text-center text-sm text-stone-500">Sélectionnez au moins trois matchs lorsque l’historique le permettra.</div>}</article><article className="panel p-5"><div className="flex items-center gap-2"><Gauge className="size-5 text-[#d71920]" /><div><p className="eyebrow">Identité de l’échantillon</p><h3 className="mt-1 text-xl font-black">Indicateurs clés</h3></div></div><div className="mt-4 grid grid-cols-2 gap-3">{[["TS%", metrics.ts], ["eFG%", metrics.efg], ["3P%", metrics.threePct], ["FGAST%", metrics.fgast], ["TOV%", metrics.tov], ["ORB%", metrics.orb], ["DRB%", metrics.drb], ["OPP eFG%", metrics.oppEfg]].map(([label, value]) => <div key={String(label)} className="border border-stone-200 bg-stone-50 p-3"><div className="text-[10px] font-bold text-stone-400">{String(label)}</div><div className="mt-1 text-xl font-black">{formatMetric(Number(value))}%</div></div>)}</div></article></section>

    <section className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-stone-200 p-5"><Users className="size-5 text-[#d71920]" /><div><p className="eyebrow">Cumul de l’échantillon</p><h3 className="mt-1 text-xl font-black">Production individuelle historique</h3></div></div><div className="overflow-x-auto"><Table className="min-w-[1200px]"><TableHeader><TableRow className="bg-stone-50"><TableHead>Joueur</TableHead>{["MJ", "MIN", "PTS", "REB", "USG%", "TS%", "eFG%", "AST%", "TOV%", "ORB%", "TRB%", "PTS/40", "AST/40"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{data.players.map((player) => <TableRow key={player.id}><TableCell className="font-bold">{player.name}</TableCell><TableCell className="text-right">{player.games}</TableCell><TableCell className="text-right">{formatMetric(player.mpg)}</TableCell><TableCell className="text-right font-bold">{formatMetric(player.ppg)}</TableCell><TableCell className="text-right">{formatMetric(player.rpg)}</TableCell><TableCell className="text-right">{formatMetric(player.usg)}</TableCell><TableCell className="text-right">{formatMetric(player.ts)}</TableCell><TableCell className="text-right">{formatMetric(player.efg)}</TableCell><TableCell className="text-right">{formatMetric(player.astPct)}</TableCell><TableCell className="text-right">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right">{formatMetric(player.orbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.trbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.pts40)}</TableCell><TableCell className="text-right">{formatMetric(player.ast40)}</TableCell></TableRow>)}</TableBody></Table></div></section>

    <section className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-stone-200 p-5"><BarChart3 className="size-5 text-[#d71920]" /><div><p className="eyebrow">Accès aux rapports</p><h3 className="mt-1 text-xl font-black">Matchs de l’échantillon</h3></div></div><div className="grid gap-px bg-stone-200 sm:grid-cols-2 xl:grid-cols-3">{sample.map((match) => <button key={match.id} onClick={() => onOpenMatch(match)} className="bg-white p-4 text-left hover:bg-red-50"><div className="flex items-center justify-between gap-3"><span className="font-black">vs {match.opponent.name}</span><span className={`font-condensed text-lg font-black ${match.team.points > match.opponent.points ? "text-emerald-700" : "text-[#d71920]"}`}>{match.team.points}–{match.opponent.points}</span></div><div className="mt-2 text-xs text-stone-500">{match.date.split("-").reverse().join("/")} · {match.competition}</div></button>)}</div></section>
  </div>;
}
