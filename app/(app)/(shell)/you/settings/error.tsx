"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// Settings that couldn't load (DS 4.1.19): plain language and Retry.
export default function SettingsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("settings failed to load", error.digest ?? error.name);
  }, [error]);
  return (
    <main className="mx-auto w-full max-w-reading px-4 py-12">
      <h1 className="sr-only">{t("settings.errorTitle")}</h1>
      <ErrorState
        headingLevel={2}
        title={t("settings.errorTitle")}
        body={t("settings.loadFailed")}
        action={
          <Button variant="secondary" onClick={retry}>
            {t("common.retry")}
          </Button>
        }
      />
    </main>
  );
}
