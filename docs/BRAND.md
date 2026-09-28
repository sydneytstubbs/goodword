# Good Word: Brand Guide

**Version** 2.0.1 (Editorial) · **Owner** Sydney · **Last updated** 2026-09-28

How Good Word presents itself, anywhere: the app, the marketing page, emails, invite previews, and the app icon. `DESIGN-SYSTEM.md` holds the exact tokens and components; this guide explains the brand they express. If the two ever disagree on a value, the design system wins.

---

## 1. Positioning

**Good Word is the private shelf of shows and movies your friends vouch for.**

- **For** people who trust their friends' taste more than any algorithm.
- **Unlike** streaming algorithms and public review sites, every pick comes from someone you know, with their name on it.
- **Because** the best recommendation has always been a friend saying "you have to watch this."

**Tagline:** Take your friends' word for it.

---

## 2. Personality

The brand is **a friend with great taste**: well-read, a little discerning, warm when it matters, never trying too hard.

| We are | We are not |
|---|---|
| Considered | Fussy |
| Confident | Loud |
| Warm | Cute |
| Understated | Cold |
| Editorial | Corporate |

**The feeling to aim for:** opening a beautifully set magazine that happens to be written by your friends. Quiet surfaces, strong type, and the posters doing the talking.

**What changed from v1:** v1 was playful and bold, with hand-drawn touches, stickers, tilted cards, and loud color blocks. v2 keeps the warmth in the words and the people, and moves the visual language to calm, modern, and minimal.

---

## 3. Voice

Voice lives in the design system (DS 6). In brief:
- **Talk like a friend with taste,** not an excited fan. Short, specific, confident.
- **Let friends' words carry the emotion.** Our copy frames; their notes sing.
- **Humor is dry and rare.** One light line per screen at most, never in errors.
- **No exclamation marks,** except a friend's own note.
- **Say what we don't do** as calmly as what we do.

| Instead of | Write |
|---|---|
| "Your friends have AMAZING taste!!" | "Your friends already have great taste." |
| "Oops! Something broke 😬" | "That didn't save. Try again." |
| "Unlock personalized recs" | "See what your friends vouch for." |

---

## 4. Logo

### 4.1 Wordmark
- "Good Word" set in **Instrument Serif**, regular, with "Word" in *italic*: **Good *Word***. The italic is the only flourish in the identity.
- Color: `--text` on light surfaces, white on dark or cobalt. Never cobalt text for the wordmark on off-white; cobalt is reserved for action.
- Minimum size: 16px cap height on screen. Clear space: the height of the "G" on all sides.

### 4.2 Monogram (app icon and favicon)
- A serif opening quotation mark (“) in white, Instrument Serif, centered on a **cobalt** (`#2B4BFF`) square with continuous rounded corners (the platform's icon mask).
- It stands for a word someone vouched for. It's used for the app icon, favicon, email avatar, and invite link previews.
- The favicon uses the same mark at a heavier optical size so it survives 16px.

### 4.3 Don't
- Recolor, outline, stretch, or add effects to either mark.
- Set the wordmark in any other font, or all in italic.
- Put the wordmark on a poster or a busy image.
- Pair the monogram with the wordmark side by side in product UI (the wordmark alone is enough).

---

## 5. Color

Mostly neutral, with one accent. Color comes from the posters and the people.

| Role | Value | Use |
|---|---|---|
| Paper | `#FAFAF9` | Page background |
| White | `#FFFFFF` | Cards, sheets, inputs |
| Ink | `#0A0A0A` | Text, the "Humans only" band, selected states |
| Graphite | `#6B6B6B` | Secondary text |
| Hairline | `#E6E5E3` | Dividers and card edges |
| **Cobalt** | `#2B4BFF` | **The only accent.** Primary actions, links, focus, your own good word |
| Cobalt wash | `#EEF1FF` | Soft backgrounds for vouched and mentioned states |

**People and poster tones** (avatars, group dots, fallback posters): Clay `#9A4A36`, Ochre `#7D5A12`, Moss `#3F5E45`, Plum `#5E4670`. Deep, muted, film-still colors that sit quietly next to real posters and carry white text.

**Rules**
- **One cobalt action per screen.** If everything is blue, nothing is.
- No gradients, glows, or tints over imagery.
- The palette is verified for WCAG AA in light and dark (DS 3.1.3).

---

## 6. Typography

| Role | Typeface | Notes |
|---|---|---|
| Display | **Instrument Serif** (Google Fonts) | Headlines only, 24px and up. Regular and italic. Italic for emphasis, sparingly |
| Everything else | **Inter** (Google Fonts, variable) | UI, body, labels, numbers. Tabular figures for counts |

- **Contrast of scale is the design.** Very large serif headlines against small, quiet Inter text.
- Sentence case everywhere. No all-caps, except small letterspaced labels in Inter (for example "NOW STREAMING") on the marketing page, used rarely.
- Friends' notes are set as **quotes**: Instrument Serif italic at large sizes on the marketing page; Inter with a leading quotation mark and the friend's name in the app.

---

## 7. Imagery

- **Posters are the color.** Show them large, crisp, uncropped, on neutral ground, with a hairline edge and a very soft shadow.
- **Product UI is the illustration.** The marketing page shows real screens and components, cleanly framed, never tilted.
- **No** stock photos, 3D renders, illustrated people, emoji decoration, or hand-drawn doodles.
- Marketing mockups use invented titles with fallback posters; never real posters or studio art.

---

## 8. Motion

Quiet and quick. Things fade and settle a few pixels into place; nothing bounces, tilts, or slaps on. Full specs in DS 3.7.

---

## 9. Applications

| Surface | Treatment |
|---|---|
| **App** | Paper background, white cards, cobalt primary action, posters as the color |
| **Marketing page** | Editorial layout: huge serif headlines, generous whitespace, framed product UI, one full-bleed ink section |
| **Email** | White background, wordmark header, posters, Inter body, one cobalt button, plain-text friendly |
| **Invite link preview (Open Graph)** | Paper background, "Join College crew on Good Word" in Instrument Serif, the monogram in the corner |
| **App icon** | Cobalt monogram (4.2) |

---

## 10. Do and don't

| Do | Don't |
|---|---|
| Let one big serif line lead each section | Stack multiple headline sizes in one view |
| Use whitespace as the main layout tool | Fill space with decoration |
| Let posters and names carry the color and warmth | Add color blocks to "liven things up" |
| Keep cobalt for actions and your own good word | Use cobalt for decoration or headlines |
| Frame product UI straight and clean | Tilt, sticker, or scribble on anything |
| Write like a friend with taste | Write like a hype account |

---

## 11. Changelog

- **v2.0.1 (2026-09-28):** Instrument Serif minimum is 24px, matching `DESIGN-SYSTEM.md` 3.2.2 (was 28px).
- **v2.0 (2026-09-27):** Editorial direction.
