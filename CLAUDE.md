# Good Word

A private, mobile-first web app where small groups of friends keep a shared shelf of the shows and movies they'd vouch for, and talk about them. Humans do all the recommending; the app never recommends on its own.

Owner: Sydney (product and design). She reviews every slice on her phone before the next one starts.

---

## Read before doing anything

The docs in `/docs` are the source of truth. Read them in this order at the start of a session, and reread the relevant sections before each task.

1. `docs/PRODUCT-REQUIREMENTS.md`: **what** the product does: scope, flows, data, integrations, and the build plan (Section 12).
2. `docs/DESIGN-SYSTEM.md`: **how** it looks, behaves, and reads: tokens, components, patterns, copy, accessibility.
3. `docs/BRAND.md`: the identity the design system expresses.
4. `docs/good-word-marketing-page-spec.md`: the marketing page only.

**When docs conflict:** the PRD wins on *what*, the design system wins on *how*. When a doc and the code disagree, or a requirement seems wrong or missing, **stop and ask**. Never silently pick one, and never invent features, screens, or settings.

**Keep the docs true:** if Sydney changes a decision in conversation, update the relevant doc first (with a changelog line), then change the code.

---

## Build order and status

Work through these steps in order. Update this table when a step is reviewed and accepted.

| Step | Scope | Source | Status |
|---|---|---|---|
| 0 | Foundations: tokens, fonts, Tailwind mapping, lint rules, `/styleguide` | DS 11.6 steps 1–2, DS 14 | Done |
| M | Rebuild the marketing page on the new system | Marketing spec v2, DS 11.6 steps 3–5 | Done |
| 1 | Accounts | PRD 12, slice 1 | Done |
| 2 | Groups | PRD 12, slice 2 | Done |
| 3 | Titles (TMDB) | PRD 12, slice 3 | Done |
| 4 | The core loop | PRD 12, slice 4 | Done |
| 5 | Choosing | PRD 12, slice 5 | Done |
| 6 | Conversations | PRD 12, slice 6 | In review |
| 7 | Email | PRD 12, slice 7 | Done (email polish deferred; see PRD changelog v1.2.10) |
| 8 | Settings and trust | PRD 12, slice 8 | Not started |
| 9 | Measurement | PRD 12, slice 9 | Not started |
| 10 | P1 extras | PRD 12, slice 10 | Not started |

Before starting a step, check PRD Section 15 for open questions that step depends on, and ask about any that are still open.

---

## How to work

- **One step per session.** Start in plan mode: summarize what you'll build, list the files you'll touch, and name any doc sections you're unsure about. Wait for approval before writing code.
- **Stay inside the step.** Don't build ahead. If later work needs a stub, say so and keep it minimal.
- **End every step with a report:** what was built, how to test it on a phone, what deviates from the docs and why, and open questions. Then stop.
- **Done means done:** a screen is finished only when it meets the screen definition of done (DS 12.1); a component only when it meets DS 12.2; a step only when its "done when" line in PRD 12 passes.
- **Test on iOS Safari first** (390px wide), then check 360, 768, 1024, and 1440.
- **Ask, don't guess,** about product decisions. Ask about implementation details only when they affect behavior or cost.

---

## Stack

- Next.js (App Router) on Vercel, TypeScript
- Supabase: Postgres, Auth (magic link and Google), Realtime (for conversations)
- Tailwind CSS mapped to the design system tokens
- TMDB API (server-side only), JustWatch attribution for where-to-watch
- Resend for all email: sign-in links from step 1 (as Supabase Auth's SMTP sender), product email from step 7

**Commands** (pnpm):
- `pnpm dev`: local dev server at http://localhost:3000 (styleguide at `/styleguide`)
- `pnpm build`: lint, then production build
- `pnpm lint`: ESLint (with the design system rules in `eslint-rules/`) and Stylelint
- `pnpm typecheck`: generate route types, then `tsc --noEmit`
- `pnpm test`: unit tests (lib helpers, lint rules, type tokens) with Vitest
- `pnpm test:e2e`: Playwright on `/styleguide`: axe in both themes, keyboard behavior, visual snapshots at 390 and 1440. Run after `pnpm build`; add `--update-snapshots` after an intended visual change. Playwright is pinned to 1.56.1 (and its Chromium build) so snapshots match CI; upgrade it deliberately and regenerate snapshots in the same change.

Next.js 16 has breaking changes from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next.js code.

**Environment variables** (never commit values; keep `.env.example` current):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_READ_TOKEN`, `APP_URL`, and `EMAIL_API_KEY` (Resend, from step 1). For database migrations and auth settings: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`. If one is missing, tell Sydney which one and where to get it; don't work around it.

---

## Hard rules

These come from the docs. Breaking one is a bug.

**Design**
- Use only semantic tokens from `styles/tokens.css` in components. No hex values, raw primitives, or Tailwind arbitrary values (`bg-[#...]`, `text-[17px]`).
- Fonts are Inter and Instrument Serif only. Instrument Serif is for display text at 24px and up.
- Icons are Phosphor only (`@phosphor-icons/react`, `regular` weight), through the one `Icon` wrapper.
- No UI component library (MUI, shadcn, Chakra). Hand-build with Tailwind. Headless accessibility helpers are allowed only per DS 11.4.
- No gradients, glass, glows, hard shadows, rotation, stickers, handwriting, illustration, or emoji in UI.
- One primary (cobalt) action per screen.
- Every screen designs all states from DS 5.12: ideal, empty, no results, loading, partial, error, offline.
- Dark mode tokens exist but are not enabled for users (DS 3.10).

**Content**
- All UI copy lives in `messages/en.json`, never hardcoded in components.
- Use the glossary (DS 1.4): good word, shelf, group, member, note, conversation, comment, mention, activity. Never post, item, feed, review, rating, chat, or thread in UI copy.
- Follow the voice and error formula in DS 6. No exclamation marks in our copy.

**Accessibility (WCAG 2.2 AA)**
- Real `button`, `a`, `input`, and `label` elements. Visible focus rings. Targets at least 44×44px.
- Keyboard and VoiceOver must work for every flow. Respect `prefers-reduced-motion`.
- axe-core must report zero violations on `/styleguide` and every route.

**Privacy and security**
- Row-level security on every table (PRD 8). Never leak group names, members, good words, or conversations across groups; test this explicitly.
- Spoiler text is never in the DOM, previews, or emails until revealed.
- The TMDB token and all secrets stay server-side.
- App routes send `noindex`. No third-party analytics or trackers.

---

## Code conventions

- Structure per DS 11.1: `styles/`, `components/ui/`, `components/domain/`, `lib/`, `messages/`, `app/(marketing)/`, `app/(app)/`, `app/styleguide/`.
- Components: typed props, small explicit variant APIs (`variant`, `size`), native elements first, no inline styles.
- Writes are optimistic with rollback and a Retry toast (DS 5.10).
- Every meaningful state lives in the URL (DS 5.1).
- Seeds, tests, and the styleguide use only invented content: titles The Night Ferry, Low Tide Club, Grandma's Heist, Moth Season; people Priya, Jonah, Tess, Mo, Luis, Bea; groups College crew, The girls, Sunday book club.

---

## Git

- Work on a branch per step (`step-0-foundations`, `step-1-accounts`, ...).
- Commit in small, logical pieces with clear messages. Don't push, merge, or open PRs unless Sydney asks.
- Never commit `.env` files or secrets.
