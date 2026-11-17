# Mod kits audit — naudh1r/venus-university

Audited 2026-11-17. Scope: the four requested kit branches and committed releases; Mini-games and Darts excluded. Read-only audit: no commits, pushes, PRs, or tracked-file edits. The original checkout was left untouched. All fetches, detached checkouts, dependency installs, builds and logs were in `/workspace/work/mod-audit`, outside the original repository. The release zips were not replaced.

> **Update, 2026-11-17 (after the audit):** checks 7 and 8 were run afterwards with `xvfb-run`, and they found that three of the four released zips did not work. The cause was in `vxbuild.mjs`. It was fixed, and the three zips were rebuilt in place under the same versions (`notes/standalone-mods` c1dc0a08). See **Follow-up: checks 7–8 and the release fix** at the end. The results table below shows the state after the fix. The sections in between are the audit as Codex ran it, against e568367f.

## Revisions

| Ref | Audited commit |
|---|---|
| `naudh1r-core` | `180e75b171a4a567cf3e677746d8140b1ae33d50` |
| `notes/standalone-mods` | `e568367f14c715036709d5f3288d4a38bdb1cf6a` |
| `mod/photo-feature-kit` | `7c0830f8fb277e46ab23f785788cd5ca668bbf19` |
| `mod/bunnyfeeds-kit` | `a70e186342341e3cadc4317fee477cd5452080be` |
| `mod/emoji-extended-kit` | `fefaccdf704e22979519255285a71a1885e80ca9` |
| `mod/after-hours-kit` | `08fad11b4f12908cb4d9b0c455e47064da1542e0` |

Kit version read from `packages/modkit/src/shared/version.ts` on the base: `0.8.0`. Refs were fetched from `https://github.com/naudh1r/venus-university.git` using the requested six-ref fetch, with remote name `fork` in the scratch clone.

## Results

✅ = verified pass; ❌ = a command failed or bytes differed, including the known Linux failure; skipped = not run.

| Mod | 1. Only this mod | 2. Zero allowlists | 3. Typecheck + tests | 4. Core current | 5. Zip matches | 6. Catalogue | 7. Install/run alone | 8. Missing partners |
|---|---|---|---|---|---|---|---|---|
| Photo Feature | ✅ | ✅ (0 / 0) | ❌¹ | ✅ (0 behind) | ❌² | ✅³ | ✅³ | — |
| Bunnyfeeds | ✅ | ✅ (0 / 0) | ❌¹ | ✅ (0 behind) | ✅ | ✅³ | ✅³ | ✅³ (without Photo) |
| Emoji Extended | ✅ | ✅ (0 / 0) | ❌¹ | ✅ (0 behind) | ✅ | ✅ | ✅ | — |
| After Hours | ✅ | ✅ (0 / 0) | ❌¹ | ✅ (0 behind) | ✅ | ✅³ | ✅³ | ✅³ (alone) |

¹ Only `getComfyOutputFilePath`, the known failure on Linux (Windows paths).
² Only a build-path comment in `main.js`; the code is identical.
³ After the release fix (c1dc0a08). Before it, Photo and Bunnyfeeds were refused at startup and After Hours was refused at install; see the follow-up.

Check 8 applies to Bunnyfeeds without Photo Feature and After Hours without the other three; the other two mods have no separate missing-partner scenario. All runtime scenarios were skipped.

## Method and setup

Each branch was checked out detached. Initial setup used `npm install --package-lock=false`, which preserved tracked files but ignored the pinned lockfile versions. Final setup and all final checks instead used `npm ci` and `npm --prefix packages/modkit ci`: this intentional adjustment to the requested install commands honored the committed locks without modifying them. `chmod +x node_modules/7zip-bin/linux/x64/7za` succeeded. Every tracked-file status check in the scratch clone was empty. Tests ran on Linux with Node `v24.19.0`, npm `11.9.0`, and Vitest `4.1.11`.

Initial test attempts encountered `TypeError: fetch failed` while Electron tried to download its binary, causing suite-load errors. The binary was then downloaded successfully using `NODE_USE_ENV_PROXY=1`, extracted from the cache to a stable scratch directory, and the complete branch checks were repeated with `ELECTRON_OVERRIDE_DIST_PATH=/workspace/work/mod-audit/electron-dist`. The final results below use those repeated full runs. No test, application source, or test configuration was patched.

Setup error output from the first Photo Feature `npm test` attempt (resolved before final runs):

```text
TypeError: fetch failed
stdout | test/kit/contract.test.ts
Downloading Electron binary...
FAIL  test/kit/contract.test.ts
FAIL  test/mods/loader.test.ts
Error: Electron failed to install correctly. Please delete `node_modules/electron` and run "npx install-electron --no" manually.
```

## 1. Branch isolation

Ran `git diff --stat fork/naudh1r-core...fork/mod/<id>-kit` and inspected every changed path against each branch’s `test/kit/modFiles.ts`, plus the shared/renderer/main mod entry files automatically owned by the boundary scanner. Every branch adds only its own entry/implementation files, documentation and tests, and one mod entry in `MOD_FILES`. No core implementation files or other mod entries changed. The `MOD_FILES` entries span multiple physical lines; there is one mod registration per branch.

### Photo Feature

`git diff --stat` summary: ` 78 files changed, 15813 insertions(+), 1 deletion(-)`.

Every changed file outside the mod’s own implementation/entry files:

- `docs/mods/photo-feature.md`
- `test/bodyBrief.test.ts`
- `test/characterBody.test.ts`
- `test/fixtures/photoCalls.ts`
- `test/fixtures/photoRecordKit.ts`
- `test/fixtures/photoSwitchState.ts`
- `test/kit/modFiles.ts` — this mod’s sole registration.
- `test/photoBrief.test.ts`
- `test/photoDuo.test.ts`
- `test/photoFiles.test.ts`
- `test/photoFlow.test.ts`
- `test/photoFraming.test.ts`
- `test/photoGate.test.ts`
- `test/photoLoader.test.ts`
- `test/photoPose.test.ts`
- `test/photoPrompt.test.ts`
- `test/photoRedraw.test.ts`
- `test/photoSidecars.test.ts`
- `test/photoSwitches.test.ts`
- `test/photoTurn.test.ts`
- `test/photoWardrobe.test.ts`
- `test/postAudience.test.ts`
- `test/postPhoto.test.ts`
- `test/qa2-photo-reservation.test.ts`

Unexpected files: none.

### Bunnyfeeds

`git diff --stat` summary: ` 24 files changed, 4910 insertions(+), 1 deletion(-)`.

Every changed file outside the mod’s own implementation/entry files:

- `docs/mods/bunnyfeeds.md`
- `test/bunnyfeeds.test.ts`
- `test/bunnyfeedsFixtures.ts`
- `test/bunnyfeedsMigration.test.ts`
- `test/bunnyfeedsReaders.test.ts`
- `test/bunnyfeedsThreads.test.ts`
- `test/kit/modFiles.ts` — this mod’s sole registration.

Unexpected files: none.

### Emoji Extended

`git diff --stat` summary: ` 11 files changed, 998 insertions(+), 1 deletion(-)`.

Every changed file outside the mod’s own implementation/entry files:

- `docs/mods/emoji-extended.md`
- `test/emojiText.test.ts`
- `test/kit/modFiles.ts` — this mod’s sole registration.

Unexpected files: none.

### After Hours

`git diff --stat` summary: ` 9 files changed, 710 insertions(+), 1 deletion(-)`.

Every changed file outside the mod’s own implementation/entry files:

- `docs/mods/after-hours.md`
- `test/afterHours.test.ts`
- `test/kit/modFiles.ts` — this mod’s sole registration.

Unexpected files: none.

## 2. Allowlists

Both `test/kit/boundaryAllowlist.json` and `test/kit/gameAllowlist.json` are absent on all four audited branches. Thus there are no rows for any mod (0 forward, 0 reverse). This differs from having present JSON files with zero matching rows. `test/kit/boundary.test.ts:39` explicitly returns `[]` when either file is absent. The boundary tests were included in each full test run.

## 3. Typechecking and tests

The commands were `npm run typecheck` and `npm test`, run independently so tests also ran if typechecking failed.

| Mod | Typecheck exit | Test exit | Final test-file summary | Final test summary |
|---|---:|---:|---|---|
| Photo Feature | 0 | 1 | Test Files  1 failed \| 235 passed \| 3 skipped (239) | Tests  1 failed \| 3163 passed \| 4 skipped (3168) |
| Bunnyfeeds | 0 | 1 | Test Files  1 failed \| 220 passed \| 3 skipped (224) | Tests  1 failed \| 2641 passed \| 4 skipped (2646) |
| Emoji Extended | 0 | 1 | Test Files  1 failed \| 217 passed \| 3 skipped (221) | Tests  1 failed \| 2611 passed \| 4 skipped (2616) |
| After Hours | 0 | 1 | Test Files  1 failed \| 217 passed \| 3 skipped (221) | Tests  1 failed \| 2627 passed \| 4 skipped (2632) |

### ❌ Known Linux path assertion — all four branches

File: `test/mainServices.test.ts:182`; function: `getComfyOutputFilePath`. The test expects a permanently rejected out-of-root filename, but the invocation returns without throwing for a Windows-style path on Linux. This is the failure identified in the request. Each `npm test` exits 1, so check 3 remains ❌ even if every other test passes.

**Photo Feature — `npm test`, exit 1:**

```text
FAIL  test/mainServices.test.ts > getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }

- Expected:
{
  "code": "COMFY_OUTPUT_PATH_INVALID",
}

+ Received:
undefined

 ❯ test/mainServices.test.ts:182:22
    180|         thrown = err
    181|       }
    182|       expect(thrown).toMatchObject({ code: 'COMFY_OUTPUT_PATH_INVALID'…
       |                      ^
    183|       expect(isPermanent(thrown)).toBe(true)
    184|     }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

**Bunnyfeeds — `npm test`, exit 1:**

```text
FAIL  test/mainServices.test.ts > getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }

- Expected:
{
  "code": "COMFY_OUTPUT_PATH_INVALID",
}

+ Received:
undefined

 ❯ test/mainServices.test.ts:182:22
    180|         thrown = err
    181|       }
    182|       expect(thrown).toMatchObject({ code: 'COMFY_OUTPUT_PATH_INVALID'…
       |                      ^
    183|       expect(isPermanent(thrown)).toBe(true)
    184|     }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

**Emoji Extended — `npm test`, exit 1:**

```text
FAIL  test/mainServices.test.ts > getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }

- Expected:
{
  "code": "COMFY_OUTPUT_PATH_INVALID",
}

+ Received:
undefined

 ❯ test/mainServices.test.ts:182:22
    180|         thrown = err
    181|       }
    182|       expect(thrown).toMatchObject({ code: 'COMFY_OUTPUT_PATH_INVALID'…
       |                      ^
    183|       expect(isPermanent(thrown)).toBe(true)
    184|     }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

**After Hours — `npm test`, exit 1:**

```text
FAIL  test/mainServices.test.ts > getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }

- Expected:
{
  "code": "COMFY_OUTPUT_PATH_INVALID",
}

+ Received:
undefined

 ❯ test/mainServices.test.ts:182:22
    180|         thrown = err
    181|       }
    182|       expect(thrown).toMatchObject({ code: 'COMFY_OUTPUT_PATH_INVALID'…
       |                      ^
    183|       expect(isPermanent(thrown)).toBe(true)
    184|     }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## 4. Core ancestry

For each branch, `git merge-base --is-ancestor fork/naudh1r-core fork/mod/<id>-kit` exited 0. `git rev-list --count fork/mod/<id>-kit..fork/naudh1r-core` printed `0` for each branch. None is behind the audited base.

## 5. Release reproduction

Used the unmodified `vxbuild.mjs` from the audited `notes/standalone-mods` commit:

```sh
node /workspace/work/mod-audit/notes/vxbuild.mjs /workspace/work/mod-audit/repo <id> /workspace/work/mod-audit/<id>/rebuilt
```

Each rebuild exited 0. Compared ZIP member paths and decompressed bytes against every rebuilt regular file. ZIP compression, timestamps and ordering were not treated as content changes.

| Mod | Committed ZIP files | Files only in ZIP | Files only in rebuild | Files with different bytes |
|---|---|---|---|---|
| Photo Feature | `renderer.js`, `style.css`, `vxmod.json`, `main.js` | none | none | main.js |
| Bunnyfeeds | `renderer.js`, `style.css`, `vxmod.json` | none | none | none |
| Emoji Extended | `renderer.js`, `style.css`, `vxmod.json` | none | none | none |
| After Hours | `renderer.js`, `style.css`, `vxmod.json` | none | none | none |

### ❌ Photo Feature release byte mismatch

Release: `releases/photo-feature-1.7.3.zip`. The difference below is a generated source-location comment in `main.js`, identifying the temporary `_main.ts` wrapper’s build path. Executable statements are identical; the strict content comparison still fails. No release was replaced.

Comparison command: `python /workspace/work/mod-audit/run.py` (ZIP bytes versus rebuilt files; comparison output follows).

```diff
{
  "zipOnly": [],
  "rebuiltOnly": [],
  "different": [
    "main.js"
  ]
}
--- committed/main.js
+++ rebuilt/main.js
@@ -4423,6 +4423,6 @@
   return { invoke: photoInvocations(), protocols: [{ route: "photos", handle: photoRoute }] };
 }
 
-// ../../../tmp/claude-0/-home-user/c131246f-1bb3-5571-b524-793842e9fc17/scratchpad/rel/photo-feature/_main.ts
+// ../photo-feature/rebuilt/_main.ts
 var f = Object.values(photo_feature_exports).find((v) => typeof v === "function");
 module.exports = f();
```

## 6. Catalogue verification

Read `catalog.json` and the committed ZIPs from the audited notes commit. SHA-256 was computed from the committed ZIP bytes; versions and kit requirements were read from each ZIP’s `vxmod.json`. Every cover URL resolves to a file present in that same commit; the byte count below is the committed file size. All covers are below both 1,000,000 bytes and 1 MiB.

| Mod | Catalogue / ZIP version | Catalogue / manifest kit | Cover path | Cover bytes | SHA-256 (computed = catalogue) |
|---|---|---|---|---:|---|
| Photo Feature | `1.7.3` / `1.7.3` | `>=0.8.0` / `>=0.8.0` | `art/photo-feature/cover.webp` | 43200 | `f919b27188cbb39a52deda9f57c705cd1849b06352cff11afe38a564eb249ac5` |
| Bunnyfeeds | `1.1.6` / `1.1.6` | `>=0.8.0` / `>=0.8.0` | `art/bunnyfeeds/cover.webp` | 34434 | `f42da93010d6e7d0732e856c4bf0f21feba9e57de7bc4409a729bbc0db91e65a` |
| Emoji Extended | `1.0.0` / `1.0.0` | `>=0.8.0` / `>=0.8.0` | `art/emoji-extended/cover.webp` | 44326 | `632e02c45a5432d8b936e216d81142c68def0cfdafbfaa232f0f365b90b376e0` |
| After Hours | `0.6.6` / `0.6.6` | `>=0.8.0` / `>=0.8.0` | `art/after-hours/cover.webp` | 40954 | `4d21539d963c3efa103fdc6e99b32a0fd605564ab2c5f9332a5f4cb27f8cca12` |

## 7–8. Runtime scenarios — skipped by Codex (run afterwards, see the follow-up)

The environment has neither `xvfb-run` nor `Xvfb`. The availability probe produced:

```text
$ xvfb-run --help
/bin/bash: line 1: xvfb-run: command not found
exit: 127
```

Electron’s binary was made available for Node test imports, but no Electron UI session was run. The core application was not built for the runtime scenarios, no ZIP was installed through the mods browser, no game was started, and no runtime console or missing-partner behavior was verified. No runtime pass is inferred from static checks, bundling, or unit tests.

## Preservation check

`git status --short --untracked-files=no` was empty after each branch’s checks in the scratch clone. `git -C /workspace/venus-university status --short` was empty before and after the audit. `DESIGN_GUIDE.md`, `UI_STYLE_GUIDE.md`, `README.md` and `TESTING_PLAN.md` were not edited. Scratch artifacts and this report are outside the original repository.

## Follow-up: checks 7–8 and the release fix

Run after the audit, in a container that has `xvfb-run`. The app was `naudh1r-core` 180e75b1, built with `npm run build` and launched with Playwright's Electron on a fresh data folder each time. Each zip was installed through the mods browser's own path (`mods.catalog()`, then `mods.installRelease(id, version, approved)`), which downloads it from the live catalogue, checks its sha256 and unpacks it. The game was then started again with the mod switched on.

### Before the fix (the zips the audit checked)

| Release | Installs | Starts |
|---|---|---|
| Photo Feature 1.7.3 | ✅ | ❌ refused: ``main.js reads `main:requiredBackupPart` is not declared in vxmod.json`` |
| Bunnyfeeds 1.1.6 | ✅ | ❌ refused: ``registers `prompts.scene`, `prompts.dm`, `prompts.slot-posts`, `prompts.text-ledger`, `requests.slot-intro` but does not declare them`` |
| Emoji Extended 1.0.0 | ✅ | ✅ |
| After Hours 0.6.6 | ❌ refused: ``"requires" is not an object of mod ids and version ranges`` | — |

### Cause

`vxbuild.mjs` writes each manifest's `hooks` list, and three kinds of entry were missing:

- **Hook names that the kit's `hookTable.ts` builds with helpers:** `prompt('scene')` is `prompts.scene`, `request('ledger')` is `requests.ledger`, and `slot('x')` is a screen slot. The script only read literal `{ name: '…' }` rows. It also didn't look inside the nested `prompts: { … }` and `requests: { … }` blocks in `registerHooks`.
- **The names `main.js` reads from the kit:** it recorded `main:*` and then filtered that out, so no `main:` or `shared:` name used on the main side was declared.
- **An empty `requires: []`:** it was copied as is, but the manifest takes `{ id: range }`.

Check 5 couldn't catch this, because the rebuild used the same script and so got the same manifests.

### Fix

`vxbuild.mjs` now:
- adds the names the hook table builds with helpers
- reads the keys of `prompts` and `requests` blocks by matching braces
- declares every property `main.js` reads off a kit module
- leaves out an empty `requires` or `optional`, and refuses a non-empty list

Photo Feature 1.7.3, Bunnyfeeds 1.1.6 and After Hours 0.6.6 were rebuilt in place under the same versions, and their sha256 hashes in `catalog.json` were updated. Emoji Extended 1.0.0 is unchanged.

| Release | New sha256 |
|---|---|
| Photo Feature 1.7.3 | `e646980fd7c6d4ede61a547f5d3357cc4d08cd03aa7d6d8cef872841c4163998` |
| Bunnyfeeds 1.1.6 | `360b07c6e8d4744f85b86dd71351653ce2eba7738acb1675b98e35abb9a1d755` |
| After Hours 0.6.6 | `2718c906d10d8af24460b7fa8deb7df0f03746e2e408206d1f5cc8355b9e932a` |

Added to the manifests: Photo gets `contactPostExtra`, `messageAttachment`, `phoneOverlay`, five `prompts.*`, `requests.scene`, seven `main:` and twelve more `shared:` names. Bunnyfeeds gets the four `prompts.*` and `requests.slot-intro`. After Hours gets `prompts.dm`, `prompts.scene`, `requests.ledger` and `requests.slot-intro`, and its empty `requires` is removed.

### After the fix

Installed from the live catalogue at c1dc0a08:

| Scenario | Installs | Starts (on) | Mods notice | Console errors |
|---|---|---|---|---|
| Photo Feature alone | ✅ | ✅ | none | none |
| Bunnyfeeds alone (without Photo) | ✅ | ✅ | none | none |
| Emoji Extended alone | ✅ | ✅ | none | none |
| After Hours alone (without the other three) | ✅ | ✅ | none | none |
| All four together | ✅ | ✅ | none | none |

**Not covered:** no turn was played, because that needs a real AI key. How Bunnyfeeds behaves in a game without Photo is covered only by the unit tests. Anyone who installed the earlier Photo 1.7.3 or Bunnyfeeds 1.1.6 has to remove it and install it again: the version didn't change, so the game won't offer it as an update.

**Still open:** the build-path comment in Photo's `main.js` (check 5) remains, so a rebuild still differs from the zip by that one line.
