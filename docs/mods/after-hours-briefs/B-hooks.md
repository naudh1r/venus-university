# Brief B — core hooks `slotInterlude`, the late-night clock and `relaxLabel`

**Branch:** `hooks/after-hours`. Read `docs/mods/after-hours-briefs/README.md` first (on
`mod/after-hours`) and keep every rule in it. Nothing on this branch names After Hours.

## Read first
`DESIGN_GUIDE.md` "The slot cycle", "The Bunnyboard" and section 4; `MODDING.md` "Hook points";
`UI_STYLE_GUIDE.md` for the landing. Then `beginSlot` and `crossSlotBoundary` in
`src/renderer/stores/gameLoop.ts`, `src/renderer/stores/loop/relax.ts`, the landing in
`src/renderer/views/GameView.tsx` (`slotActions`, `:1828`; the row handler, `:1892`; `onGoTo`, `:1909`),
`src/renderer/stores/textingLoop.ts`, `src/renderer/prompts/textingPrompt.ts`,
`src/renderer/views/BunnyboardModal.tsx`.

## What this is for
A mod may hold a slot before it opens and show an **interlude**: the landing as the finished slot looked,
some lines, its own rows, the phone open. The first user is a night after the evening: the clock has
already moved to the morning (so texts sent then are filed by the morning's texting ledger), but the
screen, the girls' texts and the phone read as late on the night before.

## 1. `slotInterlude` (renderer, kind `first`)

```ts
export interface InterludeCtx {
  from: { date: number; time: TimeSlot }   // the slot that just ended
  to: { date: number; time: TimeSlot }     // the slot about to open; the clock already reads this
  semesterIndex: number
}
export interface InterludeRow {
  label: string
  /** Asked first in the game's own ConfirmModal; the row acts only on its confirm. */
  confirm?: { title: string; message: string; confirmText: string; cancelText: string }
  /** Called once the row is confirmed, before the slot opens: the mod records what it needs. */
  onPick?: () => void
}
export interface Interlude {
  lines: readonly string[]       // played as narration before the rows, as an opening's lines are
  rows: readonly InterludeRow[]  // every row lets the slot open as normal
  clock?: 'late-night'           // section 2
}
slotInterlude?: (ctx: InterludeCtx) => Interlude | null
```

- **Where:** `beginSlot`, after the game-over branch and **before** the graduation branch (a night before
  graduation morning is held like any other). `from` is the slot before `to` (`prevSlot`).
- **Asked once per entry into `beginSlot`**, so a reload of the boundary save, or of a manual save taken
  during the interlude, lands back on it. Picking a row continues `beginSlot` from the hold point and does
  not ask again.
- **Nothing of `to` happens while held:** no spring break or Homecoming settle, friend requests, shifts,
  grades, bot messages, feed rolls, overlay, opening call, narration, deliveries or fold. All of it runs
  after a row is picked, exactly as today.
- **The screen while held** is the normal landing, drawn as the `from` slot: its date banner, its half's
  theme, background, sky and weather mark, and its room sound. The interlude's `lines` play first, then:
  - the rows are the interlude's rows only: no commitments, suggestions, Relax or plan buttons
  - no text box, no map Go (the map may open to look; its live rows show nobody), no gift
  - the phone works as on any landing, under section 2
- **Saving:** a manual save is offered as on a landing and records no scene, so it loads back into the
  interlude. Leaving for the menu writes nothing, as from a landing.
- **Also a kit reader** `interludeNow(): (InterludeCtx & { owner: string; clock?: 'late-night' }) | null`,
  and `useInterludeNow()` for components.
- Off-switching the owning mod while held: the next `beginSlot` entry asks nobody and opens normally; the
  current hold stays until a row is picked.

## 2. The late-night clock

While an interlude with `clock: 'late-night'` holds:
- **Stamps:** a message appended to a thread is stamped with the clock (`to`) as today, plus a new optional
  field on `ChatMessage`, `late?: true`. The texting ledger of `to` still reads it.
- **Printing:** everywhere a message's slot is printed — `formatChatDivider` in `textingPrompt.ts:185`, in
  the hangout classifier's stubs, in the ledger's message blocks, and on the thread's dividers in
  `BunnyboardModal.tsx:1120` — a `late` message prints as late on the `from` night (one function decides,
  e.g. "Mon, Feb 23, late night"), so neither the model nor the player reads it as the morning.
- **Her DM prompt's NOW block** (`textingPrompt.ts:502-508`): "It is late on <from date> night"; no
  "classes are starting soon" line; the `from` slot's weather; in place of her whereabouts, that she is
  in her dorm room for the night (a graduate: at home). `meetUpLines` (`:531`) is left out.
- **The hangout classifier** is handed the `from` slot and told it is late at night.
- **Nobody is busy:** the composer's gate (`charBusyNow`, `BunnyboardModal.tsx:1004`), `atWork` beside it,
  and the Incoming Texts gate in `sendIncomingMessage` read nobody as in class or at work. Presence rows
  ("where she is now") show nothing.
- Reach-outs and invitations are only delivered by `beginSlot`, so none arrive while held.

## 3. `relaxLabel` (renderer, kind `first`)
`relaxLabel?: (ctx: { date: number; time: TimeSlot }) => string | undefined`. The first answer replaces
the Relax row's words (`slotActions.ts`, `relaxAction`); none keeps the game's own. Relax's behaviour does
not change.

## 4. The kit around them
`HOOKS` rows, `ModHooks`, dispatchers, the bridge exports (`InterludeCtx`, `InterludeRow`, `Interlude`,
`interludeNow`, `useInterludeNow`), `KIT_VERSION` 0.8.0 → 0.9.0, `CHANGELOG.md`, the API report, and
`MODDING.md` (rows in the hook table and a paragraph for `slotInterlude` and the late-night clock).

## 5. Tests
The kit's contract and slot tests. One test for the pure function that prints a message's slot (a `late`
message prints as late on the night before; others unchanged). Nothing else.

## 6. Done
- `npm run typecheck`, `npm test`, `report:check` pass.
- In the running app with no mod using these hooks: the slot change, Relax, the landing, texting and the
  phone are exactly as before.
- One signed commit on `hooks/after-hours`, pushed to `origin`.
