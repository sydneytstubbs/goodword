# Good Word: Product Requirements (MVP)

**Version** 1.2.4 · **Status** Ready to build · **Owner** Sydney (product and design) · **Last updated** 2026-09-29

The build brief for the Good Word web app. It defines **what** the product does: scope, user journeys, screens, business rules, data, integrations, and the build order. **How** things look, behave, and read is defined in `DESIGN-SYSTEM.md`, which this document references by section number (for example, DS 5.4).

---

## Contents

0. How to use this document
1. Product overview
2. Goals, hypotheses, and success metrics
3. Users and jobs to be done
4. Scope
5. Core user journeys
6. Information architecture and navigation
7. Functional requirements
8. Data model
9. Integrations
10. Non-functional requirements
11. Analytics and instrumentation
12. Build plan
13. Research and release plan
14. Risks and mitigations
15. Open questions
16. Changelog

---

## 0. How to use this document

### 0.1 For Claude Code (read first)
- **Read `DESIGN-SYSTEM.md` before writing any UI.** Every screen in this doc must follow it. Where this doc says "per DS x.y", the design system section is binding.
- **Build in the slices in Section 12, in order.** Each slice ends with something Sydney can click through on a phone. Stop at the end of each slice, summarize what was built, and list anything that deviated from this doc.
- **Don't invent features, screens, or settings** that aren't here. If something seems missing, ask. If a requirement seems wrong or contradicts the design system, flag it before building.
- **Priority labels:** **P0** is required for the MVP. **P1** should ship in the MVP if time allows, after all P0 work in its slice. **Later** is documented for context only; do not build it.
- **Acceptance criteria are tests.** A requirement is done only when its acceptance criteria pass and the screen meets the screen definition of done (DS 12.1).
- **Use the glossary** (DS 1.4) in UI copy: good word, shelf, group, member, note, conversation, comment, mention, activity. Never post, item, feed, review, rating, chat, or thread.
- **Invented sample content** for seeds, tests, and the styleguide: titles The Night Ferry, Low Tide Club, Grandma's Heist, Moth Season; people Priya, Jonah, Tess, Mo, Luis, Bea; groups College crew, The girls, Sunday book club. Never use real people's data in seeds.

### 0.2 Document map
| Doc | Owns |
|---|---|
| `PRODUCT-REQUIREMENTS.md` (this) | What the product does, for whom, and in what order it gets built |
| `DESIGN-SYSTEM.md` | How it looks, behaves, and reads: tokens, components, patterns, copy, accessibility |
| `good-word-marketing-page-spec.md` | The marketing page (built in step M, after foundations) |

If this doc and the design system conflict on **what** the product does, this doc wins. If they conflict on **how** it looks or behaves, the design system wins.

---

## 1. Product overview

### 1.1 The problem
People trust their friends' taste more than any algorithm, but getting a recommendation from a friend is slow and lossy. You text the group chat, wait days, get one reply, and the good suggestions scroll away and are forgotten. Meanwhile, streaming algorithms recommend from viewing history and strangers' behavior, and they don't know you.

### 1.2 The product
Good Word is a private, mobile-first web app where small groups of friends keep a shared shelf of the shows and movies they'd vouch for. Each person belongs to a few groups (college friends, the girls, a book club), and each group has its own shelf. When you finish something great, you put in a good word in about ten seconds. When you need something to watch, you pull from people whose taste you actually know, with their names on every pick.

### 1.3 Product principles
These are the product's non-negotiables. They're expanded in DS 1.1.
1. **People over picks.** Every good word shows the person behind it. The app never recommends on its own.
2. **Private by default, visibly so.** You always know who will see what, before you share it.
3. **Ten seconds to a good word.** Logging is the core habit and must be nearly effortless.
4. **A library, not a mailbox.** You stock shelves for your groups; you don't send recommendations to individuals (for now).
5. **Useful alone, better together.** Your own shelf is valuable even before friends join.

### 1.4 What Good Word is not
- Not a public social network. No followers, public profiles, or discovery of strangers.
- Not a tracker or diary. You don't log everything you watch, only what you'd recommend.
- Not a review site. No star ratings, scores, or long reviews.
- Not an algorithm. No computer-generated picks in the MVP.

---

## 2. Goals, hypotheses, and success metrics

### 2.1 The key hypothesis
> **People will keep putting in good words when their friends will see them, and light nudges (a weekly digest and occasional prompts) will keep the habit going.**

The MVP exists to test this. Everything that doesn't serve it is out of scope.

### 2.2 Supporting hypotheses
| # | Hypothesis | How we'll know |
|---|---|---|
| H1 | Invited friends will join with little friction | 60%+ of invite link opens end in a joined member |
| H2 | New members will contribute, not just browse | 50%+ put in their first good word within 7 days of joining |
| H3 | Logging is fast enough to become a habit | Median Add-to-confirmation under 10 seconds; 90%+ completion |
| H4 | People log on their own, not only when nudged | 50%+ of good words have source `organic` |
| H5 | Shelves actually help people choose what to watch | Where-to-watch taps and title views from shelves grow week over week; qualitative beta interviews confirm it |
| H6 | People come back | 40%+ of members active in week 4 after joining |
| H7 | Talking about titles with friends brings people back without crowding out good words | 30%+ of active members comment at least once in 4 weeks; members who comment show higher week-4 retention; good words per member doesn't drop after conversations launch |

Metric definitions and instrumentation are in Section 11. Targets are starting points for a small beta; the direction matters more than the exact number.

### 2.3 Product goals for the MVP
1. A small group of friends can create a group, join, and share good words entirely on their phones, without help.
2. The core loop (see a friend's good word → watch → put in your own) works end to end.
3. The data can answer whether H1 through H6 are true after 4 to 6 weeks of beta.

---

## 3. Users and jobs to be done

### 3.1 Who it's for
Adults (roughly 25 to 45) who already ask friends what to watch, belong to several distinct friend circles, use their phones for almost everything, and are tired of algorithmic feeds. The first users are Sydney and her friends, invited into a private beta.

### 3.2 Roles in the product
| Role | Description | What they need most |
|---|---|---|
| **Group starter** | Creates a group and invites friends | Creating and inviting in under a minute; confidence it's private |
| **Invitee** | Arrives via a link, low commitment, may never have heard of Good Word | To understand it instantly and join without a password or long signup |
| **Contributor** | Regularly puts in good words | Speed; the satisfaction of knowing friends will see it |
| **Browser** | Mostly looks for something to watch | Fast narrowing (movie or show, streaming service, length, mood); knowing who vouched |

The same person moves between these roles. Design for all four in every flow.

### 3.3 Jobs to be done
1. **When I finish something I loved,** I want to tell my people quickly, so they don't miss it and I get credit for good taste.
2. **When I don't know what to watch tonight,** I want to see what the friends whose taste I trust recommend, filtered to what I can actually watch right now, so I can pick in minutes.
3. **When a friend asks me for a recommendation,** I want to point them to the things I vouch for without retyping them.
4. **When I'm invited to a group,** I want to see what it is and join in seconds, so I don't feel like I'm signing up for yet another app.
5. **When different friends have different taste,** I want to keep their recommendations separate, so I know whose good word I'm looking at.

---

## 4. Scope

### 4.1 MVP feature list
| Area | Feature | Priority |
|---|---|---|
| Account | Passwordless sign-in (email magic link and Google) | P0 |
| Account | Display name, region, sign out | P0 |
| Account | Delete account; download my data | P0 |
| Groups | Create, rename, delete | P0 |
| Groups | Invite link, join via link, members list | P0 |
| Groups | Leave group, remove member, reset invite link | P0 |
| Titles | Title search (movies and shows, via TMDB) | P0 |
| Good words | Put in a good word with optional note and group selection | P0 |
| Good words | Edit note, change groups, take it back (with Undo) | P0 |
| Shelves | Group shelf, All groups shelf, My shelf | P0 |
| Shelves | Filters (type, streaming service, genre, length) and sort | P0 |
| Shelves | "New since your last visit" indicators | P0 |
| Titles | Title detail with everyone's good words, notes, and where to watch | P0 |
| Notifications | Weekly digest email; notification preferences | P0 |
| Notifications | Owner alerts when someone joins their group (email) | P0 |
| Notifications | Gentle weekend prompt email to members who haven't contributed in 14 days | P1 |
| Onboarding | Invite landing, first-good-word prompt, empty states, milestones | P0 |
| Help | Help, FAQ, send feedback, about with attributions | P0 |
| Shelves | Person view: a member's good words in groups you share | P1 |
| Shelves | "Your streaming services" setting and "On my services" filter | P1 |
| Sharing | Share-my-shelf link (read-only, off by default, revocable) | P1 |
| Platform | Installable web app (manifest, icons, standalone mode) | P1 |
| Platform | Offline: cached shelves and queued good words | P1 |
| Shelves | Live "N new good words" pill while viewing a shelf | P1 |
| Conversations | Comment on a title within a group; see everyone's comments; edit and delete | P0 |
| Conversations | @mentions of group members, with notifications | P0 |
| Conversations | Spoiler marking | P0 |
| Conversations | Live new comments while a conversation is open | P0 |
| Conversations | Comment counts on shelf cards | P0 |
| Activity | Activity list (mentions, new comments in your conversations, joins) with unread badge | P0 |
| Notifications | Mention emails (batched over 15 minutes) | P0 |

### 4.2 Later (documented, not built)
Ordered by likely value. Each needs its own spec before building.
1. **Save for later:** a private "want to watch" list built from friends' good words. Likely the first request from beta users.
2. **"Watched it because of you":** tell a friend their good word worked. Measures the product's real value (DS 16, open question 5).
3. **Push notifications** for the installed web app (requires Home Screen install on iOS 16.4+).
4. **Text a good word in** (SMS to a Good Word number, parsed and confirmed). Requires US A2P 10DLC registration.
5. **Import:** Letterboxd RSS, Netflix viewing history upload, and screenshot reading, each ending in a confirm step where the user picks what to vouch for.
6. **Reactions on comments** (a single "same" or heart), and mentions inside notes.
7. **Ask:** natural-language requests ("something funny, under 30 minutes") answered only from friends' good words, with an opt-in, clearly labeled robot guess when nothing matches (DS 5.15).
8. **Point a good word at a friend** ("this is so you"). Mentions in comments cover part of this job in the MVP.
9. **Other categories:** restaurants, places, and trusted services (the handyman use case).
10. **Native iOS app.**

### 4.3 Explicitly out of scope
- Public profiles, discoverable groups, followers, or likes.
- Nested reply threads, reactions, attachments, GIFs, or formatting in comments.
- Conversations that span groups, or that include anyone outside the group.
- Typing indicators and read receipts.
- Star ratings, scores, or long-form reviews.
- Any algorithmic or AI-generated recommendations.
- Tracking viewing history or connecting streaming accounts.
- Direct messages or chat.
- Monetization, ads, or affiliate links.
- Dark mode for users (prepared per DS 3.10, not shipped).
- Languages other than US English (built ready per DS 10).

---

## 5. Core user journeys

Each journey is the end-to-end story the MVP must support. Detailed requirements are in Section 7.

### J1. Starting a group (group starter)
1. Sydney opens the marketing page, taps **Get started**, and signs in with Google (F1).
2. She's asked "What should friends call you?" (prefilled) and continues.
3. With no groups yet, she sees the empty state "Start a group, or put in a good word just for you." She taps **Start a group**.
4. She names it "College crew" and taps **Create**. She lands on the invite card (F2.3).
5. She taps **Share**, picks Messages, and sends the link to her group chat.
6. She goes back to the empty shelf, which prompts her to put in the first good word, and adds two shows.

**Success:** under 2 minutes from sign-in to invite sent.

### J2. Joining from an invite (invitee)
1. Jonah taps the link in the group chat on his iPhone.
2. The invite landing shows "Sydney invited you to College crew. 6 people are already sharing what they'd watch." with **Join College crew** (F2.4).
3. He taps it, enters his email, and taps **Email me a sign-in link**. The screen says "Check your email" and keeps "Joining College crew" visible.
4. He opens the email on the same phone, taps the link, and confirms his name.
5. He lands on College crew's shelf with the welcome banner "You're in. Here's what College crew vouches for." and browses.
6. After a moment, an inline card asks "What's something you'd tell these folks to watch?" He adds one.

**Success:** under 90 seconds from tapping the link to seeing the shelf.

### J3. Putting in a good word (contributor)
1. Priya finishes a show she loved. She opens Good Word from her Home Screen and taps **Add**.
2. She types "night fe" and taps The Night Ferry (2024, Series).
3. The confirm sheet shows the poster, an optional note, and "Visible to 2 groups · 11 people". She types "ep 3 is where it gets you" and taps **Put in a good word**.
4. The sheet closes, the card appears at the top of her shelf, and a toast says "On your shelf. Jonah, Tess, and 9 others will see it." with Undo.

**Success:** median under 10 seconds from tapping Add to the toast, excluding typing the note.

### J4. Choosing something to watch (browser)
1. On a Friday night, Tess opens Good Word. College crew's shelf shows three cards marked **New** since her last visit.
2. She taps **Movies**, then the **Netflix** chip. Eight good words remain. She opens **More filters**, picks **Comedy** and **Under 2 hours**. Three remain.
3. She opens Low Tide Club, reads Priya's and Mo's notes, sees it's streaming on Netflix, and taps the provider to open it.

**Success:** a confident choice in under 2 minutes, from friends' good words only.

### J5. Coming back through the digest (lapsed browser)
1. On Thursday afternoon, Luis gets "This week on Good Word: 5 new good words from College crew and The girls."
2. The email shows posters, who vouched, and notes. He taps a title and lands on its detail screen, signed in.
3. He sees a show he loved is missing from the shelf and puts in his own good word from there.

**Success:** a digest click leads to a title view; some digest visits lead to a new good word (source `digest`).

### J6. Talking about a show (contributor and browser)
1. Tess watches The Night Ferry because Priya put in a good word. On the title's detail screen she taps **Add a comment…** under "Talk about it in College crew".
2. The conversation opens with the keyboard up. She types "just finished ep 6, @" and picks **Priya** from the list of College crew members, then "you were SO right". She turns on **Spoiler** and taps Send.
3. Her comment appears immediately. Within 15 minutes Priya gets an email, "Tess mentioned you on The Night Ferry", and a badge on the bell in Good Word.
4. Priya taps the email, lands on Tess's comment (covered as a spoiler, since it isn't hers), reveals it, and replies "@Tess the ferry scene!!". Tess sees it appear live because she still has the conversation open.
5. Jonah, who hasn't finished the show, sees "2 comments" on the card, opens the conversation, and sees two spoiler covers he can leave closed.

**Success:** a mention reaches the right person within 15 minutes, and nobody outside College crew can see or search any of it.

### J7. Sharing my shelf with someone outside Good Word (P1)
1. A coworker asks Sydney what to watch. She goes to **My shelf › Settings › Share my shelf**, turns it on, and copies the link.
2. The coworker opens a read-only page: "Sydney's good words", with posters, titles, and Sydney's notes, and a small "Made with Good Word" link.
3. Later, Sydney turns the link off, and it stops working immediately.

---

## 6. Information architecture and navigation

### 6.1 Sitemap and routes
Extends DS 5.1.

| Route | Screen | Auth | Priority |
|---|---|---|---|
| `/` | Marketing page (signed out); redirect to last viewed shelf (signed in) | Public | P0 |
| `/sign-in` | Sign in (optionally carrying `?next=` and invite context) | Public | P0 |
| `/sign-in/check-email` | Check your email | Public | P0 |
| `/auth/callback` | Magic link and OAuth callback | Public | P0 |
| `/welcome` | Name prompt (first sign-in only) | Signed in | P0 |
| `/join/[code]` | Invite landing | Public | P0 |
| `/shelf` | Redirect to last viewed shelf, or the no-groups empty state | Signed in | P0 |
| `/shelf/all` | All groups shelf | Signed in | P0 |
| `/shelf/[groupId]` | Group shelf | Member | P0 |
| `/title/[type]/[tmdbId]` | Title detail (`type` is `movie` or `tv`) | Signed in | P0 |
| `/title/[type]/[tmdbId]/conversation?group=[groupId]` | A group's conversation about a title (on desktop, a panel beside title detail) | Member of that group | P0 |
| `/activity` | Activity: mentions, new comments in your conversations, joins | Signed in | P0 |
| `/you` | My shelf (a main tab): your good words, your groups, settings entry | Signed in | P0 |
| `/you/settings` | Account, region, notifications, services (P1), share link (P1) | Signed in | P0 |
| `/you/help` | Help, FAQ, shortcuts, send feedback, about and attributions | Signed in | P0 |
| `/groups/new` | Create a group | Signed in | P0 |
| `/groups/[groupId]` | Group details: invite, members, rename, leave, delete | Member | P0 |
| `/people/[userId]` | Person view: their good words in groups you share | Signed in, shares a group | P1 |
| `/s/[token]` | Shared shelf (read-only, public by link) | Public | P1 |
| `/privacy`, `/terms` | Legal pages | Public | P0 |
| `/styleguide` | Design system reference (DS 14) | Dev only | P0 |

**Sheets over the current route (no navigation):** Add (search and confirm), group switcher, filters, vouch menu, confirm dialogs. Opening a sheet pushes a history entry so the Back gesture closes it (DS 5.1).

### 6.2 Navigation model
- **Mobile:** bottom tab bar with **Shelf**, **Add** (center), and **My shelf** (DS 4.2.8). The top bar holds the group switcher, the Activity bell with an unread count, and an invite button.
- **Desktop (1024px and up):** left rail with the same destinations plus the group list.
- **Shelf tab** shows the last viewed shelf (a group or All groups), remembered per device.
- **Add** opens the log sheet over whatever screen you're on, and returns you there afterward.
- **Title detail** opens from any card and returns to the exact scroll position (DS 5.1).
- **Conversations** open from title detail, a card's comment count, Activity, or a mention email. Back from a conversation returns to wherever you came from.

### 6.3 URL state
Query parameters on shelf routes: `type` (`movie`, `tv`), `services` (comma list of provider ids), `genres` (comma list), `length` (`30`, `120`), `sort` (`newest`, `vouched`), `mine` (P1, `1` for "On my services"). All filter changes use `history.replaceState` for chip toggles within a session and push a new entry only when the segmented control changes, so Back feels natural rather than stepping through every chip tap.

### 6.4 Access rules
- Signed-out visitors to any signed-in route go to `/sign-in?next=<route>` and return there after signing in.
- A signed-in non-member visiting `/shelf/[groupId]` or `/groups/[groupId]` sees a 404-style "You're not in this group" state with a link to their shelf. It must not reveal the group's name or members.
- All app routes send `noindex`. Only `/`, `/privacy`, and `/terms` are indexable.

---

## 7. Functional requirements

Each feature lists user stories, rules, acceptance criteria, states, and edge cases. Visual and interaction details come from the design system sections cited.

### F1. Accounts and sign-in (P0)

**Stories**
- As a new visitor, I can sign in with just my email or Google, without creating a password.
- As a returning user, I stay signed in on my phone.
- As a user, I can change my name, sign out, download my data, and delete my account.

**Rules**
- Sign-in follows DS 5.3 exactly: magic link (valid 15 minutes, single use) or Google OAuth. No passwords.
- Sign-in and sign-up are the same flow. Never ask the user which one they want.
- Sessions last 90 days per device, refreshed on use. (Supabase's free plan can't cap a session at exactly 90 days; sessions stay alive while in use. Accepted for the MVP.)
- **Display name** is required, 1 to 30 characters, asked once on first sign-in at `/welcome` ("What should friends call you?"), prefilled from Google when available. It's what appears on every good word.
- **Region** defaults from the browser locale (fallback `US`) and is editable in Settings. It controls where-to-watch data.
- **Resend link** is available after 30 seconds (visible countdown). Sign-in emails are rate limited to 5 per email address per hour, with a clear message when hit.
- If a magic link is opened in a different browser or device, sign the user in there.
- The invite context (`Joining College crew`) persists through the whole sign-in flow and the user lands on that group's shelf afterward, already joined.

**Account deletion**
- In Settings, "Delete account" opens a dialog stating the consequences: all your good words and comments are removed everywhere, you leave every group, and this can't be undone. The danger button reads "Delete my account".
- Groups you own transfer to the longest-standing remaining member. Groups where you're the only member are deleted.
- Deletion completes immediately in the UI; backend purge of all personal data completes within 30 days (state this in the privacy page).

**Download my data**
- Settings › "Download my data" produces a JSON file with your profile, groups, and good words (title, note, groups, dates). Generated on demand, downloaded directly.

**Acceptance criteria**
- Given a new visitor, when they sign in with Google, then they reach `/welcome` with their name prefilled, and after continuing, land on the no-groups empty state.
- Given a user who requested a magic link, when they open it after 15 minutes, then they see the expired-link banner with a one-tap "Send a new link" prefilled with their email.
- Given an invitee who started from `/join/[code]`, when they finish signing in, then they are a member of that group and land on its shelf with the welcome banner.
- Given a user requests a 6th sign-in email within an hour, then they see "Too many sign-in links. Try again in a few minutes, or continue with Google."
- Given a group owner deletes their account, then ownership of each group transfers to the member with the earliest `joined_at`.

**Edge cases:** email typos (show the address on the check-email screen with "Use a different email"); Google account without a name (leave the field empty with focus); user already signed in visiting `/sign-in` (redirect to `/shelf`).

---

### F2. Groups (P0)

#### F2.1 Rules
- A group has a name (1 to 40 characters, unique only within the member's own list for clarity; warn, don't block, on a duplicate name) and an owner.
- **Limits:** up to 50 members per group; each person can belong to up to 20 groups. Hitting a limit shows a plain message explaining it.
- **Roles:** the creator is the **owner**. Owners can rename, reset the invite link, remove members, and delete the group. All members can view members, share the invite link, and leave.
- **Membership is visible** to all members (DS 5.14).
- A group's people color (for its chip) is assigned deterministically from its id (DS 3.1.2).

#### F2.2 Create a group
- `/groups/new`: one field, "Name your group", with placeholder examples ("College crew", "Sunday book club"), and one button, **Create group**.
- On success, go to `/groups/[id]` showing the invite card first (DS 4.2.7), with the heading "Invite your people".
- **Acceptance:** Given a signed-in user, when they submit a valid name, then the group exists, they are its owner and only member, and the invite card is shown with a working link.

#### F2.3 Invite link
- Each group has one active invite link: `/join/[code]`, where `code` is a random, unguessable string (at least 128 bits of entropy, URL-safe).
- Links **don't expire by time.** The owner can **reset** the link, which invalidates the old one immediately (confirm dialog per DS 5.8).
- **Share** uses the Web Share API with the text "Join College crew on Good Word, where we share the shows and movies we'd vouch for." plus the link. Fallback is **Copy link** with the toast from DS 6.6.
- The invite button in the top bar opens the current group's invite card in a sheet. On All groups, it asks which group first.

#### F2.4 Join via invite link
- `/join/[code]` follows DS 5.2. It shows the inviter's first name and avatar (the person who created the link, or the owner if unknown), the group name, member count, a one-sentence explanation, and **Join [group name]**. It does **not** show the shelf's contents before joining.
- Signed in and not a member: one tap joins and lands on the shelf with the welcome banner.
- Already a member: redirect to the shelf with the toast "You're already in College crew."
- Invalid or reset link: the expired-invite copy from DS 6.6 ("This invite link has expired. Ask Priya for a new one.", naming the group owner) plus a link to learn about Good Word. For a code that never existed, omit the name: "This invite link doesn't work. Ask whoever sent it for a new one."
- Group full, or the joiner already has 20 groups: explain which limit was hit.
- Joins are rate limited per IP and per code to prevent abuse.
- **Acceptance:** Given a valid code and a signed-out visitor, when they tap Join and complete sign-in, then they are a member, the owner receives the join email (F7.3), and the joiner sees the group's shelf.

#### F2.5 Group details (`/groups/[groupId]`)
Sections, in order: invite card; members list (avatar, name, "Owner" label, "You" label, joined date); group settings (owner only: rename, reset invite link); danger zone (leave group; owner: remove members via each member's menu, delete group).

#### F2.6 Leaving and removal
- **Leave:** dialog per DS 5.8. Your good words are removed from that group's shelf (they stay on My shelf and in your other groups). Your past comments in that group's conversations stay, attributed to you, so conversations still make sense (confirm, Section 15).
- **Owner leaving:** the dialog names who becomes owner (the longest-standing member). If the owner is the only member, leaving deletes the group, and the dialog says so.
- **Remove member (owner):** dialog naming the person. Their good words leave that shelf; their past comments stay attributed. They are not notified in the MVP, and they can rejoin only with a new or unreset link, so the dialog suggests resetting the link if needed.
- **Delete group (owner):** irreversible dialog stating the number of members and good words affected (DS 5.8). Members' good words stay on their own shelves and other groups.

**Acceptance**
- Given a member leaves a group, then none of their good words appear on that group's shelf, and the title's vouched-by row on that shelf no longer includes them.
- Given an owner removes a member, then the removed member immediately loses access to the shelf and group details, and sees "You're not in this group" if they visit.

---

### F3. Title search (P0)

**Stories:** As a contributor, I can find the exact show or movie I mean in a few keystrokes.

**Rules**
- Search follows DS 4.2.4 and 5.5.
- Queries go to TMDB multi-search through the app's own server route (the TMDB key never reaches the browser). Only `movie` and `tv` results are shown; people are excluded; adult content excluded.
- Minimum 2 characters, 250ms debounce, cancel in-flight requests when the query changes.
- Results show poster, title, year, and "Film" or "Series", ordered by TMDB relevance.
- **Duplicate annotations:** "On your shelf" if you've already put in a good word; avatars and "Priya vouched for this" if people in your groups have.
- **Recent searches** (up to 5) show when the field is empty, stored on the device, clearable.
- Server responses are cached briefly (5 minutes per normalized query) to stay within TMDB limits.

**Acceptance**
- Given a user types "nigh", then results appear within 1 second on a normal connection, showing only movies and shows.
- Given a title already vouched for by the user, then its row shows "On your shelf".
- Given TMDB is unreachable, then the search error state from DS 4.2.4 shows with Retry, and the rest of the app still works.

**Edge cases:** titles with the same name (year and type disambiguate); titles without posters (typographic fallback); non-English original titles (show TMDB's localized title for the user's language).

---

### F4. Putting in a good word (P0)

The core feature. The flow is defined in DS 5.4; these are the product rules.

**Stories**
- As a contributor, I can put in a good word in about ten seconds, with an optional note, and see exactly who will see it.
- As a contributor, I can change my note or which groups it's in, or take it back.

**Rules**
- **One good word per person per title.** A person's good word has one note and can be shared into any number of their groups. Adding the same title again means editing the existing good word (DS 5.4, "already vouched").
- **Note:** optional, up to 140 characters, plain text, no links rendered as links, emoji allowed.
- **Group selection:** defaults to **all your groups**. The visibility line (DS 4.2.6) shows the audience and opens the group picker. A good word may have **zero groups** ("Only you, for now"), in which case it lives only on My shelf. This keeps Good Word useful before friends join.
- **One card per title per group.** When several members vouch for the same title, the shelf shows one card with a growing vouched-by row and their notes (most recent note on the grid card, all notes on detail).
- **Take it back** removes the good word from all groups immediately with an 8-second Undo toast (DS 5.11). Undo restores the note and groups exactly.
- **Edits** to the note or groups are saved immediately, optimistically, with no "edited" label.
- **Source tracking:** each good word records how the user arrived (Section 11.3): `organic`, `digest`, `nudge_email`, `join_prompt`, `share`.
- **Milestones** (DS 4.1.20): first good word ever, and the 10th, show the milestone moment once.
- **Rate limit:** 100 good words per user per hour, to stop scripts, with a friendly message.

**Entry points:** the Add tab, the rail's Add button, the `n` shortcut on desktop, the vouch button on any title detail or search row, the first-good-word prompt, and empty-state actions.

**Acceptance**
- Given a user in 2 groups, when they put in a good word without changing groups, then it appears on both shelves and My shelf, and the toast names up to 2 people plus "and N others".
- Given a user with no groups, when they put in a good word, then the visibility line reads "Only you, for now" and the toast reads "On your shelf. Invite friends to share it." with an Invite action.
- Given a friend already vouched for the title in a shared group, when the user adds theirs, then the shelf shows one card with both people in the vouched-by row.
- Given a user taps Undo within 8 seconds of taking a good word back, then it's restored to every group it was in, with its note.
- Given the network fails on submit, then the card reverts and a toast offers Retry, and the note is not lost.
- Instrumented time from Add tap to confirmation is recorded (Section 11).

---

### F5. Shelves (P0)

Three kinds of shelf share one layout: a grid of rec cards (DS 4.2.2) with the filter bar (DS 5.6).

#### F5.1 Group shelf (`/shelf/[groupId]`)
- Page title is the group name (`title-l`), with member avatars and count beneath, linking to group details.
- Shows every title vouched for by any member into that group, one card per title.

#### F5.2 All groups shelf (`/shelf/all`)
- Titled "All groups". Combines every group you're in, deduplicated: one card per title, with the vouched-by row merging all people across your groups (each person once).
- Group chips on the detail screen show which of **your** groups each good word is in.

#### F5.3 My shelf (the My shelf tab, `/you`)
- A main navigation destination, labeled **My shelf** in the tab bar and rail. The page is titled "Your shelf". Below your good words: your groups, then links to Settings and Help. Shows only your own good words, including ones with zero groups.
- Each card shows group chips for where it's shared, or "Only you".
- A group filter lets you see what you've shared into a specific group.

#### F5.4 Sorting and filtering
- **Sort:** Newest (default, by the most recent good word on that card) and Most vouched (by number of people, ties broken by newest).
- **Type:** segmented control All / Movies / Shows.
- **Streaming services:** up to five chips for the services most common on the current shelf in the user's region, with counts, then "More filters".
- **More filters sheet:** services (all), genres (TMDB genres present on the shelf), length (Any, Under 30 minutes, Under 2 hours), and, if P1 is built, "On my services".
- **Length** uses movie runtime, or typical episode runtime for shows. Titles with unknown runtime are excluded when a length filter is on, and the empty state says so.
- **Filter logic:** AND across categories, OR within a category (DS 5.6). Active filters are always visible with a result count and a single Clear.
- **Paging:** 24 cards per page, infinite scroll with a "Load more" fallback and an end-of-shelf footer (DS 5.6).

#### F5.5 New since your last visit
- Each membership stores when you last viewed that shelf. Cards whose most recent good word from **someone else** is newer than that show a **New** badge (DS 4.1.11).
- The group switcher shows a count of new good words per group; the Shelf tab shows a dot if any group has new ones.
- "Last viewed" updates when you leave the shelf or after 10 seconds on it, not on arrival, so badges don't vanish before you see them.

#### F5.6 Live updates (P1)
- While you're viewing a shelf, new good words from others don't insert themselves (content never jumps). A pill appears at the top: "2 new good words". Tapping it scrolls to top and inserts them. Your own good words insert immediately.

#### F5.7 States (DS 5.12)
| State | Group shelf | All groups | My shelf |
|---|---|---|---|
| Empty, first use | "Nothing here yet. Be the first to put in a good word." + Put in a good word + Invite friends | "No groups yet" + Start a group + "Got an invite link? Open it to join." | DS 6.6 empty personal shelf copy + Put in a good word |
| No results | "Nobody's vouched for a Netflix movie yet." + Clear filters | Same | "You haven't vouched for anything like that." + Clear filters |
| Loading | 6 skeleton cards | Same | Same |
| Error | Error state + Retry | Same | Same |
| Offline | Cached content + offline banner (P0: banner and last-loaded content in memory; P1: persisted cache) | Same | Same |

**First-good-word prompt:** on a group shelf, for a member with no good words in that group, show an inline card after the first scroll to the end or after 20 seconds: "What's something you'd tell these folks to watch?" with **Put in a good word**. Dismissible; doesn't return for that group once dismissed or used.

**Acceptance**
- Given a user in 2 groups where the same title was vouched for in both, then All groups shows one card whose vouched-by row lists each person once.
- Given filters Movies + Netflix + Hulu, then results include movies available on Netflix or Hulu in the user's region, and the URL reflects all three.
- Given a new good word by a friend since the user's last visit, then its card shows New and the group switcher shows a count.
- Given a shelf of 60 good words, then the first 24 load, more load on scroll, and "That's the whole shelf." shows at the end.

---

### F6. Title detail (P0)

**Route:** `/title/[type]/[tmdbId]`. Layout and content order per DS 4.2.2 (`detail`) and DS 5.7.

**Content, in order**
1. Poster, title (`h1`), meta line ("Series · 2024 · 3 seasons" or "Film · 2023 · 1h 52m"), genres as text.
2. **Good words:** every person in your groups who vouched for it, each with avatar, name, note, when, and the chips of the groups (yours only) it's shared in. Your own good word is listed first as "You" with an Edit menu.
3. **Where to watch** for the user's region, grouped Stream / Rent / Buy, with provider logos and names, each linking out to the provider (via TMDB's watch link). JustWatch attribution beneath (Section 9.2). If nothing: "Not streaming in your region right now."
4. **Vouch button** (`lg`, DS 4.2.3).
5. **Conversation preview** for the current group (F13), per DS 5.17: "Talk about it in College crew", the 3 most recent comments, "See all N comments", and "Add a comment…". If the title is on several of your groups' shelves, a chip row switches between their conversations. Hidden when the title isn't on any of your groups' shelves.
6. Overview, collapsed to 3 lines with More.

**Rules**
- The detail screen is reachable for any title (for example, from search), even with no good words from your groups. In that case, section 2 reads "None of your groups have vouched for this yet."
- Never show people or groups the viewer doesn't share a group with.
- The document title is "The Night Ferry · Good Word".

**Acceptance**
- Given a title vouched for by two friends, then both notes show with names and relative times, and the viewer's own good word (if any) is first.
- Given a user in the UK region, then where-to-watch shows UK providers.
- Given a provider link is tapped, then it opens the provider's page, and `where_to_watch_clicked` is recorded.

---

### F7. Notifications and email (P0 unless marked)

All notifications follow DS 5.13: they name people or titles, deep-link to what they mention, respect frequency caps and quiet hours, and have one-click unsubscribe.

#### F7.1 Weekly digest (P0)
- **Default on.** Sent weekly on **Thursday at 5pm in the user's timezone** (pending confirmation, Section 15).
- **Only sent if there's something new:** at least one good word from someone else in your groups in the past 7 days. Never send an empty digest.
- Subject: "This week on Good Word: 5 new good words" (singular for 1).
- Body: grouped by group, up to 8 good words per group (poster, title, who vouched, note), then "See all N in College crew". A single primary button: "Open Good Word".
- Every title links to its detail page with a `ref=digest` parameter so good words created in that session record source `digest`.
- Footer: why you got it, a one-click unsubscribe from digests, and a link to notification settings.

#### F7.2 Weekend prompt (P1)
- For members who haven't put in a good word in 14 days and have at least one group, send on Sunday at 10am local: subject "What did you watch this weekend?", body with one button "Put in a good word" that opens the Add sheet (`ref=nudge_email`).
- At most once every 14 days. Never guilt-tripping (DS 6.3). Default on, easy to turn off.

#### F7.3 Someone joined your group (P0)
- To the group owner, when someone joins: "Jonah joined College crew." Batched to at most one email per day per owner. Default on.

#### F7.4 Mention emails (P0)
- When someone mentions you (F13), send one email per conversation, batched over 15 minutes: subject "Priya mentioned you on The Night Ferry" (or "Priya and Jonah mentioned you…" if several). Body: poster, group name, the comment(s) mentioning you (or "a spoiler comment"), and one button, "Open the conversation", deep-linking to the first mentioning comment.
- Don't send if you've already opened that comment in the app, or if the comment was deleted before sending.
- Default on; one-click unsubscribe from mention emails.

#### F7.5 Conversation summary in the digest (P0)
- The weekly digest adds a short section per group: "12 new comments on 3 titles", listing the titles with the most comments and linking to their conversations. Spoiler text never appears.

#### F7.6 Transactional email (P0)
- Magic sign-in link. Not affected by preferences.

#### F7.7 Preferences (P0)
- In Settings › Notifications: switches for Weekly digest, Mentions (email), Someone joined your group, and (P1) Weekend prompt. Each takes effect immediately (DS 5.16). Activity items are always recorded in-app regardless of email settings.
- A global cap: at most one non-transactional email per day per user; quiet hours 9pm to 9am local. **Mention emails are exempt from the daily cap** (DS 5.13) but respect quiet hours: a mention during quiet hours sends at 9am.
- Unsubscribe links work without signing in (signed token), confirm on a simple page, and offer undo.

**Acceptance**
- Given no new good words from others in a user's groups this week, then no digest is sent.
- Given a user clicks a title in the digest and then puts in a good word, then that good word's source is `digest`.
- Given a user taps unsubscribe in a digest, then digests stop without requiring sign-in, and the setting shows off.

---

### F8. Person view (P1)

- Tapping a person's name or avatar anywhere opens `/people/[userId]`: their name, the groups you share, and their good words **only within groups you share**, with the standard filters.
- Serves the "I trust her taste in film" use case. Never shows their other groups or good words outside shared groups.
- Visiting someone you share no group with shows "You're not in any groups with this person."

---

### F9. Share my shelf (P1)

- In Settings, "Share my shelf" is **off by default**. Turning it on creates a link `/s/[token]` and shows Copy and Share.
- The shared page is read-only and shows the owner's display name, their good words (poster, title, year, their own note only), newest first, and a small "Made with Good Word" link to the marketing page. It never shows groups, other people, or other people's notes.
- Toggle off or **Reset link** invalidates the old link immediately.
- The page sends `noindex` and carries no analytics beyond a view count visible to the owner.
- **Design system impact:** DS 5.14 says "Nothing is public." This feature needs that rule amended to "Nothing is public unless you turn on a share link" (Section 15).

---

### F10. Onboarding, empty states, and first run (P0)
- **No tutorials, carousels, or taste quizzes** (DS 5.2). Teach through the invite landing, empty states, the welcome banner, and the first-good-word prompt.
- **New user with no invite and no groups** lands on All groups' empty state: "Start a group, or put in a good word just for you." with **Start a group** (primary) and **Put in a good word** (secondary), plus "Got an invite link? Open it to join."
- **Welcome banner** on first arrival to a group's shelf after joining: "You're in. Here's what College crew vouches for." Dismissible; shown once per group.
- **Milestones** per F4.

---

### F11. Help, settings, and about (P0)

**Settings (`/you/settings`)**, grouped:
- **Account:** display name, email (read-only), region, sign out.
- **Notifications:** per F7.7.
- **Streaming services (P1):** pick the services you have; enables the "On my services" filter.
- **Share my shelf (P1):** per F9.
- **Your data:** download my data, delete account.

**Help (`/you/help`)** — in the same place on every screen (DS 5.16):
- A short FAQ: what's a good word, who can see my good words, how groups and invites work, how to leave a group, how to delete my account.
- Keyboard shortcuts (desktop).
- **Send feedback:** a short form (message plus optional "OK to follow up by email") stored in the database and emailed to Sydney.
- **About:** version, privacy and terms links, the privacy summary, and the required TMDB and JustWatch attributions (Section 9).

---

### F12. Installable app and offline (P1)
- Web app manifest, icons, and standalone display (DS 8.3). On iOS Safari, a one-time, dismissible tip in You after the user's third visit: "Add Good Word to your Home Screen for one-tap access." Never on first visit.
- Service worker caches the app shell and the last viewed shelves.
- Good words created offline are queued, captioned "Sending when you're back online", and sent on reconnect (DS 5.12). If sending fails permanently, the item shows an error with Retry and Remove.
- P0 baseline without F12: an offline banner, previously loaded content stays on screen, and write actions show a toast explaining they need a connection, while keeping the user's input.

### F13. Conversations and mentions (P0)

Interaction and visual details are in DS 4.2.10 to 4.2.12 and DS 5.17. These are the product rules.

**Stories**
- As a member, I can comment on a show or movie on my group's shelf, and see everyone else's comments in that group.
- As a member, I can mention someone in the group with @ so they know I'm talking to them.
- As a member, I can mark a comment as a spoiler so friends who haven't finished aren't spoiled.
- As a member, I can edit or delete what I said.

**Rules**
- **Scope:** a conversation belongs to one title in one group. It exists only for titles on that group's shelf. The same title can have separate conversations in each group, and no group can see another group's conversation or learn whether one exists.
- **Who can take part:** current members of the group. Comments are visible to every current member.
- **Structure:** flat and chronological (oldest first), no nested replies. Replying is done by mentioning.
- **Comment:** 1 to 500 characters, plain text. Line breaks are kept. URLs are shown as text, not links, in the MVP.
- **Mentions:** only members of that group, chosen from the autocomplete (DS 4.2.11). Stored by user id. Up to 10 mentions per comment. You can't mention yourself.
- **Spoilers:** the author can mark a comment as a spoiler when writing or editing. Spoiler text is never rendered for others until they tap to reveal, and never appears in previews, Activity, or email (DS 4.2.12).
- **Edit:** the author can edit anytime; the comment shows "edited". Newly added mentions notify; existing ones don't re-notify.
- **Delete:** the author, or the group owner, can delete. Deletion is immediate with an 8-second Undo, then permanent. Deleting retracts related unread Activity items and unsent mention emails.
- **Participants:** you become a participant in a title's conversation in a group when you comment there or put in a good word for that title in that group. Participants get Activity items for new comments (not emails).
- **Unseen tracking:** per person, per title, per group. Opening the conversation marks comments as seen up to the bottom of what was shown.
- **Live updates:** while a conversation is open, new comments arrive in real time (DS 5.17). The shelf's comment counts update on the next load.
- **Moderation:** owners can delete any comment in their group. No reporting in the MVP.

**Acceptance criteria**
- Given a title on the shelves of College crew and The girls, when Priya comments in College crew, then members of College crew see it, and members of The girls who aren't in College crew cannot see it, reach it by URL, or see a comment count for it.
- Given Tess types "@" in College crew's conversation, then the suggestions list only College crew members other than Tess.
- Given Tess mentions Priya, then within seconds Priya's bell shows an unread count and Activity shows "Tess mentioned you on The Night Ferry in College crew", and within 15 minutes (outside quiet hours) Priya receives one mention email.
- Given a comment marked as a spoiler, then for everyone except its author the text is absent from the page source, accessibility tree, Activity, and emails until "Tap to reveal" is pressed.
- Given the author deletes a comment and doesn't undo, then it's gone for everyone, and any unread Activity items it caused are removed.
- Given Jonah is removed from College crew, then he can no longer open or receive activity for its conversations, and his earlier comments remain attributed to him.
- Given two people have the conversation open, when one sends a comment, then it appears for the other within 2 seconds without a refresh, and without moving their scroll position if they've scrolled up.
- Given the network drops while sending, then the comment shows "Didn't send." with Retry and Delete, and the text isn't lost.

**Edge cases:** a mentioned member leaves before the email sends (don't send); a title leaves the shelf because its last good word was taken back (keep the conversation reachable from Activity and from title detail with a caption "No one in College crew vouches for this anymore", and allow comments to continue); very long unbroken strings (wrap with `overflow-wrap: anywhere`).

### F14. Activity (P0)

**Stories:** As a member, I can see in one place when someone mentioned me, replied in a conversation I'm part of, or joined a group I own, and jump straight there.

**Rules**
- Route `/activity`, opened from the bell in the top bar (and rail on desktop). The bell shows the unread count (DS 4.1.11).
- Item types: `mention`, `comment` (in conversations you're part of, excluding your own), `group_join` (owners only). Items for the same conversation within an hour collapse into one ("Jonah and Tess commented on The Night Ferry").
- Each item deep-links to the exact comment (or group, for joins). Opening an item marks it read; "Mark all as read" marks everything read.
- Items are kept for 90 days.
- Activity respects group membership: leaving a group removes its items.
- Layout, grouping (Today, This week, Earlier), and states follow DS 4.2.13 and DS 5.17.

**Acceptance criteria**
- Given three unread items, when the user opens one, then the bell count drops to 2 and they land on the right comment, highlighted.
- Given a comment that mentions you is deleted before you open Activity, then its item is gone.
- Given the user leaves a group, then its Activity items disappear.

---

## 8. Data model

Postgres (via Supabase). Names are indicative; keep them consistent once chosen. Every table has `id` (uuid), `created_at`, and `updated_at` unless noted.

| Table | Key fields | Notes |
|---|---|---|
| `profiles` | `user_id` (auth user), `display_name`, `region` (ISO 3166-1, default `US`), `timezone`, `onboarded_at`, `deleted_at` | One per user |
| `groups` | `name`, `owner_id`, `color` | `color` assigned at creation |
| `group_members` | `group_id`, `user_id`, `role` (`owner`, `member`), `joined_at`, `last_viewed_at`, `welcome_seen_at`, `join_prompt_dismissed_at` | Unique (`group_id`, `user_id`) |
| `invites` | `group_id`, `code` (unique), `created_by`, `revoked_at` | One active (non-revoked) invite per group |
| `titles` | `tmdb_id`, `media_type` (`movie`, `tv`), `title`, `original_title`, `year`, `poster_path`, `genres` (array of TMDB genre ids and names), `runtime_minutes`, `seasons`, `overview`, `accent` (one of the four `genreAccent` values in DS 4.2.1), `fetched_at` | Unique (`tmdb_id`, `media_type`). `accent` set once on insert via `genreAccent` (DS 4.2.1) |
| `good_words` | `user_id`, `title_id`, `note` (max 140), `source` (`organic`, `digest`, `nudge_email`, `join_prompt`, `share`, `import`) | Unique (`user_id`, `title_id`) |
| `good_word_groups` | `good_word_id`, `group_id`, `shared_at` | Unique pair. Which shelves a good word is on |
| `watch_providers` | `title_id`, `region`, `providers` (json: stream, rent, buy), `link`, `fetched_at` | Cached per title per region |
| `notification_prefs` | `user_id`, `digest`, `mention_email`, `group_joins`, `weekend_prompt` (booleans) | Defaults: all on |
| `comments` | `group_id`, `title_id`, `user_id`, `body` (max 500), `is_spoiler`, `edited_at`, `deleted_at` | Index on (`group_id`, `title_id`, `created_at`). Soft delete supports Undo; purge after the Undo window |
| `comment_mentions` | `comment_id`, `mentioned_user_id` | Unique pair. Mentioned user must be a member of the comment's group |
| `conversation_reads` | `user_id`, `group_id`, `title_id`, `last_read_at` | Drives the "New" divider and unseen-comment dots |
| `conversation_participants` | `user_id`, `group_id`, `title_id`, `muted` | Created when you comment or vouch for that title in that group; decides who gets comment activity. `muted` reserved for later |
| `activity_items` | `user_id` (recipient), `type` (`mention`, `comment`, `group_join`), `actor_id`, `group_id`, `title_id`, `comment_id`, `read_at` | Deleted after 90 days, or when the source comment is deleted |
| `notification_log` | `user_id`, `type`, `sent_at`, `payload_ref` | Enforces caps and dedupes sends |
| `streaming_services` (P1) | `user_id`, `region`, `provider_ids` (array) | |
| `share_links` (P1) | `user_id`, `token` (unique), `enabled`, `revoked_at`, `view_count` | |
| `feedback` | `user_id`, `message`, `may_contact` | |
| `events` | `user_id` (nullable), `name`, `properties` (json), `occurred_at` | First-party analytics (Section 11) |

**Derived views**
- **Shelf card:** for a given group, group `good_word_groups` joined to `good_words` by `title_id`, returning the title, the list of vouchers (ordered by `shared_at` desc), the most recent note, voucher count, and most recent `shared_at` (for sorting and New badges).
- **All groups:** the same across all the viewer's groups, deduplicating vouchers by `user_id`.

**Deletion semantics**
- Taking back a good word deletes it and its `good_word_groups` rows (Undo re-creates both from the client's snapshot, or use a soft delete with a short grace period, whichever is simpler).
- Leaving or being removed from a group deletes that person's `good_word_groups` rows for that group.
- Deleting a group deletes its memberships, invites, and `good_word_groups` rows. Good words themselves remain.
- Deleting an account deletes the profile, memberships, good words, comments, and activity items, transfers ownership as in F1, and purges within 30 days.
- Deleting a group also deletes its comments, mentions, reads, and activity items.

**Row-level security (must be enforced in the database, not only in the UI)**
- A user can read a group, its members, and its invite only if they're a member.
- A user can read a good word only if it's their own, or it's shared into a group they're a member of. When reading someone else's good word, the `good_word_groups` rows returned are **only** those for groups the viewer belongs to, so group names are never leaked.
- Only the good word's author can create, edit, or delete it and its group links, and only into groups they belong to.
- Only owners can rename, reset invites, remove members, or delete groups.
- A user can read comments only in groups they're currently a member of. Removed or departed members lose read access immediately.
- A user can create a comment only in a group they belong to, on a title on that group's shelf, as themselves. Authors can edit and delete their own comments; group owners can delete any comment in their group.
- A mention is valid only if the mentioned user is a member of the comment's group at the time of writing; the server drops any others and stores the text as plain text.
- Users can read only their own `activity_items`, `conversation_reads`, and `notification_prefs`.
- `titles` and `watch_providers` are readable by any signed-in user and writable only by the server.
- Joining via invite happens through a server function that validates the code and limits.

---

## 9. Integrations

### 9.1 TMDB (The Movie Database)
- **Use:** multi-search, movie and TV details (including genres, runtime, seasons), images, and watch providers.
- **Key handling:** server-side only. The browser calls the app's own API routes, which call TMDB.
- **Caching:** search results 5 minutes; title details refreshed if older than 7 days when viewed; watch providers refreshed if older than 24 hours per region.
- **Images:** built from TMDB's configuration base URL with size variants per DS 9 (`w154`, `w342`, `w500`).
- **Failure:** the app keeps working with cached titles. Search and detail show their error states (DS 4.1.19).
- **Attribution (required):** TMDB logo and "This product uses the TMDB API but is not endorsed or certified by TMDB." in About.

### 9.2 JustWatch (via TMDB watch providers)
- TMDB's where-to-watch data comes from JustWatch, and TMDB requires JustWatch attribution wherever it's shown. Show "Streaming data from JustWatch" with their logo beneath where-to-watch on title detail, and in About.

### 9.3 Authentication
- Supabase Auth: email magic links (15-minute, single-use) and Google OAuth. Custom, on-brand email template for the magic link.

### 9.4 Email
- **Resend** (decided), with a verified sending domain, SPF, DKIM, and DMARC. It sends sign-in links from slice 1 as Supabase Auth's custom SMTP sender, and all product email from slice 7.
- Support RFC 8058 one-click unsubscribe (`List-Unsubscribe` and `List-Unsubscribe-Post` headers) on digest and prompt emails.
- Templates are responsive, readable in plain text, and survive dark-mode email clients. Every image has alt text.
- No open-tracking pixels. Measure engagement by link clicks with `ref` parameters.

### 9.5 Scheduling
- A scheduled job (Vercel Cron or Supabase scheduled functions) runs hourly and sends any digests or prompts due in each user's local time, respecting caps and the notification log.

### 9.6 Hosting and stack
- **Assumed stack:** Next.js (App Router) on Vercel, Supabase (Postgres, Auth, Realtime for P1 live updates), Tailwind per DS 11.
- **Decided (open question 1):** Next.js. The marketing page and the app live in one Next.js app, the marketing page in the `(marketing)` route group.

---

## 10. Non-functional requirements

### 10.1 Performance
Per DS 9: LCP under 2.5 seconds on a mid-tier phone on 4G, INP under 200ms, CLS under 0.1. All writes are optimistic. Shelves render their first page server-side.

### 10.2 Accessibility
WCAG 2.2 AA per DS 7, verified by the testing protocol in DS 7.4. Every screen must pass the screen definition of done (DS 12.1).

### 10.3 Browser and device support
| Platform | Support |
|---|---|
| iOS Safari 16.4+ (browser and Home Screen) | Primary; test every flow here first |
| Chrome on Android, last 2 versions | Full |
| Desktop Safari, Chrome, Firefox, Edge, last 2 versions | Full |
| Screen widths | 320px and up; designed at 390, 768, 1024, 1440 |

### 10.4 Security and privacy
- Row-level security on every table (Section 8). No table readable without a policy.
- Invite codes and share tokens: at least 128 bits of randomness; never sequential.
- Rate limits: sign-in emails (5 per address per hour), joins (per IP and per code), search (60 per user per minute), good words (100 per user per hour), comments (30 per user per 10 minutes), feedback (10 per user per day).
- No personal data in URLs beyond ids. No third-party trackers or ad scripts.
- Secure headers: Content Security Policy, HSTS, `frame-ancestors 'none'`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- Secrets (TMDB key, email API key, service role key) only in server environment variables.
- Plain-language privacy page stating what's collected (email, name, region, good words, groups, basic usage events), why, who can see it, retention, and how to delete it.
- Terms state users must be 13 or older. No age is collected.

### 10.5 Reliability and data
- Daily database backups with point-in-time recovery.
- Errors logged server-side with enough context to debug, but without notes or emails in logs.
- Idempotent writes for good words (a retried submit never creates a duplicate; the unique constraint enforces it).

### 10.6 SEO and sharing
- App routes: `noindex`. Marketing, privacy, and terms: indexable.
- Invite links (`/join/[code]`) render a link preview (Open Graph title "Join College crew on Good Word", description, and a branded image) so they look trustworthy in group chats. The preview must not show shelf contents.

---

## 11. Analytics and instrumentation

### 11.1 Principles
First-party, minimal, and privacy-respecting. Events go to the `events` table. No third-party analytics SDKs. Never record search queries' text, notes, or email addresses in events.

### 11.2 Events
| Event | Properties | Serves |
|---|---|---|
| `invite_link_opened` | `group_id`, `signed_in` | H1 |
| `invite_shared` | `group_id`, `method` (`share_sheet`, `copy`) | H1 |
| `group_created` | `group_id` | J1 |
| `group_joined` | `group_id`, `via` (`invite`) | H1 |
| `sign_in_completed` | `method` (`magic_link`, `google`), `new_user` | Funnel |
| `add_opened` | `entry_point` (`tab`, `rail`, `shortcut`, `title`, `search_row`, `join_prompt`, `empty_state`) | H3 |
| `search_performed` | `query_length`, `result_count` | H3 |
| `good_word_created` | `title_id`, `groups_count`, `has_note`, `source`, `ms_from_add_opened` | H2, H3, H4 |
| `good_word_edited` | `field` (`note`, `groups`) | |
| `good_word_taken_back` | `undone` (boolean) | |
| `shelf_viewed` | `shelf` (`group`, `all`, `mine`, `person`), `filters` (keys only), `new_count` | H5 |
| `title_viewed` | `from` (`shelf`, `search`, `digest`, `person`, `share`) | H5 |
| `where_to_watch_clicked` | `title_id`, `provider_id`, `from_good_word` (boolean) | H5 |
| `email_sent` | `type` | H4, H6 |
| `email_clicked` | `type`, `target` | H4, H6 |
| `notification_pref_changed` | `type`, `enabled` | |
| `first_good_word_prompt` | `action` (`shown`, `used`, `dismissed`) | H2 |
| `share_link_toggled` (P1) | `enabled` | J7 |
| `conversation_opened` | `group_id`, `title_id`, `from` (`title`, `card`, `activity`, `email`), `unseen_count` | H7 |
| `comment_created` | `group_id`, `title_id`, `length_bucket`, `mention_count`, `is_spoiler` | H7 |
| `comment_edited` / `comment_deleted` | `undone` (for delete) | |
| `mention_notified` | `channel` (`activity`, `email`) | H7 |
| `activity_opened` | `unread_count` | H7 |
| `spoiler_revealed` | | |

### 11.3 Source attribution
- `ref` query parameters from emails (`digest`, `nudge_email`) and the join prompt are stored for the session. A good word created in that session records that source; otherwise `organic`.
- This is how the product answers H4: whether people log on their own or mainly when nudged.

### 11.4 Reporting
A simple internal page at `/admin/metrics` (Sydney's account only) showing H1 to H6 weekly: joins per invite opened, first good word within 7 days, median time to log, source mix, week-4 activity, and where-to-watch clicks. Tables are fine; no charts required for the MVP.

---

## 12. Build plan

Build in this order. Each slice ends with a phone-testable demo. Stop after each slice for review.

| Slice | Contents | Done when |
|---|---|---|
| **0. Foundations** | Reconcile the marketing page onto tokens (DS 11.6); `tokens.css`, Tailwind mapping, lint rules; `/styleguide` with all DS components and states | Marketing page is pixel-identical on tokens; `/styleguide` shows every component in every state; lint and axe pass |
| **1. Accounts** | Supabase setup; sign-in (magic link, Google); check-email; welcome/name; sign out; access rules and redirects | A new user can sign in on an iPhone and set their name; signed-out access redirects correctly |
| **2. Groups** | Create, invite card and sharing, join landing, join flow through sign-in, group details, members, rename, reset link, leave, remove, delete; RLS | Two test accounts on two phones: one creates and invites, the other joins from the link in under 90 seconds |
| **3. Titles** | TMDB server routes; search sheet with all states; title cache with genre accent; typographic fallback posters | Searching "night" returns movies and shows with posters in under a second; fallback posters render |
| **4. The core loop** | Confirm sheet with note and visibility line; create, edit, take back, Undo; group shelf, All groups, My shelf; one card per title per group; milestones; first-good-word prompt; empty states | J1, J2, and J3 work end to end; log time under 10 seconds in a stopwatch test |
| **5. Choosing** | Title detail with good words and notes; where to watch with JustWatch attribution; filters, sort, URL state, paging; New badges and counts | J4 works end to end; filters survive refresh and Back |
| **6. Conversations** | Comments table and RLS; conversation preview on title detail; full conversation screen; composer with mention autocomplete; spoilers; edit, delete, Undo; live new comments (Supabase Realtime); comment counts on cards; Activity list and bell badge | J6 works end to end on two phones: a mention shows in Activity within seconds, a spoiler stays covered, and a member of another group can't see or reach the conversation |
| **7. Email** | Email provider and domain; digest (including conversation summary); mention emails; group-join emails; preferences; unsubscribe; scheduler; caps | A test digest arrives with correct content, links carry `ref=digest`, a mention email arrives within 15 minutes, and unsubscribe works signed out |
| **8. Settings and trust** | Settings, help, FAQ, feedback, about and attributions, download my data, delete account with ownership transfer, privacy and terms pages, security headers, rate limits | Account deletion and data download verified; all attribution present |
| **9. Measurement** | Events per Section 11; source attribution; `/admin/metrics` | Every event fires from its flow; metrics page shows real numbers from test use |
| **10. P1 (in order)** | Installable app and offline queue; live new-good-words pill; person view; streaming services filter; share my shelf; weekend prompt | Each P1 item meets its acceptance criteria |

**Across every slice:** each new screen meets DS 12.1 before the slice is called done, and is checked on iOS Safari first.

---

## 13. Research and release plan

### 13.1 Usability testing (per NN/g practice)
- **When:** after slice 4 (core loop), after slice 5 (choosing), and after slice 6 (conversations), before inviting the beta.
- **Who:** 5 people per round who aren't on the team, on their own phones.
- **Tasks:** "A friend sent you this link. Join the group." · "You just finished a show you loved. Tell the group." · "It's Friday night. Find a comedy movie you can watch on Netflix that someone in the group recommends." · "Change the note on something you recommended." · "Tell Priya what you thought of The Night Ferry's ending without spoiling it for anyone else."
- **Measure:** task success, time on task, errors, and a single ease rating per task. Fix severity 1 and 2 issues before release.
- **Heuristic review:** walk each new screen through DS 1.2 before testing.

### 13.2 Private beta
- **Who:** Sydney's friend groups, 2 to 4 groups of 4 to 10 people.
- **Seeding:** Sydney adds 5 to 10 good words to each group before inviting, so no one arrives to an empty shelf.
- **Length:** 4 to 6 weeks.
- **Feedback:** in-app Send feedback, plus short interviews with 5 to 6 beta users at week 2 and week 5 about what they used, what they wished for, and whether they watched anything because of a friend's good word.
- **Decision at the end:** review H1 to H6 and decide what to build next from the Later list (Section 4.2).

---

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| People browse but don't contribute (the classic recommendation-app failure) | High | Ten-second logging; first-good-word prompt; audience-naming success toast; weekend prompt; source tracking to measure it early |
| Empty shelves on arrival | High | Seed groups before inviting; useful-alone My shelf; honest empty states with one clear action |
| Invite friction (email sign-in on phones) | High | Google option; invite context kept throughout; link-on-another-device handling; test J2 on real iPhones |
| Notifications feel spammy | Medium | Never send empty digests; one non-transactional email per day max; quiet hours; one-click unsubscribe |
| Privacy mistakes (leaking groups or people across groups) | High | RLS in the database; explicit acceptance tests for cross-group visibility; never show group names the viewer isn't in |
| TMDB outage or rate limits | Medium | Server-side caching; the app works from cached titles; clear error states |
| Where-to-watch data is wrong or stale | Low | 24-hour refresh; attribution sets expectations; region setting |
| Scope creep before the core loop is proven | Medium | P0/P1/Later labels; slice gates; Later items need their own spec |
| Conversations pull attention from putting in good words | Medium | Conversations live on title detail, not the shelf; the Add button stays the primary action; watch H7's "good words per member doesn't drop" signal |
| Spoilers ruin a show for someone | Medium | Spoiler toggle with a first-time hint; covered text never rendered, previewed, or emailed |
| Mentions feel like pressure or spam | Low | Mentions only within a group; batched emails; one-tap unsubscribe; no read receipts or typing indicators |

---

## 15. Open questions

Decide before the slice that needs them.

| # | Question | Proposal | Needed by |
|---|---|---|---|
| 1 | Marketing page framework: Next.js or Astro? | **Decided (2026-09-28): Next.js.** Marketing and app share one Next.js app | Slice 0 |
| 2 | Share-my-shelf conflicts with DS 5.14 ("Nothing is public") | Amend DS 5.14 to "Nothing is public unless you turn on a share link", off by default and revocable | Slice 10 |
| 3 | The marketing page promises "Ask, and pull from people you trust" with the example "Something funny, under 30 minutes" | For the MVP, filters (Comedy + Under 30 minutes) fulfill this; either keep the copy or change the example until Ask ships | Beta launch |
| 4 | Digest day and time | Thursday, 5pm local | Slice 7 |
| 5 | When someone leaves, their good words leave that shelf | Confirm (currently specified) | Slice 2 |
| 6 | Group size limit of 50 and 20 groups per person | Confirm, or raise after beta | Slice 2 |
| 7 | Should removed members be told? | No for the MVP; revisit if it causes confusion | Slice 2 |
| 8 | Email provider | **Decided (2026-09-29): Resend**, set up in slice 1 for sign-in links | Slice 1 |
| 9 | Do we need an explicit "Watched it" action to prove H5? | Rely on where-to-watch clicks and interviews for the MVP; build "Watched it because of you" first if evidence is unclear | After beta |
| 10 | Comments from people who leave or are removed | Stay visible and attributed so conversations make sense; deleted only if they delete their account | Slice 6 |
| 11 | Can people comment on a title nobody in the group has vouched for? | No. Conversations exist only for titles on the group's shelf, so they're always discoverable. To start one, put in a good word first | Slice 6 |
| 12 | Should mentions work inside notes too? | Not in the MVP; notes travel across groups, so a mention could reach people outside the mentioned person's groups | After beta |

---

## 16. Changelog

- **v1.2.4 (2026-09-29):** My shelf is a main navigation item: the You tab is renamed My shelf and leads with your good words, then your groups and a Settings link (6.1, 6.2, F5.3, J7). Routes stay under `/you`.
- **v1.2.3 (2026-09-29):** Resend decided and moved up to slice 1 for sign-in emails (9.4, open question 8). Session length accepted as "stays signed in while in use" on the free plan (F1). Within slice 1, Google sign-in is built after email links.
- **v1.2.2 (2026-09-28):** Open question 1 decided: Next.js, one app for marketing and product (9.6).
- **v1.2.1 (2026-09-28):** The marketing page isn't built yet; it's built after foundations (CLAUDE.md step M).
- **v1.2 (2026-09-27):** Made visual references direction-neutral (milestone moment, `genreAccent` values) so this doc works with Design System v3.0 (Editorial).
- **v1.1 (2026-09-27):** Added conversations on titles (per group), @mentions, spoilers, and Activity (F13, F14, J6); mention emails and digest summary; data model and RLS for comments; analytics for H7; new build slice 6. Aligned to Design System v2.1.
- **v1.0 (2026-09-27):** Initial product requirements for the MVP, aligned to Design System v2.0.
