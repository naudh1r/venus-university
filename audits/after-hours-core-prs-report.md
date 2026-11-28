# After Hours core stack

The org base is `venus-extracurriculars/build` `main` at `a39f3489`.
The fork sources are `naudh1r-core` at `5041b95e`, with the resolved org reference at `0df43073`.
The three commits were rebuilt on the org base. The mod compatibility check uses the fork's
`mod/after-hours-kit` at `697abb45` in a local scratch merge.

## Scope and branch boundaries

- Branch 1 holds the late-night opening and save work, including the chat clock and message slot
  readers needed by the night ledger. It also carries the immediate-meet-up veto with the
  interlude classifier guard and the Relax and staged-opening hooks. That keeps the hold's full
  entry and release paths together.
- Branch 2 adds held-reply save validation, startup recovery, shared-class and idle delivery,
  the opening's home-contact snapshot, and ledger context and claims. Reader pronouns were
  already exported on the org base.
- Branch 3 adds phone rendering, the Chats header slot, commitment confirmations, reader-owned
  invitation handling, and the quiet thread note API. The idle placeholder and lamp first
  appear here. None of the excluded work was needed to build the core stack.
- The resolved reference supplied the incoming-DM and photo-aware merge results. The final
  branch uses a stricter interlude-only phone guard to preserve the original behavior during
  ordinary endings. API reports were regenerated against the org's kit, and the changelog
  and modding guide use one compact addition per layer. The new phone exports follow the kit’s ordering.

## Default paths

With no hook returning a value, the slot opens directly, Relax uses its normal label and line,
and the opening's default request and playback stay narration-only. The phone uses its ordinary
composer, classification, status and Yes line. No receipts, custom Chats lights, extra header
controls or commitment prompts are drawn. Existing photo and incoming-DM selection paths remain
in place. The rebuild does add optional chat-clock and opening playback metadata to saves so
reloading follows the same visibility and staging rules. Refusing malformed new fields and
rendering the fallback label for old late-night saves are compatibility paths for that metadata.

## Review against the resolved reference

The comparison uses `git diff 0df43073 ah-core/3-phone`. The retained differences are the
catalogue, separate stylesheet and hover fixes, stopped-reply edit support, separate memory
presentation API and tests, and unrelated split-generation/structured-request compatibility
edits from the fork's upstream integrations. The org's package versions and pack APIs are kept.
The compact docs, API reports reflecting only this scope, the interlude-only phone guard,
and alphabetical placement of the new exports are intentional rebuild differences. The mod itself stays outside the core branches.

## Draft PR descriptions

### 1. Held landings and staged openings

Adds opt-in hooks for a held late-night landing and a staged opening. `slotInterlude` and
`interludePreview` let mods choose and predict the hold. `interludeSettled` lets them observe
its completed ledger. Saves retain the late-night clock and paid opening work across reload.
`openingLook` can stage dialogue from the opening reply. The Relax hooks add a label, line or
extra choice, and `hangoutCheck` lets a mod veto an immediate meet-up check. With no hook
answering, the normal slot, Relax and opening flow stays the same.

Checks passed for typecheck, API reports and build. The full suite reported 3 failed, 5,550 passed, 4 skipped (5,557). Timing reruns are recorded below.

### 2. Held replies and idle contacts

Adds `textWhileBusy` and `asleepNow` so mods can keep the composer available while replies
wait for the correct landing. Persisted holds recover with their original prompt context.
Ledger context keeps questions with their replies and lets the sending slot judge an idle
reply already written. Regular texting stays on its normal path when no mod opts in.

Checks passed for typecheck, API reports and build. The full suite reported 5 failed, 5,561 passed, 4 skipped (5,570). Timing reruns are recorded below.

### 3. Phone presentation and meet-ups

Adds opt-in sent, delivered and read ticks, presence wording and lights, and a Chats header
slot. `ownMeetupAsks`, `warnBeforeMeetup` and `acceptLine` let mods offer a confirmation, warn
about commitments and write the reader's Yes. `slotSettled.ownMeetupsLapsed` and `noteInThread`
let mods track the result. The ordinary phone UI, acceptance text and actions stay the same
with no mod answering. After Hours exercises the new surface in a local compatibility merge.

Checks passed for typecheck, API reports and build. The full suite reported 4 failed, 5,583 passed, 4 skipped (5,591). Timing reruns are recorded below.

## Checks

Each layer used a clean npm install, typecheck, regenerated API reports, `report:check`, and
`npm run build`. The full suites used the available Electron binary and archive helper in a
sparse checkout.

| Branch | Clean install | Typecheck | API report check | Build | Full suite | Isolated timing cases |
| --- | --- | --- | --- | --- | --- | --- |
| `ah-core/1-night` | 456 packages | Pass | Pass | Pass | 3 failed, 5,550 passed, 4 skipped (5,557) | 4 passed, 100 skipped (104) |
| `ah-core/2-held-replies` | 456 packages | Pass | Pass | Pass | 5 failed, 5,561 passed, 4 skipped (5,570) | 4 passed, 100 skipped (104) |
| `ah-core/3-phone` | 456 packages | Pass | Pass | Pass | 4 failed, 5,583 passed, 4 skipped (5,591) | 4 passed, 100 skipped (104) |

All full suites hit the known Linux `getComfyOutputFilePath` failure. The concurrent full runs
also hit timing failures in `test/photoFlow.test.ts` (all layers), `test/pool.test.ts` (all layers),
and `test/poker.test.ts` and `test/webEchoBackup.test.ts` (branch 2). The reruns used one worker after the full suites.
The selected cases passed in isolation. The branch 2 backup and targeted held-reply suite reported 144 passed (144).

Scratch merge `123c3de9` has the kit branch as first parent and the phone branch as second
parent. Its tree keeps the rebuilt core and the eight exact mod-owned files from the kit
branch. This verifies the mod against the rebuilt APIs without the excluded fork services.
Typecheck passed, and `test/afterHours.test.ts` passed all 23 tests. No live Electron playthrough
was run.

## Commits and files

### `ah-core/1-night` · `8c3fea73`

72 files changed, 2081 insertions(+), 272 deletions(-)

```text
30	0	MODDING.md
2	0	packages/modkit/CHANGELOG.md
94	0	packages/modkit/api/renderer.api.md
74	1	packages/modkit/api/shared.api.md
3	0	packages/modkit/src/bridge/renderer.ts
4	0	packages/modkit/src/bridge/shared.ts
14	5	packages/modkit/src/host/renderer.ts
147	1	packages/modkit/src/renderer/hooks.ts
6	0	packages/modkit/src/renderer/index.ts
14	0	packages/modkit/src/shared/hookTable.ts
4	0	packages/modkit/src/shared/index.ts
2	0	src/main/services/saveService.ts
2	2	src/renderer/components/DayChangeSplash.tsx
3	1	src/renderer/mods/bunnybot.ts
7	0	src/renderer/mods/gameReaders.ts
17	0	src/renderer/mods/interlude.ts
15	1	src/renderer/prompts/gameDate.ts
5	1	src/renderer/prompts/schedulePrompt.ts
4	2	src/renderer/prompts/slotIntroPrompt.ts
33	20	src/renderer/prompts/textingPrompt.ts
14	9	src/renderer/stores/audioStore.ts
2	0	src/renderer/stores/crossingStore.ts
387	43	src/renderer/stores/gameLoop.ts
103	17	src/renderer/stores/gameStore.ts
2	1	src/renderer/stores/loop/endingPosts.ts
2	2	src/renderer/stores/loop/exams.ts
1	1	src/renderer/stores/loop/homecoming.ts
5	3	src/renderer/stores/loop/hooks.ts
14	7	src/renderer/stores/loop/promptState.ts
5	4	src/renderer/stores/loop/relax.ts
50	7	src/renderer/stores/loop/saves.ts
2	1	src/renderer/stores/loop/sceneEvents.ts
17	0	src/renderer/stores/loop/state.ts
36	3	src/renderer/stores/loop/thumbnail.ts
7	7	src/renderer/stores/sceneSanitizer.ts
6	3	src/renderer/stores/slotActions.ts
49	9	src/renderer/stores/slotCrossing.ts
1	12	src/renderer/stores/slotIntroReply.ts
65	23	src/renderer/stores/textingLoop.ts
9	5	src/renderer/stores/whereabouts.ts
35	18	src/renderer/views/BunnyboardModal.tsx
2	1	src/renderer/views/CalendarModal.tsx
52	19	src/renderer/views/GameView.tsx
15	6	src/renderer/views/LandingChrome.tsx
27	10	src/renderer/views/LoadGameModal.tsx
4	3	src/renderer/views/MapModal.tsx
3	3	src/renderer/views/bgAssets.ts
51	0	src/shared/chatVisibility.ts
63	0	src/shared/opening.ts
95	2	src/shared/saveRules.ts
9	0	src/shared/textingClock.ts
36	0	src/shared/textingThread.ts
48	5	src/shared/types.ts
2	0	src/web/db/saves.ts
4	4	test/bunnybotSays.test.ts
2	2	test/characterDynamics.test.ts
45	0	test/chatVisibility.test.ts
33	0	test/enterGame.test.ts
15	0	test/gameStore.test.ts
48	1	test/kit/contract.test.ts
12	0	test/messageSlot.test.ts
55	0	test/opening.test.ts
3	3	test/qa2-memory-slot-participants.test.ts
14	0	test/savePassThrough.test.ts
8	0	test/saveRules.test.ts
46	0	test/saveService.test.ts
14	0	test/saves.test.ts
14	0	test/sceneSanitizer.test.ts
0	4	test/slotIntroReply.test.ts
17	0	test/textingClock.test.ts
43	0	test/textingThread.test.ts
9	0	test/webSaves.test.ts
```

### `ah-core/2-held-replies` · `c70d3a63`

31 files changed, 799 insertions(+), 73 deletions(-)

```text
15	0	MODDING.md
1	0	packages/modkit/CHANGELOG.md
34	0	packages/modkit/api/renderer.api.md
35	2	packages/modkit/api/shared.api.md
1	0	packages/modkit/src/bridge/renderer.ts
2	0	packages/modkit/src/host/renderer.ts
39	0	packages/modkit/src/renderer/hooks.ts
1	0	packages/modkit/src/renderer/index.ts
2	0	packages/modkit/src/shared/hookTable.ts
5	0	src/renderer/prompts/gameDate.ts
17	3	src/renderer/prompts/schedulePrompt.ts
25	5	src/renderer/prompts/textingPrompt.ts
42	2	src/renderer/stores/gameLoop.ts
8	2	src/renderer/stores/gameStore.ts
22	2	src/renderer/stores/loop/promptState.ts
7	1	src/renderer/stores/semesterCarry.ts
242	33	src/renderer/stores/textingLoop.ts
10	3	src/renderer/views/BunnyboardModal.tsx
12	5	src/shared/chatVisibility.ts
14	0	src/shared/heldReplies.ts
29	3	src/shared/saveRules.ts
27	0	src/shared/textingThread.ts
19	1	src/shared/types.ts
38	1	test/chatVisibility.test.ts
59	2	test/enterGame.test.ts
25	0	test/heldReplies.test.ts
2	0	test/kit/contract.test.ts
14	5	test/saveService.test.ts
13	0	test/semesterCarry.test.ts
31	1	test/textingThread.test.ts
8	2	test/webSaves.test.ts
```

### `ah-core/3-phone` · `a69475df`

27 files changed, 755 insertions(+), 72 deletions(-)

```text
18	0	MODDING.md
1	0	packages/modkit/CHANGELOG.md
27	0	packages/modkit/api/renderer.api.md
48	4	packages/modkit/api/shared.api.md
1	0	packages/modkit/src/bridge/renderer.ts
7	1	packages/modkit/src/host/renderer.ts
95	2	packages/modkit/src/renderer/hooks.ts
1	0	packages/modkit/src/renderer/index.ts
9	1	packages/modkit/src/shared/hookTable.ts
67	1	src/renderer/components/TextSpots.tsx
14	1	src/renderer/mods/readers.ts
1	1	src/renderer/prompts/textingPrompt.ts
14	0	src/renderer/stores/bunnyboardStore.ts
6	1	src/renderer/stores/gameLoop.ts
3	3	src/renderer/stores/gameStore.ts
31	1	src/renderer/stores/slotActions.ts
47	11	src/renderer/stores/textingLoop.ts
140	32	src/renderer/views/BunnyboardModal.tsx
62	5	src/renderer/vu_styles/Bunnyboard.css
5	0	src/renderer/vu_styles/tokens.css
25	0	src/shared/chatVisibility.ts
10	4	src/shared/types.ts
38	1	test/chatVisibility.test.ts
13	1	test/kit/contract.test.ts
1	0	test/modSlots.test.ts
27	2	test/slotActions.test.ts
44	0	test/texting.test.ts
```

## Paths that differ from the resolved reference

```text
M	DESIGN_GUIDE.md
M	MODDING.md
M	packages/modkit/CHANGELOG.md
M	packages/modkit/api/main.api.md
M	packages/modkit/api/renderer.api.md
M	packages/modkit/api/shared.api.md
M	packages/modkit/src/bridge/renderer.ts
M	packages/modkit/src/host/renderer.ts
M	packages/modkit/src/host/shared.ts
M	packages/modkit/src/renderer/index.ts
M	packages/modkit/src/shared/index.ts
D	packages/modkit/src/shared/memory.ts
D	packages/modkit/src/shared/memoryPresentation.ts
D	src/main/mods/catalog.ts
M	src/main/mods/session.ts
M	src/main/mods/structuredRequest.ts
M	src/preload/api.d.ts
M	src/preload/index.ts
M	src/renderer/mods/index.ts
M	src/renderer/mods/llm.ts
D	src/renderer/mods/promptReaders.ts
M	src/renderer/stores/modsStore.ts
M	src/renderer/stores/silentRetry.ts
M	src/renderer/stores/textingLoop.ts
M	src/renderer/views/LandingChrome.tsx
D	src/renderer/views/ModsBrowse.tsx
M	src/renderer/views/ModsModal.tsx
M	src/renderer/vu_styles/Mods.css
M	src/shared/llm/openaiAdapter.ts
D	src/shared/modCatalog.ts
M	src/shared/settingsRules.ts
M	src/shared/types.ts
M	src/web/bridge.ts
M	test/applicationCompose.test.ts
M	test/kit/contract.test.ts
D	test/kit/memoryPresentation.test.ts
D	test/kit/promptReaders.test.ts
D	test/modCatalog.test.ts
M	test/openaiAdapter.test.ts
```

## Branch 4

`mod/after-hours-built-in` · `3e36552be034dbe3da31dfa41a34cec5e4eb389a` · **After Hours: a built-in mod**

The branch starts at `ah-core/3-phone` (`a69475df`) and takes After Hours 0.7.10 from
`mod/after-hours-kit` (`e08ea793`). It adds 1,077 lines in nine files and removes none.

| File | Added |
| --- | ---: |
| `docs/mods/after-hours.md` | 182 |
| `src/renderer/modEntries/after-hours.ts` | 1 |
| `src/renderer/mods/afterHours.tsx` | 358 |
| `src/renderer/vu_styles/AfterHours.css` | 106 |
| `src/shared/afterHours.ts` | 182 |
| `src/shared/afterHoursText.ts` | 60 |
| `src/shared/modEntries/after-hours.ts` | 22 |
| `test/afterHours.test.ts` | 163 |
| `test/kit/modFiles.ts` | 3 |

The shared entry is picked up by the existing built-in list, which also supplies the
main process's built-in IDs. The renderer entry loads its hooks through the existing
built-in glob. The test registry declares the additional files for the boundary scan.
There are zero new boundary allowlist entries. Like other opt-in built-ins, After Hours
ships with `defaultOn: false`. Its four options default on once it is enabled.
The guide explains enabling it and keeps the existing changelog.

All of After Hours' required kit hooks are present in branch 3. No core files or kit
reports changed in branch 4.

### Draft PR description

Add After Hours 0.7.10 to Mods as an opt-in built-in. Stay up texting after the evening,
skip to tomorrow, or wake up beside the person you spent the night with and hear their
goodbye. Chats show receipts and give you a chance to confirm a meet-up, including a
warning if you have a commitment.

- **Busy status** lets you skip immediate meet-ups in chats you start.
- **Replies can wait** lets you text contacts who are in class, working, asleep or away.
  Their replies arrive when they are available.
- **The night** adds the late-night landing and the morning goodbye after a stay-over.
- **Status lights in Chats** shows who is available, busy or idle.

This depends on the night, held-reply and phone hooks in branches 1–3. After Hours is
off by default. With it off, the game plays as usual.

### Checks

- `npm ci` installed 456 packages from the lockfile. The existing Electron binary
  was reused.
- `npm run typecheck` passed for main, renderer and tests.
- `npm run report:check` reported all three kit API reports current.
- `npm run build` passed for main, preload and renderer.
- `npm test -- --maxWorkers=2` covered 438 files: 432 passed, three failed and three
  were skipped. Of 5,614 tests, 5,607 passed, three failed and four were skipped.
  The known Linux `getComfyOutputFilePath` assertion remains. The two other failures
  were timeouts. `rollerDerby.test.ts` passed all 26 on its own.
  `photoBrowserInvoke.test.ts` timed out on its first isolated retry, then passed
  with the default timeout on both branch 3 and branch 4. It also passed with a
  longer timeout on branch 4.
- After Hours, mod entry, mod switch and boundary tests passed together (53 tests,
  four files). After Hours alone passed all 23.
- Chromium showed version 0.7.10 with the built-in label and the switch off.
  Enabling it turned on the four options and activated the receipts, own meet-up
  and chat-list light hooks. Disabling it again deactivated all three hooks.
- The branch diff contains only the files in the table. The commit's SSH signature
  was verified locally.

The browser smoke check covered registration and switch behavior. A full in-game
playthrough comparison against `test/org-main-after-hours` with 0.7.10 installed
remains unverified.
