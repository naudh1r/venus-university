# @vx/modkit

The mod kit: the one part of the game a mod may import. A mod imports from its own code, its
bundled dependencies, React (`react`, `react-dom`), `motion`, the mods it names in `requires`, and
this package. Nothing else of the game. `MODDING.md` at the repo's root says how the hooks work.

## Entry points

| Import | Runs in | Holds |
| --- | --- | --- |
| `@vx/modkit/shared` | both processes | the switch readers, the carry registries, the rule registries, the types a hook hands over, the hook table, `KIT_VERSION` |
| `@vx/modkit/renderer` | the window | `registerHooks` and every hook type, the switch hooks for components, the components a mod draws with |
| `@vx/modkit/main` | the main process | what a mod's main-process code may register |

`@vx/modkit/host/*` is core's side of the same modules (the dispatchers, the rule binders) and is
not for mods: the import-boundary test refuses it in a mod file, and the published package leaves
it out.

## In this repo

Core resolves the kit by alias straight to `src/` here, in every build and test config, and the
old paths in core's `src/` (`renderer/mods/hooks.ts`, `renderer/mods/ModSlot.tsx`,
`shared/modRules.ts`, `shared/modCarry.ts`) re-export the moved files, so core's own imports are
unchanged. There is no runtime build of the package yet; `dist/` holds only the rolled-up types
that `scripts/report.mjs` writes.

`src/bridge/` is the only place the kit names a path in core: every core type and function the
kit hands a mod is re-exported there and nowhere else.

## Compatibility

Once a hook is in use it never changes. The only thing that can break a built mod is a hook
being removed, so a mod's manifest lists the hooks and kit APIs it uses, and core compares that
list with `HOOKS` and `KIT_APIS` in `src/shared/hookTable.ts` at install and at start. A hook
cannot exist without a row there: the renderer's `hookTie.ts` fails the typecheck if `ModHooks`
and the table disagree. The kit's own version is semantic and informational: a minor adds, a
major removes what `DEPRECATED_HOOKS` announced or changes a shape the API report shows.

## The manifest and the loader

A mod built outside the repo ships a `vxmod.json`: `parseManifest` in the host's shared entry
reads it, refusing the whole file at the first field it cannot read, and `modDefOf` turns it into
the entry `MODS` lists. Its `requires`, `optional` and `game` ranges are written in the small
subset `src/shared/range.ts` reads. The game's loader (`src/main/mods/` in core) reads every
installed manifest at start, checks its `hooks` with `checkCompat`, orders the mods by what they
require and loads them; `registerHooks` then holds each registration to its manifest through
`setDeclaredHooks`. `MODDING.md` says what the fields mean.

## Mod data

What a mod keeps, and where: `saveField` and `recordField` for its slice of a save and of a record
inside it, `writeModField` and `writeModFields` for a write at a safe point, and `modState` for
state that is never saved, all in `renderer`; `modDataPath`, `backupPart` and
`characterTransferPart` in `main`, for what is kept outside the save. `MODDING.md` says what each
one guarantees. The binders that hand them core's side, `bindSaveFieldStore`, `bindModWrites` and
`bindGameBoundary` in the host's renderer entry, are core's: the game store and the save lane call
them, and a mod never does.

## Checks

- `npm test` at the root runs `test/kit/*`: the boundary test, the compatibility check's tests
  and the contract test.
- `npm run report` here (after `npm install` here, once) regenerates `api/*.api.md` and
  `dist/*.d.ts`; `npm run report:check` fails if the committed report is out of date.
  Both commands also compile `test/consumer.ts` against those rolled-up declarations with
  strict library checking and no game-source aliases. This catches missing public types
  or fields that the game's own ambient declarations would otherwise supply.
