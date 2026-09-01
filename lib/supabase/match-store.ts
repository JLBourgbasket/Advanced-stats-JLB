import type { MatchBoxscore, RawPlayerBoxscore, RawTeamBoxscore } from "@/lib/stats/types";
import { photoToCleanPdf } from "@/lib/documents/boxscore-pdf";
import { getSupabaseBrowserClient } from "./client";

type TeamPayload = RawTeamBoxscore & {
  quarters?: MatchBoxscore["quarters"];
};

type MatchRow = {
  id: string;
  opponent_name: string;
  played_at: string;
  competition: string | null;
  venue: string | null;
  source_type?: "import" | "live" | null;
  live_status?: "scheduled" | "live" | "final" | null;
  provider?: "manual" | "synergy" | "sportradar" | null;
  external_match_id?: string | null;
  last_synced_at?: string | null;
};

const baseMatchColumns = "id, opponent_name, played_at, competition, venue";
const extendedMatchColumns = `${baseMatchColumns}, source_type, live_status, provider, external_match_id, last_synced_at`;

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadStoredMatch(match: MatchRow): Promise<MatchBoxscore | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const [{ data: teamRow, error: teamError }, { data: playerRows, error: playerError }] =
    await Promise.all([
      supabase
        .from("team_boxscores")
        .select("team_stats, opponent_stats")
        .eq("match_id", match.id)
        .single(),
      supabase
        .from("player_boxscores")
        .select("player_name, raw_stats")
        .eq("match_id", match.id),
    ]);

  if (teamError) throw teamError;
  if (playerError) throw playerError;
  const team = teamRow.team_stats as TeamPayload;
  const opponent = teamRow.opponent_stats as RawTeamBoxscore;
  const players = (playerRows ?? []).map((row) => {
    const raw = row.raw_stats as RawPlayerBoxscore;
    return { ...raw, name: row.player_name };
  });
  if (!team?.name || !opponent?.name || players.length === 0) return null;

  return {
    id: match.id,
    date: match.played_at.slice(0, 10),
    competition: match.competition ?? "Match",
    venue: match.venue ?? "",
    team,
    opponent,
    players,
    quarters: team.quarters ?? [],
    sourceType: match.source_type ?? "import",
    liveStatus: match.live_status ?? "final",
    provider: match.provider ?? "manual",
    externalMatchId: match.external_match_id ?? null,
    lastSyncedAt: match.last_synced_at ?? null,
  };
}

export async function loadLatestPublishedMatch(): Promise<MatchBoxscore | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const primary = await supabase
    .from("matches")
    .select(extendedMatchColumns)
    .eq("analysis_type", "jl")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let match = primary.data as MatchRow | null;
  let matchError = primary.error;

  if (matchError?.code === "42703" || matchError?.code === "PGRST204") {
    const fallback = await supabase
      .from("matches")
      .select(baseMatchColumns)
      .eq("analysis_type", "jl")
      .eq("status", "published")
      .order("played_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    match = fallback.data as MatchRow | null;
    matchError = fallback.error;
  }
  if (matchError?.code === "42703") {
    const legacy = await supabase
      .from("matches")
      .select(baseMatchColumns)
      .eq("status", "published")
      .order("played_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    match = legacy.data as MatchRow | null;
    matchError = legacy.error;
  }
  if (matchError) throw matchError;
  if (!match) return null;
  return loadStoredMatch(match);
}

export async function loadPublishedMatches(limit = 10): Promise<MatchBoxscore[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const primary = await supabase
    .from("matches")
    .select(extendedMatchColumns)
    .eq("analysis_type", "jl")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(limit);
  let data = primary.data as MatchRow[] | null;
  let error = primary.error;

  if (error?.code === "42703" || error?.code === "PGRST204") {
    const fallback = await supabase
      .from("matches")
      .select(baseMatchColumns)
      .eq("analysis_type", "jl")
      .eq("status", "published")
      .order("played_at", { ascending: false })
      .limit(limit);
    data = fallback.data as MatchRow[] | null;
    error = fallback.error;
  }
  if (error?.code === "42703") {
    const legacy = await supabase
      .from("matches")
      .select(baseMatchColumns)
      .eq("status", "published")
      .order("played_at", { ascending: false })
      .limit(limit);
    data = legacy.data as MatchRow[] | null;
    error = legacy.error;
  }
  if (error) throw error;
  const matches = await Promise.all((data ?? []).map((row) => loadStoredMatch(row)));
  return matches.filter((storedMatch): storedMatch is MatchBoxscore => storedMatch !== null);
}

export async function loadLiveMatches(): Promise<MatchBoxscore[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("matches")
    .select(extendedMatchColumns)
    .eq("analysis_type", "jl")
    .eq("source_type", "live")
    .in("live_status", ["scheduled", "live"])
    .eq("status", "published")
    .order("played_at", { ascending: true });
  if (error?.code === "42703" || error?.code === "PGRST204") return [];
  if (error) throw error;
  const matches = await Promise.all((data ?? []).map((row) => loadStoredMatch(row)));
  return matches.filter((storedMatch): storedMatch is MatchBoxscore => storedMatch !== null);
}

export async function loadScoutingMatches(limit = 20): Promise<MatchBoxscore[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("matches")
    .select(baseMatchColumns)
    .eq("analysis_type", "scouting")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error?.code === "42703") return [];
  if (error) throw error;
  const matches = await Promise.all((data ?? []).map((row) => loadStoredMatch(row)));
  return matches.filter((match): match is MatchBoxscore =>
    match !== null &&
    match.team.points > 0 &&
    match.opponent.points > 0 &&
    match.team.fga > 0 &&
    match.opponent.fga > 0,
  );
}

export async function saveImportedMatch(
  match: MatchBoxscore,
  analysisType: "jl" | "scouting",
  sourceFilename: string,
  sourcePath: string | null,
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n’est pas configuré.");
  const teamSlug = slug(match.team.name);
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .upsert({ name: match.team.name, slug: teamSlug }, { onConflict: "slug" })
    .select("id")
    .single();
  if (teamError) throw teamError;

  const { data: storedMatch, error: matchError } = await supabase
    .from("matches")
    .insert({
      team_id: team.id,
      opponent_name: match.opponent.name,
      played_at: `${match.date}T12:00:00Z`,
      competition: match.competition,
      venue: match.venue,
      status: "published",
      analysis_type: analysisType,
      source_type: "import",
      live_status: "final",
      provider: "manual",
      source_filename: sourceFilename,
      source_path: sourcePath,
    })
    .select("id")
    .single();
  if (matchError) {
    if (matchError.code === "PGRST204") throw new Error("La migration live/import 004 doit être exécutée dans Supabase.");
    throw matchError;
  }

  const { error: teamBoxscoreError } = await supabase.from("team_boxscores").insert({
    match_id: storedMatch.id,
    team_stats: { ...match.team, quarters: match.quarters },
    opponent_stats: match.opponent,
  });
  if (teamBoxscoreError) throw teamBoxscoreError;

  if (match.players.length > 0) {
    const { error: playersError } = await supabase.from("player_boxscores").insert(
      match.players.map((player) => ({
        match_id: storedMatch.id,
        player_name: player.name,
        raw_stats: player,
      })),
    );
    if (playersError) throw playersError;
  }

  const { error: reportError } = await supabase.from("reports").insert({
    match_id: storedMatch.id,
    status: "ready",
    summary: { analysisType, source: "ocr" },
  });
  if (reportError) throw reportError;
  return {
    ...match,
    id: storedMatch.id,
    analysisType,
    sourceType: "import" as const,
    liveStatus: "final" as const,
    provider: "manual" as const,
  };
}

export async function saveScoutingMatch(match: MatchBoxscore, sourceFilename: string, sourcePath: string | null) {
  return saveImportedMatch(match, "scouting", sourceFilename, sourcePath);
}

export async function uploadBoxscoreFile(file: File, userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n’est pas configuré.");

  const batchPath = `${userId}/${Date.now()}`;
  const upload = async (path: string, uploadFile: File) => {
    const { error } = await supabase.storage.from("boxscores").upload(path, uploadFile, {
      cacheControl: "3600",
      contentType: uploadFile.type,
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const normalized = file.type.startsWith("image/") ? await photoToCleanPdf(file) : null;
  const originalPath = await upload(`${batchPath}/original-${cleanName}`, file);

  if (!normalized) {
    return { originalPath, normalizedPath: null, convertedToPdf: false };
  }

  const normalizedPath = await upload(`${batchPath}/${normalized.name}`, normalized);
  return { originalPath, normalizedPath, convertedToPdf: true };
}
