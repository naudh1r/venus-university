# Installing mods: the plan for step 5

Plan only, no code. Drafted 2026-11-02 and checked against `core` at `c1e857cc` (kit 0.7.0, game
0.8.0) on 2026-11-17. It is here so the pieces of step 5 can be built, by anyone, against one
description. Section 13 lists the decisions still open, each with the option I'd pick.

"The design" below is the hooks-only direction posted on the Discord in October: players install
core only, and mods come from an approved list. Its steps, for where this one sits:

1. The kit, `@vx/modkit` (on `core`).
2. Loading mods at run time from `data/mods` (on `core`).
3. Mod data in saves (on `core`).
4. The hooks each mod needs (under way, by each mod's author).
5. **Installing: this plan.**
6. Moving each mod into its own repo and release.
7. Core as the release.

What step 5 delivers, from the design: sources, the approved list's repo and format, download,
hash check, requirements, updates, removal, the Mods screen's new form, the trust warnings,
`vxmod build` and a mod template repo. To that this plan adds what the design left open: how a
change waits for the restart, how the kit package reaches authors outside the repo, a first
mod taken through the whole path, and **migration** (section 12): when a mod leaves the build,
the game offers to install the ones the player already had on.

Not in step 5: moving any real mod (step 6; section 11 names the first one to try), the core-only
installer (step 7), the approved list's repo building releases itself (the design's "possible
later step"), a hosted web build (out of scope).

## What core has today (the inputs)

- **The layout** (`src/main/mods/layout.ts`): `data/mods/<id>/<version>/` unpacked releases,
  `data/mods/<id>/current` naming the version in use, and **`data/mods/installed.json`** — the
  installer's record by id then version: `{ source, sha256, approved, installedAt }`. It is kept outside each mod's
  folder, so a mod can't vouch for itself. The loader only reads it; nothing writes it yet.
- **Unpacking** (`src/main/mods/unpack.ts`): `unpackRelease(zip, folder)` with fflate, refusing
  any entry that would land outside the folder before writing anything. Written for the tests "so
  the loader's tests lay a fixture out exactly as an install does". The installer uses it as is.
- **The manifest** (`packages/modkit/src/shared/manifest.ts`): `parseManifest(json, expect?)`,
  strict (unknown fields refused), `MANIFEST_SCHEMA = 1`, `RESERVED_MOD_IDS`, `modDefOf`. It sits in the
  kit's host shared half so the Mods screen can read a release's manifest, before downloading
  it, with the same rules.
- **Compatibility** (`compat.ts`): `checkCompat(declared)` → `loads` / `needs-update` /
  `refused`, against core's own hook table. `range.ts`: the kit's range subset (`satisfies`,
  `compareVersions`). `order.ts`: the topological sort, cycles refused.
- **The loader** (`loader.ts`): takes `builtIn` (ids of mods compiled into this build; an
  installed copy of one is refused, "already part of this build"), `allowUnreviewedMain` (main
  code from a non-approved install is `not-permitted` without it), developer folders. Statuses:
  `loaded`, `needs-update`, `refused`, `failed`, `blocked`, `not-permitted`.
- **Restart** (`session.ts`): `mods:restart` relaunches. `settings.json` holds `devModFolders`,
  `allowUnreviewedMain` (no screen yet), `modNoticesSeen`, all written by main only through
  `patchStoredSettings`.
- **Downloads** (`src/main/services/downloadService.ts`): `downloadFile` with progress, a stall
  timeout and `hashFile`; `updateService.ts` around it checks free space (three times the size),
  refuses non-https addresses and redacts URLs in errors. The game update's own pattern, reused.
- **The Mods screen** (`ModsModal.tsx`): the switches, each row saying "installed folder" or
  "developer folder", and `ModsAuthorsFold.tsx` for developer folders. `isWebBuild` hides what the
  web build can't do.
- **The kit package** (`packages/modkit/package.json`): `@vx/modkit` 0.7.0, `private: true`,
  types only in `dist/` from api-extractor. Where it is published, and under what name, was left for this step.
- **The org** has one repo, `build`. No approved-list repo, no template.

## 1. Sources

A **source** is one JSON file at an https address. Two kinds are read:

- **A list**: the approved list, or any custom list in the same format.
- **A repo**: `https://github.com/<owner>/<repo>`, read through GitHub's releases API. The easy
  path for a modder sharing one mod (design).

### The list format, `vxsource.json`

```json
{
  "source": 1,
  "name": "Venus Extracurriculars approved mods",
  "mods": [
    {
      "id": "hello-mod",
      "repo": "https://github.com/venus-extracurriculars/hello-mod",
      "releases": [
        {
          "version": "1.0.0",
          "zip": "https://github.com/venus-extracurriculars/hello-mod/releases/download/v1.0.0/hello-mod-1.0.0.zip",
          "sha256": "9f2c…",
          "size": 18234,
          "manifest": { "manifest": 1, "id": "hello-mod", "version": "1.0.0", "…": "the release's vxmod.json, whole" },
          "approved": { "by": "morrowkiln", "pr": 12, "at": "2026-11-10" }
        }
      ],
      "bundledIn": "0.7.0",
      "withdrawn": [{ "version": "0.9.0", "reason": "Deleted saves on load." }]
    }
  ]
}
```

- **The whole manifest is in the listing**, copied from the zip by the list's CI (section 7).
  So the screen shows names, blurbs, options, requirements and the compatibility verdict for
  every version without downloading a single zip, and the install checks the zip's own
  `vxmod.json` against it after download: any difference refuses the install.
- `sha256` and `size` are required in a list. `size` lets the free-space check run first and
  caps the download (a server sending more than it said is cut off).
- `approved` is only meaningful in the approved list; a custom list's is ignored.
- `withdrawn` (section 6). `bundledIn`: the last Venus Extracurriculars release that carried the
  mod in its bundle, for a moved mod only (section 12).
- `parseSource(json)` goes in the kit's host shared half beside `parseManifest`, as strict as it:
  unknown fields refused, `source` above 1 is "made for a newer game". One mod id listed twice,
  a version listed twice, or a manifest whose `id`/`version` disagree with its entry: the whole
  source is refused, with the line that says why.

### A repo source

- `GET https://api.github.com/repos/<owner>/<repo>/releases` (unauthenticated: 60 requests an
  hour per address, plenty for a screen opened by hand; answers are kept for the session).
- A release counts when it has **two assets**: `<id>-<version>.zip` and `vxmod.json`
  (`vxmod build` produces both, section 9). Its manifest is read from the asset, so a repo
  source shows the same rows as a list. Drafts and pre-releases are skipped.
- No `sha256` in a repo source: the hash is computed at download and recorded, so the install
  can be checked later, but nothing pins it in advance. The screen says so.

### Where sources are kept

- **The approved list's address is built into core**, in `src/shared/modSource.ts`, beside
  `updateSource.ts`: `https://raw.githubusercontent.com/venus-extracurriculars/mods/main/vxsource.json`.
  raw.githubusercontent.com is not the API, so no rate limit to speak of.
- Custom sources: `settings.json`'s `modSources: string[]`, written by main only (like
  `devModFolders`), added and removed on the screen (section 8).
- In development only (`!app.isPackaged`), `VU_MOD_SOURCE` replaces the approved address, as
  `VU_DATA_PATH` does for the data folder, so the Electron test can serve a list from a temp
  folder (section 10).
- All fetching is in main, https only (the dev override may also be `file:`), with a size cap on
  the source itself (2 MB) and a timeout. The renderer never fetches a source.

## 2. One install, start to end

The design's four steps, with what each does on disk. One operation at a time; main queues them.

1. **Pick.** The player picks a mod and a version (the newest that loads on this core is
   preselected). The screen already knows, from the listed manifest:
   - `checkCompat` against core's hook table: a missing hook names itself, and the version can't
     be installed (design).
   - `game`: a mismatch is a warning on the row, never a refusal.
   - `main: true` from a non-approved source with `allowUnreviewedMain` off: Install is disabled
     and says why (design).
   - The requirements, resolved (section 4): what else will be installed or updated with it.
   - `builtIn`: a mod already part of this build has no Install button ("part of this build").
2. **Download** each zip of the plan to `data/mods/.staging/<id>-<version>.zip`: free space
   first (three times the sizes, as the game update does), then `downloadFile` with the listed
   `size` as the cap, then `hashFile`.
   - A list source's `sha256` must match, or the file is deleted and the install stops: "the file
     is not the one that was reviewed".
   - The zip's `vxmod.json` is read in memory (fflate) and must equal the listed manifest
     (deep equality) and pass `parseManifest` with the listed id and version.
3. **Unpack** each into `data/mods/<id>/<version>.partial/` with `unpackRelease`, then rename it
   to `<version>/`. A crash leaves a `.partial` folder, which the loader's layout already
   ignores ("ignored folder") and the next start deletes (section 3).
4. **Record**: the entry in `installed.json` (source address, sha256 as computed, `approved` =
   came from the approved list with a matching pinned hash, `installedAt`), and the new version
   into `data/mods/pending.json` (section 3). Then the screen says **Restart to apply**.

Nothing about the running session changes until the restart: the loaded mods keep their folders,
and nothing is deleted while the game may be reading it.

If any zip of a multi-mod plan fails, the ones already unpacked stay unpacked but none is made
current: the plan is all or nothing at the point that matters, the restart.

## 3. Pending changes, applied at start

`current` can't be written at install time: a developer-folder reload reruns the whole loader
mid-session, and would pick up the new version under the old `main.js`. And
a folder can't be deleted while the session serves it (on Windows a loaded `.node` addon can't
be deleted at all). So every change waits in one file:

```json
{ "pending": 1, "current": { "hello-mod": "1.1.0" }, "remove": ["old-mod"] }
```

At start, in main, **before the loader** (`applyPending(modsDir)` in a new
`src/main/mods/pending.ts`):

1. For each `current` entry whose version folder exists: write `data/mods/<id>/current`.
2. For each `remove` id: delete `data/mods/<id>/` and its `installed.json` entries.
3. Delete `.partial` folders and `.staging/`.
4. Delete `pending.json` last. Each step is safe to repeat, so a crash midway redoes it at the
   next start.

**Old versions** are removed one start later: after a start in which the new version loaded
(status `loaded`), its other version folders go on the next `pending.json`'s cleanup. If it
failed instead, the old folder is still there and the row offers "Go back to 1.0.0" (writes
`current` back through `pending.json`). That is the rule the loader was built to: an old version is
removed by the installer after the new one has started once.

`--no-mods` and the Shift safe start still apply pending changes: a removal is the way out of a
mod that hangs, so it must not need the mod to load.

## 4. Requirements

The design: missing requirements are offered with the mod, "the whole dependency graph,
resolved to one installed version per id". The resolver (`resolveInstall` in the kit's host
shared half, pure, so the screen and main use the same one):

- **Input**: what is installed (id → version, with its `requires`/`optional`), the mods built into
  the build, the request (id → version), and every listed release of every source.
- **For each required id**, in order of discovery:
  1. Built into this build and in range: nothing to do.
  2. Installed and in range of every dependent: kept.
  3. Otherwise the highest version from **the same source** that satisfies every range on it and
     loads on this core (`checkCompat`). An installed one is then updated, and that update is
     shown as part of the plan ("also updates Mini-games 1.2.0 → 1.3.0").
  4. None: refused, naming the two ranges that can't both be met, or "Mini-games isn't in this
     source".
- **Greedy, no backtracking.** It picks the highest fitting version and does not go back to try
  lower versions of earlier picks. With a handful of libraries that is enough, and its refusals
  are easy to explain. Revisit if a real graph needs more.
- **An approved mod's requirements must all be on the approved list**; the list's CI checks it
  (section 7), so an approved mod never pulls in an unreviewed one.
- `optional`: never installed with a mod, only respected if present (out of range = treated as
  absent, as the loader does).
- Cycles: refused by `orderMods`, as at load.

**Removing**: refused while another installed mod requires it, naming that mod (design). A
library left required by nothing is offered for removal with the last mod that needed it
("also remove Lightbox, which nothing else uses"), ticked by default.

## 5. Updates

- **Offered, never applied** (design).
- The check reads every source and compares with `installed.json`. An update is the highest
  listed version that loads on this core; a newer one that doesn't is shown greyed with its
  missing hook, so the player knows why it isn't offered.
- **When**: whenever the Mods screen opens, and once a day at start in the background (as the
  game's own update check runs), which only marks the Mods button with a count. No network call
  delays the first screen.
- **A mod marked `needs-update` by the loader** (core dropped a hook it uses) gets its update
  offered on its row first, if one loads.
- "Update all" applies every offered update as one plan through the resolver.

## 6. Trust

The design's rules, with the screens they need:

- **Approved** = installed from the approved list with its pinned hash. Its `main.js` runs.
- **A custom source is added with a warning** naming its address: "Mods from this source are not
  reviewed by Venus Extracurriculars. Install only from people you trust." Its mods are listed
  apart, under the source's name, marked "not reviewed".
- **Installing from a custom source** shows the warning again, naming the mod and the source.
- **`allowUnreviewedMain` gets its screen**: a switch in the Mods screen's sources section, off by
  default. Turning it on opens the large warning ("can read your files and your API key, and do
  anything your account can"), with a tick box the player must tick before **Turn on** is
  enabled. Turning it off switches off those mods at the next start; the loader already does
  this (`not-permitted`).
- **Withdrawn releases.** The approved list can withdraw a release (a bug that eats saves,
  something worse). At the update check, an installed withdrawn version is flagged on its row
  with the reason, and its `approved` flag in `installed.json` is cleared, so its `main.js` stops
  running at the next start unless the player allows unreviewed main code. An update is offered
  if there is one. Nothing is deleted. (Decision 6.)
- **A repo source** has no pinned hash; installing from one is a custom-source install.

## 7. The approved list's repo

`venus-extracurriculars/mods`, public:

```
vxsource.json            the list (section 1)
REVIEWING.md             what a reviewer checks, below
.github/workflows/
  check.yml              on every PR
scripts/check.mjs
```

**Adding a mod or a release is a PR** that adds an entry with `version`, `zip` and nothing else.
`check.mjs` (run by the workflow, and by hand) fills in the rest and checks it:

- downloads the zip, computes `sha256` and `size`, reads its `vxmod.json`, and writes those into
  the entry (the PR author commits the result, or the workflow pushes it to the PR branch);
- `parseManifest` and `parseSource` from the kit (the workflow checks out `build`'s `core` for
  them, so the list's rules are core's);
- the manifest's `id` and `version` match the entry, `source` matches `repo`;
- every `requires` id is on the list with a version in range;
- the repo is public and its licence is AGPL (GitHub's licence API);
- the release's tag points at a commit on the repo's default branch.

**REVIEWING.md** is the human part: read the source at the tag; `main.js` reviewed line by line if
there is one; for a first release of a moved mod, its `normalize` migrates its legacy `ex*` field
and an old Venus Extracurriculars save has been opened on it (design), and it keeps the
`defaultOn` it had in the bundle (section 12); new mods ship
switched off (`defaultOn: false`); no network calls the blurb doesn't mention. Approval is one
review from an org member who is not the mod's author.

Merging the PR is the approval: the entry's `approved` block is filled at merge from the PR.

## 8. The Mods screen's new form

One modal, as now, in three tabs (the game's `TitleTab`):

- **Installed** — today's list: switches, options, statuses, plus per row: version, source
  ("approved", "from <source>", "developer folder", "part of this build"), **Update to x.y.z**,
  **Remove**, and for a failed update **Go back to x.y.z**. Libraries are not rows of their own;
  a mod's row lists the libraries it uses.
- **Browse** — every source's mods not yet installed: approved first, then each custom source
  under its name with "not reviewed". Each row: name, author, blurb, version, what it requires,
  **Install** (or why not). A version picker for older versions. Libraries hidden.
- **Sources** — the approved list (fixed, shown for its address and last check), custom sources
  with add/remove, the unreviewed-main switch, and the existing "For mod authors" fold.

A **Restart to apply** bar appears at the top of every tab while `pending.json` holds anything,
listing the changes ("Install Hello mod 1.0.0, remove Old mod"), with **Restart** and **Undo**
(empties `pending.json` and the staged folders). Restarting from inside a game asks first, like
the developer-folder reload: a running game is never ended unasked.

Off the screen: the saved-game notice "needs a mod which is not installed" (design) gains
**Install** when a source lists that mod.

The web build shows Installed only (it has no `data/mods`), as it does today.

Following the UI style guide (`UI_STYLE_GUIDE.md`) and `vu-*` primitives; one design pass with
screenshots before the PR, as for the slots.

## 9. `vxmod build`, and the kit package

### The package

Authors outside the repo need `@vx/modkit` from a registry. Today it's `private: true` and types
only. Step 5 makes it publishable:

- **Name**: the import name stays `@vx/modkit` (it's what the import map, the boundary test and
  every mod's source use). Where it's published is the decision (decision 1): `@vx` on npmjs if
  free, else `@venus-extracurriculars/modkit` installed under an alias
  (`"@vx/modkit": "npm:@venus-extracurriculars/modkit@^0.7.0"`), which the template sets up.
- **What it holds**: the rolled-up `.d.ts` files (as now), the `vxmod` command, and a `test`
  entry with stand-ins for the kit's run-time functions so a mod's unit tests run in vitest
  without the game.
- **Workspaces**: `"workspaces": ["packages/*"]` in the root `package.json` was deferred to
  this step, when `vxmod build` brings dependencies of its own. It brings `esbuild` (already
  in the tree under electron-vite, but a published package must declare it). Adding workspaces
  edits two Venus Dev files (`package.json`, `package-lock.json`), a conflict on most syncs; the
  alternative is the kit's own `package-lock.json` inside `packages/modkit`, published from there
  with `npm publish ./packages/modkit`. I recommend the latter: no Venus Dev file changes
  (decision 2).
- **Released with core**: the kit's version is already bumped with each core change (0.7.0); a
  publish follows each core release, by `scripts/publish-kit.mjs` run from `build`, never by hand
  edits to the package.

### The command

```
npx vxmod build            → dist/  (an unzipped release; add it as a developer folder)
npx vxmod build --watch    → the same, rebuilt on change; the game reloads it
npx vxmod pack             → release/<id>-<version>.zip, release/vxmod.json, and the sha256
npx vxmod check <folder|zip>   the loader's checks without the game: manifest, files, hooks
```

What `build` does:

1. **Reads `src/mod.ts`** (the `ModDef`: id, name, blurb, scope, defaultOn, offNote, options,
   optionGroups, requires, optional, library, exports) by bundling it with esbuild to a temporary
   module and importing it. `package.json` gives `version`, `author`, `repository` (→ `source`).
2. **Bundles `src/renderer.ts`** → `renderer.js`, one ES module. External: `react`,
   `react/jsx-runtime`, `react-dom/client`, `motion/react`, `@vx/modkit/shared`,
   `@vx/modkit/renderer`. A required library is imported in source as `vxmod:<id>` and rewritten
   to `vxmod://<id>/renderer.js`. Any other bare import is bundled in.
3. **Bundles `src/main.ts`** → `main.js`, CommonJS. External: `@vx/modkit/main` and Node
   built-ins; `electron` is refused (main reaches Electron only through the kit).
4. **Writes `hooks`**, never by hand:
   - kit APIs: the named imports from `@vx/modkit/*` in the bundled output, read with
     `es-module-lexer` (renderer) and esbuild's metafile plus a parse of the `require` calls
     (main), as `side:name`;
   - hooks: by importing the built `renderer.js` in Node with a stand-in kit whose
     `registerHooks` records the keys (`hookNamesOf`, which exists). A mod whose top level does
     more than register hooks (touches `window`, say) fails this step with a message saying so;
   - library exports: `<lib>:<name>` from the `vxmod:<id>` imports.
   Then runs `checkCompat` against the kit's own hook table, so an unknown hook fails the build,
   not the player's game.
5. **Copies** `assets/` and `src/style.css` if present, writes `vxmod.json` with `"manifest": 1`
   and `kit` from the installed kit's version, and runs `parseManifest` on it.
6. Fails on an import of a mod not in `requires`/`optional`, and on a mod id in `RESERVED_MOD_IDS`.

`vxmod build` is the one way a manifest is made, so "the build and the manifest disagree" (which the loader refuses) only happens when someone edits the output.

### The template repo

`venus-extracurriculars/mod-template`, a GitHub template repository:

```
package.json          @vx/modkit as a dev dependency, "build"/"pack"/"test" scripts
tsconfig.json
src/mod.ts            a ModDef with every field commented
src/renderer.ts       registerHooks with one settings section
src/main.ts.example   renamed to main.ts to have one
test/mod.test.ts      against the kit's test stand-ins
LICENSE               AGPL-3.0
README.md             build, try in the game (developer folder), release, get on the list
.github/workflows/release.yml   on a v* tag: build, pack, attach the zip and vxmod.json to the release
```

The release workflow is what makes a repo source work (two assets per release) and what the
approved list's CI expects.

## 10. Tests

### In vitest (core's `npm test`)

- `parseSource`: the format's rules, one test per refusal.
- `resolveInstall`: installed and in range kept; update pulled in; two ranges unmet; built-in
  satisfies; requirement missing from the source; optional never installed; cycle refused;
  removal refused while required; orphaned library offered for removal.
- The install transaction, with an injected `fetch` and a temp `data/mods`: hash mismatch deletes
  and stops; listed manifest ≠ zip manifest refuses; oversize download cut off; free space short
  refuses before download; a failure in the second zip of a plan leaves the first unpacked and
  nothing pending; `installed.json` written only after unpack.
- `applyPending`: each step; a crash after each step (simulated by stopping there) then a second
  run gives the same disk; `--no-mods` still applies; old version cleanup only after a `loaded`
  start.
- Repo source: releases with and without the two assets; drafts skipped.
- Withdrawn: approved flag cleared, nothing deleted.
- The trust rules: Install disabled for unreviewed `main: true` with the setting off.
- Migration: `known.json` written with default-on mods marked on; missing = known on − built in −
  installed; a playthrough's mod listed though switched off; `ex` ids listed unticked; the
  fallback without `known.json`; dismissals never offered again; an unlisted mod has no button and
  joins once listed.

### In the kit (`packages/modkit`)

- `vxmod build` on fixture mods (renderer only; renderer + main; a library and its dependent;
  one that touches `window` at top level; one importing an undeclared mod; one using a hook core
  doesn't have; one registering `prompts.*` and `requests.*` hooks and a screen slot; one whose
  `main.js` reads names off the kit; one with an empty `requires`): the manifest written, or the error.
- The output of `vxmod build` on `test/fixtures/mods/hello-mod`'s source loads in the loader's
  existing Node tests (closes the loop between the two).

### In Electron, by hand for the PR (as the loader's)

`VU_DATA_PATH` and `VU_MOD_SOURCE` pointed at temp folders with a list holding hello-mod 1.0.0
and 1.1.0 and a library: install 1.0.0 with its library → restart → loaded; update to 1.1.0 →
restart → loaded, 1.0.0 still on disk → restart → 1.0.0 gone; remove → restart → gone, its
`modDataPath` folder still there. Then migration: start with hello-mod built in (the loader's
`builtIn` input) and on by default, then without it and with it listed: the offer appears with
it ticked; bring it across → restart → loaded, with the options it had.

### On a real install

The real path once: the approved list repo with hello-mod on it, installed into an official copy
of the game with the release installer's build, then uninstalled with `Uninstall.cmd`, which
must leave `data\mods` alone (the player's installs, like their saves). `patch.mjs` says it
leaves `data` untouched; the trial confirms it with mods in there. Then the migration for real:
install the previous release, play with the packs on, uninstall, install the new one, take the
offer.

## 11. The order of work

Each a PR into `core` on its own `hooks/<name>` branch unless said otherwise; each leaves the game
working.

0. **`hooks/mods-known`**, first and on its own: `data/mods/known.json` written at each start
   (section 12). Tiny, and it must be in a Venus Extracurriculars release before any mod moves
   out, so it goes out in the next one whatever else is ready.
1. **`hooks/mod-sources`**: `parseSource`, `resolveInstall` (kit host shared), `modSource.ts`, the
   source fetching in main with `VU_MOD_SOURCE`, `modSources` in settings. Tests. No screen.
2. **`hooks/mod-install`**: the transaction, `installed.json` writes, `pending.json` and
   `applyPending`, the IPC (`mods:sources`, `mods:plan`, `mods:install`, `mods:remove`,
   `mods:undoPending`, progress events). Tests.
3. **`hooks/mods-screen`**: the three tabs, the restart bar, the trust warnings, the saved-game
   notice's Install. Screenshots in the PR.
3b. **`hooks/mods-migrate`**: the missing list, the "Bring your mods across" offer, the Installed
   banner, dismissals (section 12). Needs 0–3.
4. **The kit package and `vxmod`** (`hooks/vxmod-build`): the command, the test stand-ins, the
   publish script; then the first publish (needs decision 1 settled and an npm login for the
   org).
5. **The two repos**, outside `build`: `mods` (empty list, CI, REVIEWING.md) and `mod-template`.
   `hello-mod` made from the template as the list's first entry, which proves the whole path.
6. **core → main** integrate, as usual. On `main`, the built-in mods stay built in; the Browse
   tab hides installs of their ids.
7. **The first real move-out (step 6)**: the [MK] packs — morrowkiln's own, already hooks-only by
   the audit, and they require Mini-games, so they prove a requirement on a mod built into
   `main`. They leave `main`'s bundle in the same release that puts them on the approved list,
   and an old save that had them on opens with them installed. The migration offer is tested
   here for real: a player with the packs on updates, is offered them, and plays on.

1–3 can be reviewed while 4 is built; 5 needs 4; 7 needs all of it, 3b included. 0 ships first.

## 12. Migration: bringing across the mods a player already has on

A player's mods stop being part of the build at two moments:

- **Each move-out (step 6).** A Venus Extracurriculars release drops a mod from `main`'s bundle in
  the same release that puts it on the approved list.
- **The switch to core (step 7).** The player uninstalls Venus Extracurriculars and installs core:
  every mod leaves the bundle at once.

Without help the mod just vanishes. Its switch stays in `mods.json` and its data stays in the
saves, but nothing runs until the player finds it on Browse. A save whose playthrough started with
it opens with "needs a mod which is not installed". The plan is that the game notices and offers
to bring those mods across in one go.

### What "had on" means, and why core must write it down

`mods.json` can't answer it alone: it holds only the switches the player changed
(`switches.on[id] ?? mod.defaultOn`). A default-on mod nobody touched has no entry, and once it's
gone from the build its `defaultOn` is gone too. So core keeps its own record:

- **`data/mods/known.json`**, written by main at every start once the session table is settled:
  for each mod in this build, built in or installed, its `id`, `version`, `scope`, `defaultOn`,
  whether its switch was on (`switchedOn`, ignoring playthroughs), and whether it was built in.
  Written atomically, outside `settings.json` (it's a record, not a setting) and outside every mod's
  folder.
- **It has to ship before anything moves out**, or there is nothing to compare with when the
  first mod leaves. So it's the first PR of step 5 (section 11), small, and it goes out in the
  next Venus Extracurriculars release whatever else is ready.
- `data\` survives the release uninstaller (`installer/patch.mjs`: the player's `data` folder
  stays exactly as it is), so the record is still there when core is installed in its place.

### Who is missing

At start, after the loader, main works out **missing** = mods `known.json` says were on − built
in now − installed now. Each comes with why it's wanted:

- **switched on** in the last build (or on by default and never switched off);
- **used by a playthrough**: the ids in every playthrough record's `mods` (`PlaythroughRecord.mods`
  and `modVersions`), which matter even for a mod since switched off globally, because a
  `playthrough` mod is fixed for that game;
- **has data in a save**: ids in the saves' `ex` slices. Shown, not ticked: data alone doesn't
  mean the player wants it back.

**Without a `known.json`** (a player coming from a release older than the record, or one who lost
`data\mods`), the same comes from what's left: `mods.json`'s explicit `on: true`, the playthrough
records, the `ex` ids. A default-on mod the player never touched can't be told apart from one they
never used. Those are listed unticked under "Also part of Venus Extracurriculars" when the
approved list marks them `bundledIn` (a field naming the VE release that last carried the mod,
added to the list format for this).

### The offer

- **Once, after boot, never inside a game**: a modal "Bring your mods across" listing each
  missing mod with its reason, ticked when it was switched on or a playthrough uses it, at the
  newest approved version that loads on this core, with its requirements resolved (section 4) and
  shown. **Bring them across** runs one install plan, then the restart bar.
- **Not now** closes it. The Installed tab keeps a banner with the same list until it's dealt with.
  It isn't shown again at every start.
- **Leave it out**, per mod: remembered in `known.json` as dismissed, never offered again. It
  can still be installed from Browse.
- **Not on the approved list yet** (the author hasn't moved it, or the list hasn't approved it):
  shown as "not available yet, your data is kept", with no button. When the update check later
  finds it listed, it joins the offer.
- **Offline, or the list unreachable**: nothing is shown; the next start tries again.
- **Never silent.** Downloading and running code is the player's choice, so even a mod that was
  on is installed only when they say so ("offered, never applied", as updates).

### What carries over with it

- **Switches and options**: mod ids don't change (design), so `mods.json`'s entries apply
  to the installed mod as they did to the built-in one. A never-touched default-on mod stays on
  only if the moved release keeps `defaultOn: true`. The approved list's review checks that a
  moved mod's first release keeps its old `defaultOn` (standing decision: existing mods keep their
  defaults), alongside the legacy-field migration it already checks.
- **Save data**: the mod's `normalize` migrates it; nothing extra here.
- **Versions**: if a playthrough record names a version newer than the newest approved one, the
  design's "made with a newer version" warning applies when that save is loaded.

### The rule for move-out PRs

A PR on `main` that removes a mod from the bundle merges only after the mod's approved-list entry
has merged, and the release notes say "the game will offer to bring X across". Otherwise a
release could drop a mod with nothing to install in its place.

## 13. Open decisions, and what to prove first

### Open decisions

Each has the option I'd pick. Say so on the PR if you'd pick another.

1. **Where the kit is published.** `@vx` on npmjs (check it's free; claim it for the org), or
   `@venus-extracurriculars/modkit` with the template using an npm alias so source still imports
   `@vx/modkit`. I recommend `@vx` if free, the alias if not. GitHub Packages is out: it needs a
   token even to install.
2. **Workspaces or the kit's own lockfile.** I recommend the kit's own `package-lock.json` in
   `packages/modkit` and no change to the root `package.json` (a Venus Dev file).
3. **The whole manifest in the list**, copied by CI, so the screen needs no download to decide
   anything. The alternative is reading `vxmod.json` from each release as the design wrote it
   (one request per mod per screen open). I recommend the copy.
4. **Repo sources need `vxmod.json` as a second release asset.** OK? Without it the zip must be
   downloaded before the player can be told whether it loads.
5. **Changes wait in `pending.json` and apply at start**, including removal, rather than writing
   `current` and deleting folders at once. I recommend it (the dev-reload and Windows reasons in
   section 3).
6. **Withdrawn releases**: clear `approved` (so `main.js` stops at the next start) and flag the
   row, or switch the mod off entirely, or only flag it? I recommend clearing `approved` and
   flagging: renderer code keeps running, which matches how a custom-source mod is treated.
7. **The update check at start**: once a day, background, a count on the Mods button. Or only
   when the screen opens. I recommend once a day.
8. **Greedy resolution** without backtracking. OK for now?
9. **Approved list approval**: one review from an org member who is not the author, merge =
   approval. Or two reviews for a mod with `main.js`? I'd require two for `main.js`.
10. **The first move-out**: the [MK] packs (yours, hooks-only, exercise a requirement). The
    alternative is Emoji Extended (naudh1r's, hooks-only, no requirement), which needs him.
11. **The list's name and address**: repo `venus-extracurriculars/mods`, file `vxsource.json`.
12. **Who approves a mod while the list is new**: any org member, or morrowkiln alone for the
    first few, so the review bar is set once?
13. **`known.json` ships first**, in the next Venus Extracurriculars release, before the rest of
    step 5 is ready. OK?
14. **What the migration offer ticks**: mods switched on (default-on counted) and mods a
    playthrough uses. Mods with only save data are listed unticked. OK?
15. **Players with no `known.json`**: the fallback (explicit switches, playthrough records, `ex`
    ids, plus unticked `bundledIn` mods). Or simply tick every `bundledIn` mod for them?
16. **The move-out merge rule**: a mod leaves `main`'s bundle only after its approved-list entry
    has merged. OK?
17. **Covers and screenshots in the list**: an optional `cover` and up to eight `screenshots`
    on a mod's entry, shown on its page in Browse, fetched by main and size-capped like the
    source itself. Section 1's format doesn't have them yet. I'd add them.

### Unsure, to prove first

- **GitHub release downloads** redirect from github.com to objects.githubusercontent.com with a
  signed URL. `downloadFile` follows redirects for itch.io; check it does the same here, https
  throughout, and that `redactUrl` hides the signature in errors.
- **Importing a built `renderer.js` in Node** to collect the hooks: React components defined at
  top level are fine, but a bundled dependency that reads `window` or `document` at import breaks
  it. Try it on the mods with the largest bundles on `main` (Echo, Photo Feature) before relying
  on it; the fallback is a static read of the `registerHooks` call's object keys.
- **Rate limits** for repo sources when several are added: 60 an hour per address, shared with
  anything else on the player's network calling the API unauthenticated.
- **Antivirus** on downloaded `main.js` files and `.node` addons in `data\mods`: the installer
  principle says never ask for exclusions; check Defender's reaction to one with a native addon
  (Echo's ONNX) before Echo moves.
- **The game update** (itch.io) replaces the build and leaves `data\`, so installed mods survive
  it but nothing loads them until the player reinstalls the build. #240's update warning says the
  build's mods go; with installed mods it should also say they come back with the build. A small
  text change once step 5 ships.
- **Photo Feature's main code imports `electron`** (`src/main/photoIpc.ts` on `main`) to report a
  job's progress to the window. `vxmod build` refuses `electron` (section 9), so the kit needs a main-side call
  for a job's progress before Photo can be built this way.
