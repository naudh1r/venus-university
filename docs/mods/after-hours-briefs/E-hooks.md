# Brief E — core: texting a girl while she is busy, her reply held for the next slot

**Branch:** `hooks/after-hours`. Read `docs/mods/after-hours-briefs/README.md` first (on `mod/after-hours`)
and keep every rule in it. Reset `hooks/after-hours` to `origin/hooks/after-hours` (5f4cf5be or later).
Nothing on this branch names After Hours. Kit 0.12.0 → **0.13.0**.

## Read first
`DESIGN_GUIDE.md` "The Bunnyboard"; `MODDING.md` for `prompts.dm`, `afterDmReply`, `hangoutVerdict`,
`slotInterlude`. The code: `sendText` / `runReply` / `chatMessage` / `deliver` in
`src/renderer/stores/textingLoop.ts`; the composer gate (`unavailable = … charBusyNow(charId)`) and the
thread, Chats list, previews, dividers and unread counts in `src/renderer/views/BunnyboardModal.tsx`;
`appendChatMessage` in `src/renderer/stores/gameStore.ts`; `scheduleInput` in `loop/promptState.ts`;
`beginSlot` / the interlude in `gameLoop.ts`; how Photo Feature appends its DM photo after
`afterDmReply` (`src/renderer/stores/photoTurn.ts`, `photoStore.ts`) — read only, do not change it.

## What this is for
While a girl is in class or at work her composer is shut. A mod may open it: he texts her, her reply is
written at once by the normal texting call, as she will send it once she is out, and it is shown only
when the next slot's landing opens.

## 1. `textWhileBusy` (renderer, kind `any`)
`textWhileBusy?: (ctx: { charId: string; commitment: Commitment }) => boolean` — `Commitment` as
`charCommitmentAt` returns it. Any `true` opens her composer while she is busy (`charBusyNow`); the rest
of the composer's gates (scene, blocked, busy reply, failed turn, epilogue) stay as they are.

## 2. A held reply
When he sends while she is busy and a mod opened the composer:
- **His text** is stamped and shown as now.
- **Her reply is called at once**, the normal texting call, with `heldUntil` in the texting prompt state
  (the next slot's `{ date, time }`) and her commitment, so `prompts.dm` hooks can word the situation.
  Nothing is streamed onto the thread and no typing dots show.
- **Every message of hers that lands while her reply is held** — the reply's texts, and anything a mod
  appends for her afterwards (Photo Feature's photo) until the held slot opens — is stamped with the held
  slot (`date`/`time` of `heldUntil`), whenever it arrives.
- **Hidden until then:** a message stamped in a slot later than the clock's is not drawn in the thread, not
  counted unread, not used as a preview, not rung, and not read by the texting ledger of the current slot.
  When that slot opens (the landing, or a held interlude whose clock is that slot), it shows as unread and
  rings as the landing rings for texts that came under the curtain. One function decides "shown yet".
- **No hangout from it:** the hangout classifier is not run on a held reply.
- **He texts again before it shows:** the held reply is called again with all his texts since, and replaces
  the one held (the earlier held messages are removed). One reply covers them all.
- **A block** in a held reply is applied when the reply shows, not before.
- **A failure** posts the error bubble at once and parks on Retry as today.
- `afterDmReply` gets `held: { date, time }` in its context for a held reply.
- **Saving:** held messages are ordinary messages with a later stamp, written by the next save of any kind.
  A reload before their slot keeps them hidden; a reload after shows them. Leaving from a landing writes
  nothing, as today, so a text and its held reply that no save took are gone together.
- **His text waits for her reply:** his message carries `awaitingReply: true` (a new optional field on
  `ChatMessage`) from when it is sent until her held reply lands, then the field is removed.
- **Not cancelled by a scene:** starting a scene does not cancel a held reply's call (it is for later
  anyway); it finishes in the background and goes out with the next save. Leaving the game does cancel it.
- **Asked again on load:** entering a game whose thread ends on his texts marked `awaitingReply` (the game
  was left, or saved, while her held reply was still being written) sends her held reply again for them,
  held until the slot after the one his last text was sent in, or the current slot if that has passed.

## 3. The kit around it
`textWhileBusy` row, the `held` field on `afterDmReply`'s context, `heldUntil` on `TextingPromptState`,
`KIT_VERSION` 0.13.0, `CHANGELOG.md`, the API report, `MODDING.md`.

## 4. Tests
One pure test for the "shown yet" rule (a message stamped later than the clock is hidden; the clock
reaching its slot shows it). Nothing else.

## 5. Done
- Checks per the README.
- In the running app with no mod using it: a busy girl's composer is shut as before, texting as before.
- One signed commit on `hooks/after-hours`, pushed to `origin`.
