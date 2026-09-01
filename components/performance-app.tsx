"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  BarChart3,
  Camera,
  CalendarRange,
  Check,
  ChevronRight,
  CircleAlert,
  Cloud,
  Database,
  FileSearch,
  FileUp,
  Gauge,
  Info,
  Printer,
  Radio,
  RefreshCw,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { AdminAccess } from "@/components/admin-access";
import { ImportWorkflow } from "@/components/import-workflow";
import { JlHistoryPanel } from "@/components/jl-history-panel";
import { JlPerformanceDeepDive } from "@/components/jl-performance-deep-dive";
import { LiveMatchPanel } from "@/components/live-match-panel";
import { ScoutingPanel } from "@/components/scouting-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculatePlayerMetrics, calculateTeamMetrics, formatMetric, metricStatus, type MetricStatus } from "@/lib/stats/engine";
import { genevaMatch, playerReferences, teamTargets } from "@/lib/stats/demo-data";
import { draftToMatch, extractLnbBoxscore, validateOcrDraftForPublication, type OcrBoxscoreDraft } from "@/lib/ocr/lnb-boxscore";
import { loadLatestPublishedMatch, loadLiveMatches, loadPublishedMatches, loadScoutingMatches, saveImportedMatch, uploadBoxscoreFile } from "@/lib/supabase/match-store";
import type { MatchBoxscore, MetricTarget, PlayerMetrics, TeamMetrics } from "@/lib/stats/types";
import { detectJlBourgSide, type BoxscoreSide } from "@/lib/teams/jl-bourg";

const statusStyles: Record<MetricStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  good: { dot: "bg-emerald-600", text: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200", label: "Cible atteinte" },
  watch: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200", label: "À surveiller" },
  bad: { dot: "bg-[#d71920]", text: "text-[#a20e14]", bg: "bg-red-50", border: "border-red-200", label: "Sous la cible" },
  neutral: { dot: "bg-stone-300", text: "text-stone-600", bg: "bg-stone-50", border: "border-stone-200", label: "Sans cible" },
};

const metricValue = (metrics: TeamMetrics, key: string) => metrics[key as keyof TeamMetrics] as number;

function targetLabel(target: MetricTarget) {
  if (target.direction === "range") {
    const [low, high] = target.target as [number, number];
    return `${low}–${high}${target.unit === "%" ? "%" : ""}`;
  }
  return `${target.direction === "min" ? "≥" : "≤"} ${target.target}${target.unit === "%" ? "%" : ""}`;
}

function MetricGauge({ target, value }: { target: MetricTarget; value: number }) {
  const status = metricStatus(value, target);
  const styles = statusStyles[status];
  const position = Math.max(0, Math.min(100, ((value - target.min) / (target.max - target.min)) * 100));
  const threshold = Array.isArray(target.target)
    ? ((target.target[0] - target.min) / (target.max - target.min)) * 100
    : (((target.target as number) - target.min) / (target.max - target.min)) * 100;

  return (
    <article className={`metric-card border-l-[3px] ${styles.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-condensed text-sm font-black tracking-[0.12em]">{target.label}</span>
            <span className={`size-2 rounded-full ${styles.dot}`} />
          </div>
          <p className="mt-1 text-[11px] text-stone-500">cible {targetLabel(target)}</p>
        </div>
        <div className={`font-condensed text-3xl font-black tabular-nums ${styles.text}`}>
          {formatMetric(value)}{target.unit === "%" ? "%" : ""}
        </div>
      </div>
      <div className="relative mt-4 h-2 bg-stone-200">
        <div className={`absolute inset-y-0 left-0 ${styles.dot}`} style={{ width: `${position}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-stone-950" style={{ left: `${Math.max(0, Math.min(100, threshold))}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-stone-400">
        <span>{target.min}</span><span>{target.max}</span>
      </div>
    </article>
  );
}

const playerMetricKeys = [
  ["ts", "TS%"],
  ["efg", "eFG%"],
  ["usg", "USG%"],
  ["ast", "AST%"],
  ["tov", "TOV%"],
  ["orb", "ORB%"],
  ["trb", "TRB%"],
] as const;

function playerMetricValue(player: PlayerMetrics, key: (typeof playerMetricKeys)[number][0]) {
  const map = { ts: player.ts, efg: player.efg, usg: player.usg, ast: player.astPct, tov: player.tovPct, orb: player.orbPct, trb: player.trbPct };
  return map[key];
}

function PlayerDetail({ player }: { player: PlayerMetrics }) {
  const reference = playerReferences[player.id];
  const availableTargets = reference?.targets ?? {};

  return (
    <aside className="panel h-fit xl:sticky xl:top-5">
      <div className="border-b border-stone-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Analyse individuelle</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight">{player.name}</h3>
            <p className="mt-1 text-sm text-stone-500">{reference?.role ?? player.role}</p>
          </div>
          <div className="score-chip">{player.plusMinus > 0 ? "+" : ""}{player.plusMinus}</div>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 border-y border-stone-200 py-3 text-center">
          <Box label="MIN" value={player.minutes} />
          <Box label="PTS" value={String(player.points)} />
          <Box label="AST" value={String(player.ast)} />
          <Box label="REB" value={String(player.orb + player.drb)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-stone-200">
        {playerMetricKeys.map(([key, label]) => {
          const value = playerMetricValue(player, key);
          const target = availableTargets[key];
          const status = metricStatus(value, target);
          const styles = statusStyles[status];
          return (
            <div key={key} className="bg-white p-4">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-[0.08em] text-stone-500">
                <span>{label}</span><span className={`size-2 rounded-full ${styles.dot}`} />
              </div>
              <div className={`mt-1 text-2xl font-black tabular-nums ${styles.text}`}>{formatMetric(value)}%</div>
              <div className="mt-1 text-[10px] text-stone-400">{target ? `cible ${targetLabel(target)}` : "sans référentiel"}</div>
            </div>
          );
        })}
        <div className="bg-stone-950 p-4 text-white">
          <div className="text-[11px] font-bold tracking-[0.08em] text-stone-400">ORTG EST.</div>
          <div className="mt-1 text-2xl font-black tabular-nums">{formatMetric(player.ortgEstimate)}</div>
          <div className="mt-1 text-[10px] text-stone-500">proxy boxscore</div>
        </div>
        <div className="bg-stone-950 p-4 text-white">
          <div className="text-[11px] font-bold tracking-[0.08em] text-stone-400">DRTG EST.</div>
          <div className="mt-1 text-2xl font-black tabular-nums">{formatMetric(player.drtgEstimate)}</div>
          <div className="mt-1 text-[10px] text-stone-500">ancré sur l’équipe</div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-bold"><Info className="size-4 text-[#d71920]" /> Lecture rapide</div>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {player.id === "soliman"
            ? "Très forte pression sur la ligne et création utile. Le rebond reste le principal écart au référentiel sur ce match."
            : reference
              ? "Les pastilles comparent chaque indicateur au référentiel individuel du joueur."
              : "Le match est calculé, mais ce joueur n’a pas encore de référentiel individuel."}
        </p>
      </div>
    </aside>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-bold tracking-[0.1em] text-stone-400">{label}</div><div className="mt-1 font-black tabular-nums">{value}</div></div>;
}

function TeamPanel({ metrics, match, history }: { metrics: TeamMetrics; match: MatchBoxscore; history: MatchBoxscore[] }) {
  const statuses = teamTargets
    .filter((target) => target.key !== "fgast" || metrics.fgastValid)
    .map((target) => metricStatus(metricValue(metrics, target.key), target));
  const good = statuses.filter((status) => status === "good").length;
  const red = statuses.filter((status) => status === "bad").length;
  const reading = metrics.drtg <= 110 && metrics.ortg >= 115
    ? "Performance complète des deux côtés"
    : metrics.drtg <= 110
      ? "Défense solide, attaque à optimiser"
      : metrics.ortg >= 115
        ? "Attaque efficace, défense à stabiliser"
        : "Production à consolider des deux côtés";

  return (
    <div className="space-y-5">
      {!metrics.fgastValid && <section className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center gap-2 font-black"><CircleAlert className="size-4" /> FGAST% non interprétable</div><p className="mt-1 leading-6">La source indique {match.team.ast} passes décisives pour {match.team.fgm} paniers réussis, soit un ratio brut de {formatMetric(metrics.fgastRaw)}%. La valeur est conservée pour contrôle, mais exclue de la lecture de performance.</p></section>}
      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Lecture du match</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{reading}</h2>
            </div>
            <div className="flex gap-2">
              <span className="good-chip"><Check className="size-3.5" /> {good} cibles</span>
              <span className="bad-chip"><CircleAlert className="size-3.5" /> {red} alertes</span>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Insight icon={<ShieldCheck className="size-5" />} title="Impact défensif" value={`${formatMetric(metrics.drtg)} DRtg`} copy={`eFG% adverse ${formatMetric(metrics.oppEfg)}% · TOV% adverse ${formatMetric(metrics.oppTov)}%.`} tone={metrics.drtg <= 110 ? "good" : "bad"} />
            <Insight icon={<CircleAlert className="size-5" />} title="Sécurité de balle" value={`${formatMetric(metrics.tov)}% TOV`} copy={`${match.team.tov} pertes de balle · cible collective ≤ 14,5%.`} tone={metrics.tov <= 14.5 ? "good" : "bad"} />
            <Insight icon={<Target className="size-5" />} title="Différentiel" value={`${metrics.net > 0 ? "+" : ""}${formatMetric(metrics.net)} Net`} copy={`${formatMetric(metrics.ortg)} ORtg contre ${formatMetric(metrics.drtg)} DRtg.`} tone={metrics.net >= 7 ? "good" : metrics.net < 0 ? "bad" : "neutral"} />
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><p className="eyebrow">Score par quart-temps</p><h3 className="mt-2 text-lg font-black">Rythme du match</h3></div>
            <BarChart3 className="size-5 text-stone-400" />
          </div>
          <div className="mt-4 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={match.quarters} barGap={4}>
                <CartesianGrid stroke="#e7e3db" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                <YAxis axisLine={false} tickLine={false} fontSize={11} width={24} />
                <Tooltip contentStyle={{ border: "1px solid #d6d0c5", borderRadius: 0, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="team" name={match.team.name} fill="#d71920" radius={[2, 2, 0, 0]} />
                <Bar dataKey="opponent" name={match.opponent.name} fill="#222222" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div><p className="eyebrow">Baseline V0 · 2026–27</p><h2 className="mt-1 text-xl font-black">Jauges collectives</h2></div>
          <p className="hidden text-xs text-stone-500 sm:block">vert = atteint · orange = proche · rouge = écart</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {teamTargets.map((target) => target.key === "fgast" && !metrics.fgastValid
            ? <article key={target.key} className="border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="text-xs font-black uppercase tracking-[0.1em]">FGAST%</div><div className="mt-3 text-3xl font-black">À contrôler</div><p className="mt-2 text-xs">Ratio brut {formatMetric(metrics.fgastRaw)}% · donnée source incohérente</p></article>
            : <MetricGauge key={target.key} target={target} value={metricValue(metrics, target.key)} />)}
        </div>
      </section>

      <JlPerformanceDeepDive match={match} metrics={metrics} history={history} />
    </div>
  );
}

function Insight({ icon, title, value, copy, tone }: { icon: React.ReactNode; title: string; value: string; copy: string; tone: "good" | "bad" | "neutral" }) {
  const toneClass = tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : tone === "bad" ? "border-red-200 bg-red-50 text-red-900" : "border-stone-200 bg-stone-50 text-stone-900";
  return <div className={`border p-4 ${toneClass}`}><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]">{icon}{title}</div><div className="mt-3 text-xl font-black tabular-nums">{value}</div><p className="mt-2 text-xs leading-5 opacity-75">{copy}</p></div>;
}

function JlMatchPicker({ matches, selectedId, onSelect }: { matches: MatchBoxscore[]; selectedId: string; onSelect: (match: MatchBoxscore) => void }) {
  return <section className="panel print-hidden p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-2"><p className="eyebrow">Rapport individuel</p><h2 className="mt-1 text-lg font-black">Choisir un match JL</h2></div><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">{matches.map((item) => <button key={item.id} onClick={() => onSelect(item)} className={`min-w-48 border p-3 text-left ${item.id === selectedId ? "border-[#d71920] bg-red-50" : "border-stone-200 bg-white hover:bg-stone-50"}`}><div className="flex items-center justify-between gap-3"><span className="font-bold">vs {item.opponent.name}</span><span className={`font-condensed font-black ${item.team.points > item.opponent.points ? "text-emerald-700" : "text-[#d71920]"}`}>{item.team.points}–{item.opponent.points}</span></div><div className="mt-1 text-[10px] text-stone-500">{item.date.split("-").reverse().join("/")} · {item.sourceType === "live" ? "flux live" : "import"}</div></button>)}</div></div></section>;
}

export function PerformanceApp() {
  const [activeTab, setActiveTab] = useState("match");
  const [match, setMatch] = useState<MatchBoxscore>(genevaMatch);
  const [dataMode, setDataMode] = useState("Mode démo · boxscore validé");
  const [syncStatus, setSyncStatus] = useState("Démarrage…");
  const [adminAccess, setAdminAccess] = useState<{ user: User | null; isAdmin: boolean }>({ user: null, isAdmin: false });
  const [ocrDraft, setOcrDraft] = useState<OcrBoxscoreDraft | null>(null);
  const [importSource, setImportSource] = useState({ name: "", path: "" });
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState("");
  const [importAnalysisType, setImportAnalysisType] = useState<"jl" | "scouting">("scouting");
  const [importAnalyzedSide, setImportAnalyzedSide] = useState<BoxscoreSide>("home");
  const [detectedJlSide, setDetectedJlSide] = useState<BoxscoreSide | null>(null);
  const [scoutingMatches, setScoutingMatches] = useState<MatchBoxscore[]>([]);
  const [teamHistory, setTeamHistory] = useState<MatchBoxscore[]>([genevaMatch]);
  const [liveMatches, setLiveMatches] = useState<MatchBoxscore[]>([]);
  const [selectedJlMatchId, setSelectedJlMatchId] = useState(genevaMatch.id);
  const [selectedScoutingId, setSelectedScoutingId] = useState("");
  const selectedJlMatchIdRef = useRef(genevaMatch.id);
  const refreshInProgress = useRef(false);
  const metrics = useMemo(() => calculateTeamMetrics(match), [match]);
  const players = useMemo(() => calculatePlayerMetrics(match), [match]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("soliman");
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0];

  const refreshLatestMatch = useCallback(async (initial = false) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;

    try {
      const storedMatch = await loadLatestPublishedMatch();
      if (storedMatch) {
        setTeamHistory((current) => [storedMatch, ...current.filter((item) => item.id !== storedMatch.id)].slice(0, 10));
        if (initial || selectedJlMatchIdRef.current === storedMatch.id) {
          setMatch(storedMatch);
          setSelectedJlMatchId(storedMatch.id);
          selectedJlMatchIdRef.current = storedMatch.id;
          setSelectedPlayerId((current) => storedMatch.players.some((player) => player.id === current)
            ? current
            : (storedMatch.players[0]?.id ?? ""));
        }
        if (initial) setDataMode("Données publiques · Supabase");
        setSyncStatus(`Actualisé à ${new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`);
      } else if (initial) {
        setDataMode("Mode démo · aucun match publié dans Supabase");
        setSyncStatus("Aucun match publié");
      }
    } catch {
      if (initial) setDataMode("Mode démo · lecture Supabase indisponible");
      setSyncStatus("Synchronisation indisponible");
    } finally {
      refreshInProgress.current = false;
    }
  }, []);

  const refreshLiveMatches = useCallback(async () => {
    try {
      setLiveMatches(await loadLiveMatches());
    } catch {
      setSyncStatus("Flux live indisponible");
    }
  }, []);

  useEffect(() => {
    const loadHistory = window.setTimeout(() => {
      void loadPublishedMatches(10).then((storedMatches) => {
        if (storedMatches.length > 0) setTeamHistory(storedMatches);
      }).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(loadHistory);
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshLatestMatch(true), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshLatestMatch();
    }, 10_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshLatestMatch();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshLatestMatch]);

  useEffect(() => {
    const initialLiveRefresh = window.setTimeout(() => void refreshLiveMatches(), 0);
    const liveInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshLiveMatches();
    }, 10_000);
    return () => {
      window.clearTimeout(initialLiveRefresh);
      window.clearInterval(liveInterval);
    };
  }, [refreshLiveMatches]);

  useEffect(() => {
    const loadScouting = window.setTimeout(() => {
      void loadScoutingMatches().then((storedMatches) => {
        setScoutingMatches(storedMatches);
        setSelectedScoutingId(storedMatches[0]?.id ?? "");
      }).catch(() => setImportMessage("Historique scouting indisponible"));
    }, 0);
    return () => window.clearTimeout(loadScouting);
  }, []);

  const onAccessChange = useCallback((state: { user: User | null; isAdmin: boolean }) => {
    setAdminAccess(state);
  }, []);

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (!adminAccess.user || !adminAccess.isAdmin) {
      setDataMode("Import refusé · connexion administrateur requise");
      return;
    }
    setActiveTab("imports");
    setOcrDraft(null);
    setImportBusy(true);
    setImportProgress(0);
    setImportMessage("Enregistrement du document et démarrage de l’OCR…");
    setDataMode(`${file.name} · lecture en cours…`);
    try {
      const uploadPromise = uploadBoxscoreFile(file, adminAccess.user.id);
      if (!file.type.startsWith("image/")) {
        const result = await uploadPromise;
        setImportSource({ name: file.name, path: result.originalPath });
        setImportMessage("Le PDF est enregistré. Cette première version OCR traite les images PNG/JPEG ; exportez la page du boxscore en image pour l’extraire.");
        setDataMode(`${file.name} enregistré · conversion en image requise`);
        return;
      }
      const [result, extracted] = await Promise.all([
        uploadPromise,
        extractLnbBoxscore(file, (progress, status) => {
          setImportProgress(progress);
          setImportMessage(status === "recognizing text" ? "Reconnaissance des tableaux et des joueurs…" : "Préparation du moteur OCR…");
        }),
      ]);
      setImportSource({ name: file.name, path: result.originalPath });
      setOcrDraft(extracted);
      const jlSide = detectJlBourgSide(extracted);
      setDetectedJlSide(jlSide);
      setImportAnalysisType(jlSide ? "jl" : "scouting");
      setImportAnalyzedSide(jlSide ?? "home");
      setImportMessage("Extraction terminée · contrôlez les cellules signalées puis choisissez l’équipe à analyser.");
      setDataMode(result.convertedToPdf
        ? `${file.name} · OCR terminé · validation requise`
        : `${file.name} · OCR terminé · validation requise`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setImportMessage(`Échec de l’import : ${message}`);
      setDataMode(`Échec de l’import · ${message}`);
    } finally {
      setImportBusy(false);
    }
  };

  const selectJlMatch = useCallback((selected: MatchBoxscore, destination: "match" | "players" = "match") => {
    setMatch(selected);
    setSelectedJlMatchId(selected.id);
    selectedJlMatchIdRef.current = selected.id;
    setSelectedPlayerId(selected.players[0]?.id ?? "");
    setDataMode(`${selected.sourceType === "live" ? "Flux live" : "Import"} · match JL Bourg`);
    setActiveTab(destination);
  }, []);

  const validateImport = async (analysisType: "jl" | "scouting", side: BoxscoreSide) => {
    if (!ocrDraft) return;
    const publicationIssues = validateOcrDraftForPublication(ocrDraft, side);
    if (publicationIssues.length > 0) {
      setImportMessage(`Publication bloquée : ${publicationIssues.join(" ")}`);
      return;
    }
    setImportBusy(true);
    setImportMessage(`Enregistrement du ${analysisType === "jl" ? "match JL Bourg" : "rapport de scouting"} dans Supabase…`);
    try {
      const candidate = draftToMatch(ocrDraft, side);
      const stored = await saveImportedMatch(candidate, analysisType, importSource.name, importSource.path || null);
      if (analysisType === "jl") {
        setTeamHistory((current) => [stored, ...current.filter((item) => item.id !== stored.id)].slice(0, 10));
        selectJlMatch(stored);
        setDataMode(`${stored.team.name} · match JL Bourg publié`);
      } else {
        setScoutingMatches((current) => [stored, ...current.filter((item) => item.id !== stored.id)]);
        setSelectedScoutingId(stored.id);
        setDataMode(`${stored.team.name} · rapport de scouting publié`);
        setActiveTab("scouting");
      }
      setImportMessage("Rapport validé et publié.");
    } catch (error) {
      setImportMessage(error instanceof Error ? `Enregistrement impossible : ${error.message}` : "Enregistrement impossible");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f0e9] text-stone-950">
      <header className="print-hidden border-b-4 border-[#d71920] bg-stone-950 text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center bg-[#d71920] font-condensed text-lg font-black">JL</div>
            <div><div className="font-condensed text-lg font-black tracking-[0.04em]">PERFORMANCE LAB</div><div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">JL Bourg · Basketball analytics</div></div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className={`inline-flex h-9 items-center gap-2 border border-stone-700 px-3 text-xs font-bold ${adminAccess.isAdmin ? "cursor-pointer hover:bg-stone-900" : "cursor-not-allowed opacity-50"}`}>
              <Camera className="size-4" /> {adminAccess.isAdmin ? "Prendre une photo" : "Photo admin"}
              <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void handleImport(file);
              }} disabled={!adminAccess.isAdmin} />
            </label>
            <label className={`inline-flex h-9 items-center gap-2 border border-stone-700 px-3 text-xs font-bold ${adminAccess.isAdmin ? "cursor-pointer hover:bg-stone-900" : "cursor-not-allowed opacity-50"}`}>
              <FileUp className="size-4" /> {adminAccess.isAdmin ? "Choisir un fichier" : "Import admin"}
              <input type="file" className="sr-only" accept="image/*,.pdf,.csv,.xlsx" onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void handleImport(file);
              }} disabled={!adminAccess.isAdmin} />
            </label>
            <Button onClick={() => window.print()} className="h-9 rounded-none bg-[#d71920] px-3 text-xs font-bold hover:bg-[#b71017]">
              <Printer className="size-4" /> Exporter PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <section className="panel mb-5 overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_auto_1fr]">
            <div className="p-5 lg:p-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#d71920]"><span className="size-2 bg-[#d71920]" /> Match analysé</div>
              <div className="mt-3 flex items-end gap-4">
                <div><p className="text-xs text-stone-500">{match.competition} · {match.date.split("-").reverse().join("/")}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{match.team.name}</h1></div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 border-y border-stone-200 bg-stone-950 px-8 py-5 text-white lg:border-x lg:border-y-0">
              <span className="font-condensed text-5xl font-black tabular-nums">{match.team.points}</span><span className="text-stone-500">—</span><span className="font-condensed text-5xl font-black tabular-nums">{match.opponent.points}</span>
            </div>
            <div className="flex items-center justify-between gap-4 p-5 lg:justify-end lg:p-6">
              <div className="lg:text-right"><p className="text-xs text-stone-500">Adversaire</p><h2 className="mt-1 text-xl font-black">{match.opponent.name}</h2><p className="mt-2 text-xs text-stone-500">{dataMode}</p></div>
              <span className="good-chip"><Check className="size-3.5" /> Données cohérentes</span>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
          <TabsList variant="line" className="print-hidden w-full justify-start overflow-x-auto border-b border-stone-300 pb-0">
            <TabsTrigger value="live" className="flex-none px-3 pb-3"><Activity /> Live</TabsTrigger>
            <TabsTrigger value="match" className="flex-none px-3 pb-3"><Gauge /> Match JL</TabsTrigger>
            <TabsTrigger value="history" className="flex-none px-3 pb-3"><CalendarRange /> Historique</TabsTrigger>
            <TabsTrigger value="players" className="flex-none px-3 pb-3"><Users /> Joueurs</TabsTrigger>
            <TabsTrigger value="scouting" className="flex-none px-3 pb-3"><Radio /> Adversaires</TabsTrigger>
            <TabsTrigger value="imports" className="flex-none px-3 pb-3"><FileSearch /> Imports</TabsTrigger>
            <TabsTrigger value="references" className="flex-none px-3 pb-3"><Target /> Référentiels</TabsTrigger>
            <TabsTrigger value="data" className="flex-none px-3 pb-3"><Database /> Données</TabsTrigger>
          </TabsList>

          <TabsContent value="live"><LiveMatchPanel matches={liveMatches} onOpenMatch={(selected) => selectJlMatch(selected)} /></TabsContent>
          <TabsContent value="match"><div className="space-y-5"><JlMatchPicker matches={teamHistory} selectedId={selectedJlMatchId} onSelect={(selected) => selectJlMatch(selected)} /><TeamPanel metrics={metrics} match={match} history={teamHistory} /></div></TabsContent>
          <TabsContent value="history"><JlHistoryPanel matches={teamHistory} onOpenMatch={(selected) => selectJlMatch(selected)} /></TabsContent>
          <TabsContent value="scouting"><ScoutingPanel matches={scoutingMatches} selectedId={selectedScoutingId} onSelect={setSelectedScoutingId} /></TabsContent>
          <TabsContent value="imports"><ImportWorkflow draft={ocrDraft} sourceName={importSource.name} busy={importBusy} progress={importProgress} message={importMessage} analysisType={importAnalysisType} analyzedSide={importAnalyzedSide} detectedJlSide={detectedJlSide} onDraftChange={setOcrDraft} onAnalysisTypeChange={setImportAnalysisType} onAnalyzedSideChange={setImportAnalyzedSide} onValidate={validateImport} /></TabsContent>
          <TabsContent value="players">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="panel overflow-hidden">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 p-5">
                  <div><p className="eyebrow">Rotation · {players.length} joueurs</p><h2 className="mt-1 text-xl font-black">Performance individuelle</h2></div>
                  <p className="max-w-md text-xs leading-5 text-stone-500">AST% estim. contextualise les passes par les minutes sans connaître les rotations réelles. Sur un match isolé, privilégiez AST et AST/40.</p>
                </div>
                <Table>
                  <TableHeader><TableRow className="bg-stone-50"><TableHead>Joueur</TableHead><TableHead className="text-right">MIN</TableHead><TableHead className="text-right">PTS</TableHead><TableHead className="text-right">TS%</TableHead><TableHead className="text-right">USG%</TableHead><TableHead className="text-right">AST</TableHead><TableHead className="text-right">AST% estim.</TableHead><TableHead className="text-right">TOV%</TableHead><TableHead className="text-right">ORtg*</TableHead><TableHead className="text-right">DRtg*</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {players.map((player) => {
                      const ref = playerReferences[player.id];
                      const primaryStatus = metricStatus(player.ts, ref?.targets.ts);
                      return (
                        <TableRow key={player.id} onClick={() => setSelectedPlayerId(player.id)} data-state={player.id === selectedPlayer.id ? "selected" : undefined} className="cursor-pointer">
                          <TableCell><div className="flex items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${statusStyles[primaryStatus].dot}`} /><div><div className="font-bold">{player.name}</div><div className="max-w-[180px] truncate text-[10px] text-stone-400">{player.role}</div></div></div></TableCell>
                          <TableCell className="text-right tabular-nums">{player.minutes}</TableCell><TableCell className="text-right font-bold tabular-nums">{player.points}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.ts)}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.usg)}</TableCell><TableCell className="text-right font-bold tabular-nums">{player.ast}</TableCell><TableCell className={`text-right tabular-nums ${player.astPctLowSample ? "bg-amber-50 text-amber-800" : ""}`} title={`Estimation sur ${formatMetric(player.estimatedTeammateFieldGoals, 2)} paniers de coéquipiers`}><span aria-hidden="true">~</span>{formatMetric(player.astPct)}{player.astPctLowSample ? " ⚠" : ""}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.ortgEstimate)}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.drtgEstimate)}</TableCell><TableCell><ChevronRight className="size-4 text-stone-400" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="border-t border-stone-200 p-4 text-[11px] leading-5 text-stone-500">* Estimations boxscore, distinctes des ratings individuels « on/off ». Une attribution possession par possession nécessitera le play-by-play.</p>
              </section>
              <PlayerDetail player={selectedPlayer} />
            </div>
          </TabsContent>

          <TabsContent value="references">
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="panel p-6"><p className="eyebrow">Convention collective</p><h2 className="mt-2 text-2xl font-black">FGAST% et AST Ratio</h2><div className="mt-5 space-y-4 text-sm leading-6 text-stone-600"><p><strong className="text-stone-950">FGAST%</strong> mesure la part des tirs réussis qui ont été assistés. Sur ce match : <span className="font-bold text-stone-950">{match.team.ast} AST / {match.team.fgm} FGM = {formatMetric(metrics.fgastRaw)}%</span>. {!metrics.fgastValid && <span className="font-bold text-amber-700"> Cette valeur dépasse la limite physique de 100% : elle est signalée comme incohérence source et n’est pas interprétée.</span>}</p><p>Les tirs à 3 points sont inclus dans les <strong className="text-stone-950">FGM</strong>. Les lancers francs ne sont pas des paniers de champ et n’entrent donc pas dans ce ratio.</p><p><strong className="text-stone-950">AST Ratio</strong> rapporte les passes aux possessions estimées : <span className="font-bold text-stone-950">{formatMetric(metrics.astRatio)}</span> passes pour 100 possessions.</p></div></section>
              <section className="panel p-6"><p className="eyebrow">Convention individuelle</p><h2 className="mt-2 text-2xl font-black">AST% estimé par les minutes</h2><div className="mt-5 bg-stone-950 p-5 font-mono text-sm leading-7 text-white">AST% estim. = 100 × AST /<br />[(MP / 40 × Tm FGM) − FGM]</div><p className="mt-4 text-sm leading-6 text-stone-600">Sans rotations ni play-by-play, le dénominateur répartit les paniers collectifs au prorata des minutes. Une valeur très élevée sur un match court peut donc être mathématiquement correcte mais très volatile. L’application affiche désormais les passes brutes et l’AST/40 à côté de cette estimation.</p></section>
              <section className="panel p-6 lg:col-span-2"><div className="flex items-center gap-2"><Target className="size-5 text-[#d71920]" /><h2 className="text-xl font-black">Référentiels disponibles</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(playerReferences).map(([id, reference]) => { const player = match.players.find((item) => item.id === id) ?? genevaMatch.players.find((item) => item.id === id); return <div key={id} className="border border-stone-200 bg-stone-50 p-4"><div className="font-bold">{player?.name ?? id}</div><div className="mt-1 text-xs text-stone-500">{reference.season}</div><div className="mt-3 text-xs text-stone-600">{Object.keys(reference.targets).length} indicateurs ciblés</div></div>; })}</div></section>
            </div>
          </TabsContent>

          <TabsContent value="data">
            <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
              <section className="panel p-6"><p className="eyebrow">Pipeline d’un match</p><h2 className="mt-2 text-2xl font-black">De la feuille au rapport</h2><div className="mt-6 space-y-3">{[
                [Camera, "1. Import", "Photo mobile normalisée en PDF, PDF natif, CSV ou XLSX"],
                [Check, "2. Validation", "Contrôle des totaux, minutes et cohérence du score"],
                [Activity, "3. Calcul", "Métriques versionnées, collectives et individuelles"],
                [BarChart3, "4. Rapport", "Comparaison aux cibles et export imprimable"],
              ].map(([Icon, title, copy]) => { const StepIcon = Icon as typeof FileUp; return <div key={String(title)} className="flex gap-4 border border-stone-200 p-4"><div className="grid size-10 shrink-0 place-items-center bg-stone-950 text-white"><StepIcon className="size-4" /></div><div><div className="font-bold">{String(title)}</div><div className="mt-1 text-sm text-stone-500">{String(copy)}</div></div></div>; })}</div></section>
              <section className="panel p-6"><p className="eyebrow">Infrastructure</p><h2 className="mt-2 text-2xl font-black">Supabase connecté</h2><div className="mt-6 space-y-3"><StatusRow icon={<Database />} label="Schéma SQL" value="Actif" tone="good" /><StatusRow icon={<Cloud />} label="Connexion projet" value="Configurée" tone="good" /><StatusRow icon={<RefreshCw />} label="Rafraîchissement" value={`10 s · ${syncStatus}`} tone={syncStatus.startsWith("Actualisé") ? "good" : "watch"} /><StatusRow icon={<ShieldCheck />} label="Lecture publique" value="Rapports publiés uniquement" tone="good" /></div><div className="mt-6"><AdminAccess onAccessChange={onAccessChange} /></div><div className="mt-6 border-l-2 border-[#d71920] bg-red-50 p-4 text-sm leading-6 text-red-950">Les visiteurs peuvent consulter les matchs publiés. Seul un administrateur autorisé peut importer ou modifier des données.</div></section>
              <section className="panel p-6 lg:col-span-2">
                <div className="flex items-center gap-3"><Radio className="size-5 text-[#d71920]" /><div><p className="eyebrow">Données temps réel</p><h2 className="mt-1 text-2xl font-black">Connecteurs live à autoriser</h2></div></div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="border border-stone-200 p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-black">Betclic Élite</div><div className="mt-1 text-sm text-stone-500">Synergy Stats DataCore Streaming</div></div><span className="watch-chip">Accès requis</span></div><p className="mt-4 text-sm leading-6 text-stone-600">Flux d’événements live à normaliser avec un identifiant de match et des identifiants serveur fournis par la LNB ou Synergy.</p></div>
                  <div className="border border-stone-200 p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-black">EuroCup</div><div className="mt-1 text-sm text-stone-500">Sportradar Global Basketball</div></div><span className="watch-chip">Couverture à confirmer</span></div><p className="mt-4 text-sm leading-6 text-stone-600">Timeline ou Push Statistics selon le contrat. La clé reste côté serveur ; l’administrateur ne saisira que l’identifiant officiel du match.</p></div>
                </div>
                <p className="mt-4 text-xs leading-5 text-stone-500">Un flux push accélère l’affichage, mais un snapshot REST reste la source de réconciliation en cas de coupure.</p>
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function StatusRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: MetricStatus }) {
  const styles = statusStyles[tone];
  return <div className="flex items-center justify-between gap-4 border-b border-stone-200 py-3"><div className="flex items-center gap-3 text-sm font-bold [&_svg]:size-4">{icon}{label}</div><span className={`text-xs font-bold ${styles.text}`}>{value}</span></div>;
}
