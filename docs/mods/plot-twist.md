# Plot Twist

Plot Twist is an independent, default-on `anytime` mod (`plot-twist`). Its only dependency is
the shared mod framework. It does not need Story Memory, SQLite, or another community feature.

## Shared framework integration

Plot Twist uses discovered entries and shared hooks in the community build.
Other feature mods are optional. Native character notes, scene creation and calendar replays
remain separate base-game features.

Its renderer entry contributes a `gameMenuEntry` and the `plot-twist` panel in `gameModals`.
The menu adapter calls the kit's `openPanel`, preserves the native safe-save gate, and lazily
loads the existing editor. Closing returns to the game. GameView and GameMenuModal no longer
import or name the Plot Twist panel. The editor now uses the public kit save field,
game-lifetime editor state and safe-point APIs.
Its `promptState.scene` hook captures the bounded text under `PromptState.ex['plot-twist']`;
the scene formatter reads that captured value. Core's snapshot builder and `PromptState` type
no longer name Plot Twist. This is still an in-repo mod; legacy carry-over and packaging work
remain before it can become an independently installed release.

## Player behavior

Turn it on in **Mods**, then open **Game menu → Plot Twist** during a playthrough. Write one
ongoing direction, up to 10,000 JavaScript string characters, and choose **Apply twist**. New
scene requests include that direction until it is replaced, cleared, or the mod is switched
off. Applying or clearing writes an autosave, including the current native scene checkpoint.
It does not replace manual saves or older boundary saves. Loading an older save restores that
save's own twist. **Back**, Escape, and the veil discard unapplied edits.

The editor waits while the game cannot safely save (including generation, pending text
messages, error/retry states, and status editing). It cannot change an already-generated reply.
Previously established events remain in the story after clearing or disabling the direction.
The model is asked to introduce secrets through plausible discoveries and preserve established
facts; this is narrative guidance, not guaranteed obedience or a direct mechanical mutation.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/plotTwists.ts` | Registry definition, limit, validation, legacy reading, bounded active text, optional save type |
| `src/shared/mods.ts` | Registers the independent switch; no `requires` |
| `src/renderer/stores/plotTwist.ts` | Registers `saveField`, legacy normalization, semester carry and a game-lifetime editor token; validates edits and delegates writes to the kit |
| `src/shared/plotTwistCarry.ts` | Accepts old, already-prepared semester continuations containing `mods.exPlotTwist` |
| `src/renderer/stores/loop/promptState.ts` | Generic `promptState.scene` outlet; no Plot Twist import or projection |
| `src/renderer/prompts/plotTwist.ts` | Pure story-direction prompt block |
| `src/renderer/prompts/scenePrompt.ts` | Cast opening, continuation and closing; solo-scene hook |
| `src/renderer/modEntries/plot-twist.ts` | Registers the prompt snapshot, prompt lines, lazy menu entry and panel provider |
| `src/renderer/views/PlotTwistEntry.tsx` | Uses the kit's menu item, safe-save status and `openPanel`; adapts the existing editor |
| `src/renderer/views/GameMenuModal.tsx` | Generic `gameMenuEntry` outlet, without a Plot Twist callback |
| `src/renderer/views/GameView.tsx` | Generic blocking panel host, without a Plot Twist import or panel case |
| `src/renderer/views/PlotTwistModal.tsx` | Draft editing, counter, apply/clear, pending/error feedback |
| `src/renderer/vu_styles/PlotTwist.css` | Native day/night colors, text-well scrolling and fixed actions |
| `test/plotTwist.test.ts` | Legacy data, save checkpoints, write ordering, failures, and stale completions |
| `test/plotTwistCarry.test.ts`, `test/maestroNativeSemesters.test.ts` | Legacy continuations, disabled retention, all eight native semesters and independent sibling branches |
| `test/plotTwistPrompt.test.ts` | On/off routing into actual scene builders and immutable captured requests |
| `test/maestroMenuHooks.test.ts` | Menu/panel registration, switches, safe-save gating, theme and return destination |

## Save compatibility and transaction

Version 1.1.0 stores its text in `save.ex['plot-twist'] = { v, data }`. Its renderer entry
registers the field at boot even while the mod is off. On load, the field's normalizer reads
`exPlotTwist` from old saves when no current slice value exists. The next save writes the
versioned slice and omits the consumed legacy key. A current empty string wins over old text,
so clearing a twist cannot revive it on a later load. Other mods' slices stay untouched.

Missing/non-string values become empty. Legacy strings load verbatim, including oversized
ones; only the trimmed prompt copy is capped at 10,000 characters. Newly submitted oversized
edits are rejected. Loading migrates in memory; it does not rewrite the source file until an
ordinary save occurs. No sidecar, database, custom IPC or save-schema change is needed.

The mod's write wrapper validates text, verifies the editor's game-lifetime token, and calls
`saveField.write(next, { expect: previous })`. The kit owns safe-point checks, the save queue,
the native resumable checkpoint, the manual-write lock, switch checks and run/load fencing.
It commits the live slice only after a successful disk/IndexedDB write, and updates a frozen
status checkpoint without copying already-awarded money into it. Failure leaves the live
value and draft available for retry. The editor cannot close during its own pending write.

The editor token is created on mount and invalidated on unmount or any game load/reset.
This separately prevents an old editor writing into a newly loaded save with *identical*
text; value equality alone cannot detect that. Expected-value checks also reject a superseded
edit in the same load. An already-dispatched write can finish for its old playthrough, but
cannot update the newly loaded game or report success to its old editor.

The field's `carry` returns the text unchanged for a new semester, independently of its switch.
The legacy carry adapter remains only to admit `carry.mods.exPlotTwist` from a continuation
prepared by an older build; its opening save then goes through the same normalizer. New
continuations carry the versioned slice under `carry.ex`. Fresh games start empty. Removing
the mod keeps its stored slice; reinstalling lets the field read it again.

This is forward migration, not a promise that an old build can read the new slice. Preserve
an original save when testing a downgrade. Version 1.1.1 moves prompt capture to the generic
`promptState.scene` hook; a standalone manifest must declare it as well as `prompts.scene`.
Core captures a detached copy only while the mod is enabled. An old core lacking this hook
must mark that build as needing an update rather than load it with an absent story direction.

## Prompt scope and cost

The active text is included once in the `user` portion of cast opening, continuation and
closing requests and solo-scene requests. The system message, schema and cache key are
unchanged. It is not directly added to classifiers, ledgers, slot introductions, text
messages, character generation, or unrelated prompts. Native summaries can naturally carry
events that result from a twist after they happen in a scene. It does not grant stats, flags,
inventory or calendar events directly, and is not a replacement for persistent memory.

Each supported scene request pays for the active text again; short directions cost less.
Turning the mod off omits the direction from newly built requests but preserves saved text.
Already formatted, prefetched, or retried requests retain their original contents. A captured
snapshot retains its text across later edits, but the prompt hook still obeys the current
switch when it formats. A snapshot captured while disabled has no twist to add even if the
player enables the mod before formatting it. No callback rereads live text during formatting.

## Extending or porting again

Keep the data field and mod ID stable. Move hooks to the new source equivalents rather than
reintroducing compiled-bundle string replacement. Reuse the new version's save queue and
checkpoint logic; do not write a mid-scene save from a plain UI snapshot. If that game changes
save schemas, use its official migration before loading older saves. This port alone is not
a general 0.2.0-to-0.3.0 save converter.

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:web`. Check the editor
and menu in both themes, with a long twist, during an unsafe save point, after a failed write,
and after turning the switch off and back on. Check that queued reply lines survive reload.
Use synthetic saves; no personal save data is needed for any of these checks.
