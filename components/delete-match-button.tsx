"use client";

import { X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function DeleteMatchButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const { tr } = useI18n();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      className="grid size-7 shrink-0 place-items-center border border-transparent text-stone-400 transition hover:border-red-200 hover:bg-red-50 hover:text-[#d71920] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]"
      aria-label={tr(`Supprimer ${label}`, `Delete ${label}`)}
      title={tr("Supprimer définitivement ce match", "Permanently delete this game")}
    >
      <X className="size-4" />
    </button>
  );
}
