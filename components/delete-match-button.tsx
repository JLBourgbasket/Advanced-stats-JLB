"use client";

import { X } from "lucide-react";

export function DeleteMatchButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      className="grid size-7 shrink-0 place-items-center border border-transparent text-stone-400 transition hover:border-red-200 hover:bg-red-50 hover:text-[#d71920] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]"
      aria-label={`Supprimer ${label}`}
      title="Supprimer définitivement ce match"
    >
      <X className="size-4" />
    </button>
  );
}
