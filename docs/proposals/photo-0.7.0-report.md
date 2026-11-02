# Photo Feature on game 0.7.0

Inspected 2026-11-02. This is an inspection report, not an implementation. Only this report is retained; scratch merge commits and temporary test edits are discarded.

## Result

Photo can be rebuilt on 0.7.0 without a change to its existing save format. The game update did not change any of Photo's 41 owned files or its 79 boundary exceptions. The fork-only early-DM hook is still needed: stock 0.7.0 has neither `PromptAddition.lead` nor `dmReplyLead`.

The core hook needs one import conflict resolved. Photo 1.7.0 then merges cleanly, passes typecheck and the kit tests, but has five stale regeneration-test assertions. The kit-switch/1.6.0 inspect-redraw branch needs one allowlist conflict resolved and then passes all requested checks. These trials are separate alternatives, not a tested combination of Photo 1.7.0 and the kit switch.

## Refs and method

| Input | Inspected commit |
| --- | --- |
| Old 0.6.0 base | `55eac8eb` |
| 0.7.0 main, org #237 | `4b61c663` |
| Org core, including #238 | `38448c7d` |
| Fork `core/photo-hook-1.7.0` | `99448bc6` |
| Fork `mod/photo-1.7.0-vu0.6.0` | `834ed9e1` |
| Fork `mod/photo-kit-switch` | `86547c53` |
| Notes branch before this report | `ea3211ba` |

The game comparison is `git diff 55eac8eb..4b61c663`, not a comparison of the old feature branch's whole tree against current main. Branch changes are measured from their merge bases. This matters: comparing the kit-switch tree directly to main misleadingly shows newer core work as deleted; merging the branch does not delete it.

Read the repository instructions and the design, UI and modding guides. Installed root and kit dependencies in a scratch worktree using Node 24.19.0/npm 11. Ran the unchanged 0.7.0 checks first, then each resolved trial sequentially. No production source, dependency lockfile, branch result, or temporary assertion change is included in this report commit.

## 1. Kit contract

| Surface Photo uses | Change in 0.7.0 | Photo impact / rebuild |
| --- | --- | --- |
| `PromptAddition`, `promptFields`, `promptRequired` | Existing signatures and behavior unchanged. Stock functions still take only `spot`; the addition has no `lead` flag. | Reapply the fork extension: `lead?: boolean` and optional `part?: 'lead' \| 'trailing'` filters. Calls without `part` must keep their old behavior. |
| `afterDmReply`, `afterReachOut`, `dmHistoryNote`, `PostPictureProps` | No signature or dispatcher changes. | Existing registrations remain valid. Add `dmReplyLead` alongside them, not in place of the completed-reply hook. |
| `useModalShell`, `useDismissLayer` | `src/renderer/components/useModalShell.ts` adds internal `shellOpen()` for New Game's Escape handling; existing exported behavior/signatures remain. | No Photo rewrite needed. `shellOpen` is not a new public Photo dependency. |
| `TextField`, `TitleTab` | Components and existing kit exports unchanged. | Inspect/redraw UI still typechecks. |
| `gestures`, public motion presets | Existing kit presets unchanged. In `src/renderer/views/motion.ts`, `doubled` changes from variants to a static `MotionStyle`. It is not among the kit's exported presets. | Photo's kit imports are unaffected. Do not copy the old whole motion module. |
| `modState`, `saveField` | Their implementation files are unchanged. | No mod slice/field migration required by this update. Preserve disabled-mod data. |
| Hook table | Adds `promptText`, `sceneCall`, `sceneReplyLanded`, `sceneCut`, `switchedOn`, and the `advancedSettingsEntry` slot. Main `invoke` registration and `renderer:invoke` also arrive in this interval. Existing Photo hooks remain. | Preserve the new rows when adding `dmReplyLead`; do not replace the table with the fork's old copy. |
| Contract version | Root game/package, `BUILD.version`, kit package and `KIT_VERSION` are now `0.7.0`, previously `0.6.0`. | Keep the 0.7.0 metadata when rebuilding. `KIT_VERSION` is informational; compatibility is checked per hook/API. |

Relevant commits: `e2d5469a` (#226, main readers), `87d8e0f8` (#227, own-main invoke), `508f3ea2` (#232, prompt/scene hooks and readers), `435a8a2d` (lifecycle/Advanced slot), and `2a4b8942` (release metadata). The modal/motion changes came through the New Game integration (`04a7563c`, `54eab047`; motion also has `ddba8695` in its path history).

The changed kit files include `src/{bridge,host}/renderer.ts`, `src/renderer/{hooks,index,sceneField}.ts`, `src/shared/{hookTable,index,version}.ts`, the main/shared bridges, and all three API reports. Existing Photo contracts were retained; the additions are not a replacement Photo API. The new hook's API report, documentation and changelog still need to be regenerated/updated in the actual core rebuild: `99448bc6` itself changes eight code/test files and does not include those documentation/report updates. Its hook-table `since: '0.3.0'` should also be reconsidered against the version that actually introduces the fork extension.

### #238, separately

`4b61c663..38448c7d` changes only `packages/modkit/src/renderer/hooks.ts`, `packages/modkit/CHANGELOG.md`, and `test/switchedOn.test.ts`. A `switchedOn` reader gets a 10-second timeout, logged like a rejected reader; its underlying asynchronous work is **not cancelled**. It does not change Photo's prompt/reply hooks, texting, files, or main APIs. Current Photo registrations do not use `switchedOn`.

It shares `hooks.ts` with the fork extension but changes another section. `git merge-tree --write-tree` of #238 with the resolved core-hook trial reports a clean merge. The requested trial test results below are on `4b61c663`, not #238. If Photo later adopts asynchronous `switchedOn` initialization, fence late results rather than assuming the boot wait cancels them.

## 2. Texting and the early-DM hook

Changes in `961d8456` and `508f3ea2`:

- `src/renderer/stores/textingLoop.ts` obtains global prompt edits from the core `promptTextEdits()` hook instead of Prompt Studio's `textEditsNow()`. Its hook import now includes `promptTextEdits`.
- `src/renderer/prompts/textingPrompt.ts` imports `GlobalTextId`/`TextEdits` from `@shared/promptText` rather than `@shared/presets/types`, and describes the global edits generically. Keep that new type source.
- `src/renderer/stores/textingStream.ts` is unchanged. `textingSchema()` is unchanged: native `messages`, `summary`, `blocked`, followed by the mod fields/requirements. It does not start the Photo render early.
- Normal `afterDmReply` remains after the blocked-reply early return (`textingLoop.ts:712` on stock 0.7.0). Regeneration calls it only after the replacement commit and current-thread check (around line 833). `afterReachOut` remains after `deliverContactTexts` actually files texts (around line 1792).
- The delta handler (around lines 642–644) still rejects a foreign group and an abandoned entry before extracting messages. The final reply remains authoritative. There is no native lead reader.

The fork extension still applies. Its only textual conflict is the hook import in `textingLoop.ts`; resolve it to:

```ts
import { afterDmReply, afterReachOut, dmReplyLead, promptTextEdits } from '../mods/hooks'
```

All other core patch files merge automatically. Preserve the existing group/abandonment guards, put the lead reader after them and ahead of message extraction, and retain the completed-reply path. The fork puts lead properties/requirements before messages and removes duplicate trailing properties. `createDmLeadReader` reads the top-level JSON prefix once when the `messages` key arrives; it does not require a full reply. The four existing `textingLead` tests pass on both core and Photo 1.7.0 trials.

Rebuild risk: early generation is speculative. Final blocked/failed replies, a loaded game, a disabled mod, changed authoritative Photo fields, or an abandoned reply must not attach the speculative result. The branch has ownership/discard checks in `photoTurn.ts`; the checks here do not constitute an end-to-end test of every streamed early-render race. Preserve them and add focused save-integrity coverage when rebuilding rather than treating the four parser tests as coverage of those races.

## 3. Boundary

`test/kit/modFiles.ts` changes only Prompt Studio's ownership in this interval. Photo's glob block and two automatically owned entry files are unchanged. Expanding that block plus `src/{shared,renderer}/modEntries/photo-feature.ts` yields **41 files**, none changed by 0.7.0.

`test/kit/boundaryAllowlist.json` shrinks from other migrations: `493430c7`/`c2e2767e` (Maestro, #225), and `961d8456` (Prompt Studio, #235). All **79 Photo rows** are identical between 0.6.0 and 0.7.0. No Photo exception was added, removed, or renamed. Every local allowlisted target still resolves at `4b61c663`; Electron remains an external import. Typecheck and the boundary test also pass on stock 0.7.0.

The separate kit-switch commits are `930ba4ea` (public readers/BunnyBot) and `86547c53` (inspect/redraw). Their actual branch delta is 34 files. They remove **42 Photo exceptions**, add none, leaving **37** after combining with current main. This does not complete the kit migration: stores, the lightbox/Echo UI, image drafts, and native main services still have direct imports. For example, the switch still imports `runGenerationJob`, `findImage`/`dropImageTwins`, and `writeAtomicBytes` from native services. The old branch adds ownership for the two workflow JSONs, `PhotoInfo.tsx`, `photoRedraw.ts`, `PhotoInfo.css`, `photoTips.ts`, and `PostComments.css`; keep those additions alongside main's current ownership.

### Photo globs on 0.7.0

The two entry files above are automatic, in addition to:

```text
src/shared/photo{Body,Duo,Files,Framing,Gate,Loader,Pose,Prompt,Switches,Types,Wardrobe,Words}.ts
src/shared/characterBody.ts
src/shared/heldPosts.ts
src/shared/postAudience.ts
src/main/photo*.ts
src/main/bodySetting.ts
src/main/localPhotoBackup.ts
src/main/services/localPhotoService.ts
src/preload/photoApi.ts
src/renderer/components/PhotoBubble.tsx
src/renderer/components/PhotoPostSpots.tsx
src/renderer/stores/localPhotoStore.ts
src/renderer/stores/photo{Comments,Group,Post,Recovery,SwitchHooks,TipDelivery,Turn,Webp}.ts
src/renderer/views/ContactGallery.tsx
src/renderer/views/bodyFields.tsx
src/renderer/views/bodyDrafts.ts
src/renderer/prompts/photoBrief.ts
src/renderer/prompts/bodyBrief.ts
src/renderer/vu_styles/PhotoBubble.css
src/renderer/vu_styles/ContactGallery.css
src/renderer/vu_styles/BodyFields.css
```

### Photo allowlist rows on 0.7.0

Each cell lists the exact import specifiers for that source file (79 rows total).

| Source file | Allowed imports |
| --- | --- |
| `src/main/bodySetting.ts` | `@shared/types` |
| `src/main/localPhotoBackup.ts` | `./paths`, `./services/archiveService`, `./services/imageFiles`, `@shared/backup`, `@shared/characterRules`, `@shared/saveRules` |
| `src/main/photoIpc.ts` | `./services/comfyService`, `@shared/jobQueue`, `@shared/types` |
| `src/main/photoProtocol.ts` | `./paths`, `./services/imageFiles`, `@shared/characterRules`, `@shared/saveRules` |
| `src/main/services/localPhotoService.ts` | `./characterService`, `./comfyService`, `./imageFiles`, `./jsonFile`, `./saveService`, `@shared/characterRules`, `@shared/comfyModels`, `@shared/errors`, `@shared/imageBytes`, `@shared/types` |
| `src/preload/photoApi.ts` | `@shared/types`, `electron` |
| `src/renderer/components/PhotoBubble.tsx` | `../stores/bunnyboardStore`, `../stores/gameStore`, `../views/motion`, `../views/screenIcons`, `./Lightbox`, `@shared/types` |
| `src/renderer/components/PhotoPostSpots.tsx` | `../stores/gameStore`, `../views/motion`, `../vu_styles/PostComments.css`, `@shared/hash`, `@shared/postComments` |
| `src/renderer/modEntries/photo-feature.ts` | `../stores/gameStore`, `@shared/mods` |
| `src/renderer/prompts/photoBrief.ts` | `@shared/relationship` |
| `src/renderer/stores/localPhotoStore.ts` | `./gameStore`, `./loop/saves`, `./loop/state`, `./loop/stream`, `./settingsStore`, `./setupStore` |
| `src/renderer/stores/photoComments.ts` | `../prompts/feedRandoms`, `./gameStore`, `./grabBagStore`, `@shared/feed`, `@shared/jobs`, `@shared/npcRelationships` |
| `src/renderer/stores/photoGroup.ts` | `./gameStore`, `@shared/mods`, `@shared/npcRelationships` |
| `src/renderer/stores/photoPost.ts` | `./gameStore`, `./settingsStore` |
| `src/renderer/stores/photoRecovery.ts` | `./gameStore` |
| `src/renderer/stores/photoSwitchHooks.ts` | `./settingsStore` |
| `src/renderer/stores/photoTipDelivery.ts` | `../prompts/bunnybot`, `../prompts/photoTips`, `./gameStore`, `./textingLoop` |
| `src/renderer/stores/photoTurn.ts` | `./gameStore`, `@shared/relationship` |
| `src/renderer/stores/photoWebp.ts` | `@shared/types` |
| `src/renderer/views/ContactGallery.tsx` | `../stores/feedRolls`, `../stores/gameStore`, `./EchoPanel`, `./screenIcons` |
| `src/shared/modEntries/photo-feature.ts` | `../imagePromptDrafts` |
| `src/shared/photoDuo.ts` | `./npcRelationships` |
| `src/shared/photoGate.ts` | `./relationship`, `./types` |
| `src/shared/photoPrompt.ts` | `./dorms`, `./locations` |
| `src/shared/photoTypes.ts` | `./types` |
| `src/shared/photoWardrobe.ts` | `./outfits`, `./types` |

## 4. Photo-owned files

No 0.7.0 commit changes a file owned by the current `photo-feature` globs or its entries. This includes `photoPrompt`, `photoPose`, `photoWardrobe`, the remaining shared Photo helpers, `PhotoBubble`, `PhotoPostSpots`, `ContactGallery`, their CSS, the Photo stores, `photoApi`, `photoIpc`, `photoProtocol`, `localPhotoService`, and `localPhotoBackup`. `PhotoInfo`/`photoRedraw` are additions on the feature branches, not work already included in 0.7.0.

Tests named Photo do change: `photoSwitchGates.test.ts`, `qa2-photo-reservation.test.ts`, and `qa2-textregen-photo.test.ts` gain the Maestro kit fixture import. These are integration-fixture changes, not a Photo behavior rewrite. Keep those imports when carrying older tests forward. The trials retain them automatically.

The Photo 1.7.0 and kit-switch branches both carry inspect/redraw code. Do not stack old whole-file versions of these overlapping Photo files without reconciling the 1.7.0 prompt/pose/wardrobe and early-render work. The requested trials do not test that additional combination.

## 5. Main-process dependencies

| Dependency | What landed in 0.7.0 | Rebuild consequence |
| --- | --- | --- |
| `comfyService.runGenerationJob` | Implementation unchanged; already existed at 0.6.0. No kit export added. | Photo's native dependency remains. An eventual standalone kit conversion still needs an appropriate render API. |
| `jsonFile.writeAtomicBytes` | Implementation unchanged; now re-exported through `@vx/modkit/main`, with `readJsonFile` and `writeAtomicJson` (`508f3ea2`). | Photo can replace this direct import without inventing a new writer; the old kit-switch branch does not yet do so. |
| `imageFiles` | Implementation unchanged. `sniffImageFile` becomes public in #226 (`e2d5469a`). `findImage`/`dropImageTwins`, which Photo uses, do not become public. | Sniffing alone does not replace Photo's image-file access. |
| `paths` / `photoProtocol` | `paths.ts` adds `getApplicationPath` for New Game (`04a7563c`/`54eab047`). Existing Photo paths and `photoProtocol.ts` are unchanged. | No Photo directory, naming, or URL migration. Direct path dependencies remain. |
| Backup/archive | `archiveService.ts` and Photo's `localPhotoBackup.ts` are unchanged. `backupService.ts`/`shared/backup.ts` carry and validate optional in-progress New Game applications, then restore them in the staged saves folder. Existing mod-part preflight/restore ordering is retained. `src/web/backup.ts` likewise validates, exports and restores applications in its IndexedDB transaction. `studioBackupService.ts` moves to the public kit writer in `961d8456`. | Keep the new applications data on rebuild; no Photo backup-field migration is introduced by 0.7.0. Native archive extraction now has the public `extractZip` export. |
| #226 main readers | `extractZip`, `sniffImageFile`, `modOptionOn`, their bridges/table entries and contract tests landed (`e2d5469a`, merged via `31903e3d`). | Available now; use where the operation matches, without replacing different Photo operations just because their names are nearby. |
| #227 own-main invoke | `src/main/mods/invoke.ts`, loader/session integration, IPC/preload/web/renderer transport and kit registration landed (`87d8e0f8`, merged via `5d183135`). | A mod can call its own declared main handlers via `renderer:invoke`; this is transport, not a renderer for Comfy jobs and not arbitrary access to other mods' handlers. |
| `renderComfyImage` | **Not present** in 0.7.0 source or kit exports. Also not added by #238. | Do not plan the rebuild around it being available. Keep the existing native render dependency until a separate reviewed API exists. |

## 6. Trial merges and checks

Each trial started from the stated parent and used ordinary `git merge --no-ff --no-edit`. Typecheck means all three configured projects (node, web, test). Kit means `npx vitest run test/kit`; Photo means every top-level `test/*.test.ts` whose filename contains `photo`, case-insensitively, including the `qa2` cases. Streaming lead tests were run separately where present.

| Tree | Conflicts / straightforward resolution | Typecheck | Kit tests | Photo tests | Lead tests |
| --- | --- | --- | --- | --- | --- |
| Unmodified `4b61c663` | Baseline | ✅ Pass, 3 projects | ✅ 108/108, 6 files | ✅ 280/280, 21 files | Not present |
| `99448bc6` onto `4b61c663` | `textingLoop.ts`, one import hunk; keep both added names | ✅ Pass, 3 projects | ✅ 109/109, 6 files | ✅ 280/280, 21 files | ✅ 4/4 |
| `834ed9e1` onto that core result | Clean merge, no further resolution | ✅ Pass, 3 projects | ✅ 109/109, 6 files | ❌ 506 passed, 5 failed; 22 files | ✅ 4/4 |
| `86547c53` onto `4b61c663` | `boundaryAllowlist.json`, three hunks; preserve both sides' deletions | ✅ Pass, 3 projects | ✅ 108/108, 6 files | ✅ 283/283, 22 files | Not present |

For the allowlist resolution, start from the common base (`deb122b8`): keep a base row only if both sides retain it, and retain either side's genuinely new rows. Neither branch adds rows here. Counts are 598 at the common base, 503 on current main, 556 on kit-switch, and 461 in the resolved merge. Do **not** take the entire old allowlist or keep the obsolete Prompt Studio/Meanwhile rows shown on the old side of the conflict.

### Photo 1.7.0 failure and throwaway verification

`test/qa2-textregen-photo.test.ts:42` expects a three-argument call to mocked `sendPhoto`. Photo 1.7.0's entry calls `sendPhoto(charId, character, reply, true)` so the completed reply can claim its early render. All five outcomes fail at that same preliminary assertion, before testing the replacement. The accepted-outcome assertion near the end has the same stale arity.

Temporary verification on the merged 1.7.0 tree: append `, true` after the third argument in both `toHaveBeenCalledWith` assertions (one with `sendPhoto: false`, the other with `sendPhoto: true`), then run:

```sh
npx vitest run test/qa2-textregen-photo.test.ts
```

**✅ All 5 pass**: accepted, failed save, load during save, new hangout, and blocked replacement. Restore the test afterward. The raw merge still fails the requested Photo suite; this is a needed test update, not evidence that the game update broke Photo dispatch. The modified test and its result are not included in the production branches. The full 511-test Photo selection was not rerun with those assertions changed; the separate run verifies the five failing cases.

### Reproduction

Fetch the exact refs above into a disposable worktree, install with `npm install` and `npm --prefix packages/modkit install`, then merge and resolve as described. Run:

```sh
npm run typecheck
npx vitest run test/kit
photo_tests=$(rg --files test -g '*[Pp]hoto*.test.ts' | sort)
npx vitest run $photo_tests
# On the core-hook and 1.7.0 trials:
npx vitest run test/textingLead.test.ts
```

Run each set to completion before changing the scratch tree. The recorded core-hook results are from a clean rerun of that exact tree. Scratch dependency installs were reused between trials because these feature merges do not change dependencies. The Linux 7za executable bit was enabled in the scratch dependency directory.

Not verified here: full `npm test`, desktop/web builds, Electron smoke, kit API-report regeneration/check, live Comfy generation, visual behavior, or an actual old-save round trip in the running game. The kit and Photo suites are the scope requested for these trials; passing them is not a claim that those other checks passed.

## 7. Versions and compatibility

`package.json`, `src/shared/mods.ts` (`BUILD.version`), `packages/modkit/package.json` and `packages/modkit/src/shared/version.ts` all say **0.7.0**. Root package metadata comes through the upstream release sync (`b329c88a`); `2a4b8942` updates the VE build label, while `508f3ea2` bumps the kit package/contract version. Keep those values; merging these feature branches does not require reverting game/kit metadata.

The built-in Photo `ModDef` is **1.6.0** on 0.7.0 and the kit-switch branch, and **1.7.0** on `834ed9e1`. A game bump does not force a matching mod version: keep 1.7.0 for the rebuilt Photo release, and name its branch `mod/photo-1.7.0-vu0.7.0`. The in-repository `ModDef` has no game compatibility range to adjust. Keeping the old kit-switch's 1.6.0 number is mechanically valid for the trial; before shipping its new inspect/redraw behavior, choose the intended mod release/version and update the page/changelog accordingly, especially if folding it into 1.7.0.

For a future packaged mod, manifest `kit` is required text, but the loader checks named hooks/APIs rather than enforcing it as a kit-version range. An optional `game` range that excludes 0.7.0 produces a **warning**, not a refusal (`src/main/mods/loader.ts:193`). Update that range to the versions actually verified. An unknown declared hook such as `dmReplyLead` does produce `needs-update` through `checkCompat`: Photo 1.7.0 cannot rely on that hook existing on unmodified stock 0.7.0. Ship it only against a core that provides the extension, with the declaration and contract table consistent.

## Rebuild work, risks first

1. **Protect early-render ownership and save integrity.** Carry the lead hook/parser and Photo's late-result/discard checks together; verify load, disabled mod, abandoned/blocked reply, failed save and authoritative fields differing from the preview. Fix the two stale regeneration assertions and retain their five behavioral cases. The remaining streamed early-render races need focused verification before release.
2. **Rebuild `core/photo-hook-1.7.0` from the intended 0.7.0 core.** Keep `promptTextEdits` and `dmReplyLead` in the one conflicting import. Preserve the new hooks/readers and, if using current org core, #238's timeout. Retain the four parser tests and identity contract test; regenerate kit reports, update MODDING/kit changelog, and give the added contract honest introduction metadata.
3. **Rebuild `mod/photo-1.7.0-vu0.7.0` on that core result.** Its current branch merges cleanly. Preserve the 1.7.0 prompt, pose, wardrobe, sidecar/inspect/redraw and early-render changes, the updated fixture imports, and 0.7.0 game metadata. Keep Photo's stable id and existing saved fields; verify old saves in the app before shipping.
4. **Rebuild the kit switch from its actual two-commit delta.** Preserve both sides' allowlist reductions (79 → 37 Photo exceptions), add its ownership globs, and retain current main's Prompt Studio ownership. Reconcile its overlapping inspect/redraw files with 1.7.0 explicitly; that combined result has not been trialled here. Avoid overwriting 1.7.0 files with their older 1.6.0 copies.
5. **Separate remaining kit gaps from the game upgrade.** The public atomic writer and own-main invoke are available, but `renderComfyImage`, `findImage`/`dropImageTwins`, and Photo path/UI/store access are not all public. Do not claim a complete kit conversion or remove necessary boundary rows until those imports are actually replaced. Run typecheck/kit/Photo checks again on the final combination, then the normal full release checks.
