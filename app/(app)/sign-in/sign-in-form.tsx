"use client";

import { useActionState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { t } from "@/lib/messages";
import { requestLink, type SignInState } from "./actions";
import { GoogleButton } from "./google-button";

export function SignInForm({ next, expired, googleFailed, resendAction }: {
  next: string;
  expired: boolean;
  googleFailed: boolean;
  /** Present after an expired link when this browser knows the address: one tap to resend. */
  resendAction?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<SignInState, FormData>(requestLink, {});

  return (
    <div className="flex flex-col gap-6">
      {expired && (
        <Banner tone="error" blocking action={resendAction}>
          {t("auth.signIn.expired")}
        </Banner>
      )}
      {googleFailed && (
        <Banner tone="error" blocking>
          {t("auth.signIn.googleFailed")}
        </Banner>
      )}
      <form action={action} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <TextField
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          label={t("auth.signIn.emailLabel")}
          defaultValue={state.email}
          error={state.error ? t(`auth.signIn.${state.error}`) : undefined}
        />
        <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
          {t("auth.signIn.submit")}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-caption text-muted" role="separator" aria-label={t("auth.signIn.or")}>
        <span aria-hidden="true" className="h-px flex-1 bg-subtle" />
        <span aria-hidden="true">{t("auth.signIn.or")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-subtle" />
      </div>
      <GoogleButton next={next} />
    </div>
  );
}
