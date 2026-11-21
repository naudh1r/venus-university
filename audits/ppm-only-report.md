# Photo Feature 1.9.0: photos of two require ComfyUI-ppm

## Branches and commits

Repository: `https://github.com/naudh1r/venus-university.git`. Author and committer for every task commit: `Naudh1r <102735014+naudh1r@users.noreply.github.com>`. No co-author trailers. Default signing was used as previously requested.

Core branch `hooks/pack-on-own-comfy`, based on `fork/naudh1r-core` at `e127302a`:

- `14e7b849fc5c07ed9629a76de9f0a84fe836d748`: **Kit 0.8.2: check node packs on the player's own ComfyUI**.
- `ce89b510733ab5d34185facfc0dca62c1c28d173`: **Kit 0.8.2: refresh pack users when the external ComfyUI address changes**.

Photo branch `mod/photo-1.9.0-ppm-only`, based on `fork/mod/photo-feature-kit` at `14171b33`:

- `5d48b5d0`: **Photo Feature 1.9.0: merge checks for packs on the player's own ComfyUI**.
- `1df0ddb6128fc1d9f3cb60c0ea1d5f48d8305ca7`: **Photo Feature 1.9.0: merge external server change notifications**.
- `96e545a28b5eea25ac4137e92a0f3ac4e173799e`: **Photo Feature 1.9.0: draw photos of two only with installed ComfyUI-ppm**.

Kit stays at 0.8.2 and Photo at 1.9.0. The existing 0.8.2 changelog section is extended. The parked branches were neither merged nor changed: hooks/option-requires remains `cbc481ae` and mod/photo-1.9.0-requires remains `776ded3b`. Read the latter's Rebuild implementation and reused its prompt-preserving orientation redraw, without bringing in option requirements.

Only the two named implementation branches and the named `notes/standalone-mods` report branch are push destinations. No rebase, force push, PR or organization write. This report is committed only under audits on notes/standalone-mods. README.md, DESIGN_GUIDE.md, UI_STYLE_GUIDE.md and TESTING_PLAN.md are unchanged. No screenshot was added to any task commit.

## Core changes, file by file

| File | Change |
|---|---|
| src/main/services/comfyObjectInfo.ts | Extracted the existing object_info transport into one shared implementation. Added a two-second external pack probe, one-minute cache per address, shared concurrent requests, cached unreachable answers and explicit invalidation. |
| src/main/services/comfyService.ts | Uses that shared transport for existing node/model checks. Forgets external pack probes along with server verification after an external render fails. |
| src/main/services/settingsService.ts | Observes source/address on read and after successful writes, invalidating pack probes when that selection changes, including changing away and back. |
| src/main/services/setupService.ts | External pack state checks every registered class against the server's listing. All present means installed, any absent means missing, unavailable/invalid/timed-out listing means unmanaged. Managed folder/module probes stay unchanged. Installation remains refused on an external source, including when its state now answers missing or installed. |
| src/renderer/mods/readers.ts | Existing subscribeLocalImageSource now also notifies on an external address change, without exposing the address. Its getter and capability signature are unchanged. Managed-address edits do not notify. |
| MODDING.md | Documents the external states, probe deadline/cache and address-change notification. |
| packages/modkit/CHANGELOG.md | Added the behavior to unreleased 0.8.2, without a version bump. |
| test/comfyPackOnOwn.test.ts | Faked-server tests for all classes present, one absent, unreachable, shared/expired cache, source/address invalidation, and refusal to install into managed ComfyUI while external is selected. |
| test/kit/nativeReaders.test.ts | Covers the address-change notification without revealing the address. |

The existing render listing has its own lifetime because jobs also validate core classes and model options against it. Pack probes reuse the same transport, with the shorter deadline and brief cache appropriate to a frequently read availability check. A malformed JSON shape counts as an unanswered probe. No new public API or capability was added. API report:check passes without an API report diff.

## Photo removals and retained behavior, file by file

| File | Removed, changed or retained |
|---|---|
| assets/workflows/characterPhotoDuo.json | Deleted the portrait ConditioningSetArea graph. |
| assets/photo/characterPhotoDuoAreaWide.json | Deleted the wide ConditioningSetArea graph. |
| src/main/services/localPhotoService.ts | Removed area graph imports, the ppm option check, off state, ppmInUse yes/try/no selection, area rendering, ppm-to-area prompt conversion and the COMFY_NODES_MISSING retry. Every duo render independently requires installed ppm. Converts old halves before redraw while retaining scene/negative, preserves supplied ppm halves and writes couple: ppm on success. Info converts old halves for display. Explicit Rebuild always builds ppm. |
| src/shared/photoDefinition.ts | Removed the ppm option. The duo hint names its ppm prerequisite and solo behavior without it. |
| src/shared/photoSwitches.ts | Removed ppm from the switch interface, defaults and reader. Added the process pack-state binding. duoPhotosOn requires generation, the duo option and a confirmed installed pack. |
| src/shared/photoTypes.ts | Removed the area couple and PhotoPpmState off. Retains optional sidecar couple: ppm, with absence accepted for old photos. |
| src/shared/photoPrompt.ts | Removed area-style half construction. Duo halves always use ppm's whole-picture head count. Kept faceHalfOf for the ppm graphs' individual face passes. |
| src/renderer/stores/photoPpm.ts | Added the single non-persistent renderer pack-state store and guarded asynchronous refresh. |
| src/renderer/modEntries/photo-feature.ts | Binds/starts the pack store, refreshes at game entry and switch-on, and moves optionControls from ppm to duo. |
| src/renderer/stores/photoSwitchHooks.ts | Removed the ppm option subscription and subscribes components to the shared pack state. |
| src/renderer/stores/photoOrientation.ts | Removed separate per-component pack probes and switch/fallback logic. First duos use wide when the shared answer is installed. Loaded photos retain their actual dimensions. |
| src/renderer/components/PhotoPpmControl.tsx | Uses the shared store. Refreshes on mount/option enable and after install, even if the control unmounts during installation. Offers managed installation or instructions for the player's own server. |
| src/renderer/components/PhotoInfo.tsx | Sends ppm explicitly for duo redraws. Wide/portrait switching resends the edited fields without an internal Rebuild. Old converted photos retain the Rebuild button and show their new halves before drawing. |
| src/renderer/stores/photoInvoke.ts | Updated the info and pack-state contracts' comments. |
| src/renderer/stores/photoWebp.ts | Refreshes the pack answer after a failed duo render, before returning that failure to its caller. |
| src/renderer/stores/photoGroup.ts | Invalidates a pending pair when the duo gate becomes false before another scene request. Existing feed/scene solo selection and cooldown rules remain behind the one duoPhotosOn gate. |
| test/fixtures/photoSwitchState.ts | Removed ppm switch plumbing and supplies an explicit fake pack-state binding for pairing fixtures. |
| test/kit/modFiles.ts | Removed deleted graphs from Photo's inventory and added the new Photo-owned store. No import-boundary allowlist additions. |
| test/photoDuo.test.ts | Removed the test comparing ppm to the deleted area builder and the old default-area assertion. Retained ppm and face-pass coverage. |
| test/photoRedraw.test.ts | Keeps old sidecar read tests. Replaces saved-method Rebuild expectations and covers conversion, retained scene/negative/seed, unchanged inspection, both orientations, edited ppm halves, refusal without ppm, and no retry or file write after failure. Area remains only as an invalid stored/override value in refusal tests. |
| test/photoSwitches.test.ts | Removes the ppm default and tests duo enabled/disabled across unknown, installed, missing, invalid and unmanaged states. |
| docs/mods/photo-feature.md | Rewrites requirements, Settings table, Two in one photo, info-panel behavior, 1.9.0 changelog and modder documentation for ppm-only duos. |

**Workflow deletion audit:** searched the repository for the exact portrait graph name and ConditioningSetArea before deleting. The only explicit consumers of characterPhotoDuo.json were Photo's localPhotoService and its MOD_FILES inventory. Core's workflowClasses enumerates every graph under assets/workflows generically, but no other feature selects this graph. Removing it also removes its classes from that generic check. No outside-Photo consumer needed the file retained. The wide area graph was also Photo-only.

Kept `assets/photo/characterPhotoDuoWide.json` and `assets/photo/characterPhotoDuoPpm.json` unchanged for ppm wide/portrait rendering. They stay outside core's globally checked workflows folder. Kept the solo graph and wide solo clone, both orientation controls, safe file writes, sidecar validation, recorded-image display, reservation/cancellation and redraw persistence. readPhotoSidecar still accepts duo records without couple. Old images are never modified merely by inspection.

## State refresh and method flow

The renderer entry binds duoPhotosOn to the one photoPpm store. It starts unknown, which means no duos. It refreshes at entry startup, game entry, mod switch-on, control mount/enable, after install, after a failed duo render, and on ComfyUI source or external address changes. Source/address changes clear the old answer synchronously before starting the new probe. A revision counter prevents an older in-flight result from overwriting a newer source's state. The state is not saved. Main also checks the pack independently at each duo render.

The duo gate is evaluated before feed companion selection and scene pairing. Without an installed answer those paths behave as with the duo option off, including no pair cooldown checks. The saved duo choice stays on. The removed ppm key is ignored rather than rejected or used as a hidden switch.

Old sidecars have no couple marker. Info rebuilds their halves for ppm, retains their saved scene, negative, seed and orientation, and returns couple: ppm without writing the sidecar. The dialog shows those halves as editable fields and sends the marker explicitly to the new reserved filename. Main also rebuilds halves when supplied prompts lack a ppm marker. A plain ppm redraw uses its supplied prompts unchanged. Explicit Rebuild regenerates ppm prompts from current tags. Orientation changes resend the current fields rather than calling Rebuild.

No duo render runs unless the pack answers installed, including on the player's own ComfyUI. Without it, the existing PHOTO_WIDE_NEEDS_PPM code refuses either orientation with a note pointing to Two in one photo. If nodes disappear after that check, the render fails once. Core forgets the external listing/probe and Photo refreshes availability, so the next slot can take the solo path. There is no old-method fallback.

## Copy choices

Drafted the hint and notes against the existing option descriptions and full-sentence installation notes. Compared “Requires ComfyUI-ppm”, “Install the pack below” and “Needs ComfyUI-ppm, installed here”. Chose the last plus “Without it, every photo shows one person” to name both the prerequisite and the behavior. The own-server note names where to install and asks the player to restart that server. New player-facing additions have no semicolons. No new tests assert labels, wording or layout.

## Validation

| Check | hooks/pack-on-own-comfy | mod/photo-1.9.0-ppm-only |
|---|---|---|
| npm run typecheck | PASS | PASS |
| Final full test run | 2,720 passed, 4 skipped, 1 permitted failure | 3,343 passed, 4 skipped, 1 permitted failure |
| Final test files | 220 passed, 3 skipped, 1 failed | 241 passed, 3 skipped, 1 failed |
| Focused checks | 38 passed in the initial 3 pack/settings suites | 572 passed in 17 Photo/boundary suites |
| npm run build | PASS | PASS |
| npm run build:web | PASS | PASS |
| Kit report:check | PASS | PASS |
| npm run test:electron under xvfb-run | 42 checks passed across 6 scenarios | 42 checks passed across 6 scenarios |
| git diff --check | PASS | PASS |

The final full runs use `npm test -- --maxWorkers=1 --testTimeout=30000`, sequentially on the two branches. Earlier overlapping cold builds and suites exceeded the default five-second deadline in unrelated npcRelationships and kit/promptState cases. The final commands change concurrency/deadlines only, with no test-source timeout changes or skipped assertions. Core's final sole failure is the explicitly permitted Linux getComfyOutputFilePath case in test/mainServices.test.ts, “refuses every name that lands anywhere else, and refuses it permanently”. Photo’s final sole failure is the same permitted Linux case.

Electron used noNsfwImages and lessNsfwText both true. Temporary runner settings were restored, leaving no e2e-source diff. Both typecheck runs cover node, web and test projects. The Photo boundary suites pass without allowlist changes. Kit and Photo versions are unchanged, and the four protected files have no diff.

## Running app and screenshots

Screenshots are outside the repository in `/workspace/scratch/ppm-only/`, never committed:

- `mods-duo-without-ppm.jpg`: duo is saved on, managed ppm is missing, and the install control appears under duo. Effective duo is false.
- `mods-own-comfy-missing-ppm.jpg`: own server answers an empty class listing. Effective duo is false and the control explains installation on that server, without a managed-install button.
- `mods-duo-with-ppm.jpg`: changed the external address to a server listing AttentionCouplePPM. Effective duo is true and the installed note appears. No ppm switch exists.
- `old-duo-rebuilt-info.jpg`: the real info dialog shows newly built ppm halves, seed 42, the original scene and lowres negative, plus wide/portrait and Rebuild controls. The sidecar still holds its original OLD AREA LEFT/RIGHT fields and no couple marker after inspection.
- `observations.json`: actual effective duo reads and saved switches at each pack state. The obsolete saved photo-feature:ppm key remains present and harmless in all three observations.

These are native Electron captures at 1280 by 1024 with the app's own stage framing. Both safe settings are true. The UI harness uses temporary data, a safe synthetic image, a copied save, and a temporary second character. It loads the current renderer through Vite and the built main process. Managed-missing is the actual missing runtime/pack state. External missing/installed states come from local fake HTTP servers serving object_info, through the real core and Photo handlers. No IPC handler or comfyNodePackState result is replaced. Changing only the external address exercises the new refresh notification. The three requested screenshots are supplied in the reply, with the extra own-server capture available beside them.

## Limits and unclear points

No remaining ambiguity in the requested behavior. No real ComfyUI package was installed and no live model render was attempted. This work verifies graph selection, conversion, persistence and failures in service tests, and availability/UI behavior in Electron with explicit fake own servers. It does not establish the visual quality of a real ppm render. Managed availability intentionally keeps its existing folder/module semantics, as requested. Source and external-address changes both refresh availability, covering the same-source address change as well as the explicitly named source switch.
