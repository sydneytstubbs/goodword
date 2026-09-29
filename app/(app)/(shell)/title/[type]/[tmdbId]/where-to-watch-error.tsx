"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";

// Where to watch didn't load: an error in its own region, with Retry (DS 4.1.19).
export function WhereToWatchError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ErrorState
      headingLevel={3}
      title={t("whereToWatch.errorTitle")}
      body={t("whereToWatch.errorBody")}
      className="md:mx-0 md:items-start md:text-start"
      action={
        <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())}>
          {t("common.retry")}
        </Button>
      }
    />
  );
}
