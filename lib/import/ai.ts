import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MAX_TITLES, tidyCandidate, type Candidate } from "./text";

// Reading titles out of messy text and Letterboxd screenshots (PRD F15.2,
// 9.7). One call per import, to the smallest model that does the job, with
// structured output so the reply is always the shape we expect. It reads
// what the person wrote; it never suggests anything of its own (PRD 4.3).

export const IMPORT_MODEL = "claude-haiku-4-5";

export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
export type Extraction = { candidates: Candidate[]; inputTokens: number; outputTokens: number };
export type Extract = (input: { text: string; images: ImageInput[] }, signal?: AbortSignal) => Promise<Extraction>;

/** Why the model call failed, for logs and the import_failed event (never the text). */
export type ExtractFailure = "config" | "auth" | "rate_limited" | "bad_request" | "unavailable" | "refused" | "unparsed" | "failed";

export class ExtractError extends Error {
  constructor(readonly reason: ExtractFailure) {
    super(`Couldn't read titles: ${reason}`);
    this.name = "ExtractError";
  }
}

const Reply = z.object({
  titles: z.array(
    z.object({
      title: z.string(),
      year: z.number().int().nullable(),
      type: z.enum(["movie", "tv", "unknown"]),
      note: z.string().nullable(),
      confident: z.boolean(),
    }),
  ),
});

// Fixed, so it's cached across imports and never varies by request.
const SYSTEM = `You read lists of TV shows and movies that someone would recommend to their friends, and return the titles in them.

The input is text the person typed, pasted from their notes, or dictated, and/or screenshots from Letterboxd (poster grids, lists, or diary entries).

For each show or movie mentioned, in the order it appears:
- title: the title as it's officially known, with spelling fixed if it was clearly misspelled or misheard by dictation. Never invent a title that isn't there.
- year: the release year if it's written or shown, otherwise null. Don't guess a year.
- type: "tv" for a series, "movie" for a film, "unknown" if you can't tell.
- note: if the person wrote a short reaction alongside the title (for example "so good" in "Severance, so good"), return it close to their words, under 140 characters. Otherwise null.
- confident: false if you're unsure it's a real title or unsure of the spelling.

Ignore bullets, numbering, emoji, headings, and anything that isn't a show or movie (people, actors, streaming services, episodes). List each title once. In screenshots, read every title visible, including ones shown only as posters if you can recognize them. Return at most ${MAX_TITLES} titles.`;

export const extractTitles: Extract = async ({ text, images }, signal) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new ExtractError("config");
  const client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (image): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: image.mediaType, data: image.base64 },
      }),
    ),
    { type: "text", text: text ? `Here's my list:\n\n${text}` : "Here are my screenshots." },
  ];
  let response;
  try {
    response = await client.messages.parse(
      {
        model: IMPORT_MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(Reply) },
      },
      { signal },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    // Most specific first (shared/error-codes): a bad or missing key, limits, a
    // request the API rejects, then anything else from the API or the network.
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ExtractError("auth");
    }
    if (error instanceof Anthropic.RateLimitError) throw new ExtractError("rate_limited");
    if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
      console.error("import: the API rejected the request", error.status, error.message.slice(0, 200));
      throw new ExtractError("bad_request");
    }
    if (error instanceof Anthropic.APIError) throw new ExtractError("unavailable");
    throw new ExtractError("failed");
  }
  if (response.stop_reason === "refusal") throw new ExtractError("refused");
  const parsed = response.parsed_output;
  if (!parsed) throw new ExtractError("unparsed");
  const candidates = parsed.titles
    .map(tidyCandidate)
    .filter((c): c is Candidate => c !== null)
    .slice(0, MAX_TITLES);
  return {
    candidates,
    inputTokens:
      response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
  };
};
