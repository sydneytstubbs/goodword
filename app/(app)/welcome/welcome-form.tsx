"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { t } from "@/lib/messages";
import { saveName, type WelcomeState } from "./actions";

export function WelcomeForm({ next, initialName }: { next: string; initialName: string }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(saveName, {});

  // Region and timezone come from the browser (PRD F1); Settings edits region later.
  function submit(formData: FormData) {
    const locale = new Intl.Locale(navigator.language).maximize();
    formData.set("region", locale.region ?? "US");
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    action(formData);
  }

  return (
    <form action={submit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <TextField
        name="name"
        label={t("auth.welcome.nameLabel")}
        helper={t("auth.welcome.body")}
        autoComplete="given-name"
        maxLength={30}
        // A Google account without a name leaves the field empty with focus (PRD F1).
        autoFocus={!initialName}
        defaultValue={state.name ?? initialName}
        error={state.error ? t(`auth.welcome.${state.error}`) : undefined}
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {t("auth.welcome.submit")}
      </Button>
    </form>
  );
}
