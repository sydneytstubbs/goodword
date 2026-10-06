"use client";

import { copyText } from "@/lib/clipboard";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/messages";
import { resetShareLink, setShareLink } from "./actions";

export type ShareState = { enabled: boolean; token: string | null; views: number };

// Settings › Share my list (PRD F9, J7, DS 5.14): off by default. On shows
// the link with Copy and Share, and how many times it's been opened. Off, or
// Reset link, stops the old link at once; turning it back on makes a new one.
export function ShareList({ origin, initial }: { origin: string; initial: ShareState }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { showToast } = useToast();
  const link = state.token ? `${origin}/s/${state.token}` : "";

  const toggle = async (on: boolean) => {
    if (busy) return;
    const before = state;
    setState((s) => ({ ...s, enabled: on }));
    setBusy(true);
    const token = await setShareLink(on).catch(() => null);
    setBusy(false);
    if (token) {
      setState((s) => ({ enabled: on, token, views: on && !before.enabled ? 0 : s.views }));
      return;
    }
    setState(before);
    showToast({ message: t("settings.didntSave"), action: { label: t("common.retry"), onAction: () => toggle(on) } });
  };

  const reset = async () => {
    setBusy(true);
    const token = await resetShareLink().catch(() => null);
    setBusy(false);
    setConfirmReset(false);
    if (!token) {
      showToast({ message: t("settings.didntSave"), action: { label: t("common.retry"), onAction: reset } });
      return;
    }
    setState({ enabled: true, token, views: 0 });
    showToast({ message: t("settings.shareResetDone") });
  };

  const copy = async () => {
    showToast({ message: (await copyText(link)) ? t("settings.shareCopied") : t("invite.copyFailed") });
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: t("settings.shareShareText"), url: link });
    } catch {
      // Dismissing the share sheet isn't an error.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Switch
        id="share-list"
        label={t("settings.shareSwitch")}
        description={t("settings.shareHint")}
        checked={state.enabled}
        onCheckedChange={toggle}
        className="py-3"
      />
      {state.enabled && state.token && (
        <div className="flex flex-col gap-3">
          <TextField label={t("settings.shareLinkLabel")} value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
          <p className="text-caption text-muted">{t("settings.shareViews", { count: state.views })}</p>
          <div className="flex flex-col gap-3 md:flex-row">
            <Button variant="secondary" icon="copyLink" fullWidth onClick={copy}>
              {t("settings.shareCopy")}
            </Button>
            <Button variant="secondary" icon="share" fullWidth onClick={share}>
              {t("settings.shareShare")}
            </Button>
          </div>
          <Button variant="ghost" className="self-start" onClick={() => setConfirmReset(true)}>
            {t("settings.shareReset")}
          </Button>
        </div>
      )}
      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t("settings.shareResetTitle")}
        description={t("settings.shareResetBody")}
        irreversible
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={reset}>
              {t("settings.shareResetConfirm")}
            </Button>
          </>
        }
      />
    </div>
  );
}
