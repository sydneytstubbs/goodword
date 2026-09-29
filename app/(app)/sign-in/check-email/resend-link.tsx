"use client";

import { useActionState, useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/messages";
import { resendLink, type SignInState } from "../actions";

// Resend opens after 30 seconds with a visible countdown (DS 5.3). The number
// ticks silently; screen readers hear once when the button becomes available.
export function ResendLink({ next, initialSeconds, justSent }: { next: string; initialSeconds: number; justSent: boolean }) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [state, action, pending] = useActionState<SignInState, FormData>(resendLink, {});

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const waiting = seconds > 0;

  return (
    <form action={action} className="flex flex-col items-start gap-3">
      <input type="hidden" name="next" value={next} />
      {justSent && <Banner>{t("auth.checkEmail.resent")}</Banner>}
      {state.error && (
        <Banner tone="error" blocking>
          {t(`auth.signIn.${state.error === "invalidEmail" ? "invalidEmail" : state.error}`)}
        </Banner>
      )}
      <Button type="submit" variant="secondary" aria-disabled={waiting || undefined} loading={pending}>
        {waiting ? t("auth.checkEmail.resendIn", { seconds }) : t("auth.checkEmail.resend")}
      </Button>
      <p role="status" className="sr-only">
        {waiting ? "" : t("auth.checkEmail.resendReady")}
      </p>
    </form>
  );
}
