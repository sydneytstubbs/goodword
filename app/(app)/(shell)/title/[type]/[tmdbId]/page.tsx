import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Poster } from "@/components/domain/poster";
import { titleMeta } from "@/components/domain/title-meta";
import type { TitleType } from "@/components/domain/types";
import { cn } from "@/lib/cn";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";
import { getTitle, type CachedTitle } from "@/lib/titles/cache";
import { TitleUnavailable } from "./title-unavailable";

// Title detail, step 3 stub (PRD F6): what the title cache knows (poster,
// title, meta, genres, overview), so picking a search result lands somewhere
// true. Good words, the vouch button, and where to watch arrive in steps 4
// and 5, which build this screen out per DS 4.2.2 and 5.7.

function parse(params: { type: string; tmdbId: string }): { type: TitleType; tmdbId: number } | null {
  if (params.type !== "movie" && params.type !== "tv") return null;
  if (!/^[1-9]\d{0,8}$/.test(params.tmdbId)) return null;
  return { type: params.type, tmdbId: Number(params.tmdbId) };
}

async function load(type: TitleType, tmdbId: number): Promise<{ title: CachedTitle | null } | { failed: true }> {
  try {
    return { title: await getTitle(type, tmdbId) };
  } catch {
    return { failed: true };
  }
}

export async function generateMetadata({ params }: PageProps<"/title/[type]/[tmdbId]">): Promise<Metadata> {
  const parsed = parse(await params);
  const result = parsed ? await load(parsed.type, parsed.tmdbId) : null;
  // "The Night Ferry · Good Word" (F6).
  return { title: result && "title" in result && result.title ? `${result.title.name} · Good Word` : "Good Word" };
}

export default async function TitlePage({ params }: PageProps<"/title/[type]/[tmdbId]">) {
  const raw = await params;
  await requireOnboardedUser(`/title/${raw.type}/${raw.tmdbId}`);
  const parsed = parse(raw);
  if (!parsed) notFound();

  const result = await load(parsed.type, parsed.tmdbId);
  if ("failed" in result) return <TitleUnavailable />;
  const title = result.title;
  if (!title) notFound();

  // Step down to 44px when 56px would need three lines (DS 3.2.2).
  const long = title.name.length > 22;
  return (
    <main className="mx-auto flex w-full max-w-detail flex-col gap-6 px-4 pt-2 pb-12 lg:flex-row lg:items-start lg:gap-10">
      <Poster title={title} size="detail" eager className="lg:w-72" />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className={cn("text-default", long ? "text-title-l-step" : "text-title-l")}>{title.name}</h1>
          <p className="text-caption text-muted">{titleMeta(title, true)}</p>
          {title.genres.length > 0 && (
            <p className="text-caption text-muted">
              <span className="sr-only">{t("title.genres")}: </span>
              {title.genres.join(t("title.metaSeparator"))}
            </p>
          )}
        </div>
        {title.overview && <p className="max-w-reading text-body text-default">{title.overview}</p>}
      </div>
    </main>
  );
}
