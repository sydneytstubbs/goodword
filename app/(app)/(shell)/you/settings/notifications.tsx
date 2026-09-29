"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { EmailPref } from "@/lib/email/secrets";
import { t, type MessageKey } from "@/lib/messages";
import { setNotificationPref } from "./actions";

export type Prefs = Record<EmailPref, boolean>;

const SWITCHES: Array<{ pref: EmailPref; label: MessageKey; hint: MessageKey }> = [
  { pref: "digest", label: "settings.digest", hint: "settings.digestHint" },
  { pref: "mention_email", label: "settings.mentions", hint: "settings.mentionsHint" },
  { pref: "group_joins", label: "settings.groupJoins", hint: "settings.groupJoinsHint" },
];

// Switches take effect immediately (DS 5.16). Each flips at once and rolls
// back with a Retry toast if the save fails (DS 5.10). No success toast: the
// switch itself shows the change.
export function NotificationSettings({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const { showToast } = useToast();

  const change = async (pref: EmailPref, on: boolean) => {
    setPrefs((p) => ({ ...p, [pref]: on }));
    const ok = await setNotificationPref(pref, on).catch(() => false);
    if (ok) return;
    setPrefs((p) => ({ ...p, [pref]: !on }));
    showToast({ message: t("settings.didntSave"), action: { label: t("common.retry"), onAction: () => change(pref, on) } });
  };

  return (
    <div className="flex flex-col divide-y divide-subtle">
      {SWITCHES.map(({ pref, label, hint }) => (
        <Switch
          key={pref}
          id={`pref-${pref}`}
          label={t(label)}
          description={t(hint)}
          checked={prefs[pref]}
          onCheckedChange={(on) => change(pref, on)}
          className="py-3"
        />
      ))}
    </div>
  );
}
