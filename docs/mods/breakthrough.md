# Breakthrough

The Echo ability option is read through the kit: `useModOption` keeps the panel reactive,
and renderer `modOptionOn` checks the current value at activation. Both preserve the native
declared default when an override is absent; the separate Echo on/off gate still applies.
The store and panel no longer import the native mod-switches store for these reads. A
standalone manifest declares the corresponding renderer capabilities.

Breakthrough is a standalone **anytime** mod. It needs neither Story & Social nor SQLite.
The scene's upper-right card shows a spirit bar for each present character. Choose one,
expand the card, and at 100 spirit write what the player does and what they hope changes.
The bar resets to zero immediately. The normal scene call receives a strong favorable
direction for that response, subject to personality, consent, established facts, and
plausibility. It does not force relationship flags or guarantee a specific result.

## Earning spirit

The scene boundary first applies its normal ledgers, gifts, and NPC effects, then offers
the game's memory editor. `settleSpirit` runs **after the final edits**, before the clock
moves and before the slot save. This preserves the original mod's balance:

| Final new memory | Change |
| --- | --- |
| Liked | +10 |
| Loved | +20 |
| Hated | −15 each |
| Disliked | 0 |

Positive gains are capped at 20 per character per day/night slot; hated penalties are then
subtracted. Meters stay between 0 and 100. The pass compares memories and the slot's text
memory against their pre-boundary values, deduplicates identical entries, and records the
settled slot. Reloading a boundary cannot award it twice. Raw dialogue sentiment is not
scored separately, and changing an old memory outside this boundary earns nothing.

Existing playthroughs can enable the mod, but old interactions are not retroactively scored.
An older save without `exBreakthrough` starts empty. No personal saves or example histories
are included. Turning the switch off preserves data and stops earning, activation, and the
extra continuity context. Enabling it again uses the retained meters and outcomes.

## Activation and failure handling

Availability follows the native `interjectOfferOf` and `replyRowOfferOf` rules, plus the
ordinary decision-point input window. The target must still be present, with a full bar.
Exams, a locked class opening, status screens, game over, and unresolved turn errors block
activation. UI overlays and hidden/covered chrome block the control as well. It is usable
mid-reply wherever the native action box can interrupt, not just at the end of a reply.

1. Validate the 1–1,000-character action/direction and create a unique activation ID.
2. Store the paid intent and reset only that target's meter to zero.
3. Dispatch **synchronously** through native `interject`. That code owns cancellation,
   unread-tail truncation, and decision-point saves. No asynchronous save is inserted
   before dispatch, which would race playback.
4. Carry the intent in the turn snapshot. Add the one-response advantage to the normal
   request only while its target, playthrough, date, time, and mod switch still match.
5. On a successful sanitized response, store its actual dialogue and transcript range,
   clear the pending intent, then let the normal autosave/ending proceed.

A refused dispatch, invalid target, empty output, or native turn failure refunds the bar
once. Interrupting the in-flight paid turn refunds its own token; a late result cannot
consume a newer activation. A pending activation found on load is refunded and cleared.
The native silent content-block retry keeps its existing paid token. An explicit retry
after a failure re-spends the returned bar; it cannot repeat the advantage for free.

At 100 spirit the selected character's bar turns gold and the card gains a gold outline
and glow. Selecting a character below 100, or spending the meter, returns the normal
accent bar. READY also identifies the full state in text.

Activation restores the original rectangular announcement: gold double rules and star
ornaments, the character's uppercase name, the large Breakthrough title, and “Make this
moment matter.” A soft gold halo accompanies its gentle rise and fade over 2.6 seconds.
The surface and text follow the native day/night palette; the gold state colours and
soft glow are deliberate presentation choices specific to this mod. Timing lives in
`views/motion.ts`; reduced motion holds the card still for the same duration without the
halo. It does not block clicks. Scrolling or typing inside the spirit card does not
advance the scene. This presentation does not change scoring, activation, or save data.

## What it remembers

`exBreakthrough` is an optional save field:

```ts
{
  meters: { [charId]: number },
  settled: { ["date:time"]: true },
  pending: null | { id, charId, direction, date, time, playthroughId },
  moments: { [charId]: [{ id, date, time, outcome, transcriptStart, transcriptCount, spent? }] }
}
```

`outcome` comes only from accepted generated lines. A requested victory is never converted
into a fact by storing its instruction. Keep up to six outcomes per character, at most
12,000 characters each. Scene and text prompts take the latest three relevant outcomes,
at most 6,000 characters each, under a 24,000-character JSON budget. Actual token cost
depends on the model and usually rises only after the player has used Breakthrough.

New scenes, hangouts, continuations, and closings share the cast-scene prompt hook. Texting
uses the same continuity builder for its single recipient. Other characters' private
events and future-dated entries are not selected. The context explicitly distinguishes
dialogue claims from objective truth and grants no continuing success bonus.

The stored transcript range is reconciled when a line is edited, an unread or preview tail
is cut, or a scene is restored. A leave autosave projected onto an older decision point
also projects this archive onto that transcript. Discarded words cannot persist through
the separate continuity block. New successful activations also record the actual charge
(`spent`: 100 for Normal Breakthrough, or 25/50/75 for an Echo ability). Rewinding to reread
does not change the meter. Submitting a new reply before an activation cuts its entire
response and refunds that recorded charge once, capped at 100. Going back several replies
works the same way. Keeping any of its response or editing dialogue in place leaves it
spent; a later cut before the whole activation can still refund it.

Refunds require a real prefix cut in the same scene slot, with the removed response
matching the recorded outcome. The receipt disappears with that outcome, preventing a
second refund. Pending requests keep their separate failure/refund/retry ownership. An
older decision-point autosave projects both the removed outcome and its refund together,
without changing the live branch. Receipts survive save/load and work even if the mod is
subsequently disabled; replays and Scene Creator cannot issue these refunds. Semester
carry keeps historical outcomes without their scene-local receipts.

Completed activations saved before this change lack a recorded price. They remain spent
when cut: the code cannot safely distinguish an old ordinary use from a cheaper Echo use.
Missing or malformed prices never imply a 100-spirit refund. Pending-load recovery keeps
its existing behavior.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/breakthrough.ts` | Types, defensive imports, final-memory scoring, transcript reconciliation, stable canonical facts. |
| `src/renderer/stores/breakthrough.ts` | Availability, spending/refunds, retries, committed outcomes, one-turn prompt advantage. |
| `src/renderer/prompts/breakthroughPrompt.ts` | Bounded continuity and grounded advantage wording. |
| `src/renderer/prompts/scenePrompt.ts`, `textingPrompt.ts` | Optional context in native scene and text builders. |
| `src/renderer/stores/loop/promptState.ts`, `textingLoop.ts` | Pass state to those builders only while enabled. |
| `src/renderer/stores/gameLoop.ts` | Snapshot intent, explicit retry, interrupted-call refund, boundary scoring. |
| `src/renderer/stores/loop/turn.ts` | Finish or refund on the native turn result. |
| `src/renderer/stores/loop/state.ts` | Typed intent on the transient turn snapshot. |
| `src/renderer/stores/loop/saves.ts` | Align decision-point autosaves with their transcript. |
| `src/renderer/stores/gameStore.ts` | Defaults, load recovery, save export, and edit/truncation hooks. |
| `src/shared/types.ts`, `saveRules.ts` | Optional field, without changing required fields for old saves. |
| `src/shared/modEntries/breakthrough.ts` | Independent anytime switch and pure semester carry registration, with no requirements. |
| `src/renderer/modEntries/breakthrough.ts` | Automatically discovered scene/DM context and settled-slot hooks. |
| `src/renderer/views/BreakthroughPanel.tsx`, `GameView.tsx` | Character selector, bar, action card, flourish, native scene gates. |
| `src/renderer/views/motion.ts`, `vu_styles/Breakthrough.css` | Motion vocabulary and day/night layout. |
| `test/breakthrough.test.ts` | Scoring, repeat settlement, failure/retry/refund, load recovery, native turn commits, edits, privacy, context budgets. |
| `test/breakthroughRewind.test.ts` | Multi-reply branching, all recorded prices, save/load and decision-point projections, partial cuts, duplicates and retry isolation. |

## Integration with other feature ports and future SQLite

The independent `mod/breakthrough` branch is based on `core`. Shared-build merges belong
on `integrate/breakthrough`; preserve the other mods' registrations, optional save fields,
and save projections when resolving overlaps.

Normal and regenerated DM replies use the same `buildTextingPrompt` builder. Its enabled
DM hooks include Breakthrough's continuity: the adapter uses the request's `breakthrough`
state when supplied, or reads the active game's archive. Text Regeneration therefore does
not need its own Breakthrough-specific prompt call. Native character notes and memories
remain present in both paths.

City Life's background filtering and Meanwhile's separate conversation archive remain
independent of Breakthrough. The semester carry adapter preserves Breakthrough's saved
state even while disabled; applying that adapter to a new semester is the separate
semester-carryover integration. Breakthrough stores no external image or audio files,
so it does not register a semester file-copy adapter.

SQLite is intentionally not implemented here. Keep the JSON save authoritative. The pure
`breakthroughFacts` function exposes stable IDs, character IDs, timestamps, and accepted
outcomes. A future memory adapter can index those records without changing earning or
activation. Never index the pending direction as an achieved event. Scope an index by
playthrough and the loaded save branch, remove or replace entries after edits/rewinds, and
deduplicate retrieved IDs already supplied by this bounded continuity block. A database
failure must not prevent spending/refunding spirit or loading a save. SQLite integration
still requires implementation and tests; this port does not claim it is already verified.

## Validation

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:web`.
UI review should cover both palettes and 16:9/4:3 stages, selecting another character,
typing without advancing playback, ordinary and mid-reply activation, the flourish,
failed generation/refund, and reduced-motion behavior. Automated tests stub generation
and saves; live-model narrative effectiveness is not a measured probability.

## Framework registration

- `src/shared/modEntries/breakthrough.ts` supplies its existing mod definition and carry registration.
- `src/renderer/modEntries/breakthrough.ts` loads the hooks automatically at boot.

The stable IDs, defaults, dependencies, save fields and gameplay behavior are unchanged. Native character notes, scene-creator saves and calendar replays remain separate base-game features. Merge framework updates from `core` into this mod branch; resolve conflicts with `main` on a separate `integrate/breakthrough` branch.

## Legacy semester registration

The legacy carry adapter registers at renderer boot, after the shared catalogue, even
while the feature is off. See [Maestro legacy semester carry](legacy-semester-carry.md)
for the adapter paths, retention guarantees and remaining standalone typing limitation.
