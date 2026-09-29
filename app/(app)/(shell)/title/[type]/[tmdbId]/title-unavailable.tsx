"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// TMDB is unreachable and this title isn't cached yet (PRD 9.1): an error
// state with Retry (DS 4.1.19). The rest of the app keeps working.
export function TitleUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("titleDetail.errorTitle")}</h1>
      <ErrorState
        headingLevel={2}
        title={t("titleDetail.errorTitle")}
        body={t("titleDetail.errorBody")}
        action={
          <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())}>
            {t("common.retry")}
          </Button>
        }
      />
    </main>
  );
}
