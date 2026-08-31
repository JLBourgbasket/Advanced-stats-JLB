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
};

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
  };
}

export async function loadLatestPublishedMatch(): Promise<MatchBoxscore | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  let { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, opponent_name, played_at, competition, venue")
    .eq("analysis_type", "jl")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matchError?.code === "42703") {
    const fallback = await supabase
      .from("matches")
      .select("id, opponent_name, played_at, competition, venue")
      .eq("status", "published")
      .order("played_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    match = fallback.data;
    matchError = fallback.error;
  }
  if (matchError) throw matchError;
  if (!match) return null;
  return loadStoredMatch(match);
}

export async function loadPublishedMatches(limit = 10): Promise<MatchBoxscore[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  let { data, error } = await supabase
    .from("matches")
    .select("id, opponent_name, played_at, competition, venue")
    .eq("analysis_type", "jl")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error?.code === "42703") {
    const fallback = await supabase
      .from("matches")
      .select("id, opponent_name, played_at, competition, venue")
      .eq("status", "published")
      .order("played_at", { ascending: false })
      .limit(limit);
    data = fallback.data;
    error = fallback.error;
  }
  if (error) throw error;
  const matches = await Promise.all((data ?? []).map((row) => loadStoredMatch(row)));
  return matches.filter((storedMatch): storedMatch is MatchBoxscore => storedMatch !== null);
}

export async function loadScoutingMatches(limit = 20): Promise<MatchBoxscore[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("matches")
    .select("id, opponent_name, played_at, competition, venue")
    .eq("analysis_type", "scouting")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(limit);
  if (error?.code === "42703") return [];
  if (error) throw error;
  const matches = await Promise.all((data ?? []).map((row) => loadStoredMatch(row)));
  return matches.filter((match): match is MatchBoxscore => match !== null);
}

export async function saveScoutingMatch(match: MatchBoxscore, sourceFilename: string, sourcePath: string | null) {
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
      analysis_type: "scouting",
      source_filename: sourceFilename,
      source_path: sourcePath,
    })
    .select("id")
    .single();
  if (matchError) {
    if (matchError.code === "PGRST204") throw new Error("La migration scouting doit être exécutée dans Supabase.");
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
    summary: { analysisType: "scouting", source: "ocr" },
  });
  if (reportError) throw reportError;
  return { ...match, id: storedMatch.id };
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
