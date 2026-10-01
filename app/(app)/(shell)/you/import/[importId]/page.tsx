import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/groups/queries";
import type { CardCandidate } from "@/lib/import/match";
import { t } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { ReviewDeck, type DeckCard } from "./review-deck";

export const metadata: Metadata = { title: `${t("importDeck.title")} · Good Word` };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ImportRow = { id: string; status: string; group_ids: string[]; duplicate_count: number };
type CardRow = {
  id: string;
  position: number;
  query: string;
  note: string;
  confidence: "high" | "low";
  candidates: CardCandidate[];
  chosen: number;
  decision: "pending" | "added" | "skipped";
};

// The review deck and done screen for one import (PRD F15.3). Your own
// imports only: anyone else's, or one that doesn't exist, is a 404.
export default async function ReviewDeckPage({ params, searchParams }: PageProps<"/you/import/[importId]">) {
  const { importId } = await params;
  const { user } = await requireOnboardedUser(`/you/import/${importId}`);
  if (!UUID.test(importId)) notFound();
  const supabase = await createClient();
  const [{ data: row }, { data: cards }, groups] = await Promise.all([
    supabase.from("imports").select("id, status, group_ids, duplicate_count").eq("id", importId).maybeSingle<ImportRow>(),
    supabase
      .from("import_cards")
      .select("id, position, query, note, confidence, candidates, chosen, decision")
      .eq("import_id", importId)
      .order("position")
      .returns<CardRow[]>(),
    listMyGroups(user.id),
  ]);
  if (!row) notFound();

  if (row.status === "parsing" || row.status === "failed" || row.status === "cancelled") {
    const parsing = row.status === "parsing";
    return (
      <main className="mx-auto w-full max-w-reading px-4 py-12">
        <h1 className="sr-only">{t("importDeck.title")}</h1>
        <EmptyState
          title={parsing ? t("importDeck.stillFindingTitle") : t("importDeck.unfinishedTitle")}
          body={parsing ? t("importDeck.stillFindingBody") : t("importDeck.unfinishedBody")}
          action={
            <ButtonLink href="/you/import" variant="secondary">
              {t("importDeck.startAgain")}
            </ButtonLink>
          }
        />
      </main>
    );
  }

  const search = await searchParams;
  const card = Number(Array.isArray(search.card) ? search.card[0] : search.card);
  const inImport = groups.filter((g) => row.group_ids.includes(g.id));
  const deck: DeckCard[] = (cards ?? []).map((c) => ({
    id: c.id,
    position: c.position,
    query: c.query,
    note: c.note,
    confidence: c.confidence,
    candidates: c.candidates,
    chosen: c.chosen,
    decision: c.decision,
  }));

  return (
    <ReviewDeck
      importId={importId}
      cards={deck}
      duplicates={row.duplicate_count}
      startAt={Number.isInteger(card) && card > 0 ? card : null}
      truncated={search.more === "1"}
      groups={inImport.map((g) => ({ id: g.id, name: g.name, memberCount: g.members.length }))}
      peopleCount={new Set(inImport.flatMap((g) => g.members.map((m) => m.id))).size}
    />
  );
}
