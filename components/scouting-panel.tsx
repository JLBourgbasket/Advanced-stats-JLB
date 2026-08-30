"use client";

import { useState } from "react";
import { AlertTriangle, Crosshair, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculatePlayerMetrics, calculateTeamMetrics, formatMetric } from "@/lib/stats/engine";
import type { MatchBoxscore } from "@/lib/stats/types";

type Tone = "threat" | "opportunity" | "neutral";

function ScoutingCard({ label, value, copy, tone }: { label: string; value: string; copy: string; tone: Tone }) {
  const classes = tone === "threat" ? "border-red-200 bg-red-50 text-red-950" : tone === "opportunity" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50";
  const Icon = tone === "threat" ? AlertTriangle : tone === "opportunity" ? TrendingDown : ShieldCheck;
  return <article className={`border p-4 ${classes}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.1em]">{label}</span><Icon className="size-4" /></div><div className="mt-3 text-3xl font-black tabular-nums">{value}</div><p className="mt-2 text-xs leading-5 opacity-75">{copy}</p></article>;
}

export function ScoutingPanel({ matches, selectedId, onSelect }: { matches: MatchBoxscore[]; selectedId: string; onSelect: (id: string) => void }) {
  const [sampleSize, setSampleSize] = useState<1 | 3 | 5 | 10>(1);
  const match = matches.find((item) => item.id === selectedId) ?? matches[0];
  if (!match) return <section className="panel grid min-h-72 place-items-center p-6 text-center"><div><Crosshair className="mx-auto size-10 text-stone-400" /><h2 className="mt-4 text-2xl font-black">Aucun rapport adverse</h2><p className="mt-2 text-sm text-stone-500">Importez puis validez un boxscore dans l’onglet Imports.</p></div></section>;
  const sample = matches.filter((item) => item.team.name === match.team.name).slice(0, sampleSize);
  const sampleMetrics = sample.map(calculateTeamMetrics);
  const average = (key: keyof ReturnType<typeof calculateTeamMetrics>) => sampleMetrics.reduce((sum, item) => sum + item[key], 0) / sampleMetrics.length;
  const metrics = {
    ortg: average("ortg"),
    efg: average("efg"),
    tov: average("tov"),
    orb: average("orb"),
  };
  const players = calculatePlayerMetrics(match).sort((a, b) => b.usg - a.usg);

  return <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
    <aside className="panel h-fit p-4"><p className="eyebrow">Rapports disponibles</p><div className="mt-4 space-y-2">{matches.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className={`w-full border p-3 text-left ${item.id === match.id ? "border-[#d71920] bg-red-50" : "border-stone-200 hover:bg-stone-50"}`}><div className="font-bold">{item.team.name}</div><div className="mt-1 text-xs text-stone-500">vs {item.opponent.name} · {item.date.split("-").reverse().join("/")}</div></button>)}</div></aside>
    <div className="space-y-5">
      <section className="panel p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Scouting adversaire · {sample.length} match{sample.length > 1 ? "s" : ""}</p><h2 className="mt-2 text-3xl font-black">{match.team.name}</h2><p className="mt-1 text-sm text-stone-500">Match sélectionné : vs {match.opponent.name} · {match.competition}</p></div><div className="text-right"><div className="font-condensed text-4xl font-black">{match.team.points}–{match.opponent.points}</div><div className="mt-1 text-xs text-stone-500">{match.date.split("-").reverse().join("/")}</div></div></div><div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-4"><span className="mr-2 text-xs font-bold text-stone-500">ÉCHANTILLON</span>{([1, 3, 5, 10] as const).map((size) => <button key={size} onClick={() => setSampleSize(size)} className={`border px-3 py-1 text-xs font-bold ${sampleSize === size ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white"}`}>{size} match{size > 1 ? "s" : ""}</button>)}<span className="ml-auto text-xs text-stone-500">Les jauges affichent la moyenne des matchs disponibles.</span></div></section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ScoutingCard label="ORtg" value={formatMetric(metrics.ortg)} copy="Danger offensif si ≥ 115" tone={metrics.ortg >= 115 ? "threat" : metrics.ortg < 105 ? "opportunity" : "neutral"} />
        <ScoutingCard label="eFG%" value={`${formatMetric(metrics.efg)}%`} copy="Qualité globale des tirs" tone={metrics.efg >= 54.5 ? "threat" : metrics.efg < 50.5 ? "opportunity" : "neutral"} />
        <ScoutingCard label="TOV%" value={`${formatMetric(metrics.tov)}%`} copy="Ballons perdus exploitables" tone={metrics.tov >= 15 ? "opportunity" : metrics.tov < 12 ? "threat" : "neutral"} />
        <ScoutingCard label="ORB%" value={`${formatMetric(metrics.orb)}%`} copy="Pression au rebond offensif" tone={metrics.orb >= 33 ? "threat" : metrics.orb < 27 ? "opportunity" : "neutral"} />
      </section>
      <section className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-stone-200 p-5"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">Hiérarchie offensive</p><h3 className="mt-1 text-xl font-black">Joueurs à préparer</h3></div></div><Table><TableHeader><TableRow className="bg-stone-50"><TableHead>Joueur</TableHead><TableHead className="text-right">MIN</TableHead><TableHead className="text-right">PTS</TableHead><TableHead className="text-right">USG%</TableHead><TableHead className="text-right">TS%</TableHead><TableHead className="text-right">AST%</TableHead><TableHead className="text-right">TOV%</TableHead><TableHead className="text-right">ORtg*</TableHead></TableRow></TableHeader><TableBody>{players.map((player) => <TableRow key={player.id}><TableCell className="font-bold">{player.name}</TableCell><TableCell className="text-right">{player.minutes}</TableCell><TableCell className="text-right font-bold">{player.points}</TableCell><TableCell className="text-right">{formatMetric(player.usg)}</TableCell><TableCell className="text-right">{formatMetric(player.ts)}</TableCell><TableCell className="text-right">{formatMetric(player.astPct)}</TableCell><TableCell className="text-right">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right">{formatMetric(player.ortgEstimate)}</TableCell></TableRow>)}</TableBody></Table><p className="border-t border-stone-200 p-4 text-[11px] text-stone-500">* Estimation boxscore. Les couleurs du scouting signifient rouge = menace adverse, vert = opportunité JL.</p></section>
    </div>
  </div>;
}
