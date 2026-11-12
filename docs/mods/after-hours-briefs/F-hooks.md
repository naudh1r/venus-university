# Brief F — core: fixes from the review

**Branch:** `hooks/after-hours`. Read `docs/mods/after-hours-briefs/README.md` first (on `mod/after-hours`)
and keep every rule in it. Reset `hooks/after-hours` to `origin/hooks/after-hours` (b337c2d8 or later).
Nothing on this branch names After Hours. Kit 0.13.0 → **0.14.0**. The findings are in
`docs/mods/after-hours-briefs/review-report.md` (on `mod/after-hours`); numbers below are its numbers.

## 1. Bonus scenes no longer reach `slotSettled` (findings 1 and 5)
Mods written before bonus scenes count `slotSettled` once per slot (Campus Talents, Bunnyfeeds,
Breakthrough, Echo, Story Memory). A bonus scene's boundary must not reach them.
- A bonus scene's boundary **does not dispatch `slotSettled`**. It dispatches a new hook instead:
  `bonusSettled?: (ctx: SlotSettled) => void` (renderer, kind `event`, same context as `slotSettled`,
  `bonus: true` always set). Synchronous, at the same point, so its state is in the boundary save.
- Remove `bonus` from `slotSettled`'s context (it is never set there now). Keep it on
  `projectSlotMemories`, `slotStatusLines`, `exercisedStats`, `settleSceneStats`, which compute a
  scene's own values.
- `MODDING.md`: say a mod that wants a bonus scene's settle registers `bonusSettled`; a mod that only
  registers `slotSettled` never sees one (so Story Memory, for one, does not record bonus scenes until it
  registers it).

## 2. Held messages hidden from every reader (finding 2)
- The kit's conversation readers (`conversation`, `useConversation`, `subscribeConversation`, and any
  other kit reader that hands out a thread's messages) return only messages `messageShown` against the
  opened chat clock.
- The contact Gallery (`src/renderer/views/ContactGallery.tsx`) and any other core view or reader that
  lists a thread's messages (search them all: previews, photos, the contact page, notes, prompts outside
  texting) skip messages not shown yet. One shared helper for "a thread's shown messages".

## 3. Recovering a failed held turn (finding 3)
- `resumeHeldReplies`: find his **last** message with `awaitingReply` in the thread, even when system
  messages (an error bubble) follow it. Remove those trailing error bubbles, then ask again as now.
- Recovery takes the held turn's due slot as now (the slot after the one his text was sent in, or the
  current slot when that has passed).

## 4. Morning-after thumbnails (finding 6)
`src/renderer/stores/loop/thumbnail.ts`: a bonus scene with `bonusAt === 'morning'` uses the clock's own
half, as the stage does.

## 5. New Game+ and held replies (finding 7)
`src/renderer/stores/semesterCarry.ts` `carriedConversation`: move `heldReply.until` back by the same days
as every message, and keep `awaitingReply` on his messages, so a carried hold names the new semester's
clock and recovery still finds it.

## 6. A reader for who opened a thread (for the mod's Busy fix)
Export `threadStartedBy(messages, date, time)` (`src/shared/textingThread.ts`) from `@vx/modkit/shared`,
listed in `KIT_APIS` as `shared:threadStartedBy`.

## 7. The kit around it
`bonusSettled` row, `KIT_VERSION` 0.14.0, `CHANGELOG.md`, the API report, `MODDING.md`.

## Tests
- `chatVisibility` / the shared "shown messages" helper: a hidden message is left out.
- The recovery's search for the waiting text (pure part): found behind a trailing error bubble.
- The carry of a held reply: `until` moved with the messages.
Nothing else.

## Done
- Checks per the README.
- In the running app with no mod using these: everything as before.
- One signed commit on `hooks/after-hours`, pushed to `origin`.
