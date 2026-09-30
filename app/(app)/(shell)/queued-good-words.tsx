"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";
import { useGoodWords } from "./good-words";

// Good words put in offline (PRD F12, DS 5.12): each one captioned "Sending
// when you're back online" until it goes. One the server turned down stays,
// with Retry and Remove, so nothing is lost silently.
export function QueuedGoodWords() {
  const { queued, retryQueued, removeQueued } = useGoodWords();
  if (queued.length === 0) return null;
  return (
    <section aria-label={t("vouch.queuedHeading")} className="mx-auto w-full max-w-content px-4 pb-4">
      <ul className="flex flex-col divide-y divide-subtle rounded-card border border-subtle bg-surface-raised px-4">
        {queued.map((item) => (
          <li key={item.title.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body-strong text-default">{item.title.name}</span>
              <span role="status" className={item.status === "failed" ? "text-caption text-danger" : "text-caption text-muted"}>
                {item.status === "failed" ? t("vouch.queuedFailed") : t("vouch.queued")}
              </span>
            </div>
            {item.status === "failed" && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => retryQueued(item.title.id)}>
                  {t("common.retry")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeQueued(item.title.id)}>
                  {t("vouch.queuedRemove")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
