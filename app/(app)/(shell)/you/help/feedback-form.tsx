"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/messages";
import { sendFeedback, type FeedbackResult } from "./actions";

const ERRORS: Record<Exclude<FeedbackResult["status"], "sent">, Parameters<typeof t>[0]> = {
  empty: "help.feedbackEmpty",
  too_long: "help.feedbackTooLong",
  rate_limited: "help.feedbackLimit",
  failed: "help.feedbackFailed",
};

// Send feedback (PRD F11): a message and an optional "OK to follow up".
// Nothing is lost on failure: the text stays, with the reason and a way on
// (DS 6.5). The id is made once per message so a retry never duplicates it.
export function FeedbackForm() {
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [mayContact, setMayContact] = useState(false);
  const [error, setError] = useState<Exclude<FeedbackResult["status"], "sent"> | null>(null);
  const [sending, startSending] = useTransition();
  const id = useRef<string>(crypto.randomUUID());
  const field = useRef<HTMLTextAreaElement>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setError("empty");
      field.current?.focus();
      return;
    }
    startSending(async () => {
      const result = await sendFeedback(id.current, message, mayContact).catch((): FeedbackResult => ({ status: "failed" }));
      if (result.status === "sent") {
        setMessage("");
        setMayContact(false);
        setError(null);
        id.current = crypto.randomUUID();
        showToast({ message: t("help.feedbackSent") });
      } else {
        setError(result.status);
      }
    });
  };

  const fieldError = error === "empty" || error === "too_long" ? t(ERRORS[error]) : undefined;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col items-start gap-4">
      {error && !fieldError && (
        <Banner tone="error" blocking>
          {t(ERRORS[error])}
        </Banner>
      )}
      <Textarea
        ref={field}
        label={t("help.feedbackLabel")}
        value={message}
        onValueChange={(value) => {
          setMessage(value);
          if (error && value.trim()) setError(null);
        }}
        maxLength={2000}
        counterAt={1800}
        minRows={4}
        maxRows={10}
        error={fieldError}
        className="w-full"
      />
      <Checkbox label={t("help.feedbackContact")} checked={mayContact} onChange={(e) => setMayContact(e.target.checked)} />
      <Button type="submit" variant="primary" loading={sending}>
        {t("help.feedbackSend")}
      </Button>
    </form>
  );
}
