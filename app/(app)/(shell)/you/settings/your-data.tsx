"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { buttonBase, buttonSizes, buttonVariants } from "@/components/ui/button-styles";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { deleteAccount } from "./actions";

// Settings › Your data (PRD F1, DS 5.14): download my data, and delete my
// account behind a dialog that names the consequences (DS 5.11). Deleting is
// never the default focus and never cobalt.
export function YourData() {
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDeleting] = useTransition();

  const confirmDelete = () =>
    startDeleting(async () => {
      // Success redirects to sign-in; only a failure comes back.
      const result = await deleteAccount().catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setConfirming(false);
        showToast({ message: t("settings.deleteFailed") });
      }
    });

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="flex flex-col items-start gap-2">
        <a href="/api/me/export" download className={cn(buttonBase, buttonVariants.secondary, buttonSizes.md)}>
          {t("settings.download")}
        </a>
        <p className="text-caption text-muted">{t("settings.downloadHint")}</p>
      </div>

      <Button variant="danger" icon="remove" onClick={() => setConfirming(true)}>
        {t("settings.deleteAccount")}
      </Button>

      <Dialog
        open={confirming}
        onClose={() => !deleting && setConfirming(false)}
        title={t("settings.deleteTitle")}
        description={t("settings.deleteBody")}
        irreversible
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              {t("settings.deleteConfirm")}
            </Button>
          </>
        }
      />
    </div>
  );
}
