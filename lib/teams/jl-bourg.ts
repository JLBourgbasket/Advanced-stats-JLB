import type { OcrBoxscoreDraft } from "@/lib/ocr/lnb-boxscore";

export type BoxscoreSide = "home" | "away";

const jlAliases = [
  "jl bourg",
  "jl bourg en bresse",
  "bourg en bresse",
  "ps bourg en bresse",
  "jeunesse laique de bourg",
  "jlb",
];

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isJlBourgName(value: string) {
  const normalized = normalizedName(value);
  return jlAliases.some((alias) => normalized === alias || normalized.includes(alias));
}

export function detectJlBourgSide(draft: Pick<OcrBoxscoreDraft, "home" | "away">): BoxscoreSide | null {
  if (isJlBourgName(draft.home.name) || isJlBourgName(draft.home.team.name)) return "home";
  if (isJlBourgName(draft.away.name) || isJlBourgName(draft.away.team.name)) return "away";
  return null;
}
