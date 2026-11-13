# After Hours 0.6.0 — review 3

Reviewed `b4ccf40c...cede2b1f19b702ce7390f49637c7604b36ac494e`, including hooks
`a3e6f9bd2c29a02268dd302aa91ac22f5fc8b920`, kit 0.17.0. Both fork branches were
fetched and reset first; merging the freshly fetched hooks reported already up to date.
This round changes no implementation, tests, kit reports or guides.

## Stray code

No unreachable bonus-scene, private-room visit or morning-after implementation remains in the
reviewed diff. The inventory below names a consumer or purpose for **all 254 hunks in 62 files**,
excluding the briefs directory and plan as requested. Two exported readers have no production
caller in the reviewed tree:

- `src/renderer/mods/interlude.ts:20`, `useInterludeNow`: definition, bridge and public re-export,
  `KIT_APIS` row (`packages/modkit/src/shared/hookTable.ts:330`), API report and documentation only.
  After Hours uses **imperative `interludeNow`**, not this React reader. Unused after all among the
  expected-to-stay items. It is an available external-mod API, not a live requirement of this mod.
- `src/renderer/mods/gameReaders.ts:123`, `chatClock`: likewise only its definition, exports,
  capability row, contract export checks, report and documentation. Core uses **`chatClockOf`**;
  After Hours does not render message history and does not call this reader. The distinction matters:
  removing the internal helper would break delivery, while this public wrapper has no current caller.

These affect H007, H021, H027, H034–035, H051, H053, H057, H059, H069–071 and their docs.
By the requested in-tree-consumer criterion, those reader additions are unused surface.
H007/H021/H035/H053/H057/H069/H070 are dedicated to those wrappers or their exports/import;
H027/H034/H051/H059/H071 also contain used entries or declarations. Beyond that exported surface,
no whole hunk without a live consumer or current contract purpose was found.
H009/H042/H045/H048 and their API rows include the API-only context members discussed below.
Public `afterDmReply.held` metadata also has no in-tree handler reading
that member; core supplies it as the documented extension contract. Photo Feature consumes the
reply and message records, with stamping handled in core, and does not need to read `held`.
`InterludeCtx.semesterIndex` (`hooks.ts:46`) and `HangoutVerdictCtx.charId` (`hooks.ts:66`)
are likewise produced public metadata with no current handler reading those members. The rest of
their contexts are used; these are API-only members, not removed-visit state. The `at:'to'`
preview alternative is not returned by After Hours, but core supports it as the explicit default-slot
answer for other mods. It is not an unreachable internal branch.

### Removed-feature search

`Interlude.look`, `Interlude.scene`, row `confirm` / `lead`, `onHangout`, `bonusSettled`, bonus
scene/pay flags, `heldInterlude` / `roomScene` save fields, `armedHangout.room`, `startRoomScene`,
`picksWithout`, kit `charCommitmentAt`, `NightVisit`, agreements/armed state, visit DM/ledger fields,
visit/morning prompts and transition copy have no remaining live implementation in this change.
`HeldInterlude` is a **used type for the quiet landing**, not the removed scene-restoration field.
Core `charCommitmentAt` remains used by normal scheduling, casting and held texting; only its
kit export was removed. Ordinary stat/talent “bonus” variables and ordinary room scenes predate
this feature and remain used. Unknown legacy save fields may be carried opaquely by the existing
save passthrough; that is not a branch that starts a bonus scene.

Every `AfterHours.css` selector matches the current StatusChip/title/hint markup. Every exported
text item is read by the shared catalogue entry or renderer hooks; `roomText` is private and used
by `morningReturnPrompt`. Shared mod code imports only the kit and its own shared text, never
renderer code. No new boundary-allowlist lines or tracked `packages/modkit/dist` files exist.
No Photo Feature or Bunnyfeeds implementation file is changed by the reviewed diff.

### Expected-to-stay inventory

| Item | Actual consumer / result |
| --- | --- |
| `hangoutVerdict` | `textingLoop.runReply` → After Hours Busy filter. Still classified at night, then core drops the result. |
| `chatsHeader` | Bunnyboard ChatList → StatusChip. |
| `slotInterlude` lines / rows / clock | `beginSlot` → GameView quiet room, Sleep and late-night phone. |
| `interludeNow` / `useInterludeNow` | `nightHolds` uses the former; **latter has no runtime caller**. |
| Late-night clock / `ChatMessage.late` | DM context, weather, whereabouts, classifier clock, saved dividers, shown-message helper and ledger stamps. |
| `relaxLabel` / `relaxRows` | slotActions / GameView → bedtime label / Skip to tomorrow. |
| `interludePreview`, scene ledger on preview / slot-intro | slotCrossing preview suppresses Night for stay-over; opening request adds parting narration. |
| Manual interlude save / `heldOpening` | manualSaveDraft / toGameSave / enterGame preserve the banked morning across night reload. |
| `textWhileBusy` / held reply metadata | Composer, sendText, appendChatMessage, release, recovery, carry; actual waiting/delivery scenarios below. |
| `chatShownThrough`, `messageShown`, `shownMessages`, `chatClockOf` | Core thread UI, audio, prompt history and ledgers; public `chatClock` wrapper has no runtime caller. |
| `threadStartedBy` / `answeringInvite` | Busy prompt and verdict distinguish his opening text, her reach-out and an answer to a standing invitation. |
| `playerActs` | Pre-existing hook still used by normal action/Relax paths and Photo Feature / Mini Games. **After Hours no longer registers it.** It is not stray code added by this diff. |

### Tests and documentation

No test still exercises a removed visit/morning-after API. `afterHours.test.ts` now defends live
Busy, stay-over, night-owed and normalization rules. `chatVisibility`, `textingThread` and the carry
addition defend current held-text rules; kit contract probes exercise the surviving dispatchers.
The following modifications only adapt existing tests to signatures/fixtures, without new assertions:
H238–239 (`bunnybotSays`, message date/time), H240–241 (`characterDynamics`, `ledger:null`),
H249 (`modSlots`, chatsHeader props), H250–252 (`qa2-memory-slot-participants`, `ledger:null`).
H243 adds the spy import needed by the new Relax contract test; that test is used, not a compile-only patch.
`test/messageSlot.test.ts:6` is a current formatter test, not dead code, but its exact
`'Feb 23, late night'` assertion tests wording despite the standing rule against wording tests.
MODDING and CHANGELOG describe the removed features as removed; the current player documentation
no longer promises visits or morning-after choices. MODDING's blanket assertion that core thread
consumers filter shown messages remains too broad: ContactGallery is an exception (findings below).

## Behaviour changes without a mod using the new hooks

The new hook dispatchers default to the former behavior: no hold, no preview, no extra Relax rows,
original Relax words, unchanged hangout verdict and a closed busy composer. The mod-off browser
case below exercises that configuration. However, “exactly unchanged” is not true for all saves
and message readers:

1. **Banked opening saved and reused.** `gameLoop.ts:3231`, `gameStore.ts:3470`,
   `gameLoop.ts:3286`: boundary saves now carry `heldOpening` even when no interlude is used.
   A no-scene reload can consume the paid opening instead of requesting another. This is the known
   change, including preserved rolls/narration and the extra serialized data. Ending openings also
   carry `ledger` (`gameLoop.ts:2190`, `2224`, `types.ts:1534`), duplicating the scene ledger in
   ending saves; without a request/preview hook this adds data, not prose or an extra settle.
2. **Future-stamped message visibility applies globally.** `chatVisibility.ts:6`,
   `gameStore.ts:2896`, `BunnyboardModal.tsx:635`, `1009`, `1679`,
   `loop/promptState.ts:96`, `397`, `gameLoop.ts:1017`, `audioStore.ts:315`:
   a future-stamped message in an existing save or supplied by another producer is now hidden from
   previews/thread/profile counts, prompt histories, current texting ledger and audio counts even
   with After Hours off. Unread accrual on append is similarly delayed. Ordinary messages stamped
   at or before the opened slot keep their former text/format. Conversation kit readers still return
   the full thread; storage, attachment repair and carry appropriately keep it too.
3. **Chat exposure follows the opened landing, not merely the advanced clock.**
   `gameLoop.ts:3209`, `3277`, `textingLoop.ts:1996`: while a boundary/entry curtain covers the
   game, newly stamped messages do not enter preview/audio counts until `openChatSlot`.
   That can shift notification timing for ordinary messages delivered under the curtain, without
   any new hook. This is source-verified; Chromium ran muted, so no audible ring comparison is claimed.
4. **Future messages no longer affect continuity/dice or deduplication.**
   `mods/bunnybot.ts:21` (once marker), `textingLoop.ts:1482`, `1585`, `1624`, `1748`
   (ask/reach-out cooldowns and everyday round), `loop/sceneEvents.ts:41` (event invitation),
   `loop/endingPosts.ts:111` and the six `hasTexted`/reach-out reads in `gameLoop.ts`:
   those readers now use shown messages. Conditional on a thread containing future stamps, this
   changes decisions with the new hooks unused. No natural no-mod producer of a held reply was found;
   the off case does not itself create future held texts.

For the rest of the core hunks, the no-hook comparison is:

| Core file / hunk set | No-hook result |
| --- | --- |
| DayChangeSplash H063–064; crossingStore H091 | Optional lateNight absent; original morning/evening mark and wording. |
| mods/gameReaders H069–070; mods/interlude H071 | New readers/types only; no call changes normal gameplay. |
| prompts/gameDate H072–073; classifier H074–075 | Ordinary message formatting and classifier date unchanged when no late marker. |
| prompts/slotIntroPrompt H076–078 | Extra ledger context only; no new narration without a handler. |
| prompts/textingPrompt H079–084 | New late/held branches dormant; ordinary history limit and voice unchanged. `answeringInvite` is hook context only. |
| audioStore H086–088 | Interlude room/date branches dormant; H085/H089–090 have global visibility effects listed above. |
| gameLoop H093–101, H109, H114 | No slotInterlude answer: hold branches bypassed; ordinary opening effects/clock remain. Chat exposure is the exception above. |
| gameLoop H102/H108/H111–113/H115/H119 | Ledger plumbed through opening/preview; exam callers explicitly distinguish texting ledger by passing null. No new call or settle. |
| gameStore H120–128 | Interlude state starts null, capture guard dormant; heldOpening serialization is the exception above. |
| loop/exams H133–134; loop/hooks H135–136 | Optional sceneLedger parameter distinguishes scene from exam/Relax; no change without its new consumers. |
| loop/relax H140; loop/saves H141 | Hold guards/save branch dormant without a hold. |
| semesterCarry H144 | Only existing heldReply metadata shifts; no change when a thread has none. Saved awaitingReply still recovers even if a switch is later off. |
| slotActions H145–147 | Original labels/fillers; no extra handler without relaxRows. |
| slotCrossing H148–152 | No preview: original next-slot curtain. Cover/show helpers only called for a hold. |
| textingLoop H158–181, H187 | No new hold without textWhileBusy or saved hold/waiting markers. Normal pacing, classification and cancellation remain; no-handler verdict pipeline is identity. |
| whereabouts H188–191 | ownRoom false and no interlude: original timetable/haunt placement. |
| Bunnyboard H194/H196–197/H199/H201/H203–204/H208–209 | Empty header slot; original class/work gate and presence. Other Bunnyboard hunks implement the global shown-message changes above. |
| GameView H210–222; MapModal H223–226 | Null hold and empty relaxRows: original landing input, actions, map Go, theme and date. |
| Shared types, bridges, hook table, APIs and versions | Contract/export/save-shape additions only; runtime consequences are accounted for above. |

## Browser setup and method

Unpacked the shipped archives, then packed **30 characters / 1,219 images / 93.9 MB**, in 346.8 s.
Started the supplied mock after unpacking on `127.0.0.1:8783`; restarted a fresh Vite on **5199**
after the packs finished so its eager asset index included them. The temporary failed startup while
packing reported PACKS_MISSING; it was a setup error, not a reviewed product finding.

Installed Chromium used a throwaway persistent profile, 1920×1080 and reduced motion. Configured
the custom writer through first-run UI, restored **testsave/backup.zip through Settings → Restore
from backup**, and checked the seven manual saves. Reconfigured the mock writer after the restore.
Used the supplied driver's path-adapted scratch copy; all automation stayed outside the repository.
No source edits or HMR happened while checking flows.

Scenarios clone restored **manual04** and enter through the real `enterGame` / `switchGame` loader,
using the restored semester and the 30 packed real characters, primarily Celest. Scenario setup
chooses the clock, clears the reader's timetable, clears irrelevant plans, and makes her free or
assigns one of the restored classes. It does not mount an isolated GameView. Screenshots are of
the application's actual root, stage, phone, map and save UI.

Controlled bridge replies supply immediate agreements, reach-outs, stay-over ledgers and morning
parting prose. Native Relax/Sleep/Skip, stage advance, memory Save and manual Save UI are exercised;
scenario setup and some DM sends / End scene use the same native store commands as those controls.
Canned prose is evidence of request routing and state, not a test of a real model's writing quality.
No real photo-generation claim is made. Detailed limitations appear at the end.


## Findings

### 1. Should fix — reloading a settled evening stay-over opens the night anyway

`src/renderer/mods/afterHours.tsx:146`, `src/renderer/stores/gameLoop.ts:3200`,
`src/renderer/stores/gameLoop.ts:3295`.

A live ending sets `loopState.closingCast`; a restored ending restores the scene cast, ledger
and banked opening but leaves `closingCast` null. At its boundary `slotSettled` receives `[]`.
The mod therefore cannot match the ledger's girl and does not set `nightDone`. The preview
successfully reads the ledger against the roster, so it is possible for the preview and actual
hold decision to disagree.

Reproduced with the native Load Game UI from the main menu, not only a direct loader call:

1. End the controlled evening scene with Celest, `stayedOverWith: celest_morokova`,
   `stayedOverIn: herRoom`.
2. Keep the ending save written before its boundary: `scene.endPending === true`,
   `scene.cast === [Celest's id]`, and the stay-over ledger/opening are present. The test copied
   that actual autosave to manual slot 102, without changing its ending payload.
3. Fresh browser entry → Load Game → manual102 → read through the ending.
4. Underlying clock reaches `58:0`, `closingCast` is null and mod data is only `{busy:false}`.
   The quiet night with **Sleep** opens. It should have skipped the night.

[Result after UI load](review-3/13-ending-reload-stay-result.jpg). Live `herRoom` and `hisRoom`
endings do skip the night; this is specific to restored endings. No code was fixed.

A direct command entry without the native load curtain also stranded the curtain during this
case. **Unverified as a normal UI failure**: the native UI reproduction above reached the night
and remained playable. That harness-only freeze is not counted as an additional blocker.

### 2. Should fix — night reload counts an already unread held reply twice

`src/renderer/stores/gameLoop.ts:3277`, `src/renderer/stores/textingLoop.ts:2000`.

A night manual save has `scene:null`. `enterGame` resets the opened chat clock to the preceding
slot, while restoring the saved unread count. `openChatSlot` then sees the already delivered
morning-stamped reply as newly shown and adds it to that count again. Its `heldReply` metadata
was already removed at delivery, so the exclusion for held message IDs cannot prevent this.

Reproduction:

1. Text Celest during an evening class; bank her reply for the morning.
2. Relax to the night. Her reply becomes shown with unread **1**; do not open the phone.
3. Write a night manual save (slot 104), then load it through the native `switchGame` loader.
4. Same one reply, unread **2**. The save was read from storage, not recreated from an in-memory
   partial conversation. No extra reply was requested for this completed hold.

[Before](review-3/30-night-unread-before-reload.jpg),
[after](review-3/31-night-unread-after-reload.jpg). The check reads the native thread's unread
count; the landing's aggregate badge can include unrelated feature badges as well.

### 3. Should fix — the gallery still lists a held photo before its slot

`src/renderer/views/ContactGallery.tsx:185`, `src/renderer/views/ContactGallery.tsx:190`.

The earlier review's finding remains. `useConversation` intentionally returns the entire thread;
GalleryPanel maps every message without `shownMessages` and the opened chat clock.

Reproduction on this packed-character run: enable Photo Feature, send a held class reply,
append a completed photo record to that held thread, then open Celest's contact page → Gallery.
At `57:0`, the photo stamped `57:1` is hidden in the DM thread, but the gallery says
**GALLERY · 1**. The file name was `review3-held.webp`, with no generated image bytes: this proves
early listing/counting, not successful rendering of a real generated image.

[Hidden DM attachment](review-3/34-held-photo-thread-hidden.jpg),
[gallery listing it early](review-3/35-held-photo-gallery-early.jpg).
The Gallery file is unchanged in the diff, but remains a consumer of the changed reader contract.
Photo Feature and Bunnyfeeds were not edited.

### 4. Minor — unused public surface remains

`src/renderer/mods/interlude.ts:20`, `src/renderer/mods/gameReaders.ts:123`, and the export/capability
locations listed in Stray code. `useInterludeNow` and `chatClock` have no production callers in
this tree; some public context members are also API-only. This is a code-search finding, not a
runtime failure or a claim that third-party mods cannot use them. The requested inventory should
not claim After Hours itself uses these readers.

### 5. Minor — a formatter wording assertion remains

`test/messageSlot.test.ts:6`: the exact `'Feb 23, late night'` assertion tests printed wording.
The formatter itself is live and its previous-slot behavior matters, but this assertion is
outside the standing rule to test decisions/save rules rather than wording. Other compile-only
test adaptations are explicitly identified above, not presented as new regression coverage.

## Flow results

Pass means the controlled native state transition/request route passed, not that real-model prose
was validated. All screenshots are from this run and the actual app. The Night curtain and quiet
night are deliberately different screens: the curtain reads **Night**; the held landing retains
the finished evening's chrome, as `slotInterlude` specifies.

| Brief flow | What was done and observed | Result / screenshots |
| --- | --- | --- |
| 1. Evening scene → night → Sleep | Closed a cast evening scene with a `none` ledger, answered the single native memory question, watched the same-day Night curtain, quiet room line and phone-only Sleep landing. Sleep had no confirmation, showed the new-day curtain, then the banked normal morning. No action box or activity rows at night. | **Pass.** [Night curtain](review-3/02-night-curtain.jpg), [room line](review-3/03a-night-room-line.jpg), [Sleep landing](review-3/03-phone-only-night.jpg), [new day](review-3/06-sleep-new-day-curtain.jpg), [morning](review-3/07-normal-morning.jpg). |
| 2. Evening Relax / Skip | Clicked Relax (Skip to bedtime), which used the normal Relax line/books and reached the night. In a fresh evening, clicked Skip to tomorrow: `nightDone=116`, clock `58:0`, no interlude. | **Pass.** [Evening rows](review-3/01-evening-relax-rows.jpg), [skipped-night morning](review-3/08-skip-morning.jpg). |
| 3. Night phone / map / plans | Checked all **nine contacts** through their chat headers and room whereabouts: seven Lowrises, two Elysium Village, all free. Contact cards showed their dorms; injected away and worst-cold cases took precedence. Map offered no Go. A canned immediate agreement armed neither Begin nor pending invitation. Tomorrow-plan exchange remained in the morning's texting ledger; its stubbed `plans` result was filed on the calendar for `58:1`. Late-night divider and no-going-anywhere DM instruction were present. | **Pass.** [Cards](review-3/14-night-contact-cards.jpg), [chat](review-3/15-night-normal-presence.jpg), [away](review-3/16-night-away.jpg), [sick](review-3/17-night-home-sick.jpg), [map](review-3/18-night-map.jpg), [divider/no Begin](review-3/05-late-night-divider-no-begin.jpg), [plan's next slot](review-3/33-night-future-plan-next-slot.jpg). |
| 4. Staying over | Native scene ending with her key + herRoom skipped Night and returned through the morning walk-back instruction. hisRoom likewise skipped Night and used her leaving instruction. Each used the normal ending and one memory edit question. `none` gave the quiet night. Morning prose was canned in response to the actual requested parting instruction. | **Pass live; reload fails in flow 7.** [Her room morning](review-3/09-stay-herRoom.jpg), [his room morning](review-3/09-stay-hisRoom.jpg), [none → night](review-3/09-stay-none.jpg). |
| 5. Busy invitation paths | Busy on: classifier `characterOffered:true` in his new thread was dropped and the Busy prompt applied. Her reach-out first → his reply allowed her invitation, with no Busy prompt. Reply to standing invitation likewise omitted the line. His own `playerAsked:true` armed Begin. A banked slot-change invitation was delivered after Sleep despite Busy. | **Pass.** [His thread](review-3/19-busy-reader.jpg), [her reach-out](review-3/19-busy-her.jpg), [standing invitation](review-3/19-busy-standing.jpg), [his ask](review-3/19-busy-player.jpg), [slot invitation](review-3/32-busy-slot-invitation.jpg). |
| 6. Text while she is busy | Assigned a real restored class and sent a held reply. No current-slot reply/unread; next evening landing showed it unread 1. Evening class → night delivery unread 1. Evening class → Skip to tomorrow delivered it at the morning landing, with no night. No held reply was classified for an immediate hangout. | **Pass.** [Hidden in class](review-3/20-held-evening-hidden.jpg), [next landing](review-3/21-held-evening-delivered.jpg), [evening hidden](review-3/20-held-night-hidden.jpg), [night delivered](review-3/21-held-night-delivered.jpg), [skipped-night morning delivery](review-3/21-held-skip-delivered.jpg). |
| 7. Save/reload | Clicked an empty native Save Game slot at night, read the stored scene:null + heldOpening save, and reloaded: night returned with no extra intro request; Sleep consumed the same banked prose. Separately saved while her held reply's bridge promise was unfinished: awaitingReply was stored, load asked again, removed that marker on landing and delivered unread at the next landing. Ending stay-over reload **opens the night wrongly**; an already delivered unread held reply **counts twice** after night reload. | **Mixed / fail overall.** [Night save UI](review-3/10-night-manual-save.jpg), [night reload](review-3/11-night-reload.jpg), [same morning](review-3/12-reload-same-morning.jpg), [unfinished held](review-3/27-unfinished-held-hidden.jpg), [reloaded waiting turn](review-3/28-unfinished-held-reloaded.jpg), [recovered delivery](review-3/29-recovered-held-delivered.jpg), findings 1–2. |
| 8. Pre-0.6 save | Used the serialized mid-visit snapshot captured by running the old mod's actual startRoomScene path in the earlier Brief G check. Kept its old scene fields (`bonus`, `bonusAt`, `bonusPays`) and old mod slice, rebinding its cast to the restored Celest for packed art. The current loader resumed it as an ordinary scene, with no error and `normalize` dropping visit. This is a legacy snapshot compatibility case, not a newly acquired historic player save. | **Pass for the tested mid-visit snapshot.** [Loaded legacy scene](review-3/26-legacy-mid-visit-loaded.jpg). Mid-morning-after was not separately tested. |
| 9. Graduation eve | Chose the evening immediately before the real GRADUATION_DATE. Relax produced the night. Sleep removed the hold and opened the native authored ceremony, beginning with the packed-up-room line. | **Pass.** [Last night](review-3/24-graduation-eve-night.jpg), [ceremony opening](review-3/25-graduation-ceremony.jpg). |
| 10. Mod / each option off | Tested the mod off and each of the three options off separately. The results below reflect independent option scopes; disabling one option does not disable the other two. | **Pass for those scopes.** [Mod-off landing](review-3/22-off-mod-landing.jpg), [closed composer](review-3/23-off-mod-composer.jpg), [night off](review-3/22-off-night-landing.jpg), [status off](review-3/23-off-busy-status-composer.jpg), [busy texting off](review-3/23-off-busy-texts-composer.jpg). |

| Disabled switch | Evening Relax / extra row / night | Status card | In-class DM box |
| --- | --- | --- | --- |
| Whole mod | Native Skip to tomorrow label / none / none | Absent | Closed |
| The night | Native Skip to tomorrow label / none / none | Present | Open |
| Busy status | Bedtime label / Skip row / night | Absent | Open |
| Text her when she's busy | Bedtime label / Skip row / night | Present | Closed |

The flow-10 phrase “each option off … no night, no status card, her box shut” cannot all apply to
one independently disabled option. The per-option behavior above follows the documented options;
turning the whole mod off gives all three baseline effects together.

## Checks run

- `npm run typecheck`: **pass**, including node, renderer/web and test checks.
- `npm test -- --maxWorkers=1 --testTimeout=120000`: **422 test files passed, 2 failed, 3 skipped;
  5,100 tests passed, 2 failed, 4 skipped** (427 files / 5,106 tests total), 591.91 s.
  No 7-Zip failure occurred in this run. Every failure is named here:
  - Known baseline `test/mainServices.test.ts:182`, `getComfyOutputFilePath > refuses every name
    that lands anywhere else, and refuses it permanently`: expected COMFY_OUTPUT_PATH_INVALID,
    received undefined. Reproduced at untouched `b4ccf40c` in a detached worktree.
  - Beyond that allowance: `test/pool.test.ts:501`, `fouls by the wrong ball or none less the
    better she is, and hardly ever at her best`: timing assertion `got.ms < 50`, got **71.48 ms**.
    Isolated retry also failed (**100.98 ms**). The pool source/test are unchanged by this diff;
    an isolated baseline run passed all 30 pool tests. This is timing-sensitive, not dismissed
    as an allowed failure or represented as a green full suite.
- `cd packages/modkit && npm run report:check`: **pass**, API report up to date.
- Boundary allowlist diff: **zero lines**. No tracked modkit dist output. Review-only scope:
  no implementation or test file edited; no protected guide/README/TESTING_PLAN changed.

Final isolated pool retry, after the browser finished: **30/30 passed**, 19.45 s. This confirms
timing variability but does not change the recorded full-suite result above.

## Not covered

- Real-model story quality, whether every prompt reliably produces the intended parting/invitation,
  and generated photo image bytes. Controlled replies isolate routing/state behavior.
- Audible ring playback: Chromium was muted; unread counts/visibility and the audio input filter
  were checked. No claim of an audible before/after comparison.
- Full-semester regression, all resolutions/scales, desktop Electron, every legacy save shape or a
  separate historic mid-morning-after snapshot. The browser run used one restored semester and
  explicit clock/timetable setups for repeatable edges.
- Repeated unseen-reply sends were not separately rehearsed in this review; source/replacement
  hunk consumers were audited, and unfinished-reply reload was exercised. No new tests were written.
- The direct-loader curtain freeze is unverified as a UI bug, as described in finding 1. The native
  UI load reproduced the incorrect night without that freeze.

No fixes were made. Findings 1–3 remain open.

## Hunk-by-hunk consumption inventory

Stable IDs follow `git diff --unified=3 b4ccf40c...cede2b1f`, in diff order, with the two requested exclusions.
Line numbers are in the reviewed tip, not the report commit. Every hunk has one row; shared-purpose rows intentionally repeat the concrete consumer.

| Hunk | File / new line | Consumer / disposition |
| --- | --- | --- |
| H001 | `MODDING.md:1192` | Mod authors: documents live hook dispatch, interlude/save/clock and held-reply contracts; see findings for reader documentation gap. |
| H002 | `MODDING.md:1229` | Mod authors: documents live hook dispatch, interlude/save/clock and held-reply contracts; see findings for reader documentation gap. |
| H003 | `MODDING.md:1247` | Mod authors: documents live hook dispatch, interlude/save/clock and held-reply contracts; see findings for reader documentation gap. |
| H004 | `MODDING.md:1769` | Mod authors: documents live hook dispatch, interlude/save/clock and held-reply contracts; see findings for reader documentation gap. |
| H005 | `docs/mods/after-hours.md:1` | Players: 0.6.0 options, Busy, quiet night, staying-over and save instructions; matches current hooks. |
| H006 | `packages/modkit/CHANGELOG.md:86` | Kit consumers: versioned API change history; removed bonus APIs are described as removed, not usable. |
| H007 | `packages/modkit/api/renderer.api.md:82` | Export-only chatClock reader for external UI mods; no production caller in this tree. See unused API finding. |
| H008 | `packages/modkit/api/renderer.api.md:123` | textWhileBusy context and TextingPromptState.commitment type consumed by composer, texting call and busyTextPrompt. |
| H009 | `packages/modkit/api/renderer.api.md:354` | textingLoop.runReply and After Hours busyDrops consume verdict and thread context. |
| H010 | `packages/modkit/api/renderer.api.md:383` | gameLoop.beginSlot, slotCrossing.coverSlotCrossing and After Hours slotInterlude consume held context/rows/clock. |
| H011 | `packages/modkit/api/renderer.api.md:528` | textingLoop.runReply supplies held context; Photo Feature afterDmReply handles the landed reply (does not read held itself). Public context extension. |
| H012 | `packages/modkit/api/renderer.api.md:544` | Bunnyboard ChatList ModSlot and After Hours StatusChip consume chatsHeader/theme. |
| H013 | `packages/modkit/api/renderer.api.md:569` | textingLoop.runReply hangout pipeline and slotCrossing preview dispatch; After Hours handlers. |
| H014 | `packages/modkit/api/renderer.api.md:600` | slotActions.relaxAction and GameView.slotActions call the After Hours Relax label/extra row handlers. |
| H015 | `packages/modkit/api/renderer.api.md:631` | gameLoop.beginSlot owns slotInterlude hold; existing settle hooks remain ordinary slot hooks. |
| H016 | `packages/modkit/api/renderer.api.md:642` | ConversationView timetable gate and sendText hold decision invoke After Hours textWhileBusy. |
| H017 | `packages/modkit/api/renderer.api.md:1031` | buildSlotIntroPrompt passes scene ledger to After Hours morningReturnPrompt handler. |
| H018 | `packages/modkit/api/renderer.api.md:1325` | Bunnyboard ChatList ModSlot and After Hours StatusChip consume chatsHeader/theme. |
| H019 | `packages/modkit/api/renderer.api.md:1659` | sendText captures standing invitation for After Hours busyPromptApplies after invitation removal. |
| H020 | `packages/modkit/api/renderer.api.md:1669` | textingState/buildTextingPrompt and After Hours DM lines consume heldUntil, commitment and lateNight. |
| H021 | `packages/modkit/api/renderer.api.md:1806` | Export-only reactive interlude reader; no production caller. See unused API finding. |
| H022 | `packages/modkit/api/shared.api.md:165` | sendText/resumeHeldReplies and messageSlot/visibility consumers read awaitingReply/late saved markers. |
| H023 | `packages/modkit/api/shared.api.md:174` | sendText/resumeHeldReplies and messageSlot/visibility consumers read awaitingReply/late saved markers. |
| H024 | `packages/modkit/api/shared.api.md:217` | sendText, appendChatMessage, releaseHeldReplies, recovery and semester carry consume heldReply metadata. |
| H025 | `packages/modkit/api/shared.api.md:468` | Compatibility/declared hook contract and renderer dispatchers; After Hours registers all six added hook rows. |
| H026 | `packages/modkit/api/shared.api.md:722` | Compatibility/declared hook contract for ChatList screenSlot and After Hours StatusChip. |
| H027 | `packages/modkit/api/shared.api.md:870` | KIT_APIS compatibility manifest mirrors exports; chatClock/useInterludeNow have no in-tree runtime caller. |
| H028 | `packages/modkit/api/shared.api.md:945` | Core thread UI/audio/prompts and held release consume visibility helpers; After Hours consumes shared threadStartedBy; bridges expose these to mods. |
| H029 | `packages/modkit/api/shared.api.md:1068` | gameLoop boundary/enterGame, toGameSave and manualSaveDraft retain banked opening for night reload. |
| H030 | `packages/modkit/api/shared.api.md:1321` | Core thread UI/audio/prompts and held release consume visibility helpers; After Hours consumes shared threadStartedBy; bridges expose these to mods. |
| H031 | `packages/modkit/api/shared.api.md:1457` | After Hours prompts.dm and textingLoop.runReply consume threadStartedBy. |
| H032 | `packages/modkit/package-lock.json:1` | Package consumers and kit contract check version 0.17.0 consistency. |
| H033 | `packages/modkit/package.json:1` | Package consumers and kit contract check version 0.17.0 consistency. |
| H034 | `packages/modkit/src/bridge/renderer.ts:2` | Bridge/public API exports: interludeNow is read by After Hours nightHolds; useInterludeNow is unused; HangoutVerdict is used by hooks. |
| H035 | `packages/modkit/src/bridge/renderer.ts:144` | Export-only chatClock reader for external UI mods; no production caller in this tree. See unused API finding. |
| H036 | `packages/modkit/src/bridge/renderer.ts:172` | textWhileBusy context and TextingPromptState.commitment type consumed by composer, texting call and busyTextPrompt. |
| H037 | `packages/modkit/src/bridge/shared.ts:92` | Core thread UI/audio/prompts and held release consume visibility helpers; After Hours consumes shared threadStartedBy; bridges expose these to mods. |
| H038 | `packages/modkit/src/host/renderer.ts:6` | Core imports host dispatchers; relocations alphabetize existing exports; new dispatchers are used by beginSlot, GameView, slotActions and textingLoop. |
| H039 | `packages/modkit/src/host/renderer.ts:38` | Core imports host dispatchers; relocations alphabetize existing exports; new dispatchers are used by beginSlot, GameView, slotActions and textingLoop. |
| H040 | `packages/modkit/src/host/renderer.ts:55` | Core imports host dispatchers; relocations alphabetize existing exports; new dispatchers are used by beginSlot, GameView, slotActions and textingLoop. |
| H041 | `packages/modkit/src/renderer/hooks.ts:2` | New hook signatures type Commitment and HangoutVerdict from bridge for actual composer/verdict dispatch. |
| H042 | `packages/modkit/src/renderer/hooks.ts:39` | gameLoop.beginSlot, slotCrossing.coverSlotCrossing and After Hours slotInterlude consume held context/rows/clock. |
| H043 | `packages/modkit/src/renderer/hooks.ts:188` | buildSlotIntroPrompt passes scene ledger to After Hours morningReturnPrompt handler. |
| H044 | `packages/modkit/src/renderer/hooks.ts:404` | gameLoop.beginSlot owns slotInterlude hold; existing settle hooks remain ordinary slot hooks. |
| H045 | `packages/modkit/src/renderer/hooks.ts:491` | runReply dispatches afterDmReply and hangoutVerdict; composer/sendText dispatch textWhileBusy; mod handlers consume them. |
| H046 | `packages/modkit/src/renderer/hooks.ts:568` | Bunnyboard ChatList ModSlot and After Hours StatusChip consume chatsHeader/theme. |
| H047 | `packages/modkit/src/renderer/hooks.ts:621` | Bunnyboard ChatList ModSlot and After Hours StatusChip consume chatsHeader/theme. |
| H048 | `packages/modkit/src/renderer/hooks.ts:934` | textingLoop.runReply supplies held context; Photo Feature afterDmReply handles the landed reply (does not read held itself). Public context extension. |
| H049 | `packages/modkit/src/renderer/hooks.ts:979` | beginSlot, coverSlotCrossing, relaxAction and runReply call these first/pipeline dispatchers; After Hours supplies handlers. |
| H050 | `packages/modkit/src/renderer/hooks.ts:1411` | ConversationView/sendText call any textWhileBusy; GameView collects relaxRows. |
| H051 | `packages/modkit/src/renderer/index.ts:1` | Bridge/public API exports: interludeNow is read by After Hours nightHolds; useInterludeNow is unused; HangoutVerdict is used by hooks. |
| H052 | `packages/modkit/src/renderer/index.ts:11` | Public hook types consumed by mod authoring and host hook signatures; no bonus/room-scene types remain. |
| H053 | `packages/modkit/src/renderer/index.ts:224` | Export-only chatClock reader for external UI mods; no production caller in this tree. See unused API finding. |
| H054 | `packages/modkit/src/renderer/index.ts:252` | textWhileBusy context and TextingPromptState.commitment type consumed by composer, texting call and busyTextPrompt. |
| H055 | `packages/modkit/src/shared/hookTable.ts:69` | Compatibility/declared hook contract and renderer dispatchers; After Hours registers all six added hook rows. |
| H056 | `packages/modkit/src/shared/hookTable.ts:117` | Compatibility/declared hook contract for ChatList screenSlot and After Hours StatusChip. |
| H057 | `packages/modkit/src/shared/hookTable.ts:186` | Export-only chatClock reader for external UI mods; no production caller in this tree. See unused API finding. |
| H058 | `packages/modkit/src/shared/hookTable.ts:242` | Core thread UI/audio/prompts and held release consume visibility helpers; After Hours consumes shared threadStartedBy; bridges expose these to mods. |
| H059 | `packages/modkit/src/shared/hookTable.ts:326` | Bridge/public API exports: interludeNow is read by After Hours nightHolds; useInterludeNow is unused; HangoutVerdict is used by hooks. |
| H060 | `packages/modkit/src/shared/index.ts:71` | Core thread UI/audio/prompts and held release consume visibility helpers; After Hours consumes shared threadStartedBy; bridges expose these to mods. |
| H061 | `packages/modkit/src/shared/index.ts:83` | Core thread UI/audio/prompts and held release consume visibility helpers; After Hours consumes shared threadStartedBy; bridges expose these to mods. |
| H062 | `packages/modkit/src/shared/version.ts:2` | Package consumers and kit contract check version 0.17.0 consistency. |
| H063 | `src/renderer/components/DayChangeSplash.tsx:53` | DayChangeSplash renders lateNight SlotStamp produced by interludePreview as Night and moon/weather mark. |
| H064 | `src/renderer/components/DayChangeSplash.tsx:133` | DayChangeSplash renders lateNight SlotStamp produced by interludePreview as Night and moon/weather mark. |
| H065 | `src/renderer/modEntries/after-hours.ts:1` | Renderer mod-entry discovery imports afterHours.tsx registration. |
| H066 | `src/renderer/mods/afterHours.tsx:1` | StatusChip uses all JSX/classes; registerHooks supplies Busy, held-text prompt, night/Relax/stay-over behavior; see reload finding. |
| H067 | `src/renderer/mods/bunnybot.ts:1` | bunnybotSays once guard reads shown thread; future messages no longer suppress its exact-once mark. |
| H068 | `src/renderer/mods/bunnybot.ts:17` | bunnybotSays once guard reads shown thread; future messages no longer suppress its exact-once mark. |
| H069 | `src/renderer/mods/gameReaders.ts:1` | chatClock public reader calls shared chatClockOf; export only, no runtime consumer in tree. |
| H070 | `src/renderer/mods/gameReaders.ts:119` | Export-only chatClock reader for external UI mods; no production caller in this tree. See unused API finding. |
| H071 | `src/renderer/mods/interlude.ts:1` | beginSlot creates HeldInterlude and GameView consumes it; After Hours reads interludeNow. Reactive reader unused. |
| H072 | `src/renderer/prompts/gameDate.ts:1` | Bunnyboard dividers and texting/ledger stampedStubs print late messages on previous night. |
| H073 | `src/renderer/prompts/gameDate.ts:236` | Bunnyboard dividers and texting/ledger stampedStubs print late messages on previous night. |
| H074 | `src/renderer/prompts/hangoutClassifierPrompt.ts:31` | hangoutClockOf supplies late flag to ordinary/regenerated hangout classifier; still called at night although verdict is dropped. |
| H075 | `src/renderer/prompts/hangoutClassifierPrompt.ts:55` | hangoutClockOf supplies late flag to ordinary/regenerated hangout classifier; still called at night although verdict is dropped. |
| H076 | `src/renderer/prompts/slotIntroPrompt.ts:15` | fetchSlotIntro passes completed scene ledger to buildSlotIntroPrompt/modRequest and After Hours return narration. |
| H077 | `src/renderer/prompts/slotIntroPrompt.ts:637` | fetchSlotIntro passes completed scene ledger to buildSlotIntroPrompt/modRequest and After Hours return narration. |
| H078 | `src/renderer/prompts/slotIntroPrompt.ts:754` | fetchSlotIntro passes completed scene ledger to buildSlotIntroPrompt/modRequest and After Hours return narration. |
| H079 | `src/renderer/prompts/textingPrompt.ts:23` | stampedStubs uses formatMessageSlot so saved late-night texts retain their displayed and quoted date. |
| H080 | `src/renderer/prompts/textingPrompt.ts:96` | sendText/textingState produce lateNight, heldUntil, commitment and answeringInvite; After Hours DM prompt reads them. |
| H081 | `src/renderer/prompts/textingPrompt.ts:190` | stampedStubs uses formatMessageSlot so saved late-night texts retain their displayed and quoted date. |
| H082 | `src/renderer/prompts/textingPrompt.ts:356` | buildTextingPrompt expands held history to first unanswered player text; replacement reply covers all sent texts. |
| H083 | `src/renderer/prompts/textingPrompt.ts:514` | DM request uses night weather/dorm/no immediate meetup, or after-commitment framing; called by sendText/recovery. |
| H084 | `src/renderer/prompts/textingPrompt.ts:545` | DM request uses night weather/dorm/no immediate meetup, or after-commitment framing; called by sendText/recovery. |
| H085 | `src/renderer/stores/audioStore.ts:1` | audio gameFacts/textsOf counts only shown messages and invalidates cached counts when opened slot changes. |
| H086 | `src/renderer/stores/audioStore.ts:254` | audio gameFacts uses held reader room/from-slot weather and avoids graduation epilogue while held; inert without hold. |
| H087 | `src/renderer/stores/audioStore.ts:265` | audio gameFacts uses held reader room/from-slot weather and avoids graduation epilogue while held; inert without hold. |
| H088 | `src/renderer/stores/audioStore.ts:276` | audio gameFacts uses held reader room/from-slot weather and avoids graduation epilogue while held; inert without hold. |
| H089 | `src/renderer/stores/audioStore.ts:291` | audio gameFacts/textsOf counts only shown messages and invalidates cached counts when opened slot changes. |
| H090 | `src/renderer/stores/audioStore.ts:305` | audio gameFacts/textsOf counts only shown messages and invalidates cached counts when opened slot changes. |
| H091 | `src/renderer/stores/crossingStore.ts:17` | coverSlotCrossing sets lateNight; DayChangeSplash reads it. |
| H092 | `src/renderer/stores/gameLoop.ts:1` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H093 | `src/renderer/stores/gameLoop.ts:55` | beginSlot/enterGame use prevSlot, slotInterlude, cover/reveal and chat release/recovery helpers. |
| H094 | `src/renderer/stores/gameLoop.ts:131` | beginSlot/enterGame use prevSlot, slotInterlude, cover/reveal and chat release/recovery helpers. |
| H095 | `src/renderer/stores/gameLoop.ts:153` | beginSlot/enterGame use prevSlot, slotInterlude, cover/reveal and chat release/recovery helpers. |
| H096 | `src/renderer/stores/gameLoop.ts:189` | beginSlot/enterGame use prevSlot, slotInterlude, cover/reveal and chat release/recovery helpers. |
| H097 | `src/renderer/stores/gameLoop.ts:371` | beginSlot builds held landing and one-shot row callback; callback re-enters beginSlot(true), bypassing re-ask. openChatSlot releases due texts. |
| H098 | `src/renderer/stores/gameLoop.ts:400` | beginSlot builds held landing and one-shot row callback; callback re-enters beginSlot(true), bypassing re-ask. openChatSlot releases due texts. |
| H099 | `src/renderer/stores/gameLoop.ts:489` | beginSlot opens chat clock for authored orientation or ordinary opening, releasing held and new-slot unread texts. |
| H100 | `src/renderer/stores/gameLoop.ts:561` | beginSlot consumes banked opening, clears saved heldOpening after it has been adopted. |
| H101 | `src/renderer/stores/gameLoop.ts:588` | beginSlot opens chat clock for authored orientation or ordinary opening, releasing held and new-slot unread texts. |
| H102 | `src/renderer/stores/gameLoop.ts:950` | fetchEndingOpening supplies scene ledger to fetchSlotIntro request hook; other intro callers default null. |
| H103 | `src/renderer/stores/gameLoop.ts:1014` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H104 | `src/renderer/stores/gameLoop.ts:1047` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H105 | `src/renderer/stores/gameLoop.ts:1075` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H106 | `src/renderer/stores/gameLoop.ts:1091` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H107 | `src/renderer/stores/gameLoop.ts:1107` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H108 | `src/renderer/stores/gameLoop.ts:1212` | fetchEndingOpening supplies scene ledger to fetchSlotIntro request hook; other intro callers default null. |
| H109 | `src/renderer/stores/gameLoop.ts:1583` | submitAction/advance prevent action entry and stop draining on interlude choices; normal slots retain old branch. |
| H110 | `src/renderer/stores/gameLoop.ts:2096` | fetchSlotIntro/introBreakupsOf use shown conversations for texted/reach-out prompt continuity, excluding future replies. |
| H111 | `src/renderer/stores/gameLoop.ts:2109` | fetchEndingOpening distinguishes real scene ledger from exam/Relax texting ledger, carries it with banked morning and request. |
| H112 | `src/renderer/stores/gameLoop.ts:2187` | fetchEndingOpening distinguishes real scene ledger from exam/Relax texting ledger, carries it with banked morning and request. |
| H113 | `src/renderer/stores/gameLoop.ts:2214` | fetchEndingOpening distinguishes real scene ledger from exam/Relax texting ledger, carries it with banked morning and request. |
| H114 | `src/renderer/stores/gameLoop.ts:2648` | submitAction/advance prevent action entry and stop draining on interlude choices; normal slots retain old branch. |
| H115 | `src/renderer/stores/gameLoop.ts:3182` | crossSlotBoundary supplies banked scene ledger to curtain preview before settles. |
| H116 | `src/renderer/stores/gameLoop.ts:3206` | crossSlotBoundary freezes opened chat clock before advancing game clock under curtain. |
| H117 | `src/renderer/stores/gameLoop.ts:3228` | Boundary save retains banked narration; enterGame restores it and opens/restarts due held replies. See reload finding and no-mod save change. |
| H118 | `src/renderer/stores/gameLoop.ts:3274` | Boundary save retains banked narration; enterGame restores it and opens/restarts due held replies. See reload finding and no-mod save change. |
| H119 | `src/renderer/stores/gameLoop.ts:3348` | Exam/quiet-ending fetches explicitly pass null sceneLedger via loop/hooks facade, avoiding treating text ledger as finished scene. |
| H120 | `src/renderer/stores/gameStore.ts:1` | Game store holds nonserialized HeldInterlude; beginSlot writes it, GameView/clock/save/map read it; reset clears it. |
| H121 | `src/renderer/stores/gameStore.ts:15` | appendChatMessage uses shared opened clock/visibility; chatShownThrough initial null reset/read by chatClockOf. |
| H122 | `src/renderer/stores/gameStore.ts:273` | loadSave/toGameSave whitelist and restore heldOpening; beginSlot and boundary writer consume it. chatShownThrough is transient. |
| H123 | `src/renderer/stores/gameStore.ts:431` | loadSave/toGameSave whitelist and restore heldOpening; beginSlot and boundary writer consume it. chatShownThrough is transient. |
| H124 | `src/renderer/stores/gameStore.ts:459` | Game store holds nonserialized HeldInterlude; beginSlot writes it, GameView/clock/save/map read it; reset clears it. |
| H125 | `src/renderer/stores/gameStore.ts:1707` | Game store holds nonserialized HeldInterlude; beginSlot writes it, GameView/clock/save/map read it; reset clears it. |
| H126 | `src/renderer/stores/gameStore.ts:1798` | appendChatMessage uses shared opened clock/visibility; chatShownThrough initial null reset/read by chatClockOf. |
| H127 | `src/renderer/stores/gameStore.ts:1952` | loadSave/toGameSave whitelist and restore heldOpening; beginSlot and boundary writer consume it. chatShownThrough is transient. |
| H128 | `src/renderer/stores/gameStore.ts:2055` | manual save sees no scene while held; manualSaveDraft has explicit held-landing branch. |
| H129 | `src/renderer/stores/gameStore.ts:2893` | appendChatMessage stamps night and held attachments, records replaceable IDs and suppresses early unread. |
| H130 | `src/renderer/stores/gameStore.ts:3467` | loadSave/toGameSave whitelist and restore heldOpening; beginSlot and boundary writer consume it. chatShownThrough is transient. |
| H131 | `src/renderer/stores/loop/endingPosts.ts:1` | armEndingPosts uses shownConversation for post texted continuity. |
| H132 | `src/renderer/stores/loop/endingPosts.ts:108` | armEndingPosts uses shownConversation for post texted continuity. |
| H133 | `src/renderer/stores/loop/exams.ts:88` | Exam/quiet-ending fetches explicitly pass null sceneLedger via loop/hooks facade, avoiding treating text ledger as finished scene. |
| H134 | `src/renderer/stores/loop/exams.ts:200` | Exam/quiet-ending fetches explicitly pass null sceneLedger via loop/hooks facade, avoiding treating text ledger as finished scene. |
| H135 | `src/renderer/stores/loop/hooks.ts:19` | Exam/quiet-ending fetches explicitly pass null sceneLedger via loop/hooks facade, avoiding treating text ledger as finished scene. |
| H136 | `src/renderer/stores/loop/hooks.ts:72` | Exam/quiet-ending fetches explicitly pass null sceneLedger via loop/hooks facade, avoiding treating text ledger as finished scene. |
| H137 | `src/renderer/stores/loop/promptState.ts:1` | scheduleInput texting ledger and promptState scene history exclude future messages. |
| H138 | `src/renderer/stores/loop/promptState.ts:93` | scheduleInput texting ledger and promptState scene history exclude future messages. |
| H139 | `src/renderer/stores/loop/promptState.ts:394` | scheduleInput texting ledger and promptState scene history exclude future messages. |
| H140 | `src/renderer/stores/loop/relax.ts:29` | relax rejects interlude calls; held row has its own release handler. |
| H141 | `src/renderer/stores/loop/saves.ts:499` | writeManualSave permits scene:null interlude draft; loader reasks slotInterlude and restores heldOpening. |
| H142 | `src/renderer/stores/loop/sceneEvents.ts:1` | sceneEvents.inviteOf only reads invitations the player can see in opened chat slot. |
| H143 | `src/renderer/stores/loop/sceneEvents.ts:38` | sceneEvents.inviteOf only reads invitations the player can see in opened chat slot. |
| H144 | `src/renderer/stores/semesterCarry.ts:164` | carryOf/carriedConversation shifts heldReply.until with messages; awaitingReply preserved by spread. |
| H145 | `src/renderer/stores/slotActions.ts:1` | GameView slot action list gets modded Relax label; ordinary fallback words/flow preserved. |
| H146 | `src/renderer/stores/slotActions.ts:32` | GameView generated extra Relax choices carry onPick as relaxPick; click invokes before relax(). |
| H147 | `src/renderer/stores/slotActions.ts:182` | GameView slot action list gets modded Relax label; ordinary fallback words/flow preserved. |
| H148 | `src/renderer/stores/slotCrossing.ts:1` | Boundary preview dispatch selects curtain date/theme/lateNight, default nextSlot when no hook responds. |
| H149 | `src/renderer/stores/slotCrossing.ts:14` | Boundary preview dispatch selects curtain date/theme/lateNight, default nextSlot when no hook responds. |
| H150 | `src/renderer/stores/slotCrossing.ts:27` | Boundary preview dispatch selects curtain date/theme/lateNight, default nextSlot when no hook responds. |
| H151 | `src/renderer/stores/slotCrossing.ts:126` | Boundary preview dispatch selects curtain date/theme/lateNight, default nextSlot when no hook responds. |
| H152 | `src/renderer/stores/slotCrossing.ts:232` | beginSlot hold entry/release uses showInterludeLanding and coverInterludeOpening to reveal evening then morning. |
| H153 | `src/renderer/stores/textingLoop.ts:1` | Held send/recovery, hangout thread context and shown readers import clock, commitment, waitingText and hook dispatchers. |
| H154 | `src/renderer/stores/textingLoop.ts:7` | Held send/recovery, hangout thread context and shown readers import clock, commitment, waitingText and hook dispatchers. |
| H155 | `src/renderer/stores/textingLoop.ts:79` | Held send/recovery, hangout thread context and shown readers import clock, commitment, waitingText and hook dispatchers. |
| H156 | `src/renderer/stores/textingLoop.ts:97` | Held send/recovery, hangout thread context and shown readers import clock, commitment, waitingText and hook dispatchers. |
| H157 | `src/renderer/stores/textingLoop.ts:108` | Held send/recovery, hangout thread context and shown readers import clock, commitment, waitingText and hook dispatchers. |
| H158 | `src/renderer/stores/textingLoop.ts:165` | runReply tracks held calls; scene cancellation preserves them and failed Retry retains held slot. |
| H159 | `src/renderer/stores/textingLoop.ts:183` | runReply tracks held calls; scene cancellation preserves them and failed Retry retains held slot. |
| H160 | `src/renderer/stores/textingLoop.ts:204` | ConversationView/send gates allow texting before graduation while night interlude holds. |
| H161 | `src/renderer/stores/textingLoop.ts:244` | sendText/delivery/failure bubbles use chatMessage late marker while held night. |
| H162 | `src/renderer/stores/textingLoop.ts:322` | Relax/scene can proceed while background held reply runs; ordinary replies/failed turns still gate it. |
| H163 | `src/renderer/stores/textingLoop.ts:543` | Incoming Texts can reach contacts in evening classes while late-night held composer is free. |
| H164 | `src/renderer/stores/textingLoop.ts:556` | sendText computes/reuses hold, removes replacement IDs, marks awaitingReply and passes held/pending-invite prompt state to runReply. |
| H165 | `src/renderer/stores/textingLoop.ts:564` | sendText computes/reuses hold, removes replacement IDs, marks awaitingReply and passes held/pending-invite prompt state to runReply. |
| H166 | `src/renderer/stores/textingLoop.ts:614` | sendText computes/reuses hold, removes replacement IDs, marks awaitingReply and passes held/pending-invite prompt state to runReply. |
| H167 | `src/renderer/stores/textingLoop.ts:633` | runReply branches for nonstreamed held reply, keeps Retry hold metadata, stores final reply/summary/block and invokes afterDmReply. |
| H168 | `src/renderer/stores/textingLoop.ts:642` | runReply branches for nonstreamed held reply, keeps Retry hold metadata, stores final reply/summary/block and invokes afterDmReply. |
| H169 | `src/renderer/stores/textingLoop.ts:667` | runReply branches for nonstreamed held reply, keeps Retry hold metadata, stores final reply/summary/block and invokes afterDmReply. |
| H170 | `src/renderer/stores/textingLoop.ts:685` | runReply branches for nonstreamed held reply, keeps Retry hold metadata, stores final reply/summary/block and invokes afterDmReply. |
| H171 | `src/renderer/stores/textingLoop.ts:720` | runReply branches for nonstreamed held reply, keeps Retry hold metadata, stores final reply/summary/block and invokes afterDmReply. |
| H172 | `src/renderer/stores/textingLoop.ts:729` | runReply branches for nonstreamed held reply, keeps Retry hold metadata, stores final reply/summary/block and invokes afterDmReply. |
| H173 | `src/renderer/stores/textingLoop.ts:780` | runReply pipelines classifier verdict through Busy hook and discards all interlude hangouts. Ordinary no-hook verdict unchanged. |
| H174 | `src/renderer/stores/textingLoop.ts:797` | Text Regeneration reader refuses a held reply until delivered; ordinary regeneration unaffected. |
| H175 | `src/renderer/stores/textingLoop.ts:817` | textingState feeds actual night from clock to DM prompt/weather/availability. |
| H176 | `src/renderer/stores/textingLoop.ts:897` | Both normal and regenerated hangout classification use night-aware clock; normal delivery drops final interlude verdict. |
| H177 | `src/renderer/stores/textingLoop.ts:958` | retryFailedMessage passes original held due slot to runReply. |
| H178 | `src/renderer/stores/textingLoop.ts:1003` | Both normal and regenerated hangout classification use night-aware clock; normal delivery drops final interlude verdict. |
| H179 | `src/renderer/stores/textingLoop.ts:1034` | Both normal and regenerated hangout classification use night-aware clock; normal delivery drops final interlude verdict. |
| H180 | `src/renderer/stores/textingLoop.ts:1277` | Leaving resets/cancels background held call; scene entry cancels ordinary texts but lets held ones finish. |
| H181 | `src/renderer/stores/textingLoop.ts:1292` | Leaving resets/cancels background held call; scene entry cancels ordinary texts but lets held ones finish. |
| H182 | `src/renderer/stores/textingLoop.ts:1479` | Occasion/slot asker, reach-out cooldown and everyday ask round read shown messages only; held reply cannot suppress or bias current rolls. |
| H183 | `src/renderer/stores/textingLoop.ts:1582` | Occasion/slot asker, reach-out cooldown and everyday ask round read shown messages only; held reply cannot suppress or bias current rolls. |
| H184 | `src/renderer/stores/textingLoop.ts:1621` | Occasion/slot asker, reach-out cooldown and everyday ask round read shown messages only; held reply cannot suppress or bias current rolls. |
| H185 | `src/renderer/stores/textingLoop.ts:1642` | Occasion/slot asker, reach-out cooldown and everyday ask round read shown messages only; held reply cannot suppress or bias current rolls. |
| H186 | `src/renderer/stores/textingLoop.ts:1742` | Occasion/slot asker, reach-out cooldown and everyday ask round read shown messages only; held reply cannot suppress or bias current rolls. |
| H187 | `src/renderer/stores/textingLoop.ts:1970` | beginSlot/enterGame/runReply use openChatSlot, releaseHeldReplies and resumeHeldReplies for unread/block/recovery. See unread reload finding if reproduced. |
| H188 | `src/renderer/stores/whereabouts.ts:154` | knownWhereabouts night contacts use toldWhereabouts ownRoom, retaining hidden/away/cold priority; Bunnyboard and map consume these rows. |
| H189 | `src/renderer/stores/whereabouts.ts:173` | knownWhereabouts night contacts use toldWhereabouts ownRoom, retaining hidden/away/cold priority; Bunnyboard and map consume these rows. |
| H190 | `src/renderer/stores/whereabouts.ts:245` | knownWhereabouts night contacts use toldWhereabouts ownRoom, retaining hidden/away/cold priority; Bunnyboard and map consume these rows. |
| H191 | `src/renderer/stores/whereabouts.ts:260` | knownWhereabouts night contacts use toldWhereabouts ownRoom, retaining hidden/away/cold priority; Bunnyboard and map consume these rows. |
| H192 | `src/renderer/views/BunnyboardModal.tsx:1` | Bunnyboard shown thread/composer/clock formatting imports consumed by ChatList and ConversationView. |
| H193 | `src/renderer/views/BunnyboardModal.tsx:46` | Bunnyboard shown thread/composer/clock formatting imports consumed by ChatList and ConversationView. |
| H194 | `src/renderer/views/BunnyboardModal.tsx:443` | ChatList passes day/night theme to chatsHeader ModSlot; After Hours StatusChip mounts there. |
| H195 | `src/renderer/views/BunnyboardModal.tsx:484` | Hidden-thread rule, chat sorting/previews and thread body use shown messages; timetable gate allows hook-opened held texting. |
| H196 | `src/renderer/views/BunnyboardModal.tsx:606` | Phone chat/contact card presence uses night dorm placement; non-night generic hold hides presence; no hold keeps baseline presence. |
| H197 | `src/renderer/views/BunnyboardModal.tsx:618` | ChatList passes day/night theme to chatsHeader ModSlot; After Hours StatusChip mounts there. |
| H198 | `src/renderer/views/BunnyboardModal.tsx:631` | Hidden-thread rule, chat sorting/previews and thread body use shown messages; timetable gate allows hook-opened held texting. |
| H199 | `src/renderer/views/BunnyboardModal.tsx:651` | ChatList passes day/night theme to chatsHeader ModSlot; After Hours StatusChip mounts there. |
| H200 | `src/renderer/views/BunnyboardModal.tsx:1003` | Hidden-thread rule, chat sorting/previews and thread body use shown messages; timetable gate allows hook-opened held texting. |
| H201 | `src/renderer/views/BunnyboardModal.tsx:1097` | Phone chat/contact card presence uses night dorm placement; non-night generic hold hides presence; no hold keeps baseline presence. |
| H202 | `src/renderer/views/BunnyboardModal.tsx:1132` | ConversationView uses formatMessageSlot to group and label late-night dividers. |
| H203 | `src/renderer/views/BunnyboardModal.tsx:1456` | Phone chat/contact card presence uses night dorm placement; non-night generic hold hides presence; no hold keeps baseline presence. |
| H204 | `src/renderer/views/BunnyboardModal.tsx:1579` | Phone chat/contact card presence uses night dorm placement; non-night generic hold hides presence; no hold keeps baseline presence. |
| H205 | `src/renderer/views/BunnyboardModal.tsx:1609` | ProfilePage text tally filters shown player messages and recomputes when opened clock changes. |
| H206 | `src/renderer/views/BunnyboardModal.tsx:1676` | ProfilePage text tally filters shown player messages and recomputes when opened clock changes. |
| H207 | `src/renderer/views/BunnyboardModal.tsx:1721` | ProfilePage text tally filters shown player messages and recomputes when opened clock changes. |
| H208 | `src/renderer/views/BunnyboardModal.tsx:1867` | Phone chat/contact card presence uses night dorm placement; non-night generic hold hides presence; no hold keeps baseline presence. |
| H209 | `src/renderer/views/BunnyboardModal.tsx:1890` | Phone chat/contact card presence uses night dorm placement; non-night generic hold hides presence; no hold keeps baseline presence. |
| H210 | `src/renderer/views/GameView.tsx:5` | GameView imports/reads interlude and Relax additions to generate and dispatch landing rows. |
| H211 | `src/renderer/views/GameView.tsx:188` | GameView imports/reads interlude and Relax additions to generate and dispatch landing rows. |
| H212 | `src/renderer/views/GameView.tsx:602` | GameView imports/reads interlude and Relax additions to generate and dispatch landing rows. |
| H213 | `src/renderer/views/GameView.tsx:1161` | GameView background, chrome date, weather and theme follow held evening; ordinary scene remains clock-based. |
| H214 | `src/renderer/views/GameView.tsx:1588` | GameView postpones orientation/graduation chrome during held landing. |
| H215 | `src/renderer/views/GameView.tsx:1828` | GameView maps hold rows or extra Relax rows and dispatches one-shot picks before normal Relax. |
| H216 | `src/renderer/views/GameView.tsx:1863` | GameView maps hold rows or extra Relax rows and dispatches one-shot picks before normal Relax. |
| H217 | `src/renderer/views/GameView.tsx:1902` | GameView maps hold rows or extra Relax rows and dispatches one-shot picks before normal Relax. |
| H218 | `src/renderer/views/GameView.tsx:1921` | GameView closes action input/map travel while held; ordinary landing retains action and Go. |
| H219 | `src/renderer/views/GameView.tsx:2235` | GameView background, chrome date, weather and theme follow held evening; ordinary scene remains clock-based. |
| H220 | `src/renderer/views/GameView.tsx:2308` | GameView background, chrome date, weather and theme follow held evening; ordinary scene remains clock-based. |
| H221 | `src/renderer/views/GameView.tsx:2339` | GameView closes action input/map travel while held; ordinary landing retains action and Go. |
| H222 | `src/renderer/views/GameView.tsx:2427` | GameView closes action input/map travel while held; ordinary landing retains action and Go. |
| H223 | `src/renderer/views/MapModal.tsx:185` | Map recomputes held whereabouts and suppresses Go buttons/handler during hold. |
| H224 | `src/renderer/views/MapModal.tsx:201` | Map recomputes held whereabouts and suppresses Go buttons/handler during hold. |
| H225 | `src/renderer/views/MapModal.tsx:314` | Map recomputes held whereabouts and suppresses Go buttons/handler during hold. |
| H226 | `src/renderer/views/MapModal.tsx:430` | Map recomputes held whereabouts and suppresses Go buttons/handler during hold. |
| H227 | `src/renderer/vu_styles/AfterHours.css:1` | Every added selector matches StatusChip/title/hint markup; no obsolete confirmation/visit CSS found. |
| H228 | `src/shared/afterHours.ts:1` | After Hours saveField and hooks consume normalize, busyDrops/busyPromptApplies, nightOwed and stayOverOf; no visit state remains. |
| H229 | `src/shared/afterHoursText.ts:1` | Catalogue entry and renderer hooks read all text entries/functions: status/option labels, night/Relax rows and Busy/stay-over prompts. |
| H230 | `src/shared/chatVisibility.ts:1` | Bunnyboard/audio/prompts/ledger use shownMessages/shownConversation/chatClockOf; held delivery/recovery use messageShown. |
| H231 | `src/shared/modEntries/after-hours.ts:1` | Shared mod-entry discovery supplies mod catalogue, version and three default-on option switches. |
| H232 | `src/shared/textingThread.ts:1` | After Hours DM prompt and core hangout context read threadStartedBy; resumeHeldReplies reads waitingText. |
| H233 | `src/shared/types.ts:999` | Held send/recovery/attachment/release/carry and late formatting/visibility consume saved message and hold fields. |
| H234 | `src/shared/types.ts:1034` | Held send/recovery/attachment/release/carry and late formatting/visibility consume saved message and hold fields. |
| H235 | `src/shared/types.ts:1529` | fetchEndingOpening retains real scene ledger in ending/manual/boundary saves; preview/slot-intro mod hooks consume it. |
| H236 | `src/shared/types.ts:1566` | gameLoop boundary/enterGame, toGameSave and manualSaveDraft retain banked opening for night reload. |
| H237 | `test/afterHours.test.ts:1` | Pure After Hours decision/normalization tests exercise live save rules; obsolete visit/morning scene tests gone. |
| H238 | `test/bunnybotSays.test.ts:3` | Compile fixture adjustment only: bunnybotSays shown-reader now requires date/time; existing once assertions unchanged. |
| H239 | `test/bunnybotSays.test.ts:21` | Compile fixture adjustment only: bunnybotSays shown-reader now requires date/time; existing once assertions unchanged. |
| H240 | `test/characterDynamics.test.ts:129` | Compile context adjustment only: existing modRequest slot-intro tests supply new required ledger:null; assertions unchanged. |
| H241 | `test/characterDynamics.test.ts:137` | Compile context adjustment only: existing modRequest slot-intro tests supply new required ledger:null; assertions unchanged. |
| H242 | `test/chatVisibility.test.ts:1` | Pure tests defend shownMessages/messageShown including late marker, used by UI/prompt/ledger filtering. |
| H243 | `test/kit/contract.test.ts:1` | Kit contract exercises declared new dispatchers/screen slot and Relax row order/failure isolation; no removed bonus contracts remain. |
| H244 | `test/kit/contract.test.ts:441` | Kit contract exercises declared new dispatchers/screen slot and Relax row order/failure isolation; no removed bonus contracts remain. |
| H245 | `test/kit/contract.test.ts:508` | Kit contract exercises declared new dispatchers/screen slot and Relax row order/failure isolation; no removed bonus contracts remain. |
| H246 | `test/kit/contract.test.ts:527` | Kit contract exercises declared new dispatchers/screen slot and Relax row order/failure isolation; no removed bonus contracts remain. |
| H247 | `test/kit/modFiles.ts:11` | Boundary audit scans added mod files using existing rules; boundary allowlist unchanged. |
| H248 | `test/messageSlot.test.ts:1` | Live formatMessageSlot output test; exact wording assertion is outside standing pure-decision-only test rule, not dead code. |
| H249 | `test/modSlots.test.ts:21` | Compile fixture adjustment only: existing screen-slot matrix supplies new chatsHeader.theme. |
| H250 | `test/qa2-memory-slot-participants.test.ts:29` | Compile context adjustment only: existing modRequest slot-intro tests supply new required ledger:null; assertions unchanged. |
| H251 | `test/qa2-memory-slot-participants.test.ts:60` | Compile context adjustment only: existing modRequest slot-intro tests supply new required ledger:null; assertions unchanged. |
| H252 | `test/qa2-memory-slot-participants.test.ts:76` | Compile context adjustment only: existing modRequest slot-intro tests supply new required ledger:null; assertions unchanged. |
| H253 | `test/semesterCarry.test.ts:214` | Pure carry test defends shifted held due slot and preserved awaitingReply marker. |
| H254 | `test/textingThread.test.ts:1` | Pure thread/recovery tests defend live Busy opener and trailing-error waitingText recovery. |
