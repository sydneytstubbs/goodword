"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// Home couldn't load (DS 5.19, 4.1.19): plain language and Retry. The tab bar
// and rail stay usable around it.
export default function HomeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("home failed to load", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-reading px-4 py-12">
      <h1 className="sr-only">{t("home.errorTitle")}</h1>
      <ErrorState
        headingLevel={2}
        title={t("home.errorTitle")}
        body={t("home.errorBody")}
        action={
          <Button variant="secondary" onClick={retry}>
            {t("common.retry")}
          </Button>
        }
      />
    </main>
  );
}
