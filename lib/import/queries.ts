import "server-only";
import { createClient } from "@/lib/supabase/server";

// An import with cards still to review, for My Recs' resume banner (PRD
// F15.3). Your own only, through RLS: the most recent one, where to pick up,
// and how many are left.
export async function unfinishedImport(): Promise<{ importId: string; position: number; left: number } | null> {
  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("imports")
    .select("id")
    .eq("status", "reviewing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return null;
  const { data: cards, count } = await supabase
    .from("import_cards")
    .select("position", { count: "exact" })
    .eq("import_id", latest.id)
    .eq("decision", "pending")
    .order("position")
    .limit(1);
  if (!cards?.length || !count) return null;
  return { importId: latest.id as string, position: cards[0].position as number, left: count };
}
