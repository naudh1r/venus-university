# @vx/modkit

## Unreleased

- `promptState.scene`: capture an enabled mod's structured-cloneable value into a scene request's
  `PromptState.ex[modId]`. The copy is made synchronously by the game prompt-state builder;
  prompt formatters can keep using that value if the player edits live mod data while the
  request is being prepared. Values are keyed by owner, never spread over native fields.
  Undefined omits a slice. Duplicate owners or failed captures abort the request naming the mod.
  Declare `promptState.scene` in the manifest; older cores reject the missing hook. DM, ledger
  and slot-intro snapshots are not added by this change. Existing prompt hooks are unchanged.

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
