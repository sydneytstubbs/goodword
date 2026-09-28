# Good Word Design System

**Version** 3.1.2 (Editorial) · **Status** Active · **Owner** Sydney (design) · **Last updated** 2026-09-28

The single source of truth for how Good Word looks, behaves, and speaks, across the marketing page and the product app. It covers foundations (tokens), components, patterns (flows), content, accessibility, platform behavior, and how the system itself is maintained. It is written for Claude Code to build against and for any designer or engineer who touches the product. Version 3.0 moves the visual language from playful to editorial: calm, modern, and minimal. The identity behind it is in `BRAND.md`.

---

## Contents

0. How to use this document
1. Principles
2. System architecture
3. Foundations
4. Components
5. Patterns
6. Content design
7. Accessibility
8. Platform and responsive behavior
9. Performance as UX
10. Internationalization readiness
11. Implementation
12. Quality: definition of done, testing, UX metrics
13. Governance
14. The `/styleguide` route
15. Acceptance checklist
16. Decisions and open questions
17. Changelog

---

## 0. How to use this document

### 0.1 For the builder (read first)
- **Normative language.** **Must** and **never** are requirements. **Should** is the default; deviate only with a written reason in the PR or commit. **May** is optional.
- **The marketing page is being rebuilt** from the v2 (editorial) `good-word-marketing-page-spec.md` on this system's tokens. Do Section 11.6 before building any app screens. If anything built earlier uses v2.x (playful) tokens, fonts, or components, replace it; don't mix the two systems.
- **One token file feeds everything.** No component may hardcode a color, type size, shadow, radius, duration, or z-index.
- **No UI component library** (MUI, shadcn, Chakra, Radix Themes). Hand-build components with Tailwind. Headless accessibility primitives are allowed only where Section 11.4 permits them.
- **Build `/styleguide` first** (Section 14). It is the living reference and the acceptance test.
- **Every screen must meet the screen definition of done** (Section 12.1) before it is considered finished. That includes all five states, keyboard and screen-reader support, and both breakpoints.
- Mobile-first, always.

### 0.2 How this doc relates to others
| Doc | Owns |
|---|---|
| `DESIGN-SYSTEM.md` (this) | How things look, behave, and read. Reusable across every screen. |
| Product spec (next) | What screens exist, what data they show, business rules, integrations. |
| `BRAND.md` | Positioning, personality, logo, and the identity these tokens express. |
| `good-word-marketing-page-spec.md` (v2) | Marketing page content and layout. Where its visual notes and this doc differ, this doc wins. |

If the product spec and this doc conflict on **how** something looks or behaves, this doc wins. If they conflict on **what** the product does, the product spec wins.

---

## 1. Principles

### 1.1 Product design principles
These settle arguments. When two good options conflict, the higher principle wins.

1. **People over picks.** Every recommendation shows the human behind it. Names and avatars are never hidden behind a tap, truncated to nothing, or replaced by a score.
2. **Private by default, visibly so.** Users always know who can see what, before they share it. Nothing is ever public.
3. **Ten seconds to a good word.** The core action is always one tap away and finishes in under ten seconds. Anything that slows it down needs a very good reason.
4. **Quiet interface, loud content.** The UI stays neutral and precise so posters, names, and friends' words carry the color and the emotion. Restraint is the style.
5. **Honest over full.** Empty states say what's true. The app never fills silence with algorithmic filler or fake activity.
6. **The app absorbs complexity.** Metadata, posters, genre colors, and where to watch are the app's job, never the user's.

### 1.2 Usability heuristics, and how the system enforces them
Grounded in Nielsen Norman Group's ten usability heuristics. Every design review checks against this table.

| # | Heuristic | How Good Word enforces it |
|---|---|---|
| 1 | Visibility of system status | Optimistic updates with immediate feedback (5.10). A visibility line on every share action says who will see it (4.2.6). Offline and sync state are always shown (5.12). |
| 2 | Match between system and real world | Real-world metaphors: shelf, putting in a good word, friends' names. Never system words like post, item, entry, feed, or rating (1.4). |
| 3 | User control and freedom | Undo over confirm (5.11). Back always works, and filters live in the URL (5.1). Every sheet and dialog can be dismissed. Unsent notes survive accidental dismissal. |
| 4 | Consistency and standards | One component per job (Section 4). One word per concept (1.4). Platform conventions for navigation, sharing, and keyboards (Section 8). |
| 5 | Error prevention | Duplicate detection when logging (5.4). The audience is shown before posting. Only irreversible actions get a confirm step, and it names the consequence. |
| 6 | Recognition rather than recall | Posters and friends' faces in every list. Recent searches. The current group is always visible. Active filters are always shown. |
| 7 | Flexibility and efficiency of use | Smart defaults (all groups selected). Desktop keyboard shortcuts (3.9). Share-sheet and text-in capture come later without new UI concepts. |
| 8 | Aesthetic and minimalist design | Product mode rules (2.3). One primary action per screen. No decoration without a job. |
| 9 | Help users recognize, diagnose, and recover from errors | Error message formula (6.5). Errors keep the user's input and always offer a next step. |
| 10 | Help and documentation | Help lives in empty states and inline hints at the moment of need. A consistent help entry point in the same place on every screen (5.16). |

### 1.3 Laws of UX we design around
| Law | What it means here |
|---|---|
| **Fitts's law** | The Add action sits in the bottom-center thumb zone with a 44px target. Primary actions are large and near the thumb; destructive actions are small and away from it. |
| **Hick's law** | At most five visible filter chips before "More". The group switcher lists groups by recent activity. |
| **Jakob's law** | Users spend most of their time in other apps. Bottom tabs, native share sheet, pull-to-refresh, and swipe-to-dismiss work the way they expect. |
| **Doherty threshold** | The UI responds within 400ms. Anything slower gets a skeleton or optimistic update (5.10). |
| **Peak-end rule** | The log success moment is the emotional peak. It names the friends who will see it. Milestones get a quiet, well-set moment (4.1.20), never confetti. |
| **Von Restorff effect** | Cobalt is the only color in the interface, and there's one cobalt action per screen, so the primary action always stands out. |
| **Tesler's law** | Complexity is conserved; the app takes it on (TMDB metadata, genre colors, deduplication) so users don't. |
| **Aesthetic-usability effect** | Craft earns forgiveness during an MVP. Polish the core flow before adding features. |

### 1.4 Glossary (one word per concept)
Use these words exactly, in UI and in code comments. Consistency of language is part of the design system.

| Use | Meaning | Never say |
|---|---|---|
| **good word** | A recommendation someone vouched for | post, item, entry, review, rating, like |
| **put in a good word** | The act of recommending | submit, add item, rate, log (in UI copy) |
| **vouch / vouched for** | Having put in a good word | liked, favorited, starred |
| **shelf** | The collection of good words in a group, or yours | feed, list, board, library (in UI) |
| **group** | A private circle of people | community, channel, server, network |
| **member** | Someone in a group | follower, user, connection |
| **note** | The optional one-liner on a good word | review, caption |
| **conversation** | All the comments on one title within one group | chat, thread, discussion board |
| **comment** | One message in a conversation | post, reply (as a noun), message |
| **mention** | Tagging a group member with @ so they're notified | tag (in UI copy), ping |
| **activity** | Your list of mentions, replies, and joins | notifications (as a screen name), inbox |
| **spoiler** | A comment its author has covered until tapped | |
| **robot guess** | An opt-in, clearly labeled non-human suggestion | recommendation, AI pick, for you |

A **note** and a **comment** are different things: a note is part of someone's good word and travels with it to every group it's shared in. A comment belongs to one group's conversation.

"Log" is fine in code and analytics, but never in UI copy.

---

## 2. System architecture

### 2.1 Layers
| Layer | What lives here | Changes how often |
|---|---|---|
| **Foundations** | Tokens: color, type, space, shape, elevation, motion, layout | Rarely |
| **Components** | Reusable UI pieces with states (Button, Sheet, Rec card) | Sometimes |
| **Patterns** | Reusable solutions to user problems (joining a group, logging, errors) | Sometimes |
| **Screens** | Specific pages, defined in the product spec | Often |
| **Content** | Voice, glossary, microcopy | Alongside everything |

Each layer may only depend on the layers above it in this table.

### 2.2 Token tiers
Three tiers keep theming, dark mode, and future native apps possible without touching components.

| Tier | Example | Who references it |
|---|---|---|
| **Primitive** (raw values) | `--paper`, `--ink`, `--cobalt` | Only `tokens.css` and fixed-color marketing sections |
| **Semantic** (roles) | `--surface`, `--text`, `--border-subtle`, `--action` | All components |
| **Component** (optional knobs) | `--rec-card-note-color` | Only the component that owns it |

- Create a component token only when a component needs a value that differs by theme or variant and no semantic role fits. Component tokens must point to semantic tokens, never to primitives.
- Naming: kebab-case, general to specific (`--surface-raised`, `--shadow-md`, `--dur-fast`).

### 2.3 Two modes, one system
| | **Expressive mode** (marketing) | **Product mode** (app) |
|---|---|---|
| Purpose | Make people feel the idea | Let people do things quickly, every day |
| Headline type | Instrument Serif, 56 to 144px | Instrument Serif `title-l` (56px, big editorial) once per screen; everything else Inter |
| Layout | Editorial: asymmetric, left-aligned, generous whitespace | Dense but calm: grids of posters, clean lists |
| Color | Neutral page, one full-bleed ink section, cobalt for the CTA only | Neutral page, cobalt for the one primary action and your own states |
| Friends' words | Large serif italic pull quotes | Inter quotes in lists, serif italic `quote` on detail |
| Motion | Fade and rise on scroll, up to 400ms, once | Functional only, up to 280ms |
| Depth | Framed product UI with `--shadow-lg` | Levels 0 to 3 (3.4.2) |

Tokens are identical in both modes. Only these rules change. Neither mode uses rotation, stickers, handwriting, illustration, or hard shadows.


---

## 3. Foundations

### 3.1 Color

#### 3.1.1 `tokens.css` (canonical)
```css
:root {
  /* ---------- Primitive palette ---------- */
  --paper: #FAFAF9;
  --white: #FFFFFF;
  --stone-100: #F3F3F1;
  --stone-150: #EDEDEA;
  --stone-200: #E6E5E3;
  --stone-500: #8A8A87;
  --graphite: #6B6B6B;
  --ink: #0A0A0A;
  --cobalt: #2B4BFF;
  --cobalt-600: #1F3BE0;
  --cobalt-50: #EEF1FF;
  --red-700: #B42318;
  --red-50: #FEF3F2;
  --green-700: #15803D;
  /* People and poster tones: deep, muted, film-still colors */
  --clay: #9A4A36;
  --ochre: #7D5A12;
  --moss: #3F5E45;
  --plum: #5E4670;

  /* ---------- Semantic roles (components use ONLY these) ---------- */
  --surface: var(--paper);             /* page */
  --surface-raised: var(--white);      /* cards, sheets, inputs, menus */
  --surface-sunken: var(--stone-100);  /* skeletons, segmented track, covers */
  --surface-hover: var(--stone-100);   /* hover on neutral controls */
  --surface-pressed: var(--stone-150); /* pressed on neutral controls */
  --text: var(--ink);
  --text-muted: var(--graphite);
  --border-subtle: var(--stone-200);   /* dividers, card edges (decorative) */
  --border-strong: var(--stone-500);   /* inputs and controls (meets 3:1) */
  --action: var(--cobalt);             /* the one accent */
  --action-hover: var(--cobalt-600);
  --action-text: var(--cobalt-600);    /* cobalt text on wash or small sizes */
  --action-wash: var(--cobalt-50);     /* vouched state, mentions of you, "New" */
  --on-action: var(--white);
  --success: var(--green-700);
  --danger: var(--red-700);
  --danger-tint: var(--red-50);
  --inverse-surface: var(--ink);       /* toasts, selected chips, ink section */
  --inverse-text: var(--white);
  --focus-ring: var(--cobalt);
  --scrim: rgb(10 10 10 / 0.32);
  --people-1: var(--clay);
  --people-2: var(--ochre);
  --people-3: var(--moss);
  --people-4: var(--plum);
  --on-people: var(--white);
  --poster-edge: rgb(10 10 10 / 0.08); /* inset hairline on posters */
  color-scheme: light;

  /* ---------- Type ---------- */
  --font-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
  --font-body: "Inter", system-ui, -apple-system, sans-serif;

  /* ---------- Space (4px base) ---------- */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-24: 96px; --space-32: 128px;

  /* ---------- Shape ---------- */
  --border-width: 1px;
  --radius-poster: 6px;
  --radius-control: 8px;   /* buttons, inputs */
  --radius-card: 12px;     /* cards, menus, dialogs, banners */
  --radius-sheet: 16px;    /* sheet top corners */
  --radius-device: 44px;   /* marketing phone frame */
  --radius-pill: 999px;    /* chips, avatars, badges, composer, jump-to-new pills */

  /* ---------- Elevation: soft, low, neutral ---------- */
  --shadow-sm: 0 1px 2px rgb(10 10 10 / 0.05);
  --shadow-md: 0 1px 2px rgb(10 10 10 / 0.04), 0 6px 16px rgb(10 10 10 / 0.06);
  --shadow-lg: 0 2px 6px rgb(10 10 10 / 0.06), 0 16px 40px rgb(10 10 10 / 0.12);

  /* ---------- Focus and targets ---------- */
  --focus-width: 2px;
  --focus-offset: 2px;
  --target-min: 44px;

  /* ---------- Motion ---------- */
  --dur-fast: 120ms;        /* hover, press, toggles */
  --dur-base: 180ms;        /* toasts, small reveals, list inserts */
  --dur-slow: 280ms;        /* sheets and dialogs entering */
  --dur-expressive: 400ms;  /* marketing entrances only */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);  /* decelerate into place */
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);   /* accelerate away */

  /* ---------- Layout ---------- */
  --width-reading: 65ch;
  --width-detail: 720px;
  --width-content: 1040px;
  --width-marketing: 1200px;

  /* ---------- Layers ---------- */
  --z-sticky: 10;
  --z-nav: 20;
  --z-scrim: 30;
  --z-sheet: 40;
  --z-toast: 60;
}

/* Dark theme: prepared, not shipped. Applies only when data-theme="dark". */
:root[data-theme="dark"] {
  --surface: #0C0C0D;
  --surface-raised: #18181A;
  --surface-sunken: #070708;
  --surface-hover: #1F1F22;
  --surface-pressed: #26262A;
  --text: #F5F5F4;
  --text-muted: #A1A1A6;
  --border-subtle: #2A2A2D;
  --border-strong: #707075;
  --action: #8EA2FF;
  --action-hover: #A9B8FF;
  --action-text: #8EA2FF;
  --action-wash: #1A2040;
  --on-action: #0A0A0A;
  --success: #4ADE80;
  --danger: #FF8A7A;
  --danger-tint: #3A1715;
  --inverse-surface: #F5F5F4;
  --inverse-text: #0A0A0A;
  --focus-ring: #8EA2FF;
  --scrim: rgb(0 0 0 / 0.6);
  --poster-edge: rgb(255 255 255 / 0.08);
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-md: 0 1px 2px rgb(0 0 0 / 0.4), 0 6px 16px rgb(0 0 0 / 0.5);
  --shadow-lg: 0 2px 6px rgb(0 0 0 / 0.5), 0 16px 40px rgb(0 0 0 / 0.6);
  /* People tones and --on-people are unchanged */
  color-scheme: dark;
}
```

#### 3.1.2 Color roles and usage
- **Neutral first.** The interface is paper, white, ink, and graphite. Color comes from posters and people.
- **`--action` (cobalt) is the only accent.** It's used for the one primary action per screen, links on hover, focus rings, the "on" state of form controls, your own good word (as `--action-wash`), mentions of you, and unread indicators. Never for headlines, decoration, or large fills beyond a button.
- **`--danger`** is used only for errors and destructive actions.
- **People tones** (`--people-1` to `--people-4`: clay, ochre, moss, plum) color avatars, group dots, and fallback posters, always with `--on-people` (white) text. Assignment is deterministic, so a person or group always keeps the same tone.
- **`--inverse-surface`** (ink) is for toasts, selected chips and segments, and the marketing page's one full-bleed moment.
- **Borders:** `--border-subtle` for dividers and card edges, which are decorative. `--border-strong` for anything that needs its boundary to be seen to be used: text fields, checkboxes, switch tracks, the composer (3.1.3).

#### 3.1.3 Verified contrast
Computed with the WCAG 2.x relative luminance formula. `/styleguide` must recompute these live, in both themes, and flag anything below threshold.

**Text (needs 4.5:1)**
| Pairing | Light | Dark |
|---|---|---|
| `--text` on `--surface` / `--surface-raised` / `--surface-sunken` | 19.0 / 19.8 / 17.8 | 17.9 / 16.3 / 18.5 |
| `--text-muted` on `--surface` / `--surface-raised` / `--surface-sunken` | 5.1 / 5.3 / 4.8 | 7.6 / 6.9 / 7.8 |
| `--action` as text on `--surface` / `--surface-raised` | 5.7 / 5.9 | 8.2 / 7.4 |
| `--action-text` on `--action-wash` | 6.8 | 6.6 |
| `--on-action` on `--action` | 5.9 | 8.3 |
| `--danger` on `--surface` / on `--danger-tint` | 6.3 / 6.1 | 8.5 / 7.0 |
| `--success` on `--surface` / `--surface-sunken` | 4.8 / 4.5 | 11.2 / 11.6 |
| `--inverse-text` on `--inverse-surface` | 19.8 | 18.2 |
| `--on-people` on clay / ochre / moss / plum | 6.2 / 6.3 / 7.3 / 8.1 | same |

**Non-text (needs 3:1 where a boundary or state must be perceived)**
| Pairing | Light | Dark |
|---|---|---|
| `--border-strong` on `--surface` / `--surface-raised` / `--surface-sunken` | 3.3 / 3.5 / 3.1 | 4.0 / 3.6 / 4.1 |
| `--action` (focus ring, checked controls) on any surface | 5.3 or more | 7.4 or more |
| People tones on `--surface` | 5.9 or more | 2.4 to 3.2 |

**Rules that follow**
- **Controls whose boundary must be seen** (text fields, checkboxes, switch tracks when off, the composer) use `--border-strong`. Cards, rows, and dividers can use `--border-subtle` because their content identifies them.
- **`--success` on `--surface-sunken` is at the limit (4.5).** Don't place success text on sunken surfaces at small sizes; use `--text` with a success icon instead.
- **In dark mode, people tones sit below 3:1 against the page.** Avatars and posters get a 1px `--poster-edge` ring there. They're never the only indicator of anything.
- **State is never color alone.** Selected, vouched, and unread states also change an icon, label, or weight (3.8).

### 3.2 Typography

#### 3.2.1 Scale
| Token | Font | Size / line height | Weight and tracking | Use |
|---|---|---|---|---|
| `display-xl` | Instrument Serif | `clamp(56px, 10vw, 144px)` / 0.95 | 400, -0.02em | Marketing hero |
| `display-l` | Instrument Serif | `clamp(40px, 6vw, 80px)` / 1.0 | 400, -0.015em | Marketing section headlines |
| `display-m` | Instrument Serif | `clamp(28px, 3.5vw, 44px)` / 1.1 | 400 (often italic), -0.01em | Marketing pull quotes, milestone lines |
| `title-l` | Instrument Serif | 56 / 0.92 (44 / 0.95 step-down) | 400, -0.025em | App page title (group name, "Your shelf", title name). Big editorial |
| `quote` | Instrument Serif | 24 / 1.25 | 400 italic | A friend's note on title detail |
| `title-m` | Inter | 20 / 1.3 | 600, -0.01em | Sheet and dialog titles, empty-state headings |
| `heading` | Inter | 17 / 1.35 | 600, -0.005em | Section headings, card titles on detail |
| `body` | Inter | 16 / 1.5 | 400 | Default app text (marketing uses 18 / 1.6) |
| `body-strong` | Inter | 16 / 1.5 | 600 | Names, emphasis |
| `label` | Inter | 15 / 1.3 | 500 (600 on buttons) | Buttons, chips, tabs, form labels |
| `card-title` | Inter | 15 / 1.3 | 600 | Titles under posters |
| `caption` | Inter | 13 / 1.4 | 400 | Meta lines, timestamps, helper text |
| `overline` | Inter | 12 / 1.3 | 600, +0.08em, uppercase | Marketing eyebrows only |

#### 3.2.2 Rules
- **Instrument Serif only at 24px and up.** It's a display face and falls apart smaller. Everything under 24px is Inter.
- **Italic is emphasis, used once.** At most one italic word or phrase per heading, and never in UI controls.
- **One `title-l` per screen**, and it is the page's `<h1>`. Visual size never decides heading level; document structure does.
- **Big editorial page titles.** `title-l` is set large (56px) directly under the top bar, 4px below it, with 12px to the meta line beneath (members, counts) and 18px to the controls. It may wrap to 2 lines. If a name would need 3 lines at 56px, step down to 44px (line height 0.95); never go smaller and never truncate a page title. Because the title is this large, the top bar never repeats it as a heading (the group switcher is a control, not a title).
- **Sentence case everywhere.** Uppercase only for `overline` on the marketing page.
- **Minimum 13px.** Nothing smaller, anywhere.
- **Inputs are 16px or larger** to prevent iOS Safari's auto-zoom.
- **Line length** for paragraphs is capped at `--width-reading` (65ch).
- **Headings** use `text-wrap: balance`; paragraphs use `text-wrap: pretty`. Never justify text. No automatic hyphenation.
- **Numbers** in counts and badges use tabular figures (`font-variant-numeric: tabular-nums`).
- **Friends' notes** are shown as quotes, never in a handwriting face: in lists, Inter `body` in `--text-muted` inside curly quotes; on title detail, `quote` (Instrument Serif italic).
- **Truncation:** titles under posters clamp at 2 lines, names at 1 line, notes at 2 lines, each with an ellipsis. Truncated content must be available in full on the detail screen and in the element's accessible name. Never truncate a person's name to fewer than 8 visible characters.
- **Fonts** load via `next/font` with `font-display: swap` and metric-matched fallbacks to prevent layout shift. Subset to Latin.

### 3.3 Space, layout, and grid

#### 3.3.1 Spacing
- A 4px base. Use only tokens from the scale.
- **Whitespace is the main layout tool.** Separate groups with space, not lines, wherever possible; use hairline dividers only in dense lists.
- **Proximity carries meaning.** Related elements 4 to 8px apart, list items 12 to 16px, sections 32 to 48px in the app, 96 to 128px on marketing.

#### 3.3.2 Grid
| Breakpoint | Viewport | Columns | Outer margin | Gutter | Shelf grid |
|---|---|---|---|---|---|
| base | 360 to 767 | 4 | 20px | 12px | 2 columns |
| `md` | 768 to 1023 | 8 | 32px | 20px | 3 columns |
| `lg` | 1024 to 1439 | 12 | 40px | 24px | 4 columns |
| `xl` | 1440 and up | 12 | auto (centered) | 24px | 5 columns, capped at `--width-content` |

- Design baseline is 390px wide. Verify at 360, 390, 768, 1024, and 1440.
- Content widths: detail screens `--width-detail`, shelves `--width-content`, paragraphs `--width-reading`.

#### 3.3.3 Layout rules
- Left-align by default. Center only short, single-purpose blocks (empty states, dialogs).
- Fixed elements (top bar, tab bar, sheets) respect safe-area insets (8.2).
- **Focus must never hide behind a sticky bar.** Set `scroll-padding-top` and `scroll-padding-bottom` to the bars' heights.
- Use CSS logical properties (`margin-inline`, `padding-block`) everywhere.

### 3.4 Shape and elevation

#### 3.4.1 Shape
- **Borders are 1px hairlines.** `--border-subtle` on cards, rows, and menus; `--border-strong` on fields and controls (3.1.2).
- **Radius:** posters 6, controls 8, cards, menus, and dialogs 12, sheet top corners 16, pills for chips, avatars, badges, and the composer.
- **Posters** have no border; an inset 1px `--poster-edge` keeps light posters from bleeding into the page.

#### 3.4.2 Elevation model
Depth is quiet: most things sit flat on the page, and only temporary layers float.

| Level | Treatment | Used for | Meaning |
|---|---|---|---|
| 0 | No border or shadow, or a hairline divider | Page content, list rows, comments, text | Part of the page |
| 1 | `--surface-raised` + `--border-subtle` + `--shadow-sm` | Cards, posters, secondary buttons, inputs | An object you can act on |
| 2 | `--shadow-md` | Hovered cards (pointer only), menus, popovers, the Add button | Lifted or anchored above content |
| 3 | `--shadow-lg` + `--scrim` behind where modal | Sheets, dialogs, toasts | Temporary, above everything |

- **Never nest two raised objects.** A card inside a sheet drops to level 0 (a hairline divider at most).
- **Never** use colored, hard-offset, inner, or glowing shadows. No gradients, glass, or blur effects.

### 3.5 Iconography
- **Phosphor** (`@phosphor-icons/react`) is the only icon library in the project.
- **Weight:** `regular` by default, which matches Inter's stroke and the hairline aesthetic. `fill` only for the active tab and the "on" state of a toggle. No `bold`, `thin`, `light`, or `duotone`.
- **Size:** 20px default, 24px in the tab bar and top bar, 16px inline with `caption` text. Always `currentColor`.
- Import icons individually. Wrap them in one `Icon` component so weight and size defaults live in one place. A lint rule blocks importing any other icon library.
- **Icons never stand alone as meaning.** Navigation icons always have visible labels. Icon-only buttons must have an accessible name and, on desktop, a tooltip (4.1.14).
- No emoji as UI. No icons as decoration.

**Icon map**
| Meaning | Phosphor | Meaning | Phosphor |
|---|---|---|---|
| Add / put in a good word | `Plus` | Vouched / success | `Check` |
| Search | `MagnifyingGlass` | Close / dismiss | `X` |
| Back | `CaretLeft` | Group switcher | `CaretDown` |
| Share | `ShareNetwork` | Copy link | `LinkSimple` |
| Settings | `GearSix` | Group | `UsersThree` |
| Activity | `Bell` | More actions | `DotsThree` |
| Where to watch | `MonitorPlay` | Shelf tab | `BookmarksSimple` |
| You tab | `UserCircle` | Private / visibility | `LockSimple` |
| Edit | `PencilSimple` | Remove | `Trash` |
| Error | `WarningCircle` | Offline | `WifiSlash` |
| Help | `Question` | Robot guess | `Robot` |
| Sign out | `SignOut` | Conversation, comment count | `ChatCircle` |
| Mention | `At` | Spoiler | `EyeSlash` |
| Send comment | `PaperPlaneRight` | | |

### 3.6 Imagery
- **Posters are the color.** Real TMDB images in product mode, with a typographic fallback (4.2.1). Never crop, filter, tint, or invert them, in either theme. Show them large enough to enjoy.
- **Avatars:** initials on a people tone. No photos or illustrated faces in the MVP.
- **No illustration** in the product. Empty states use type and, at most, faint outlines of empty poster slots (4.1.18).
- **Brand assets:** the wordmark and monogram follow `BRAND.md`. TMDB and JustWatch attribution logos follow their own guidelines (4.2.1, 5.7).

### 3.7 Motion

#### 3.7.1 Principles
1. **Motion explains.** It shows where something came from or went. It never decorates.
2. **Quiet and quick.** Things fade and settle a few pixels. Nothing bounces, tilts, or overshoots.
3. **Exits are faster than entrances.** About 70% of the enter duration, with `--ease-exit`.
4. **Nothing loops** except skeleton pulses.

#### 3.7.2 Motion specs
| Interaction | Duration | Easing | Movement |
|---|---|---|---|
| Hover (pointer only) | `--dur-fast` | standard | Background or shadow change, no movement |
| Press | `--dur-fast` | standard | Background to `--surface-pressed` or `--action-hover`; buttons scale to 0.98 |
| Toggle and selection | `--dur-fast` | standard | Color, weight, and icon swap |
| Toast in / out | `--dur-base` / 120ms | enter / exit | 6px rise with fade |
| New card on shelf | `--dur-base` | enter | Fade in from 6px above |
| Sheet in / out | `--dur-slow` / 200ms | enter / exit | From the bottom edge |
| Dialog in / out | `--dur-base` / 120ms | enter / exit | Fade with scale 0.98 to 1 |
| Vouch success | `--dur-base` | enter | Icon cross-fades from `Plus` to `Check` |
| Milestone moment | `--dur-slow` | enter | Fade and 8px rise, once |
| Marketing entrances | `--dur-expressive` | enter | Fade and 8px rise when 20% visible, once, 60ms stagger |

#### 3.7.3 Reduced motion
With `prefers-reduced-motion: reduce`, all transforms, scales, slides, and pulses are removed. State still changes, instantly, with at most an opacity fade of `--dur-fast`.

### 3.8 Interaction states
Every interactive component expresses these states the same way. This table is the contract.

| State | Visual treatment | Semantics |
|---|---|---|
| **Default** | Per component and elevation level | |
| **Hover** (pointer devices only, `@media (hover: hover)`) | Neutral controls: `--surface-hover` background. Primary: `--action-hover`. Cards: `--shadow-md` | |
| **Focus-visible** | `--focus-width` outline in `--focus-ring`, `--focus-offset` away. Never removed, never replaced by hover. Visible on every surface, both themes | `:focus-visible` only |
| **Pressed** | Neutral: `--surface-pressed`. Primary: `--action-hover`. Buttons scale to 0.98 | |
| **Selected / on** | Chips and segments: `--inverse-surface` fill with `--inverse-text`, or a raised segment with 600 weight. Form controls: `--action` fill. Your good word: `--action-wash` with `--action-text`. **Always** with an icon, label, or weight change too | `aria-pressed`, `aria-selected`, `aria-checked`, or `aria-current` |
| **Disabled** | 40% opacity, no hover or press | See the rule below |
| **Loading** | Label replaced with a spinner after 300ms; width locked, no layout shift | `aria-busy="true"` |
| **Error** | `--danger` border, `WarningCircle` icon, message text in `--danger` | `aria-invalid="true"` with `aria-describedby` |
| **Success** | Brief `Check` and label change, then return to default or selected | Announced via a live region |

**Rule on disabled controls:** avoid them. A disabled button can't explain itself and fails people who don't know why. Prefer keeping the action enabled and explaining what's missing when it's used ("Add a title first"). When disabling is unavoidable, use `aria-disabled="true"` (so it stays focusable) plus visible text explaining why.

### 3.9 Touch, pointer, and keyboard
- **Targets:** 44×44px minimum, with at least 8px between adjacent targets. Visually smaller elements (chips, avatar stacks, icon buttons) extend their hit area with padding or a pseudo-element.
- **Thumb zone:** primary actions live in the bottom third on mobile. Destructive actions never sit where a thumb rests.
- **Gestures always have a visible alternative.** Swipe-to-dismiss on sheets also has a close button. No gesture is the only way to do anything.
- **No hover-dependent content.** Anything revealed on hover must also be reachable by tap and focus.
- **Long-press** is not used in the MVP.
- **Keyboard:** everything reachable and operable, in visual order. Esc closes the top layer. Enter activates, Space toggles.
- **Desktop shortcuts** (shown in a shortcuts sheet under Help, never required):
  - `/` focuses search
  - `n` opens "Put in a good word"
  - `g` then `s` goes to the shelf, `g` then `y` goes to You, `g` then `a` goes to Activity
  - `?` shows shortcuts

  Shortcuts never fire while typing in a field.

### 3.10 Theming and dark mode
**Status: prepared, not shipped.** Turning it on later should mean flipping a switch and tuning values, never editing components.

**Enforced now**
1. Components use semantic roles only. They never reference primitives or hex values. A lint rule fails the build otherwise (11.5).
2. Neutral roles invert in dark mode; the cobalt accent lightens (`#8EA2FF`) and `--on-action` becomes dark. People tones stay the same, with a subtle `--poster-edge` ring.
3. Shadows get stronger in dark mode, because soft light shadows vanish on dark surfaces; `--surface-raised` being lighter than `--surface` does most of the depth work.
4. Images are never filtered in dark mode.
5. Every contrast pairing must pass in both themes (3.1.3).

**Shipped now:** the dark token block, the lint rule, and a dev-only theme toggle on `/styleguide` (also `?theme=dark`). The marketing route group forces `data-theme="light"`.

**When it's switched on:** set `data-theme` on `<html>` from a tiny inline script before first paint (no flash). Default from `prefers-color-scheme`, with a System / Light / Dark setting. Update `<meta name="theme-color">` to match.

**Forced colors (Windows High Contrast):** soft shadows and tinted backgrounds disappear in forced-colors mode. Under `@media (forced-colors: active)`, give cards, fields, chips, and buttons a 1px `CanvasText` border, make selected states use `Highlight`, and keep focus outlines. Never rely on a shadow or tint alone to separate something that matters.

---

## 4. Components

### 4.0 How every component is specified
Each component documents: **purpose**, **anatomy**, **variants and sizes**, **states** (per 3.8), **behavior**, **accessibility** (role, keyboard, announcements), **content rules**, and **don'ts**. A component isn't done until it meets the component definition of done (12.2).

**Choosing the right component**
| If you need to… | Use | Not |
|---|---|---|
| Trigger an action | Button | Link styled as a button |
| Go somewhere | Link | Button that navigates |
| Toggle one thing on or off in settings | Switch | Checkbox |
| Pick several from a list in a form | Checkbox | Filter chips |
| Narrow what's shown right now | Filter chip | Checkbox |
| Switch between 2 to 4 views of one set | Segmented control | Tabs |
| Show a task or picker on mobile | Sheet | Full page |
| Require a decision before continuing | Dialog | Sheet or toast |
| Confirm an action the user just took | Toast | Dialog |
| Report an ongoing system condition | Banner | Toast |
| Offer 3 or more secondary actions on an object | Menu | Row of icon buttons |

### 4.1 Primitives

#### 4.1.1 Button
- **Purpose:** trigger an action.
- **Variants:**
  - `primary`: `--action` fill, `--on-action` label. One per screen.
  - `secondary`: `--surface-raised` fill, `--border-subtle` hairline, `--shadow-sm`, `--text` label.
  - `ghost`: no fill, border, or shadow; `--surface-hover` on hover. For low-emphasis actions.
  - `danger`: `--surface-raised` fill, hairline, `--danger` label; `--danger-tint` on hover.
- **Sizes:** `lg` 48px (main action on a screen or sheet), `md` 40px visual with a 44px hit area (default), `sm` 32px visual with a 44px hit area (dense rows only).
- **Anatomy:** `--radius-control`, `label` text at weight 600, optional leading 20px icon, 16px horizontal padding (20px for `lg`).
- **States:** all from 3.8, including the 0.98 press scale.
- **Behavior:** full-width on mobile when it's the main action of a sheet or form.
- **Accessibility:** native `<button>`. The accessible name matches the visible label.
- **Content:** a verb plus an object ("Put in a good word", "Copy link", "Leave group"). Never "OK", "Submit", "Yes", or "Click here".
- **Don't:** use primary for destructive actions, put two primaries side by side, disable instead of explaining, or use pill-shaped buttons (pills are for chips).

#### 4.1.2 Icon button
- **Purpose:** a frequent, well-understood action where space is tight (close, more, back).
- **Anatomy:** 44px square hit area, 20 to 24px icon in `--text` (or `--text-muted` when secondary), no border. Hover and press use a 36px `--radius-control` `--surface-hover` / `--surface-pressed` background.
- **Accessibility:** `aria-label` is required. A desktop tooltip mirrors the label.
- **Don't:** use it for an action whose icon isn't universally understood. Use a labeled button instead.

#### 4.1.3 Link
- Inline links are `--text` with a 1px underline in `--border-strong`, offset 3px (never color-only). On hover the underline and text turn `--action`.
- Standalone links (for example "See all 12 comments") are `label` weight 500 in `--action-text`, with an underline on hover.
- External links open in the same tab unless the user is mid-task, in which case they open in a new tab with a visually hidden "(opens in new tab)" label and an icon.

#### 4.1.4 Text field
- **Anatomy:** label above (always visible, never placeholder-only, `label` in `--text`), 44px field, `--radius-control`, 1px `--border-strong`, `--surface-raised` fill, 16px text, helper or error text below in `caption`.
- **States:** default, hover (border `--text-muted`), focus (border `--action` plus focus ring), filled, error (`--danger` border, icon, message), disabled, read-only (`--surface-sunken` fill, no border).
- **Behavior:** validate on blur and on submit, never on first keystroke. Clear an error as soon as the input becomes valid. Never clear the user's input on error.
- **Accessibility:** `<label for>`, `aria-describedby` linking helper and error text, `aria-invalid` on error, correct `type`, `inputmode`, and `autocomplete` (`email` for sign-in).
- **Content:** labels are nouns ("Email"). Helper text explains format before the error does.

#### 4.1.5 Textarea (note field)
- Same as the text field, auto-growing from 2 to 5 lines.
- **Character counter** appears at 100 of 140 characters ("40 left"), turns `--danger` at 0, and hard-stops input there. The count is announced politely at 20 left and at the limit, not on every keystroke.
- A draft survives accidental sheet dismissal for the session (5.4).

#### 4.1.6 Checkbox
- 20px box, 1px `--border-strong`, radius 5, `--surface-raised`. Checked: `--action` fill with a white `Check`. The entire row is the hit target (44px tall). Used in the group picker.
- Native `<input type="checkbox">` visually restyled, never a div.

#### 4.1.7 Switch
- For settings that take effect immediately (email digest on/off). Track 44×26, thumb 22px white with `--shadow-sm`. Off: `--border-strong` track. On: `--action` track, thumb slides right. A visible "On"/"Off" label sits beside it so state isn't color or position alone.
- `role="switch"` with `aria-checked`. Never used in a form that needs a Save button; use a checkbox there.

#### 4.1.8 Segmented control
- For All / Movies / Shows. A `--surface-sunken` track with `--radius-control`, 2px inner padding. The selected segment is `--surface-raised` with `--shadow-sm` and weight 600; unselected segments are `--text-muted` at weight 500.
- Implemented as a radio group (`role="radiogroup"`), arrow keys move selection. Changes apply immediately and update the URL. The selected segment slides between positions in `--dur-fast` (instant under reduced motion).

#### 4.1.9 Chips
- **Group chip:** shows which shelf something is on. Pill, `--surface-sunken` fill, 8px dot in the group's people tone, name in `caption` weight 500. Not interactive unless it's a link to that shelf.
- **Filter chip:** toggle for narrowing. Unselected: `--surface-raised`, `--border-subtle` hairline, `label` weight 500. Selected: `--inverse-surface` fill, `--inverse-text`, leading `Check` 16px. `aria-pressed`. Optional count in tabular figures ("Netflix 12").
- Visual height 32px; hit area 44px.
- Show at most five filter chips, then a "More filters" chip that opens a sheet.

#### 4.1.10 Avatar and avatar stack
- Circle in a people tone assigned deterministically from the user id, initial in `--on-people`, Inter 600. Sizes 24, 32, 40, 56. No border in light mode; a 1px `--poster-edge` ring in dark mode.
- **Stack:** overlap 25%, each avatar separated by a 2px ring in the background color, max 3 visible, overflow as "+N" in `caption` on `--surface-sunken`. The stack is one element with an accessible name ("Priya, Jonah, and 2 others"). Individual avatars inside are `aria-hidden`.

#### 4.1.11 Badge
- **Count badge** (unread Activity, new comments): pill, `--action` fill, `--on-action` text, `caption` weight 600, tabular figures, min width 18px. Never above "99+".
- **Label badge** ("New" on cards): pill, `--action-wash` fill, `--action-text`, `caption` weight 600.
- Always has a text equivalent for screen readers.

#### 4.1.12 Menu
- For 3 or more secondary actions on an object (edit note, change groups, remove). Opens from a `DotsThree` icon button.
- Mobile: renders as a sheet with full-width rows. Desktop: popover anchored to the trigger, level 2 (`--surface-raised`, `--border-subtle`, `--radius-card`, `--shadow-md`), rows 40px tall with `--surface-hover` on hover.
- **Accessibility:** menu button pattern (`aria-haspopup`, `aria-expanded`), arrow keys move, Esc closes and returns focus. Destructive items sit last, in `--danger`, separated by a divider.

#### 4.1.13 Sheet and dialog
- **Sheet (mobile tasks and pickers):** slides from the bottom, `--surface-raised`, `--radius-sheet` top corners, `--shadow-lg`, a 36×4 drag handle in `--border-subtle`, a visible close button, `--scrim` behind. Title in `title-m`. Max 90% of viewport height; content scrolls inside, header and primary action stay pinned. On desktop it becomes a centered modal up to 480px wide.
- **Dialog (decisions only):** centered, up to 400px, `--surface-raised`, `--radius-card`, `--shadow-lg`, 24px padding, a title that asks the specific question, one sentence of consequence, then actions: the safe action first in reading order, the committing action last. Destructive commit uses the `danger` button.
- **Both:** focus moves to the first meaningful element (the title for dialogs, the first field for sheets), focus is trapped, Esc and scrim tap close (except dialogs guarding irreversible actions, where the scrim does nothing), focus returns to the trigger, body scroll locks. Use native `<dialog>` where possible, with `aria-labelledby` pointing at the title.
- **Don't:** stack a sheet on a sheet (replace the content instead), or use a dialog to confirm something that has Undo.

#### 4.1.14 Tooltip
- **Desktop only**, supplementary only: mirrors the label of icon-only buttons and shortcut hints. Appears on hover after 500ms and immediately on focus; dismissible with Esc; never contains essential or interactive content.
- Never on touch. If information matters, it's visible text.

#### 4.1.15 Toast
- Bottom-center above the tab bar (bottom-left on desktop), `--inverse-surface` with `--inverse-text`, `--radius-control`, `--shadow-lg`, `body` text. Actions (Undo, Retry) are `--inverse-text` at weight 600 with an underline. Max one visible; a new toast replaces the old.
- Auto-dismisses after 5 seconds; 8 seconds if it has an action (Undo, Retry). The timer pauses on hover and focus.
- `role="status"` (polite). The action is a real button reachable by keyboard.
- **Don't:** use a toast for errors that need input, for anything the user must read, or for success of something they can see already happened.

#### 4.1.16 Banner
- A persistent, inline message at the top of the content area for an ongoing condition (offline, sign-in link expired, TMDB unavailable). Full width, `--radius-card`, `--border-subtle` hairline, icon plus one sentence plus an optional action.
- Tones: info (`--surface-sunken`), warning and error (`--danger-tint` with `--danger` icon). Non-critical banners are dismissible.
- `role="status"`, or `role="alert"` only for errors that block the current task.

#### 4.1.17 Skeleton and spinner
- **Skeleton** for content regions: `--surface-sunken` blocks matching the final layout's shapes and sizes exactly, with a slow opacity pulse (static under reduced motion). The region has `aria-busy="true"` and a visually hidden "Loading shelf".
- **Spinner** only inside buttons and small inline actions, never for a content region. 16 to 20px, `currentColor`.
- **Show loading indicators only if loading takes more than 300ms**, and once shown, keep them for at least 500ms to avoid flicker.

#### 4.1.18 Empty state
- Left-aligned on mobile, centered on wide screens, max `--width-reading`: a `title-m` heading, one sentence of body in `--text-muted`, and one primary action. The only visual is optional: a row of three empty poster-shaped outlines in `--border-subtle` (dashed), suggesting a shelf waiting to be filled.
- Must say **why** it's empty and **what to do next**. Never blank, never "No data". No illustrations or mascots.

#### 4.1.19 Error state
- Same shape as the empty state, for a region that failed to load: a 24px `WarningCircle` icon in `--text-muted`, a plain-language heading, one sentence on what to try, and a Retry button. Keep any content that did load visible around it.

#### 4.1.20 Milestone moment
- For the few moments worth marking: first good word, first group created, first friend joins, 10th good word.
- A quiet card at the top of the shelf (level 1): a `display-m` line in Instrument Serif ("Your first good word."), one sentence in `--text-muted`, and a close button. It fades and rises into place once (3.7.2) and stays until dismissed or the next visit.
- No confetti, stickers, achievement badges, or sounds.
- Announced once via a polite live region ("Milestone: your first good word").

### 4.2 Domain components

#### 4.2.1 Poster
- 2:3 ratio, `--radius-poster`, inset 1px `--poster-edge`, `--shadow-sm`. A fixed aspect-ratio box so it never shifts layout. `--surface-sunken` placeholder while loading. Lazy-loaded below the fold. `alt` is the title and year, or empty when the title is written right next to it.
- **Image sizes** come from TMDB's size variants via `srcset` (Section 9).
- **Fallback (typographic poster)** when there's no image or it fails: a people-tone fill, the title in Instrument Serif (white, sized to fit, max 3 lines, never under 24px on grid cards; on 64px row posters show only the first letter), and year and type in `caption` in solid white.
- **Fallback tone comes from genre.** Use the first genre TMDB lists, mapped by mood:

  | Tone | Mood | TMDB genres |
  |---|---|---|
  | clay | Heat and intensity | Action, Adventure, Action & Adventure, Thriller, Horror, War, War & Politics, Western |
  | ochre | Light and warm | Comedy, Family, Kids, Animation, Music, Reality, Talk |
  | moss | Grounded and real | Documentary, History, Crime, News |
  | plum | Dreamy and emotional | Drama, Romance, Fantasy, Science Fiction, Sci-Fi & Fantasy, Mystery, Soap, TV Movie |

  - The mapping lives in one constant (`genreAccent`), whose values are `clay`, `ochre`, `moss`, and `plum`.
  - Unmapped or missing genres fall back to a tone picked deterministically from the title id.
  - The tone is resolved once when the title is first saved and stored on the title record, so it never changes later.
  - Color is decoration only. The genre is always shown as text on the detail screen.
- **TMDB attribution is required**, persistently, in About (under You): the TMDB logo and "This product uses the TMDB API but is not endorsed or certified by TMDB."

#### 4.2.2 Rec card
One component, three variants.
- **`grid`** (shelves): no card box. The poster (level 1) is the object; beneath it, 10px apart: title (`card-title`, 2 lines max), meta (`caption`, `--text-muted`, "Series · 2024"), the vouched-by row, and, if there is one, the most recent friend note as a quote (`caption` in `--text-muted`, in curly quotes, 2 lines max). When the group's conversation has comments, a comment count sits at the end of the meta line (`ChatCircle` 16px and the number), with a 6px `--action` dot when there are comments you haven't seen. A "New" label badge (4.1.11) sits on the poster's top-left corner, 8px in.
- **`row`** (search results, dense lists): 48×72 poster left; title, meta, and vouched-by right; vouch button trailing. Level 0, hairline `--border-subtle` dividers between rows, 12px vertical padding.
- **`detail`** (title screen): large poster, title as `title-l`, meta, genres, where to watch (5.7), then each friend's good word as a quote block: avatar (32), name (`body-strong`), relative time (`caption`), and the note in `quote` (Instrument Serif italic 24px), then the vouch button (`lg`).
- **Vouched-by row:** avatar stack (24px) plus names in `caption` ("Priya, Jonah +1"). Always visible. Your own good word is listed as "You".
- **Behavior:** the whole card is one link to the detail screen. In `row`, the vouch button is a separate target, and the rest of the row is the link. No nested interactive elements inside the card link. Desktop hover raises the poster to `--shadow-md`; nothing moves.
- **Accessibility:** the accessible name reads as a sentence: "The Night Ferry, series, 2024. Vouched for by Priya and Jonah." 

#### 4.2.3 Vouch button (signature component)
- **Purpose:** put in (or take back) your good word on a title.
- **States:**
  - Not vouched: `primary` on the detail screen (it's that screen's one primary action), `secondary` in rows. `Plus` icon, "Put in a good word". In rows below 768px the label is just "Add" (the title is part of its accessible name: "Add The Night Ferry"), so the title and names keep their room on small phones.
  - Vouched: `--action-wash` fill, `--action-text` label and `Check` icon, "Your good word". `aria-pressed="true"`.
- **Behavior:**
  - Tapping when not vouched opens the confirm sheet (5.4) so the user can add a note and see who will see it.
  - Tapping when vouched opens a small menu: Edit note, Change groups, Take it back. "Take it back" removes immediately with an Undo toast; there is no confirm dialog.
  - Updates are optimistic. On failure, the state reverts and a toast offers Retry.
  - Success cross-fades the icon from `Plus` to `Check` (3.7.2).
- **Sizes:** `lg` on the detail screen, `md` in rows.

#### 4.2.4 Title search
- Full-width field with `MagnifyingGlass` icon and a clear button. Autofocus when opened from Add.
- Debounce 250ms; minimum 2 characters. Results render as `row` rec cards.
- **Result annotations** prevent duplicates: "On your shelf" for titles you already vouched for; friends' avatars for titles they vouched for ("Priya vouched for this").
- **States:** empty (recent searches, up to 5, clearable), loading (3 skeleton rows), results, no results ("Nothing for 'nite ferry'. Check the spelling, or try the original title."), error ("Search isn't working right now. Try again." with Retry).
- **Accessibility:** combobox pattern with a listbox (`role="combobox"`, `aria-expanded`, `aria-activedescendant`). Arrow keys move, Enter selects, Esc clears then closes. Result count announced politely ("6 results").

#### 4.2.5 Group switcher
- Top-bar control: current group name plus `CaretDown`. Opens a sheet listing groups (sorted by recent activity, each with avatar stack and member count), an "All groups" option, and "Create a group".
- The current shelf is always named on screen. "All groups" is an explicit, labeled choice, never an unlabeled default.

#### 4.2.6 Visibility line
- A one-line statement of audience wherever content is created or shared: `LockSimple` icon plus "Visible to College crew · 6 people", or "Visible to 3 groups · 14 people".
- Tapping it opens the group picker. It updates live as groups are selected.
- This is how the "private by default, visibly so" principle shows up in UI. It is required on the confirm sheet and on invite screens.

#### 4.2.7 Invite card
- Group name, avatar stack, member count, the invite link in a read-only field, "Copy link" (`secondary`), and "Share" (`primary`, uses the Web Share API with copy as fallback).
- Copying confirms with a toast ("Link copied. Send it to someone whose taste you trust.").
- States: link active, link reset (owner only, 5.8), expired.

#### 4.2.8 App bars and navigation
- **Top bar:** 52px, `--surface` fill. Group switcher on the left (group name in `heading` with `CaretDown`); on the right, the Activity icon button (`Bell`, with a count badge, 4.1.11) and the invite icon button. A hairline `--border-subtle` bottom border appears only once content scrolls under it. No blur or translucency. The page's `title-l` sits below the bar in content, not in it.
- **Tab bar (mobile):** 56px plus safe-area inset, `--surface` fill with a hairline top border. Three destinations: **Shelf**, **Add**, **You**. Shelf and You are 24px icons over `caption` labels; inactive in `--text-muted` with `regular` icons, active in `--text` with `fill` icons, weight 600, and `aria-current="page"`. **Add** is centered: a 44px `--action` circle with a white `Plus`, `--shadow-md`, sitting within the bar (not floating above it), labeled "Add".
- **Rail (1024px and up):** 240px left rail on `--surface` with a hairline right border: the wordmark, a full-width primary "Put in a good word" button, then Shelf, Activity, and You as 40px rows (`--surface-hover` on hover, `--surface-sunken` with weight 600 when current), then the group list with people-tone dots.
- Add is a command, not a destination: it opens the log sheet over the current screen rather than navigating away.

#### 4.2.9 Robot guess card
- Only shown after the user explicitly asks for a robot guess (5.15).
- **Must be visually unmistakable from human good words:** `--surface-sunken` fill, `--radius-card`, a **1px dashed `--border-strong`** border, a `Robot` icon with the label "Robot guess" in `caption` weight 600, no avatars, no quote, no vouched-by row. Level 0, no shadow.
- Never appears inside a shelf or mixed into a list of human good words. It can be converted into a real good word only if a human vouches for it, at which point it becomes a normal card.

#### 4.2.10 Comment
- **Purpose:** one message in a title's conversation within a group (5.17).
- **Anatomy:** avatar (32) · name (`body-strong`) · relative time (`caption`, in a `<time>` element) · "edited" (`caption`, if edited) · body (`body`, max `--width-reading`) · more-actions icon button (`DotsThree`) for the author, and for the group owner. Level 0 on `--surface`, no border or shadow. Comments are separated by `--space-4`.
- **Grouping:** consecutive comments by the same person within 5 minutes collapse the avatar and name, so a burst reads as one turn (standard messaging pattern). The time shows on the first of the group.
- **Mentions** render as `@Name` in `body-strong`. A mention of **you** is shown in `--action-text` on an `--action-wash` pill (4px horizontal padding), so it's findable at a glance; the text itself (your name) means it never relies on color alone.
- **Variants:** default, mentions-you (a 2px `--action` bar on the leading edge plus the visually hidden label "Mentions you"), spoiler (4.2.12), sending (body at 60% opacity with "Sending…" caption), failed (`WarningCircle`, "Didn't send." with Retry and Delete), new (the first unseen comment is preceded by a "New" divider).
- **Actions:** author: Edit, Delete. Group owner: Delete (on anyone's comment). No reactions in the MVP.
- **Edit** happens inline in place (the body becomes a textarea with Save and Cancel). Edited comments show "edited", because unlike notes, conversations depend on what was said when.
- **Delete** is immediate with an Undo toast (5.11). Deleted comments disappear entirely; there are no nested replies to orphan.
- **Accessibility:** each comment is an `<article>` in an ordered list, with an accessible name like "Priya, 2 hours ago". The actions button is labeled "More actions for Priya's comment".
- **Don't:** nest replies, show read receipts, or show typing indicators.

#### 4.2.11 Composer (with mentions)
- **Purpose:** write a comment in the current group's conversation.
- **Anatomy:** pinned to the bottom of the conversation screen above the safe area (and above the keyboard, via `visualViewport`, 8.2): a visibility line in compact form ("Visible to College crew · 6 people", 4.2.6), then an auto-growing textarea (1 to 5 lines, `--surface-raised`, 1px `--border-strong`, pill radius at 1 line, `--radius-card` when taller), then a row with the Mention button (`At`), the Spoiler toggle (`EyeSlash`, `aria-pressed`, label "Spoiler", shown in `--action-text` with `fill` weight when on), and the Send button (`PaperPlaneRight` in white on a 36px `--action` circle, 44px hit area). The composer sits on `--surface` with a hairline top border.
- **Placeholder:** "Say something to College crew…" (always names the group).
- **Limits:** 500 characters; counter appears at 400 (same behavior as 4.1.5).
- **Send:** tap Send on touch; on desktop, Enter sends and Shift+Enter adds a line. On mobile, Return adds a line. Sending is optimistic (the comment appears immediately in the "sending" variant).
- **Empty composer:** Send is `aria-disabled` with the label "Write something to send". This is the one sanctioned exception to 3.8's disabled rule, because an inactive send button is the universal messaging convention (Jakob's law) and needs no explanation.
- **Draft protection:** an unsent draft is kept per title per group for the session, and restored when you return.
- **Mention autocomplete:**
  - Typing `@` (or tapping the Mention button, which inserts `@`) opens a suggestion list above the composer showing members of **this group only**, excluding you, filtered by what's typed after `@` (first-name prefix match first, then contains), up to 6 rows of avatar plus name.
  - Arrow keys move, Enter or Tab inserts, Esc closes; tapping a row inserts. The list closes on a space after no match, or when the caret leaves the token.
  - An inserted mention becomes an atomic token (`@Priya` in `body-strong`): Backspace removes the whole token. It's stored by user id, so renamed people still resolve correctly.
  - Typing `@` followed by a name that isn't in the group stays plain text. You can't mention people outside the group, and the list never reveals anyone outside it.
  - **Accessibility:** combobox pattern on the textarea (`aria-autocomplete="list"`, `aria-controls`, `aria-activedescendant`), with the result count announced politely ("3 people").
- **Don't:** add attachments, GIFs, or formatting in the MVP.

#### 4.2.12 Spoiler cover
- A comment marked as a spoiler shows a cover instead of its body: a `--surface-sunken` block, `--radius-control`, 1px dashed `--border-strong`, `EyeSlash` icon in `--text-muted`, and "Spoiler from Priya · Tap to reveal" in `caption`.
- The body is **not rendered** until revealed, so screen readers and search-in-page can't expose it (never a visual blur over real text). The cover is a `<button aria-expanded="false">`.
- Revealing lasts for the session. The author sees their own spoiler uncovered, labeled "Marked as spoiler".
- Anywhere a spoiler comment is previewed (activity, email, title detail preview), the text is replaced with "a spoiler comment".

#### 4.2.13 Activity item
- **Purpose:** one entry in the Activity list (5.17).
- **Anatomy:** actor avatar (40) · one sentence naming the person, the action, the title, and the group ("**Priya** mentioned you on **The Night Ferry** in College crew") · a one-line quote of the comment in `caption` (or "a spoiler comment") · relative time · 64×96 poster on the trailing edge. Unread items have a leading 8px `--action` dot plus the visually hidden word "Unread" and use `body-strong` for the sentence.
- The whole row is one link to the exact comment. Opening it marks it read.
- Types in the MVP: mention, new comment in a conversation you're part of, someone joined your group (owners only).
- Level 0 rows with hairline `--border-subtle` dividers, like `row` rec cards. Unread rows also get an `--action-wash` background.

---

## 5. Patterns

Each pattern names the user problem, the solution, and the rules. Screens in the product spec compose these.

### 5.1 Navigation and information architecture

**MVP sitemap**
```
/                      marketing page (signed out) or redirect to last shelf (signed in)
/sign-in               sign in
/join/[code]           invite landing
/shelf/[groupId]       a group's shelf        (Shelf tab)
/shelf/all             all groups, labeled
/title/[type]/[id]     title detail
/title/[type]/[id]/conversation?group=[groupId]   a group's conversation about a title
/activity              mentions, replies, and joins (Bell in the top bar)
/you                   your shelf, groups, settings, help (You tab)
/you/settings          account, notifications, about
/groups/new            create a group
/groups/[id]           group details, members, invite
```
Add is a sheet over the current screen, reachable from anywhere.

**Rules**
- **Every meaningful state has a URL.** Filters, sort, and the selected group live in the query string, so Back undoes a filter change, links can be shared, and refresh keeps your place.
- **Back does what users expect.** It closes the top sheet first, then returns to the previous screen. Never trap the user or skip a step.
- **Scroll position is restored** when returning to a shelf from a detail screen.
- **Deep links always land somewhere useful.** A signed-out user following a deep link signs in and then lands exactly where the link pointed.
- **Maximum depth of two** from any tab (shelf → title → back). No nested navigation stacks.

### 5.2 Joining a group (first run for invitees)
Most people will meet Good Word through an invite link. This is the most important first impression.

1. **Invite landing (`/join/[code]`), signed out.** Shows: who invited you (avatar and first name), group name, member count, and one sentence about Good Word. The shelf's contents stay hidden until you join (privacy). Primary action: "Join College crew". Secondary: "What's Good Word?" (links to the marketing page).
2. **Sign in** (5.3). The invite context stays visible at the top ("Joining College crew") so the user never loses the thread.
3. **Land on the group's shelf**, not a tutorial. A one-time welcome banner: "You're in. Here's what College crew vouches for."
4. **First-good-word prompt** after the user has looked around (on first scroll end or after 20 seconds, whichever comes first), as a small inline card, not a modal: "What's something you'd tell these folks to watch?" with a button to Put in a good word.

**Rules**
- **No tutorial carousels, no multi-step onboarding, no taste quiz** in the MVP. Teach in context through empty states and the first-good-word prompt.
- **Progressive disclosure:** name, notifications, and groups beyond this one are never asked for before they're needed.
- **Invalid or expired link:** a friendly error state ("This invite link has expired. Ask Priya for a new one.") with a way to learn about Good Word.
- **Already a member:** skip straight to the shelf with a toast ("You're already in College crew").

### 5.3 Signing in
- **Passwordless:** email magic link, plus "Continue with Google". No passwords, no puzzles, no memory tests (meets WCAG 3.3.8 Accessible Authentication).
- **Email step:** one field (`type="email"`, `autocomplete="email"`), one button "Email me a sign-in link". Validate format on submit.
- **Check-your-email step:** shows the address the link went to, a "Use a different email" link, and "Resend link" that becomes available after 30 seconds with a visible countdown. States that the link works for 15 minutes.
- **Link opened on a different device or browser:** sign the user in there and continue, rather than erroring.
- **Expired or used link:** a banner explaining it plus a one-tap resend, prefilled with the email.
- **Session length:** stay signed in for 90 days on a device. Signing out is in You › Settings.
- **Name:** asked once, after the first sign-in, as a single field: "What should friends call you?" Prefilled from Google when available. It's the name shown on every good word.

### 5.4 Putting in a good word (the core flow)
Target: median under 10 seconds from tapping Add to seeing the confirmation.

1. **Tap Add** (tab bar, rail, `n` on desktop, or the vouch button on any title). The search sheet opens with the keyboard up.
2. **Pick a result.** Annotations prevent duplicates (4.2.4).
3. **Confirm sheet:** poster, title, year; the note field (optional, placeholder "ep 3 is where it gets you"); the visibility line, defaulting to **all your groups**; and the primary button "Put in a good word".
4. **Tap the button.** The sheet closes, the card appears at the top of the shelf with the insert animation, and a toast names the audience: "On your shelf. Priya, Jonah, and 4 others will see it." with Undo.

**Rules**
- The note is skippable with zero extra taps. The primary button is reachable one-handed with the keyboard open.
- **Already vouched in all selected groups:** the confirm sheet shows "Your good word is already on these shelves" and offers Edit note instead.
- **A friend already vouched:** your good word joins theirs on the same card. One card per title per group, with a growing vouched-by row. Never a duplicate card.
- **Draft protection:** dismissing the sheet with a typed note asks nothing; the note is kept, and reopening the same title restores it for the session.
- **Offline:** the good word is queued, shown with a "Sending when you're back online" caption, and sent automatically (5.12).
- **Editing later:** Edit note and Change groups from the vouch menu. Edits are silent (no "edited" label) because the stakes are low.

### 5.5 Search
- Search is scoped to titles in TMDB, not to people or groups, in the MVP.
- Recent searches appear when the field is empty and are stored per device.
- Queries of 2+ characters search as you type (250ms debounce). Pressing Enter selects the highlighted result.
- Every no-results message suggests a concrete next step.

### 5.6 Browsing and filtering the shelf
- **Default sort:** newest good word first. Alternative: "Most vouched".
- **Controls** stick under the top bar: segmented control (All / Movies / Shows), then filter chips for streaming services with counts, then sort.
- **Active filters are always visible**, with a single "Clear" action and a result count ("12 good words").
- **Filters combine** with AND across types (Movies + Netflix) and OR within a type (Netflix OR Hulu), and the UI says so implicitly by grouping chips by type.
- **Empty result:** "Nobody's vouched for a Netflix movie yet." with Clear filters, plus the robot-guess offer where it applies (5.15).
- **Pagination:** infinite scroll with a visible "Load more" fallback button and a footer ("That's the whole shelf") so users know when they've reached the end. Screen readers get the result count and the load-more button.

### 5.7 Title detail
- Order of content, most to least important: poster and title, who vouched and their notes, where to watch, the vouch button, the conversation preview (5.17), then metadata (genre, runtime or seasons, year, overview).
- **For now, the `detail` rec card follows 4.2.2's order** (meta, genres, where to watch, then friends' good words, then the vouch button). The two orders are reconciled when the title detail screen is built (open question 9).
- **Where to watch** comes from TMDB's watch provider data for the user's region, showing provider names and logos grouped by Stream / Rent / Buy. **JustWatch attribution is required** alongside this data, per TMDB's terms. If nothing is available: "Not streaming in your region right now."
- The overview is collapsed to 3 lines with "More" when longer.

### 5.8 Groups
- **Create:** one field ("Name your group", with examples like "College crew") and a Create button. Then land directly on the invite card. Nothing else is asked.
- **Roles (MVP):** the creator is the owner and can rename the group, remove members, reset the invite link, and delete the group. Everyone else is a member and can invite and leave.
- **Leave group:** dialog ("Leave College crew? Your good words will leave this shelf too. You can rejoin with an invite.") with Cancel and a danger "Leave group".
- **Remove member (owner):** dialog naming the person and the consequence.
- **Delete group (owner):** dialog stating it can't be undone and how many good words and members are affected. The danger button repeats the specific action: "Delete College crew".
- **Reset invite link:** the old link stops working immediately; the confirm dialog says so.

### 5.9 Forms and validation
- Ask for as little as possible. Every field must justify its existence.
- One column. Labels above fields. Optional fields marked "(optional)"; required ones are unmarked, because most are required.
- Validate on blur and on submit, never on the first keystroke. Remove errors as soon as they're fixed.
- **On submit with errors:** move focus to the first invalid field. Forms with 3+ fields also show an error summary at the top linking to each error.
- Never clear what the user typed. Never ask for the same information twice in a session (WCAG 3.3.7 Redundant Entry).
- The submit button stays enabled and explains what's missing when pressed (3.8).

### 5.10 Feedback and system status

**Response time rules** (based on Nielsen's response-time limits)
| Response time | What the user sees |
|---|---|
| Under 100ms | Nothing extra; it just happens. Use optimistic updates for all writes |
| 100ms to 1s | Nothing for the first 300ms, then a loading state on the triggering control |
| 1 to 10s | Skeleton for content regions; the rest of the UI stays usable |
| Over 10s | Determinate progress, an estimate, and the option to leave and be notified (future imports only) |

**Choosing the feedback channel**
| Situation | Channel |
|---|---|
| A field is invalid | Inline, next to the field |
| The user completed an action | Toast, with Undo if reversible |
| A background action failed | Toast with Retry; the optimistic change reverts |
| An ongoing condition (offline, expired link) | Banner |
| A region can't show content | Empty state or error state in that region |
| An irreversible decision | Dialog |
| A milestone | Milestone moment (4.1.20), once |

Never use a dialog for success. Never use a toast for something the user must act on to continue.

### 5.11 Destructive actions
- **Prefer Undo over confirmation.** Confirmation dialogs train people to click "Yes" without reading; Undo lets them act fast and recover.
- **Reversible** (take back a good word, remove a filter, edit a note): act immediately, show a toast with Undo for 8 seconds.
- **Irreversible or affecting others** (delete group, remove member, leave group, reset invite link, delete account): a dialog that names the object and the consequence, with the danger button repeating the action ("Delete College crew").
- Destructive actions are never the default focused button, never cobalt, and never placed where a thumb rests.

### 5.12 Screen states
**Every screen must design and build all of these.** A screen spec without them is incomplete.

| State | Definition | Rule |
|---|---|---|
| **Ideal** | Full of real content | The design most people imagine |
| **Empty (first use)** | No content yet because the user or group is new | Explain the value and give one action |
| **Empty (no results)** | Filters or search exclude everything | Say what was excluded and how to clear it |
| **Loading** | Waiting on data | Skeletons that match the ideal layout (4.1.17) |
| **Partial** | Some content, or one region failed | Show what loaded; isolate the failure to its region |
| **Error** | Nothing could load | Plain-language error state with Retry (4.1.19) |
| **Offline** | No connection | Banner; show cached content; queue writes; disable nothing silently |

**Offline specifics:** reads show the last cached shelf with a caption ("Last updated 2h ago"). Writes (good words, note edits, comments) queue locally and send on reconnect, with the item captioned "Sending when you're back online". Actions that can't work offline (inviting, joining) explain why when tapped.

### 5.13 Notifications and email
Nudges are a core part of the strategy, so they have to feel like a friend, not a marketer.
- **Every notification names a person or a title.** "Priya put in a good word for The Night Ferry", never "You have new activity".
- **Every notification deep-links** to exactly what it mentions.
- **Weekly digest email** is on by default and can be turned off in one tap from the email itself (one-click unsubscribe) and in Settings. It lists the week's good words per group with posters (with alt text), names, and notes, and works in plain text and in dark-mode email clients.
- **Frequency caps:** at most one digest per week and at most one nudge per day across all channels. Quiet hours from 9pm to 9am in the user's timezone.
- **Push permission (when the app supports it)** is requested only after a value moment (for example, the first time a friend's good word lands in your group), with an in-app pre-prompt explaining what you'll get. Never on first launch, and never again for 30 days if dismissed.
- **Mentions are direct and timely.** A mention appears in Activity immediately and sends an email batched over 15 minutes (so an edit or a burst of mentions becomes one email). Mention emails respect quiet hours but are **exempt from the one-nudge-per-day cap**, because someone asked for you personally. On by default.
- **New comments in conversations you're part of** (you commented, or you vouched for that title in that group) appear in Activity. They don't email individually; the weekly digest summarizes them ("12 new comments on 3 titles").
- **Never notify people about their own actions**, and never for a comment that was deleted before the notification went out (retract the Activity item too).
- **Per-type controls** in Settings: digest, mentions, conversation activity, group joins, and reminders, each independently on or off, per channel.
- **Record the source** of each good word (organic, digest, nudge) so the team can tell whether people log on their own (12.4).

### 5.14 Privacy and trust
- **Nothing is public.** No public profiles, no discoverable groups, no search engine indexing of app routes (`noindex`).
- **Audience is shown before sharing,** always, via the visibility line (4.2.6).
- **No read receipts or "who viewed"** of any kind.
- **Membership is visible to members:** anyone in a group can see who else is in it.
- **Conversations stay inside their group.** A comment is only ever visible to members of the group it was written in, and you can only mention members of that group. The same title can have separate conversations in different groups, and no group ever sees another group's conversation or even whether one exists.
- **Account controls** in Settings: download my data, delete my account (irreversible dialog, 5.11). Deleting an account removes that person's good words from every shelf.
- Plain-language privacy summary in About, above the legal text.

### 5.15 Robot guess (opt-in, if and when built)
- Offered **only** when a request or filter has no human results, as a secondary action below the empty state: "Want a robot's guess?"
- Results render as robot guess cards (4.2.9) in their own labeled section, never inside a shelf.
- A robot guess never appears unrequested, never sends a notification, and is never counted as a good word.

### 5.16 Help and settings
- **Consistent help location:** Help lives in You › Help and in the desktop rail footer, in the same place on every screen (WCAG 3.2.6). It includes a short FAQ, keyboard shortcuts, and a way to contact Sydney.
- **Contextual help** appears in empty states and helper text at the moment of need, never as a tour.
- **Settings** take effect immediately (switches), are grouped by topic (Account, Notifications, About), and confirm with a toast only when the effect isn't visible.

### 5.17 Conversations, mentions, and activity
**User problem:** people want to talk about what they're watching with the friends who recommended it ("wait until ep 6", "@Tess you'd love the ending"), without moving to the group chat and losing the thread.

**Where conversations live**
- A conversation belongs to **one title in one group**. It exists only for titles on that group's shelf (at least one member has put in a good word there), so every conversation is discoverable from the shelf.
- **Entry points:** the conversation preview on title detail, the comment count on shelf cards, Activity items, and mention emails.
- **On title detail**, the conversation preview shows the group's name, the 3 most recent comments, "See all 12 comments", and a tappable "Add a comment" field that opens the full conversation with the composer focused. If the title is on several of your groups' shelves, a group chip row above the preview switches between their conversations. The default is the group you arrived from (`?group=`), otherwise the one with the most recent comment.
- **The full conversation** (`/title/[type]/[id]/conversation?group=`) is its own screen: a compact header (poster thumbnail, title, group name, and back), the comment list, and the composer pinned to the bottom (4.2.11). On desktop it's a panel beside the title detail rather than a separate page.

**How the list behaves** (standard messaging patterns)
- **Chronological, oldest at the top, newest at the bottom.** Flat, with no nested replies; people reply by mentioning.
- **Opening a conversation** scrolls to the first unseen comment below a "New" divider, or to the bottom if everything's been seen. Older comments load in pages of 30 when scrolling up, with scroll position preserved.
- **Live updates:** while the conversation is open, new comments from others appear at the bottom. If you're scrolled up reading, they don't move your view; a pill appears ("2 new comments") that jumps to them. Screen readers get a polite "New comment from Priya", throttled to one announcement per 10 seconds.
- **Your own comment** appears immediately (optimistic) and the view scrolls to it.

**Mentions**
- Only members of the conversation's group can be mentioned (4.2.11). A mention notifies the person (5.13) and links straight to that comment, highlighted for 2 seconds on arrival (no motion under reduced motion).
- Editing a comment to add a mention notifies the newly mentioned person; editing never re-notifies people already mentioned. Deleting a comment retracts its unread Activity items.

**Spoilers**
- The composer's Spoiler toggle covers the comment for everyone else (4.2.12). Suggest it (never force it) with a one-time hint the first time someone comments on a series: "Talking about a specific episode? Mark it as a spoiler."

**Activity** (`/activity`, the `Bell` in the top bar)
- A reverse-chronological list of activity items (4.2.13), grouped by Today, This week, and Earlier. The bell shows the unread count (max "99+").
- Opening Activity doesn't mark everything read; opening an item does. A "Mark all as read" action sits at the top when there are unread items.
- Items older than 90 days are removed.
- **Empty state:** "Nothing yet. When friends mention you or reply, it'll show up here."

**States** (5.12)
| State | Conversation | Activity |
|---|---|---|
| Empty | "No one's said anything about this yet. Start the conversation." with the composer focused on tap | See above |
| Loading | 4 skeleton comments | 5 skeleton rows |
| Error | Error state with Retry; the composer and any draft stay usable | Error state with Retry |
| Offline | Cached comments; new comments queue as "Sending when you're back online" | Cached items with the offline banner |

**Moderation (small private groups)**
- Authors can edit and delete their comments; group owners can delete any comment in their group. Removing a member leaves their past comments visible, attributed to them, but they can no longer read or post. Reporting is out of scope for the MVP.

---

## 6. Content design

### 6.1 Voice
Good Word sounds like **a friend with great taste**: considered, confident, and warm, never trying too hard. Our copy frames; friends' notes and comments carry the emotion. (See `BRAND.md` 3.)

| We are | We are not |
|---|---|
| Warm | Gushing |
| Specific | Vague |
| Dry, occasionally | Jokey, or funny in serious moments |
| Confident | Loud |
| Understated | Cold or corporate |

### 6.2 Tone by situation
Voice stays constant; tone adapts to the user's state.

| Situation | Tone | Example |
|---|---|---|
| Success | Warm, brief | "On your shelf. Priya and Jonah will see it." |
| Empty, first use | Inviting | "Your shelf is empty. What's something you'd tell a friend to watch?" |
| Error | Calm, plain, no jokes | "That didn't save. Check your connection and try again." |
| Destructive | Clear, serious, specific | "Delete College crew? This removes 42 good words for 6 people and can't be undone." |
| Waiting | Reassuring | "Sending when you're back online." |
| Milestone | Quietly pleased, once | "Your first good word." then "Your friends will see it on their shelves." |

### 6.3 Writing rules
- **Front-load.** The most important words come first. People scan the first two words.
- **Buttons are verb + object** and match what happens: "Put in a good word", "Leave group", "Copy link".
- **Use the user's language** from the glossary (1.4). Never internal terms.
- **Address the user as "you".** The product is "we" only in legal and help text.
- **Name people.** "Priya vouched for this" beats "1 friend vouched for this".
- **Sentence case, contractions, no exclamation marks** anywhere in our copy. Friends' own notes and comments can say whatever they like.
- **Never:** "Oops!", "Whoops", fake urgency, guilt ("You haven't added anything in a while…"), or marketing words (revolutionize, seamless, unlock, elevate, empower, supercharge, curated).
- **Plain language:** aim for about a 6th to 8th grade reading level in UI copy.

### 6.4 Formatting
- **Dates:** relative for the past week ("just now", "5m ago", "2h ago", "yesterday", "3d ago"), then absolute ("Sep 12", adding the year if it's not this year). Full date and time in the accessible name and a `<time datetime>` element.
- **Name lists:** "Priya", "Priya and Jonah", "Priya, Jonah, and Tess", "Priya, Jonah, and 3 others". Use `Intl.ListFormat` and `Intl.PluralRules`, never string concatenation.
- **Counts:** numerals always ("3 friends"), thousands separators via `Intl.NumberFormat`, badges cap at "99+".
- **Titles** of shows and movies are shown as TMDB provides them, never in quotes or italics in UI.
- **Meta lines:** "Series · 2024", "Film · 2023 · 1h 52m". Middle dot with spaces.

### 6.5 Error message formula
**What happened + why (if useful) + what to do.** No blame, no codes in the main text.

| Bad | Good |
|---|---|
| "Error 500" | "Good Word is having a moment. Try again in a minute." |
| "Invalid input" | "That email looks incomplete. Check for a missing @ or dot." |
| "Link invalid" | "This sign-in link has expired. We can send a new one." |
| "Failed to save" | "That didn't save. Check your connection and try again." |

Technical details, when useful for support, go in a collapsed "Details" line.

### 6.6 Microcopy library
| Where | Copy |
|---|---|
| Primary log action | Put in a good word |
| Vouched state | Your good word |
| Take it back | Take it back |
| Undo toast after taking back | Taken back. **Undo** |
| Note label | Anything to add? (optional) |
| Note placeholder | ep 3 is where it gets you |
| Visibility line | Visible to College crew · 6 people |
| Log success | On your shelf. Priya, Jonah, and 4 others will see it. |
| Already on shelf | Your good word is already on these shelves. |
| Empty group shelf | Nothing here yet. Be the first to put in a good word. |
| Empty personal shelf | Your shelf is empty. What's something you'd tell a friend to watch? |
| Empty filter result | Nobody's vouched for a Netflix movie yet. |
| Robot offer | Want a robot's guess? It won't be from your friends. |
| Search empty | Search for a show or movie |
| Search no results | Nothing for "nite ferry". Check the spelling, or try the original title. |
| Search error | Search isn't working right now. Try again. |
| Offline banner | You're offline. We'll send your changes when you're back. |
| Queued item | Sending when you're back online |
| End of shelf | That's the whole shelf. |
| Invite copied | Link copied. Send it to someone whose taste you trust. |
| Invite landing | Priya invited you to College crew. 6 people are already sharing what they'd watch. |
| Expired invite | This invite link has expired. Ask Priya for a new one. |
| Sign-in sent | Check your email. We sent a link to sam@example.com. It works for 15 minutes. |
| Name prompt | What should friends call you? |
| Leave group | Leave College crew? Your good words will leave this shelf too. |
| Delete group | Delete College crew? This removes 42 good words for 6 people and can't be undone. |
| First good word milestone | Your first good word. · Your friends will see it on their shelves. |
| Conversation preview heading | Talk about it in College crew |
| Add a comment field | Add a comment… |
| Composer placeholder | Say something to College crew… |
| Empty conversation | No one's said anything about this yet. Start the conversation. |
| See all | See all 12 comments |
| New comments pill | 2 new comments |
| Spoiler cover | Spoiler from Priya · Tap to reveal |
| Spoiler hint | Talking about a specific episode? Mark it as a spoiler. |
| Comment failed | Didn't send. **Retry** |
| Comment deleted toast | Comment deleted. **Undo** |
| Mention activity | **Priya** mentioned you on **The Night Ferry** in College crew |
| Comment activity | **Jonah** commented on **The Night Ferry** in College crew |
| Mention email subject | Priya mentioned you on The Night Ferry |
| Empty activity | Nothing yet. When friends mention you or reply, it'll show up here. |

---

## 7. Accessibility

**Standard: WCAG 2.2 Level AA**, as a floor. Accessibility is part of the definition of done, not a later pass.

### 7.1 Criteria that shape this product
| Criterion | What we do |
|---|---|
| 1.4.3 Contrast (minimum) | All text pairings verified (3.1.3) |
| 1.4.11 Non-text contrast | Fields and controls use `--border-strong` (3:1 or more); focus rings and checked states use cobalt (5:1 or more); state never relies on color alone (3.1.3) |
| 1.4.10 Reflow | Works at 320 CSS px wide and 400% zoom without horizontal scrolling |
| 1.4.12 Text spacing | Layouts survive increased line, letter, and word spacing; no fixed-height text containers |
| 1.4.4 Resize text | Works at 200% text size |
| 1.4.13 Content on hover or focus | Tooltips are dismissible, hoverable, and persistent |
| 2.1.1 Keyboard | Every function works by keyboard |
| 2.4.3 Focus order | Follows visual order; sheets and dialogs trap and restore focus |
| 2.4.7 Focus visible | 2px cobalt focus ring with a 2px offset, both themes, every interactive element |
| 2.4.11 Focus not obscured | `scroll-padding` keeps focused elements clear of sticky bars |
| 2.5.7 Dragging movements | Every drag (sheet swipe-down) has a button alternative |
| 2.5.8 Target size | 44px minimum, beyond the 24px requirement |
| 3.2.6 Consistent help | Help is in the same place everywhere (5.16) |
| 3.3.1 / 3.3.3 Error identification and suggestion | Error formula (6.5), linked to fields |
| 3.3.7 Redundant entry | Never ask for the same info twice (5.9) |
| 3.3.8 Accessible authentication | Magic link and Google, no passwords or puzzles |
| 4.1.3 Status messages | Toasts, result counts, and queued states use live regions |

### 7.2 Screen reader patterns
- **Landmarks:** `header` (top bar), `nav` (tab bar or rail, labeled "Main"), `main`, and `aside` where needed. A "Skip to content" link is the first focusable element.
- **Headings:** one `h1` per screen (the `title-l`), then a logical outline.
- **Cards** have one accessible name written as a sentence (4.2.2). Decorative elements (empty poster outlines, dots) and duplicate avatars are `aria-hidden`.
- **Live regions:** one polite region for toasts and status, created at app load (not on demand, which some screen readers miss). `role="alert"` only for blocking errors.
- **Route changes** move focus to the new page's `h1` and update `document.title` ("College crew · Good Word").
- **Icons** are `aria-hidden` when next to text, labeled when alone.

### 7.3 Cognitive accessibility
- Plain language (6.3), consistent terminology (1.4), and one primary action per screen.
- No time limits except the 15-minute sign-in link, which is stated upfront and resendable.
- Nothing flashes more than three times per second. Nothing auto-plays.

### 7.4 Testing protocol
- **Automated:** axe-core in CI on `/styleguide` and every route, in both themes. Zero violations to merge.
- **Keyboard:** full pass of every new flow with no mouse.
- **Screen readers:** VoiceOver on iOS Safari (primary), VoiceOver on macOS Safari, NVDA on Windows Chrome for major releases.
- **Zoom and reflow:** 200% text and 320px width checks on every new screen.
- **Reduced motion and forced colors:** checked in `/styleguide`.

---

## 8. Platform and responsive behavior

### 8.1 Responsive behavior by component
| Component | Mobile (base) | Tablet (`md`) | Desktop (`lg`+) |
|---|---|---|---|
| Navigation | Bottom tab bar | Bottom tab bar | Left rail |
| Add | Center tab button, opens sheet | Same | Rail button, opens modal |
| Sheets | Bottom sheet | Bottom sheet, max 560px wide, centered | Centered modal, max 480px |
| Menus | Sheet | Sheet | Popover |
| Shelf grid | 2 columns | 3 columns | 4 columns |
| Title detail | Stacked | Stacked, wider poster | Poster left, content right |
| Toasts | Bottom-center above tab bar | Same | Bottom-left |

Layouts must be designed for each breakpoint, not just scaled.

### 8.2 iOS Safari (the primary platform)
- `viewport-fit=cover` and `env(safe-area-inset-*)` on all fixed elements.
- Use `100dvh`, never `100vh`, for full-height layouts.
- Inputs at 16px or larger to prevent auto-zoom.
- Sheets containing inputs position against `visualViewport` so the keyboard never covers the primary button.
- `overscroll-behavior: contain` inside sheets so scrolling doesn't pull the page.
- Suppress the default tap highlight only because the system provides its own press state.
- Use the native share sheet (Web Share API) for sharing, with copy as fallback.

### 8.3 Installable web app readiness
- Web app manifest (name, short name "Good Word", icons, `theme-color` from `--surface`, `display: standalone`).
- Standalone mode respects safe areas and has in-app back navigation (no browser chrome).
- Service worker for offline shell and queued writes (5.12).

### 8.4 Native app readiness (future)
- Tokens move to a W3C Design Tokens (DTCG) JSON file generating `tokens.css`, Tailwind config, and Swift constants via Style Dictionary, when a native app begins. Until then, `tokens.css` is canonical.
- Patterns in Section 5 are written platform-agnostic so a SwiftUI build follows the same behavior, adopting native controls where iOS users expect them.

---

## 9. Performance as UX

Perceived speed is part of the design.

| Metric (mobile, mid-tier phone, 4G) | Budget |
|---|---|
| Largest Contentful Paint | under 2.5s (marketing under 2.0s) |
| Interaction to Next Paint | under 200ms |
| Cumulative Layout Shift | under 0.1 (marketing under 0.05) |
| JavaScript per route (compressed) | under 170KB |

- **Optimistic updates** for every write so interactions feel instant (5.10).
- **Poster images** use TMDB size variants via `srcset`: `w154` for row cards, `w342` for grid cards, `w500` for detail. Always set width and height or aspect ratio.
- Only the first row of posters loads eagerly; the rest lazy-load.
- Fonts subset to Latin, Inter and Instrument Serif preloaded, with metric-matched fallbacks.
- Skeletons, not spinners, for content (4.1.17).

---

## 10. Internationalization readiness
English (US) only for the MVP, built so other languages don't require a redesign.
- **No hardcoded strings** in components. All copy lives in a messages file keyed by id, even with one language.
- **Plan for 40% text expansion.** Buttons and chips grow; they never truncate labels.
- **No text in images.** Fallback posters render text in HTML.
- **Logical CSS properties** everywhere for future right-to-left layouts.
- **`Intl` APIs** for dates, numbers, lists, and plurals (6.4).
- **Region-aware data:** where-to-watch uses the user's region.

---

## 11. Implementation

### 11.1 Structure
```
/styles
  tokens.css               # Section 3.1.1, the only place raw values live
/components
  ui/                      # primitives (Section 4.1)
  domain/                  # domain components (Section 4.2)
  icon.tsx                 # the one Phosphor wrapper
/lib
  genre-accent.ts          # genreAccent map
  people-color.ts          # deterministic avatar and group colors
  format.ts                # Intl-based dates, lists, counts
/messages
  en.json                  # all UI copy
/app
  (marketing)/             # existing marketing page, forced light
  (app)/                   # product screens
  styleguide/              # living reference (Section 14)
```

### 11.2 Tailwind
- Map semantic tokens into the Tailwind theme (via `@theme` in Tailwind v4, or the config in v3, whichever the marketing page already uses). Class names use token names: `bg-surface`, `text-muted`, `border-subtle`, `border-strong`, `shadow-md`, `rounded-card`, `duration-fast`, `ease-standard`.
- Arbitrary values (`bg-[#…]`, `text-[17px]`, `shadow-[…]`) are banned in components.

### 11.3 Component API conventions
- Typed props. Variants via an explicit, small API (`variant`, `size`, `tone`), never free-form class overrides.
- Native elements first (`button`, `a`, `input`, `dialog`, `details`), styled with Tailwind.
- Components forward refs and pass through `aria-*` and `data-*` attributes.
- No inline styles, no one-off colors, no copy strings inside components (use messages).

### 11.4 Accessibility primitives
- Hand-build simple components. For complex keyboard patterns (combobox, menu, dialog focus management), a headless, unstyled library such as React Aria may be used, since accessible behavior is hard to get right by hand. It must add no styles of its own.

### 11.5 Lint rules (fail the build)
- Raw primitives (`--paper`, `--ink`, `--cobalt`, `--clay`, etc.) or hex values inside `/components` or `/app/(app)`.
- Font families other than Inter and Instrument Serif; Instrument Serif below 24px.
- Tailwind arbitrary color, size, or shadow values.
- Importing icon libraries other than `@phosphor-icons/react`.
- Hardcoded UI strings in JSX in `/components` and `/app/(app)`.
- `outline: none` without a replacement focus style.

### 11.6 Rebuilding the marketing page on v3
Do this once, before building app screens. The existing page was built on the v1 playful direction.
1. Create `tokens.css` (3.1.1) and the Tailwind mapping. Remove the v1 tokens and fonts (Fraunces, Figtree, Gochi Hand) from the project.
2. Build the shared primitives the marketing page needs (button, avatar, poster, rec card, chip) in `/components`, per Section 4, and show them in `/styleguide`.
3. Rebuild the page from `good-word-marketing-page-spec.md` (v2) using only those components and tokens. Keep routing, metadata, and accessibility structure where they still fit.
4. Verify at 360, 390, 768, 1024, and 1440, and against the spec's acceptance checklist.
5. Report anything in the spec that conflicts with this doc, and ask which wins.

---

## 12. Quality

### 12.1 Screen definition of done
A screen is done when:
- [ ] Its purpose and single primary action are clear
- [ ] All states from 5.12 are designed and built (ideal, both empties, loading, partial, error, offline)
- [ ] Layouts are intentional at 360, 390, 768, 1024, and 1440
- [ ] One `h1`, logical headings, correct landmarks, sensible focus order
- [ ] Keyboard-only and VoiceOver passes completed
- [ ] Works at 200% text, 320px reflow, reduced motion, and in both themes
- [ ] All copy comes from the messages file and follows Section 6
- [ ] URL reflects meaningful state; Back and refresh behave correctly
- [ ] axe-core reports zero violations
- [ ] Performance budgets met

### 12.2 Component definition of done
- [ ] Purpose, anatomy, variants, states, behavior, accessibility, content, and don'ts documented here
- [ ] Every state from 3.8 implemented and shown in `/styleguide`
- [ ] Uses only semantic tokens; passes lint
- [ ] Correct role, name, keyboard behavior, and announcements
- [ ] Works in both themes, forced colors, reduced motion, and at 200% text
- [ ] Visual snapshot and axe test in CI

### 12.3 Testing
- **Visual regression:** Playwright screenshots of `/styleguide` and key screens at 390 and 1440, in light and dark, on every change.
- **Accessibility:** axe-core in CI (7.4) plus the manual protocol for new patterns.
- **Usability:** before each major flow ships, a round of 5 moderated sessions with people outside the team, using realistic tasks ("You just finished a show you loved. Tell your friends about it."). Fix severity-1 and severity-2 issues before release.
- **Heuristic review:** each new screen is walked through against the table in 1.2.

### 12.4 UX metrics
Measure whether the design works, not just whether it ships. Adapted from Google's HEART framework.

| Goal | Signal | Metric | Target (initial) |
|---|---|---|---|
| Adoption | Invitees join | % of invite link opens that end in a joined member | 60%+ |
| Activation | New members contribute | % who put in their first good word within 7 days of joining | 50%+ |
| Task success | The core flow is fast | Median time from Add to confirmation; completion rate | under 10s; 90%+ |
| Engagement | People log on their own | Good words per active member per week, split by source (organic vs digest vs nudge) | Trend up; organic share 50%+ |
| Retention | People come back | Members active in week 4 after joining | 40%+ |
| Happiness | It feels good | Occasional one-question pulse, never more than once a quarter | Qualitative |

Event logging is first-party and minimal, stores no viewing history beyond good words, and is described in the privacy summary.

---

## 13. Governance

### 13.1 Ownership
Sydney owns the design system. Changes are proposed, reviewed, and recorded here before code changes.

### 13.2 How to change the system
1. **Propose** the change in this doc (a new or edited section), with the reason and the principle or heuristic it serves.
2. **Implement** it in tokens and components.
3. **Review** it in `/styleguide` in both themes, with contrast re-verified for any color change.
4. **Record** it in the changelog (Section 17) with a version bump.

### 13.3 Versioning
Semantic versioning for the system:
- **Major:** breaking changes (a token renamed or removed, a component API change, a pattern that changes user-facing behavior).
- **Minor:** new tokens, components, or patterns; new variants.
- **Patch:** value tweaks, bug fixes, documentation.

### 13.4 Adding and retiring things
- **Adding a component:** only when the same need appears in two or more places. Until then, build it locally in the screen and promote it later.
- **Deprecating:** mark it deprecated here and add a lint warning for one minor version, then remove it in the next major.
- **Exceptions:** a screen may deviate from the system only with a written reason. Repeated exceptions are a signal to change the system.

---

## 14. The `/styleguide` route
One page that renders:
- **Foundations:** color swatches with live-computed contrast ratios for every pairing in 3.1.3, in both themes; the type scale; spacing; elevation levels; radii; motion demos (with a reduced-motion toggle); the full icon map.
- **Components:** every component in every state from 3.8, every variant and size.
- **Patterns:** one working example of each pattern from Section 5, including all screen states from 5.12. Patterns are added step by step: each build step adds the patterns it builds, using the real components and behavior, rather than all patterns being mocked up front in step 0.
- **Controls:** dev-only theme toggle (light / dark, also `?theme=dark`), reduced-motion simulation, forced-colors preview note, and a 200% text toggle.

It is excluded from search indexing and from production navigation, and it's the target for visual regression and axe tests.

---

## 15. Acceptance checklist

**Foundations**
- [ ] `tokens.css` is the only place raw values are defined, with light and (gated) dark sets
- [ ] Tailwind maps semantic tokens; arbitrary values are blocked by lint
- [ ] Fields and controls use `--border-strong`; nothing relies on color alone for state (3.1.3)
- [ ] Contrast verified live in `/styleguide` for both themes; all pass
- [ ] Phosphor is the only icon library, `regular` weight, through one `Icon` wrapper
- [ ] Motion follows 3.7; reduced motion removes all movement

**Components**
- [ ] Every component in Section 4 exists and meets 12.2
- [ ] No rotation, stickers, handwriting, illustration, gradients, or hard shadows anywhere (2.3)
- [ ] Instrument Serif appears only at 24px and up; everything else is Inter
- [ ] Posters use TMDB images with genre-colored typographic fallback, stored on the title record
- [ ] Robot guess cards use a dashed `--border-strong` on a sunken surface, and never appear inside a shelf

**Patterns and screens**
- [ ] Every screen meets 12.1, including all states in 5.12
- [ ] Filters and selected group live in the URL; Back and refresh work
- [ ] The log flow completes in under 10 seconds for a new user in testing
- [ ] Visibility line appears everywhere content is shared
- [ ] Undo is used for reversible actions; dialogs only for irreversible ones
- [ ] TMDB and JustWatch attributions present
- [ ] Conversations never leak across groups; mentions only offer members of the current group
- [ ] Spoiler text is never in the DOM, previews, or emails until revealed

**Accessibility and platform**
- [ ] WCAG 2.2 AA criteria in 7.1 met; axe clean in CI
- [ ] VoiceOver on iOS Safari pass for every flow
- [ ] Safe areas, `100dvh`, and 16px inputs on iOS
- [ ] Performance budgets in Section 9 met

**Marketing reconciliation**
- [ ] Marketing page on tokens and shared components, pixel-identical, forced light

---

## 16. Decisions and open questions

**Decided**
- Visual direction: editorial, calm, and minimal; one cobalt accent (v3.0, `BRAND.md`)
- Type: Instrument Serif (display, 24px and up) and Inter (everything else) (3.2)
- Icons: Phosphor, `regular` (3.5)
- Poster fallback tone: from the title's first genre (clay, ochre, moss, plum), stored once (4.2.1)
- Dark mode: prepared, not shipped (3.10)
- Robot guess: dashed `--border-strong` on a sunken surface, so it can never be mistaken for a friend's good word (4.2.9)
- Auth: passwordless (magic link and Google) (5.3)
- One card per title per group; vouches accumulate on it (5.4)
- When someone leaves a group, their good words leave that shelf (5.8)
- Conversations belong to one title in one group, are flat (no nested replies), and allow mentions of that group's members only (5.17)
- Spoilers are covered and never rendered until revealed (4.2.12)

**Open**
1. **Marketing page in dark mode:** proposed to stay light-only as a fixed brand surface. Confirm.
2. **Dark mode depth:** tune the dark shadows and `--surface-raised` by eye in `/styleguide`.
3. **Avatar photos:** initials only for the MVP. Revisit once real groups exist.
4. **Digest day and time:** proposed Thursday at 5pm local, ahead of the weekend. Confirm.
5. **"Watched it" signal:** should people be able to say they watched something because of a friend's good word? It would measure the product's real value, but adds a new action. Revisit after the MVP.
6. **Tokens to DTCG JSON:** move when a native app starts (8.4).
7. **Reactions on comments** (a single "same" or heart): deliberately left out of the MVP to keep conversations about words. Revisit after beta.
8. **Comments from people who leave a group:** proposed to stay visible and attributed so conversations still make sense. Confirm.
9. **Title detail order:** 4.2.2 and 5.7 list the content in different orders. Following 4.2.2 for now; decide when title detail is built (PRD slice 5).

---

## 17. Changelog

- **v3.1.2 (2026-09-28):** Vouch button in rows says "Add" below 768px (4.2.3). Title detail follows 4.2.2's order for now; the conflict with 5.7 is open question 9.
- **v3.1.1 (2026-09-28):** `/styleguide` patterns (14) are added step by step as each build step builds them; step 0 covers foundations and every Section 4 component in every state.
- **v3.1 (2026-09-27):** `title-l` becomes the big editorial page title: 56px (44px step-down), line height 0.92, tracking -0.025em, with spacing rules (3.2.2).
- **v3.0 (2026-09-27): Editorial.** A new visual language: calm, modern, minimal. Behavior, patterns, content rules, and accessibility requirements are unchanged, and section numbers are preserved so the product requirements still resolve.
  - **Breaking:** new palette (paper, ink, graphite, one cobalt accent, muted people tones clay, ochre, moss, plum); `--border` split into `--border-subtle` and `--border-strong`; removed `--highlight`, `--on-accent`, `--shadow-color`, `--radius-input`, and the v2 accent primitives; added `--action-hover`, `--action-text`, `--action-wash`, `--on-action`, `--surface-hover`, `--surface-pressed`, `--people-1` to `--people-4`, `--on-people`, `--poster-edge`, `--radius-control`, `--radius-device`.
  - Type: Instrument Serif (24px and up) and Inter replace Fraunces, Figtree, and Gochi Hand. New tokens `display-m`, `quote`, `card-title`, `overline`.
  - Shape and depth: 1px hairlines and soft shadows replace 2px ink borders and hard offset shadows. Smaller radii for controls; pills only for chips, avatars, badges, and the composer.
  - Icons: Phosphor `regular` instead of `bold`.
  - Components restyled; the Sticker becomes the Milestone moment (4.1.20); grid rec cards lose their card box so posters lead; friends' notes become quotes; empty states drop illustration.
  - Motion: quieter and shorter; no bounce or overshoot.
  - Contrast re-verified by computation for every pairing in both themes (3.1.3).
- **v2.1 (2026-09-27):** Added conversations, mentions, spoilers, and Activity.
  - Glossary: conversation, comment, mention, activity, spoiler; clarified note vs. comment.
  - Components: Comment (4.2.10), Composer with mention autocomplete (4.2.11), Spoiler cover (4.2.12), Activity item (4.2.13); comment count on grid cards; Activity bell in the top bar.
  - Patterns: 5.17 Conversations, mentions, and activity; mention and conversation notification rules (5.13); conversation privacy (5.14); conversation preview on title detail (5.7).
  - Icons: `ChatCircle`, `At`, `EyeSlash`, `PaperPlaneRight`. Microcopy for conversations.
- **v2.0 (2026-09-27):** Rebuilt as a full design system.
  - Added UX principles mapped to Nielsen's heuristics and Laws of UX, a product glossary, token tiers, an elevation model, a universal interaction-state contract, and touch, pointer, and keyboard rules.
  - Expanded components with a consistent spec template; added Icon button, Link, Textarea, Checkbox, Switch, Badge, Menu, Dialog, Tooltip, Banner, Error state, Visibility line, App bars, and Robot guess card.
  - Added the pattern library: navigation and IA, joining a group, sign-in, the log flow, search, filtering, title detail, groups, forms, feedback, destructive actions, screen states, notifications, privacy, help.
  - Added content design, WCAG 2.2 criteria and testing protocol, iOS and responsive rules, performance budgets, i18n readiness, definitions of done, UX metrics, and governance.
  - Verified contrast by computation. Found that accent fills fail 3:1 non-text contrast on paper; made the 2px border mandatory on accent-filled elements and changed the robot guess border from lilac to dashed `--border`.
  - **Breaking:** `--ease` renamed to `--ease-standard`; `--dur-slow` is now 320ms (sheets), and marketing entrances use the new `--dur-expressive` (500ms). Added `--scrim`, `--radius-poster`, `--radius-sheet`, focus and target tokens, layout widths, and new layer tokens.
- **v1.1:** Added Phosphor icons, genre-based poster tinting, and dark mode readiness.
- **v1.0:** Initial system extracted from the marketing page spec.
