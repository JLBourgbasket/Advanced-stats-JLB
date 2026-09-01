"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
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
  LoaderCircle,
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
import { DeleteMatchButton } from "@/components/delete-match-button";
import { ImportWorkflow } from "@/components/import-workflow";
import { LanguageToggle, useI18n } from "@/components/i18n-provider";
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
import { deleteStoredMatch, loadLatestPublishedMatch, loadLiveMatches, loadPublishedMatches, loadScoutingMatches, saveImportedMatch, uploadBoxscoreFile } from "@/lib/supabase/match-store";
import type { MatchBoxscore, MetricTarget, PlayerMetrics, TeamMetrics } from "@/lib/stats/types";
import { detectJlBourgSide, type BoxscoreSide } from "@/lib/teams/jl-bourg";

const statusStyles: Record<MetricStatus, { dot: string; text: string; bg: string; border: string; label: string }> = {
  good: { dot: "bg-emerald-600", text: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200", label: "Cible atteinte" },
  watch: { dot: "bg-amber-500", text: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200", label: "À surveiller" },
  bad: { dot: "bg-[#d71920]", text: "text-[#a20e14]", bg: "bg-red-50", border: "border-red-200", label: "Sous la cible" },
  neutral: { dot: "bg-stone-300", text: "text-stone-600", bg: "bg-stone-50", border: "border-stone-200", label: "Sans cible" },
};

const metricValue = (metrics: TeamMetrics, key: string) => metrics[key as keyof TeamMetrics] as number;
const isStoredMatchId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function targetLabel(target: MetricTarget) {
  if (target.direction === "range") {
    const [low, high] = target.target as [number, number];
    return `${low}–${high}${target.unit === "%" ? "%" : ""}`;
  }
  return `${target.direction === "min" ? "≥" : "≤"} ${target.target}${target.unit === "%" ? "%" : ""}`;
}

function MetricGauge({ target, value }: { target: MetricTarget; value: number }) {
  const { tr } = useI18n();
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
          <p className="mt-1 text-[11px] text-stone-500">{tr("cible", "target")} {targetLabel(target)}</p>
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
  const { tr } = useI18n();
  const reference = playerReferences[player.id];
  const availableTargets = reference?.targets ?? {};

  return (
    <aside className="panel h-fit xl:sticky xl:top-5">
      <div className="border-b border-stone-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{tr("Analyse individuelle", "Player analysis")}</p>
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
              <div className="mt-1 text-[10px] text-stone-400">{target ? `${tr("cible", "target")} ${targetLabel(target)}` : tr("sans référentiel", "no benchmark")}</div>
            </div>
          );
        })}
        <div className="bg-stone-950 p-4 text-white">
          <div className="text-[11px] font-bold tracking-[0.08em] text-stone-400">ORTG EST.</div>
          <div className="mt-1 text-2xl font-black tabular-nums">{formatMetric(player.ortgEstimate)}</div>
          <div className="mt-1 text-[10px] text-stone-500">{tr("proxy boxscore", "boxscore proxy")}</div>
        </div>
        <div className="bg-stone-950 p-4 text-white">
          <div className="text-[11px] font-bold tracking-[0.08em] text-stone-400">DRTG EST.</div>
          <div className="mt-1 text-2xl font-black tabular-nums">{formatMetric(player.drtgEstimate)}</div>
          <div className="mt-1 text-[10px] text-stone-500">{tr("ancré sur l’équipe", "team-anchored")}</div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-bold"><Info className="size-4 text-[#d71920]" /> {tr("Lecture rapide", "Quick read")}</div>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {player.id === "soliman"
            ? tr("Très forte pression sur la ligne et création utile. Le rebond reste le principal écart au référentiel sur ce match.", "Strong pressure at the foul line and useful creation. Rebounding remains the main gap versus the benchmark in this game.")
            : reference
              ? tr("Les pastilles comparent chaque indicateur au référentiel individuel du joueur.", "The dots compare each metric with the player’s individual benchmark.")
              : tr("Le match est calculé, mais ce joueur n’a pas encore de référentiel individuel.", "The game is calculated, but this player does not have an individual benchmark yet.")}
        </p>
      </div>
    </aside>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-bold tracking-[0.1em] text-stone-400">{label}</div><div className="mt-1 font-black tabular-nums">{value}</div></div>;
}

function TeamPanel({ metrics, match, history }: { metrics: TeamMetrics; match: MatchBoxscore; history: MatchBoxscore[] }) {
  const { tr } = useI18n();
  const statuses = teamTargets
    .filter((target) => target.key !== "fgast" || metrics.fgastValid)
    .map((target) => metricStatus(metricValue(metrics, target.key), target));
  const good = statuses.filter((status) => status === "good").length;
  const red = statuses.filter((status) => status === "bad").length;
  const reading = metrics.drtg <= 110 && metrics.ortg >= 115
    ? tr("Performance complète des deux côtés", "Complete two-way performance")
    : metrics.drtg <= 110
      ? tr("Défense solide, attaque à optimiser", "Solid defense, offense to optimize")
      : metrics.ortg >= 115
        ? tr("Attaque efficace, défense à stabiliser", "Efficient offense, defense to stabilize")
        : tr("Production à consolider des deux côtés", "Production to improve on both ends");

  return (
    <div className="space-y-5">
      {!metrics.fgastValid && <section className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center gap-2 font-black"><CircleAlert className="size-4" /> {tr("FGAST% non interprétable", "FGAST% cannot be interpreted")}</div><p className="mt-1 leading-6">{tr(`La source indique ${match.team.ast} passes décisives pour ${match.team.fgm} paniers réussis, soit un ratio brut de ${formatMetric(metrics.fgastRaw)}%. La valeur est conservée pour contrôle, mais exclue de la lecture de performance.`, `The source reports ${match.team.ast} assists for ${match.team.fgm} made field goals, a raw ratio of ${formatMetric(metrics.fgastRaw)}%. The value is retained for review but excluded from performance analysis.`)}</p></section>}
      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{tr("Lecture du match", "Game analysis")}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{reading}</h2>
            </div>
            <div className="flex gap-2">
              <span className="good-chip"><Check className="size-3.5" /> {good} {tr("cibles", "targets")}</span>
              <span className="bad-chip"><CircleAlert className="size-3.5" /> {red} {tr("alertes", "alerts")}</span>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Insight icon={<ShieldCheck className="size-5" />} title={tr("Impact défensif", "Defensive impact")} value={`${formatMetric(metrics.drtg)} DRtg`} copy={tr(`eFG% adverse ${formatMetric(metrics.oppEfg)}% · TOV% adverse ${formatMetric(metrics.oppTov)}%.`, `Opponent eFG% ${formatMetric(metrics.oppEfg)}% · opponent TOV% ${formatMetric(metrics.oppTov)}%.`)} tone={metrics.drtg <= 110 ? "good" : "bad"} />
            <Insight icon={<CircleAlert className="size-5" />} title={tr("Sécurité de balle", "Ball security")} value={`${formatMetric(metrics.tov)}% TOV`} copy={tr(`${match.team.tov} pertes de balle · cible collective ≤ 14,5%.`, `${match.team.tov} turnovers · team target ≤ 14.5%.`)} tone={metrics.tov <= 14.5 ? "good" : "bad"} />
            <Insight icon={<Target className="size-5" />} title={tr("Différentiel", "Differential")} value={`${metrics.net > 0 ? "+" : ""}${formatMetric(metrics.net)} Net`} copy={tr(`${formatMetric(metrics.ortg)} ORtg contre ${formatMetric(metrics.drtg)} DRtg.`, `${formatMetric(metrics.ortg)} ORtg versus ${formatMetric(metrics.drtg)} DRtg.`)} tone={metrics.net >= 7 ? "good" : metrics.net < 0 ? "bad" : "neutral"} />
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div><p className="eyebrow">{tr("Score par quart-temps", "Score by quarter")}</p><h3 className="mt-2 text-lg font-black">{tr("Rythme du match", "Game flow")}</h3></div>
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
          <div><p className="eyebrow">Baseline V0 · 2026–27</p><h2 className="mt-1 text-xl font-black">{tr("Jauges collectives", "Team gauges")}</h2></div>
          <p className="hidden text-xs text-stone-500 sm:block">{tr("vert = atteint · orange = proche · rouge = écart", "green = met · orange = close · red = gap")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {teamTargets.map((target) => target.key === "fgast" && !metrics.fgastValid
            ? <article key={target.key} className="border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="text-xs font-black uppercase tracking-[0.1em]">FGAST%</div><div className="mt-3 text-3xl font-black">{tr("À contrôler", "Review required")}</div><p className="mt-2 text-xs">{tr(`Ratio brut ${formatMetric(metrics.fgastRaw)}% · donnée source incohérente`, `Raw ratio ${formatMetric(metrics.fgastRaw)}% · inconsistent source data`)}</p></article>
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

function JlMatchPicker({ matches, selectedId, onSelect, canDelete, onDelete }: { matches: MatchBoxscore[]; selectedId: string; onSelect: (match: MatchBoxscore) => void; canDelete: boolean; onDelete: (match: MatchBoxscore) => void }) {
  const { tr } = useI18n();
  return <section className="panel print-hidden p-4"><div className="flex flex-wrap items-center gap-3"><div className="mr-2"><p className="eyebrow">{tr("Rapport individuel", "Single-game report")}</p><h2 className="mt-1 text-lg font-black">{tr("Choisir un match JL", "Select a JL game")}</h2></div><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">{matches.map((item) => <div key={item.id} className={`flex min-w-52 items-start border ${item.id === selectedId ? "border-[#d71920] bg-red-50" : "border-stone-200 bg-white hover:bg-stone-50"}`}><button type="button" onClick={() => onSelect(item)} className="min-w-0 flex-1 p-3 text-left"><div className="flex items-center justify-between gap-3"><span className="font-bold">vs {item.opponent.name}</span><span className={`font-condensed font-black ${item.team.points > item.opponent.points ? "text-emerald-700" : "text-[#d71920]"}`}>{item.team.points}–{item.opponent.points}</span></div><div className="mt-1 text-[10px] text-stone-500">{item.date.split("-").reverse().join("/")} · {item.sourceType === "live" ? tr("flux live", "live feed") : tr("import", "import")}</div></button>{canDelete && isStoredMatchId(item.id) && <div className="p-1.5"><DeleteMatchButton label={tr(`${item.team.name} contre ${item.opponent.name}`, `${item.team.name} versus ${item.opponent.name}`)} onDelete={() => onDelete(item)} /></div>}</div>)}</div></div></section>;
}

export function PerformanceApp() {
  const { tr, locale } = useI18n();
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
  const [pendingDeletion, setPendingDeletion] = useState<{ match: MatchBoxscore; type: "jl" | "scouting" } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
        if (initial) setDataMode(tr("Données publiques · Supabase", "Public data · Supabase"));
        setSyncStatus(`${tr("Actualisé à", "Updated at")} ${new Date().toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`);
      } else if (initial) {
        setDataMode(tr("Mode démo · aucun match publié dans Supabase", "Demo mode · no game published in Supabase"));
        setSyncStatus(tr("Aucun match publié", "No published game"));
      }
    } catch {
      if (initial) setDataMode(tr("Mode démo · lecture Supabase indisponible", "Demo mode · Supabase unavailable"));
      setSyncStatus(tr("Synchronisation indisponible", "Sync unavailable"));
    } finally {
      refreshInProgress.current = false;
    }
  }, [locale, tr]);

  const refreshLiveMatches = useCallback(async () => {
    try {
      setLiveMatches(await loadLiveMatches());
    } catch {
      setSyncStatus(tr("Flux live indisponible", "Live feed unavailable"));
    }
  }, [tr]);

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
      }).catch(() => setImportMessage(tr("Historique scouting indisponible", "Scouting history unavailable")));
    }, 0);
    return () => window.clearTimeout(loadScouting);
  }, [tr]);

  const onAccessChange = useCallback((state: { user: User | null; isAdmin: boolean }) => {
    setAdminAccess(state);
  }, []);

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (!adminAccess.user || !adminAccess.isAdmin) {
      setDataMode(tr("Import refusé · connexion administrateur requise", "Import denied · administrator login required"));
      return;
    }
    setActiveTab("imports");
    setOcrDraft(null);
    setImportBusy(true);
    setImportProgress(0);
    setImportMessage(tr("Enregistrement du document et démarrage de l’OCR…", "Saving document and starting OCR…"));
    setDataMode(`${file.name} · ${tr("lecture en cours…", "processing…")}`);
    try {
      const uploadPromise = uploadBoxscoreFile(file, adminAccess.user.id);
      if (!file.type.startsWith("image/")) {
        const result = await uploadPromise;
        setImportSource({ name: file.name, path: result.originalPath });
        setImportMessage(tr("Le PDF est enregistré. Cette première version OCR traite les images PNG/JPEG ; exportez la page du boxscore en image pour l’extraire.", "The PDF is saved. This OCR version processes PNG/JPEG images; export the boxscore page as an image to extract it."));
        setDataMode(`${file.name} · ${tr("conversion en image requise", "image conversion required")}`);
        return;
      }
      const [result, extracted] = await Promise.all([
        uploadPromise,
        extractLnbBoxscore(file, (progress, status) => {
          setImportProgress(progress);
          setImportMessage(status === "recognizing text" ? tr("Reconnaissance des tableaux et des joueurs…", "Recognizing tables and players…") : tr("Préparation du moteur OCR…", "Preparing OCR engine…"));
        }),
      ]);
      setImportSource({ name: file.name, path: result.originalPath });
      setOcrDraft(extracted);
      const jlSide = detectJlBourgSide(extracted);
      setDetectedJlSide(jlSide);
      setImportAnalysisType(jlSide ? "jl" : "scouting");
      setImportAnalyzedSide(jlSide ?? "home");
      setImportMessage(tr("Extraction terminée · contrôlez les cellules signalées puis choisissez l’équipe à analyser.", "Extraction complete · review flagged cells, then select the team to analyze."));
      setDataMode(result.convertedToPdf
        ? `${file.name} · ${tr("OCR terminé · validation requise", "OCR complete · validation required")}`
        : `${file.name} · ${tr("OCR terminé · validation requise", "OCR complete · validation required")}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr("Erreur inconnue", "Unknown error");
      setImportMessage(`${tr("Échec de l’import", "Import failed")} : ${message}`);
      setDataMode(`${tr("Échec de l’import", "Import failed")} · ${message}`);
    } finally {
      setImportBusy(false);
    }
  };

  const selectJlMatch = useCallback((selected: MatchBoxscore, destination: "match" | "players" = "match") => {
    setMatch(selected);
    setSelectedJlMatchId(selected.id);
    selectedJlMatchIdRef.current = selected.id;
    setSelectedPlayerId(selected.players[0]?.id ?? "");
    setDataMode(`${selected.sourceType === "live" ? tr("Flux live", "Live feed") : tr("Import", "Import")} · ${tr("match JL Bourg", "JL Bourg game")}`);
    setActiveTab(destination);
  }, [tr]);

  const requestMatchDeletion = useCallback((target: MatchBoxscore, type: "jl" | "scouting") => {
    if (!adminAccess.isAdmin || !isStoredMatchId(target.id)) return;
    setDeleteError("");
    setPendingDeletion({ match: target, type });
  }, [adminAccess.isAdmin]);

  const confirmMatchDeletion = async () => {
    if (!pendingDeletion || !adminAccess.isAdmin || deleteBusy) return;
    const target = pendingDeletion;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const result = await deleteStoredMatch(target.match.id);
      setLiveMatches((current) => current.filter((item) => item.id !== target.match.id));

      if (target.type === "jl") {
        const remaining = teamHistory.filter((item) => item.id !== target.match.id);
        setTeamHistory(remaining);
        if (selectedJlMatchIdRef.current === target.match.id) {
          const next = remaining[0] ?? genevaMatch;
          setMatch(next);
          setSelectedJlMatchId(next.id);
          selectedJlMatchIdRef.current = next.id;
          setSelectedPlayerId(next.players[0]?.id ?? "");
        }
      } else {
        const remaining = scoutingMatches.filter((item) => item.id !== target.match.id);
        setScoutingMatches(remaining);
        if (selectedScoutingId === target.match.id) setSelectedScoutingId(remaining[0]?.id ?? "");
      }

      setDataMode(result.fileCleanupWarning
        ? `${target.match.team.name} – ${target.match.opponent.name} ${tr("supprimé", "deleted")} · ${result.fileCleanupWarning}`
        : `${target.match.team.name} – ${target.match.opponent.name} ${tr("supprimé définitivement", "permanently deleted")}`);
      setPendingDeletion(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : tr("La suppression a échoué.", "Deletion failed."));
    } finally {
      setDeleteBusy(false);
    }
  };

  const validateImport = async (analysisType: "jl" | "scouting", side: BoxscoreSide) => {
    if (!ocrDraft) return;
    const publicationIssues = validateOcrDraftForPublication(ocrDraft, side);
    if (publicationIssues.length > 0) {
      setImportMessage(`${tr("Publication bloquée", "Publication blocked")} : ${publicationIssues.join(" ")}`);
      return;
    }
    setImportBusy(true);
    setImportMessage(tr(`Enregistrement du ${analysisType === "jl" ? "match JL Bourg" : "rapport de scouting"} dans Supabase…`, `Saving the ${analysisType === "jl" ? "JL Bourg game" : "scouting report"} to Supabase…`));
    try {
      const candidate = draftToMatch(ocrDraft, side);
      const stored = await saveImportedMatch(candidate, analysisType, importSource.name, importSource.path || null);
      if (analysisType === "jl") {
        setTeamHistory((current) => [stored, ...current.filter((item) => item.id !== stored.id)].slice(0, 10));
        selectJlMatch(stored);
        setDataMode(`${stored.team.name} · ${tr("match JL Bourg publié", "JL Bourg game published")}`);
      } else {
        setScoutingMatches((current) => [stored, ...current.filter((item) => item.id !== stored.id)]);
        setSelectedScoutingId(stored.id);
        setDataMode(`${stored.team.name} · ${tr("rapport de scouting publié", "scouting report published")}`);
        setActiveTab("scouting");
      }
      setImportMessage(tr("Rapport validé et publié.", "Report validated and published."));
    } catch (error) {
      setImportMessage(error instanceof Error ? `${tr("Enregistrement impossible", "Unable to save")} : ${error.message}` : tr("Enregistrement impossible", "Unable to save"));
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
            <LanguageToggle />
            {adminAccess.isAdmin && <span className="inline-flex h-9 items-center gap-2 border border-emerald-700 bg-emerald-950/40 px-3 text-xs font-bold text-emerald-300"><ShieldCheck className="size-4" /> {tr("Administration active", "Admin active")}</span>}
            <label className={`inline-flex h-9 items-center gap-2 border border-stone-700 px-3 text-xs font-bold ${adminAccess.isAdmin ? "cursor-pointer hover:bg-stone-900" : "cursor-not-allowed opacity-50"}`}>
              <Camera className="size-4" /> {adminAccess.isAdmin ? tr("Prendre une photo", "Take a photo") : tr("Photo admin", "Admin photo")}
              <input type="file" className="sr-only" accept="image/*" capture="environment" onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void handleImport(file);
              }} disabled={!adminAccess.isAdmin} />
            </label>
            <label className={`inline-flex h-9 items-center gap-2 border border-stone-700 px-3 text-xs font-bold ${adminAccess.isAdmin ? "cursor-pointer hover:bg-stone-900" : "cursor-not-allowed opacity-50"}`}>
              <FileUp className="size-4" /> {adminAccess.isAdmin ? tr("Choisir un fichier", "Choose file") : tr("Import admin", "Admin import")}
              <input type="file" className="sr-only" accept="image/*,.pdf,.csv,.xlsx" onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void handleImport(file);
              }} disabled={!adminAccess.isAdmin} />
            </label>
            <Button onClick={() => window.print()} className="h-9 rounded-none bg-[#d71920] px-3 text-xs font-bold hover:bg-[#b71017]">
              <Printer className="size-4" /> {tr("Exporter PDF", "Export PDF")}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {(activeTab === "match" || activeTab === "players") && <section className="panel mb-5 overflow-hidden">
          <div className="grid lg:grid-cols-[1fr_auto_1fr]">
            <div className="p-5 lg:p-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#d71920]"><span className="size-2 bg-[#d71920]" /> {tr("Match analysé", "Analyzed game")}</div>
              <div className="mt-3 flex items-end gap-4">
                <div><p className="text-xs text-stone-500">{match.competition} · {match.date.split("-").reverse().join("/")}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{match.team.name}</h1></div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 border-y border-stone-200 bg-stone-950 px-8 py-5 text-white lg:border-x lg:border-y-0">
              <span className="font-condensed text-5xl font-black tabular-nums">{match.team.points}</span><span className="text-stone-500">—</span><span className="font-condensed text-5xl font-black tabular-nums">{match.opponent.points}</span>
            </div>
            <div className="flex items-center justify-between gap-4 p-5 lg:justify-end lg:p-6">
              <div className="lg:text-right"><p className="text-xs text-stone-500">{tr("Adversaire", "Opponent")}</p><h2 className="mt-1 text-xl font-black">{match.opponent.name}</h2><p className="mt-2 text-xs text-stone-500">{dataMode}</p></div>
              <span className="good-chip"><Check className="size-3.5" /> {tr("Données cohérentes", "Consistent data")}</span>
            </div>
          </div>
        </section>}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
          <TabsList variant="line" className="print-hidden w-full justify-start overflow-x-auto border-b border-stone-300 pb-0">
            <TabsTrigger value="live" className="flex-none px-3 pb-3"><Activity /> Live</TabsTrigger>
            <TabsTrigger value="match" className="flex-none px-3 pb-3"><Gauge /> {tr("Match JL", "JL Game")}</TabsTrigger>
            <TabsTrigger value="history" className="flex-none px-3 pb-3"><CalendarRange /> {tr("Historique", "History")}</TabsTrigger>
            <TabsTrigger value="players" className="flex-none px-3 pb-3"><Users /> {tr("Joueurs", "Players")}</TabsTrigger>
            <TabsTrigger value="scouting" className="flex-none px-3 pb-3"><Radio /> {tr("Adversaires", "Opponents")}</TabsTrigger>
            <TabsTrigger value="imports" className="flex-none px-3 pb-3"><FileSearch /> {tr("Imports", "Imports")}</TabsTrigger>
            <TabsTrigger value="references" className="flex-none px-3 pb-3"><Target /> {tr("Référentiels", "Benchmarks")}</TabsTrigger>
            <TabsTrigger value="data" className="flex-none px-3 pb-3"><Database /> {tr("Données", "Data")}</TabsTrigger>
          </TabsList>

          <TabsContent value="live"><LiveMatchPanel matches={liveMatches} onOpenMatch={(selected) => selectJlMatch(selected)} /></TabsContent>
          <TabsContent value="match"><div className="space-y-5"><JlMatchPicker matches={teamHistory} selectedId={selectedJlMatchId} onSelect={(selected) => selectJlMatch(selected)} canDelete={adminAccess.isAdmin} onDelete={(selected) => requestMatchDeletion(selected, "jl")} /><TeamPanel metrics={metrics} match={match} history={teamHistory} /></div></TabsContent>
          <TabsContent value="history"><JlHistoryPanel matches={teamHistory} onOpenMatch={(selected) => selectJlMatch(selected)} /></TabsContent>
          <TabsContent value="scouting"><ScoutingPanel matches={scoutingMatches} selectedId={selectedScoutingId} onSelect={setSelectedScoutingId} canDelete={adminAccess.isAdmin} onDelete={(selected) => requestMatchDeletion(selected, "scouting")} /></TabsContent>
          <TabsContent value="imports"><ImportWorkflow draft={ocrDraft} sourceName={importSource.name} busy={importBusy} progress={importProgress} message={importMessage} analysisType={importAnalysisType} analyzedSide={importAnalyzedSide} detectedJlSide={detectedJlSide} onDraftChange={setOcrDraft} onAnalysisTypeChange={setImportAnalysisType} onAnalyzedSideChange={setImportAnalyzedSide} onValidate={validateImport} /></TabsContent>
          <TabsContent value="players">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="panel overflow-hidden">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 p-5">
                  <div><p className="eyebrow">{tr("Rotation", "Rotation")} · {players.length} {tr("joueurs", "players")}</p><h2 className="mt-1 text-xl font-black">{tr("Performance individuelle", "Player performance")}</h2></div>
                  <p className="max-w-md text-xs leading-5 text-stone-500">{tr("AST% estim. contextualise les passes par les minutes sans connaître les rotations réelles. Sur un match isolé, privilégiez AST et AST/40.", "Estimated AST% contextualizes assists by minutes without actual lineup data. For a single game, prioritize AST and AST/40.")}</p>
                </div>
                <Table>
                  <TableHeader><TableRow className="bg-stone-50"><TableHead>{tr("Joueur", "Player")}</TableHead><TableHead className="text-right">MIN</TableHead><TableHead className="text-right">PTS</TableHead><TableHead className="text-right">TS%</TableHead><TableHead className="text-right">USG%</TableHead><TableHead className="text-right">AST</TableHead><TableHead className="text-right">{tr("AST% estim.", "Est. AST%")}</TableHead><TableHead className="text-right">TOV%</TableHead><TableHead className="text-right">ORtg*</TableHead><TableHead className="text-right">DRtg*</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {players.map((player) => {
                      const ref = playerReferences[player.id];
                      const primaryStatus = metricStatus(player.ts, ref?.targets.ts);
                      return (
                        <TableRow key={player.id} onClick={() => setSelectedPlayerId(player.id)} data-state={player.id === selectedPlayer.id ? "selected" : undefined} className="cursor-pointer">
                          <TableCell><div className="flex items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${statusStyles[primaryStatus].dot}`} /><div><div className="font-bold">{player.name}</div><div className="max-w-[180px] truncate text-[10px] text-stone-400">{player.role}</div></div></div></TableCell>
                          <TableCell className="text-right tabular-nums">{player.minutes}</TableCell><TableCell className="text-right font-bold tabular-nums">{player.points}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.ts)}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.usg)}</TableCell><TableCell className="text-right font-bold tabular-nums">{player.ast}</TableCell><TableCell className={`text-right tabular-nums ${player.astPctLowSample ? "bg-amber-50 text-amber-800" : ""}`} title={tr(`Estimation sur ${formatMetric(player.estimatedTeammateFieldGoals, 2)} paniers de coéquipiers`, `Estimate based on ${formatMetric(player.estimatedTeammateFieldGoals, 2)} teammate field goals`)}><span aria-hidden="true">~</span>{formatMetric(player.astPct)}{player.astPctLowSample ? " ⚠" : ""}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.tovPct)}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.ortgEstimate)}</TableCell><TableCell className="text-right tabular-nums">{formatMetric(player.drtgEstimate)}</TableCell><TableCell><ChevronRight className="size-4 text-stone-400" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="border-t border-stone-200 p-4 text-[11px] leading-5 text-stone-500">{tr("* Estimations boxscore, distinctes des ratings individuels « on/off ». Une attribution possession par possession nécessitera le play-by-play.", "* Boxscore estimates, separate from individual on/off ratings. Possession-by-possession attribution requires play-by-play data.")}</p>
              </section>
              <PlayerDetail player={selectedPlayer} />
            </div>
          </TabsContent>

          <TabsContent value="references">
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="panel p-6"><p className="eyebrow">{tr("Convention collective", "Team definition")}</p><h2 className="mt-2 text-2xl font-black">FGAST% & AST Ratio</h2><div className="mt-5 space-y-4 text-sm leading-6 text-stone-600"><p>{tr("FGAST% mesure la part des tirs réussis qui ont été assistés. Sur ce match :", "FGAST% measures the share of made field goals that were assisted. In this game:")} <span className="font-bold text-stone-950">{match.team.ast} AST / {match.team.fgm} FGM = {formatMetric(metrics.fgastRaw)}%</span>. {!metrics.fgastValid && <span className="font-bold text-amber-700"> {tr("Cette valeur dépasse la limite physique de 100% : elle est signalée comme incohérence source et n’est pas interprétée.", "This value exceeds the physical 100% limit: it is flagged as a source inconsistency and is not interpreted.")}</span>}</p><p>{tr("Les tirs à 3 points sont inclus dans les FGM. Les lancers francs ne sont pas des paniers de champ et n’entrent donc pas dans ce ratio.", "Three-point field goals are included in FGM. Free throws are not field goals and are therefore excluded from this ratio.")}</p><p><strong className="text-stone-950">AST Ratio</strong> {tr("rapporte les passes aux possessions estimées", "relates assists to estimated possessions")}: <span className="font-bold text-stone-950">{formatMetric(metrics.astRatio)}</span> {tr("passes pour 100 possessions", "assists per 100 possessions")}.</p></div></section>
              <section className="panel p-6"><p className="eyebrow">{tr("Convention individuelle", "Player definition")}</p><h2 className="mt-2 text-2xl font-black">{tr("AST% estimé par les minutes", "AST% estimated by minutes")}</h2><div className="mt-5 bg-stone-950 p-5 font-mono text-sm leading-7 text-white">{tr("AST% estim.", "Est. AST%")} = 100 × AST /<br />[(MP / 40 × Tm FGM) − FGM]</div><p className="mt-4 text-sm leading-6 text-stone-600">{tr("Sans rotations ni play-by-play, le dénominateur répartit les paniers collectifs au prorata des minutes. Une valeur très élevée sur un match court peut donc être mathématiquement correcte mais très volatile. L’application affiche désormais les passes brutes et l’AST/40 à côté de cette estimation.", "Without lineup or play-by-play data, the denominator allocates team field goals in proportion to minutes. A very high value in a short single-game sample can therefore be mathematically correct but highly volatile. Raw assists and AST/40 are displayed alongside this estimate.")}</p></section>
              <section className="panel p-6 lg:col-span-2"><div className="flex items-center gap-2"><Target className="size-5 text-[#d71920]" /><h2 className="text-xl font-black">{tr("Référentiels disponibles", "Available benchmarks")}</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(playerReferences).map(([id, reference]) => { const player = match.players.find((item) => item.id === id) ?? genevaMatch.players.find((item) => item.id === id); return <div key={id} className="border border-stone-200 bg-stone-50 p-4"><div className="font-bold">{player?.name ?? id}</div><div className="mt-1 text-xs text-stone-500">{reference.season}</div><div className="mt-3 text-xs text-stone-600">{Object.keys(reference.targets).length} {tr("indicateurs ciblés", "targeted metrics")}</div></div>; })}</div></section>
            </div>
          </TabsContent>

          <TabsContent value="data" forceMount>
            <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
              <section className="panel p-6"><p className="eyebrow">{tr("Pipeline d’un match", "Game pipeline")}</p><h2 className="mt-2 text-2xl font-black">{tr("De la feuille au rapport", "From boxscore to report")}</h2><div className="mt-6 space-y-3">{[
                [Camera, tr("1. Import", "1. Import"), tr("Photo mobile normalisée en PDF, PDF natif, CSV ou XLSX", "Mobile photo normalized to PDF, native PDF, CSV or XLSX")],
                [Check, tr("2. Validation", "2. Validation"), tr("Contrôle des totaux, minutes et cohérence du score", "Check totals, minutes and scoring consistency")],
                [Activity, tr("3. Calcul", "3. Calculation"), tr("Métriques versionnées, collectives et individuelles", "Versioned team and player metrics")],
                [BarChart3, tr("4. Rapport", "4. Report"), tr("Comparaison aux cibles et export imprimable", "Target comparison and printable export")],
              ].map(([Icon, title, copy]) => { const StepIcon = Icon as typeof FileUp; return <div key={String(title)} className="flex gap-4 border border-stone-200 p-4"><div className="grid size-10 shrink-0 place-items-center bg-stone-950 text-white"><StepIcon className="size-4" /></div><div><div className="font-bold">{String(title)}</div><div className="mt-1 text-sm text-stone-500">{String(copy)}</div></div></div>; })}</div></section>
              <section className="panel p-6"><p className="eyebrow">{tr("Infrastructure", "Infrastructure")}</p><h2 className="mt-2 text-2xl font-black">{tr("Supabase connecté", "Supabase connected")}</h2><div className="mt-6 space-y-3"><StatusRow icon={<Database />} label={tr("Schéma SQL", "SQL schema")} value={tr("Actif", "Active")} tone="good" /><StatusRow icon={<Cloud />} label={tr("Connexion projet", "Project connection")} value={tr("Configurée", "Configured")} tone="good" /><StatusRow icon={<RefreshCw />} label={tr("Rafraîchissement", "Refresh")} value={`10 s · ${syncStatus}`} tone={syncStatus.startsWith(tr("Actualisé", "Updated")) ? "good" : "watch"} /><StatusRow icon={<ShieldCheck />} label={tr("Lecture publique", "Public access")} value={tr("Rapports publiés uniquement", "Published reports only")} tone="good" /></div><div className="mt-6"><AdminAccess onAccessChange={onAccessChange} /></div><div className="mt-6 border-l-2 border-[#d71920] bg-red-50 p-4 text-sm leading-6 text-red-950">{tr("Les visiteurs peuvent consulter les matchs publiés. Seul un administrateur autorisé peut importer ou modifier des données.", "Visitors can view published games. Only an authorized administrator can import or modify data.")}</div></section>
              <section className="panel p-6 lg:col-span-2">
                <div className="flex items-center gap-3"><Radio className="size-5 text-[#d71920]" /><div><p className="eyebrow">{tr("Données temps réel", "Real-time data")}</p><h2 className="mt-1 text-2xl font-black">{tr("Connecteurs live à autoriser", "Live connectors to authorize")}</h2></div></div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="border border-stone-200 p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-black">Betclic Élite</div><div className="mt-1 text-sm text-stone-500">Synergy Stats DataCore Streaming</div></div><span className="watch-chip">{tr("Accès requis", "Access required")}</span></div><p className="mt-4 text-sm leading-6 text-stone-600">{tr("Flux d’événements live à normaliser avec un identifiant de match et des identifiants serveur fournis par la LNB ou Synergy.", "Live event feed to normalize using a game ID and server identifiers supplied by LNB or Synergy.")}</p></div>
                  <div className="border border-stone-200 p-5"><div className="flex items-start justify-between gap-3"><div><div className="font-black">EuroCup</div><div className="mt-1 text-sm text-stone-500">Sportradar Global Basketball</div></div><span className="watch-chip">{tr("Couverture à confirmer", "Coverage to confirm")}</span></div><p className="mt-4 text-sm leading-6 text-stone-600">{tr("Timeline ou Push Statistics selon le contrat. La clé reste côté serveur ; l’administrateur ne saisira que l’identifiant officiel du match.", "Timeline or Push Statistics depending on the contract. The key remains server-side; the administrator only enters the official game ID.")}</p></div>
                </div>
                <p className="mt-4 text-xs leading-5 text-stone-500">{tr("Un flux push accélère l’affichage, mais un snapshot REST reste la source de réconciliation en cas de coupure.", "A push feed speeds up display, while a REST snapshot remains the reconciliation source after an interruption.")}</p>
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {pendingDeletion && <div className="print-hidden fixed inset-0 z-50 grid place-items-center bg-stone-950/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteBusy) setPendingDeletion(null); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-match-title" aria-describedby="delete-match-description" className="w-full max-w-lg border border-red-200 bg-white p-6 shadow-2xl"><div className="flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center bg-red-50 text-[#d71920]"><AlertTriangle className="size-6" /></div><div><p className="eyebrow text-[#d71920]">{tr("Suppression définitive", "Permanent deletion")}</p><h2 id="delete-match-title" className="mt-1 text-2xl font-black">{tr("Supprimer ce match ?", "Delete this game?")}</h2></div></div><div id="delete-match-description" className="mt-5 space-y-3 text-sm leading-6 text-stone-600"><p><strong className="text-stone-950">{pendingDeletion.match.team.name} – {pendingDeletion.match.opponent.name}</strong><br />{pendingDeletion.match.date.split("-").reverse().join("/")} · {pendingDeletion.match.competition}</p><p className="border-l-4 border-[#d71920] bg-red-50 p-4 text-red-950">{tr("Cette action supprimera le match, ses lignes joueurs, son boxscore collectif et son rapport. Il sera immédiatement retiré des historiques et des moyennes de référence. Cette opération est irréversible.", "This will delete the game, player rows, team boxscore and report. It will be removed immediately from histories and benchmark averages. This action cannot be undone.")}</p></div>{deleteError && <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{deleteError}</div>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={deleteBusy} onClick={() => setPendingDeletion(null)} className="rounded-none">{tr("Annuler", "Cancel")}</Button><Button type="button" disabled={deleteBusy} onClick={() => void confirmMatchDeletion()} className="rounded-none bg-[#d71920] hover:bg-[#a20e14]">{deleteBusy ? <><LoaderCircle className="animate-spin" /> {tr("Suppression…", "Deleting…")}</> : tr("Supprimer définitivement", "Permanently delete")}</Button></div></section></div>}
    </main>
  );
}

function StatusRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: MetricStatus }) {
  const styles = statusStyles[tone];
  return <div className="flex items-center justify-between gap-4 border-b border-stone-200 py-3"><div className="flex items-center gap-3 text-sm font-bold [&_svg]:size-4">{icon}{label}</div><span className={`text-xs font-bold ${styles.text}`}>{value}</span></div>;
}
