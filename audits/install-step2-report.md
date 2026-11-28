# Install plan step 2

`hooks/mod-install` starts at the fork's `hooks/mod-sources` tip
`9839a0cfc22d9c3a26ef82c5ec4af3e39f4b479f`. Its changes depend on #363. The source branch
should be reviewed first, and later source-branch changes should be merged into this branch.
[Install plan #335](https://github.com/venus-extracurriculars/build/pull/335) · [Step 1 #363](https://github.com/venus-extracurriculars/build/pull/363)

| Commit | Subject |
| --- | --- |
| `12fecc77` | core: stage mod installs and removals for restart |
| `6b350828` | core: await safe-start fixture metadata before teardown |

The implementation commits use the requested author and have no co-author trailers. No signing
key was available.

## Implementation

| Plan | Files and behavior |
| --- | --- |
| §2, validate and download | `src/main/mods/installer.ts` recomputes a renderer plan against the effective installed graph and the current main-owned source listings. `install.ts` checks built-ins, hooks and unreviewed main code, then checks for three times the listed size in free space before downloading. `downloadService.ts` validates each HTTPS redirect and stops writes at the listed byte cap. Errors report the redacted original URL. |
| §2, verify and stage | `install.ts` hashes the staged zip and matches any pin. `unpack.ts` reads the root manifest into memory, then the installer requires exact equality and validates the ID and version. Unpacking uses a partial directory and a rename. A complete plan writes `installed.json` atomically and adds its activation entries to `pending.json` in one write. |
| §3, restart and recovery | `pending.ts` replays current pointers, removals and cleanup before the loader. It deletes the journal last and leaves unsupported versions in place. `layout.ts` ignores newly staged releases until replay, even on a developer-folder reload and when no current pointer exists. A failed batch can leave staged files on disk while the previously active versions remain selected. |
| §3, old versions and rollback | Main schedules cleanup only after normal renderer mod boot has settled and the active managed version reports `loaded`. The next startup checks that version is still current before deleting older releases and their records. The main-side `rollbackMod(id, version)` queues a previous folder and cancels its cleanup. |
| §4, removal | The installer uses `resolveRemoval` against the prospective graph. It refuses required IDs, built-ins and developer folders, and validates the selected orphan set. Removal and undo change the journal during the session. Startup removes the install folders and records, while mod data, save slices and switch settings live at their own paths. |
| §6, decision 6 | Approval is set only for releases from the designated approved list with a verified pinned hash. Repo installs record the computed hash with approval off. An approved-source withdrawal clears the record's approval when main reads the list. It preserves the release files and source metadata for the later screen and update work. |
| §11, desktop bridge | `session.ts`, the preload and `shared/modInstall.ts` carry sources, planning, installs, removal, per-ID undo and per-zip progress. An internal boot acknowledgement schedules old-release cleanup after normal renderer load. The web bridge answers desktop-only for installer calls. |
| §10, coverage | `test/mods/installTransaction.test.ts` exercises the transaction, source trust, redirects, replay interruptions, rollback, removal, undo and withdrawals with temporary data. `test/modsServiceRules.test.ts` exercises pending removal before a `--no-mods` loader run. |

## Implementation choices and open points

- The pending schema adds an optional `cleanup` map keyed by ID, with the version to keep and the
  older folders to remove. The on-disk inactive marker distinguishes verified but unapplied
  releases from legacy installs that relied on the loader's version fallback.
- Main publishes the whole batch's install records only after all releases unpack. A crash
  between the records write and the journal write can leave an inactive release and its
  verified record. It remains inactive and can be restaged on retry.
- The downloader caps compressed bytes at the listing's size. Releases also use the app's
  archive caps and a 2 MiB manifest cap before parsing.
- Per-ID undo checks other pending dependency changes before it writes. A coupled update that
  cannot be undone one ID at a time still needs the batch Undo interaction described for step 3.
- Withdrawals are applied when main reads sources. Periodic update checks and the withdrawn
  row's presentation belong to the later update and screen work.

## Changes against step 1

| File | Added | Removed |
| --- | ---: | ---: |
| `DESIGN_GUIDE.md` | 1 | 1 |
| `MODDING.md` | 9 | 1 |
| `src/main/index.ts` | 2 | 4 |
| `src/main/mods/install.ts` | 204 | 0 |
| `src/main/mods/installFiles.ts` | 71 | 0 |
| `src/main/mods/installer.ts` | 242 | 0 |
| `src/main/mods/layout.ts` | 24 | 9 |
| `src/main/mods/pending.ts` | 183 | 0 |
| `src/main/mods/session.ts` | 64 | 24 |
| `src/main/mods/sources.ts` | 1 | 17 |
| `src/main/mods/unpack.ts` | 35 | 1 |
| `src/main/services/downloadService.ts` | 56 | 15 |
| `src/preload/api.d.ts` | 9 | 0 |
| `src/preload/index.ts` | 12 | 0 |
| `src/renderer/mods/index.ts` | 2 | 0 |
| `src/shared/modInstall.ts` | 45 | 0 |
| `src/web/bridge.ts` | 7 | 0 |
| `test/mods/devFolderReload.test.ts` | 1 | 1 |
| `test/mods/installTransaction.test.ts` | 336 | 0 |
| `test/modsServiceRules.test.ts` | 21 | 2 |

Total against step 1 is 20 files, 1,325 insertions and 75 deletions.

## Checks

| Check | Result |
| --- | --- |
| Root `npm ci` | Passed. Installed 434 packages from the lockfile. |
| `npm run typecheck` | Passed for Node, web and test. |
| Kit `npm run report:check` | Passed. The public API report is current. |
| Focused transaction, layout, loader and safe-start tests | 57 passed across 5 files. |
| `npm test` on the final tip | 2,959 passed, 4 skipped and 1 failed. Across 225 files, 221 passed, 3 skipped and 1 failed. |
| `npm run build` | Passed for desktop main, preload and renderer. |
| `npm run build:web` | Passed. |
| Electron IPC smoke test | Passed. Install, update, next-start cleanup and removal across five launches. |
| Live GitHub release redirect | Passed. Both hops used HTTPS. |
| `git diff --check` | Passed. |

The Linux archive helper was made executable after dependency installation. The locked Electron
binary was verified against its package checksum. The initial full run also found a teardown race
in the new safe-start test. The isolated run reproduced it, and the test now waits for the
background `known.json` write before teardown. The sole final failure was the known Linux
ComfyUI output-path test at `test/mainServices.test.ts:188`. It expected
`COMFY_OUTPUT_PATH_INVALID` and received no thrown error.

## Electron and live redirect checks

Ran `node /tmp/venus-step2-local/electron-install.mjs` against the desktop build. This
Playwright script launched Electron 43.7.0 under Xvfb on display `:93` and set
`VU_DATA_PATH` to a temporary data directory and `VU_MOD_SOURCE` to a temporary `file:`
list. The list pointed to locally generated zips for the checked-in `hello-mod` and `lib`
fixtures. A loopback HTTPS server redirected the zip requests to another HTTPS path.
Electron trusted the test certificate through `NODE_EXTRA_CA_CERTS`.

The script called `window.api.mods.sources()`, `plan()` and `install()` and subscribed to
`onInstallProgress()`. It waited for the recorded events before unsubscribing, then closed
and relaunched Electron against the same temp data between steps.

1. Installed `hello-mod` 1.0.0 and its library in one plan. The two releases reported
   `recorded` and the mod’s activation pointer was absent before shutdown. Both reported `loaded` after
   relaunch, and the fixture's `vxmod://hello-mod/@/ping` route answered `ok`.
2. Installed 1.1.0. The next launch loaded 1.1.0 with 1.0.0 still on disk. The following
   launch had deleted 1.0.0.
3. Planned removal and included the offered library. The folders remained until restart.
   The next launch had neither mod and still had the sentinel file in `mod-data/hello-mod`.

Ran `NODE_USE_ENV_PROXY=1 node /tmp/venus-step2-local/github-download.mjs`. The script
bundled the actual `downloadFile` implementation and downloaded the
public Electron 43.7.0 `SHASUMS256.txt` release asset. It recorded only host, protocol and
status for each request. The chain was HTTPS to `github.com` (302) and HTTPS to
`release-assets.githubusercontent.com` (200), with 7,610 bytes received. The injected
redirect failure test verifies that the error shows the redacted original address.

## Draft PR description

**Title**  core: stage mod installs and removals for restart

**Branches**  `naudh1r:hooks/mod-install` into `venus-extracurriculars:core`

This is install plan §11 step 2. It depends on #363 and should be reviewed after that change.
[Install plan #335](https://github.com/venus-extracurriculars/build/pull/335) · [Step 1 #363](https://github.com/venus-extracurriculars/build/pull/363)

Main resolves installs and updates, checks compatibility and source trust, verifies the zip's
size, hash and manifest, then writes the install records and stages activation for restart
(§2 and §6). Under §3 and decision 5, startup replays `pending.json` before loading mods.
Old versions are kept until the new version has loaded, with a main-side rollback path.
Required mods cannot be removed and orphaned libraries can be included (§4). Under decision 6,
an approved-list withdrawal clears recorded approval and keeps the files.

Desktop IPC exposes source results, planning, installs, removal, undo and per-release progress.
Install, update, cleanup and removal passed in the built Electron app. The Mods screen
belongs to step 3.
