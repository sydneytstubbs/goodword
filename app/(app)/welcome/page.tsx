import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/domain/wordmark";
import { safeNext } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Welcome · Good Word" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const { user, profile } = await requireUser("/welcome");
  if (profile?.onboarded_at && profile.display_name) redirect(next);

  // Prefilled from Google when available.
  const meta = user.user_metadata as { full_name?: string; name?: string };
  const initialName = (meta.full_name ?? meta.name ?? "").trim().slice(0, 30);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
      <Wordmark />
      <h1 className="text-display-m text-default">{t("auth.welcome.title")}</h1>
      <WelcomeForm next={next} initialName={initialName} />
    </main>
  );
}
