# Photo Feature’s desktop side: inventory and draft hook proposal

Research against [`upstream/main` at `39ac6144`](https://github.com/venus-extracurriculars/build/commit/39ac61440bec7841e6cf8b276e3292c23130a4e5), compared with `upstream/core` at `b3ba4dbf`. Reviewed the repository guides and PRs [#146](https://github.com/venus-extracurriculars/build/pull/146), [#190](https://github.com/venus-extracurriculars/build/pull/190), [#194](https://github.com/venus-extracurriculars/build/pull/194), and [#206](https://github.com/venus-extracurriculars/build/pull/206).

All file references below are repository-relative at that main snapshot. The research phase made no code changes and created no commits, branches, pushes, issues, or PRs; this report was subsequently saved on the owner's instruction.

## Part 1 — Inventory

### A. Photo’s window-to-main channels

Photo Feature adds **seven invoke channels**. The comments in `photoIpc.ts`, `photoTypes.ts`, and `ipc.ts` still call them “three.”

They are exposed as `window.api.photo.*`, although their IPC names begin with `comfy:`. Their public declarations are in `src/shared/photoTypes.ts:80`, through augmentation of `VenusUniversityApi`; they are not written into `api.d.ts`.

Every invocation returns `Promise<Result<T>>`. Main’s common wrapper catches errors, normalizes and redacts them, and returns `{ ok: false, error }` (`src/main/ipc.ts:249`). None of these methods streams its result.

In the table, `pid`, `charId`, `file`, `kind`, `tier`, and `prompt` are strings; `character` and `friend` are `Character`.

| IPC channel; registration | Arguments → successful result | What it does | Every direct window caller | Web counterpart |
|---|---|---|---|---|
| `comfy:reservePhotoName` — `src/main/photoIpc.ts:58` | `(pid, character, kind, inSave: readonly string[]) → string` | Reserves a filename before the pending picture is saved on its message or post. | `src/renderer/stores/photoPost.ts:53`; `src/renderer/stores/photoTurn.ts:55` | `photo.reserveName`: `DESKTOP_ONLY`, `src/web/photoBridge.ts:23`. |
| `comfy:carryPhotos` — `src/main/photoIpc.ts:65` | `(fromPid, toPid, charIds?: string[]) → void` | Copies local photos between existing playthroughs, keeping existing destination files. | `src/renderer/modEntries/photo-feature.ts:193` | `photo.carry`: successful no-op, `src/web/photoBridge.ts:28`. |
| `comfy:photoLanded` — `src/main/photoIpc.ts:72` | `(pid, charId, file) → boolean` | Finds a finished picture after a save or window missed its completion; accepts the PNG/WebP twin. | `src/renderer/stores/photoPost.ts:209`; `src/renderer/stores/photoRecovery.ts:26`, `:52` | `photo.landed`: `DESKTOP_ONLY`, `src/web/photoBridge.ts:24`. |
| `comfy:readPhoto` — `src/main/photoIpc.ts:77` | `(pid, charId, file) → Uint8Array` | Reads the picture back for browser-side WebP encoding. | `src/renderer/stores/photoWebp.ts:34` | `photo.read`: `DESKTOP_ONLY`, `src/web/photoBridge.ts:25`. |
| `comfy:storeWebpPhoto` — `src/main/photoIpc.ts:83` | `(pid, charId, file, bytes: Uint8Array) → void` | Atomically stores a validated WebP and removes its PNG twin. | `src/renderer/stores/photoWebp.ts:45` | `photo.storeWebp`: `DESKTOP_ONLY`, `src/web/photoBridge.ts:26`. |
| `comfy:generatePhoto` — `src/main/photoIpc.ts:90` | `(pid, character, tier, prompt, file) → string` | Queues one local render and resolves with its reserved filename when it finishes. | `src/renderer/stores/photoWebp.ts:27` | `photo.generate`: `DESKTOP_ONLY`, `src/web/photoBridge.ts:29`. |
| `comfy:generateDuoPhoto` — `src/main/photoIpc.ts:106` | `(pid, character, friend, tier, prompt, file) → string` | Queues a two-character render into the sender’s photo folder. | `src/renderer/stores/photoWebp.ts:26` | `photo.generateDuo`: `DESKTOP_ONLY`, `src/web/photoBridge.ts:30`. |

The preload mapping is `src/preload/photoApi.ts:18–58`; the result declarations are `src/shared/photoTypes.ts:88–137`. Main deliberately accepts `inSave` as `unknown` and filters it (`src/main/services/localPhotoService.ts:89–103`).

#### Progress, completion, and image delivery

| Transport | Payload or result | Producer and consumer |
|---|---|---|
| Existing `jobs:progress` event | `JobProgress`: `{ jobId, group, key?, status, step?, error? }`, `src/shared/types.ts:2804` | Both generation handlers use `queuePhoto`, which passes queue reports through to ComfyUI (`src/main/photoIpc.ts:30`). The common sink broadcasts redacted progress (`src/main/ipc.ts:356`); `src/renderer/stores/jobStore.ts:29` subscribes. Photo’s own files do not subscribe directly. |
| Generation invoke completion | `Result<string>` | Completion is the resolution of `photo.generate` or `generateDuo`, not a separate “photo finished” event. `renderPhoto` awaits it before optional encoding (`src/renderer/stores/photoWebp.ts:24`). |
| `playimg://photos/<pid>/<charId>/<file>` | Image response; missing/refused image becomes HTTP 404 | `src/shared/photoFiles.ts:107` constructs URLs. `src/main/photoProtocol.ts:49` validates the three path components and serves the image, preferring its WebP twin. This is a protocol request, not IPC. |

#### Existing backup channels with Photo additions

Photo also extends two native channels. It does not own their names or ordinary backup behavior.

| Channel | Arguments → successful result | Photo addition and caller | Web counterpart |
|---|---|---|---|
| `backup:export` — `src/main/ipc.ts:1022` | `() → string \| null` | After the native backup succeeds, calls `exportLocalPhotos(filePath)` at `:1031`, producing a companion `.photos.zip`. Window caller: `src/renderer/stores/settingsStore.ts:113`. | Native browser backup export, `src/web/bridge.ts:586`; no local-photo sidecar. |
| `backup:import` — `src/main/ipc.ts:1035` | `() → boolean` | After the native restore succeeds, calls `importLocalPhotos(filePaths[0])` at `:1044`. Window caller: `src/renderer/stores/settingsStore.ts:122`. | Native browser backup import, `src/web/bridge.ts:586`; no local-photo sidecar. |

**The native `photos:*` API stays.** `photos:options`, `generate`, `list`, `read`, `write`, `writeThumb`, `delete`, and `export` already exist on core. Their handlers are `src/main/ipc.ts:681–726`, declarations `src/preload/api.d.ts:513–548`, preload `src/preload/index.ts:222`, and browser implementation `src/web/bridge.ts:486`. Their window callers are in the native `src/renderer/stores/photoStore.ts` (`:362`, `:400`, `:452`, `:635`, `:660`, `:670`, `:699`, `:718`, `:727`), which is outside Photo Feature’s `MOD_FILES` set.

Removing those channels would remove the game’s own cloud-photo feature.

### B. Main and preload imports from the game

There are **26 allowlist rows** across the six desktop/preload files.

“Re-export” below means the game’s existing definition, through the appropriate bridge and entry. Pure shared definitions belong in `@vx/modkit/shared`, even when their consumer runs in main. Types receive no `KIT_APIS` entry.

| Allowlist row and import location | Imported names and use | Disposition |
|---|---|---|
| `bodySetting.ts → @shared/types`, `src/main/bodySetting.ts:3` | `Character`: input/output of body-setting projection. | **Already covered:** type-only import from kit/shared. |
| `localPhotoBackup.ts → ./paths`, `src/main/localPhotoBackup.ts:8` | `getSavesPath`: enumerate playthroughs; `getPlaythroughPath`: find their photos and check restored playthrough existence. | **Replace:** existing backup context supplies `playthroughIds`; use `modDataPath` for new storage. Legacy files require the transition discussed below. Do not export the general save roots. |
| `localPhotoBackup.ts → ./services/archiveService`, `src/main/localPhotoBackup.ts:10` | `scratchDir`, `discard`: temporary extraction/staging; `relPathsUnder`: enumerate extracted files; `copyInto`: stage/restore pictures; `createZip`: sidecar export; `extractZip`: guarded sidecar import. | **Mostly already covered by backup parts:** core owns export ZIP creation and ordinary extraction. Legacy sidecars still need guarded extraction, either a narrowed host adapter or a reviewed bundled implementation. Raw arbitrary-path archive functions are not the proposed API. |
| `localPhotoBackup.ts → ./services/imageFiles`, `src/main/localPhotoBackup.ts:18` | `sniffImageFile`: admit only image bytes to/from the archive. | **Photo-owned file read plus shared sniffer**, or a scoped host file helper if one is standardized. |
| `localPhotoBackup.ts → @shared/backup`, `src/main/localPhotoBackup.ts:4` | `BACKUP_ZIP_LIMITS`: sidecar extraction limits. | **Plain shared re-export is possible.** Unnecessary if a host sidecar adapter owns the limits. |
| `localPhotoBackup.ts → @shared/characterRules`, `src/main/localPhotoBackup.ts:5` | `SAFE_CHAR_ID`: filter character directory names and restore entries. | **Plain shared re-export.** |
| `localPhotoBackup.ts → @shared/saveRules`, `src/main/localPhotoBackup.ts:7` | `SAFE_NUMERIC_ID`: filter playthrough directory names and restore entries. | **Plain shared re-export.** |
| `photoIpc.ts → ./services/comfyService`, `src/main/photoIpc.ts:4` | `start as startComfy`: start or adopt ComfyUI when a queued photo begins. | **New narrowed render service**, which handles startup internally. |
| `photoIpc.ts → @shared/jobQueue`, `src/main/photoIpc.ts:2` | `enqueue`: serialize renders, supply cancellation and progress. | **New narrowed render service.** Do not expose the global queue or unrestricted group cancellation. |
| `photoIpc.ts → @shared/types`, `src/main/photoIpc.ts:3` | `Character`: handler and queue types. | **Already covered:** kit/shared type. |
| `photoProtocol.ts → ./paths`, `src/main/photoProtocol.ts:7` | `getPlaythroughPath`: construct the local-photo root. | **Existing `modDataPath`**, after migration. |
| `photoProtocol.ts → ./services/imageFiles`, `src/main/photoProtocol.ts:8` | `imagePath`: choose WebP or PNG for a URL response. | **Photo-owned helper** confined to its files; technically re-exportable, but its unrestricted path signature is broader than needed. |
| `photoProtocol.ts → @shared/characterRules`, `src/main/photoProtocol.ts:4` | `SAFE_CHAR_ID`: validate URL character component. | **Plain shared re-export.** |
| `photoProtocol.ts → @shared/saveRules`, `src/main/photoProtocol.ts:6` | `SAFE_NUMERIC_ID`: validate URL playthrough component. | **Plain shared re-export.** |
| `localPhotoService.ts → ./characterService`, `src/main/services/localPhotoService.ts:25` | `assertSafeCharId`: reject unsafe character identifiers. | **Plain shared re-export from its actual definition**, `src/shared/characterRules.ts:137`. The main service merely re-exports it. |
| `localPhotoService.ts → ./comfyService`, `src/main/services/localPhotoService.ts:24` | `runGenerationJob`: graph/model preparation, submission, polling, cancellation, fetching and saving. | **New narrowed wrapper.** Its native signature is unsuitable for direct handover; see Part 2. |
| `localPhotoService.ts → ./imageFiles`, `src/main/services/localPhotoService.ts:26` | `findImage`: recovery/read lookup; `dropImageTwins`: remove the superseded PNG/WebP. | **Photo-owned scoped file operations**, or a future scoped image-file wrapper. |
| `localPhotoService.ts → ./jsonFile`, `src/main/services/localPhotoService.ts:27` | `writeAtomicBytes`: keep encoded WebP whole before removing PNG. | **Photo-owned atomic file writer**, preserving temporary-file cleanup and Windows rename handling; alternatively a scoped wrapper, not an arbitrary-path writer. |
| `localPhotoService.ts → ./saveService`, `src/main/services/localPhotoService.ts:28` | `assertSafePlaythroughId`: validate storage identifiers. | **Plain shared re-export from `src/shared/saveRules.ts:269`.** No save service is needed. |
| `localPhotoService.ts → @shared/characterRules`, `src/main/services/localPhotoService.ts:4` | `SAFE_CHAR_ID`: select valid source folders during carry. | **Plain shared re-export.** |
| `localPhotoService.ts → @shared/comfyModels`, `src/main/services/localPhotoService.ts:5` | `characterLoraOf`: read and normalize the character’s own LoRA name/weight. | **Plain shared re-export:** pure reader, `src/shared/comfyModels.ts:332`. |
| `localPhotoService.ts → @shared/errors`, `src/main/services/localPhotoService.ts:6` | `appError`: construct typed service failures. | **Plain shared re-export.** #206 exports `messageOf`, not this constructor. |
| `localPhotoService.ts → @shared/imageBytes`, `src/main/services/localPhotoService.ts:7` | `imageTypeOf`: reject submitted bytes that are not WebP. | **Plain shared re-export.** It recognizes signatures; it is not a full image decoder. |
| `localPhotoService.ts → @shared/types`, `src/main/services/localPhotoService.ts:21` | `Character`: render request types. | **Already covered:** kit/shared type. |
| `photoApi.ts → @shared/types`, `src/preload/photoApi.ts:2` | `Character`: preload argument types. | **Remove the mod’s preload file** when calls use kit invoke. Merely changing this import does not solve the boundary: preload code itself remains outside the mod contract. |
| `photoApi.ts → electron`, `src/preload/photoApi.ts:1` | `ipcRenderer`: invoke Photo’s seven channels. | **Remove with the preload file.** The common invoke bridge belongs to core. |

Additional allowed dependencies matter even though they are not allowlist rows:

- Photo already imports Node `fs`, `path`, and `url`; a standalone main bundle may continue using allowed Node built-ins for its own storage.
- `src/main/photoProtocol.ts:1` imports Electron `net` and `protocol`. Replace the custom scheme with the loader’s existing `protocols` export.
- Photo’s prompt builders, tiers, naming, body projection, workflow JSON and node maps are its own code/assets. They should travel with the mod.
- `withBodySetting` is Photo-owned. It does not need to become a kit API.

### C. Photo-specific code in core-owned files

| Location | Photo-specific integration | What can happen after migration |
|---|---|---|
| `src/main/ipc.ts:191`, `:309–310` | Imports and calls `registerPhotoIpc`. | Delete after seven handlers are registered by Photo’s `main.js`. |
| `src/main/ipc.ts:135`, `:1031`, `:1044` | Imports and runs companion-photo backup export/import. | Delete after backup-part and legacy-sidecar migration. Keep the native backup channels. |
| `src/preload/index.ts:3`, `:36` | Imports and spreads `photoApi`. | Delete. Core gains only the generic invoke bridge. |
| `src/shared/photoTypes.ts:80–140` | Augments core’s preload API with `photo`. | Remove this API augmentation when Photo owns its invoke types. The message/post data migration is a separate renderer concern. |
| `src/web/bridge.ts:60`, `:188` | Imports and spreads `photoBridge`. | Delete after generic invoke supplies the desktop-only result. |
| `src/main/index.ts:6`, `:228` | Imports and installs Photo’s protocol. | Delete after Photo exports a `vxmod://` route. |
| `src/main/imageProtocols.ts:8`, `:33–35` | Imports and privileges `PHOTO_SCHEME`. | Delete; `vxmod` is already privileged. |
| `src/renderer/index.html:21` | Allows `playimg:` in `img-src`. | Remove once Photo generates `vxmod://` image URLs. Keep `vxmod:`. |
| `src/main/services/modsService.ts:6–7`, `:13`, `:65–69`, `:82`, `:86–98` | Photo-specific option projection and migration from old settings. | Replace live projection with a generic main option reader; move legacy migration under an agreed transition contract. |
| `src/shared/mods.ts:1–2`, `:73`, `:327–376` | Photo imports, ID constant, switch projection, and legacy settings migration. | Move Photo-specific definitions/conversion to Photo once the generic option and transition paths exist. |
| `src/main/services/comfyService.ts:1197–1208` | Comments describe the Photo-specific reason for exporting the pipeline. | Replace with the new generic service contract. Keep the shared pipeline: Echo also uses it. |

Important exclusions:

- Core’s `photos:*` API, photo paths in `src/main/paths.ts:332–349`, and native photo backup handling in `src/main/services/backupService.ts:359` and `:543` are **native functionality**.
- No Photo-specific addition was found in `saveService.ts`. Photo’s import from it is an identifier validator.
- No Photo-specific ComfyUI launch-environment provider was found. `registerComfyLaunchEnvironment` already exists for trusted main-side setup and is not required by these Photo workflows.
- Photo’s body changes to native sprite/CG prompt drafts already use the shared registration mechanism (`src/shared/modEntries/photo-feature.ts:11`); this does not justify exporting the character-writing service.

### D. Lifecycle, state, and cancellation

| Stage | Current behavior |
|---|---|
| Application startup | Core installs Photo’s protocol after `app.whenReady()` and registers its IPC handlers at `src/main/index.ts:263`. It does not start ComfyUI for Photo at boot. Main’s Photo switches are refreshed when mod switches are read/written (`modsService.ts:65–82`). |
| Reservation | Main combines existing filenames, its reservation map, and names supplied from the save. It returns a name without writing an image (`localPhotoService.ts:66–116`). |
| Render | `queuePhoto` uses the game’s serial queue, grouped by `character.charId`, with `photo:<tier>` or `photo-duo:<tier>` as the key. It starts ComfyUI, then invokes the shared pipeline. Photo supplies its own graph, prompts, seed, destination, and optional character LoRA. |
| Disk completion | The pipeline writes PNG bytes. The renderer optionally reads them, encodes WebP, and sends the encoded bytes back. Failure to encode preserves PNG (`photoWebp.ts:24–48`). |
| Save updates | Pending/finished/failed photo state is written by the renderer. `savePhotoState` calls the loop’s autosave path, avoiding half-streamed scenes (`localPhotoStore.ts:95–111`). Main does not write the game save for this feature. |
| Reload/recovery | The renderer asks `landed` for saved pending pictures, updates the corresponding message/post, and saves the settled state (`photoRecovery.ts:19–74`). |
| Carry | Photo registers `registerTermFiles` and calls `photo.carry`, including while switched off (`modEntries/photo-feature.ts:189–194`). This is an adapter for callers that create another playthrough; the kit’s file-carrier registry is not evidence that every native semester transition calls it. |
| Backup | Export writes a best-effort companion `.photos.zip`. Import restores the native backup first, then attempts the companion; failures warn rather than undoing the native restore (`localPhotoBackup.ts:56–115`). |

Main retains:

- `reservedPhotoNames`, a folder-to-set map (`localPhotoService.ts:66`). Successful renders remove their reservation at `:272` or `:331`; there is no explicit failure/cancellation cleanup there.
- A process-local Photo switch snapshot and listeners (`src/shared/photoSwitches.ts:46`).
- Queue jobs/controllers owned by the shared queue, plus ComfyUI state owned by the native service.

The renderer separately retains in-flight drawing sets and three-minute patience timers (`photoTurn.ts:86`, `:126`; `photoPost.ts:110`, `:217–250`). **Patience expiring does not cancel the render.** A late image can still fill its frame.

Cancellation is currently the queue’s cancellation of the character group. `cancelGroup` drops queued jobs, aborts matching running work, and waits for it to settle (`src/shared/jobQueue.ts:162–193`). ComfyUI cancellation interrupts the submitted prompt (`comfyService.ts:844–847`).

Leaving a game cancels the loop’s LLM groups, not these character-group photo renders (`gameLoop.ts:3350`). Photo’s renderer checks whether the playthrough is still current before applying a result; the main-side render can nevertheless finish and leave its file on disk.

## Part 2 — Draft proposal for morrowkiln and the owner

Photo Feature’s desktop side currently adds seven channels, a preload member, a scheme, backup calls, and Photo-specific option wiring to core. I would move that code into Photo’s own `main.js`, using the loader’s existing routes, mod-data paths and backup parts.

The missing runtime pieces are **a mod invoke channel, a main-side option reader, and a narrowed ComfyUI render service**. Small shared re-exports cover the readers and validators. Existing files and older backups need a transition decision before the migration can be called complete.

### 1. One channel for a mod’s own main calls

Provisional API:

```ts
// @vx/modkit/main
registerInvoke(modId, name, handler)

// @vx/modkit/renderer
invoke<T>(modId, name, args, { signal? }): Promise<Result<T>>
```

These are proposed names and shapes, not existing exports.

Photo registers `reserve-name`, `landed`, `read`, `store-webp`, `carry`, `generate`, and `generate-duo`. Core transports them over **one fixed `mod:invoke` channel**, with call/cancel operations distinguished in its envelope. Photo’s preload file and its seven channel names then go.

The registration belongs to the mod whose `main.js` the loader is requiring. Compare the supplied ID with that loader-owned identity; a valid-looking ID alone is insufficient. Reject duplicate registrations and invalid method names. Stage registrations during loading and discard them if the module throws or is refused.

At dispatch, check the calling app frame, the loaded/permitted main module, declared capability, and registered method. Pass the handler arguments and a cancellation context, never `IpcMainInvokeEvent`, `WebContents`, or a window.

A handler may throw internally. The boundary catches it and returns the game’s redacted `AppError` in a `Result`; transport failures must become a `Result` too. Types do not replace validation: Photo checks its method’s actual arguments before touching files or queuing work.

Use #194’s result-envelope pattern, but construct cancellation namespaces **in main**. Its current model-call path checks ID syntax (`shared/llm/modCall.ts:22`); the renderer constructs its group prefix. That is not sufficient authority for a general desktop dispatcher.

A switched-off mod still needs to keep and carry its data. Dispatch should distinguish a **loaded** mod from an **enabled** one. Photo’s generation handlers enforce its live switches; carry and maintenance must remain possible when it is off.

#### Cancellation and events

An invoke gets a request ID scoped to its owner and originating window session. Aborting its renderer signal cancels that request through the same fixed channel. Main owns the controller and passes its signal through to queued ComfyUI work.

Cancellation must drop a queued job, interrupt a running prompt, clean temporary output, and resolve the invocation as `CANCELLED`. A late completion must not replace that answer. Cancellation does not promise to undo an already committed file or save.

Photo does **not** need a separate finished-render event: the existing code awaits the render result. Its own loading animation also does not consume step-progress events. Keep native queue reporting inside the render service; defer a public generic event API unless an actual UI needs it. If progress is later exposed, use one fixed channel, filtered by owner/request/session, with unsubscribe and reload cleanup.

### 2. Hand over a render, not the whole ComfyUI service

A direct `main:runGenerationJob` re-export is insufficient.

Its specification accepts arbitrary destination paths and a `workflowFile` loaded from core’s `assets/workflows` (`comfyService.ts:1125`, `:1230`). A standalone mod needs its own workflows. Its target and multi-output options are also broader than Photo needs.

Propose a main-side image-render wrapper, provisionally `main:renderComfyImage`, which:

- Accepts a workflow from the mod’s own installed assets, its node map, prompts, extra text nodes, seed, and optional character LoRA.
- Uses the player’s configured server and model picks. Resolves one target for startup and execution.
- Runs through core’s serial queue, startup, model checks, timeout, prompt cancellation, image validation, and managed-output cleanup.
- Returns image bytes to Photo’s main handler. Photo writes them into its own data folder.
- Exposes no arbitrary output path, server URL override, managed installation root, or global cancellation group.

Photo keeps its two workflow graphs and node maps. Solo photos need the character-LoRA slot; duo photos need the additional left/right text nodes (`localPhotoService.ts:253–268`, `:316–328`).

A byte-returning wrapper can use private scratch storage internally. That is a core implementation detail. Preserve the game’s existing transport and cancellation guarantees rather than building a second ComfyUI client.

`registerComfyLaunchEnvironment` is already available, but Photo has no demonstrated need for it here.

### 3. Readers, files, saving, and backups

| Need | Proposed treatment |
|---|---|
| Character/result types | Already in kit/shared; type-only imports. |
| Safe IDs and their assertions | Re-export the shared definitions, not the main character/save services. |
| `appError`, `imageTypeOf`, `characterLoraOf` | Plain shared re-exports. `BACKUP_ZIP_LIMITS` only if a mod-facing legacy archive reader needs it. |
| Live `body` and `webp` options in main | New narrow reader, provisionally `main:modOptionOn(modId, optionId)`, backed by main’s known switches and manifest defaults. Bind ownership. `sharedModOn` already covers the on/off question; `optionOn` alone needs a switch snapshot the mod does not have. |
| Photo paths | Existing `modDataPath('photo-feature', pid)`. No `getSavesPath`, `getPlaythroughPath`, or general data-root export. |
| Image lookup/twins and atomic writes | Photo-owned operations under that root. Preserve PNG fallback, unique temporary files, cleanup, and Windows rename behavior. If core standardizes a helper later, make it scoped rather than accepting arbitrary paths. |
| URLs | Existing `module.exports.protocols`, serving `vxmod://photo-feature/@/photos/<pid>/<charId>/<file>`. Validate identifiers and real paths before reading; return image bytes with the proper content type. No Electron scheme API is needed. |
| Game-save persistence | Remains with the renderer’s save/record hooks and its pending-picture bookkeeping. Do not export main’s save writer to solve a renderer transaction. |
| New backups | Existing `requiredBackupPart`, if the owner wants a photo export failure to prevent an incomplete backup. Ordinary `backupPart` remains an explicit best-effort alternative. |
| Character transfers | `characterTransferPart` is already available if Photo moves character-owned body data outside the native character record. Playthrough photos themselves are not character-export assets. |

#### Existing files and older backups

There are two distinct compatibility jobs:

1. **Live files:** Photo currently writes under `saves/<pid>/photos/<charId>/`. Native cloud photos use the same `photos/` parent. The manifest explicitly reserves that name (`packages/modkit/src/shared/manifest.ts:98–108`, `:294–295`). `dataPath: { playthrough: "photos" }` is therefore neither accepted nor an appropriate ownership claim.
2. **Older backups:** Photo’s files are in a companion `.photos.zip`, not the native backup. `BackupPartLegacy.archive` already supplies the selected backup’s path (`modParts.ts:39`), but the kit does not expose guarded sidecar extraction.

Move new files into Photo’s mod-data folder. Agree on a narrowly approved legacy reader/import path for the old per-character directories, retaining filenames and PNG/WebP fallback. Copy and verify before retiring old data; do not give Photo ownership of native cloud-photo files.

For sidecars, prefer a backup-context helper that opens a declared companion suffix, applies core’s ZIP listing/size/link checks, and supplies staged entries during `prepare`. It must not accept arbitrary source or extraction paths. Photo validates its own three-component names and image bytes, then restores into its mod-data folder during `commit`.

A bundled Photo-owned reader is an alternative under the existing trusted-main policy, but it must retain those archive protections. `legacy.archive` by itself is not a safe extractor.

Required backup export and two-phase restore are already designed. Required export does **not** make restore commits atomic. Moving from today’s warning-only companion behavior to a restore-stopping validation failure needs the owner’s agreement.

Legacy Photo settings also need an agreed migration before removing `withPhotoSettingsCarried` and `settingsToCarry`. The new live option reader does not recover those old settings by itself.

### 4. Security boundary

The new hooks should not hand a caller another mod’s handlers or data, arbitrary filesystem paths, core settings/credentials, Electron’s window, or the global queue.

Enforce owner-bound registration and dispatch in core; namespace cancellation there; validate incoming payloads; confine file operations and URL serving to the mod’s root, including symlinks; keep dialogs, windows, transport credentials and ComfyUI roots inside core. Capability declarations describe what the mod requires, not proof of who sent an invocation.

There is an existing limitation to state plainly: **the current loader is not a sandbox for untrusted main code.** `src/main/mods/require.ts:117` permits Node built-ins and Electron. Such code can access files or windows directly regardless of a narrowed kit API. `modDataPath` validates an ID and resolves its folder; it is not currently an owner-authenticated filesystem boundary either.

These proposals avoid adding broad authority through the hooks. Strong isolation from malicious main code would require a different execution boundary, beyond this Photo proposal. The current reviewed-main policy must remain explicit.

### 5. Web behavior

`invoke` should return `Result` with `DESKTOP_ONLY` when a method requires a desktop main module. It should not simulate running `main.js` or expose a network relay.

For Photo:

- Local generation, reservation, reads, recovery queries, and writes remain unavailable.
- Photo keeps its carry operation a successful no-op on web, as it is today.
- The renderer keeps local generation disabled when ComfyUI is unavailable.
- Shared body/comment behavior is a separate concern and need not be disabled merely because local rendering is unavailable.
- Native cloud `photos:*` functionality stays available through its existing browser implementation.

The message should say that **local ComfyUI photos** require desktop; the current browser can draw native cloud pictures.

### 6. Suggested PR order

Rows clear only after Photo’s own import/migration change; adding a kit API alone does not clear the scoreboard.

| Proposed work | Scope and rows it enables |
|---|---|
| `hooks/photo-shared-readers` | Small native re-exports for validators, error construction, image signature and LoRA reader. Clears their shared imports and the character/save-service validator imports. Move the three main-side `Character` imports to the already available type at the same time in Photo’s own change. |
| `hooks/main-mod-options` | One owner-bound live option reader. Enables removal of Photo-specific option projection from core; there is no direct allowlist row for that wiring. |
| `hooks/mod-invoke` | Registration, one fixed transport, owner checks, result/error envelope, cancellation and loader-failure cleanup. Enables deletion of Photo’s preload file and its two rows. |
| `hooks/mod-comfy-images` | One queued render wrapper with mod-owned workflows and byte results. Replaces `photoIpc → comfyService`, `photoIpc → jobQueue`, and `localPhotoService → comfyService`. |
| Legacy file/backup proposal, then Photo’s migration | Agree the old-file reader and guarded sidecar access separately from the general invoke mechanism. Reuse routes, `modDataPath` and backup parts; move file helpers into Photo. This addresses the remaining path/archive/image-file/atomic-write rows and permits removing Photo’s direct backup calls. |

Each core PR should include the bridge/entry/capability changes, contract coverage, API reports and docs appropriate to that API. Rehearse the Photo switch separately, preserving pending-picture recovery, cancellation, off-state data, legacy PNGs, both workflows, and backup failure behavior.

### 7. Questions before implementation

1. Does “untrusted main mod” mean the existing reviewed-main policy, or actual isolation from Node/Electron? The current loader supports the former.
2. Would morrowkiln prefer `registerInvoke`, or handlers exported from `main.js` beside `protocols`? Both can give the loader ownership; the latter needs fewer partial-registration cleanup rules.
3. Is the proposed main option reader the desired common pattern, or is an existing main-settings proposal intended to cover it?
4. Should the ComfyUI hook return bytes, or a scoped image handle? Photo needs one output; other consumers may justify more later.
5. What approved mechanism should read Photo’s existing subdirectories under core’s reserved `photos/` folder and migrate its older settings?
6. Should a failed Photo backup export block the native backup, and should a malformed legacy sidecar stop restore before native data is replaced?
7. Should switching Photo off cancel in-flight renders immediately, or preserve today’s late-completion behavior? The invoke contract should make that an explicit choice.
