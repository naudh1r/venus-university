# @vx/modkit

## Unreleased

- `scene()`, `useScene(select)` and `subscribeScene` read the scene on screen, in a playthrough,
  a created scene or a replay, as a frozen `SceneView` the kit defines: who is in it, its lines with speakers by id, where it is, what the
  slot is, and the game's own answers on the turn. `holdTurn(id)` holds the reader's turn while
  a mod settles something, and its release gives the turn back once.

- Renderer exports native `spriteUrl` for character sprites, including cache versions and
  staging, through the game's desktop/web image resolver.

- Renderer readers expose whether image API credentials are configured and the selected local
  image source, with component hooks and subscriptions for each. No keys, URLs or settings
  objects are exposed; configuration and connectivity remain distinct.

- Read-only game records, clock, stats, pictures and the legacy feed-read marker
  (`since: '0.8.0'`) have detached frozen snapshots, component hooks and narrow subscriptions.
  `profileImageUrl` and its hook and subscription follow her image version; `sceneActive` follows core's scene predicate;
  `readerPromptText` returns core's READER block. No stores, actions or save writers are exposed.

- Optional `ModDef.hooks` lists hook and kit API declarations for built-in main entries, with the
  same name, shape and meaning as a manifest's `hooks`.

- Narrow renderer readers cover image rules, local rendering availability and the phone's view,
  with subscriptions and component hooks where needed. `modOptionOn` is the non-hook option
  reader. Feed handles and emoji can be drawn independently from the game's persistent bags.

- Renderer re-exports the native `Lightbox`, `relationshipLines`, `profileLines`, `memoryLines`
  and `spaced`, with relationship input types. Image-prompt draft registration remains shared;
  its boot guidance now covers the shared-catalog import cycle and both processes.

- Main's `modIsOn` reads a mod's current enabled state from disk and honors session
  load failures and safe start. The same read refreshes `modOptionOn`'s snapshot.
  It has its own `main:modIsOn` capability; no raw switches service is exposed.

- `lead` on a `dm` prompt addition puts its fields ahead of the reply's own, and `dmReplyLead`
  hands them over the moment they have streamed in, before her first text lands. Once per reply,
  never for an abandoned one. Its signal aborts when the reply does not land; the finished
  reply, and `afterDmReply`, stay authoritative.

- Main’s `renderComfyImage` queues a mod-owned ComfyUI graph and returns checked image bytes, capped at 32 MiB, with per-call cancellation and an optional `onProgress` for its steps.

- `sceneField` takes `legacy`, the key a mod kept its scene data under before it had a field, read
  and then moved to its id; and `normalize`, for a value a load brings back. Its handle gains
  `save(next)`: the value written into the save a reload lands on, the reader's last turn, without
  waiting for a safe point, every other mod's value there left as it was. Refused, changing nothing,
  with `MOD_WRITE_NO_GAME`, `MOD_WRITE_OFF` or the new `MOD_WRITE_NO_SCENE`.

- The scene's lines, for a mod that speaks in the scene outside its replies: `sayInScene` puts
  narration or a girl's line, in her face and outfit, on the transcript and the box;
  `boxParts` is the box's split alone; `readerSaysInScene` files the reader's words with nobody
  asked to answer; `reachTurn` brings the scene to his turn. A `transient` line is taken back by
  its mod's `dropTransientLines` and left out of every save, replay and saved scene.

- A record field writes a live record: `set(ref, next)` and `update(ref, change)` put the mod's
  slice on one of her texts, posts or comments (`RecordRef`), the record's own fields and every
  other mod's slice kept. `PostComment` gains `ex`. `addPostComments` adds comments under a post
  for the mod that draws them; `addMemory` adds a memory of hers marked as the mod's, `replacing`
  only memories it marked; `toggleFeedLike` is the reader's like. `saveChanges` writes the game
  now, at the scene's last decision point, or answers `deferred` while a line plays and the
  loop's next save carries it. New refusals: `MOD_WRITE_GONE`, `MOD_WRITE_NOT_OWNER`,
  `MOD_WRITE_INVALID`.

- A filed post that `postVisible` keeps off the feed gets no BunnyBot first-post nudge; the mod
  that shows it nudges.

## 0.7.0

- Startup readers have a ten-second wait limit per mod. A timeout names the mod in a warning
  and lets startup continue. It does not cancel the reader; mods must still handle their own
  asynchronous work. Later switch-on notifications use the same limit.

What a mod built outside the repo needs to rewrite the game's prompts and reshape its scene calls,
and the readers, components and record helpers its screens and main code use.

- The game's prompt text is core's: the text blocks' ids and shipped text, read by every builder
  through `blockText`. `promptText` lets one mod at a time rewrite them and the class call's pool
  sizes. With no mod answering, every request is byte-identical to before.
- Scene builders hand back `parts` and `sceneSpot` beside their strings; neither, nor a mod's tag,
  ever reaches the provider.
- `sceneCall` tags a scene call in the window; `registerFinalRequest` in `main` reshapes the tagged
  call at the one place structured calls go out, with sampler values for that call alone on a
  custom endpoint, and reads its reply back. One mod per call, the first by id; a failure sends
  the call as built.
- `sceneReplyLanded` is told of every scene call's reply, the closing's included, and `sceneCut` of
  a cut in the transcript. `sceneField` keeps a mod's value on the scene being played.
- `advancedSettingsEntry`: a place on the Advanced tab of app settings, beside its own buttons.
- `switchedOn`: a mod is told as it comes on, at boot before the first screen (waited for) and
  whenever its switch or the game's record turns it on later, so it can read what it keeps.
- Re-exported: `CheckField`, `ConfirmModal`, `TextEditModal`, `ChevronIcon`, `PlusIcon`,
  `PROMPT_BLOCKS`, `defaultBlockText` and `isNewGameBlock` in `renderer`, with the new readers
  `gameFacts`, `useGameFacts`, `useScenePersona` and `showError`; the text-block ids, `blockText`,
  `PROMPT_PARTS`, the class pool sizes, `validateRecord` and `assertSafeId` in `shared`;
  `readJsonFile`, `writeAtomicJson` and `writeAtomicBytes` in `main`. Each value is its own
  capability. Nothing native changes.

- A game started before mods recorded their versions is told so once, not once every session:
  the playthroughs told are kept in `settings.json`'s `modUnversionedSeen`, written by main. The
  record still holds no versions.

- `invoke` from `renderer` calls a trusted main.js's declared `invoke` handlers. Main owns the
  request ids, namespaces and cancellation channel; aborts beat late results, errors use the
  ordinary redacted Result wrapper, and web answers DESKTOP_ONLY. Loaded handlers run whether
  or not their switch is on, with `{ id, signal }`; the loader owns their lifetime.

- Main's `extractZip` and `sniffImageFile`, re-exported from the game's own services, and
  `modOptionOn`, reading an option against main's live switches independently of the mod's
  on/off switch. Each is its own capability.

- The game's motion presets in `renderer`: `gestures`, `lift`, `press`, `quietLift`, `quietPress`,
  `rowLift`, `rowPress`, `toggleLift`, `veilIn` and `panelUnderTab`, each its own
  `renderer:<name>` capability. They are the game's own objects, re-exported, so a mod's controls
  and panels move as the native ones do and follow them when they change. The rest of the game's
  motion file stays core's. Nothing native changes.
- The game's panel controls in `renderer`: `TitleTab`, `TextField`, `SelectField`, and the scene's
  own `TurnField` and `SceneDivider`, each its own `renderer:<name>` capability, with their props
  types. They are the game's components, re-exported. `SceneDivider` is now exported by core and
  takes an optional `className`; nothing native changes.
- Small readers: `currentRun` and `runStale`, `isOrientationSlot` and `isGraduationSlot`,
  `lessNsfwText` and `useLessNsfwText`, `useSfxGain`, `modsOnLine` and `buildLabel` in
  `renderer`; `READER_SPEAKER` and `charKeyOf` in `shared`. Each is its own capability. The settings and mods
  readers are new in core, the rest the game's own, re-exported.
- `completeStructured(modId, request, { group })` in `renderer`: a mod's own structured model
  call, over one `llm:completeMod` channel every mod shares, sent as the game sends its own and
  answered as a `Result`. `cancelCalls(modId, group)` aborts the mod's calls under a group, over
  its own `llm:cancelMod` channel. The mod's groups are kept apart from the game's and other
  mods' by the main process, which names each from the mod's id. A call it aborts resolves
  `CANCELLED` however far its reply had come. `objectSchema` comes with them. Mods no longer need
  a channel of their own in core, or to borrow another call's.
- `useSceneInput` in `renderer`: a mod's panel over a scene puts its own input in the place of the
  scene's action row. The row is put away and dead, and the dialogue box stands clear of the
  panel's input, until the panel gives it back or unmounts. On the reader's turn the scene's
  Enter, Space and Tab leave the turn to the panel. One holder at a time. Without a holder, the
  scene draws and answers keys as before.
- A throw while the goodbye, the scene or texting bookkeeping, or the next slot's opening builds
  its request, from a `promptState.scene` capture or a `prompts.*` hook, now opens that call's
  retry modal instead of leaving the game waiting. Retry builds the request again; leaving goes
  to the menu, as for a failed call. The modals do not offer the prompt editor for it. This
  covers the slot opening at the start of a slot, and the texting bookkeeping fetched ahead while
  a scene plays, too. Other hooks that run while a scene ends are not covered.

- More of the game's own readers and motion, re-exported: `globalSlotOf`, `messageOf` and
  the `MemoryType` type in `shared`; `fadeIn`, `dealt`, `slideInQuick`, `noteIn`, `bunnyHop`,
  `typingDot` and `retrySilently`, with its `SilentRetryOptions` type, in `renderer`. Each value
  is its own capability. Nothing native changes.

- More native readers in `shared`: ids, image bytes and LoRA picks; dorms, places, outfits and
  relationships; names, slots, hashes, comments and feed draws, archive limits and prompt helpers.
  In `renderer`, the game's date and conversation readers, setting text, feed tables and five
  screen icons. Each value is its own capability; the record types come from `shared` too.

- `bunnybotSays(modId, lines, { once? })` in `renderer`: BunnyBot says a mod's lines after his
  introduction, through his own delivery. An exact message in his saved thread matching `once`
  keeps them from being said again. It answers whether he spoke, declared as `renderer:bunnybotSays`.

## 0.6.0

What the first mods moving onto the kit needed: a backup share that must be complete, a scene
request's own copy of a mod's data, and declarations a mod built outside the repo compiles
against.

- `requiredBackupPart` in `main`: the existing backup-part contract with a required export.
  Export failure stops before creating or replacing the target archive, names the mod and drops
  temporary files. Ordinary `backupPart` still warns and omits a failed share. The new
  `main:requiredBackupPart` capability lets manifests refuse older cores that lack this guarantee.
  Restore behavior is unchanged. This unblocks Custom Soundtracks' backup migration without
  losing its existing protection against replacing a valid backup with one missing its music.
- `promptState.scene`: capture an enabled mod's structured-cloneable value into a scene request's
  `PromptState.ex[modId]`. The copy is made synchronously by the game prompt-state builder;
  prompt formatters can keep using that value if the player edits live mod data while the
  request is being prepared. Values are keyed by owner, never spread over native fields.
  Undefined omits a slice. Duplicate owners or failed captures abort the request naming the mod.
  Declare `promptState.scene` in the manifest; older cores reject the missing hook. DM, ledger
  and slot-intro snapshots are not added by this change. Existing prompt hooks are unchanged.
- A throw while a turn's request is built, a `promptState.scene` capture's or a `prompts.*`
  hook's, fails the turn: it is rewound and the player gets the retry modal, the error in its
  detail, as for a failed call. It used to leave the game busy behind the covered stage. The
  scene's goodbye and bookkeeping builds, which run after the reply has landed, are not covered
  yet.
- `ModPlaythroughFields` and `BunnyboardState` in `shared`. `PlaythroughRecord` extends the
  first, so its `mods` and `modVersions` reach the rolled-up declarations, which dropped them
  when they were a module augmentation. `report` and `report:check` now compile
  `test/consumer.ts` against `dist/`, with no game-source aliases, to catch the next such gap.
- `characterFromDraft` answers are merged as `editorField` writes are: each mod's `ex` slices go
  in beside the ones she has and the other mods', never in place of them.
- `report` resolves the kit's own names to its emitted declarations, so the report no longer
  depends on a `dist/` left by an earlier run and `report:check` passes on a fresh checkout.

## 0.5.0

Mod data. A mod keeps its data in the save, on the records inside it, in memory for a game or a
session, and in folders of its own outside the save; core keeps every save key it does not own
through a load and a save.

- `saveField` and `recordField` in `renderer`, with `SaveFieldSpec`, `SaveFieldHandle`,
  `RecordFieldSpec`, `RecordFieldHandle` and `ModDataRecord`: a mod's slice, `{ v, data }`, under
  its id in the `ex` of a save or a record, read through the mod's own `normalize` on every load
  and carried into the next semester by its `carry`.
- `writeModField`, `writeModFields`, `safePoint` and `useSafePoint` in `renderer`: a write to the
  save at a safe point, refused with a code rather than thrown.
- `modState` in `renderer`, with `ModStateSpec` and `ModStateHandle`: state that is never saved,
  for a game or for the session.
- `modDataPath`, `backupPart` and `characterTransferPart` in `main`, with `BackupPart`,
  `BackupPartContext`, `BackupPartExport`, `BackupPartLegacy`, `BackupPartRestore` and
  `CharacterTransferPart`: a mod's folders outside the save, and its share of a backup and of a
  character's export, import and duplicate.
- New types in `shared`: `ModSlice`; `NativeGameSave`, the save's own fields, which `GameSave` now
  extends; and `Result` and `AppError`, which a write returns.
- The manifest's optional `dataPath`, for a mod that already keeps a folder of its own.
- `modVersions` on the playthrough record: the version of every mod on as a playthrough started.

Existing hooks and APIs keep their shapes; declaration merging into `GameSave` and
`registerTermCarry` work as before.

## 0.4.0

Expose the native stat-rank readers `MAX_TIER` and `pointsForTier`, with the
`StatTier` type, through `@vx/modkit/shared`. Mods can express a maximum-rank
requirement using the game's own threshold rather than copying its point value.
No stat thresholds, gains, floors, decay or romance rules change.

Expose `useModalShell`, `useDismissLayer` and the `ModalShell` type from the renderer entry.
Installed mod panels can share core's modal host and dismissal stack: Escape and right-click
close only the topmost layer, and a field retains its context menu. These are the game's own
functions, not a second stack. Existing APIs and native modal behavior are unchanged.

## 0.3.0

The loader. Installed mods are read from `data/mods/<id>/<version>/` and from the developer
folders, checked against the hook table, and loaded at start: `main.js` in the main process,
`renderer.js` in the window from `vxmod://`, with React, `motion/react` and the kit's entries
reached through the page's import map.

- The manifest, `vxmod.json`: `parseManifest` and `modDefOf` in the host's shared entry, with the
  version-range subset (`range.ts`) `requires`, `optional` and `game` are written in.
- The hook `protocols`, the first main-side row: a `main.js` exports routes under
  `vxmod://<id>/@/<route>/…`.
- `registerHooks` holds an installed mod's registration to its manifest (`setDeclaredHooks`,
  `setLoadingMod` in the host's renderer entry); an in-repo mod registers as before.
- `ModDef.library`: a library mod has no switch and no row on the Mods screen.

Add `conversationFoot`, a screen slot below a person's message history and before the native
composer. It receives the open `charId`; bot and employer threads do not draw it. Existing hooks
and APIs keep their shapes.

## 0.2.0

Adds the hooks `gameModals`, `railButton`, `landingTool` and `gameMenuEntry`, and the API
`openPanel` from `@vx/modkit/renderer`.

- `registerImagePromptDraft` in `shared`, with its types: a mod's tags in her sprite and CG prompt
  drafts, asked in id order while it is on, in the editor and in every render alike.

## 0.1.0

The kit exists. Everything a mod could import from core's mod system, under three entry points
(`shared`, `renderer`, `main`), with the hook table, the per-hook compatibility check and the API
report. No hook or API changed in the move. Nothing is published yet: core resolves the kit from
`packages/modkit/src` by alias.
