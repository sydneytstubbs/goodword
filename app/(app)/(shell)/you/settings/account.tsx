"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { fieldBase, TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { saveName, saveRegion, signOut } from "./actions";

// Settings › Account (PRD F11): name, email (read-only), region, sign out.
// The name saves on its button and confirms with a toast; the region saves as
// soon as it's picked (DS 5.16). Both roll back with Retry if the save fails.
export function AccountSettings({
  name: initialName,
  email,
  region: initialRegion,
  regions,
}: {
  name: string;
  email: string;
  region: string;
  regions: Array<{ code: string; name: string }>;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, startSaving] = useTransition();
  const [region, setRegion] = useState(initialRegion);
  const regionId = useId();

  const submitName = (event?: FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) {
      setNameError(t("settings.nameRequired"));
      return;
    }
    setNameError(null);
    startSaving(async () => {
      const result = await saveName(name).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (result.ok) showToast({ message: t("settings.nameSaved") });
      else if (result.error === "nameRequired") setNameError(t("settings.nameRequired"));
      else showToast({ message: t("settings.didntSave"), action: { label: t("common.retry"), onAction: () => submitName() } });
    });
  };

  const changeRegion = async (next: string, previous: string) => {
    setRegion(next);
    const ok = await saveRegion(next).catch(() => false);
    if (ok) {
      showToast({ message: t("settings.regionSaved") });
      return;
    }
    setRegion(previous);
    showToast({ message: t("settings.didntSave"), action: { label: t("common.retry"), onAction: () => changeRegion(next, previous) } });
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submitName} noValidate className="flex flex-col items-start gap-3">
        <TextField
          label={t("settings.name")}
          helper={t("settings.nameHint")}
          error={nameError ?? undefined}
          aria-invalid={nameError ? true : undefined}
          value={name}
          maxLength={30}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && setNameError(null)}
          className="w-full"
        />
        <Button type="submit" variant="secondary" loading={savingName}>
          {t("settings.saveName")}
        </Button>
      </form>

      <TextField label={t("settings.email")} helper={t("settings.emailHint")} value={email} readOnly type="email" />

      <div className="flex flex-col gap-2">
        <label htmlFor={regionId} className="text-label text-default">
          {t("settings.region")}
        </label>
        <select
          id={regionId}
          value={region}
          aria-describedby={`${regionId}-hint`}
          onChange={(e) => changeRegion(e.target.value, region)}
          className={cn(fieldBase, "h-11 px-3")}
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <p id={`${regionId}-hint`} className="text-caption text-muted">
          {t("settings.regionHint")}
        </p>
      </div>

      <form action={signOut}>
        <Button type="submit" variant="secondary" icon="signOut">
          {t("settings.signOut")}
        </Button>
      </form>
    </div>
  );
}
