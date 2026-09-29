"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// Activity couldn't load (DS 5.17, 4.1.19): plain language and Retry. The tab
// bar and rail stay usable around it.
export default function ActivityError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("activity failed to load", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("activityScreen.errorTitle")}</h1>
      <ErrorState
        headingLevel={2}
        title={t("activityScreen.errorTitle")}
        body={t("activityScreen.errorBody")}
        action={
          <Button variant="secondary" onClick={retry}>
            {t("common.retry")}
          </Button>
        }
      />
    </main>
  );
}
