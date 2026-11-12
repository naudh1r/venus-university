# Brief D — core: a morning bonus scene that pays no stats

**Branch:** `hooks/after-hours`. Read `docs/mods/after-hours-briefs/README.md` first (on `mod/after-hours`)
and keep every rule in it. Reset `hooks/after-hours` to `origin/hooks/after-hours` (2caa5019 or later).
Nothing on this branch names After Hours. Kit 0.11.0 → **0.12.0**.

## Read first
`MODDING.md` for `slotInterlude` and the bonus scene; Brief C's code: the bonus scene in
`src/renderer/stores/gameLoop.ts` (`sceneBonus`, `fetchEndingOpening`, `crossSlotBoundary`,
`resolveScene`), `startRoomScene` in `src/renderer/stores/loop/hangouts.ts`, `promptState` in
`loop/promptState.ts`.

## What this is for
After a night together, the morning opens on a short normal scene with her in that room: dialogue, her
plans for the morning, the narration leading him on. It is a bonus scene (no clock move) set in the
**morning**, and it leaves memories but pays no stats or money.

## 1. `Interlude.scene`
```ts
export interface Interlude {
  // …as now…
  /** Start this bonus scene at once instead of showing the held landing. */
  scene?: {
    charId: string
    room: 'herRoom' | 'hisRoom'
    action: string
    /** Which half the scene is set in: the held night (as an `onHangout` visit) or the opening slot. */
    at: 'night' | 'morning'
    /** False: the scene leaves memories, events and acts, and pays no stats and no money. */
    pays: boolean
  }
}
```
- When `slotInterlude` answers with `scene`, `beginSlot` does not draw the landing or play `lines`: it starts
  the bonus scene straight away (as `startRoomScene` does for a bonus visit), from under the curtain the
  boundary left down, revealing on the scene's first line.
- `at: 'morning'`: the scene's prompts read the clock as it is (the opening slot): no `lateNight`, its own
  weather, her class or shift this slot as any scene's cast entry shows it.
- `pays: false`: `resolveScene` returns no stat deltas and no stat lines, and the ledger's money is not
  applied; memories, events, acts and the passes off them, colds included, are kept. Mods see it on
  `StatContext` as `pays: false` beside `bonus: true`.
- Everything else is Brief C's bonus scene: no clock move, no texting ledger, no roster rolls, no replay,
  the next opening fetched again with its picks kept, then `beginSlot` again where `slotInterlude` is
  asked anew. Saved on the scene, so a reload mid-scene resumes it as this bonus scene.
- The visit started by `onHangout` is `at: 'night'`, `pays: true` (unchanged).

## 2. The kit around it
Types, `KIT_VERSION` 0.12.0, `CHANGELOG.md`, the API report, `MODDING.md` (the `scene` field, `at`, `pays`).

## 3. Tests
The kit's contract test. If a pure function decides what a non-paying scene keeps, one test for it.

## 4. Done
- Checks per the README.
- In the running app with no mod using it: everything as before, Brief C's visit included.
- One signed commit on `hooks/after-hours`, pushed to `origin`.
