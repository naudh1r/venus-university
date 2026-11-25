# Draft: pictures on the batch posts (break and graduation)

Status: **draft, revisit after the 0.9.2 release.** Nothing built yet.

## The idea

Three batches of feed posts are written in one call each and filed straight onto the feeds, so
Photo (and any mod) never sees them:

| Batch | Written by | Filed by |
|---|---|---|
| Break posts at a game's start | New Game's profile call (`breakPostsLine('winterPosts', …)`, 0–3 per character) | `dealBreakPosts` in `semesterStart.ts`, while the semester is composed |
| Break posts at a new semester's start | that semester's profile call (`breakPostsLine('breakPosts', …)`) | the same |
| The last posts after graduation | the epilogue's "THE SEMESTER IS OVER…" call (`endingPosts.ts`) | `deliverEndingPosts` → `appendFeedPost` |

Rule: **at most 3 pictures per batch, the rest text**, as a slot's feed already is (two feed
pictures and one from a scene of two or more).

How, without wasting tokens: the game picks the up-to-3 posters in code first, as
`withFeedPicturesRequest` does for a slot; the batch's own call is told only those 3 carry an
`image`, and writes one short description each in the same reply. No extra AI call; Photo draws
them on ComfyUI.

## Core PR 1: the graduation posts (small, ~50–80 lines)

- Kit: an `ending-posts` request spot (types, hook table, API report, changelog).
- `endingPosts.ts`: pass the request through `modRequest`.
- `deliverEndingPosts`: file each post through `fileFeedPost` with an `ending` flag, not
  `appendFeedPost`. Photo's `postLikes` already handles `ask.kind === 'ending'`.
- The epilogue stays read-only: no comments, no replies.

## Core PR 2: the break posts (bigger, ~150–250 lines) — ask Maestro first

- A request spot for the profile call, New Game's and a continuing semester's.
- **Timing:** break posts are dealt while the semester is composed, before the playthrough's
  first slot exists, so Photo cannot reserve a file or draw yet. They would be filed through
  `fileFeedPost` when the first morning opens instead. This changes the start of every
  playthrough (`semesterStart.ts`, New Game composition, the first slot), so it is a design
  question for the org before any code.

## Photo follow-up (~60–100 lines)

- Pick at most 3 posters per batch (for example contacts the reader has met), ask only for theirs.
- The picture follows the post: the break for break posts, packing and leaving for graduation.
- Bunnyfeeds needs nothing: the epilogue is read-only, and break posts have no threads.
