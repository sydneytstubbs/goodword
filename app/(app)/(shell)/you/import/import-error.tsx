"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// Add recs or the review deck couldn't load (PRD F15.5, DS 4.1.19): plain
// language and Retry. Cards already decided are saved; nothing is lost.
export function ImportError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Never log what someone typed (PRD 10.5): the digest is enough to find it server-side.
    console.error("import failed to load", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-reading px-4 py-12">
      <h1 className="sr-only">{t("importDeck.loadErrorTitle")}</h1>
      <ErrorState
        headingLevel={2}
        title={t("importDeck.loadErrorTitle")}
        body={t("importRecs.error")}
        action={
          <Button variant="secondary" onClick={retry}>
            {t("common.retry")}
          </Button>
        }
      />
    </main>
  );
}
