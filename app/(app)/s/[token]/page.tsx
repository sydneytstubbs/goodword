import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { Poster } from "@/components/domain/poster";
import { titleMeta } from "@/components/domain/title-meta";
import { Wordmark } from "@/components/domain/wordmark";
import { t } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordToTitle, type TitleRecord } from "@/lib/tmdb/normalize";

// A shared shelf (PRD F9, J7): read-only, for anyone with the link. The
// owner's name and their own good words (poster, title, year, their note),
// newest first, and a small "Made with Good Word" link. Never groups, other
// people, or other people's notes. noindex, and no analytics beyond the view
// count the database keeps for the owner. A link that's off or reset is a
// plain 404.

export const metadata: Metadata = { title: "Good Word", robots: { index: false, follow: false } };

type Row = { owner_name: string; title: (Omit<TitleRecord, "overview" | "original_title"> & { tmdb_id: number | null }) | null; note: string | null };

export default async function SharedShelfPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const { data, error } = await createAdminClient().rpc("shared_shelf", { p_token: token });
  if (error) throw new Error("shared shelf didn't load");
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) notFound();
  const name = rows[0].owner_name;
  const items = rows.flatMap((row) => (row.title?.tmdb_id ? [{ title: recordToTitle(row.title), note: row.note }] : []));

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8 md:py-12">
      <header>
        <Wordmark />
      </header>
      <main id="main" className="flex flex-col gap-8">
        <h1 className="text-display-m text-default">{t("share.title", { name })}</h1>
        {items.length === 0 ? (
          <p className="text-body text-muted">{t("share.empty", { name })}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {items.map(({ title, note }) => (
              <li key={title.id} className="flex flex-col gap-2.5">
                <Poster title={title} />
                <span className="flex flex-col gap-1">
                  <span className="line-clamp-2 text-card-title text-default">{title.name}</span>
                  <span className="text-caption text-muted">{titleMeta(title)}</span>
                </span>
                {note && <span className="text-caption text-muted">“{note}”</span>}
              </li>
            ))}
          </ul>
        )}
      </main>
      <footer className="border-t border-subtle pt-6">
        <NextLink href="/" className="inline-flex min-h-target items-center rounded-control text-caption text-muted underline-offset-4 hover:underline">
          {t("share.madeWith")}
        </NextLink>
      </footer>
    </div>
  );
}
