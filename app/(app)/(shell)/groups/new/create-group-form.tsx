"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { t } from "@/lib/messages";
import { createGroup, type CreateState } from "../actions";
import { duplicateOf } from "../names";

export function CreateGroupForm({ existingNames }: { existingNames: string[] }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createGroup, {});
  const [name, setName] = useState(state.name ?? "");
  const [checked, setChecked] = useState(false);
  // Warn, don't block, on a name you already have (F2.1). Checked on blur, not per keystroke (DS 5.9).
  const duplicate = checked ? duplicateOf(name, existingNames) : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <TextField
        name="name"
        label={t("groups.new.nameLabel")}
        placeholder={t("groups.new.placeholder")}
        helper={duplicate ? t("groups.new.duplicate", { name: duplicate }) : t("groups.new.examples")}
        maxLength={40}
        autoComplete="off"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setChecked(true)}
        error={state.error ? t(`groups.new.${state.error}`) : undefined}
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {t("groups.new.submit")}
      </Button>
    </form>
  );
}
