# Good Word: Marketing Page Spec (v2, Editorial)

**Version** 2.0 · **Last updated** 2026-09-27

Design and UX requirements for the single-page marketing site that explains Good Word. This version replaces the playful v1 direction with a calm, modern, editorial one. Written to be handed to Claude Code as the build brief.

---

## 0. Notes for the builder (read first)

- **This replaces the existing marketing page.** The v1 page was built from the previous spec. Rebuild it on the v3 design system tokens (`DESIGN-SYSTEM.md`, Section 3) and the brand guide (`BRAND.md`). Reuse the page's routing, metadata, and accessibility structure where it still fits; replace its visual layer entirely.
- This is a **single, static marketing page**. No accounts, no database, no data collection.
- The bar is **"best-in-class editorial product site"**: think a well-set magazine, not a SaaS template. See **Section 4: Anti-generic rules**, which are requirements.
- Build section by section in the order in Section 6. Don't add sections that aren't listed. Ask before inventing new ones.
- All copy here is **final draft copy to use as written** unless marked `[ALT]`.
- Don't use real movie posters, studio artwork, or logos. Use the invented titles and fallback posters described in Section 7.

---

## 1. Product in one paragraph

Good Word is a private place where small groups of friends keep a shelf of the shows and movies they'd vouch for. You belong to a few circles (college friends, the group chat, your book club), and each one has its own shelf. When you need something to watch, you pull from people whose taste you actually trust, and you can talk about it with them. Every pick has a real person's name on it. No algorithm picks, no public profiles, no star ratings.

**Core messages the page must land:**
1. **Humans do the recommending.** Every pick comes from a friend.
2. **Small, private groups.** Your people, not strangers or influencers.
3. **Vouching, not tracking.** You choose what goes on the shelf.
4. **Fast.** Putting in a good word takes about ten seconds.
5. **Talk about it.** Comment, mention friends, and keep spoilers covered, inside the group.

---

## 2. Page goal and audience

- **Goal:** Explain the concept in under a minute and make it feel considered and trustworthy. A visitor should leave able to describe Good Word in one sentence.
- **Primary audience:** Adults, roughly 25 to 45, who already ask friends what to watch and are tired of algorithmic feeds.
- **Secondary audience:** Design and product peers (portfolio context). Craft, restraint, and type quality matter.
- **CTA:** Soft. The product isn't live. "Coming soon" treatment (6.10). No email capture.

---

## 3. Visual direction

Follow `BRAND.md` for the identity and `DESIGN-SYSTEM.md` (v3) for exact tokens. In summary:

- **Feeling:** calm, confident, editorial. A beautifully set magazine written by your friends.
- **Ground:** paper (`--surface`, `#FAFAF9`) with white cards and hairline edges.
- **Type:** Instrument Serif for headlines, very large, with *italic* used once per section at most for emphasis. Inter for everything else, small and quiet. Contrast of scale is the main design move.
- **Color:** neutral page, **one cobalt accent** (`#2B4BFF`) for actions and links only. Color comes from posters and people's avatars. One full-bleed **ink** section (6.7) provides the page's single dramatic moment.
- **Imagery:** real product UI, framed cleanly (phone frame or white card), never tilted. Fallback posters in the muted people tones.
- **Depth:** hairline borders and very soft shadows (`--shadow-sm`, `--shadow-md`). No hard offset shadows.
- **Whitespace:** generous. Sections breathe with at least 96px (desktop) and 64px (mobile) between them.

### 3.1 Marketing type scale
Uses the DS tokens (DS 3.2.1):

| Use | Token |
|---|---|
| Hero headline | `display-xl` (Instrument Serif, `clamp(56px, 10vw, 144px)`, line height 0.95, tracking -0.02em) |
| Section headlines | `display-l` (Instrument Serif, `clamp(40px, 6vw, 80px)`, line height 1.0) |
| Pull quotes | `display-m` (Instrument Serif italic, `clamp(28px, 3.5vw, 44px)`) |
| Eyebrow labels | `overline` (Inter 12px, 600, letterspaced 0.08em, uppercase, `--text-muted`) |
| Body | Inter 18px / 1.6, `--text-muted` for supporting paragraphs |

---

## 4. Anti-generic rules (requirements)

The page must **not** look AI-generated or templated. **Do not use:**

- Gradients of any kind (backgrounds, text, borders), glows, blobs, or noise textures
- Glassmorphism, frosted panels, or neon
- Dark "hero with a glowing screenshot" layouts
- Bento grids, logo clouds, "trusted by" strips, or stat counters
- The "three identical cards with an icon, bold title, and two lines" feature grid
- Decorative icons. Icons appear only inside product UI mockups
- Stock photos, 3D renders, illustrated people, doodles, stickers, or handwriting fonts
- Tilted or rotated elements
- Emoji anywhere in the page chrome
- Default component-library styling
- Fake metrics, fake press logos, or fake testimonials presented as real

**Banned copy words:** revolutionize, seamless, unlock, elevate, empower, supercharge, curated experience, next-generation, AI-powered, effortlessly, discover (as a headline verb), "Say goodbye to…", "Welcome to the future of…".

**Do instead:**
- Left-aligned, asymmetric editorial layouts with a strong type hierarchy.
- One idea per section, stated in one big serif line.
- Show the product through real, precise UI.
- Let quotes from (invented) friends carry the warmth.

---

## 5. Tech requirements

- **Framework:** match the app (Next.js App Router). The marketing page lives in the `(marketing)` route group, forced to light theme (DS 3.10).
- **Styling:** Tailwind mapped to DS v3 tokens. No UI component library.
- **Fonts:** Instrument Serif (400, 400 italic) and Inter (variable) via `next/font`, subset to Latin, with metric-matched fallbacks.
- **Motion:** CSS only, or Framer Motion if already present. Respect `prefers-reduced-motion` (8.3).
- **Deploy:** Vercel, statically rendered.
- **No** analytics, cookies, forms, or third-party scripts.

---

## 6. Page structure and content

Order is fixed. All sections sit on `--surface` unless noted. Content max width is `--width-marketing` (1200px); text columns max `--width-reading`.

### 6.1 Nav
- Left: the **Good *Word*** wordmark (BRAND 4.1).
- Right: text links **How it works**, **Groups**, **Talk about it**, **FAQ** in Inter 15px, then "Coming soon" as a small `--text-muted` label with a 6px cobalt dot before it.
- Sticky. Transparent at the top; after scrolling, `--surface` at 90% opacity with a hairline bottom border. No blur effect.
- Mobile: wordmark and a text button "Menu" that opens a full-screen overlay listing the links in `display-l`. Close with "Close" text button and Esc.

### 6.2 Hero
- **Eyebrow:** "Coming soon"
- **Headline:** Take your friends' *word* for it.
  - `[ALT]` The show recs you'd actually trust.
- **Subhead** (max 36ch): A private shelf of shows and movies your friends vouch for. No algorithm. No strangers. Just your people.
- **CTA:** primary cobalt button "See how it works" (scrolls to 6.4).
- **Layout (desktop):** headline spans the left 7 columns, set very large. On the right 5 columns, a phone frame (7.6) showing a College crew shelf: 4 grid cards with posters and vouched-by rows. Overlapping the phone's lower-left edge, one white quote card (7.2): *"ep 3 is where it gets you. trust me."* — Priya. Everything straight, aligned to the grid.
- **Layout (mobile):** eyebrow, headline, subhead, CTA, then the phone frame full width with the quote card beneath it (not overlapping).

### 6.3 The problem
- **Eyebrow:** "The problem"
- **Headline:** You asked the group chat what to watch.
- **Body:** Three days later, one reply. It was a link to a trailer. Meanwhile the algorithm still thinks you want another true-crime documentary because you watched one in 2022.
- **Visual:** two columns, side by side (stacked on mobile):
  - **Left, labeled "The algorithm":** a flat, `--surface-sunken` panel with a small grey caption "Because you watched Baking Showdown: Season 4" and a row of four identical grey placeholder tiles. Deliberately lifeless.
  - **Right, labeled "A friend":** a white quote card with a large Instrument Serif italic quote: *"ok you need to watch The Night Ferry. it's strange and perfect."* with Jonah's avatar and name.
- The contrast does the work; no arrows or "vs" badges.

### 6.4 How it works (`#how-it-works`)
- **Eyebrow:** "How it works"
- **Headline:** Three things. That's the whole app.
- Three steps in a **zig-zag** layout (alternating text left/right with a UI vignette), not a grid. Each step has a small `overline` number ("01", "02", "03"), a `display-m` title, and 1 to 2 lines of body.
  1. **Put in a good word.** Search a title, tap once, add a note if you like. About ten seconds.
     *Vignette:* the confirm sheet (DS 5.4): The Night Ferry poster, the note field with "ep 3 is where it gets you", the visibility line "Visible to 2 groups · 11 people", and the cobalt "Put in a good word" button.
  2. **It lands on your groups' shelves.** College friends, the group chat, your book club. Each group keeps its own shelf.
     *Vignette:* two shelves side by side, labeled College crew and The girls, with The Night Ferry's card on both.
  3. **Pick from people you trust.** Filter by mood, length, and where it's streaming, and every pick still has a friend's name on it.
     *Vignette:* a shelf with active filters "Comedy · Under 2 hours · Netflix" and three cards, one showing "Priya and Mo vouched for this."

### 6.5 Groups (`#groups`)
- **Eyebrow:** "Groups"
- **Headline:** Different friends, different *taste*.
- **Body:** You'd trust your film friend on a slow Korean thriller and your sister on a comfort rewatch. Keep a separate shelf for each circle.
- **Visual:** three vertical "shelf" columns in white cards with hairline borders, each headed by a group name, member avatars, and a colored dot (Moss, Plum, Ochre): **College crew**, **The girls**, **Sunday book club**. Each column shows three stacked poster thumbnails with titles. Low Tide Club appears in two columns, with a small `caption` under the second: "On 2 shelves."

### 6.6 Talk about it (`#talk`)
- **Eyebrow:** "Talk about it"
- **Headline:** Finished it? Say so.
- **Body:** Every title on your shelf has a conversation, just for that group. Mention a friend to pull them in. Mark spoilers so nobody gets ruined.
- **Visual:** a phone frame showing a conversation (DS 5.17) for The Night Ferry in College crew: Tess's comment "just finished ep 6. **@Priya** you were right", a spoiler cover "Spoiler from Mo · Tap to reveal", and the composer with its "Say something to College crew…" placeholder.
- Beneath, one quiet line in `caption`: "Conversations stay inside the group. No one else can see them."

### 6.7 Humans only (full-bleed ink section)
- Background `--inverse-surface` (ink), text `--inverse-text`. This is the page's one dramatic moment.
- **Headline (display-xl, white):** Humans *only*.
- Three statements stacked in a left-aligned column, each with a bold Inter lead and a muted continuation, separated by hairlines in `rgb(255 255 255 / 0.15)`:
  - **Every pick has a name on it.** If it's on the shelf, a friend put it there.
  - **We don't watch you watch.** Nothing is logged unless you choose to vouch for it.
  - **No algorithm picks.** If none of your friends have vouched for a short horror movie yet, we'll just tell you.

### 6.8 What it isn't
- A single centered-left line of phrases in Inter 20px, `--text-muted`, with a 1px strikethrough: ~~Star ratings~~ · ~~Public profiles~~ · ~~Followers~~ · ~~Endless feeds~~ · ~~Reviews nobody reads~~
- Followed by, in Instrument Serif italic `display-m`: *Just your friends' good word.*
- The struck list has an `aria-label`: "Good Word has no star ratings, public profiles, followers, endless feeds, or reviews."

### 6.9 FAQ (`#faq`)
- **Headline:** Questions
- Accessible accordion (native `<details>` and `<summary>`), full-width rows divided by hairlines, a plus that becomes a minus (CSS only). Question in Inter 18px/500, answer in `--text-muted`.
  - **Is it public?** No. Groups are private and invite-only. Only people in a group can see its shelf and its conversations.
  - **Is it just for movies?** Shows and movies to start. Restaurants and "who's your plumber" may come later.
  - **Do I have to log everything I watch?** No. Only what you'd recommend. It's a shelf of favorites, not a diary.
  - **Can we talk about what we watched?** Yes. Every title has a conversation for your group, with mentions and spoiler covers.
  - **Does it use AI?** Only behind the scenes, to match titles and fill in details. It never recommends anything on its own.
  - **When can I use it?** We're building it now. Coming soon.
  - **Is it free?** Yes, for now.

### 6.10 Closing
- Left-aligned, generous space above and below.
  - **Headline (display-l):** Your friends already have great *taste*.
  - **Subhead:** Good Word makes sure none of it gets lost.
  - "Coming soon" as a `overline` label with the cobalt dot. No button, no form.

### 6.11 Footer
- Hairline top border. Wordmark left; right side: "Made by people who ask their friends what to watch." in `caption`, then © year. No social links unless provided.

---

## 7. Components

All built from DS v3 components and tokens.

### 7.1 Rec card (grid)
- Per DS 4.2.2: white card, hairline border, `--radius-card`, `--shadow-sm`, fallback poster (7.5), title in Inter 15px/600, meta in `caption`, vouched-by row. No rotation. Desktop hover: shadow steps to `--shadow-md`.

### 7.2 Quote card
- White card, hairline border, `--radius-card`, `--shadow-md`, 24 to 32px padding.
- Quote in Instrument Serif italic (`display-m` on desktop, 24px on mobile), preceded by a large cobalt opening quotation mark.
- Attribution: 32px avatar and "Priya" in Inter 14px/600, with "vouched for The Night Ferry" in `caption`.

### 7.3 Avatar
- Per DS 4.1.10: circle, initial in white Inter 600 on a people tone (Clay, Ochre, Moss, Plum). No photos.

### 7.4 Button
- Per DS 4.1.1 primary: cobalt fill, white label, `--radius-control`, 48px tall on marketing. Hover darkens to `--action-hover`. Visible focus ring (DS 3.8).

### 7.5 Fallback poster
- Per DS 4.2.1: 2:3, people-tone fill, title in Instrument Serif (white), year and type in Inter `caption`, all in solid white (no reduced opacity, which would fail contrast on the lighter tones). Hairline inner edge.

### 7.6 Phone frame
- A simple device outline: `--radius-device` (44px) outer radius, 10px `--text` bezel at 100% opacity, no notch details beyond a small pill, `--shadow-lg`. Content inside is real HTML built from DS components at 390px width, scaled to fit. Never a screenshot image.

### 7.7 Invented content
- **Titles:** The Night Ferry, Low Tide Club, Grandma's Heist, Parallel Parking, Moth Season, Salt & Static
- **Friends:** Priya, Jonah, Tess, Mo, Luis, Bea
- **Groups:** College crew, The girls, Sunday book club

---

## 8. UX and accessibility requirements

### 8.1 Responsive
- Mobile-first. Intentional at **360, 390, 768, 1024, 1440**.
- 20px side gutters on mobile, 32px on tablet, auto-centered on desktop. No horizontal scroll.
- Hero, zig-zag steps, group columns, and the conversation phone must be **re-laid-out** for mobile (stacked, simplified), not scaled down.
- Headline sizes use `clamp()`; never let a headline break into more than 4 lines on a 360px screen.

### 8.2 Accessibility (WCAG 2.2 AA)
- One `<h1>` (hero headline), logical heading order after that.
- Landmarks: `<header>`, `<nav>`, `<main>`, `<section aria-labelledby>`, `<footer>`. "Skip to content" link first.
- Phone-frame vignettes are `aria-hidden` for their inner UI and carry a text alternative describing what they show (for example, "A group shelf for College crew showing four shows with the friends who vouched for them").
- All contrast pairs from DS 3.1.3; the ink section's muted text uses `rgb(255 255 255 / 0.72)` (verify ≥ 4.5:1 on ink).
- Visible focus states everywhere. Full keyboard navigation including the menu overlay (focus trap, Esc) and FAQ.
- Tap targets ≥ 44×44px.

### 8.3 Motion
- Allowed: sections and vignettes fade in and rise 8px once when 20% visible (`--dur-slow`, `--ease-enter`); a 60ms stagger between items in a group; hover shadow transitions.
- Not allowed: bouncing, rotation, parallax, marquees, scroll-jacking, or auto-playing video.
- With `prefers-reduced-motion: reduce`: everything appears in its final state.

### 8.4 Performance and SEO
- Lighthouse ≥ 95 in all four categories on mobile. LCP < 2.0s, CLS < 0.05. The hero is text and HTML only.
- Title: "Good Word: show and movie recs from your friends". Meta description: "A private shelf of shows and movies your friends vouch for. No algorithm, no strangers."
- Open Graph image (1200×630): paper background, the hero headline in Instrument Serif, the monogram in the corner (BRAND 4.2).
- Favicon and Apple touch icon: the cobalt monogram.

---

## 9. Voice

Follow BRAND 3 and DS 6. On this page specifically:
- One idea per section, said once, in the headline.
- Supporting copy is short and specific. Let the friends' quotes carry the emotion.
- No exclamation marks outside quotes.

---

## 10. Acceptance checklist

- [ ] All sections in Section 6 present, in order, with the specified copy
- [ ] Nothing from Section 4 appears on the page (no gradients, tilt, stickers, handwriting, bento, or decorative icons)
- [ ] Only DS v3 tokens and the two brand typefaces are used
- [ ] Cobalt appears only on actions, links, focus, the quote mark, and the "coming soon" dot
- [ ] No real movie titles, posters, logos, or photos
- [ ] Vignettes are real HTML built from DS components, not images
- [ ] Looks deliberately designed at 360, 768, and 1440px
- [ ] Keyboard-only walkthrough works: nav, menu overlay, FAQ
- [ ] Reduced-motion mode shows no animation
- [ ] All contrast pairs pass AA, including the ink section
- [ ] Lighthouse mobile ≥ 95 in all four categories
- [ ] No forms, cookies, analytics, or third-party scripts

---

## 11. Changes from v1

| Area | v1 (Playful) | v2 (Editorial) |
|---|---|---|
| Type | Fraunces 900, Figtree, Gochi Hand | Instrument Serif, Inter |
| Color | Paper, tomato, sun, grass, lilac blocks | Paper, ink, one cobalt accent; posters and people tones for color |
| Depth | 2px ink borders, hard offset shadows | Hairline borders, soft shadows |
| Layout | Tilted piles, stickers, Venn circles | Straight grid, framed product UI, shelf columns |
| Friend notes | Handwritten bubbles | Serif italic quotes |
| Big moment | Full-bleed tomato | Full-bleed ink |
| Content | 10 sections | Adds "Talk about it"; step 3 now matches the MVP (filters, not a typed "Ask") |
