# Good Word: Product Requirements (MVP)

**Version** 1.5.0 · **Status** Ready to build · **Owner** Sydney (product and design) · **Last updated** 2026-10-06

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
- **Use the glossary** (DS 1.4) in UI copy: good word, list, My list, Home, friend, group, member, note, conversation, comment, mention, activity. Never post, item, feed, timeline, follower, review, rating, like, chat, or thread.
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
Good Word is a private, mobile-first web app where friends keep lists of the shows and movies they'd vouch for. It opens to Home: everything your friends have put in a good word for, newest first. Friends are mutual, and each person can also belong to a few groups (college friends, the girls, a book club), each with its own list. When you finish something great, you put in a good word in about ten seconds. When you need something to watch, you pull from people whose taste you actually know, with their names on every pick.

### 1.3 Product principles
These are the product's non-negotiables. They're expanded in DS 1.1.
1. **People over picks.** Every good word shows the person behind it. The app never recommends on its own.
2. **Private by default, visibly so.** You always know who will see what, before you share it.
3. **Ten seconds to a good word.** Logging is the core habit and must be nearly effortless.
4. **A library, not a mailbox.** You stock your own list and choose who sees each good word: your friends, any of your groups, or only you. You don't send recommendations to individuals (for now).
5. **Useful alone, better together.** Your own list is valuable even before friends join.
6. **It ends.** Home is newest first and finite: new good words, then "You're all caught up". No ranking, no endless scrolling (F16.3).

### 1.4 What Good Word is not
- Not a public social network. No followers, public profiles, or discovery of strangers. Friends are mutual, and nobody sees a count of them.
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
| H5 | Lists actually help people choose what to watch | Where-to-watch taps and title views from lists grow week over week; qualitative beta interviews confirm it |
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
| Good words | Put in a good word with optional note and audience | P0 |
| Good words | Edit note, change who sees it, take it back (with Undo) | P0 |
| Lists | Home, group list, My list | P0 |
| Friends | Mutual friends: friend link, requests from your groups, Friends screen, remove a friend (F16.1) | P0 |
| Good words | Audience: friends, any of your groups, or only you (F16.2) | P0 |
| Home | Every good word you can see, one card per title, newest first, caught-up marker, import roll-ups (F16.3) | P0 |
| Titles | One title page for everyone, showing what each viewer may see (F16.4, F16.6) | P0 |
| Conversations | Conversations under a good word (F16.5) | P0 |
| Lists | Filters (type, streaming service, genre, length) and sort | P0 |
| Lists | "New since your last visit" indicators | P0 |
| Titles | Title detail with everyone's good words, notes, and where to watch | P0 |
| Notifications | Weekly digest email; notification preferences | P0 |
| Notifications | Owner alerts when someone joins their group (email) | P0 |
| Notifications | Gentle weekend prompt email to members who haven't contributed in 14 days | P1 |
| Onboarding | Invite landing, first-good-word prompt, empty states, milestones | P0 |
| Help | Help, FAQ, send feedback, about with attributions | P0 |
| Lists | Person view: a member's good words in groups you share | P1 |
| Lists | "Your streaming services" setting and "On my services" filter | P1 |
| Sharing | Share-my-list link (read-only, off by default, revocable) | P1 |
| Platform | Installable web app (manifest, icons, standalone mode) | P1 |
| Platform | Offline: cached lists and queued good words | P1 |
| Lists | Live "N new good words" pill while viewing a list | P1 |
| Conversations | Comment on a title within a group; see everyone's comments; edit and delete | P0 |
| Conversations | @mentions of group members, with notifications | P0 |
| Conversations | Spoiler marking | P0 |
| Conversations | Live new comments while a conversation is open | P0 |
| Conversations | Comment counts on list cards | P0 |
| Activity | Activity list (mentions, new comments in your conversations, joins) with unread badge | P0 |
| Notifications | Mention emails (batched over 15 minutes) | P0 |

### 4.2 Later (documented, not built)
Ordered by likely value. Each needs its own spec before building.
1. **Save for later:** a private "want to watch" list built from friends' good words. Likely the first request from beta users.
2. **"Watched it because of you":** tell a friend their good word worked. Measures the product's real value (DS 16, open question 5).
3. **Push notifications** for the installed web app (requires Home Screen install on iOS 16.4+).
4. **Text a good word in** (SMS to a Good Word number, parsed and confirmed). Requires US A2P 10DLC registration.
5. **Import:** pasted or dictated lists and Letterboxd screenshots are now specified as F15 (slice 11). Letterboxd RSS and Netflix viewing history upload stay here, each ending in a confirm step where the user picks what to vouch for.
6. **Reactions on comments** (a single "same" or heart), and mentions inside notes.
7. **Ask:** natural-language requests ("something funny, under 30 minutes") answered only from friends' good words, with an opt-in, clearly labeled robot guess when nothing matches (DS 5.15).
8. **Point a good word at a friend** ("this is so you"). Mentions in comments cover part of this job in the MVP.
9. **Other categories:** restaurants, places, and trusted services (the handyman use case).
10. **Native iOS app.**

### 4.3 Explicitly out of scope
- Public profiles, discoverable groups, followers, one-way following, people search, suggested people beyond your own groups, or likes.
- Nested reply threads, reactions, attachments, GIFs, or formatting in comments.
- Conversations that span groups. A conversation's audience is exactly its group, or exactly the people who can see the good word it sits under (F16.5).
- Typing indicators and read receipts.
- Star ratings, scores, or long-form reviews.
- Any algorithmic or AI-generated recommendations. (Reading someone's own list during an import, F15, isn't recommending.)
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
6. She goes back to the empty list, which prompts her to put in the first good word, and adds two shows.

**Success:** under 2 minutes from sign-in to invite sent.

### J2. Joining from an invite (invitee)
1. Jonah taps the link in the group chat on his iPhone.
2. The invite landing shows "Sydney invited you to College crew. 6 people are already sharing what they'd watch." with **Join College crew** (F2.4).
3. He taps it, enters his email, and taps **Email me a sign-in link**. The screen says "Check your email" and keeps "Joining College crew" visible.
4. He opens the email on the same phone, taps the link, and confirms his name.
5. He lands on College crew's list with the welcome banner "You're in. Here's what College crew vouches for." and browses.
6. After a moment, an inline card asks "What's something you'd tell these folks to watch?" He adds one.

**Success:** under 90 seconds from tapping the link to seeing the list.

### J3. Putting in a good word (contributor)
1. Priya finishes a show she loved. She opens Good Word from her Home Screen and taps **Add**.
2. She types "night fe" and taps The Night Ferry (2024, Series).
3. The confirm sheet shows the poster, an optional note, and who will see it: Friends on, her groups off. She types "ep 3 is where it gets you" and taps **Put in a good word**.
4. The sheet closes and a toast says "Your friends can see this." with Undo. The good word is on My list and on her friends' Home.

**Success:** median under 10 seconds from tapping Add to the toast, excluding typing the note.

### J4. Choosing something to watch (browser)
1. On a Friday night, Tess opens Good Word. College crew's list shows three cards marked **New** since her last visit.
2. She taps **Movies**, then the **Netflix** chip. Eight good words remain. She opens **More filters**, picks **Comedy** and **Under 2 hours**. Three remain.
3. She opens Low Tide Club, reads Priya's and Mo's notes, sees it's streaming on Netflix, and taps the provider to open it.

**Success:** a confident choice in under 2 minutes, from friends' good words only.

### J5. Coming back through the digest (lapsed browser)
1. On Thursday afternoon, Luis gets "This week on Good Word: 5 new good words from College crew and The girls."
2. The email shows posters, who vouched, and notes. He taps a title and lands on its detail screen, signed in.
3. He sees a show he loved is missing from the list and puts in his own good word from there.

**Success:** a digest click leads to a title view; some digest visits lead to a new good word (source `digest`).

### J6. Talking about a show (contributor and browser)
1. Tess watches The Night Ferry because Priya put in a good word. On the title's detail screen she taps **Add a comment…** under "Talk about it in College crew".
2. The conversation opens with the keyboard up. She types "just finished ep 6, @" and picks **Priya** from the list of College crew members, then "you were SO right". She turns on **Spoiler** and taps Send.
3. Her comment appears immediately. Within 15 minutes Priya gets an email, "Tess mentioned you on The Night Ferry", and a badge on the bell in Good Word.
4. Priya taps the email, lands on Tess's comment (covered as a spoiler, since it isn't hers), reveals it, and replies "@Tess the ferry scene!!". Tess sees it appear live because she still has the conversation open.
5. Jonah, who hasn't finished the show, sees "2 comments" on the card, opens the conversation, and sees two spoiler covers he can leave closed.

**Success:** a mention reaches the right person within 15 minutes, and nobody outside College crew can see or search any of it.

### J7. Sharing my list with someone outside Good Word (P1)
1. A coworker asks Sydney what to watch. She goes to **My list › Settings › Share my list**, turns it on, and copies the link.
2. The coworker opens a read-only page: "Sydney's good words", with posters, titles, and Sydney's notes, and a small "Made with Good Word" link.
3. Later, Sydney turns the link off, and it stops working immediately.

### J8. Adding a friend and opening Home
1. Priya opens My list › Friends and taps **Share** on her friend link, sending it to Jonah.
2. Jonah opens it on his iPhone: "Priya wants to be friends on Good Word." He taps **Add Priya as a friend** and signs in.
3. He lands on Home. Priya's good words for The Night Ferry and Low Tide Club are there, one card each, with her notes first. Below them: "You're all caught up."
4. He taps **Vouch too** on Low Tide Club, and the confirm sheet opens with the title chosen and Friends on.

**Success:** under 90 seconds from tapping the link to seeing Priya's good words on Home.

---

## 6. Information architecture and navigation

### 6.1 Sitemap and routes
Extends DS 5.1.

| Route | Screen | Auth | Priority |
|---|---|---|---|
| `/` | Marketing page (signed out); redirect to Home (signed in, F16.8) | Public | P0 |
| `/sign-in` | Sign in (optionally carrying `?next=` and invite context) | Public | P0 |
| `/sign-in/check-email` | Check your email | Public | P0 |
| `/auth/callback` | Magic link and OAuth callback | Public | P0 |
| `/welcome` | Name prompt (first sign-in only) | Signed in | P0 |
| `/join/[code]` | Invite landing: a group invite, or a person's friend link (F16.1) | Public | P0 |
| `/home` | Home (F16.3) | Signed in | P0 |
| `/list` | Redirect to Home | Signed in | P0 |
| `/list/all` | Redirect to Home (All groups is replaced by Home) | Signed in | P0 |
| `/list/[groupId]` | Group list | Member | P0 |
| `/title/[type]/[tmdbId]` | Title detail (`type` is `movie` or `tv`), showing what this viewer may see (F16.4) | Signed in | P0 |
| `/title/[type]/[tmdbId]/conversation?word=[goodWordId]` | The conversation under a good word (F16.5) | Can see that good word | P0 |
| `/title/[type]/[tmdbId]/conversation?group=[groupId]` | A group's conversation about a title (on desktop, a panel beside title detail) | Member of that group | P0 |
| `/activity` | Activity: mentions, new comments in your conversations, joins | Signed in | P0 |
| `/you` | My list (a main tab): your good words, Friends, your groups, settings entry | Signed in | P0 |
| `/you/friends` | Friends: your friend link, requests, people from your groups, your friends (F16.1) | Signed in | P0 |
| `/you/import` | Add recs: paste, dictate, or upload screenshots (F15) | Signed in | P1 |
| `/you/import/[importId]` | Review deck and done screen for one import (`?card=` is the card shown) | Signed in, own import | P1 |
| `/you/settings` | Account, region, notifications, services (P1), share link (P1) | Signed in | P0 |
| `/you/help` | Help, FAQ, shortcuts, send feedback, about and attributions | Signed in | P0 |
| `/groups/new` | Create a group | Signed in | P0 |
| `/groups/[groupId]` | Group details: invite, members, rename, leave, delete | Member | P0 |
| `/people/[userId]` | Person view: the good words of theirs you can see (F8) | Signed in, friend or shares a group | P1 |
| `/s/[token]` | Shared list (read-only, public by link) | Public | P1 |
| `/unsubscribe?token=` | Unsubscribe from one kind of email, with Undo (F7.7) | Public (signed token) | P0 |
| `/privacy`, `/terms` | Legal pages | Public | P0 |
| `/styleguide` | Design system reference (DS 14) | Dev only | P0 |

**Sheets over the current route (no navigation):** Add (search and confirm), group switcher, filters, vouch menu, confirm dialogs. Opening a sheet pushes a history entry so the Back gesture closes it (DS 5.1).

### 6.2 Navigation model
- **Mobile:** bottom tab bar with **Home**, **Add** (center), and **My list** (DS 4.2.8, F16.8). The header holds the wordmark on the left and the Activity bell with an unread count on the right. Home's own bar holds the switcher (Home, then each group, then Create a group); on a group list, the list's own bar holds the switcher, group details, and the invite button. The conversation screen hides the tab bar so the composer sits at the bottom, and its compact header's Back leaves it.
- **Desktop (1024px and up):** left rail with the same destinations plus the group list.
- **Home tab** opens Home. Groups are reached from the switcher or the rail.
- **Add** opens the log sheet over whatever screen you're on, and returns you there afterward.
- **Title detail** opens from any card and returns to the exact scroll position (DS 5.1).
- **Conversations** open from title detail, a card's comment count, Activity, or a mention email. Back from a conversation returns to wherever you came from.

### 6.3 URL state
Query parameters on list routes: `type` (`movie`, `tv`), `services` (comma list of provider ids), `genres` (comma list of TMDB genre names), `length` (`30`, `120`), `sort` (`newest`, `vouched`), `groups` (My list only: comma list of group ids, F5.3), `mine` (P1, `1` for "On my services"). All filter changes use `history.replaceState` for chip toggles within a session and push a new entry only when the segmented control changes, so Back feels natural rather than stepping through every chip tap.

### 6.4 Access rules
- Signed-out visitors to any signed-in route go to `/sign-in?next=<route>` and return there after signing in.
- A signed-in non-member visiting `/list/[groupId]` or `/groups/[groupId]` sees a 404-style "You're not in this group" state with a link to their list. It must not reveal the group's name or members.
- A signed-in person opening a good word's conversation they can't see, or `/people/[userId]` for someone who isn't their friend and shares no group, gets the same 404-style state, revealing nothing (F16.6, rule 4).
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
- The invite context (`Joining College crew`) persists through the whole sign-in flow and the user lands on that group's list afterward, already joined.

**Account deletion**
- In Settings, "Delete account" opens a dialog stating the consequences: all your good words and comments are removed everywhere, you leave every group, and this can't be undone. The danger button reads "Delete my account".
- Groups you own transfer to the longest-standing remaining member. Groups where you're the only member are deleted.
- Deletion completes immediately in the UI; backend purge of all personal data completes within 30 days (state this in the privacy page).

**Download my data**
- Settings › "Download my data" produces a JSON file with your profile, groups, and good words (title, note, groups, dates). Generated on demand, downloaded directly.

**Acceptance criteria**
- Given a new visitor, when they sign in with Google, then they reach `/welcome` with their name prefilled, and after continuing, land on the no-groups empty state.
- Given a user who requested a magic link, when they open it after 15 minutes, then they see the expired-link banner with a one-tap "Send a new link" prefilled with their email.
- Given an invitee who started from `/join/[code]`, when they finish signing in, then they are a member of that group and land on its list with the welcome banner.
- Given a user requests a 6th sign-in email within an hour, then they see "Too many sign-in links. Try again in a few minutes, or continue with Google."
- Given a group owner deletes their account, then ownership of each group transfers to the member with the earliest `joined_at`.

**Edge cases:** email typos (show the address on the check-email screen with "Use a different email"); Google account without a name (leave the field empty with focus); user already signed in visiting `/sign-in` (redirect to `/list`).

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
- `/join/[code]` follows DS 5.2. It shows the inviter's first name and avatar (the person who created the link, or the owner if unknown), the group name, member count, a one-sentence explanation, and **Join [group name]**. It does **not** show the list's contents before joining.
- Signed in and not a member: one tap joins and lands on the list with the welcome banner.
- Already a member: redirect to the list with the toast "You're already in College crew."
- Invalid or reset link: the expired-invite copy from DS 6.6 ("This invite link has expired. Ask Priya for a new one.", naming the group owner) plus a link to learn about Good Word. For a code that never existed, omit the name: "This invite link doesn't work. Ask whoever sent it for a new one."
- Group full, or the joiner already has 20 groups: explain which limit was hit.
- Joins are rate limited per IP and per code to prevent abuse.
- **Acceptance:** Given a valid code and a signed-out visitor, when they tap Join and complete sign-in, then they are a member, the owner receives the join email (F7.3), and the joiner sees the group's list.

#### F2.5 Group details (`/groups/[groupId]`)
Sections, in order: invite card; members list (avatar, name, "Owner" label, "You" label, joined date); group settings (owner only: rename, reset invite link); danger zone (leave group; owner: remove members via each member's menu, delete group).

#### F2.6 Leaving and removal
- **Leave:** dialog per DS 5.8. Your good words are removed from that group's list (they stay on My list and in your other groups). Your past comments in that group's conversations stay, attributed to you, so conversations still make sense (confirm, Section 15).
- **Owner leaving:** the dialog names who becomes owner (the longest-standing member). If the owner is the only member, leaving deletes the group, and the dialog says so.
- **Remove member (owner):** dialog naming the person. Their good words leave that list; their past comments stay attributed. They are not notified in the MVP, and they can rejoin only with a new or unreset link, so the dialog suggests resetting the link if needed.
- **Delete group (owner):** irreversible dialog stating the number of members and good words affected (DS 5.8). Members' good words stay on their own lists and other groups.

**Acceptance**
- Given a member leaves a group, then none of their good words appear on that group's list, and the title's vouched-by row on that list no longer includes them.
- Given an owner removes a member, then the removed member immediately loses access to the list and group details, and sees "You're not in this group" if they visit.

---

### F3. Title search (P0)

**Stories:** As a contributor, I can find the exact show or movie I mean in a few keystrokes.

**Rules**
- Search follows DS 4.2.4 and 5.5.
- Queries go to TMDB multi-search through the app's own server route (the TMDB key never reaches the browser). Only `movie` and `tv` results are shown; people are excluded; adult content excluded.
- Minimum 2 characters, 250ms debounce, cancel in-flight requests when the query changes.
- Results show poster, title, year, and "Film" or "Series", ordered by TMDB relevance.
- **Duplicate annotations:** "On your list" if you've already put in a good word; avatars and "Priya vouched for this" if people in your groups have.
- **Recent searches** (up to 5) show when the field is empty, stored on the device, clearable.
- Server responses are cached briefly (5 minutes per normalized query) to stay within TMDB limits.

**Acceptance**
- Given a user types "nigh", then results appear within 1 second on a normal connection, showing only movies and shows.
- Given a title already vouched for by the user, then its row shows "On your list".
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
- **Audience** (F16.2): **Friends** on and groups off by default. The visibility line (DS 4.2.6) shows the audience and opens the picker. A good word may be shared with nobody ("Only you, for now"), in which case it lives only on My list. This keeps Good Word useful before friends join.
- **One card per title per group.** When several members vouch for the same title, the list shows one card with a growing vouched-by row and their notes (most recent note on the grid card, all notes on detail).
- **Take it back** removes the good word from all groups immediately with an 8-second Undo toast (DS 5.11). Undo restores the note and groups exactly.
- **Edits** to the note or groups are saved immediately, optimistically, with no "edited" label.
- **Source tracking:** each good word records how the user arrived (Section 11.3): `organic`, `digest`, `nudge_email`, `join_prompt`, `share`.
- **Milestones** (DS 4.1.20): first good word ever, and the 10th, show the milestone moment once.
- **Rate limit:** 100 good words per user per hour, to stop scripts, with a friendly message.

**Entry points:** the Add tab, the rail's Add button, the `n` shortcut on desktop, the vouch button on any title detail or search row, the first-good-word prompt, and empty-state actions.

**Acceptance**
- Given a user with friends and 2 groups, when they put in a good word without changing anything, then it's on My list and their friends' Home, on neither group list, and the toast reads "Your friends can see this."
- Given a user with no friends and no groups, when they put in a good word, then the visibility line reads "Your friends, once you add some" and the toast reads "On your list. Invite friends to share it." with an Invite action.
- Given a friend already vouched for the title in a shared group, when the user adds theirs, then the list shows one card with both people in the vouched-by row.
- Given a user taps Undo within 8 seconds of taking a good word back, then it's restored to every group it was in, with its note.
- Given the network fails on submit, then the card reverts and a toast offers Retry, and the note is not lost.
- Instrumented time from Add tap to confirmation is recorded (Section 11).

---

### F5. Lists (P0)

Group lists and My list share one layout: a grid of rec cards (DS 4.2.2) with the filter bar (DS 5.6). Home (F16.3) uses the same filters with its own `home` card.

#### F5.1 Group list (`/list/[groupId]`)
- Page title is the group name (`title-l`), with member avatars and count beneath, linking to group details.
- Shows every title vouched for by any member into that group, one card per title.

#### F5.2 All groups (replaced by Home)
- All groups is replaced by Home (F16.3), which shows every group's good words plus your friends'. `/list/all` redirects to `/home`. Until the flip (F16.10), All groups works as before for accounts without `home_enabled`.
- Group chips on the detail screen show which of **your** groups each good word is in.

#### F5.3 My list (the My list tab, `/you`)
- A main navigation destination, labeled **My list** in the tab bar and rail. The page is titled "My list". Below your good words: your groups, then links to Settings and Help. Shows only your own good words, including ones with zero groups.
- Each card shows group chips for where it's shared, or "Only you".
- A group filter lets you see what you've shared into a specific group.

#### F5.4 Sorting and filtering
- **Sort:** Newest (default, by the most recent good word on that card) and Most vouched (by number of people, ties broken by newest).
- **Type:** segmented control All / Movies / Shows.
- **Streaming services:** up to five chips for the services most common on the current list in the user's region, with counts, then "More filters". A service counts when the title is included with a subscription, free, or free with ads (TMDB's `flatrate`, `free`, and `ads`); rent and buy don't. Counts show how many cards each chip would leave, given the other filters. A title whose providers haven't been fetched yet matches no service.
- **More filters sheet:** services (all), genres (TMDB genres present on the list), length (Any, Under 30 minutes, Under 2 hours), and, if P1 is built, "On my services".
- **Length** uses movie runtime, or typical episode runtime for shows. Titles with unknown runtime are excluded when a length filter is on, and the empty state says so.
- **Filter logic:** AND across categories, OR within a category (DS 5.6). Active filters are always visible with a result count and a single Clear.
- **Paging:** 24 cards per page, infinite scroll with a "Load more" fallback and an end-of-list footer (DS 5.6).

#### F5.5 New since your last visit
- Each membership stores when you last viewed that list. Cards whose most recent good word from **someone else** is newer than that show a **New** badge (DS 4.1.11). Before your first visit, "last viewed" is when you joined, so good words from before you joined aren't New.
- The group switcher shows a count of new good words per group, and the switcher's button on Home shows a dot if any group has new ones.
- "Last viewed" updates when you leave the list or after 10 seconds on it, not on arrival, so badges don't vanish before you see them. Home keeps its own last visit (F16.3) and doesn't clear group counts.

#### F5.6 Live updates (P1)
- While you're viewing a list, new good words from others don't insert themselves (content never jumps). A pill appears at the top: "2 new good words". Tapping it scrolls to top and inserts them. Your own good words insert immediately.

#### F5.7 States (DS 5.12)
| State | Group list | Home (until the flip: All groups) | My list |
|---|---|---|---|
| Empty, first use | "Nothing here yet. Be the first to put in a good word." + Put in a good word + Invite friends | Per F16.3 states | DS 6.6 empty personal list copy + Put in a good word |
| No results | "Nobody's vouched for a Netflix movie yet." + Clear filters | Same | "You haven't vouched for anything like that." + Clear filters |
| Loading | 6 skeleton cards | Same | Same |
| Error | Error state + Retry | Same | Same |
| Offline | Cached content + offline banner (P0: banner and last-loaded content in memory; P1: persisted cache) | Same | Same |

**First-good-word prompt:** on a group list, for a member with no good words in that group, show an inline card after the first scroll to the end or after 20 seconds: "What's something you'd tell these folks to watch?" with **Put in a good word**. Dismissible; doesn't return for that group once dismissed or used.

**Acceptance**
- Given a user in 2 groups where the same title was vouched for in both, then Home shows one card whose vouched-by row lists each person once.
- Given filters Movies + Netflix + Hulu, then results include movies available on Netflix or Hulu in the user's region, and the URL reflects all three.
- Given a new good word by a friend since the user's last visit, then its card shows New and the group switcher shows a count.
- Given a list of 60 good words, then the first 24 load, more load on scroll, and "That's the whole list." shows at the end.

---

### F6. Title detail (P0)

**Route:** `/title/[type]/[tmdbId]`. Layout and content order per DS 4.2.2 (`detail`) and DS 5.7. **F16.4 sets what this page shows and in what order;** the rules below still apply where F16.4 doesn't change them.

**Content, in order**
1. Poster, title (`h1`), meta line ("Series · 2024 · 3 seasons" or "Film · 2023 · 1h 52m"), genres as text.
2. **Good words:** every good word you can see (F16.6), each with avatar, name, note, when, and the chips of the groups (yours only) it's shared in. Your own good word is listed first as "You" with an Edit menu.
3. **Where to watch** for the user's region, grouped Stream / Rent / Buy, with provider logos and names, each linking out to the provider (via TMDB's watch link). JustWatch attribution beneath (Section 9.2). If nothing: "Not streaming in your region right now."
4. **Vouch button** (`lg`, DS 4.2.3).
5. **Conversation preview** for the current group (F13), per DS 5.17: "Talk about it in College crew", the 3 most recent comments, "See all N comments", and "Add a comment…". Any title can have a conversation in any of your groups, so if you're in several groups, a chip row of all of them switches between their conversations. The default is the group in `?group=`, then the group with the most recent comment, then a group whose list the title is on, then your most recently joined group. Hidden only when you're in no groups.
6. Overview, collapsed to 3 lines with More.

**Rules**
- The detail screen is reachable for any title (for example, from search), even with no good words you can see. In that case, section 2 is the **Put in a good word** prompt (F16.4).
- Never show people, groups, or counts the viewer can't see (F16.6, rule 4).
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
- **Only sent if there's something new:** at least one good word from someone else that you can see (F16.6) in the past 7 days: a friend's, or one in your groups. Never send an empty digest.
- Subject: "This week on Good Word: 5 new good words" (singular for 1).
- Body: what Home shows (F16.9): up to 8 titles from your friends and groups, newest first, each once (poster, title, who vouched, note, and the group chip when that's how it reached you), import roll-ups as one line each, then "See all N on Home". A single primary button: "Open Good Word".
- Every title links to its detail page with a `ref=digest` parameter so good words created in that session record source `digest`.
- Footer: why you got it, a one-click unsubscribe from digests, and a link to notification settings.

#### F7.2 Weekend prompt (P1)
- For members who haven't put in a good word in 14 days and have at least one group, send on Sunday at 10am local: subject "What did you watch this weekend?", body with one button "Put in a good word" that opens the Add sheet (`ref=nudge_email`).
- At most once every 14 days. Never guilt-tripping (DS 6.3). Default on, easy to turn off.

#### F7.3 Someone joined your group (P0)
- To the group owner, when someone joins: "Jonah joined College crew." Batched to at most one email per day per owner. Default on.

#### F7.4 Mention emails (P0)
- When someone mentions you (F13), send one email per conversation, batched over 15 minutes (in practice: sent once the first unsent mention is 10 minutes old, by a job that runs every 5 minutes, so it always arrives within 15): subject "Priya mentioned you on The Night Ferry" (or "Priya and Jonah mentioned you…" if several). Body: poster, group name, the comment(s) mentioning you (or "a spoiler comment"), and one button, "Open the conversation", deep-linking to the first mentioning comment.
- Don't send if you've already opened that comment in the app, or if the comment was deleted before sending.
- Default on; one-click unsubscribe from mention emails.

#### F7.5 Conversation summary in the digest (P0)
- The weekly digest adds a short section per group: "12 new comments on 3 titles", listing the titles with the most comments and linking to their conversations. Spoiler text never appears.

#### F7.6 Transactional email (P0)
- Magic sign-in link. Not affected by preferences.

#### F7.7 Preferences (P0)
- In Settings › Notifications: switches for Weekly digest, Mentions (email), Someone joined your group, and (P1) Weekend prompt. Each takes effect immediately (DS 5.16). Activity items are always recorded in-app regardless of email settings.
- A global cap: at most one non-transactional email per day per user; quiet hours 9pm to 9am local. **Mention emails are exempt from the daily cap** (DS 5.13) but respect quiet hours: a mention during quiet hours sends at 9am.
- Unsubscribe links work without signing in (signed token), confirm on a simple page (`/unsubscribe`), and offer undo. The page applies the change as it loads, so it's one tap; mail scanners that only fetch the link change nothing. Mail apps' own unsubscribe button uses RFC 8058 one-click (9.4).
- When the daily cap would hold both, the digest goes first; join emails wait for the next day. A digest held by quiet hours or the cap goes out within 24 hours of its slot, or not at all that week.
- Email is never sent to reserved test domains (`example.com`, `.test`, and similar), so test accounts can't hurt the sending domain.

**Acceptance**
- Given no new good words from others in a user's groups this week, then no digest is sent.
- Given a user clicks a title in the digest and then puts in a good word, then that good word's source is `digest`.
- Given a user taps unsubscribe in a digest, then digests stop without requiring sign-in, and the setting shows off.

---

### F8. Person view (P1)

- Tapping a person's name or avatar anywhere opens `/people/[userId]`: their name, the groups you share, and **the good words of theirs you can see** (F16.6), with the standard filters. No counts and no bio (decision 8).
- Serves the "I trust her taste in film" use case. Never shows their other groups or good words you can't see.
- Visiting someone who isn't your friend and shares no group with you shows the 404-style state (6.4).

---

### F9. Share my list (P1)

- In Settings, "Share my list" is **off by default**. Turning it on creates a link `/s/[token]` and shows Copy and Share.
- The shared page is read-only and shows the owner's display name, their good words (poster, title, year, their own note only), newest first, and a small "Made with Good Word" link to the marketing page. It never shows groups, other people, or other people's notes.
- Toggle off or **Reset link** invalidates the old link immediately.
- The page sends `noindex` and carries no analytics beyond a view count visible to the owner.
- **Design system impact:** DS 5.14 now reads "Nothing is public unless you turn on a share link" (open question 2, decided 2026-09-30).

---

### F10. Onboarding, empty states, and first run (P0)
- **No tutorials, carousels, or taste quizzes** (DS 5.2). Teach through the invite landing, empty states, the welcome banner, and the first-good-word prompt.
- **New user with no invite** lands on Home's empty state (F16.3): their friend link and "Start your own list" with **Put in a good word**, plus "Got an invite link? Open it to join." Starting a group stays in the switcher.
- **Welcome banner** on first arrival to a group's list after joining: "You're in. Here's what College crew vouches for." Dismissible; shown once per group.
- **Milestones** per F4.

---

### F11. Help, settings, and about (P0)

**Settings (`/you/settings`)**, grouped:
- **Account:** display name, email (read-only), region, sign out.
- **Notifications:** per F7.7.
- **Streaming services (P1):** pick the services you have; enables the "On my services" filter.
- **Share my list (P1):** per F9.
- **Your data:** download my data, delete account.

**Help (`/you/help`)** — in the same place on every screen (DS 5.16):
- A short FAQ: what's a good word, who can see my good words, how groups and invites work, how to leave a group, how to delete my account.
- Keyboard shortcuts (desktop).
- **Send feedback:** a short form (message plus optional "OK to follow up by email") stored in the database and emailed to Sydney.
- **About:** version, privacy and terms links, the privacy summary, and the required TMDB and JustWatch attributions (Section 9).

---

### F12. Installable app and offline (P1)
- Web app manifest, icons, and standalone display (DS 8.3). On iOS Safari, a one-time, dismissible tip in You after the user's third visit: "Add Good Word to your Home Screen for one-tap access." Never on first visit.
- Service worker caches the app shell and the last viewed lists.
- Good words created offline are queued, captioned "Sending when you're back online", and sent on reconnect (DS 5.12). If sending fails permanently, the item shows an error with Retry and Remove.
- P0 baseline without F12: an offline banner, previously loaded content stays on screen, and write actions show a toast explaining they need a connection, while keeping the user's input.

### F13. Conversations and mentions (P0)

Interaction and visual details are in DS 4.2.10 to 4.2.12 and DS 5.17. These are the product rules.

**Stories**
- As a member, I can comment on any show or movie in my group, and see everyone else's comments in that group.
- As a member, I can mention someone in the group with @ so they know I'm talking to them.
- As a member, I can mark a comment as a spoiler so friends who haven't finished aren't spoiled.
- As a member, I can edit or delete what I said.

**Rules**
- **Scope:** a group conversation belongs to one title in one group. Conversations under a good word follow F16.5; everything in F13 applies to both kinds unless F16.5 says otherwise. Any title can have one, whether or not it's on that group's list (open question 11). The same title can have separate conversations in each group, and no group can see another group's conversation or learn whether one exists.
- **Starting a conversation:** the first comment in a group's conversation about a title gives every other member of that group an Activity item ("Tess started a conversation about The Night Ferry in College crew"), so a conversation on a title that isn't on the list can still be found. Later comments notify participants only.
- **Who can take part:** current members of the group. Comments are visible to every current member.
- **Structure:** flat and chronological (oldest first), no nested replies. Replying is done by mentioning.
- **Comment:** 1 to 500 characters, plain text. Line breaks are kept. URLs are shown as text, not links, in the MVP.
- **Mentions:** only members of that group (in a conversation under a good word, only people who can see it, F16.5), chosen from the autocomplete (DS 4.2.11). Stored by user id. Up to 10 mentions per comment. You can't mention yourself.
- **Spoilers:** the author can mark a comment as a spoiler when writing or editing. Spoiler text is never rendered for others until they tap to reveal, and never appears in previews, Activity, or email (DS 4.2.12).
- **Edit:** the author can edit anytime; the comment shows "edited". Newly added mentions notify; existing ones don't re-notify.
- **Delete:** the author, or the group owner, can delete. Deletion is immediate with an 8-second Undo, then permanent. Deleting retracts related unread Activity items and unsent mention emails.
- **Participants:** you become a participant in a title's conversation in a group when you comment there or put in a good word for that title in that group. Participants get Activity items for new comments (not emails).
- **People who leave:** comments from people who leave or are removed stay visible and attributed to them, so conversations still make sense (open question 10). They're deleted only if that person deletes their account.
- **Unseen tracking:** per person, per conversation. Opening the conversation marks comments as seen up to the bottom of what was shown.
- **Live updates:** while a conversation is open, new comments arrive in real time (DS 5.17). The list's comment counts update on the next load.
- **Moderation:** owners can delete any comment in their group. No reporting in the MVP.

**Acceptance criteria**
- Given a title on the lists of College crew and The girls, when Priya comments in College crew, then members of College crew see it, and members of The girls who aren't in College crew cannot see it, reach it by URL, or see a comment count for it.
- Given Tess types "@" in College crew's conversation, then the suggestions list only College crew members other than Tess.
- Given Tess mentions Priya, then within seconds Priya's bell shows an unread count and Activity shows "Tess mentioned you on The Night Ferry in College crew", and within 15 minutes (outside quiet hours) Priya receives one mention email.
- Given a comment marked as a spoiler, then for everyone except its author the text is absent from the page source, accessibility tree, Activity, and emails until "Tap to reveal" is pressed.
- Given the author deletes a comment and doesn't undo, then it's gone for everyone, and any unread Activity items it caused are removed.
- Given Jonah is removed from College crew, then he can no longer open or receive activity for its conversations, and his earlier comments remain attributed to him.
- Given two people have the conversation open, when one sends a comment, then it appears for the other within 2 seconds without a refresh, and without moving their scroll position if they've scrolled up.
- Given the network drops while sending, then the comment shows "Didn't send." with Retry and Delete, and the text isn't lost.

**Edge cases:** a mentioned member leaves before the email sends (don't send); a title leaves the list because its last good word was taken back (nothing changes: the conversation stays on title detail and in Activity, and comments continue); very long unbroken strings (wrap with `overflow-wrap: anywhere`).

### F14. Activity (P0)

**Stories:** As a member, I can see in one place when someone mentioned me, replied in a conversation I'm part of, or joined a group I own, and jump straight there.

**Rules**
- Route `/activity`, opened from the bell in the top bar (and rail on desktop). The bell shows the unread count (DS 4.1.11).
- Item types: `mention`, `comment` (in conversations you're part of, including under your good words, excluding your own), `friend_request` and `friend_accepted` (F16.9), `conversation_started` (the first comment in a conversation in one of your groups, F13), `group_join` (owners only). Comment items for the same conversation within an hour collapse into one ("Jonah and Tess commented on The Night Ferry").
- Each item deep-links to the exact comment (or group, for joins). Opening an item marks it read; "Mark all as read" marks everything read.
- Items are kept for 90 days.
- Activity respects group membership and friendship: leaving a group, or losing sight of a good word, removes the items that came from it.
- Layout, grouping (Today, This week, Earlier), and states follow DS 4.2.13 and DS 5.17.

**Acceptance criteria**
- Given three unread items, when the user opens one, then the bell count drops to 2 and they land on the right comment, highlighted.
- Given a comment that mentions you is deleted before you open Activity, then its item is gone.
- Given the user leaves a group, then its Activity items disappear.

### F15. Build your list: add recs in bulk (P1)

People's recs already live somewhere else: phone notes, Letterboxd, their heads. Typing them in one at a time kills momentum. Add recs lets someone dump what they have, in whatever form, and confirm clean, matched titles one card at a time. Source: "Good Word PRD: Build Your Recs List" (2026-09-30).

**Words.** A **rec** is one of your own good words, seen as your collection. The tab was My shelf, then **My Recs** (v1.3.0), and is now **My list** (v1.4.0, DS 1.4). "Recs" stays in import copy. In a group it's a good word on that group's list.

#### F15.1 Add recs (`/you/import`)
- One screen with a large text box (label "List everything you'd recommend", helper tip below it, never placeholder-only) and an **Add screenshots** control. Search stays one tap away (the Add sheet).
- **Type, paste, or dictate.** Device dictation is the voice path; we build no audio recording. The tip reads, on phones, "Tip: tap the mic on your keyboard and just start listing shows." and on desktop, "Tip: use your computer's dictation (Mac: Edit > Start Dictation, Windows: Win + H)."
- **Letterboxd screenshots.** Up to 5 images (grid, list, or diary views) through the native photo picker, multiple at once. Desktop also takes drag and drop and paste (Cmd/Ctrl + V). Images are shrunk in the browser (longest side 1568px, JPEG) before upload, read once, and never stored.
- **Who sees them.** One visibility line applies to the whole import, with the same default as a single good word: Friends on, groups off (F16.2). Imported good words reach friends as one roll-up line on Home, not a card each (F16.3).
- **Find my titles** is disabled until there's text or a screenshot. iOS Safari can't receive the share sheet into a web app, so on iPhone the path from Notes is copy and paste.

#### F15.2 Parsing
- **Text that's already one title per line** is searched on TMDB directly. Only lines that don't match cleanly, and free-form text, go to the AI model. Bullets, numbering, emoji, and commentary are ignored; a reaction said alongside a title ("Severance, so good") becomes that rec's note.
- **One AI call per import**, returning compact JSON (title, year guess, type guess, note, confidence) for text and screenshots together. The model is Claude Haiku 4.5, with no escalation to a larger model in v1. Its fixed instructions are prompt-cached.
- **TMDB confirms every title** and supplies the poster, year, type, and up to 3 alternatives. A match is **high confidence** when the model was confident and TMDB's title matches exactly (and the year, when one was given). Confirmed matches are cached in a shared table, and each import's input is hashed so re-sending the same input doesn't call the AI again.
- **Duplicates** of titles already on your list, and repeats within the import, are dropped and counted.
- **Progress** streams as titles are found ("Found 14 so far"), with Cancel.

#### F15.3 Review deck (`/you/import/[importId]`)
- Nothing lands until it's confirmed. One card at a time: poster, title, year, and type, with "3 of 14" at the top.
- **Add** puts in the good word (source `import`) into the import's groups. **Edit** shows the next 2 to 3 likely matches, plus search. **Skip** leaves it out. Each action shows a brief toast with Undo, and **Back** revisits the previous card.
- **Low-confidence** cards open with the alternatives already visible.
- **Note:** a one-line "why I recommend it" on any card (140 characters), prefilled from the input.
- **Add all remaining** adds every remaining high-confidence card.
- **Phones:** Add, Edit, and Skip sit in a bar at the bottom, at least 44px tall with space between, and the bar stays visible when the keyboard opens. Swiping the card right adds and left skips; swipe is a shortcut, never the only way.
- **Desktop:** keyboard shortcuts A (add), E (edit), S (skip), and ← (back), shown as hints on the buttons, never while typing in a field. The alternatives sit beside the card, so Edit doesn't open a new view.
- **Resume:** unreviewed cards are saved (private to you, never on a list), and My list offers to finish them.
- **Done:** "Your recs are in", then "Added 11 recs. 2 were already in My list." with **View My list** and **Add more**.

#### F15.4 Limits and cost
- Per import: 5 screenshots, 5,000 characters, and the first 100 titles found. No daily limit per person (removed by Sydney, v1.3.2); spend is capped in the Anthropic console. The existing limit of 100 good words an hour still applies.
- The API keys stay server-side; only signed-in people can start an import. Sydney sets a monthly spend cap and usage alerts in the Anthropic console.
- Posters load from TMDB's image CDN at small sizes; nothing is copied.

#### F15.5 States (DS 5.12)
- **Empty:** the input screen. **Loading:** "Found N so far" with Cancel. **No results:** "We couldn't find titles in that" with Try again and Search instead. **Error:** "Good Word is having a moment. Try again in a minute." (the input is kept). **Offline:** "You're offline. Finding titles needs a connection." (the input is kept).

**Acceptance criteria**
- Given a pasted list of 12 titles one per line that all match TMDB exactly, when the user taps Find my titles, then no AI call is made and 12 cards appear.
- Given "Severance, so good" in the input, then its card is Severance (TV) with the note "so good" prefilled.
- Given a title already on the user's list, then it gets no card and the done screen counts it.
- Given the user taps Add, then Undo within the toast, then the good word is gone from every list and the card is back.
- Given the user leaves after 5 of 14 cards, when they open My list, then they can resume at card 6.
- Given the same text is submitted twice, then the second import makes no AI call.
- No uploaded image is stored, and no AI or TMDB key reaches the browser.

### F16. Home and friends (P0)

Good Word opens to **Home**: one place, newest first, with every good word your friends have put in. Friends are a direct, mutual relationship. Groups stay as they are, one tap away in the switcher, as a second audience. Source: Sydney's "Good Word: Feed-first UX" (2026-10-06). Built in slices 12 to 21, behind the `home_enabled` flag until slice 20 (F16.10).

**What changes**
- **Home is the front door.** The app opens to Home instead of a group's list. Home replaces All groups.
- **Friends are a direct relationship.** Today you only see someone through a shared group. You'll have friends of your own, always mutual.
- **A title is one shared page.** The Night Ferry has one page for everyone, and each person sees their own friends' good words and conversations on it.
- **Conversations can sit under a good word.** Anyone who can see Jonah's good word can see what's said under it.

**What stays**
- Groups, group invites, group lists, and group conversations work as they do now (F2, F5.1, F13).
- One good word per person per title, with a note of up to 140 characters.
- Humans only, newest first, no likes, no followers, no public profiles.

**Concepts**

| Concept | What it is | Status |
|---|---|---|
| Title | One movie or show, shared by everyone (one row per TMDB id) | Exists (`titles`) |
| Good word | One person vouching for one title, with a note | Exists (`good_words`) |
| Friend | Two people who have accepted each other. Always mutual | New (`friendships`) |
| Audience | Who a good word is shared with: your friends, any of your groups, or only you | Extended: friends is new |
| Conversation | Comments under a good word, or on a title in a group | Extended: the group kind exists |
| Group | A private circle with its own list and conversations | Unchanged |
| Home | Every good word you're allowed to see, newest first | New view over existing data |

#### F16.1 Friends
**Stories**
- As a person, I can send someone my friend link, and once they accept, we see each other's friends-shared good words.
- As a group member, I can add people from my groups as friends, without joining a group making anyone my friend.
- As a person, I can see my friends and pending requests, and remove a friend.

**Rules**
- **Always mutual.** A friendship is a request that becomes a friendship when the other person accepts. There's no one-way following, and no counts are shown to anyone.
- **Friend link.** Each person has one personal invite link, `/join/[code]` (the same route as group invites, F2.3, with at least 128 bits of entropy). The landing shows the inviter's name and avatar, a one-sentence explanation, and **Add Priya as a friend**. It never shows their good words before accepting. Accepting makes you friends both ways at once; signed-out visitors go through sign-in with the context kept, as in F2.4. **Reset link** invalidates the old one immediately. An expired or reset link shows "This invite link has expired. Ask Priya for a new one."
- **Friends screen** (`/you/friends`, reached from My list): your friend link (invite card, DS 4.2.7), requests to you (Accept, Decline), requests you sent (Cancel), "People from your groups" you aren't friends with yet (Add), then your friends, each with a menu holding **Remove friend**.
- **Requests from groups.** Add on someone from your groups sends a request. They get an Activity item (F16.9); accepting gives you one back.
- **Declining works like Instagram's** (open question 13): it's silent. The requester isn't notified; on their side the request simply stops showing as Requested, and the person goes back to having an **Add** button. They can ask again at any time. Cancelling a request you sent works the same way for the other person.
- **No limits** on the number of friends or friend requests (open question 15).
- **After joining a group,** one dismissible prompt offers "Add the people here you're not friends with yet." Joining never makes anyone friends on its own.
- **Removing a friend** uses a confirm dialog (DS 5.11). Neither person is notified. Access ends both ways on the next load (F16.6).
- **No discovery.** No people search, no public profiles, no "people you may know" beyond your own groups.
- **Account deletion** removes the person's friendships. **Download my data** adds the names of your friends.

**Acceptance**
- Given Priya shares her friend link and Jonah opens it signed out, when he signs in and taps **Add Priya as a friend**, then they're friends both ways and he lands on Home.
- Given Priya resets her friend link, when someone opens the old one, then they see the expired-link copy and no friendship is made.
- Given Tess and Mo share College crew, when Tess taps Add next to Mo, then Mo gets an Activity item, and when he accepts, both are friends and Tess gets an Activity item.
- Given Bea shares no group with Luis and has no link from him, then nothing in the app lets her find or request him.
- Given Mo declines Tess's request, then Tess isn't notified, Mo no longer shows as Requested on her Friends screen, his row offers Add again, and a new request from her reaches him as before.
- Given Priya removes Jonah, then neither is notified, and on the next load neither sees the other's friends-shared good words or the conversations under them.

#### F16.2 Audience
- **Choosing who sees it** happens on the confirm sheet (DS 5.4), in the same step as the note. **Friends** is on by default; your groups are listed under it as toggles, off by default. Turning everything off keeps the good word on My list only.
- The visibility line (DS 4.2.6) states the audience before you share, and the success toast names it: "Your friends and College crew can see this."
- **Change it later** from the vouch menu (Edit note, **Change who sees it**, Take it back) on title detail or My list.
- **Narrowing** an audience hides the good word, and the conversation under it, from everyone who lost access. Nothing is deleted, and widening again restores both.
- **Imports** (F15) use the same audience step once for the whole import, with the same default.
- Sharing with friends is recorded as a time (`friends_shared_at`), the way sharing into a group is (`good_word_groups.shared_at`). Home orders by these times.

**Acceptance**
- Given a person with friends and two groups, when they put in a good word without changing anything, then their friends can see it and neither group's list shows it.
- Given they turn off Friends and every group, then the visibility line reads "Only you, for now" and the good word is only on My list.
- Given Jonah narrows a good word from friends to College crew only, then Priya (his friend, not in College crew) no longer sees it or its conversation on the next load, and widening it again brings both back.

#### F16.3 Home (`/home`)
Home answers one question the moment the app opens: what are my friends watching?

- **What's on it.** Every title with at least one good word from someone else that you can see (F16.6): friends' friends-shared good words, and good words shared into your groups. Titles only you vouched for live on My list.
- **One card per title.** If Jonah and Tess both vouch for The Night Ferry, that's one card with both names. You're named on it too when you've vouched.
- **Newest first.** A newly visible good word moves its title to the top. Comments never reorder anything; they show as an unseen dot on the card.
- **No ranking.** Nothing is sorted by engagement, and Home has no sort control. No suggested titles or suggested people, ever.
- **It ends.** Cards new since your last visit come first, then a "You're all caught up" marker. Older cards load 24 at a time on a tap ("Show earlier good words"), never automatically, so there's no endless scrolling.
- **Last visit** is stored per person and updates the way F5.5 does: when you leave Home, or after 10 seconds on it.
- **Imports stay quiet.** Good words with source `import` don't make or move cards on their own. Friends see one line per import instead: "Luis added 40 titles to their list", counting only the good words that viewer can see, linking to Luis's person view (F8). If another person vouches for one of those titles, the card appears as usual and lists Luis too.
- **Group chip.** A card shows the group's chip only when its good words reached you through a group and not through friendship.
- **Filters.** The filter bar's type, services, genres, and length filters (F5.4) work on Home as on a list, and their state lives in the URL. The caught-up marker stays between new and older cards.
- **Live updates.** The "N new good words" pill (F5.6) works on Home for good words you can see.

**The card** (DS 4.2.2, `home` variant) leads with the friend's words, not the poster:
- **Who:** the people who vouched, newest first: "Jonah", "Jonah and Tess", "Jonah, Tess and 2 more". You're named when you've vouched too.
- **Note:** the newest voucher's note in full, exactly as typed, never truncated. With several notes, "See all 3 good words" opens title detail.
- **Title:** poster, title, type, and year. Tapping opens title detail.
- **Conversation:** comment count and one line of the latest comment (F16.5). A spoiler comment never previews. With no comments, a quiet "Say something", not a zero.
- **Actions:** Comment, **Vouch too** (opens the confirm sheet with the title chosen; reads "Your good word" once you've vouched), and Where to watch.
- **Not on the card:** hearts, likes, view counts, double-tap, or any button that shares outside Good Word.

**States** (DS 5.12)

| State | Home |
|---|---|
| Empty, no friends and no groups | Your friend link and "Start your own list" with **Put in a good word** |
| Friends or groups, nothing from anyone yet | "Nothing from your friends yet." with your friend link |
| Nothing new | The caught-up marker, **Put in a good word**, and "Show earlier good words" |
| No results | "Nobody's vouched for a Netflix movie yet." + Clear filters |
| Loading | 4 skeleton cards |
| Error | Error state + Retry |
| Offline | The offline banner, with loaded cards kept on screen |

**Acceptance**
- Given Jonah and Tess both shared The Night Ferry with friends, when their friend Priya opens Home, then she sees one card naming both, with Tess's note if hers is newer.
- Given a new comment on an older title, then its card doesn't move, and it shows an unseen dot.
- Given Luis imports 40 titles shared with friends, then his friends' Home shows one line, "Luis added 40 titles to their list", and no card for each.
- Given 3 cards are new since Priya's last visit, then they come first, then "You're all caught up", and older cards appear only when she taps "Show earlier good words".
- Given Jonah shared a good word only with College crew, when Priya (his friend, not in College crew) opens Home, then it isn't there; and for Tess (in College crew, not his friend) it's there with the College crew chip.

#### F16.4 Title page (`/title/[type]/[tmdbId]`)
Every title has one page at one URL, whoever opens it. What appears on it depends on who's looking. This replaces F6's content order.

1. **Header:** poster, title, meta, genres, and where to watch, as F6.
2. **Good words from your people:** every good word you can see, newest first: who, their note, when. Yours sits first; if you don't have one, a **Put in a good word** prompt takes its place.
3. **A conversation under each good word** (F16.5), collapsed to its count and latest comment; it opens in place.
4. **Group conversations:** each of your groups gets its own labeled section ("In College crew"), with the chip row and default as F6 and F13. Unchanged.
5. Overview.

- The composer always says who will see a comment before you type: "College crew will see this", or "Everyone who can see Jonah's good word will see this". It never names a group or count the viewer can't see (rule 4), which is why it doesn't say "Jonah's friends" when the good word also went to groups.
- Anyone signed in can open any title's page. It shows only what passes F16.6, with no count or hint of anything else.

**Acceptance:** see F16.6.

#### F16.5 Conversations under a good word
- **Scope.** A conversation sits under one good word, or on one title in one group (F13). Each good word has at most one conversation under it.
- **Audience.** Everyone who can see the good word can read and join its conversation, including a friend of the author whom you aren't friends with (decision 3). The composer says so ("Everyone who can see Jonah's good word will see this").
- **Why per good word.** A comment needs one clear audience. "Everyone who can see Jonah's good word" is one audience; a title-wide conversation would have a different audience for every reader.
- **Mentions** in a good word's conversation are limited to people who can see that good word. The suggestions show only those you already know (your friends, people in your groups, and people who've commented there), so they never reveal the author's friends.
- **Everything else is F13:** flat and chronological, 500 characters, spoilers, edit, delete with Undo, live updates, participants, and unseen tracking (now per person per conversation).
- **Group conversations** stay private to their group. A comment made in College crew never appears under a good word.
- **Only good words shared with friends have a conversation under them** (open question 14). A good word shared only into groups is talked about in each group's conversation, as before. If its author stops sharing it with friends, its conversation is hidden, not deleted, and comes back if they share it again.
- **Deleting.** Comment authors can delete their own comments; the good word's author can also delete any comment under it (open question 16), the way a group owner can in a group conversation.

#### F16.6 Who sees what
Three rules decide everything a person can see. A fourth says nothing else leaks.

1. **Good words.** You see a good word if it's yours, or its author is your friend and shared it with friends, or it's shared into a group you're in.
2. **Conversations.** You see a conversation if you can see what it sits under: the good word, or the group.
3. **Title pages.** Any signed-in person can open a title's page. It shows only the good words and conversations that pass rules 1 and 2.
4. **No leaks.** Nothing hints at what you can't see: no counts, no names, no "2 more from people you don't know". Not on the page, by URL, or through the API.

Bea opens the same The Night Ferry page Priya does and finds her own friends on it. Mo is the in-between case: he's Jonah's friend and not Priya's, so he sees Jonah's good word and everything under it, including Priya's comment there.

**Edge rules**
- Removing a friend, or leaving a group, removes access both ways on the next load. Comments already written stay attributed, as they do when someone leaves a group.
- Narrowing a good word's audience hides it and its conversation from everyone who lost access. Nothing is deleted.
- Spoiler handling doesn't change.

**Acceptance** (each one is also a row-level security test, by page, by URL, and by API)
- Given Priya, Jonah, and Tess are all friends and each shared a good word for The Night Ferry with friends, when any of them opens it, then they see all three good words and the conversation under each.
- Given Bea shared a good word for The Night Ferry and is friends with none of them, when she opens it, then she sees only her own, with no count or hint of the others, and can't reach theirs by URL or API.
- Given Mo is friends with Jonah only, when Mo opens The Night Ferry, then he sees Jonah's good word and every comment under it, including Priya's, and neither Priya's nor Tess's good word.
- Given Jonah shared a good word only with College crew, when Priya (his friend, not in College crew) opens Home, then it isn't there.
- Given Priya removes Jonah as a friend, then on the next load neither sees the other's friends-shared good words or the conversations under them.
- Given Luis imports 40 titles, then his friends' Home shows one roll-up line and no individual cards.

#### F16.7 Groups
Groups keep everything they have and move one level down in the app.
- **A group is an audience, not a place you have to be.** You put in a good word once and choose who sees it; groups are choices on that step.
- **Group lists are unchanged:** each still has its own list, filters, invite, and New counts (F5.1, F5.5).
- **Group conversations are unchanged** and private to the group (F13).
- **Group good words show on Home** for members, with the group chip when that's how they reached you.
- **Joining a group doesn't make anyone friends** (F16.1).

The case for keeping groups is the one on the marketing page: different friends, different taste. Home is everyone; a group is the film nerds.

#### F16.8 Navigation
- **Tab bar:** Home · Add (center) · My list. The Activity bell stays in the header (6.2).
- **Home's bar** holds the switcher: Home first, then each group (with its New count), then Create a group. Picking a group opens its list as today. All groups is gone; `/list/all` redirects to `/home`.
- **Default route:** signed in, `/` and `/list` go to Home, and so does finishing sign-in without an invite.
- **Desktop rail:** Put in a good word, Home, Activity, My list, then the group list.
- **Tapping a person's name** opens their person view (F8): the good words of theirs you can see (decision 8).

#### F16.9 Activity, email, and live updates
- **Activity** (F14) adds `friend_request` (someone asked to be your friend, with Accept and Decline in the item), `friend_accepted`, and comments under your good word (as `comment`). Mentions work in both kinds of conversation.
- **No new email types.** Friend requests and comments under your good word are Activity only. Mention emails (F7.4) cover both kinds of conversation.
- **The weekly digest** (F7.1) covers what Home shows: new good words from your friends and your groups, without repeating a title, with the conversation summary per F7.5. Import roll-ups appear as one line each.
- **Live updates** (Realtime) carry friends-shared good words to the people allowed to see them, under the same rules as F16.6.

#### F16.10 Launch: the flag, the migration, and the flip
- **One flag.** Slices 14 to 19 ship behind `home_enabled`, a per-account switch (off by default) that Sydney turns on for test accounts. With it off, the app works exactly as it did before slice 14. Slice 20 turns it on for everyone and removes it, along with the old paths.
- **Nothing gets more visible without its author.** Existing good words keep `friends_shared_at` empty, so they stay exactly as visible as they are until their author opts in.
- **Friends seeded once, at the flip.** People who share a group become friends once, when the flip runs (decision 4), and the prompt below shows who they are.
- **One prompt, once.** After the flip, each person who had an account before it, has a friend, and has good words not yet shared with friends sees "Share your list with friends?", listing their friends, with **Share all**, **Choose**, and **Not now**. **Choose** turns the same sheet into a checklist of those good words (Sydney's call, 2026-10-07). It doesn't return once answered.
- **Additive first.** Add tables and columns, backfill, switch reads, and only then drop old columns, in a later slice.

#### F16.11 Engineering guardrails
The aim is that Home, group lists, My list, and title pages are four views of one system, not four systems. If a slice seems to need an exception to any of these, stop and ask.

1. **Docs before code.** Update this doc, the design system, and the CLAUDE.md build table first.
2. **Visibility lives in the database, in one place.** Every policy and query goes through `can_view_good_word` and `can_view_conversation` (section 8). No component, route, or query re-implements "is this my friend" or "am I in this group".
3. **Audience is data, not branches.** One card query, `title_cards(scope)`, serves Home, a group list, My list, a person view, and one title. No `if (isHome)` in data fetching and no Home-only copy of a query. It replaces the card-building code in `lib/good-words/queries.ts`.
4. **One card component.** The existing rec card gains a `home` variant (DS 4.2.2). No separate card component for Home.
5. **One conversation system.** The existing comment, composer, mention, and spoiler components serve both scopes; only the scope and the audience label differ.
6. **Home is derived, never stored.** No table of Home cards, no fan-out on write, no cached counters until a measured query needs one.
7. **Migrations are additive and reversible,** one concern each. Backfills can be run twice safely.
8. **One flag** (F16.10).
9. **Tests encode the privacy rules.** Every acceptance criterion in F16.6 is a row-level security test, including access by URL and by API.
10. **The glossary applies to code.** `good_word`, `friendship`, `home`; never `post`, `follower`, or `feed` in identifiers, routes, or copy.
11. **Existing rules carry over:** optimistic writes with rollback, state in the URL, spoiler text never in the DOM until revealed, and one slice per session with a plan first.

**Decisions** (Sydney, 2026-10-06, as recommended in the source spec)

| # | Decision | Chosen | What it costs |
|---|---|---|---|
| 1 | On Home, one card per title or one per good word? | Per title | Jonah's and Tess's good words aren't separate moments; the card shows the newest note and both names |
| 2 | One conversation per good word, or one per title? | Per good word | Three friends vouching means three small conversations on title detail instead of one long one |
| 3 | Can a friend's friend read your comment under that friend's good word? | Yes | Your comment is as visible as the good word it sits under; the composer says so |
| 4 | Do people who already share a group become friends at launch? | Yes, once, shown in the opt-in prompt | Without it, Home is empty on day one; with it, nobody picked their friends by hand |
| 5 | Default audience for a new good word | Friends on, groups off | Someone who only ever shared with one group now shares wider unless they turn it off |
| 6 | Do group good words appear on Home? | Yes, with a group chip | Home mixes two audiences; the chip keeps that legible |
| 7 | Do new comments move a card up on Home? | No | A lively conversation on an older title shows only as the dot and in Activity |
| 8 | Does tapping a friend's name open their good words? | Yes: the ones you can see | The closest thing to a profile; it stays a list, with no counts and no bio |

---

## 8. Data model

Postgres (via Supabase). Names are indicative; keep them consistent once chosen. Every table has `id` (uuid), `created_at`, and `updated_at` unless noted.

| Table | Key fields | Notes |
|---|---|---|
| `profiles` | `user_id` (auth user), `display_name`, `region` (ISO 3166-1, default `US`), `timezone`, `onboarded_at`, `deleted_at`, `milestones` (text array: `first`, `tenth`), `spoiler_hint_seen_at`, `home_viewed_at`, `share_prompt_due`, `share_prompt_answered_at`, `home_enabled` | One per user. `milestones` records which milestone moments have been shown, so each shows once on any device. `spoiler_hint_seen_at` records the one-time spoiler hint (DS 5.17). `home_viewed_at` is Home's last visit (F16.3). `share_prompt_due` marks accounts from before the flip, the only ones the one-time "Share your list with friends?" prompt is for, and `share_prompt_answered_at` records the answer (F16.10). `home_enabled` was the launch flag: true for everyone since the flip, unread by the app, and dropped in a later cleanup |
| `groups` | `name`, `owner_id`, `color` | `color` assigned at creation |
| `group_members` | `group_id`, `user_id`, `role` (`owner`, `member`), `joined_at`, `last_viewed_at`, `welcome_seen_at`, `join_prompt_dismissed_at`, `friend_prompt_dismissed_at` | Unique (`group_id`, `user_id`) |
| `invites` | `kind` (`group`, `friend`), `group_id` (null for `friend`), `code` (unique), `created_by`, `revoked_at` | One active (non-revoked) invite per group, and one active friend link per person. One server function validates both kinds |
| `friendships` | `user_low`, `user_high`, `status` (`pending`, `accepted`), `requested_by`, `accepted_at`, `seeded` (made at the flip, F16.10) | One row per pair, ids stored in order (`user_low` < `user_high`), unique on the pair, so a friendship can't disagree with itself. Declining, cancelling, or removing deletes the row |
| `titles` | `tmdb_id`, `media_type` (`movie`, `tv`), `title`, `original_title`, `year`, `poster_path`, `genres` (array of TMDB genre ids and names), `runtime_minutes`, `seasons`, `overview`, `accent` (one of the four `genreAccent` values in DS 4.2.1), `fetched_at` | Unique (`tmdb_id`, `media_type`). `accent` set once on insert via `genreAccent` (DS 4.2.1) |
| `good_words` | `user_id`, `title_id`, `note` (max 140), `friends_shared_at`, `source` (`organic`, `digest`, `nudge_email`, `join_prompt`, `share`, `import`) | Unique (`user_id`, `title_id`). `friends_shared_at` null means not shared with friends; it mirrors `good_word_groups.shared_at` (F16.2) |
| `good_word_groups` | `good_word_id`, `group_id`, `shared_at` | Unique pair. Which lists a good word is on |
| `watch_providers` | `title_id`, `region`, `providers` (json: stream, rent, buy), `link`, `fetched_at` | Cached per title per region. Unique (`title_id`, `region`). Stream is TMDB's `flatrate`, `free`, and `ads` together. A region with nothing is stored with empty lists, so it isn't fetched again for a day |
| `notification_prefs` | `user_id`, `digest`, `mention_email`, `group_joins`, `weekend_prompt` (booleans) | Defaults: all on |
| `conversations` | `title_id`, `scope` (`good_word`, `group`), `good_word_id`, `group_id` | Exactly one of `good_word_id` or `group_id`, enforced by a check constraint. One conversation per target: unique (`good_word_id`), unique (`group_id`, `title_id`). Deleted with its good word or group |
| `comments` | `conversation_id`, `group_id`, `title_id`, `user_id`, `body` (max 500), `is_spoiler`, `edited_at`, `deleted_at`, `deleted_by` | Index on (`group_id`, `title_id`, `created_at`). Mentions are stored in `body` by user id, so renamed people resolve correctly. Soft delete supports Undo; purge after the Undo window. `conversation_id` is backfilled into `group` conversations (F16.10); `group_id` and `title_id` are dropped in a later slice |
| `comment_mentions` | `comment_id`, `mentioned_user_id` | Unique pair. Mentioned user must be able to see the comment's conversation |
| `conversation_reads` | `user_id`, `conversation_id`, `last_read_at` | Drives the "New" divider and unseen-comment dots |
| `conversation_participants` | `user_id`, `conversation_id`, `muted` | Created when you comment in a conversation, vouch for its title in its group, or own the good word it sits under; decides who gets comment activity. `muted` reserved for later |
| `activity_items` | `user_id` (recipient), `type` (`mention`, `comment`, `conversation_started`, `group_join`, `friend_request`, `friend_accepted`), `actor_id`, `group_id` (nullable), `conversation_id`, `title_id`, `comment_id`, `read_at`, `email_handled_at` (mention and join emails: sent, or deliberately not sent) | Deleted after 90 days, or when the source comment is deleted |
| `notification_log` | `user_id`, `type`, `sent_at`, `payload_ref` | Enforces caps and dedupes sends |
| `streaming_services` (P1) | `user_id`, `region`, `provider_ids` (array) | |
| `share_links` (P1) | `user_id`, `token` (unique), `enabled`, `revoked_at`, `view_count` | |
| `feedback` | `user_id`, `message`, `may_contact` | |
| `imports` (F15) | `user_id`, `status` (`parsing`, `reviewing`, `done`, `cancelled`, `failed`), `method` (`text`, `screenshots`, `both`), `input_hash`, `group_ids`, `share_with_friends`, `found_count`, `duplicate_count`, `extracted` (the parsed candidates, for reuse), `ai_input_tokens`, `ai_output_tokens`, `completed_at` | Readable and writable only by its owner. Started through a server function that enforces 10 a day |
| `import_cards` (F15) | `import_id`, `user_id`, `position`, `query`, `note`, `confidence` (`high`, `low`), `candidates` (json: up to 4 TMDB matches), `chosen` (index), `decision` (`pending`, `added`, `skipped`), `decided_at`, `opened_alternatives` | Owner only. Never shown on a list |
| `title_matches` (F15) | `query_key` (normalized title, year, type), `media_type`, `tmdb_id` | Shared match cache. Server only (no policies) |
| `events` | `user_id` (nullable), `name`, `properties` (json), `occurred_at` | First-party analytics (Section 11) |
| `app_admins` | `user_id` | Who can open `/admin/metrics` (11.4). Seeded with Sydney's account |

**Visibility functions** (the only places visibility is decided, F16.11)

| Function | Answers |
|---|---|
| `friend_ids(user)` | Who are this person's accepted friends? |
| `can_view_good_word(viewer, good_word)` | F16.6 rule 1 |
| `can_view_conversation(viewer, conversation)` | F16.6 rule 2: defers to the good word or the group |
| `title_cards(viewer, scope)` | The cards for Home, a group list, My list, a person view, or one title: the title, the visible vouchers (newest first), the newest visible note, voucher count, newest shared time, and the group chip where it applies. Replaces the card-building code in `lib/good-words/queries.ts` (slice 16) |

**Deletion semantics**
- Taking back a good word deletes it and its `good_word_groups` rows (Undo re-creates both from the client's snapshot, or use a soft delete with a short grace period, whichever is simpler).
- Leaving or being removed from a group deletes that person's `good_word_groups` rows for that group.
- Deleting a group deletes its memberships, invites, and `good_word_groups` rows. Good words themselves remain.
- Removing a friend deletes the `friendships` row. Good words, and comments already written under them, remain.
- Deleting an account deletes the profile, memberships, good words, comments, and activity items, transfers ownership as in F1, and purges within 30 days.
- Deleting a group also deletes its comments, mentions, reads, and activity items.

**Row-level security (must be enforced in the database, not only in the UI)**
- A user can read a group, its members, and its invite only if they're a member.
- A user can read a good word only if `can_view_good_word` allows it: it's their own, or its author is their friend and shared it with friends, or it's shared into a group they're a member of. When reading someone else's good word, the `good_word_groups` rows returned are **only** those for groups the viewer belongs to, so group names are never leaked.
- Only the good word's author can create, edit, or delete it and its group links, and only into groups they belong to.
- Only owners can rename, reset invites, remove members, or delete groups.
- A user can read a conversation and its comments only if `can_view_conversation` allows it. Removed or departed members, removed friends, and people dropped from a good word's audience lose read access on the next load.
- A user can read a `friendships` row only if they're one of its two people, and a friend `invites` row only if they created it.
- A profile's display name is readable by friends, co-members, the other person in a pending request, and anyone who can see something that person wrote. Nothing else about a profile is.
- A user can create a comment only in a conversation they can see, as themselves: any title in a group they belong to, or under a good word they can see. Authors can edit and delete their own comments; group owners can delete any comment in their group.
- Comment authors' names stay readable in that group's conversations after they leave it (open question 10), and nowhere else.
- A mention is valid only if the mentioned user can see the comment's conversation at the time of writing; the server drops any others and stores the text as plain text.
- Users can read only their own `activity_items`, `conversation_reads`, and `notification_prefs`.
- `titles` and `watch_providers` are readable by any signed-in user and writable only by the server.
- Joining via invite, and accepting a friend link, happen through a server function that validates the code and limits.
- Every policy calls the visibility functions above and holds no visibility logic of its own.

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
- TMDB's where-to-watch data comes from JustWatch, and TMDB requires JustWatch attribution wherever it's shown. Show "Streaming data from JustWatch" with their logo beneath where-to-watch on title detail, and in About. Until the logo file is added, the attribution is that sentence as text, linking to JustWatch (deferred 2026-09-29).

### 9.3 Authentication
- Supabase Auth: email magic links (15-minute, single-use) and Google OAuth. Custom, on-brand email template for the magic link.

### 9.4 Email
- **Resend** (decided), with a verified sending domain, SPF, DKIM, and DMARC. It sends sign-in links from slice 1 as Supabase Auth's custom SMTP sender, and all product email from slice 7.
- Support RFC 8058 one-click unsubscribe (`List-Unsubscribe` and `List-Unsubscribe-Post` headers) on digest and prompt emails.
- Templates are responsive, readable in plain text, and survive dark-mode email clients. Every image has alt text.
- No open-tracking pixels. Measure engagement by link clicks with `ref` parameters.

### 9.5 Scheduling
- A scheduled job runs every 5 minutes and sends any digests, mention emails, join emails, or prompts due in each user's local time, respecting caps and the notification log. Supabase `pg_cron` calls the app's `/api/email/run` through `pg_net` (Vercel's free plan only runs cron once a day). The app's address and a random job secret live in Supabase Vault, created by the step 7 migration; the app checks each call against it.

### 9.6 Hosting and stack
- **Assumed stack:** Next.js (App Router) on Vercel, Supabase (Postgres, Auth, Realtime for P1 live updates), Tailwind per DS 11.
- **Decided (open question 1):** Next.js. The marketing page and the app live in one Next.js app, the marketing page in the `(marketing)` route group.

### 9.7 Anthropic (F15)
- Claude Haiku 4.5 reads pasted text and screenshots during an import and returns candidate titles. It never recommends anything (4.3): it only reads what the person wrote.
- Server-side only, through the official SDK, with `ANTHROPIC_API_KEY`. Only signed-in people can trigger a call. The privacy page names Anthropic as a processor for import text and screenshots, which Good Word doesn't keep.

---

## 10. Non-functional requirements

### 10.1 Performance
Per DS 9: LCP under 2.5 seconds on a mid-tier phone on 4G, INP under 200ms, CLS under 0.1. All writes are optimistic. Lists render their first page server-side.

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
- Invite links (`/join/[code]`) render a link preview (Open Graph title "Join College crew on Good Word", description, and a branded image) so they look trustworthy in group chats. The preview must not show list contents.

---

## 11. Analytics and instrumentation

### 11.1 Principles
First-party, minimal, and privacy-respecting. Events go to the `events` table. No third-party analytics SDKs. Never record search queries' text, notes, or email addresses in events.

### 11.2 Events
| Event | Properties | Serves |
|---|---|---|
| `invite_link_opened` | `kind` (`group`, `friend`), `group_id` (group links), `signed_in` | H1 |
| `invite_shared` | `group_id`, `method` (`share_sheet`, `copy`) | H1 |
| `group_created` | `group_id` | J1 |
| `group_joined` | `group_id`, `via` (`invite`) | H1 |
| `sign_in_completed` | `method` (`magic_link`, `google`), `new_user` | Funnel |
| `add_opened` | `entry_point` (`tab`, `rail`, `shortcut`, `title`, `search_row`, `join_prompt`, `empty_state`, `email`, `home_card`) | H3 |
| `search_performed` | `query_length`, `result_count` | H3 |
| `good_word_created` | `title_id`, `groups_count`, `friends` (boolean), `has_note`, `source`, `ms_from_add_opened` | H2, H3, H4 |
| `good_word_edited` | `field` (`note`, `groups`, `friends`) | |
| `good_word_taken_back` | `undone` (boolean) | |
| `list_viewed` | `list` (`home`, `group`, `all`, `mine`, `person`), `filters` (keys only), `new_count` | H5 |
| `title_viewed` | `from` (`list`, `search`, `digest`, `person`, `share`) | H5 |
| `where_to_watch_clicked` | `title_id`, `provider_id`, `from_good_word` (boolean) | H5 |
| `email_sent` | `type` | H4, H6 |
| `email_clicked` | `type`, `target` | H4, H6 |
| `notification_pref_changed` | `type`, `enabled` | |
| `first_good_word_prompt` | `action` (`shown`, `used`, `dismissed`) | H2 |
| `share_link_toggled` (P1) | `enabled` | J7 |
| `conversation_opened` | `scope` (`good_word`, `group`), `group_id` (group scope), `title_id`, `from` (`title`, `card`, `activity`, `email`), `unseen_count` | H7 |
| `comment_created` | `scope`, `group_id` (group scope), `title_id`, `length_bucket`, `mention_count`, `is_spoiler` | H7 |
| `comment_edited` / `comment_deleted` | `undone` (for delete) | |
| `mention_notified` | `channel` (`activity`, `email`) | H7 |
| `activity_opened` | `unread_count` | H7 |
| `spoiler_revealed` | | |
| `import_started` | `method` (`text`, `screenshots`, `both`), `screenshot_count`, `text_length_bucket` | F15 |
| `import_parsed` | `found_count`, `duplicate_count`, `high_confidence_count`, `ai_used`, `reused`, `ai_input_tokens`, `ai_output_tokens`, `ai_cost_microdollars`, `ms_elapsed` | F15 cost and speed |
| `import_failed` | `stage` (`parse`, `save`), `reason` (`config`, `auth`, `rate_limited`, `bad_request`, `unavailable`, `refused`, `unparsed`, `failed`) | F15 reliability |
| `import_card_decided` | `decision` (`added`, `skipped`), `opened_alternatives`, `bulk` | F15 match accuracy |
| `friend_link_shared` | `method` (`share_sheet`, `copy`) | F16 |
| `friend_request_sent` | `from` (`friends_screen`, `group_prompt`) | F16 |
| `friend_added` | `via` (`link`, `request`, `seeded`) | F16 |
| `friend_removed` | | F16 |
| `home_caught_up` | `new_count`, `earlier_loaded` (pages tapped) | F16: Home ends |
| `share_prompt` | `action` (`share_all`, `choose`, `not_now`), `friends_count_bucket` | F16.10 |
| `import_finished` | `added_count`, `skipped_count`, `duplicate_count`, `ms_from_start` | F15: time to a list of 10 |

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
| **4. The core loop** | Confirm sheet with note and visibility line; create, edit, take back, Undo; group list, All groups, My list; one card per title per group; milestones; first-good-word prompt; empty states | J1, J2, and J3 work end to end; log time under 10 seconds in a stopwatch test |
| **5. Choosing** | Title detail with good words and notes; where to watch with JustWatch attribution; filters, sort, URL state, paging; New badges and counts | J4 works end to end; filters survive refresh and Back |
| **6. Conversations** | Comments table and RLS; conversation preview on title detail; full conversation screen; composer with mention autocomplete; spoilers; edit, delete, Undo; live new comments (Supabase Realtime); comment counts on cards; Activity list and bell badge | J6 works end to end on two phones: a mention shows in Activity within seconds, a spoiler stays covered, and a member of another group can't see or reach the conversation |
| **7. Email** | Email provider and domain; digest (including conversation summary); mention emails; group-join emails; preferences; unsubscribe; scheduler; caps | A test digest arrives with correct content, links carry `ref=digest`, a mention email arrives within 15 minutes, and unsubscribe works signed out |
| **8. Settings and trust** | Settings, help, FAQ, feedback, about and attributions, download my data, delete account with ownership transfer, privacy and terms pages, security headers, rate limits | Account deletion and data download verified; all attribution present |
| **9. Measurement** | Events per Section 11; source attribution; `/admin/metrics` | Every event fires from its flow; metrics page shows real numbers from test use |
| **10. P1 (in order)** | Installable app and offline queue; live new-good-words pill; person view; streaming services filter; share my list; weekend prompt | Each P1 item meets its acceptance criteria |
| **11. Build your list** | My shelf renamed My Recs (since renamed My list); Add recs from text, dictation, and Letterboxd screenshots; review deck; done screen; resume; limits and cost events (F15) | F15's acceptance criteria pass, with the AI faked in tests and checked once live |
| **12. Home and friends: docs** | Schema check against section 8; F16; data model and RLS; design system glossary, card, navigation, and patterns; CLAUDE.md build table. No app code | Sydney accepts the docs |
| **13. Rename** | "shelf" becomes "list" and My Recs becomes My list in all UI copy, emails, `messages/en.json`, routes (`/shelf/*` to `/list/*`, old paths redirect), and code names; `shelf_viewed` becomes `list_viewed` (stored events renamed) | No "shelf" left in UI copy, emails, routes, or identifiers; old links redirect; all tests pass |
| **14. Friends** | `friendships`; friend links on `invites`; the friend landing; Friends screen; requests from groups; the after-join prompt; remove friend; Activity items; RLS and tests. Behind `home_enabled` | J8's steps 1 and 2 work on two phones; F16.1's acceptance criteria pass |
| **15. Friends as an audience** | `friends_shared_at`; `friend_ids` and `can_view_good_word`; the audience step on the confirm sheet and import; Change who sees it. Behind the flag | F16.2's acceptance criteria pass; a flag-off account sees no change |
| **16. One card query** | `title_cards(viewer, scope)` replaces the card-building code; group lists, My list, and person view move onto it with no visible change | Every existing list test passes unchanged; group lists look identical at 390 and 1440 |
| **17. Home** | `/home`, the `home` card variant, caught-up marker, earlier pages on tap, import roll-up, group chip, filters, empty states, live pill, switcher and tab changes. Behind the flag | F16.3's acceptance criteria pass; J8 works end to end |
| **18. Conversations by scope** | `conversations` and the backfill; reads, participants, mentions, and Activity by conversation; conversations under good words; the composer's audience line; Realtime topics. Behind the flag | F16.5 works on two phones; every F13 test still passes |
| **19. Title page** | Title detail shows what each viewer may see, in F16.4's order, with a conversation under each good word | F16.6's acceptance criteria pass as RLS tests, by page, URL, and API |
| **20. The flip** | Home becomes the default for everyone; friends seeded from shared groups; the "Share your list with friends?" prompt; digest covers Home; All groups redirects; the flag and old paths removed | A flag-free account gets the prompt once and lands on Home; nothing became more visible without its author |
| **21. Copy pass** | Marketing page, BRAND.md's positioning line, onboarding, and FAQ rewritten for a friends-first app with "list" | The marketing spec and page agree; the promises in F16's source spec ("Followers", "Public profiles", "Endless scrolling", "Reviews from strangers" stay crossed out) still hold |

**Across every slice:** each new screen meets DS 12.1 before the slice is called done, and is checked on iOS Safari first.

---

## 13. Research and release plan

### 13.1 Usability testing (per NN/g practice)
- **When:** after slice 4 (core loop), after slice 5 (choosing), and after slice 6 (conversations), before inviting the beta.
- **Also:** after slice 20 (Home and friends), with the tasks "Add Priya as a friend", "See what your friends vouched for this week", and "Share a good word with only College crew".
- **Who:** 5 people per round who aren't on the team, on their own phones.
- **Tasks:** "A friend sent you this link. Join the group." · "You just finished a show you loved. Tell the group." · "It's Friday night. Find a comedy movie you can watch on Netflix that someone in the group recommends." · "Change the note on something you recommended." · "Tell Priya what you thought of The Night Ferry's ending without spoiling it for anyone else."
- **Measure:** task success, time on task, errors, and a single ease rating per task. Fix severity 1 and 2 issues before release.
- **Heuristic review:** walk each new screen through DS 1.2 before testing.

### 13.2 Private beta
- **Who:** Sydney's friend groups, 2 to 4 groups of 4 to 10 people.
- **Seeding:** Sydney adds 5 to 10 good words to each group before inviting, so no one arrives to an empty list.
- **Length:** 4 to 6 weeks.
- **Feedback:** in-app Send feedback, plus short interviews with 5 to 6 beta users at week 2 and week 5 about what they used, what they wished for, and whether they watched anything because of a friend's good word.
- **Decision at the end:** review H1 to H6 and decide what to build next from the Later list (Section 4.2).

---

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| People browse but don't contribute (the classic recommendation-app failure) | High | Ten-second logging; first-good-word prompt; audience-naming success toast; weekend prompt; source tracking to measure it early |
| Empty lists on arrival | High | Seed groups before inviting; useful-alone My list; honest empty states with one clear action |
| Invite friction (email sign-in on phones) | High | Google option; invite context kept throughout; link-on-another-device handling; test J2 on real iPhones |
| Notifications feel spammy | Medium | Never send empty digests; one non-transactional email per day max; quiet hours; one-click unsubscribe |
| Privacy mistakes (leaking groups or people across groups) | High | RLS in the database; explicit acceptance tests for cross-group visibility; never show group names the viewer isn't in |
| TMDB outage or rate limits | Medium | Server-side caching; the app works from cached titles; clear error states |
| Where-to-watch data is wrong or stale | Low | 24-hour refresh; attribution sets expectations; region setting |
| Scope creep before the core loop is proven | Medium | P0/P1/Later labels; slice gates; Later items need their own spec |
| Conversations pull attention from putting in good words | Medium | Conversations live on title detail, not the list; the Add button stays the primary action; watch H7's "good words per member doesn't drop" signal |
| Spoilers ruin a show for someone | Medium | Spoiler toggle with a first-time hint; covered text never rendered, previewed, or emailed |
| Home turns into something people scroll instead of choose from | High | Newest first only, no ranking, the caught-up marker, earlier pages only on tap, no likes or counts (F16.3); watch `home_caught_up` |
| Friends of friends see more than people expect | High | The composer and visibility line always name the audience; nothing becomes more visible without its author (F16.10); F16.6 acceptance criteria as RLS tests |
| Mentions feel like pressure or spam | Low | Mentions only within a group; batched emails; one-tap unsubscribe; no read receipts or typing indicators |

---

## 15. Open questions

Decide before the slice that needs them.

| # | Question | Proposal | Needed by |
|---|---|---|---|
| 1 | Marketing page framework: Next.js or Astro? | **Decided (2026-09-28): Next.js.** Marketing and app share one Next.js app | Slice 0 |
| 2 | Share-my-list conflicts with DS 5.14 ("Nothing is public") | **Decided (2026-09-30): allowed.** DS 5.14 now reads "Nothing is public unless you turn on a share link", off by default and revocable | Slice 10 |
| 3 | The marketing page promises "Ask, and pull from people you trust" with the example "Something funny, under 30 minutes" | For the MVP, filters (Comedy + Under 30 minutes) fulfill this; either keep the copy or change the example until Ask ships | Beta launch |
| 4 | Digest day and time | Thursday, 5pm local. Built this way in slice 7 (one setting in `digest_slot`); still to confirm | Slice 7 |
| 5 | When someone leaves, their good words leave that list | Confirm (currently specified) | Slice 2 |
| 6 | Group size limit of 50 and 20 groups per person | Confirm, or raise after beta | Slice 2 |
| 7 | Should removed members be told? | No for the MVP; revisit if it causes confusion | Slice 2 |
| 8 | Email provider | **Decided (2026-09-29): Resend**, set up in slice 1 for sign-in links | Slice 1 |
| 9 | Do we need an explicit "Watched it" action to prove H5? | Rely on where-to-watch clicks and interviews for the MVP; build "Watched it because of you" first if evidence is unclear | After beta |
| 10 | Comments from people who leave or are removed | **Decided (2026-09-29):** stay visible and attributed so conversations make sense; deleted only if they delete their account | Slice 6 |
| 11 | Can people comment on a title nobody in the group has vouched for? | **Decided (2026-09-29): yes.** Any title can have a conversation in any group. The first comment gives every other member an Activity item, so it's discoverable without being on the list (F13). Still holds for group conversations after F16 | Slice 6 |
| 12 | Should mentions work inside notes too? | Not in the MVP; notes travel across groups, so a mention could reach people outside the mentioned person's groups | After beta |
| 13 | Is a declined friend request visible to the person who sent it? | **Decided (2026-10-06): like Instagram.** Declining is silent: the requester isn't notified, the request stops showing as Requested, and they can ask again at any time (F16.1) | Slice 14 |
| 14 | Does a good word shared only into groups also get a conversation under it, beside the group's conversation? | **Decided (2026-10-07): no.** Only friends-shared good words get a conversation under them; group-only good words are talked about in the group's conversation, as today (F16.5) | Slice 18 |
| 15 | Limits for friends | **Decided (2026-10-06): no limits** on friends or friend requests (F16.1) | Slice 14 |
| 16 | Who can delete comments under a good word, besides their authors? | **Decided (2026-10-07): only the good word's author**, the way a group owner can in a group conversation (F13, F16.5) | Slice 18 |

---

## 16. Changelog

- **v1.5.0 (2026-10-07):** Step 20, the flip, live for everyone (Sydney's call: the only account it affects yet is hers). Home is the default and the first tab for everyone; `/list` and `/list/all` go to Home; Friends, friends as an audience, conversations under good words, the title page, and person view for friends are on for everyone, and the code no longer reads `home_enabled`. People who share a group became friends once (`friendships.seeded`; rerunning the seeding adds nothing new). Nothing became more visible: existing good words keep `friends_shared_at` empty until their author shares them. The "Share your list with friends?" sheet shows once to people who had an account before the flip (`profiles.share_prompt_due`), have a friend, and have good words not shared with friends; **Choose** is a checklist in the same sheet (F16.10), and `answer_share_prompt` records the answer (`share_prompt_answered_at`). The weekly digest now covers what Home shows (F7.1): up to 8 titles from friends and groups, newest first, each once, with the group chip only when that's how it reached you, import roll-ups as one line each, "See all N on Home", then each group's conversation summary (F7.5); it links to Home. The `events_list_rename` trigger is dropped. Left for later, to avoid breaking the app between a migration and its deploy: dropping the `home_enabled` column (now true for everyone, by default too) and renaming the database names that still say shelf (v1.4.1).
- **v1.4.9 (2026-10-07):** Step 19, the title page, behind `home_enabled`. Title detail follows F16.4's order: the title with where to watch, then every good word you can see (friends' included), yours first or the vouch button in its place, each shared with friends with its conversation collapsed beneath it (count, unseen dot, and latest comment; it opens in place to the 3 newest, "See all", and "Add a comment"), then your groups' conversations (unchanged), then the overview. `title_word_conversations(title)` reads those conversations for the person asking; row-level security decides which good words come back, so nothing is counted or hinted at (F16.6 rule 4). With nobody you know on it: "Nobody you know has vouched for this yet." Person view now opens for friends as well as people you share a group with (F8, as section 6.1 already says), since names on the title page and Home's roll-up lines link there; it says "Your friend". Group-only good words still show their group chips; a friend's good word shows no chip.
- **v1.4.8 (2026-10-07):** Step 18, conversations by scope, behind `home_enabled`. `conversations` (scope `group` or `good_word`) is added and backfilled from every group conversation, and comments, reads, participants, and Activity now carry `conversation_id`; group conversations keep their group and title columns and work exactly as before, with triggers linking anything written the old way (section 8, F16.10 "additive first"). `can_view_conversation` decides who sees a conversation (F16.6 rule 2). Conversations under a good word open at `?word=`, made on the first comment; the good word's author is always a participant, so comments under it reach them in Activity as `comment` (F16.9). Taking a good word back keeps its conversation for the 10-minute Undo window, so Undo brings the comments back; after that it's deleted. Mentions under a good word keep only people who can see it, and suggestions show only people you already know (friends, people in your groups, and people who've commented there). Mention emails cover both kinds, one per conversation, naming whose good word it is. Home's conversation row counts the comments you can see across your groups' conversations and the ones under good words, previews the newest, and opens that conversation, or the newest good word's when there are none yet. The good-word Realtime topic is `word:<good word id>`. `conversation_opened` and `comment_created` gain `scope` (11.2). Live updates couldn't be checked in the build environment, which can't open websockets (the same limit the J6 test hits there); they need a check on two phones.
- **v1.4.7 (2026-10-07):** Open questions 14 and 16 decided by Sydney: only good words shared with friends get a conversation under them, and besides comment authors, only the good word's author can delete comments under it (F16.5).
- **v1.4.6 (2026-10-06):** Step 17, Home, behind `home_enabled`. `title_cards` gains the `home` scope; `profiles.home_viewed_at` keeps your last visit, and before your first visit the last 7 days count as new (my call; open to change). `home_import_rollups()` counts only the good words in each import you can see, and `latest_comments()` gives each card's newest comment from your groups (spoilers have no text). Good words shared with friends broadcast on a `friends:<id>` topic only their friends can join, and the group broadcast now carries the good word's source so Home's live pill skips imports (section 8). With the flag: the first tab and the rail's first row are **Home**, the switcher leads with Home in place of All groups, `/list` and `/list/all` go to `/home`, `g` then `h` goes Home, and accepting a friend link lands on Home. Choices made in the build: the card's note is the newest note from someone else, so your own note-less good word never hides a friend's words; earlier pages you've opened stay open when filters change; roll-up lines hide while filters are on, since they aren't titles; a card's conversation row opens its group's conversation, and a card reached only through friends opens title detail until conversations under a good word ship (slice 18). `list_viewed.list` gains `home`, `home_caught_up` is sent once you've seen the marker, and `add_opened` gains the `home_card` entry point for Vouch too (11.2).
- **v1.4.5 (2026-10-06):** Step 16, the one card query. `title_cards(scope)` builds the cards for a group's list, All groups, My list, and person view in the database, as the person asking, so row-level security decides what's in them (section 8); New badges are worked out there too. Its signature is `title_cards(p_scope, p_group, p_person)`, with the viewer always the person asking, rather than a `viewer` argument anyone could set. Every existing list test passes unchanged. One small difference: person view's streaming-service chips now come from that person's titles only, where before they came from every title in the groups you share, some of which weren't shown. The client still lays your pending changes over the cards (`applyOverlays`), as before.
- **v1.4.4 (2026-10-06):** Step 15, friends as an audience, behind `home_enabled`. Steps 13 and 14 accepted. `good_words.friends_shared_at` and `imports.share_with_friends` (section 8). `can_view_good_word` decides who can read a good word, and the good words policy only calls it; it answers only for the person asking. The write functions take an optional friends argument, so the running app and accounts without the flag change nothing about friends; existing good words stay unshared (F16.10). Change who sees it saves friends and groups together; Undo restores the friends share time exactly. Until Home (slice 17) and the title page (slice 19), friends-shared good words show on no screen yet: title detail, search, and the lists still show only good words that reach you through a group. My list cards and your own good word on title detail show a Friends chip (Sydney's call: the group chip's style); My list's group filter is unchanged (Sydney's call). `good_word_created.friends` and `good_word_edited.field = friends` (11.2).
- **v1.4.3 (2026-10-06):** Step 14, Friends, behind `home_enabled`. Until Home ships (slice 17), accepting a friend link lands on Friends with the toast "You and Priya are friends now."; someone without the flag lands on their lists instead, since Friends doesn't exist for them yet. Your friend link is made the first time you open Friends, and opening Friends marks friend Activity items read (like a group's join items). A friend_accepted item links to Friends, and names on Friends don't link to a person view yet: person view still shows only shared groups until it moves onto the one card query (slice 16). Friend Activity items show only to people with the flag, and the Activity empty-state copy (DS 5.17) changes at the flip. Friend links share the group invites' per-IP and per-code rate limit, which guards against guessing links, not against friends (open question 15). `friend_ids` is internal; policies use `is_friend` and `has_friendship_row`, which only answer about the person asking. Events: `friend_link_shared`, `friend_request_sent`, `friend_added`, `friend_removed`, and `invite_link_opened.kind` (11.2).
- **v1.4.2 (2026-10-06):** Open questions 13 and 15 decided by Sydney: a declined friend request works like Instagram's (silent, and the requester can ask again), and there are no limits on friends or friend requests (F16.1).
- **v1.4.1 (2026-10-06):** Step 13, the rename. Until Home replaces it at the flip (slice 20), the first tab is labeled **Groups** (it opens your group lists), so it never sits as "List" beside "My list"; the group switcher's sheet is "Your groups". Old `/shelf` links redirect to `/list` with their query string. Stored `shelf_viewed`, `title_viewed`, and `email_clicked` events are renamed by migration, with a trigger catching old names until the deploy (dropped in slice 20). Database names that still say shelf (`mark_shelves_viewed`, `shared_shelf`, `conversation_previews.on_shelf`, the `shelf:` Realtime topic, `admin_metrics.title_views_from_shelf`) are renamed in the slices that rebuild them (16 to 20), because renaming them now would break the running app between the migration and the deploy. The marketing page keeps "shelf" until slice 21.
- **v1.4.0 (2026-10-06):** Home and friends (F16, slices 12 to 21), from Sydney's "Good Word: Feed-first UX" spec, with its eight decisions taken as recommended. Sydney's further calls: the word **shelf becomes list** and **My Recs becomes My list** everywhere (DS 1.4), renamed in the app in slice 13; the tab bar stays three tabs, **Home · Add · My list**, with the Activity bell in the header (F16.8); **Home replaces All groups**; no new email types, and the digest covers what Home shows (F16.9). Changes: principles 4 and 6 (1.3); scope (4.1, 4.3); J3 and new J8; routes `/home`, `/you/friends`, and conversations under a good word (6.1); navigation (6.2); access (6.4); default audience is Friends on, groups off (F4, F15.1); All groups replaced (F5.2); title detail and person view show what the viewer may see (F6, F8); conversations by scope (F13); new Activity types (F14); data model, visibility functions, and RLS (section 8); events (11.2); risks (14); open questions 13 to 16. Schema check: the source spec was written against v1.1; the differences found (no SQL views for cards, `activity_items.group_id` required, Realtime and the digest group-only, person view and export without friends, no store for Home's last visit) are covered above. The source spec's 5-tab bar and "context" prop are replaced by the 3-tab bar and a `home` card variant. Steps 6 to 11 accepted.
- **v1.3.2 (2026-10-02):** No daily import limit (F15.4): Sydney removed it after failed tries, caused by an API key problem, used up her day. The per-import caps stay (5 screenshots, 5,000 characters, 100 titles), and spend is capped in the Anthropic console.
- **v1.3.1 (2026-10-01):** `import_failed` (11.2) records why an import failed (a missing or rejected API key, limits, the API rejecting the request), never the text, so failures can be diagnosed from the events table.
- **v1.3.0 (2026-10-01):** Build your list (F15, slice 11), from Sydney's "Build Your Recs List" spec. Decisions: keep the word "recs" and rename My shelf to **My Recs**; imported recs go into all your groups by default; Claude Haiku 4.5 only, with no larger-model escalation; limits of 5 screenshots, 5,000 characters, 100 titles per import, and 10 imports a day; unreviewed cards are saved privately so a review can be resumed. The share sheet path is Android only; iPhone uses paste. New routes (6.1), tables (section 8), and events (11.2). A site-wide 404 for unknown URLs.
- **v1.2.14 (2026-09-30):** Step 10. Streaming services are saved per region (a service's id can differ by country); Settings lists the region's services from TMDB, most popular first, with "Show all". A title whose services aren't known yet never matches "On my services". Share links are 144-bit tokens, and a link turned back on is always a new one. The shared page lists up to 500 good words and shows no title detail link, since title detail needs sign-in. The weekend prompt's button links to `/shelf?add=1&ref=nudge_email`, which opens Add once; `add_opened` gains the `email` entry point for it (11.2). The weekend prompt counts toward the one-a-day email cap after the digest and join emails, and a held prompt goes within 24 hours of Sunday 10am or not at all. Offline good words are kept on the device per person and sent on reconnect; the service worker keeps up to 6 shelves for offline. Live new good words are counted per shelf, never the viewer's own.
- **v1.2.13 (2026-09-30):** Open question 2 decided: Share my shelf is allowed (F9, DS 5.14). The privacy and terms pages name Sydney Stubbs as the contact, and the marketing page footer links to them.
- **v1.2.12 (2026-09-30):** Step 9. Events are checked against a fixed schema before they're stored, so no free text can get in (11.1); browser events go through `/api/events`, the rest are recorded where they happen, after the response is sent. `app_admins` decides who sees `/admin/metrics` (section 8, 11.4). Mention and join emails carry `ref=mention` and `ref=group_join` so `email_clicked` covers every email (11.2). `title_viewed.from` is `shelf` or `digest` for now: search, person view, and share links don't open title detail yet. `add_opened` has no `search_row` entry yet, since no search row opens Add. The metrics page also shows comments and commenters for H7. Weeks start Monday, UTC.
- **v1.2.11 (2026-09-30):** Step 8. Settings has Account (name, email, region, sign out), Notifications, and Your data; Sign out moves there from My shelf (F11). Download my data is a JSON file of profile, groups, and good words from `/api/me/export` (F1). Deleting an account leaves each group the way leaving does, so ownership passes to the earliest member and solo groups are deleted, then removes the auth user and everything of theirs (F1, section 8). `feedback` table, messages up to 2,000 characters, 10 a day, emailed to Sydney (F11, 10.4). Help has the FAQ, the DS 3.9 shortcuts (now all built), feedback, and About with the TMDB and JustWatch logos, which also replace the JustWatch text under where-to-watch (9.1, 9.2). `/privacy` and `/terms` are plain-language drafts (10.4). The Content Security Policy allows inline scripts, since nonces would make every page render on demand (10.4).
- **v1.2.10 (2026-09-30):** Step 7 accepted. Verified on a phone: the join email and the test digest (posters, notes, `ref=digest` links). Deferred to a later polish pass, by Sydney's call: a live mention email and signed-out unsubscribe checked on a phone (both pass automated tests), inbox placement for the digest (the first one landed in Spam; check SPF, DKIM, and DMARC in Gmail's Show original and add a `_dmarc` record if missing), and email wording and layout details.
- **v1.2.9 (2026-09-29):** Step 7. Open question 4 (digest Thursday 5pm local) built as proposed, pending confirmation. `/unsubscribe` route (6.1). Mention batching timed so the email arrives within 15 minutes (F7.4). Unsubscribe page, cap priority, and reserved test domains (F7.7). The scheduler is Supabase `pg_cron` every 5 minutes (9.5). `activity_items.email_handled_at` (section 8). Settings has Notifications from step 7; step 8 adds the rest.
- **v1.2.8 (2026-09-29):** Step 6. Open questions 10 and 11 decided: comments from people who leave stay attributed, and any title can have a conversation in any of your groups (F6, F13, section 8). The first comment in a conversation gives every other member a `conversation_started` Activity item (F13, F14). On phones the Activity bell sits at the right of the header, and the conversation screen hides the tab bar (6.2). `comments.deleted_by` and `profiles.spoiler_hint_seen_at` (section 8).
- **v1.2.7 (2026-09-29):** Step 5 accepted. The JustWatch logo is deferred; the attribution is text with a link for now (9.2).
- **v1.2.6 (2026-09-29):** Step 5. The `groups` query parameter filters My shelf by group (6.3). A streaming service means subscription, free, or free with ads, and chip counts reflect the other filters (F5.4). "Last viewed" starts at joining, and viewing All groups counts for each group (F5.5). `watch_providers` details (section 8). Title detail keeps the order in F6 (DS open question 9 decided).
- **v1.2.5 (2026-09-29):** Step 4. `profiles.milestones` records milestone moments already shown (section 8). Putting in a good word for a title you already vouched for sets its groups to the ones picked (F4). The first-good-word prompt sits after the last card and appears only on a shelf that has cards; an empty shelf's own empty state already asks (F5.7).
- **v1.2.4 (2026-09-29):** My shelf is a main navigation item: the You tab is renamed My shelf and leads with your good words, then your groups and a Settings link (6.1, 6.2, F5.3, J7). Routes stay under `/you`.
- **v1.2.3 (2026-09-29):** Resend decided and moved up to slice 1 for sign-in emails (9.4, open question 8). Session length accepted as "stays signed in while in use" on the free plan (F1). Within slice 1, Google sign-in is built after email links.
- **v1.2.2 (2026-09-28):** Open question 1 decided: Next.js, one app for marketing and product (9.6).
- **v1.2.1 (2026-09-28):** The marketing page isn't built yet; it's built after foundations (CLAUDE.md step M).
- **v1.2 (2026-09-27):** Made visual references direction-neutral (milestone moment, `genreAccent` values) so this doc works with Design System v3.0 (Editorial).
- **v1.1 (2026-09-27):** Added conversations on titles (per group), @mentions, spoilers, and Activity (F13, F14, J6); mention emails and digest summary; data model and RLS for comments; analytics for H7; new build slice 6. Aligned to Design System v2.1.
- **v1.0 (2026-09-27):** Initial product requirements for the MVP, aligned to Design System v2.0.
