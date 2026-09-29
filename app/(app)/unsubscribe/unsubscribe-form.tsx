"use client";

import { useActionState, useEffect, useRef } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import type { EmailPref } from "@/lib/email/secrets";
import { t } from "@/lib/messages";
import { applyUnsubscribe, type UnsubscribeState } from "./actions";

// One tap from the email: the page submits its own form as it loads, then
// confirms and offers Undo (PRD F7.7). Without JavaScript the same form is a
// button. Mail scanners that only fetch the link change nothing.
export function UnsubscribeForm({ token, pref }: { token: string; pref: EmailPref }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(applyUnsubscribe, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const submitted = useRef(false);
  const kind = t(`unsubscribe.kind.${pref}`);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    form.current?.requestSubmit();
  }, []);

  // Move focus to the new heading when the result arrives (DS 7.2).
  useEffect(() => {
    if (state.status !== "idle") heading.current?.focus();
  }, [state]);

  const turnOn = state.status === "off" || (state.status === "failed" && state.lastOn === true);
  const title =
    pending && state.status === "idle"
      ? t("unsubscribe.working", { kind })
      : state.status === "off"
        ? t("unsubscribe.done", { kind })
        : state.status === "on"
          ? t("unsubscribe.undone", { kind })
          : t("unsubscribe.confirm", { kind });

  return (
    <div className="flex flex-col gap-6">
      <h1 ref={heading} tabIndex={-1} className="text-display-m text-default break-words">
        {title}
      </h1>
      {state.status === "off" && <p className="text-body text-muted">{t("unsubscribe.doneBody")}</p>}
      {state.status === "failed" && (
        <Banner tone="error" blocking>
          {t("unsubscribe.failed")}
        </Banner>
      )}
      <form ref={form} action={action} className="flex flex-col items-start gap-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="on" value={turnOn ? "true" : "false"} />
        {state.status === "off" ? (
          <Button type="submit" variant="secondary" loading={pending}>
            {t("common.undo")}
          </Button>
        ) : state.status === "on" ? null : (
          <Button type="submit" variant="primary" loading={pending}>
            {state.status === "failed" ? t("common.retry") : t("unsubscribe.confirm", { kind })}
          </Button>
        )}
      </form>
      <TextLink href="/you/settings" variant="standalone" className="self-start">
        {t("unsubscribe.openSettings")}
      </TextLink>
    </div>
  );
}
