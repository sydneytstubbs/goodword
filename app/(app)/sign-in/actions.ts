"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/paths";
import {
  clearSignInRequest,
  isValidEmail,
  readSignInRequest,
  sendSignInLink,
  type SendResult,
} from "@/lib/auth/signin-request";

export type SignInState = { error?: "invalidEmail" | "tooMany" | "sendFailed"; email?: string };

const failure: Record<Exclude<SendResult, "sent">, NonNullable<SignInState["error"]>> = {
  "too-many": "tooMany",
  "too-soon": "sendFailed",
  failed: "sendFailed",
};

const checkEmailUrl = (next: string) => `/sign-in/check-email?next=${encodeURIComponent(next)}`;

export async function requestLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!isValidEmail(email)) return { error: "invalidEmail", email };

  const result = await sendSignInLink(email, next);
  if (result !== "sent") return { error: failure[result], email };
  redirect(checkEmailUrl(next));
}

/** Resend, or "Send a new link" after an expired one. Uses the address from this browser. */
export async function resendLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNext(String(formData.get("next") ?? ""));
  const previous = await readSignInRequest();
  if (!previous) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (previous.secondsLeft > 0) return { error: "sendFailed", email: previous.email };

  const result = await sendSignInLink(previous.email, next);
  if (result !== "sent") return { error: failure[result], email: previous.email };
  redirect(`${checkEmailUrl(next)}&sent=1`);
}

export async function useDifferentEmail(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""));
  await clearSignInRequest();
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}

/** "Send a new link" on the expired-link banner: one tap, no state to return. */
export async function resendFromBanner(formData: FormData) {
  const next = safeNext(String(formData.get("next") ?? ""));
  const previous = await readSignInRequest();
  if (previous && (await sendSignInLink(previous.email, next)) === "sent") redirect(`${checkEmailUrl(next)}&sent=1`);
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}
