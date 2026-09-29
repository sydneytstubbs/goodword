"use client";

import { t } from "@/lib/messages";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";

// The first-good-word prompt's card (PRD F5.7, DS 5.2): small and inline, never a modal.
export function JoinPromptCard({ onPut, onDismiss }: { onPut: () => void; onDismiss: () => void }) {
  return (
    <aside
      aria-label={t("shelf.joinPrompt")}
      className="relative flex flex-col items-start gap-4 rounded-card border border-subtle bg-surface-raised p-5 pe-16 shadow-sm fc-edge motion-ok:animate-rise"
    >
      <p className="text-heading text-default">{t("shelf.joinPrompt")}</p>
      <Button variant="primary" icon="add" onClick={onPut}>
        {t("vouch.put")}
      </Button>
      <div className="absolute top-2 end-2">
        <IconButton icon="close" label={t("common.close")} tone="muted" onClick={onDismiss} />
      </div>
    </aside>
  );
}
