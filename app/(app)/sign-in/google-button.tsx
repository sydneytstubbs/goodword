"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/messages";

export function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setPending(true);
    setFailed(false);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {failed && (
        <Banner tone="error" blocking>
          {t("auth.signIn.googleRetry")}
        </Banner>
      )}
      <Button variant="secondary" size="lg" icon="google" fullWidth loading={pending} onClick={start}>
        {t("auth.signIn.google")}
      </Button>
    </div>
  );
}
