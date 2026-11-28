# Installed mod uninstall

Code commit `02568238c2f9c4f22fb40c60b60682915e5d8d07` on the fork’s `naudh1r-core`, based on `03470e0e63ea0def522073bdcb0ec00899845342`. The report is a separate commit on `notes/standalone-mods`. Both use Naudh1r <102735014+naudh1r@users.noreply.github.com>. Commit signing was attempted. This environment had no configured signing key or SSH agent, and GPG could not create its home directory.

| Change | Where |
| --- | --- |
| Browse shows Uninstall on an installed release’s page. Pending removal disables Install and Update for that id. | `src/renderer/views/ModsBrowse.tsx:179` |
| Installed shows Uninstall in the detail or directly on rows without a switch. Pending rows keep their restart status across tab changes and when the dialog reopens. | `src/renderer/views/ModsModal.tsx:200`, `:230`, `:349`, `:402` |
| Both tabs use the game’s normal confirmation and share the existing restart offer and `mods:restart` call. | `src/renderer/views/ModsModal.tsx:559`, `src/renderer/views/ModsRestartOffer.tsx:4` |
| Main publishes removal eligibility and the names of installed mods whose current manifests require the release. After confirmation it validates the id and queues it atomically. Built-in ids and developer folders are excluded. | `src/main/mods/catalog.ts:231`, `:254`, `src/main/mods/session.ts:212` |
| The preload and typed API expose `removalStatus` and `uninstall`. The web bridge returns its desktop-only refusal. | `src/preload/index.ts`, `src/preload/api.d.ts:117`, `src/shared/modCatalog.ts:32`, `src/web/bridge.ts` |
| Startup finishes queued removals before reading installed releases. The loader excludes an installed folder still waiting on cleanup. The current process has its original session table when a removal is queued. | `src/main/mods/removal.ts:66`, `src/main/mods/session.ts:74`, `src/main/mods/layout.ts:151`, `src/main/mods/loader.ts:194` |
| The modding docs describe what uninstall removes and which records remain. | `MODDING.md:221` |

## Player text

- Title template `Uninstall {Mod name}?`
- Body `Its files are removed after a restart. What it saved in your games stays, and comes back if you install it again.`
- Dependency paragraph, when needed, `These mods require it and will stop loading: {mod names}.`
- Buttons `Cancel` and `Uninstall`
- Pending status `Will be removed on restart.`
- Restart affordance `Restart…`. The existing offer says `Save any game in progress before restarting.` and has `Later` and `Restart now` buttons.

## Removal and retry

Confirmation writes the id to the optional `pendingRemoval` list in `data/mods/installed.json` through the same serialized writer as catalogue installation. The installer refuses another install for that id while removal is queued. Uninstall requires an own, nonempty installation record. Both scheduling and startup validate the folder. Startup refuses a link or junction at the mod folder, and protects configured developer folders inside it.

At startup, cleanup removes the id folder and all its version directories, then atomically replaces the install record to remove that id and its pending entry. Other installs survive. A folder blocked by a lock or filesystem error stays queued, and the installed copy is skipped for that session. The next start retries. If the folder is already gone, cleanup can still finish the record update. The operation leaves `mods.json`, save slices, and global and per-playthrough `mod-data` intact.

A copy installed from file is eligible when the installer recorded it in `installed.json`. A manually copied folder without an installer record is outside the removal action’s scope.

## Verification

- `npm ci` passed. Set the executable bit on the bundled Linux archive helper for this checkout.
- `npm run typecheck` passed all three configurations. `npm run build` passed. `npm --prefix packages/modkit run report:check` reports the API is up to date.
- The focused catalogue suite passed **17 tests**, including four uninstall cases for queued cleanup and reinstall, preservation of other records and save data, unknown and unsafe ids, a simulated `EBUSY` retry, and a folder redirected outside the install tree after scheduling.
- Initial `npm test` run had **2,925 passed, 4 skipped, 2 failed**. The known Linux `getComfyOutputFilePath` case failed at `test/mainServices.test.ts:182`. The relationship simulation at `test/npcRelationships.test.ts:406` exceeded Vitest’s five-second default again in isolation. All **43 relationship tests** passed with a 30-second allowance. Backup, character-transfer and soundtrack tests reported no failures with the archive helper available.
- Final full run with two workers and a 30-second test allowance had **2,926 passed, 4 skipped, 1 failed** across 230 files. The only failure was the known Linux ComfyUI path test.
- Electron under Xvfb passed **six functional checks** using an HTTPS fixture catalogue and a temporary data folder. Installed a mod in Browse. Relaunched, opened Uninstall in Installed and cancelled without changing the record. Confirmed from Browse, checked the restart offer and current session row, and relaunched again. Verified the row, folder and record were gone, the saved mod data and switches remained, and Browse could reinstall the same version. Relaunches used close and reopen in the test harness.

The folder-in-use retry was tested with a simulated `EBUSY`. Behavior with a native Windows file lock has not been separately verified.
