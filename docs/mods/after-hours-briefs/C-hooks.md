# Brief C — core: the bonus scene and interlude places

**Branch:** `hooks/after-hours`. Read `docs/mods/after-hours-briefs/README.md` first (on `mod/after-hours`)
and keep every rule in it. Start by resetting `hooks/after-hours` to `origin/hooks/after-hours` (ec83f514
or later). Nothing on this branch names After Hours. Kit 0.9.0 → **0.10.0**.

## Read first
`DESIGN_GUIDE.md` "The slot cycle", "Casting", "Rumors", "Colds", section 4 and 5; `MODDING.md` for
`slotInterlude`, `hangoutVerdict`, `slotSettled`. The code: `beginSlot`, `runEnding` (`gameLoop.ts:1982`),
`fetchEndingOpening` (`:2098`), `claimTextLedger` (`:2475`), `crossSlotBoundary` (`:3020`) in
`src/renderer/stores/gameLoop.ts`; `handleHangout` / `armHangout` / `beginHangout`
(`textingLoop.ts:998-1043`); `startHangoutScene` (`loop/hangouts.ts:104`); the `herRoom` / `hisRoom`
invite kinds (`loop/sceneEvents.ts`) and how a hangout answering one is cast in that room.

## What this is for
During a late-night interlude (Brief B) a girl and the reader may agree to spend the night in her room or
his. That is a **bonus scene**: a full, normal cast scene that does not move the clock. After it, the
interlude may show a morning-after in a room other than his, whose rows can start a normal scene of the
slot with her, or open the slot with a line of their own first.

## 1. Interlude additions
```ts
export interface Interlude {
  lines: readonly string[]
  rows: readonly InterludeRow[]
  clock?: 'late-night'
  /** How the held landing looks; default: the `from` slot in his room. */
  look?: { time?: TimeSlot; room?: { kind: 'herRoom' | 'hisRoom'; charId: string } }
  /** Asked when a DM verdict would arm a hangout while held; see section 2. */
  onHangout?: (verdict: HangoutVerdict, ctx: HangoutVerdictCtx) => { room: 'herRoom' | 'hisRoom' } | null
}
export interface InterludeRow {
  label: string
  confirm?: { title: string; message: string; confirmText: string; cancelText: string }
  onPick?: () => void
  /** Lines played at the head of the opening's narration once the slot opens. */
  lead?: readonly string[]
  /**
   * Opens the slot quietly — every settle, delivery and the fold as today, its narration not played —
   * then starts a normal scene of the slot: `charId` cast, in that room, private, `action` as the
   * reader's action. No classifier.
   */
  scene?: { charId: string; room: 'herRoom' | 'hisRoom'; action: string }
}
```
- `look.room` draws the landing in that room's background (her room's render, falling back as a room
  does today), at `look.time` (default the `from` half).
- `lead` and `scene` are exclusive on a row.

## 2. The bonus scene
- **Arming:** in `runReply`, after `hangoutVerdict` runs, if an interlude holds and has `onHangout`, the
  verdict goes to it. `null` drops it. `{ room }` arms the game's own **Begin hangout** button as
  `armHangout` does, remembering `room`; no prefetch of a normal hangout scene.
- **Begin:** starts a bonus scene: her cast, in `room`, private, the verdict's description as the
  reader's action, no classifier, no curveball roll. The scene state carries `bonus: true` (saved on the
  scene, so a reload mid-scene resumes it as a bonus scene).
- **Its prompts** read the interlude's `from` slot as now: late on that night, its weather. Everything
  else is a normal cast scene: turns, interjections, gifts, rewinds, the closing.
- **Its ending** runs the scene ledger and the closing as any scene. It does **not** claim the texting
  ledger (the night's texts belong to the next slot and are ledgered by its scene). Its projection rolls
  only what comes from the scene itself: memories, events, acts and the rumor pass off them, the crush
  roll, the cold pass between the people in it. It does not roll the roster's off-screen encounters,
  affinities or overlay: those belong to real slots.
- **The next opening** is fetched again after the bonus ending, since the banked one was written before
  the night. It keeps every pick the banked one rolled (spring break, Homecoming, the overlay, invitation
  rolls) and replaces the banked opening.
- **Its boundary** applies the ledger and the passes, asks the memory question, runs `slotSettled`, then
  **does not call `advanceSlot`**, keeps no replay, writes a slot save, and enters `beginSlot` again,
  where `slotInterlude` is asked anew.
- **Mods are told:** `slotSettled`, `slotStatusLines`, `projectSlotMemories`, `exercisedStats` and
  `settleSceneStats` get `bonus: true` in their context for a bonus scene (absent otherwise), so a mod
  that counts once per slot can tell it apart.
- **Game over** in a bonus scene ends the game as from any scene.

## 3. The kit around them
Types and docs for everything above; `HangoutVerdict` and `HangoutVerdictCtx` already exported;
`KIT_VERSION` 0.10.0, `CHANGELOG.md`, the API report, `MODDING.md` (the interlude's new fields, the bonus
scene, the `bonus` flag).

## 4. Tests
The kit's contract test. One pure test, if a pure function decides it: which passes a bonus ending rolls
and which it skips. Nothing else.

## 5. Done
- Checks per the README.
- In the running app with no mod using the new fields: everything as before, Brief B's interlude included.
- One signed commit on `hooks/after-hours`, pushed to `origin`.
