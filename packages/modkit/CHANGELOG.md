# @vx/modkit

## Unreleased

- The game's motion presets in `renderer`: `gestures`, `lift`, `press`, `quietLift`, `quietPress`,
  `rowLift`, `rowPress`, `toggleLift`, `veilIn` and `panelUnderTab`, each its own
  `renderer:<name>` capability. They are the game's own objects, re-exported, so a mod's controls
  and panels move as the native ones do and follow them when they change. The rest of the game's
  motion file stays core's. Nothing native changes.
- The game's panel controls in `renderer`: `TitleTab`, `TextField`, `SelectField`, and the scene's
  own `TurnField` and `SceneDivider`, each its own `renderer:<name>` capability, with their props
  types. They are the game's components, re-exported. `SceneDivider` is now exported by core and
  takes an optional `className`; nothing native changes.
- `useSceneInput` in `renderer`: a mod's panel over a scene puts its own input in the place of the
  scene's action row. The row is put away and dead, and the dialogue box stands clear of the
  panel's input, until the panel gives it back or unmounts. One holder at a time. Without a
  holder, the scene draws as before.
- A throw while the goodbye, the scene or texting bookkeeping, or the next slot's opening builds
  its request, from a `promptState.scene` capture or a `prompts.*` hook, now opens that call's
  retry modal instead of leaving the game waiting. Retry builds the request again; leaving goes
  to the menu, as for a failed call. The modals do not offer the prompt editor for it. This
  covers the slot opening at the start of a slot, and the texting bookkeeping fetched ahead while
  a scene plays, too. Other hooks that run while a scene ends are not covered.

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
