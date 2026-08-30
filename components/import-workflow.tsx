"use client";

import { AlertTriangle, Check, LoaderCircle, ScanText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OcrBoxscoreDraft } from "@/lib/ocr/lnb-boxscore";
import type { RawPlayerBoxscore, RawTeamBoxscore } from "@/lib/stats/types";

type Props = {
  draft: OcrBoxscoreDraft | null;
  sourceName: string;
  busy: boolean;
  progress: number;
  message: string;
  onDraftChange: (draft: OcrBoxscoreDraft) => void;
  onValidate: (side: "home" | "away") => Promise<void>;
};

const teamFields: Array<[keyof RawTeamBoxscore, string]> = [
  ["points", "PTS"], ["fgm", "FGM"], ["fga", "FGA"], ["threePm", "3PM"], ["threePa", "3PA"],
  ["ftm", "FTM"], ["fta", "FTA"], ["orb", "ORB"], ["drb", "DRB"], ["ast", "AST"], ["tov", "TOV"],
  ["stl", "STL"], ["blk", "BLK"], ["pf", "PF"],
];

const playerFields: Array<[keyof RawPlayerBoxscore, string]> = [
  ["minutes", "MIN"], ["points", "PTS"], ["fgm", "FGM"], ["fga", "FGA"], ["threePm", "3PM"],
  ["threePa", "3PA"], ["ftm", "FTM"], ["fta", "FTA"], ["orb", "ORB"], ["drb", "DRB"],
  ["ast", "AST"], ["tov", "TOV"], ["stl", "STL"], ["blk", "BLK"], ["pf", "PF"],
];

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function consistencyMessages(draft: OcrBoxscoreDraft, side: "home" | "away") {
  const subject = draft[side];
  const messages: Array<{ good: boolean; text: string }> = [];
  const scoring = 2 * subject.team.fgm + subject.team.threePm + subject.team.ftm;
  const playerPoints = subject.players.reduce((sum, player) => sum + player.points, 0);
  const playerMinutes = subject.players.reduce((sum, player) => sum + Number(player.minutes.split(":")[0] || 0), 0);
  messages.push({ good: scoring === subject.team.points, text: `Équation du score : ${scoring}/${subject.team.points}` });
  messages.push({ good: playerPoints === subject.team.points, text: `Somme des points joueurs : ${playerPoints}/${subject.team.points}` });
  messages.push({ good: Math.abs(playerMinutes - 200) <= 2, text: `Somme des minutes : ${playerMinutes}/200` });
  messages.push({ good: subject.team.fgm <= subject.team.fga && subject.team.threePm <= subject.team.threePa && subject.team.ftm <= subject.team.fta, text: "Tirs réussis ≤ tirs tentés" });
  return messages;
}

export function ImportWorkflow({ draft, sourceName, busy, progress, message, onDraftChange, onValidate }: Props) {
  if (!draft) {
    return (
      <section className="panel p-6">
        <div className="grid min-h-64 place-items-center text-center">
          <div className="max-w-xl">
            {busy ? <LoaderCircle className="mx-auto size-10 animate-spin text-[#d71920]" /> : <ScanText className="mx-auto size-10 text-stone-400" />}
            <h2 className="mt-4 text-2xl font-black">{busy ? "Lecture du boxscore…" : "Aucun import à valider"}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">{message || "Utilisez « Prendre une photo » ou « Choisir un fichier » dans l’en-tête. Les formats LNB sous forme d’image sont lus directement dans le navigateur."}</p>
            {busy && <div className="mx-auto mt-5 h-2 max-w-md bg-stone-200"><div className="h-full bg-[#d71920] transition-all" style={{ width: `${progress}%` }} /></div>}
            {busy && <div className="mt-2 text-xs font-bold tabular-nums text-stone-500">{progress}%</div>}
          </div>
        </div>
      </section>
    );
  }

  const replaceSide = (side: "home" | "away", update: Partial<OcrBoxscoreDraft["home"]>) => {
    onDraftChange({ ...draft, [side]: { ...draft[side], ...update } });
  };
  const updateTeam = (side: "home" | "away", field: keyof RawTeamBoxscore, value: string) => {
    const team = { ...draft[side].team, [field]: field === "name" ? value : numberValue(value) };
    replaceSide(side, { name: team.name, team });
  };
  const updatePlayer = (side: "home" | "away", index: number, field: keyof RawPlayerBoxscore, value: string) => {
    const players = [...draft[side].players];
    players[index] = { ...players[index], [field]: field === "name" || field === "minutes" ? value : numberValue(value) };
    replaceSide(side, { players });
  };

  return (
    <div className="space-y-5">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="eyebrow">Import OCR · {sourceName}</p><h2 className="mt-2 text-2xl font-black">Vérification avant calcul</h2><p className="mt-2 text-sm text-stone-500">Confiance OCR globale : {draft.confidence.toFixed(0)}%. Toutes les valeurs restent modifiables.</p></div>
          <div className="grid grid-cols-2 gap-3 text-right text-sm"><label>Date<input type="date" value={draft.date} onChange={(event) => onDraftChange({ ...draft, date: event.target.value })} className="mt-1 block border border-stone-300 bg-white px-2 py-1" /></label><label>Compétition<input value={draft.competition} onChange={(event) => onDraftChange({ ...draft, competition: event.target.value })} className="mt-1 block w-44 border border-stone-300 bg-white px-2 py-1" /></label></div>
        </div>
        {draft.warnings.length > 0 && <div className="mt-5 border-l-2 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> Points à contrôler</div><ul className="mt-2 list-disc space-y-1 pl-5">{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {(["home", "away"] as const).map((side) => {
          const subject = draft[side];
          const checks = consistencyMessages(draft, side);
          return <article key={side} className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">{side === "home" ? "Domicile" : "Visiteur"}</p><input value={subject.name} onChange={(event) => updateTeam(side, "name", event.target.value)} className="mt-2 w-full border-b border-stone-300 bg-transparent text-xl font-black outline-none focus:border-[#d71920]" /></div><span className={checks.every((check) => check.good) ? "good-chip" : "watch-chip"}>{subject.players.length} joueurs</span></div><div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-7">{teamFields.map(([field, label]) => <label key={field} className="text-[10px] font-bold text-stone-500">{label}<input type="number" value={subject.team[field]} onChange={(event) => updateTeam(side, field, event.target.value)} className="mt-1 w-full border border-stone-300 px-2 py-1 text-right text-sm font-bold tabular-nums" /></label>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map((check) => <div key={check.text} className={`flex items-center gap-2 text-xs ${check.good ? "text-emerald-700" : "text-amber-800"}`}>{check.good ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{check.text}</div>)}</div></article>;
        })}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-stone-200 p-5"><p className="eyebrow">Joueurs extraits</p><h3 className="mt-1 text-xl font-black">Correction des lignes</h3><p className="mt-2 text-xs text-stone-500">Les tableaux domicile et visiteur sont affichés successivement. Faites défiler horizontalement sur mobile.</p></div>
        {(["home", "away"] as const).map((side) => <div key={side} className="border-b border-stone-200 p-4"><h4 className="mb-3 font-black">{draft[side].name}</h4><div className="overflow-x-auto"><table className="min-w-[1280px] text-xs"><thead><tr className="bg-stone-100"><th className="p-2 text-left">Joueur</th>{playerFields.map(([, label]) => <th key={label} className="p-2 text-right">{label}</th>)}</tr></thead><tbody>{draft[side].players.map((player, index) => <tr key={`${player.id}-${index}`} className="border-t border-stone-200"><td className="p-1"><input value={player.name} onChange={(event) => updatePlayer(side, index, "name", event.target.value)} className="w-56 border border-stone-200 px-2 py-1 font-bold" /></td>{playerFields.map(([field]) => <td key={field} className="p-1"><input type={field === "minutes" ? "text" : "number"} value={player[field]} onChange={(event) => updatePlayer(side, index, field, event.target.value)} className="w-16 border border-stone-200 px-2 py-1 text-right tabular-nums" /></td>)}</tr>)}</tbody></table></div></div>)}
      </section>

      <section className="panel p-5 sm:p-6">
        <p className="eyebrow">Équipe à analyser</p><h3 className="mt-2 text-xl font-black">Créer le rapport de scouting</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["home", "away"] as const).map((side) => <Button key={side} disabled={busy} onClick={() => void onValidate(side)} className="h-auto min-h-14 rounded-none bg-stone-950 px-5 py-3 text-left hover:bg-[#d71920]"><span><span className="block text-xs font-normal text-stone-300">Valider, calculer et publier</span><span className="mt-1 block text-base font-black">{draft[side].name}</span></span></Button>)}</div>
        <p className="mt-3 text-xs text-stone-500">Le même boxscore peut être réimporté pour créer ultérieurement un rapport centré sur l’autre équipe.</p>
      </section>
    </div>
  );
}
