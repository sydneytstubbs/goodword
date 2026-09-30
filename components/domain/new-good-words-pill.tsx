"use client";

import { t } from "@/lib/messages";

/** "2 new good words" (PRD F5.6): others' good words arrived while you were looking. Shows them. */
export function NewGoodWordsPill({ count, onShow }: { count: number; onShow: () => void }) {
  return (
    <button
      type="button"
      onClick={onShow}
      className="pointer-events-auto inline-flex min-h-target items-center gap-1 rounded-pill bg-inverse px-4 text-label font-semibold text-inverse shadow-md fc-edge"
    >
      {t("shelf.newGoodWords", { count })}
    </button>
  );
}
