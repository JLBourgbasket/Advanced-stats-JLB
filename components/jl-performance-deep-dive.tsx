"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  Target,
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
import { calculatePlayerMetrics, calculateTeamMetrics, formatMetric } from "@/lib/stats/engine";
import type { MatchBoxscore, PlayerMetrics, TeamMetrics } from "@/lib/stats/types";

type Tone = "good" | "watch" | "bad" | "neutral";

const pct = (made: number, attempted: number) => attempted > 0 ? (100 * made) / attempted : 0;

function toneClasses(tone: Tone) {
  if (tone === "good") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "bad") return "border-red-200 bg-red-50 text-red-950";
  if (tone === "watch") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-stone-200 bg-stone-50 text-stone-950";
}

function RatingCard({ label, value, copy, tone }: { label: string; value: string; copy: string; tone: Tone }) {
  const Icon = tone === "good" ? CheckCircle2 : tone === "bad" ? AlertTriangle : tone === "watch" ? Target : Gauge;
  return <article className={`border p-4 ${toneClasses(tone)}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.1em]">{label}</span><Icon className="size-4" /></div><div className="mt-3 font-condensed text-3xl font-black tabular-nums">{value}</div><p className="mt-2 text-xs leading-5 opacity-75">{copy}</p></article>;
}

function StatLine({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: Tone }) {
  const valueClass = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-800" : tone === "watch" ? "text-amber-700" : "text-stone-950";
  return <div className="flex items-center justify-between gap-3 border-b border-stone-200 py-2.5 last:border-0"><div><div className="text-xs font-bold">{label}</div>{note && <div className="mt-0.5 text-[10px] text-stone-400">{note}</div>}</div><span className={`font-condensed text-lg font-black tabular-nums ${valueClass}`}>{value}</span></div>;
}

function FactorRow({ label, jl, opponent, note, lowerIsBetter = false }: { label: string; jl: number; opponent: number; note: string; lowerIsBetter?: boolean }) {
  const maximum = Math.max(jl, opponent, 1) * 1.12;
  const jlWins = lowerIsBetter ? jl < opponent : jl > opponent;
  return <div className="border-b border-stone-200 py-3 last:border-0"><div className="mb-2 flex items-center justify-between gap-3"><div><span className="text-xs font-black">{label}</span><span className="ml-2 text-[10px] text-stone-400">{note}</span></div><div className="text-xs tabular-nums"><strong className={jlWins ? "text-emerald-700" : "text-[#d71920]"}>{formatMetric(jl)}%</strong><span className="mx-2 text-stone-300">/</span><strong>{formatMetric(opponent)}%</strong></div></div><div className="space-y-1"><div className="h-2 bg-stone-100"><div className={`h-full ${jlWins ? "bg-emerald-600" : "bg-[#d71920]"}`} style={{ width: `${(100 * jl) / maximum}%` }} /></div><div className="h-2 bg-stone-100"><div className="h-full bg-stone-800" style={{ width: `${(100 * opponent) / maximum}%` }} /></div></div></div>;
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { name?: string; usage?: number; efficiency?: number; minutes?: number; points?: number } }> }) {
  const player = payload?.[0]?.payload;
  if (!active || !player) return null;
  return <div className="border border-stone-300 bg-white p-3 text-xs shadow-lg"><div className="font-black">{player.name}</div><div className="mt-2 space-y-1 text-stone-600"><div>USG% : <strong>{formatMetric(player.usage ?? 0)}</strong></div><div>TS% : <strong>{formatMetric(player.efficiency ?? 0)}</strong></div><div>MIN : <strong>{formatMetric(player.minutes ?? 0)}</strong></div><div>PTS : <strong>{formatMetric(player.points ?? 0)}</strong></div></div></div>;
}

function buildSignals(metrics: TeamMetrics) {
  const positives: Array<{ title: string; detail: string; score: number }> = [];
  const workOns: Array<{ title: string; detail: string; score: number }> = [];
  if (metrics.drtg <= 110) positives.push({ title: "Défense dans la cible", detail: `${formatMetric(metrics.drtg)} points encaissés pour 100 possessions estimées.`, score: 110 - metrics.drtg });
  if (metrics.efg >= 54.5) positives.push({ title: "Qualité de tirs", detail: `${formatMetric(metrics.efg)}% d’eFG, au-dessus de la cible collective.`, score: metrics.efg - 54.5 });
  if (metrics.orb >= 33) positives.push({ title: "Présence au rebond offensif", detail: `${formatMetric(metrics.orb)}% des rebonds disponibles captés.`, score: metrics.orb - 33 });
  if (metrics.fgastValid && metrics.fgast >= 62) positives.push({ title: "Création collective", detail: `${formatMetric(metrics.fgast)}% des paniers de champ sont assistés.`, score: metrics.fgast - 62 });
  if (!metrics.fgastValid) workOns.push({ title: "Donnée de création à contrôler", detail: `Ratio brut ${formatMetric(metrics.fgastRaw)}% : davantage de passes décisives que de paniers réussis dans la source.`, score: 100 });
  if (metrics.tov > 14.5) workOns.push({ title: "Sécuriser la balle", detail: `${formatMetric(metrics.tov)}% de pertes de balle : cible ≤ 14,5%.`, score: metrics.tov - 14.5 });
  if (metrics.ts < 59) workOns.push({ title: "Rendement global", detail: `${formatMetric(metrics.ts)}% de TS contre une cible de 59%.`, score: 59 - metrics.ts });
  if (metrics.drb < 70) workOns.push({ title: "Finir les possessions", detail: `${formatMetric(metrics.drb)}% de rebonds défensifs sécurisés.`, score: 70 - metrics.drb });
  if (metrics.oppEfg > 52) workOns.push({ title: "Contestation des tirs", detail: `L’adversaire atteint ${formatMetric(metrics.oppEfg)}% d’eFG.`, score: metrics.oppEfg - 52 });
  if (positives.length === 0) positives.push({ title: "Base de travail", detail: "Aucune cible collective n’est nettement dépassée sur ce match.", score: 0 });
  if (workOns.length === 0) workOns.push({ title: "Match maîtrisé", detail: "Aucun indicateur majeur n’est nettement sous la cible.", score: 0 });
  return { positives: positives.sort((a, b) => b.score - a.score).slice(0, 3), workOns: workOns.sort((a, b) => b.score - a.score).slice(0, 3) };
}

function DetailedPlayers({ players }: { players: PlayerMetrics[] }) {
  return <section className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-stone-200 p-5"><Users className="size-5 text-[#d71920]" /><div><p className="eyebrow">Match sélectionné</p><h3 className="mt-1 text-xl font-black">Contribution individuelle complète</h3></div></div><div className="overflow-x-auto"><Table className="min-w-[1750px]"><TableHeader><TableRow className="bg-stone-50"><TableHead>Joueur</TableHead>{["MIN", "PTS", "REB", "USG%", "TS%", "eFG%", "2P%", "3P%", "3PAr", "FTr", "AST", "AST% estim.", "TOV%", "ORB%", "DRB%", "TRB%", "PTS/40", "REB/40", "AST/40", "ORtg*", "DRtg*", "+/−"].map((label) => <TableHead key={label} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{players.map((player) => { const twoPm = player.fgm - player.threePm; const twoPa = player.fga - player.threePa; return <TableRow key={player.id}><TableCell><div className="font-bold">{player.name}</div><div className="text-[10px] text-stone-400">{player.role}</div></TableCell><TableCell className="text-right">{player.minutes}</TableCell><TableCell className="text-right font-bold">{player.points}</TableCell><TableCell className="text-right">{player.orb + player.drb}</TableCell><TableCell className="text-right">{formatMetric(player.usg)}</TableCell><TableCell className="text-right">{formatMetric(player.ts)}</TableCell><TableCell className="text-right">{formatMetric(player.efg)}</TableCell><TableCell className="text-right">{formatMetric(pct(twoPm, twoPa))}</TableCell><TableCell className="text-right">{formatMetric(pct(player.threePm, player.threePa))}</TableCell><TableCell className="text-right">{formatMetric(player.threePar)}</TableCell><TableCell className="text-right">{formatMetric(player.ftr)}</TableCell><TableCell className="text-right font-bold">{player.ast}</TableCell><TableCell className={`text-right ${player.astPctLowSample ? "bg-amber-50 text-amber-800" : ""}`} title={`AST% estimé sur ${formatMetric(player.estimatedTeammateFieldGoals, 2)} paniers de coéquipiers`}><span aria-hidden="true">~</span>{formatMetric(player.astPct)}{player.astPctLowSample ? " ⚠" : ""}</TableCell><TableCell className="text-right">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right">{formatMetric(player.orbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.drbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.trbPct)}</TableCell><TableCell className="text-right">{formatMetric(player.pts40)}</TableCell><TableCell className="text-right">{formatMetric(player.reb40)}</TableCell><TableCell className="text-right">{formatMetric(player.ast40)}</TableCell><TableCell className="text-right">{formatMetric(player.ortgEstimate)}</TableCell><TableCell className="text-right">{formatMetric(player.drtgEstimate)}</TableCell><TableCell className="text-right">{player.plusMinus > 0 ? "+" : ""}{player.plusMinus}</TableCell></TableRow>; })}</TableBody></Table></div><p className="border-t border-stone-200 p-4 text-[11px] leading-5 text-stone-500">AST% estim. est contextualisé par les minutes sans rotations réelles ; « ~ » signale l’estimation et ⚠ un faible nombre d’opportunités. Sur un match isolé, privilégiez AST et AST/40. * ORtg/DRtg individuels = estimations boxscore, et non ratings on-court.</p></section>;
}

export function JlPerformanceDeepDive({ match, metrics, history }: { match: MatchBoxscore; metrics: TeamMetrics; history: MatchBoxscore[] }) {
  const players = calculatePlayerMetrics(match).filter((player) => player.minutesDecimal > 0).sort((a, b) => b.usg - a.usg);
  const relevantHistory = [match, ...history.filter((item) => item.id !== match.id)]
    .filter((item) => item.team.name === match.team.name)
    .slice(0, 10);
  const pace = metrics.possessions;
  const signals = buildSignals(metrics);
  const twoPointPoints = 2 * (match.team.fgm - match.team.threePm);
  const threePointPoints = 3 * match.team.threePm;
  const totalScoring = Math.max(1, twoPointPoints + threePointPoints + match.team.ftm);
  const shotData = [
    { zone: "2 pts", réussis: match.team.fgm - match.team.threePm, manqués: match.team.fga - match.team.threePa - match.team.fgm + match.team.threePm },
    { zone: "3 pts", réussis: match.team.threePm, manqués: match.team.threePa - match.team.threePm },
    { zone: "LF", réussis: match.team.ftm, manqués: match.team.fta - match.team.ftm },
  ];
  const trendData = [...relevantHistory].reverse().map((item) => {
    const itemMetrics = calculateTeamMetrics(item);
    return { date: item.date.slice(5).split("-").reverse().join("/"), ORtg: Number(itemMetrics.ortg.toFixed(1)), DRtg: Number(itemMetrics.drtg.toFixed(1)), Net: Number(itemMetrics.net.toFixed(1)) };
  });
  const playerMap = players.map((player) => ({ name: player.name, usage: Number(player.usg.toFixed(1)), efficiency: Number((player.ts ?? 0).toFixed(1)), minutes: player.minutesDecimal, points: player.points }));

  return <div className="space-y-5">
    <section><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Deep dive JL Bourg</p><h2 className="mt-1 text-xl font-black">Lecture avancée complète</h2></div><p className="text-xs text-stone-500">Match courant + historique des {relevantHistory.length} dernier{relevantHistory.length > 1 ? "s" : ""} match{relevantHistory.length > 1 ? "s" : ""} disponible{relevantHistory.length > 1 ? "s" : ""}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><RatingCard label="ORtg" value={formatMetric(metrics.ortg)} copy="Cible collective ≥ 115" tone={metrics.ortg >= 115 ? "good" : metrics.ortg >= 110 ? "watch" : "bad"} /><RatingCard label="DRtg" value={formatMetric(metrics.drtg)} copy="Cible collective ≤ 110" tone={metrics.drtg <= 110 ? "good" : metrics.drtg <= 115 ? "watch" : "bad"} /><RatingCard label="Net" value={`${metrics.net > 0 ? "+" : ""}${formatMetric(metrics.net)}`} copy="Cible collective ≥ +7" tone={metrics.net >= 7 ? "good" : metrics.net >= 0 ? "watch" : "bad"} /><RatingCard label="Rythme" value={formatMetric(pace)} copy="Possessions estimées" tone="neutral" /></div></section>

    <section className="grid gap-5 lg:grid-cols-2"><article className="panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><div><p className="eyebrow">Ce qui fonctionne</p><h3 className="mt-1 text-xl font-black">Points d’appui</h3></div></div><div className="mt-4 space-y-2">{signals.positives.map((signal, index) => <div key={signal.title} className="flex gap-3 border-l-4 border-emerald-500 bg-emerald-50 p-4"><span className="grid size-7 shrink-0 place-items-center bg-white text-xs font-black">{index + 1}</span><div><div className="text-sm font-black text-emerald-950">{signal.title}</div><p className="mt-1 text-xs leading-5 text-emerald-800">{signal.detail}</p></div></div>)}</div></article><article className="panel p-5"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-[#d71920]" /><div><p className="eyebrow">Priorités staff</p><h3 className="mt-1 text-xl font-black">Axes de progression</h3></div></div><div className="mt-4 space-y-2">{signals.workOns.map((signal, index) => <div key={signal.title} className="flex gap-3 border-l-4 border-[#d71920] bg-red-50 p-4"><span className="grid size-7 shrink-0 place-items-center bg-white text-xs font-black">{index + 1}</span><div><div className="text-sm font-black text-red-950">{signal.title}</div><p className="mt-1 text-xs leading-5 text-red-800">{signal.detail}</p></div></div>)}</div></article></section>

    <section className="grid gap-5 lg:grid-cols-2"><article className="panel p-5"><div className="flex items-center gap-2"><Zap className="size-5 text-[#d71920]" /><div><p className="eyebrow">Production</p><h3 className="mt-1 text-xl font-black">Identité offensive</h3></div></div><div className="mt-4 grid grid-cols-2 gap-x-5"><StatLine label="TS%" value={`${formatMetric(metrics.ts)}%`} note="cible ≥ 59%" tone={metrics.ts >= 59 ? "good" : "bad"} /><StatLine label="eFG%" value={`${formatMetric(metrics.efg)}%`} note="cible ≥ 54,5%" tone={metrics.efg >= 54.5 ? "good" : "bad"} /><StatLine label="2P%" value={`${formatMetric(metrics.twoPct)}%`} /><StatLine label="3P%" value={`${formatMetric(metrics.threePct)}%`} /><StatLine label="LF%" value={`${formatMetric(metrics.ftPct)}%`} /><StatLine label="3PAr" value={`${formatMetric(metrics.threePar)}%`} note="part des tirs à 3 pts" /><StatLine label="FTr" value={`${formatMetric(metrics.ftr)}%`} note="LF tentés / tirs tentés" /><StatLine label="FGAST%" value={metrics.fgastValid ? `${formatMetric(metrics.fgast)}%` : "À contrôler"} note={metrics.fgastValid ? "cible ≥ 62%" : `ratio brut ${formatMetric(metrics.fgastRaw)}%`} tone={metrics.fgastValid ? (metrics.fgast >= 62 ? "good" : "bad") : "bad"} /><StatLine label="AST Ratio" value={formatMetric(metrics.astRatio)} note="passes / 100 possessions" /><StatLine label="AST/TOV" value={formatMetric(metrics.astTov, 2)} /></div></article><article className="panel p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#d71920]" /><div><p className="eyebrow">Contrôle des possessions</p><h3 className="mt-1 text-xl font-black">Rebond, pertes et défense</h3></div></div><div className="mt-4 grid grid-cols-2 gap-x-5"><StatLine label="ORB%" value={`${formatMetric(metrics.orb)}%`} note="cible ≥ 33%" tone={metrics.orb >= 33 ? "good" : "bad"} /><StatLine label="DRB%" value={`${formatMetric(metrics.drb)}%`} note="cible ≥ 70%" tone={metrics.drb >= 70 ? "good" : "bad"} /><StatLine label="TOV%" value={`${formatMetric(metrics.tov)}%`} note="cible ≤ 14,5%" tone={metrics.tov <= 14.5 ? "good" : "bad"} /><StatLine label="OPP TOV%" value={`${formatMetric(metrics.oppTov)}%`} note="cible ≥ 15%" tone={metrics.oppTov >= 15 ? "good" : "bad"} /><StatLine label="STL%" value={`${formatMetric(metrics.stlRate)}%`} /><StatLine label="BLK% 2 pts" value={`${formatMetric(metrics.blkRate)}%`} /><StatLine label="OPP TS%" value={`${formatMetric(metrics.oppTs)}%`} /><StatLine label="OPP eFG%" value={`${formatMetric(metrics.oppEfg)}%`} note="cible ≤ 52%" tone={metrics.oppEfg <= 52 ? "good" : "bad"} /><StatLine label="OPP ORB%" value={`${formatMetric(metrics.oppOrb)}%`} note="cible ≤ 30%" tone={metrics.oppOrb <= 30 ? "good" : "bad"} /><StatLine label="OPP FTr" value={`${formatMetric(metrics.oppFtr)}%`} /></div></article></section>

    <section className="grid gap-5 lg:grid-cols-2"><article className="panel p-5"><div className="flex items-center gap-2"><Gauge className="size-5 text-[#d71920]" /><div><p className="eyebrow">JL Bourg contre adversaire</p><h3 className="mt-1 text-xl font-black">Four Factors</h3></div></div><div className="mt-4"><div className="mb-2 flex justify-end gap-4 text-[10px] font-bold"><span className="text-[#d71920]">JL BOURG</span><span>ADVERSAIRE</span></div><FactorRow label="eFG%" jl={metrics.efg} opponent={metrics.oppEfg} note="adresse effective" /><FactorRow label="TOV%" jl={metrics.tov} opponent={metrics.oppTov} note="plus bas = mieux" lowerIsBetter /><FactorRow label="ORB%" jl={metrics.orb} opponent={metrics.oppOrb} note="rebond offensif" /><FactorRow label="FTr" jl={metrics.ftr} opponent={metrics.oppFtr} note="accès aux lancers" /></div></article><article className="panel p-5"><div className="flex items-center gap-2"><BarChart3 className="size-5 text-[#d71920]" /><div><p className="eyebrow">Match sélectionné</p><h3 className="mt-1 text-xl font-black">Profil de tirs et répartition des points</h3></div></div><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={shotData}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="zone" axisLine={false} tickLine={false} fontSize={11} /><YAxis axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="réussis" stackId="shots" fill="#d71920" /><Bar dataKey="manqués" stackId="shots" fill="#d6d0c5" /></BarChart></ResponsiveContainer></div><div className="mt-2 flex h-3 overflow-hidden"><div className="bg-stone-800" style={{ width: `${(100 * twoPointPoints) / totalScoring}%` }} /><div className="bg-[#d71920]" style={{ width: `${(100 * threePointPoints) / totalScoring}%` }} /><div className="bg-amber-500" style={{ width: `${(100 * match.team.ftm) / totalScoring}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-bold text-stone-500"><span>2 pts {formatMetric((100 * twoPointPoints) / totalScoring)}%</span><span>3 pts {formatMetric((100 * threePointPoints) / totalScoring)}%</span><span>LF {formatMetric((100 * match.team.ftm) / totalScoring)}%</span></div></article></section>

    <section className="grid gap-5 lg:grid-cols-2"><article className="panel p-5"><div className="flex items-center gap-2"><TrendingUp className="size-5 text-[#d71920]" /><div><p className="eyebrow">Historique JL Bourg</p><h3 className="mt-1 text-xl font-black">Évolution des ratings</h3></div></div>{trendData.length > 1 ? <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid stroke="#e7e3db" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} /><YAxis domain={[80, 140]} axisLine={false} tickLine={false} fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine y={115} stroke="#d71920" strokeDasharray="4 4" /><ReferenceLine y={110} stroke="#78716c" strokeDasharray="4 4" /><Line type="monotone" dataKey="ORtg" stroke="#d71920" strokeWidth={3} /><Line type="monotone" dataKey="DRtg" stroke="#292524" strokeWidth={3} /><Line type="monotone" dataKey="Net" stroke="#d4a64a" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <div className="mt-4 grid h-72 place-items-center border border-dashed border-stone-300 bg-stone-50 px-8 text-center text-sm leading-6 text-stone-500">La tendance apparaîtra automatiquement dès qu’un deuxième match JL Bourg sera publié.</div>}</article><article className="panel p-5"><div className="flex items-center gap-2"><Users className="size-5 text-[#d71920]" /><div><p className="eyebrow">Usage × efficacité</p><h3 className="mt-1 text-xl font-black">Cartographie des responsabilités</h3></div></div><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 0 }}><CartesianGrid stroke="#e7e3db" /><XAxis type="number" dataKey="usage" name="USG%" unit="%" domain={[0, "dataMax + 5"]} fontSize={11} label={{ value: "USG%", position: "insideBottom", offset: -10 }} /><YAxis type="number" dataKey="efficiency" name="TS%" unit="%" domain={[20, 100]} fontSize={11} /><ZAxis type="number" dataKey="minutes" range={[70, 500]} /><ReferenceLine y={57} stroke="#d71920" strokeDasharray="4 4" /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTooltip />} /><Scatter data={playerMap} fill="#d71920" /></ScatterChart></ResponsiveContainer></div><p className="mt-2 text-xs text-stone-500">La taille des points représente les minutes jouées. La ligne rouge situe un TS% de 57%.</p></article></section>

    <DetailedPlayers players={players} />

    <section className="panel p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#d71920]" /><div><p className="eyebrow">Périmètre</p><h3 className="mt-1 text-xl font-black">Qualité et limites de l’analyse</h3></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><strong>Disponible :</strong> efficacité, création, rebonds, pertes, rythme, ratings estimés et comparaison aux cibles.</div><div className="border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>À interpréter :</strong> un match isolé décrit une performance, pas encore une tendance stable.</div><div className="border border-stone-300 bg-stone-50 p-4 text-xs leading-5 text-stone-600"><strong>Play-by-play requis :</strong> lineups, on/off, zones de tirs, transition et séquences tactiques.</div></div></section>
  </div>;
}
