import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanProps, type EventName, type EventProps } from "./schema";

// Record an event (PRD 11). Never throws and never slows the flow it's in:
// the write happens after the response is sent (next/server `after`), and a
// lost event is better than a failed action. Pass `userId` when it's already
// known; otherwise it's read from the session (null if signed out).
export async function recordEvent<N extends EventName>(name: N, props: EventProps<N> = {}, userId?: string | null): Promise<void> {
  try {
    let who = userId;
    if (who === undefined) {
      const { data } = await (await createClient()).auth.getClaims();
      who = (data?.claims?.sub as string | undefined) ?? null;
    }
    const row = { name, user_id: who, properties: cleanProps(name, props), occurred_at: new Date().toISOString() };
    after(async () => {
      const { error } = await createAdminClient().from("events").insert(row);
      if (error) console.error("event not recorded", name, error.code);
    });
  } catch {
    console.error("event not recorded", name);
  }
}
