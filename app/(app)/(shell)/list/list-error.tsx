"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// A shelf that couldn't load (PRD F5.7, DS 4.1.19): plain language and Retry.
// The tab bar and rail stay usable around it.
export function ShelfError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Never log notes or emails (PRD 10.5): the digest is enough to find it server-side.
    console.error("shelf failed to load", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("shelf.errorTitle")}</h1>
      <ErrorState
        headingLevel={2}
        title={t("shelf.errorTitle")}
        body={t("shelf.errorBody")}
        action={
          <Button variant="secondary" onClick={retry}>
            {t("common.retry")}
          </Button>
        }
      />
    </main>
  );
}
