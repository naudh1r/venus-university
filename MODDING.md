# Mods in this build

This is how the community mods share one build: every mod's code is always in the game, and a
switch decides whether it acts. Players turn mods on and off from **Mods** on the main menu;
nothing is chosen at install time.

`core` is the frame alone, on the game from Venus Dev's public repository, so any mod can
start from it.
`main` is `core` with every mod, and each mod's own guide is in `docs/mods/`.

## The three things a mod does

**1. Register** by adding one file, `src/shared/modEntries/<id>.ts`, named for the mod's id,
whose default export is its entry:

```ts
import type { ModDef } from '../mods'

const mod: ModDef = {
  id: 'city-life-locations',        // written to disk: never changes once shipped
  name: 'City Life locations',
  author: 'Maestro Leeds',
  version: '1.7.1',
  scope: 'playthrough',             // or 'anytime', see below
  defaultOn: true,
  blurb: 'Three new places on the map.',
  requires: [],                     // ids of mods this one cannot act without
  options: [{ id: 'some-option', label: '…', hint: '…', default: true }]
}
export default mod
```

That is all the Mods screen, the main menu's count and the log need. Nothing else names the mod:
`MODS` in `src/shared/mods.ts` is built from whatever files that folder holds, sorted by id, so
two mods added side by side never edit the same line. A test holds each file's name to its id.
The entry may import the mod's own modules for what they set up (a `registerTermCarry`, say).

**2. Ask before acting**, wherever the mod would do something:

```ts
// in a component
const on = useModOn('city-life-locations', record)
// anywhere else in the renderer
if (modIsOn('city-life-locations', record)) { … }
// in main or shared code, with the switches in hand
modOn(switches, 'city-life-locations', record)
```

An option is read the same way: `useModOption(modId, optionId)` or `optionOn(switches, …)`.

**3. Keep its data when it is off.** Off stops a mod acting. It never deletes what the mod
wrote, so a save always loads and switching back on finds everything where it was.

## The two kinds of switch

- **`anytime`**: read where the mod acts. The player can flip it whenever they like. Use it
  for anything a save does not depend on.
- **`playthrough`**: fixed when a playthrough starts. The playthrough's record names the mods
  it started with (`record.mods`), and `modOn(…, record)` answers from that, whatever the
  switch says later. The switch is what a *new* playthrough gets. Use it for a mod that changes
  the game's rules or adds things a save refers to.

Pass the playthrough's record whenever there is one. With none, a `playthrough` mod answers
what a new playthrough would get. A record written before this list existed names no mods, so
no `playthrough` mod is on for it.

A mod whose requirement is off is off too, and comes back when the requirement does; its own
switch is left as the player set it.

## Where it is stored

- `data/mods.json`: the player's switches and options, `{ schemaVersion, on, options }`. A mod
  or option missing from it is at its default, so adding a mod needs no migration. Ids this
  build does not know are kept.
- `playthrough.json`: `mods`, the `playthrough` mods that playthrough started with, and
  `modVersions`, the version of every mod that was on as it started.
- A save's `ex`: each mod's own data, under its id (see Mod data below).


## Installed mods

A mod built outside the repo is installed under `data/mods/` and found at start; the game does not
know it when it is built. The kit (`packages/modkit`) is the one part of the game it imports.

```
data/mods/<id>/current              one line: the version in use (optional)
data/mods/<id>/<version>/vxmod.json  the release, unpacked as it came
                         renderer.js  optional: runs in the window, an ES module
                         main.js      optional: runs in the main process, CommonJS
                         style.css    optional
                         assets/      optional
data/mods/installed.json             the installer's record of each install, by id and version:
                                     where the zip came from, its hash, whether the source is approved
```

`<id>` follows the id rule above and `<version>` is strict `major.minor.patch`; both must match the
manifest. One version of an id is in use at a time: the one `current` names, else the only one,
else the highest, with a line in the log. The loader deletes nothing and writes nothing.

### The manifest, `vxmod.json`

```json
{
  "manifest": 1,
  "id": "hello-mod",
  "name": "Hello mod",
  "author": "morrowkiln",
  "version": "1.0.0",
  "blurb": "Says hello in App settings.",
  "source": "https://github.com/venus-extracurriculars/hello-mod",
  "kit": "0.3.0",
  "hooks": ["settingsSection", "renderer:registerHooks", "renderer:useModOn"],
  "game": ">=0.6.0 <0.8.0",
  "requires": { "mini-games": "^1.2.0" },
  "optional": { "photo-feature": "^2.0.0" },
  "main": false,
  "scope": "anytime",
  "defaultOn": true,
  "offNote": "Switching it off keeps what it saved.",
  "options": [],
  "optionGroups": [],
  "library": false,
  "exports": []
}
```

- `manifest` is the schema's version, `1`. A higher one is refused as made for a newer game; an
  unknown field is refused rather than ignored, so a manifest for a newer schema is never half-read.
- `hooks` names every hook and kit API the mod uses: hooks plainly (`prompts.dm`), kit APIs as
  `side:name` (`renderer:useModOn`), and a required library's exports as `<lib>:<export>`. It is
  checked against the hook table at start, and `registerHooks` refuses a hook it does not name.
- `game` is advisory: a version outside the range is a warning on the row, never a refusal.
- `requires` and `optional` are `{ id: range }` maps in a small range syntax (`1.2.3`, `^`, `~`,
  `>=`, `<`, `1.x`, `*`, a space for and). A required mod must be installed, in range and running;
  an optional one in range is loaded first and its exports are there, otherwise nothing.
- `main` must agree with whether `main.js` exists. `defaultOn`, `offNote`, `options` and
  `optionGroups` are the mod's entry, as an in-repo mod writes them in `src/mod.ts`.
- A library (`library: true`) has no switch and no row; it is on while a mod that is on requires
  it, and `exports` names what its `renderer.js` exports for them to import as
  `vxmod://<lib>/renderer.js`.
- `dataPath`, optional, names a folder the mod already keeps its data in, for `modDataPath` to
  find it there (see Mod data below).

### What runs, and where

- **Main**, before the window opens: every manifest is read and checked, the mods are ordered by
  what they require (dependencies first, ties by id), and each installed, compatible, permitted
  mod's `main.js` is required in that order, switch or not; main-side code asks the switch where
  it acts. `main.js` is one CommonJS file with its dependencies bundled, and its `require` reaches
  only the kit (`@vx/modkit/shared`, `@vx/modkit/main`, answering the APIs the manifest declares
  and throwing on any other), `vxmod:<id>` for a required library, `electron`, Node's own modules
  and a file inside the mod's folder. `main.js` is expected to be that one bundled file; a file of
  the mod's own that it requires runs under the same `require`, so nothing in it reaches past the
  kit or the folder either, and a `.node` addon is the one thing handed to Node's own loader. In
  this step it exports `protocols`: routes under `vxmod://<id>/@/<route>/…`, each
  `{ route, handle(request) }`. A mod never has a scheme of its own.
- **The window**, in `boot()` before the first screen: each loaded mod's `renderer.js` is imported
  from `vxmod://<id>/renderer.js`, one at a time in load order, and its `style.css` added, kept
  only while the mod is on. `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`,
  `motion/react`, `@vx/modkit/shared` and `@vx/modkit/renderer` stay external in a mod's build:
  the page's import map sends them to `vxmod://host/`, where small generated modules hand over the
  page's own instances, so a mod's components run on the game's one React. `@vx/modkit/main`
  there is a module that throws.
- **`vxmod://`** serves a running mod's files from its one folder (nothing outside it, and nothing
  of a mod that is not running), its routes, and the host shims, with the policy in `index.html`
  naming `vxmod:` for scripts, styles, images, media, fonts and connections.
- **A mod that cannot run** is off for the session, with its data kept: nothing is written, not
  `data/mods.json`, not a save. The Mods screen's row keeps its switch where the player left it,
  disabled, and says why under the name (`needs an update: `x` is not in this core`; `needs
  Mini-games, which did not load`; `main.js threw: …`); a notice at start names each such mod once
  per version; entering a game whose record names a `playthrough` mod that is not running says so.
  A mod whose main-process code comes from a source the build has not reviewed (`installed.json`,
  written by the installer alone, does not record its version as approved; a file inside the mod's
  folder says nothing) is not permitted to run unless `allowUnreviewedMain` is on in
  `settings.json`; a developer folder's always is.
- **Starting without mods**: `--no-mods` on the command line reads the manifests and runs
  nothing; Shift held while the window comes up skips every installed mod's window code.
- **For mod authors**: the fold at the foot of the Mods screen loads a mod from a folder holding
  an unzipped release (`settings.json`'s `devModFolders`, taking effect at the next start, and
  standing in for an installed copy of the same id). While the game runs, a change to the folder
  reloads the window, at once off a game and on offer in one; a changed `main.js` offers a restart.

### Modal controls

An installed mod imports `useModalShell` and `useDismissLayer` from `@vx/modkit/renderer`,
and declares `renderer:useModalShell` or `renderer:useDismissLayer` for whichever it uses.
They share the game's dismissal stack; do not copy the implementation or add another global
Escape listener. Mod panels and native panels then dismiss from the top down.

Call `useModalShell(onClose, sound?, primary?)` unconditionally inside a React component.
`sound` is `'panel'` (the default), `'phone'`, or `'none'`. The returned `host` is null until
mount; once it exists, portal the panel into it and spread `overlayProps` on the outside
overlay. The hook handles Escape, right-click outside a text field, and a click that starts
and ends on the overlay. It releases its place in the stack on unmount. The mod supplies its
own content, layout and styles; the hook is not a focus trap.

For a primary action, pass the callback as the third argument and spread `primaryProps` on
the motion element containing the primary action and the modal's controls. Its
`onAnimationComplete('shown')` enables Enter/Space once
the entrance animation lands, with the native guards for text fields and repeated keys.
Without a primary action, omit that argument and those props.

`useDismissLayer(onClose, active)` puts a nested popup on the same stack while `active` is
true. The first Escape/right-click closes that layer; the underlying modal remains open.
Changing `active` to false or unmounting removes the layer. Neither hook depends on any mod.

## Mod data

A mod keeps its data in one of four places: in the save, with the game; on a record inside the
save, such as a character or a message; in memory, for as long as a game or the window lasts; or
in a folder of its own, outside the save. The kit gives each a way in, and core keeps what a mod
wrote whether the mod is on, off, not running or not installed. Each of these is a kit API, so a
mod built outside the repo names the ones it uses in its manifest's `hooks`
(`renderer:saveField`, `renderer:writeModField`, `main:modDataPath`, `main:backupPart`,
`main:characterTransferPart`, …).

### The save keeps what it does not own

Core writes back every top-level key of a save, and every key of its scene, that it does not own,
untouched. The records inside the save (characters, memories, messages, conversations, posts,
project sessions) keep theirs the same way. A build that does not know a mod never drops its
data: a save played with the mod, loaded and saved without it, still holds everything the mod
wrote.

### A mod's slice of the save: `saveField`

A save holds `ex`: one slice per mod, under the mod's id, each `{ v, data }`. `data` is what the
mod wrote, plain JSON, and `v` the version of the mod that wrote it. Core never reads inside a
slice. A mod declares its slice once, from its own files, with `saveField` from
`@vx/modkit/renderer`:

```ts
import { saveField } from '@vx/modkit/renderer'

export const storyMemory = saveField<StoryMemory>('story-memory', {
  empty: { entries: [] },
  legacy: ['exStoryMemory'],             // its old top-level key
  normalize: (stored, legacy, from) =>
    stored !== undefined
      ? (stored as StoryMemory)
      : { entries: (legacy.exStoryMemory as StoryEntry[] | undefined) ?? [] },
  carry: (value) => ({ entries: value.entries.filter((entry) => entry.lasting) })
})
```

The handle holds the mod's value in the game being played:

- `read()` is the value, or `empty` where the save holds nothing for the mod; `use()` is the same
  for a component, which renders again when the value changes.
- `set(next)` replaces the value in memory. It goes out with the next save of any kind.
- `write(next, { expect })` writes it to disk now, at a safe point (below).

`normalize(stored, legacy, from)` runs on every load, for every mod that registered a field, on or
off, whenever the save holds the mod's slice or one of its `legacy` keys. It is handed copies:
`stored` is the slice's data as read (undefined where there is none), `legacy` the old keys the
save holds, and `from` the version that wrote the slice, or null for legacy or pre-kit data. It
returns the value, and must be pure. Without it, the value is the stored data, or `empty`. A
`normalize` that throws leaves the save's data as read and the mod at `empty` for that game; the
error is logged, and the mod's row on the Mods screen says its data in this game could not be read
and is kept as it was.

`legacy` is how a mod moves out of the top-level keys it wrote before the kit. Its `normalize`
reads the old key from `legacy` and returns the value; once it has returned, core removes the old
key, and the next save holds the value in the mod's slice instead. Legacy keys are read only
through `normalize`: without one, they stay in the save as they are. The move is one way. A save
a migrated mod has written no longer holds the old key, so an older version of the mod finds
nothing there.

Core keeps the slices of mods not registered this session, because they are not installed or did
not run, and writes them back on every save. Removing a mod loses nothing, and putting it back
finds its data where it was.

**On a record.** `recordField(id, { empty, legacy, normalize })` is the same for the `ex` on a
record inside the save: a character, a memory, a message, a conversation, a post, a project
session. Its handle is pure: `read(record)` is the mod's value on that record, and
`with(record, next)` is a new record holding it, without the legacy keys. Nothing in core writes
the record back for the mod yet; that comes with each record's hook.

**New games and the next semester.** An enrollment has an `ex` of its own, and the playthrough's
first save starts with it. At New Game+, the next semester's first save starts with what each
mod's `carry(value, context)` makes of its value; `context` is the one `registerTermCarry`'s
adapters are handed (the outgoing semester, the days its dates move back, the characters). A mod
without `carry`, or whose `carry` returns undefined, starts the next semester empty. A slice no
mod read in the game being left is carried as it was. A `carry` that throws is logged, and the
value is carried as it stands.

**Mods that merge fields into `GameSave`.** The in-repo mods that declare their fields on
`GameSave` by declaration merging, and carry them with `registerTermCarry`, keep working as they
are until each moves. A mod moves in two steps. First it declares its `saveField`, with a
`normalize` that reads its old key from `legacy` first, and reads and writes through the handle
from then on. Then, at move-out, it drops the merged declaration and its carry adapter.

### Writing at a safe point

A safe point is a moment the game could take a save: nothing on its way from the model, nothing
waiting to be filed, the moments the Save Game button is open. `safePoint()` says where things
stand: `'open'`, `'waiting'` (the game has to settle first) or `'none'` (no game, or a game that is
over). `useSafePoint()` is the same for a component.

`writeModField(id, next, { expect })` writes the mod's value into the autosave at a safe point,
behind every save already on its way, and changes the live value only once the file is on disk;
until then `read()` answers what it did before. `writeModFields(id, { … }, { expect })` writes
several values in one file: the mod's own and those of the mods its `requires` lists, and no
other mod's. `expect` is, per id, the value the edit was made from, as `read()` gave it; once that
is no longer the live value, the write is refused. The handle's `write` is `writeModField` for its
own id.

`expect` is compared with `===`: an object is stale once `read()` hands out another object, a
string or a number once its value differs. So a game loaded since the edit is not caught by
`expect` alone where the value happens to be the same. An editor that must not outlive its game
keeps a token in a `modState` with `lifetime: 'game'`, which every load, of the same save included,
puts back to `initial`.

Both return a `Result`: `{ ok: true, data: null }`, or `{ ok: false, error }` with an `AppError`'s
`code` and `message`. A refusal writes nothing and changes nothing, and comes back as the error,
never as a throw:

| Code | When |
| --- | --- |
| `MOD_WRITE_FOREIGN` | An id is neither the mod's own nor one it requires, or the field was refused when it was registered |
| `MOD_WRITE_OFF` | The mod is off for the game loaded (a `playthrough` mod as the game's record says), as the write was asked for or at its turn |
| `MOD_WRITE_NO_GAME` | No game is loaded |
| `MOD_WRITE_STALE` | A value `expect` names has moved, as the write was asked for or at its turn, or the game was left or another loaded before its turn came |
| `MOD_WRITE_WAIT` | It is not a safe point, as the write was asked for or at its turn; try again once `safePoint()` is `'open'` |
| `SAVE_WRITE_FAILED` | The write itself failed; where the disk gave an error of its own, that comes back instead |

### Which versions a game was played with

A new playthrough's record keeps `modVersions`: the version of every mod that was on as it
started, `playthrough` and `anytime` alike, by id, and `{}` where none were. A record without it
was written before mods recorded their versions. Such a game loads as it always did, with one
quiet line, once per playthrough a session: "This game was started before mods recorded their
versions." Where a game names a `playthrough` mod that is not running, its notice also says which
version the game was played with, when that is not the one installed. `modVersions` is the version
a game started with; a slice's `v`, and `from` in `normalize`, is the version that last wrote it.

### State that is never saved: `modState`

`modState(id, { initial, lifetime })` from `@vx/modkit/renderer` is a small store of the mod's own
that is never saved: not in a save, not in a backup. Its handle has `get()`, `set(next)`, `use()`
for a component, and `subscribe(onChange)`, which calls back with the new value and returns the
unsubscribe. `set` with the value it already holds (`Object.is`) does nothing. With
`lifetime: 'game'` it goes back to `initial` whenever a game is entered or left, a created scene or
a replay included; with `'session'` it lasts until the window closes. One per id.

### Outside the save

What a mod keeps beyond the save (pictures, a cache, an archive) goes in a folder of its own,
reached from its `main.js` through `@vx/modkit/main`.

`modDataPath(id, playthroughId?)` is that folder: `data/mod-data/<id>/` for what belongs to no one
game, and `data/saves/<pid>/mod-data/<id>/` for what belongs to one playthrough. It is created on
the first call, and its full path is returned. A playthrough that is not on disk is refused
(`MOD_DATA_NO_PLAYTHROUGH`): the call makes the mod's folder, never the playthrough's. The folder is
apart from the install folder, so updating or removing the mod never touches it.

An installed mod that already keeps a folder of its own names it in the manifest:

```json
"dataPath": { "data": "my-mod", "playthrough": "my-mod/cache" }
```

`data` is under `data/`, `playthrough` under each playthrough's folder. Each is one or two
lower-case folder names, and the first is never one core keeps there (`saves`, `characters`,
`photos`, `mod-data` and the rest of `CORE_DATA_NAMES` and `CORE_PLAYTHROUGH_NAMES` in the kit's
`manifest.ts`); a manifest that breaks this is refused. `modDataPath` then resolves to that folder.
Moving to the default is the author's choice, and core moves nothing.

**Backups.** A mod's folders go into the game's backup only through its part. `backupPart(id,
{ export, prepare })` gives it a share, in two phases.

- At export, after the game has gathered its own, `export({ scratch, playthroughIds })` is handed
  its own folder in the backup, `mods/<id>/`, and every playthrough the backup carries. It writes
  its files there and returns `{ json, files }`: `json`, plain JSON, goes in the backup's record
  as `mods[id]`, `{ version, json, files }`; `files` names what it wrote, as paths under
  `scratch`, and without it everything it wrote is carried. A part that throws, or names a file it
  did not write, is left out with a warning, and the backup goes ahead.
- At import, every part's `prepare(json, { dir, list }, legacy)` runs before anything is written,
  reads its share and returns `{ commit, discard }`. `json` is undefined, and `dir` empty, where
  the backup carries no share for the mod, as an older backup does; a part with nothing to restore
  returns a pair that does nothing. Then core writes its own share, then every `commit()`, in
  order. A `prepare` that throws stops the import with nothing written, and the
  restores already prepared are discarded; so are they all if core's own share fails. A `commit`
  that throws ends the import naming the mod, with the game's share already back.

A restore replaces all of `data/saves`, so a mod's per-playthrough folders under
`saves/<pid>/mod-data/` are gone by the time `commit()` runs, and it writes them back there. A
backup holding a share for a mod that has no part here keeps it as it came, under
`data/mod-data/<id>/.backup/<ms>/` with its `backup.json` entry beside it, for the mod to claim
once it is installed. `legacy` is what an older backup holds that the game does not read:
`record`, the record's keys core does not own, `dirs`, its top-level folders core does not
write, as absolute paths in the unpacked backup, and `archive`, the path of the backup file as it
was given, for a share an older build kept beside it.

**Characters.** `characterTransferPart(id, { export, validate, adopt, duplicate })` carries the
mod's data with a character exported, imported or duplicated.

- `export(charId, dir)` returns the json that goes in the export's manifest as `mods[id]`, and
  writes any files into `dir`, the mod's own `mods/<id>/` folder in the export, never her folder.
  A part that throws is left out with a warning.
- On import, every part's `validate(json, dir, legacy)` runs before she is adopted; a throw refuses
  the import. Then each part's `adopt(charId, json, dir, legacy)` takes its share in for her new
  id and returns its rollback. `json` is undefined where the export carries none, and `legacy` is
  the manifest's keys core does not own.
- `duplicate(fromId, toId)` copies the mod's data to her duplicate and returns its rollback.

Adopting and duplicating are all or nothing: a part that throws rolls back those before it, last
first, and her folder is removed. An export's share for a mod that has no part here is left out.

`backupPart` and `characterTransferPart` each take one registration per id; a second throws.

## Options that are one choice

Options that are one choice among several share a `group`, and the mod names the group in
`optionGroups`. One option of a group is on at a time: turning one on turns the others off, and
the one that is on stays on until another is picked. The Mods screen shows a group as one box,
with the group's label and hint once and a row for each choice. They are still plain on/off
values in `data/mods.json`.

```ts
options: [
  { id: 'loader-bunny', label: 'Bunny hop', hint: '', default: true, group: 'loader' },
  { id: 'loader-dots', label: 'Typing dots', hint: '', default: false, group: 'loader' }
],
optionGroups: [{ id: 'loader', label: 'Loading animation', hint: 'The animation shown while…' }]
```

## Where the code is

| File | What it is |
| --- | --- |
| `src/shared/mods.ts` | The list, the switches' shape and every rule above. No dependencies. |
| `src/shared/modEntries/` | One file per mod, named for its id: its entry. |
| `src/main/services/modsService.ts` | Reads and writes `data/mods.json`. |
| `src/renderer/stores/modsStore.ts` | The switches in the renderer, and the hooks. |
| `src/renderer/views/ModsModal.tsx` | The Mods screen. |
| `packages/modkit/` | The mod kit, `@vx/modkit`: the hook points (below), the shared rule and the carry registries, under the three entries a mod imports (`shared`, `renderer`, `main`) and core's own `host` side. Its README says how it is laid out and checked. |
| `src/renderer/mods/hooks.ts`, `src/renderer/mods/ModSlot.tsx`, `src/shared/modRules.ts`, `src/shared/modCarry.ts` | The old paths of what moved into the kit, re-exporting it, so core's imports are unchanged. |
| `packages/modkit/src/renderer/saveField.ts`, `modState.ts` | A mod's slice of the save and of a record, its writes at a safe point, and its unsaved state. |
| `src/renderer/stores/gameStore.ts`, `src/renderer/stores/loop/saves.ts` | Where the slices are read on a load and written back (`SAVE_KEYS`, `SCENE_KEYS` list what core owns), and the write lane a mod's write takes (`writeModSlices`). |
| `src/main/services/modDataService.ts`, `modParts.ts`, `src/shared/modParts.ts` | A mod's folders outside the save (`modDataPath`), and its parts of a backup and of a character's transfer, which `backupService.ts` and `characterTransferService.ts` run. |
| `src/renderer/modEntries/` | One file per mod with hooks, named for its id: its `registerHooks`. |
| `src/renderer/mods/index.ts` | Loads every file in `modEntries/` at boot, then imports each installed mod's `renderer.js`. |
| `src/shared/modSession.ts` | The session table: what the loader found and what became of each installed mod. |
| `src/main/mods/` | The loader (`loader.ts`), the on-disk layout (`layout.ts`), the load order (`order.ts`), requiring `main.js` (`require.ts`), the `vxmod://` protocol (`protocol.ts`, `resolve.ts`, `shims.ts`), the session and its channels (`session.ts`), the developer folders (`devFolders.ts`). |
| `src/renderer/installedMods.ts`, `src/renderer/mods/host.ts`, `src/renderer/stores/modSessionStore.ts` | The installed mods in the window: their entries into `MODS` first of all, the host modules the import map points at, and the session the hooks and the Mods screen read. |
| `packages/modkit/src/shared/manifest.ts`, `range.ts` | Reading `vxmod.json`, and the version-range subset. |
| `test/mods.test.ts` | The rules, tested against a list with every shape of mod. |
| `test/mods/` | The loader's tests, on the fixture mods under `test/fixtures/mods/`. `npm run test:electron`, after a build, runs them in the real app. |
| `test/kit/` | The kit's own checks: a mod file imports only the kit (`boundary.test.ts`), the hook table and the kit's surface agree with the code (`contract.test.ts`), and the per-hook compatibility check (`compat.test.ts`). |

## A rule in shared code

Shared code holds no switches. Where a rule there has to follow one, give the rule a flag with
a setter, and set it from `modsStore.ts` at boot and whenever a switch moves
(`useModsStore.subscribe`). Echo does this for its bonus, and Photo Feature for its switches.

## Sprite and CG prompt drafts

`shared/imagePromptDrafts.ts` lets a shared mod entry add to a sprite's or a CG's prompt draft,
in both processes: the editor's regenerate draft in the renderer and every render in main are
built by the same `spriteDraft` and `cgSetDraft`. Register once at boot with
`registerImagePromptDraft(modId, { draft, regen? })`, from `@vx/modkit/shared`.

- `draft(parts, { character, kind })` is handed the draft's `appearance` and `negative` tags
  and returns them with the mod's own in; `kind` is `sprite`, `nude` or `cg`. Each mod that is
  on is asked in id order, like every hook, and her own negatives are added after every mod's.
- `regen(kept, draft, on)` is what a regenerate reopens on: the edit its button last sent
  (`kept`), refreshed with the mod's tags as they are in the fresh `draft`. It is asked whether
  or not the mod is on, so one that is off can take its own tags back out of a remembered edit.

## Additive romance requirements

`shared/romanceRequirements.ts` lets a shared mod entry register a pure rule with
`registerRomanceRequirement(modId, character => minimumsOrNull)`. The character supplies
`traits` and `preferredStat` and can be absent. Return any subset of Brain, Body and Heart
**point** minimums. Core takes the maximum for each stat across active providers; this is a
merge, not first-wins or a multiplier. The native preferred-stat and High Standards checks
still apply. With no enabled providers, native behavior is unchanged.

```ts
registerRomanceRequirement(MY_MOD, character =>
  character?.preferredStat === 'brain' ? { brain: 60, heart: 35 } : null
)
```

The enable lookup is `sharedModOn`, bound once via `setSharedModRules` to current switches/playthrough selection
by `modsStore`. Disabled callbacks are not called. Register once at boot; the current registry
holds one rule per mod ID, and a second registration for that ID replaces its rule. Results
must be pure and finite; non-finite values are ignored. Exceptions propagate to the caller,
rather than silently bypassing a failed requirement. This ports the existing `main` contract;
it does not add a loader, hot-unload lifecycle or a second hook ordering system.

Core reads requirements at crush eligibility/hints, direct crush awards, relationship prompt
construction, ledger acts, projected milestones and committed milestones. A blocked group act
is dropped as a whole. Friendship and affection can still grow; existing lovers are exempt.
After a breakup, a new romance is gated again. Scene Creator's existing prompt-attraction
override remains intentional. Callers of `foldRelationshipEvents` must supply character and
stats to enforce optional requirements; its context-free form remains the native fold.

`crushHintUpdate` can reopen a previously met hint when a newly active requirement is unmet.
A saved `{ met: true }` therefore is not permanent eligibility: the next hint names the missing
stat, and marks the hint met again once all active requirements are satisfied.

The tests in `test/romanceRequirements.test.ts` use a synthetic registration, not a shipped
mod. They check order-independent composition, disabled/invalid responses, prompts, direct
awards, roll eligibility, group acts, projections, saved milestones and the lover exception.

### Native stat-rank readers

`MAX_TIER`, `pointsForTier` and the `StatTier` type are available from
`@vx/modkit/shared`. They are the game's own rank ceiling and threshold lookup, on either
side of the process boundary. For a requirement tied to the highest native rank, call
`pointsForTier(MAX_TIER)` inside the registered rule. Do not copy the current point value
into the mod. Pass a valid `StatTier`; this typed lookup does not sanitize arbitrary saved
numbers or define a mod's extra negative starting ranks.

A manifest using these runtime exports declares `shared:MAX_TIER` and
`shared:pointsForTier` alongside `shared:registerRomanceRequirement`. The type has no
runtime declaration. An older core without either reader marks that mod as needing an
update through the existing compatibility check.

```ts
import { MAX_TIER, pointsForTier, registerRomanceRequirement } from '@vx/modkit/shared'

registerRomanceRequirement(MY_MOD, character => {
  if (!appliesTo(character)) return null
  const minimum = pointsForTier(MAX_TIER)
  return { brain: minimum, body: minimum, heart: minimum }
})
```

These readers do not award points or change stat progression, floors, semester decay, or
the romance requirement registry's existing rules.

## Screens and the files in the root

A mod's screens follow `UI_STYLE_GUIDE.md`, but nobody edits it, nor any other file in the root
besides this one (`DESIGN_GUIDE.md`, `README.md`, …): they come from Venus Dev and are replaced
whenever a new version of the game is synced in. How a mod's own screens look goes in its guide
under `docs/mods/`; how a hook point draws goes in its entry here.

## Hook points

A switch decides whether a mod acts. Hook points decide **where** it acts without editing the
game there. At each place mods commonly add to, the game asks once, in one line of its own
file; a mod answers from its own files. Two mods adding to the same place then never touch the
same lines, and neither touches the game's code at that place.

Everything is in `packages/modkit/src/renderer/hooks.ts` (`src/renderer/mods/hooks.ts` re-exports it).
The game's side, at each place:

```ts
...promptLines('dm', { character, info, state })   // in textingPrompt.ts
afterDmReply({ charId, character, reply: data })    // in textingLoop.ts
```

A mod's side, once, in its own file:

```ts
registerHooks(PHOTO_FEATURE, {
  prompts: { dm: { lines: (ctx) => photoLines(ctx.character, ctx.info, ctx.state) } },
  afterDmReply: ({ charId, character, reply }) => void sendPhoto(charId, character, reply)
})
```

in a file of its own, `src/renderer/modEntries/photo-feature.ts`, named for the mod's id.
`src/renderer/mods/index.ts`, which `App.tsx` imports, loads every file there at boot; nothing
else names it.

### The rules

- **Only mods that are on are asked.** The mods store hands the hooks its switches
  (`setHookRules`), so a mod that is off is never called and the game runs as it would without
  it. A mod rarely needs to check its own switch at a hook.
- **Mods are asked in the order `MODS` lists them**, by id, whatever order they registered in.
- **Adding to the game, not replacing it.** Lines, fields and events from every mod are all
  used. Where only one answer can win (likes), the first mod that answers decides and the game's
  own roll is the fallback.

### The hook points

| Hook | Where the game asks | What a mod can do |
| --- | --- | --- |
| `prompts.dm` | `textingPrompt.ts` | Add lines to her DM prompt, and fields to its reply |
| `prompts['slot-posts']` | `slotIntroPrompt.ts` | Add lines about status posts, and fields to each post |
| `prompts['slot-poster']` | `slotIntroPrompt.ts` | Add lines under each girl posting, by her name, given the slot the opening is for |
| `prompts['slot-reach-outs']` | `slotIntroPrompt.ts` | Add lines under a girl texting first, and fields to her entry |
| `prompts['text-ledger']` | `textLedgerPrompt.ts` | Add lines to the texting bookkeeping, below the slot's messages, handed the girls he texted |
| `prompts.character` | `characterPrompt.ts` | Add lines and fields to character generation |
| `dmHistoryNote` | `textingPrompt.ts` | Add a note after a DM in the history the prompt quotes |
| `characterFromDraft` | `characterPrompt.ts` | Fill fields of a generated character from the reply |
| `afterDmReply` | `textingLoop.ts` | Act after her reply in a DM has landed |
| `afterSceneReply` | `loop/turn.ts` | Read a landed scene reply as the model wrote it, fields a mod asked for included. A turn's reply only: a scene's closing reply is not handed over |
| `scenePlay` | `SceneChrome.tsx`, `GameView.tsx` | Stand a seat on the scene's rail, and open a panel of its own over the scene |
| `gameModals` | `GameView.tsx` | Register panels of its own by id, which `openPanel(id, arg?)` from the kit opens over the game view. Props: `theme`, `arg`, `covered`, `onClose`, `openGameMenu` |
| `railButton` | `SceneChrome.tsx` | Draw a button on the scene's rail, after the Calendar and before the mods' scene seats; not on a created scene or a replay. Props: `Seat` (the rail's own seat), `visible`, `dead` |
| `landingTool` | `LandingChrome.tsx` | Draw a tool in the landing's corner, after the log and before Settings; not on a created scene or a replay. Props: `Tool` (the landing's own tool), `visible` |
| `gameMenuEntry` | `GameMenuModal.tsx` | Draw an entry in the game menu, after Mods and before Controls. Props: `Item` (the menu's own entry), `saveOffer` (`'open'` where a save can be written now) |
| `afterReachOut` | `textingLoop.ts` | Act after the texts of a girl texting first have landed |
| `playerActs` | `gameLoop.ts` (`submitAction`), `loop/hangouts.ts`, `loop/relax.ts` | Act when the reader commits to something: an action, a hangout begun, or Relax |
| `gameEntered` | `gameLoop.ts` (`enterGame`) | Act when a game is entered, new or loaded |
| `fileFeedPost` | `loop/feed.ts` | Change a slot post before it is filed, or file it later itself (`held`) |
| `postLikes` | `loop/feed.ts`, `NewGameView.tsx` | Decide likes on ending, stranger and winter posts |
| `postVisible` | `feedView.ts`, `loop/feed.ts`, `ContactPage.tsx` | Keep a post off the feed for now |
| `postOutAt` | `feedView.ts`, `ContactPage.tsx` | When a post kept off came out, so it stands above its slot's posts already showing |
| `postComments` | `BunnyboardModal.tsx` (`PostSpots.tsx`) | Draw the comments under a post and a control beside its like; one mod at a time |
| `postPicture` | `BunnyboardModal.tsx` (`PostSpots.tsx`) | Draw a post's picture under its text |
| `emojiTool` | `BunnyboardModal.tsx` (`TextSpots.tsx`) | Stand an emoji tool beside a box being typed in, in place of the phone's row of quick emoji; one mod at a time |
| `sentText` | `BunnyboardModal.tsx` (`TextSpots.tsx`) | Draw what somebody sent (a message, a post) and say which messages stand with no bubble; one mod at a time |
| `endingChoice` | `GameView.tsx` | Offer a way on from the ending, beside "Return to the main menu" |
| `saveChoice` | `LoadGameModal.tsx` | Offer something for a picked save, beside "Load" |
| `modDetail` | `ModsModal.tsx` | Draw a page of its own for the mod picked on the Mods screen, its own or one built on it, in place of the list of that mod's options |
| `updatesTab` | `BunnyboardModal.tsx` | Add a page beside the feed in the Updates tab, with an unread count |
| `optionPreviews` | `ModsModal.tsx` | Draw a preview under one of the mod's option groups on the Mods screen |
| `saveNote` | `SaveGameModal.tsx` | Add a line to Save Game about what a save of the scene keeps of the mod's own |
| `statActivities` | `slotActions.ts` | Offer a training activity in place of one of the landing's stat suggestions |
| `slotActivityAvailable` | `gameLoop.ts`, `slotActions.ts`, `GameView.tsx` | Say whether a training activity is still there to commit to or resume |
| `exercisedStats` | `gameLoop.ts` (`resolveScene`) | Change what the hour exercised, before the game resolves what that pays |
| `settleSceneStats` | `gameLoop.ts` (`resolveScene`) | Change what a finished scene does to the reader's stats, and the lines that say so |
| `statFloor` | `gameLoop.ts`, `gameStore.ts` | Say the lowest a stat may fall to; the first mod that answers decides |
| `settingsSection` | `AppSettingsModal.tsx` | Draw a component in app settings, in the Game tab under the volume sliders. Props: `theme`, `busy` (a backup or restore is running) |
| `portraitOverlay` | `GameView.tsx` (`PortraitSlot`) | Draw a component in each portrait on the stage, under her sprite. Props: `charId` |
| `phoneOverlay` | `BunnyboardModal.tsx` | Mount a component in the phone's veil while the phone is open, over the phone. Props: none |
| `conversationFoot` | `BunnyboardModal.tsx` | Draw below a person's message history and before the composer; not on bot or employer threads. Props: `charId` |
| `mapOverlay` | `MapModal.tsx` | Draw a component on the map, under the places and above its foot. Props: `canTravel` (the map was opened to go somewhere), `close` |
| `photosPageSection` | `PhotosPage.tsx` | Draw a component on the Photos page, under the grid. Props: `theme` |
| `editCharacterImages` | `EditCharacterModal.tsx`, `CharacterModal.tsx` | Draw a component first among her images, in the character editor and the character view. Props: `charId`, `name`, `theme`, `height` |
| `editorField` | `EditCharacterModal.tsx` | Add a field to the character editor, under Generation settings, saved with her |
| `stageLayer` | `GameView.tsx` | Mount a component over the stage and under the scene's chrome, on every screen of the game view. Props: `sceneMode`, `cinematic`, `covered`, `uiHidden`, `rowShown`, `blocked`, `quiz`, `interjectRow`, `awaitingInput` |
| `panelLayer` | `GameView.tsx` | Mount a component among the game view's panels, over the chrome, on every screen of the game view. Props: `cinematic`, `covered`, `uiHidden`, `blocked`, `panelOpen`, `openGameMenu` |
| `messageAttachment` | `BunnyboardModal.tsx` | Draw a component after a phone message's text bubble, or alone where the message has no text. Props: `message` |
| `contactPostExtra` | `ContactPage.tsx` | Draw a component beside a post's like, in the feed on her contact page. Props: `charId`, `post` |
| `contactTab` | `ContactPage.tsx` | Add a reading of her beside Profile on her contact page: a tab, and a panel drawn in place of her cards |

The two ways on (`endingChoice`, `saveChoice`) share one shape, `WayOn`. Its `prepare` runs
while nothing has been torn down, does whatever may fail and reports it, and returns `enter`,
which the game calls once any running game is gone: it stages what the mod needs and names the
screen to show. The first mod that answers is offered; the game's own choice always stays.
While `prepare` runs, the screen that offered the choice keeps every button locked; an answer
that comes back after that screen closed, or after its game was left, opens nothing.

The places on screen (`settingsSection` to `contactPostExtra` above, `railButton`, `landingTool` and `gameMenuEntry`) each take a component. Every mod
that is on and has one there is drawn, in list order, and drawn again when a switch moves or a
game is entered or left (a `playthrough` mod is on as the game's record says); a mod that is
off is not drawn. The props are the facts the game has at that place, and only the ones a
mod reads; a component works out its own hidden or blocked state from them. A component that
throws draws nothing from then on, and the screen around it carries on. `phoneOverlay` is mounted
in the phone's veil, so it is there only while the phone is open, and stands over the phone: it
is not a layer over the whole app. `blocked` is the game's own: a panel, a modal or a failure
standing over the scene. Once mods use one of these places, its name and its props stay as they
are; a change goes in as a new place beside it.

A tab on her contact page (`contactTab`) is an `id`, a `label`, a `Panel` and an optional
`shown({ charId, isContact })`. While a mod that is on has one that stands for her, the page draws
a row of tabs, Profile first, and the picked tab's `Panel` in place of her profile cards, handed
`charId`, `isContact` and `theme`; the page is her profile again once that tab goes. One tab per
id, the first in list order, and `profile` is the page's own. `Card` and `Locked` from
`ContactPage.tsx` draw a panel the way the page draws its own cards.

A place on the scene screen (`scenePlay`) is two components. `Seat` is mounted on the rail for
as long as the scene's chrome is; the game hands it the rail's own seat to draw with, whether
the rail is up, and `open`. It decides for itself when it has something to offer, and stands
down (`state: 'gone'`) otherwise. `Panel` is mounted while open, as one of the scene's own
panels: the scene behind it takes no key, click or turn until it closes. A field a mod adds to
the scene's reply (`requests.scene`) comes back whole in `afterSceneReply`, once the reply's
lines are on the transcript.

A mod's own panels (`gameModals`) are components under ids of its choosing. `openPanel(id, arg?)`
from `@vx/modkit/renderer` opens one over the game view, in place of whatever panel is open there,
as one of the view's own panels: the scene behind it takes no key, click or turn until it closes.
The panel is handed `theme`, `arg` (whatever `openPanel` was handed beside the id, such as whose
panel it is), `covered` (a crossing between screens is over the view), `onClose`, and
`openGameMenu`, which closes it into the game menu, for a panel the menu opened. Any mod may open
any id, its own or another mod's; one panel per id, the first mod's that is on, with a warning in
the console naming both mods when two that are on have a panel under the same id. Where no game view
is up, or no mod that is on has a panel under the id, `openPanel` opens nothing and returns
`false`.

A button on the rail (`railButton`) draws with the rail's own `Seat`, so it looks and moves as
the game's seats do. It turns `visible` and `dead` into the seat's `state` as they do: `'gone'`
where not visible, `'dim'` where dead, `'shown'` otherwise. A tool on the landing (`landingTool`) draws with the
landing's own `Tool`, handed a `label`, `onClick` and its icon, and stands only while `visible`;
the corner staggers it in with the game's. An entry in the game menu (`gameMenuEntry`) draws with
the menu's own `Item`, handed its words and `onClick`, and `dead` and a `note` for a hover over
it while dead. A press on any of the three opens the mod's panel with `openPanel`; a panel opened
from the menu can go back to it with `openGameMenu`.

A panel that sends a turn of its own takes the reader's turn first with `takeTurnFromReply()`
from `stores/gameLoop.ts`, then sends with `submitAction`. It sends nothing itself: it brings the
scene to a decision point a turn can go out from, the way an interjection does. Lines still
being read are cut, the live scene call and any pending ending are dropped and the cut is written
as a decision point; over a reply's last line, that line is taken as turned; at a decision point
already, nothing changes. It returns `false` when none of these applies (the scene is busy, or
nothing is waiting on the reader), and then the panel sends nothing.

A hook point is added where mods actually meet, not ahead of need. Once mods use one, it stays
as it is: renaming it or changing what it passes breaks them. A change that is needed goes in
as a new hook beside the old one.

A field in the character editor (`editorField`) is `read`, `Field` and `write`. `read` takes
its value off her as the editor opens; `Field` is drawn under Generation settings, after the
appearance tags, handed `value`, `onChange`, `charId` and her `baseAppearance` as the form holds
it; `write` turns the value into what saving puts on her. Write only your own fields: the game's
own are written over whatever a mod returns, so a mod cannot change her name or her traits by
mistake. A `write` may return `ex`: its slices go in beside hers and the other mods', never in
place of them. Save and the unsaved-changes check see it as they see the game's fields. A mod that is off draws no
field and writes nothing, so what it saved on her stays.

### Not covered yet

- Screens: a mod's own panels beyond those over the game view (`scenePlay`, `gameModals`), a
  page beside the feed (`updatesTab`), a preview on the Mods screen (`optionPreviews`) and the
  places on screen above.
- Main process: IPC, services, settings and character rules. Protocols are covered: a mod's
  `main.js` exports routes under `vxmod://<id>/@/…`.
- Saves: a mod's slice of a record inside the save (`recordField`) is the mod's to write back
  until that record has a hook. Its slice of the save itself, and carrying that into the next
  semester, are covered (Mod data, above).

These are still direct edits, as before.

### Tests

`test/modHooks.test.ts`: only mods that are on are asked, in list order; likes fall back to the
game's own; a post a mod holds is not passed on; scene places and landed scene replies go to
the mods that are on; `openPanel` opens a panel only while a game view is up and a mod that is
on has the id. `test/modSlots.test.ts`: each place on screen draws the components of the
mods that are on and not those that are off, each in a boundary of its own that turns a throw
into nothing drawn.

The hook points are naudh1r's design, lifted from his Photo Feature branch, which is the first
mod on them.

## Opening a pull request

The build lives at `venus-extracurriculars/build`, which is a fork of Venus Dev's repository.
On a fork, GitHub's **Compare & pull request** button offers to open the pull request on Venus
Dev's repository instead of ours. Skip the button and use this address, with your branch's name
at the end:

```
https://github.com/venus-extracurriculars/build/compare/main...your-branch
```

Use `core` in place of `main` for a change to the mod system itself. Before you click **Create
pull request**, check that the top left of the page reads `venus-extracurriculars / build`. If
it reads `venus-uni-dev / venus-university`, stop: that is Venus Dev's repository.

From the command line, `gh repo set-default venus-extracurriculars/build` once, and
`gh pr create` targets the right repository from then on.

Where a branch goes:

- `core`: the mod system on the current game version, with no mods.
- `mod/<name>`: one mod, built on `core`, looked after by its author.
- `integrate/<name>`: the mod merged with `main`, where conflicts with other mods are settled;
  its pull request goes into `main`.
- `main`: what players get, assembled from `core` and every mod branch.

## Not decided yet

- The build's version numbering (`BUILD.version` in `mods.ts`).
- Whether `data/mods.json` goes into the game's own backup; it does not today.
- How a mod that patches the built code, rather than the source, reads its switch.

## Scene and memory hooks

- `prompts.scene` adds context to cast and solo scenes, including continuations and closing requests.
- `requests.scene`, `requests.dm`, `requests.ledger` and `requests['slot-intro']` extend a completed request in mod-list order. Preserve the request and schema fields received from earlier mods. DM hooks run for normal and regenerated replies because both use the same builder.
- `slotSettled` receives the scene's starting state, the completed ledger and closing cast after bookkeeping, before clock advancement and the boundary save. It is synchronous so mod state is included in that save.
- `slotStatusLines` adds lines to the slot's closing report, after what each girl took away from it, written with `memoryStatusLine` as the game writes its own. It is handed `nextSlot`, the global slot about to begin, and every mod that is on is asked, in list order.
- `fileLatePost(post)` in `loop/feed.ts` files a post a mod wrote mid-slot, outside the slot's opening, the way the opening files its own: through `fileFeedPost`, so it can be held like any other. It leaves the slot's teaser and fill as they were drawn.
- `texts` on a ComfyUI job in `comfyService.ts` fills more prompt nodes by id, for a graph with more prompts than the positive, negative and detailer the job already fills.

These hooks add to the existing API; existing hooks and their arguments are unchanged. Screens and IPC still use direct integration as documented above; a mod's save data has `saveField` (Mod data).

- `bunnyboardPage` registers an independently gated tab with `id`, `word`, `Mark` and `Page`. Disabling its mod unmounts the page and returns the phone to Chats. Native tab IDs cannot be replaced. Other screen integration remains direct.
- `optionPreviews` draws a preview under an option group on the Mods screen, keyed by the group's id. The game hands it `optionId`, the option picked (or null), and draws it under the group's switches on the recessed ground. It is asked whether or not the mod is on, so a player sees it before switching the mod on.
- `updatesTab` puts a page beside the feed in the Updates tab, with `id`, `word`, `Page`, an optional `unread(game)` and an optional `Action`, drawn at the end of the titles' row while the page is showing. With one or more on, Updates draws a row of titles you press, its own first (the one showing drawn as the screen's title, the rest muted over a faded blob), and the game puts each `unread` on the far corner of its title's blob and sums them onto the Updates tile and the landing's Bunnyboard badge. The page is drawn under the title; it brings its own `vu-bb-scroll`. The feed's id, `feed`, cannot be replaced; leaving the tab, or the mod switching off, comes back to the feed.

### DM request history window

`buildTextingPrompt` accepts an optional `historyLimit` on its `TextingPromptState`.
This is a request-builder option, not a global hook or a saved preference: the caller that
owns a replay supplies it for that request. Ordinary texting still includes the newest 20
stored messages. A finite override is rounded down and clamped to 20–160; missing or
non-finite values use 20. The pending player message is added once after those messages,
so the maximum is 160 stored messages plus the pending text. This is a message count,
not a token or character budget, and does not change stored history or summary retention.

The supplied conversation is read without mutation. A caller rebuilding a rejected reply
must first supply a snapshot from **before** that reply, with its earlier summary (or null
when that summary is unavailable); this option does not identify or remove rejected turns.
The native lorebook scan reads the selected history, and `dmHistoryNote`, `prompts.dm` and
`requests.dm` still run normally. A larger window can increase request size and cost; use it
only when the earlier summary is unavailable. Model selection and request dispatch do not change.

The future texting kit can forward this option from `buildDmRequest`. Thread leases, safe
conversation replacement, mod activation checks and persistence remain the caller's
responsibility; this capability alone is not a complete regeneration or loader API.
See `test/dmHistoryWindow.test.ts` for bounded requests, replay snapshots and hook composition.

### Comments under posts

The game keeps a post's comments (`comments` on `SocialPost`, shaped as `PostComment` in
`shared/postComments.ts`) and moves them with the post through New Game+, but writes and draws
none of its own. A mod that does registers `postComments`: only one draws them at a time, the
first that is on in `MODS` order (`postCommentsOwner`), and a mod asks `ownsPostComments(id)`
before writing any, so two mods never both ask the slot's opening for them. Its `claims` marks the
comments only it writes; another mod drawing comments leaves those out, whether or not it is on.
A mod adds its own fields to `PostComment` by declaration merging. `PostCommentsView`,
`PostCommentAction` and `PostPicture` in `components/PostSpots.tsx` draw a post's spots in a
mod's own screens too.

### Emoji and sent text

The phone's composer stands the row of quick emoji under its field, and draws messages and
posts as their bare text. A mod that draws either itself registers `emojiTool`, `sentText` or
both: only one draws each, the first that is on in `MODS` order. `emojiTool` is a component the
game hands `dead` (the box is shut) and `onPick(emoji)`, which puts the emoji in at the caret;
with one on, it stands beside the field and the row of quick emoji goes. `sentText` is a `Text`
component, handed the `text` and `big` (off on a one-line preview), and an optional
`bare(text)` saying which messages stand with no bubble behind them. `EmojiTool`, `SentText`,
`useEmojiTool` and `useBareMessage` in `components/TextSpots.tsx` draw them in a mod's own
screens too, so a mod with a box of its own takes the same tool without importing the mod that
draws it. What is sent and saved is the text as typed either way.

### Optional semester carryover

A mod's slice of the save is carried by its `saveField`'s `carry` (Mod data, above), and that is
the way forward. The adapters below keep working for the mods that merge their fields into
`GameSave`, until each moves.

A mod may augment `ModCarryFields` and register its own pure adapter with `registerTermCarry` in `shared/modCarry.ts`, imported by its entry in `shared/modEntries/`. The game's New Game+ calls them: Continue reads every registered field off the ending's save (`modFieldsLeaving` in `renderer/stores/semesterModCarry.ts`, with the outgoing semester's index, the days its dates move back, and the characters) and keeps it on the carry beside the game's own, and the next semester's opening save takes it back in through `carriedModFields`. These adapters retain saved data even with a switch off; they must not trigger generation. The registry itself requires neither Continuing Semesters nor any feature mod.

Fields a mod adds to a feed post that hold a time (the last slot it answered, say) are carried by the mod too: New Game+ moves each post's own date back onto the next semester's clock, and `registerPostCarry(modId, (post, days) => …)` in `shared/modCarry.ts` moves the mod's fields back the same `days` (a global slot moves twice that). Like the adapters, it runs with the switch off.

Files a mod keeps per playthrough outside the save (pictures, say) need nothing: New Game+ continues the same playthrough, so they stay where they are. `registerTermFiles(modId, async ({ from, to }) => …)` is kept for an extension that starts a new playthrough per semester, which calls `carryModFiles({ from, to })` once the new playthrough is written, before it is entered; the game itself never calls it. A copier runs with its mod's switch off too, and one that fails costs only its own files.

## Managed ComfyUI launch environment

Trusted main-process setup can register a synchronous provider with
`registerComfyLaunchEnvironment(modId, ({ root, platform }) => ({ KEY: value }))` from
`main/services/comfyLaunchEnvironment.ts`. `root` is the managed ComfyUI installation's
working directory. Return a plain string-valued object, or `null` to contribute nothing.
This is a main-process registry, not a renderer hook, IPC endpoint, or permission grant.

The service reads a frozen context immediately before each new managed process is spawned,
before opening its log. No providers means the existing inherited environment. Contributions
override inherited values only in the child; `process.env` is never changed by the registry.
Different keys combine, identical values coalesce, and different values for the same key
refuse that launch with both owners named. Windows names are compared without case, including
inherited aliases such as `Path`/`PATH`. Invalid names/values and provider exceptions fail the
launch with an owner-labelled error; diagnostics do not print environment values.

External servers and an already-running managed server are never changed or restarted by
this hook. A changed registration affects the **next managed boot**; a running server needs
an explicit stop/start. The normal start guard still shares one boot between callers.

Duplicate owner registrations fail. The returned disposer unregisters only its own entry and
is safe to call twice or after a replacement. The trusted host/mod entry owns registration,
availability and disposal; renderer switches are not implicitly read in main. An inactive
provider can return `null`. Installation-level configuration needed by installed custom nodes
may intentionally remain present while their gameplay effects are off. This PR supplies no
loader or activation policy: a future loader must enforce its reviewed-main-code policy and
wire that lifecycle before offering custom-source installation.

See `test/comfyLaunchEnvironment.test.ts` and `test/comfyLaunchProcess.test.ts` for composition,
Windows aliases, errors/disposal, and the real service's launch boundary with mocked processes.

## Shared gameplay extensions

- A mod keeps data with the scene being played by declaring optional fields on
  `ModSceneFields` in `shared/types.ts` by declaration merging, and reading and writing them on
  the game store's `sceneMods`, leaving other mods' fields as they are. They are saved as the
  scene's `mods`, restored with it and cleared when the next scene is cast, so they must be
  plain data.
- A slot activity is something a mod offers on the landing in place of a stat suggestion
  (`statActivities`), such as a game to train a stat with. Committing to one saves it with the
  scene as `activity`; the scene is cast as usual, held open while the activity is pending, and
  told to stage only the arrival (`COMMITTED SLOT ACTIVITY` in the system prompt). The mod opens
  its own surface and calls `finishSlotActivity(owner, id, completed, result)` once; the game
  saves the result, then sends a closing turn that ends the scene. Once the reply to that closing
  has landed the activity is closed and the scene runs as any other. A reload resumes a settled
  activity's closing rather than its play, and `slotActivityAvailable` is asked again at commit
  and on reload; one no longer available ends without being completed. The game pays nothing
  for an activity itself: a mod whose activity trains a stat says so in `exercisedStats`, and one
  that rewards it beyond that does so in `settleSceneStats`.
- `exercisedStats` changes what the hour exercised — the ledger's verdict on which stats the
  scene worked — before the game resolves what that pays, so every mod settling afterwards sees
  the exercise as the ledger. It runs for enabled mods in list order, each handed what the one
  before left. A mod changing the exercise belongs here, not in `settleSceneStats`: there it
  would run after another mod's bonus on the exercise it is about to change, and list order
  would decide the outcome.
- `settleSceneStats` changes the stats a finished scene settles, after the game has resolved
  them from the exercise. It runs for enabled mods in list order, each handed what the one before
  left, with the exercise as `exercisedStats` left it and the scene's facts. Both run for the
  projections before the ending too, so return fresh values and write nothing. `statFloor` gives the lowest a stat may
  fall to wherever the game applies stats; the first mod that answers decides, and the game's own
  floor stands where none does.
- `projectSlotMemories` transforms the projected character memories before the crush roll
  and next opening. It runs for enabled mods in list order. Return fresh values; do not write
  stores, award currency, consume an ability or roll randomness. Commit effects at
  `slotSettled` instead. With no active handler, the native projection passes through.
- `sharedModOn` in `shared/modRules.ts` uses the same live lookup as renderer hooks,
  without importing renderer stores. It defaults off before binding. In main,
  `modsService.ts` binds it to the switches main last read or wrote; main knows no
  playthrough, so a `playthrough` mod answers there as its switch stands. A mod's renderer entry
  owns any mod-specific setup; framework stores should not import feature modules.
- A mod keeps its own data in a save with `saveField`, and on a record inside it with
  `recordField` (Mod data, above); that is the way forward. Adding optional fields to `GameSave`,
  `CharMemory` and `ProjectSession` by TypeScript declaration merging in the mod's own modules
  still works, for the mods that do it until each moves. Enrollment additions go on
  `ModEnrollmentFields`. Save/enrollment validation requires the native required keys;
  optional additions do not make older files invalid. Mods own normalization and carryover.
- The native `lorebook` Bunnyboard tab is reserved, like Chats and Friends.

## Conversation footer

`conversationFoot` is an additive screen slot below a person's message history, outside its
scrolling list, and immediately before the native composer or its stand-in. It receives
`{ charId: string }`. BunnyBot, VenusBot and employer threads do not draw this slot. Each enabled
mod contributes its own component in mod-list order, inside its own error boundary; no provider
means no markup or additional spacing. Changing the open conversation remounts the contribution.

```ts
import { registerHooks } from '@vx/modkit/renderer'

registerHooks(MY_MOD, { conversationFoot: MyConversationTools })
```

The slot grants a place to draw, not permission to send or replace messages. It remains present
when a person's thread is read-only or busy, so a mod may explain a disabled action. The mod's
action must use its existing thread/save guards and cancellation rules. It must not infer that
mounting the component means a send or regeneration is allowed. The slot itself performs no
model call, persistence, history replacement or composer change.

This retires Text Regeneration's direct `TextRegenerate` import and mount in
`BunnyboardModal.tsx` when that mod registers its component on main. Its transaction API is
separate; this hook alone does not make Text Regeneration a standalone mod.

## Character trait registration

`shared/traits.ts` owns the native trait vocabulary and an additive registry. Register from
the mod's shared entry before the first screen/request. The exact `value` is both the label
and permanent string in `character.json`; do not rename a shipped value without a migration.

```ts
const unregister = registerCharacterTrait(MY_MOD, {
  value: 'My stored trait',
  description: 'What this trait means',
  editor: true,          // default: offered by the editor when installed
  generated: false,     // default: AI must never assign it
  tone: 'my-mod-gold',   // optional data-tone token; the mod supplies its CSS
  hint: 'A short explanation for the player.'
})
```

This is one **registry** family, not a gameplay rule. Duplicate stored values, including a
native value, throw an error naming both owners rather than picking by load order. Metadata
is copied and frozen. Native traits keep their existing order; extensions sort by owner ID
then stored value. The returned disposer removes only that registration and is safe to call
twice; it does not change saved characters. The loader/diagnostic UI is separate work.

#### When the registry is read

| Consumer | Timing and policy |
| --- | --- |
| Character generator | `generatedCharacterTraits()` snapshots native traits plus explicitly `generated: true` traits whose owner is currently on. The writing pipeline takes one snapshot before building/queuing the request. Prompt text, schema and response parsing share it even if a mod is toggled or unregistered while generation is pending. A later registration can only affect the next request. |
| Editor | `traitOptions(form.traits)` reads at each render, not module import. Installed metadata is available with the mod switch off, independently of its gameplay effect. `editor: false` prevents new selections; an already-saved value still gets its chip metadata. `selectedTraitHints` supplies the selected explanations. |
| Character/contact chips | `traitTone` reads installed metadata when rendered. The contact page shows only known traits, behind its existing discovery conditions; a missing provider's tag stays saved but is not drawn there. The character editor/sheet can still show its raw saved name. Native editor chips keep their existing lack of tooltips; extensions use their explicit hint, falling back to their description. Core supplies `data-tone`, not a mod's visual design. |
| Character card export | `traitDescription` reads metadata while constructing the card; an unknown trait exports its raw name without an `undefined` description. |
| Scene/DM prompts | This registry does not automatically inject new instructions or enforce gameplay effects. Use the existing prompt hooks or a gameplay rule such as romance requirements. Native trait mechanics are unchanged. |

Registration is currently a boot operation, before requests/screens. Functions reflect later
registrations on their next call, but registration alone does not force a mounted React screen
to rerender. An eventual hot installer must remount/refresh affected screens; this PR does not
claim that loader lifecycle exists.

`CHARACTER_TRAITS` and `TRAIT_DESCRIPTIONS` remain **native-only** constants for compatibility;
new consumers must use the registry readers above. `isCharacterTrait` means "currently known",
not "allowed from AI" and not "safe to retain on disk". Generation uses its explicit snapshot.
Saved `CharacterTrait` strings are open, and load/import/export preserve unknown values.
`editedCharacterTraits` permits offered additions while retaining existing unknown/hidden tags;
only an explicit player removal drops one. A missing mod never rewrites the card.

See `test/characterTraits.test.ts` for generator/editor separation, import-before-registration,
pending-request snapshots, duplicate owners, deterministic order, metadata disposal, UI tone
and hints, and read/edit/export with a missing provider. No particular mod trait ships in core.
