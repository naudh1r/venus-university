# After Hours core hooks — code review

Reviewed **2026-11-17**, as a proposed change to the org's `core`.

| Item | Revision |
|---|---|
| Reviewed commit, `naudh1r/venus-university:hooks/after-hours-core` | `23a162c5e9bffd112ddd78c8c596b2cfee63cffa` |
| Base, `venus-extracurriculars/build:core` (also the merge base) | `a45b37587966041754020b221aa2bc19a2848c18` |
| Mod consumer read for context, `mod/after-hours-kit` | `08fad11b4f12908cb4d9b0c455e47064da1542e0` |

The measured diff is **73 files, +2,406 / −339**. This review covers the core changes, not a second review of the mod. The reviewed kit is **0.22.0**.

**Recommendation:** address the three **should fix** findings below before merging. No blocking finding was established. All findings below were traced; the limitations section distinguishes what was not proved.

## Checks

| Check | Result |
|---|---|
| Dependency setup | Passed using the committed lockfiles |
| `chmod +x node_modules/7zip-bin/linux/x64/7za` | Passed |
| `npm run typecheck` | Passed, exit 0 |
| `npm test` | Exit 1: only the known `getComfyOutputFilePath` failure |
| Kit API report and external declaration consumer | Passed |
| Additional scratch reproductions | 5 passed; they assert the observed defects, not corrected behavior |

Final full-suite output:

```text
Test Files  1 failed | 215 passed | 3 skipped (219)
     Tests  1 failed | 2595 passed | 4 skipped (2600)
```

The sole failure is the known Linux handling of a Windows-style filename:

```text
FAIL  test/mainServices.test.ts > getComfyOutputFilePath >
refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }

- Expected:
{
  "code": "COMFY_OUTPUT_PATH_INVALID",
}
+ Received:
undefined

❯ test/mainServices.test.ts:182:22
```

Setup deliberately used `npm ci` and `npm --prefix packages/modkit ci` instead of `npm install`, to honor both lockfiles without modifying tracked files. Both exited 0. Commands ran on Linux with Node v24.19.0, npm 11.9.0 and Vitest 4.1.11. Electron's executable path was supplied from a scratch installation for Node test imports; Electron UI execution was not part of these results.

For the extra kit check, committed source was exported to a scratch directory and the unmodified `packages/modkit/scripts/report.mjs --check` was run there. This kept its generated declarations and temporary files outside the repository. Output:

```text
Analysis will use the bundled TypeScript version 5.9.3
Analysis will use the bundled TypeScript version 5.9.3
Analysis will use the bundled TypeScript version 5.9.3
The API report is up to date.
```

## Findings, most severe first

### 1. Should fix — the night ending drops paid results from its resumable save

**Locations:** [`src/renderer/stores/gameLoop.ts:3334`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/gameLoop.ts#L3334), [`src/renderer/stores/loop/saves.ts:458`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/loop/saves.ts#L458). The later opening has the same persistence gap at [`gameLoop.ts:3390`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/gameLoop.ts#L3390).

**Concrete path:** text during the night, choose **Go to sleep**, let the texting ledger finish, and take a manual save while reading its status lines. `finishInterlude` lowers `endingInFlight` after the ledger returns, and the manual-save offer is open. However, `manualSaveDraft` returns `interludeBase`, captured before the choice, with `scene: null`. The paid result is not in that snapshot. `bankTextLedger` stores it only in `sceneTextLedger`; its autosave path returns immediately when `loopState.decisionSave` is null, as it is on this held landing. Reloading that manual save therefore returns to the night with no banked result, and sleeping requests the ledger again for the same messages. The cost repeats and its verdict can change.

This is not merely an inferred serialization problem: the scratch reproduction invoked the actual `finishInterlude`, supplied one successful ledger response, advanced to status playback and checked the real save offer and draft. It observed an open offer, `scene: null`, and zero autosaves before playback. The saved draft contained no ledger result.

`MODDING.md` explicitly documents replaying the choice and rerunning the ending when closing before the final write. That makes the reset intentional; it does not preserve the already-paid result. The finding is the regeneration of paid bookkeeping, rather than the fact that a status save replays a choice. This differs from the ordinary scene-ending save, which retains its paid results.

There is also a source-traced window after morning generation: `ready` holds the completed opening only in a local variable. The function clears the stage and writes a scene-less slot save **before** awaiting the morning curtain and calling `beginSlot(true, ready)`. Until `foldOpeningIntoSlotSave` later completes, a reload has the completed-night marker but none of that paid opening. It generates another opening. This second window was traced in source; the scratch runtime reproduction covered the earlier ledger/status window.

**Suggested fix:** persist a resumable night-ending phase containing its input message IDs and paid ledger before exposing status playback. A status save may still replay from before application, but must retain the result so application remains once-only. Persist the generated opening and its rolled context with the completed-night checkpoint before the curtain wait, then consume it on load instead of requesting it again.

### 2. Should fix — held-reply recovery builds a request before the saved lorebook loads

**Locations:** [`src/renderer/stores/gameLoop.ts:3454–3459`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/gameLoop.ts#L3454-L3459), [`src/renderer/stores/textingLoop.ts:1983`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/textingLoop.ts#L1983).

**Concrete path:** customize a playthrough's setting or lorebook, send a busy-time text, save while its background reply is unfinished, then load that save. `enterGame` starts `lorebookStore.load()` without awaiting it and immediately calls `resumeHeldReplies()`. For an eligible pending turn, recovery synchronously constructs and sends a new DM request. `lorebookStore.load` has already reset its book and setting to shipped values, but its asynchronous disk/database read has not completed. `textingState` and `readerBlockOf` therefore build that reply against the shipped world instead of the playthrough's saved edits. The later read cannot change the request already sent.

The scratch reproduction held the lorebook read unresolved, resumed a saved `awaitingReply` turn and observed `completeTexting` called while lorebook status was `loading`. The request lacked a distinctive saved-world marker that appeared in the effective setting once the read resolved.

**Suggested fix:** schedule held-turn recovery after `lorebookLoaded()` and recheck the run/load identity after the await. Re-read the live conversation and in-flight ownership before sending, so waiting for the book cannot duplicate a turn already resumed elsewhere. Run recovery after any restored interlude context needed by its prompt is established as well; the confirmed defect here is the lorebook race.

### 3. Should fix — the new native optional save state is consumed without shape validation

**Locations:** [`src/renderer/stores/textingLoop.ts:1904`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/textingLoop.ts#L1904), [`src/renderer/stores/gameStore.ts:1947`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/renderer/stores/gameStore.ts#L1947), [`src/shared/chatVisibility.ts:18`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/shared/chatVisibility.ts#L18). Shared read policy: [`src/shared/saveRules.ts:153`](https://github.com/naudh1r/venus-university/blob/23a162c5e9bffd112ddd78c8c596b2cfee63cffa/src/shared/saveRules.ts#L153).

**Concrete paths, both reproduced:**

1. Load an otherwise complete schema-13 save whose conversation contains `"heldReply": {}`. `SAVE_READ` accepts it: it checks required top-level keys but supplies no inner-shape check. `enterGame` then calls `releaseHeldReplies`, which passes the missing `held.until` into `messageShown`. Accessing its date throws a `TypeError`, aborting entry after the save has passed the storage read rule. A due hold with a missing or non-array `messageIds` reaches another unchecked `.includes` call.
2. Load a scene save with `"chatShownThrough": {"date":"invalid","time":0}`. It also passes `SAVE_READ` and is copied into the store. `chatClockOf` trusts it; visibility comparisons become comparisons against `NaN` and return false for valid messages. The same projection feeds the thread and texting-ledger input, so messages can disappear from display and bookkeeping until a later `openChatSlot` replaces that clock. A scene load does not immediately open a new chat slot.

**Does the known lack of `heldReply` validation matter? Yes.** It is now dereferenced during ordinary game entry, even if no mod is currently enabled. The demonstrated impact is failed loading and invalid message projection, not a claim that the normal writer produces malformed holds or that a clean save file is structurally corrupted on disk.

`heldNightField` validates listing metadata on both storage backends, which is useful, but that helper does not validate the native save used for entry. The new message flags also need an explicit policy: absence or literal `true`, rather than trusting arbitrary truthy persisted values.

**Suggested fix:** add shared validation for present native optional fields before returning a typed save on desktop and web. Check finite safe-integer clocks and allowed slot values, the complete hold structure and IDs, literal optional flags, and opening-playback shape/index bounds. Either reject malformed native state with `SAVE_MALFORMED`, or normalize it through an explicit recovery policy that preserves the player's messages. Keep absence valid for older saves and leave unrelated mod slices untouched.

## Reproduction evidence

The scratch harness and its configuration lived under `/workspace/work/after-hours-review`, outside the repository. It imported the reviewed modules and mocked the bridge. A Vite transform appended exports for private cycle entry points in memory; no tracked source or behavior was patched. The fifth probe exercised the real sleep-ending flow; the other probes exercised the save validator, delivery, recovery, and save-draft functions directly.

Command:

```sh
NODE_USE_ENV_PROXY=1 \
ELECTRON_OVERRIDE_DIST_PATH=/workspace/work/mod-audit/electron-dist \
node node_modules/vitest/vitest.mjs run \
  --config /workspace/work/after-hours-review/vitest.config.ts
```

Observed output:

```text
CONFIRMED: SAVE_READ accepts heldReply {}, releaseHeldReplies throws TypeError
CONFIRMED: SAVE_READ accepts invalid chat clock, visible-message projection becomes empty
CONFIRMED: completeTexting called while lorebook status is loading
CONFIRMED: sleep status permits a manual save, but the draft contains no paid ledger
CONFIRMED real flow: one ledger result landed; status save has scene null; zero autosaves before playback

Test Files  1 passed (1)
     Tests  5 passed (5)
```

## Checked and found fine

- Held reply messages are future-stamped and hidden from native thread projections, previews, sounds and current-slot ledger input. Opening a chat slot excludes held IDs from its generic unread increment, leaving the hold's delivery pass to count them once. `opened` and `chatShownThrough` retain that accounting on well-formed saves.
- A successful held reply clears its waiting flags; a replacement reply removes the prior held message IDs. Scene entry keeps held flights running, while leaving marks them abandoned. Ownership checks prevent an old flight's cleanup from clearing a replacement flight.
- Shared-class waits are generated after attendance is recorded at the class boundary. Both `until` and `afterClass.date`, as well as message dates, are shifted during semester carry. Missing current classes and meetings use guarded lookups during recovery.
- The night ledger selects unclaimed `late` messages. Application claims only the captured message IDs, leaving subsequent messages unclaimed, and ordinary morning selection skips claimed messages. The pure selection/claim tests pass. This does not remove finding 1's persistence gap.
- New `finishInterlude` continuation points check `runStale` after their awaited cast, ledger/status, opening, save and crossing steps. The room-read completion also guards its store write. This is a check of those new continuations, not proof of every scheduler interleaving in the game.
- Without enabled providers, `hangoutCheck` permits the native classifier, `textWhileBusy` leaves the timetable gate closed, and interlude/opening-look/Relax replacements have neutral defaults. Saved opening dialogue falls back to narration when the current look does not stage its speaker. Existing native scene/block/failure gates remain in the composer.
- Opening lines accept only recognized speakers and expressions, with malformed dialogue reduced to safe narration. Split pages retain written-line indices; saved openings retain reply, pages and playback position and rebuild the current stage from the active hook. Stage-only state is excluded from their saved thumbnail layers.
- Hook names, dispatch sites, exports and API snapshots agree. `hangoutCheck` implements an enabled-mod false veto, `textWhileBusy` an enabled-mod true permission, and first/additive hooks follow the documented order. The hook-table `since` values agree with the relevant changelog entries; `chatClock` is annotated `@since 0.14.0`. Kit package/version constants agree at 0.22.0. The regenerated API comparison and standalone declaration consumer pass.
- The remaining changes to date labels, calendar/map restrictions, load listings, thumbnails, desktop/web summary propagation, prompt context and helper tests were reviewed. No additional traced finding is claimed from them.

## Limits and preservation

This was source review plus the required unit/type checks and targeted state/bridge reproductions. It was not an Electron UI playthrough, an exhaustive save/load/rewind state-space test, or proof that every no-mod execution is byte-for-byte equivalent to the base. No additional unverified defect is promoted to a finding.

The code checkout and original repository remained clean in `git status --short`. `DESIGN_GUIDE.md`, `UI_STYLE_GUIDE.md`, `README.md` and `TESTING_PLAN.md` were not edited. Scratch files and generated API-check artifacts stayed outside the code checkout. Per the output instruction, the only publication change is this report on the fork's `notes/standalone-mods` branch; no code fixes or PR were made.
