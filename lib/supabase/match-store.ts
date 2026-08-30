import type { MatchBoxscore, RawPlayerBoxscore, RawTeamBoxscore } from "@/lib/stats/types";
import { photoToCleanPdf } from "@/lib/documents/boxscore-pdf";
import { getSupabaseBrowserClient } from "./client";

type TeamPayload = RawTeamBoxscore & {
  quarters?: MatchBoxscore["quarters"];
};

export async function loadLatestPublishedMatch(): Promise<MatchBoxscore | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, opponent_name, played_at, competition, venue")
    .eq("status", "published")
    .order("played_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (matchError) throw matchError;
  if (!match) return null;

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
