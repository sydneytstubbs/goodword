import { createHash } from "node:crypto";
import { ExtractError, type ImageInput } from "@/lib/import/ai";
import { costMicrodollars } from "@/lib/import/cost";
import { runImport } from "@/lib/import/pipeline";
import { existingKeys, importDeps } from "@/lib/import/server";
import { lengthBucket, MAX_SCREENSHOTS, MAX_TEXT, type Candidate } from "@/lib/import/text";
import { recordEvent } from "@/lib/events/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Add recs (PRD F15): POST /api/import with form data (`text`, up to 5
// `image` files, `group` ids). Signed-in only; 10 imports a day. Streams
// newline-delimited JSON: {type:"found",count} as titles are matched, then
// {type:"done",importId,...} or {type:"error",reason}. Screenshots are read
// once and never stored. Neither the text nor the titles are logged.

export const maxDuration = 60;

// Shrunk in the browser to about 1568px; this leaves room under Vercel's
// 4.5MB request limit for 5 of them.
const MAX_IMAGE_BYTES = 850_000;

const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });

function imageType(bytes: Uint8Array): ImageInput["mediaType"] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return fail("signed_out", 401);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return fail("signed_out", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("bad_input", 400);
  }
  const text = String(form.get("text") ?? "").trim();
  const files = form.getAll("image").filter((f): f is File => f instanceof File);
  const groups = form.getAll("group").map(String).slice(0, 20);
  const friends = form.get("friends") === "1";
  if (text.length > MAX_TEXT || files.length > MAX_SCREENSHOTS) return fail("too_much", 413);
  if (!text && files.length === 0) return fail("bad_input", 400);

  const images: ImageInput[] = [];
  const digest = createHash("sha256").update(text);
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) return fail("too_much", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = imageType(bytes);
    if (!mediaType) return fail("bad_input", 400);
    digest.update(bytes);
    images.push({ mediaType, base64: Buffer.from(bytes).toString("base64") });
  }
  const method = text && images.length ? "both" : images.length ? "screenshots" : "text";

  const { data: started, error } = await supabase.rpc("start_import", {
    p_method: method,
    p_hash: digest.digest("hex"),
    p_groups: groups,
    p_friends: friends,
  });
  const row = (started as Array<{ status: string; import_id: string | null; reuse: Candidate[] | null }> | null)?.[0];
  if (error || !row) return fail("failed", 500);
  if (row.status === "limited") return fail("limited", 429);
  const importId = row.import_id!;
  await recordEvent(
    "import_started",
    { method, screenshot_count: images.length, text_length_bucket: lengthBucket(text.length) },
    userId,
  );

  const admin = createAdminClient();
  const startedAt = Date.now();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: object) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
        } catch {
          // The browser went away (Cancel); the abort below handles it.
        }
      };
      try {
        const existing = await existingKeys(supabase, userId);
        const result = await runImport(
          { text, images, reuse: row.reuse },
          importDeps(existing),
          (count) => send({ type: "found", count }),
          request.signal,
        );
        if (result.cards.length > 0) {
          const { error: insertError } = await admin.from("import_cards").insert(
            result.cards.map((card, i) => ({
              import_id: importId,
              user_id: userId,
              position: i + 1,
              query: card.query,
              note: card.note,
              confidence: card.confidence,
              candidates: card.candidates,
            })),
          );
          if (insertError) throw new Error(`cards not saved: ${insertError.code}`);
        }
        await admin
          .from("imports")
          .update({
            status: result.cards.length > 0 ? "reviewing" : "done",
            found_count: result.cards.length,
            duplicate_count: result.duplicates,
            extracted: result.extracted,
            ai_input_tokens: result.inputTokens,
            ai_output_tokens: result.outputTokens,
            ...(result.cards.length === 0 ? { completed_at: new Date().toISOString() } : {}),
          })
          .eq("id", importId);
        await recordEvent(
          "import_parsed",
          {
            found_count: result.cards.length,
            duplicate_count: result.duplicates,
            high_confidence_count: result.cards.filter((c) => c.confidence === "high").length,
            ai_used: result.aiUsed,
            reused: Boolean(row.reuse),
            ai_input_tokens: result.inputTokens,
            ai_output_tokens: result.outputTokens,
            ai_cost_microdollars: costMicrodollars(result.inputTokens, result.outputTokens),
            ms_elapsed: Date.now() - startedAt,
          },
          userId,
        );
        send({ type: "done", importId, found: result.cards.length, duplicates: result.duplicates, truncated: result.truncated });
      } catch (err) {
        if (request.signal.aborted) {
          await admin.from("imports").update({ status: "cancelled" }).eq("id", importId).eq("status", "parsing");
        } else {
          console.error("import failed", (err as Error).name, (err as Error).message.slice(0, 80));
          await admin.from("imports").update({ status: "failed" }).eq("id", importId);
          await recordEvent(
            "import_failed",
            err instanceof ExtractError ? { stage: "parse", reason: err.reason } : { stage: "save", reason: "failed" },
            userId,
          );
          send({ type: "error", reason: "failed" });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the browser.
        }
      }
    },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson" } });
}
