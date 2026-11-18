# Review: `hooks/mod-sources`

Reviewed commit: [`e5ff13bc0eb76142862a1f1de60777b8c3d6fd64`](https://github.com/naudh1r/venus-university/commit/e5ff13bc0eb76142862a1f1de60777b8c3d6fd64), 18 November 2026.

Base: org `core`, `c1e857cc4e7c9f02bdd6d911f5b826d8acd01743`. `git rev-list --count origin/core..HEAD` returned **1**. Plan: `docs/install-plan.md` at `21d3762fa890a61ff296826f8897f542cb9433e5`, including sections 1, 4, 10, 11 and decision 17. Read `CLAUDE.md`, `DESIGN_GUIDE.md` and `MODDING.md`; inspected the complete implementation diff and relevant loader, ordering, layout, settings and prototype code.

**Should fix before opening:** the resolver can return a successful plan whose selected library is missing an export used by its dependent. The loader then rejects that dependent. No blocking security finding was established. There are also readability and test-quality nits below. No implementation files were changed.

## Findings, most severe first

### 1. Should fix — export compatibility is discarded, so a successful plan can fail at load

**Location:** `packages/modkit/src/shared/install.ts:40` (`loads`), `:61` (candidate filtering), `:128` (final graph check); compare `src/main/mods/loader.ts:281`.

Concrete input, all in one valid source:

- Requested `uses-lib@1.0.0`: `requires: { lib: '*' }`, `hooks: ['lib:greet']`.
- `lib@1.0.0`: `library: true`, `exports: ['greet']`.
- `lib@2.0.0`: `library: true`, `exports: ['wave']`.
- Neither mod is installed or built in.

`parseSource` accepts this source. `loads` removes **every library export reference** before calling `checkCompat`. Both library releases pass the remaining check. The resolver picks `lib@2.0.0`, and the final `orderMods` call only checks dependency versions/order: it does not check exports. The resolver returns `ok: true` with `lib@2.0.0` before `uses-lib@1.0.0`.

The scratch test wrote those exact selected manifests and empty renderer entries into a scratch mods folder, then called the existing `loadMods`. The dependent became `needs-update`:

```text
EXPORT_PROBE {"selected":[["lib","2.0.0"],["uses-lib","1.0.0"]],
"loader":{"status":"needs-update",
"message":"needs `lib:greet`, which lib 2.0.0 no longer has"}}
```

Thus a player following this plan would install a dependent that cannot load even though a usable library release is listed. The loader already has a regression test for missing library exports (`test/mods/loader.test.ts:231`), but the resolver tests never connect this contract to planning. Updating a library can also affect retained dependents; `InstalledMod` currently carries neither their hooks nor the library's exports.

**Suggested fix:** share the loader's manifest/export compatibility rule with the planner, including the information needed from retained/built-in snapshots. Filter library candidates against known dependents' required export names before selecting the highest fitting release, and validate the final graph. Retain greedy refusal for conflicts discovered later; this does not require general backtracking. Add the concrete planner-to-loader regression above.

### 2. Nit — dense control flow makes the parser, graph rewrite and transport rules hard to review

**Locations and concrete readability problems:**

| File and line | Input/control path made difficult to follow | Suggested change |
| --- | --- | --- |
| `packages/modkit/src/shared/source.ts:62`, `:69`, `:74` | URL parsing, exception handling and refusal helper bodies are compressed into single lines. | Give each operation and branch its own line, following `manifest.ts`. |
| `packages/modkit/src/shared/source.ts:96`, `:104`, `:116`, `:127` | One `parseSource` callback contains mod validation, release validation, approval dates, withdrawals and artwork. The date condition at `:120` is 222 columns; the screenshot condition at `:137` is 179. | Extract release, approval, withdrawal and screenshot readers; wrap conditions. Keep strict whole-source refusal and tolerant screenshot handling explicit. |
| `packages/modkit/src/shared/install.ts:16`, `:31`, `:87`, `:89`, `:98`, `:112`, `:119`, `:131`, `:137`, `:155` | Compact type declarations, nested `for` statements, replacement filtering and inline refusal/output expressions obscure the changing graph. | Expand types and loops; name the demand/replacement operations; split long range/candidate checks and result construction. |
| `src/main/mods/sources.ts:20`, `:37`, `:66`, `:76` | Error construction, URL parsing, custom reads and cache eviction pack separate actions into one line. | Expand the blocks so validation, mutation and error paths are separately visible. |
| `src/main/mods/sources.ts:85`, `:103`, `:127`, `:131`, `:143` | `reader()` combines budgets, file streams, redirect handling, transport reads, cleanup and JSON parsing; the 188-column fetch statement and compact catch/finally blocks hide important awaits. | Split bounded transport/body reading from JSON decoding; expand fetch options, cleanup and approval stripping. Preserve one budget/deadline per source operation. |
| `src/main/mods/sources.ts:155`, `:156`, `:158`, `:159`, `:168`, `:169`, `:171`, `:176`, `:185`, `:188`, `:192`, `:196` | Stable-release filtering, asset checks, record construction and settings writes have long one-line predicates/bodies; the zip check at `:168` is 211 columns. | Extract asset validation, wrap the predicates and return objects, and use normal multiline settings callbacks. |
| `packages/modkit/src/host/shared.ts:12`, `:14`; `test/mods/sourceFixtures.ts:3`, `:8`, `:14` | New export/type lists and fixture construction are crowded together. | Wrap the lists and object literals as surrounding code does. |
| `test/mods/source.test.ts:7`, `:25`, `:53`, `:63`, `:78`, `:85`; `test/mods/install.test.ts:5`, `:25`, `:48`, `:65`, `:71`; `test/mods/sources.test.ts:15`, `:21`, `:38`, `:39`, `:61`, `:66`, `:73`, `:76`, `:83`, `:92`, `:97`, `:103`, `:110`, `:118`, `:120`, `:131`, `:141`, `:151`, `:158` | Multiple mutations/assertions per line and large inline fixtures/fetch mocks make it harder to tell which input is responsible for which result. | Put setup/actions/assertions on separate lines; format nested records and mock responses normally. |

These are formatting/splitting requests, not evidence of another runtime bug. The same author's prototype `src/main/mods/catalog.ts` on `fork/naudh1r-core` wraps its long validation conditions and object construction. Core `loader.ts` and `layout.ts` likewise use named helpers and multiline branches. There is no enforced column limit; the lengths above identify concrete review obstacles, not a proposed lint rule.

### 3. Nit — one new test couples behavior to an English error phrase

**Location:** `test/mods/install.test.ts:36`.

After constructing an absent requirement and refusing the plan, this test additionally requires `"absent isn't in this source"` verbatim. An error such as `"This source does not contain absent"` would preserve the behavior and diagnostic meaning but fail this assertion. This is a wording dependency under the guide's test rule.

**Suggested fix:** assert refusal and the missing requirement/source identity without matching an English sentence; if callers need to distinguish refusal kinds, expose a structured reason and test that. Preserve the checks that conflicting diagnostics contain both actual ranges: those are required behavior. Likewise, the parser's newer-schema diagnostic is explicitly required by the plan; it should not be mistaken for an unrelated copy test.

## Section 1 rule-by-rule

| Plan rule | Code traced / result |
| --- | --- |
| HTTPS list and GitHub repo sources; same row metadata | `sources.ts:66–80`, `:139–176`: list parser or GitHub release conversion, returning `ModSource`. Present. |
| List envelope/schema/name/mod records | `source.ts:87–105`. Present. |
| Whole manifest in each release, parsed against entry ID/version | `source.ts:113`. Present; `parseManifest` gets `{ id, version: v }`. |
| Required SHA-256 and size | `source.ts:111–112`. Present; 64 hex digits and a positive safe integer. |
| Custom approval ignored | `sources.ts:143–144` removes `approved` from every returned custom-list release. Repo conversion never adds it. Present. |
| Withdrawal and bundled-in metadata | `source.ts:126–143`. Present. Updating installed approval records is later transaction/update work, not performed by this parser. |
| Strict fields; newer schema; duplicate IDs/versions; whole-source refusal | `source.ts:67–70`, `:89–114`, `:148–150`. Present, including strict nested approval/withdrawal objects. Screenshots have the agreed exception. |
| GitHub releases API; stable releases with matching two assets | `sources.ts:151–174`. Present; pagination, draft/prerelease filtering, `vxmod.json`, exact manifest-derived zip name. |
| Repo answers retained for session; no pinned hash | `sources.ts:73–80`, `:169`. Present; successful/concurrent reads cached, failures evicted, callers receive clones. |
| Fixed approved address beside updateSource | `src/shared/modSource.ts:2`. Exact planned URL. |
| Main-owned `modSources` | `types.ts:2509`, `settingsRules.ts:75`, `sources.ts:183–196`. Present, optional for older settings; renderer cannot patch it. |
| Development override only; may use local file | `sources.ts:57–63`, `:99–100`. Present. |
| Main-only fetching, 2 MB cap, timeout | `sources.ts:9–10`, `:85–135`. Present for source reads, with the cancellation-adapter limitation below. No renderer fetch path or IPC added. |
| Decision 17: HTTPS cover, screenshots/captions, eight retained, bad screenshots dropped | `source.ts:135–145`. Present. Image-byte fetching/sniffing is absent; it needs the later screen/image-serving work. No current screen consumes this metadata. |

## Section 4 rule-by-rule

| Plan rule | Code traced / result |
| --- | --- |
| Pure host-shared resolver accepting installed, built-in, request and sources | `install.ts:8–34`, `:47`; `host/shared.ts:13–14`. Present. Request additionally requires source provenance. |
| Required IDs in discovery order | `install.ts:87–95`, `:104–124`. Present; insertion order drives demand discovery and one selection per pass. |
| Built-in in range needs no install; cannot replace built-in | `install.ts:55–57`, `:108–111`; requested built-in refused at `:69`. Present. |
| Installed version satisfying every required range kept | `install.ts:108`; all original installed IDs are roots at `:53`. Present. |
| Highest version from same source, satisfying every range, that loads | `install.ts:114–122`: range/sort/source rules present; **incomplete export compatibility, finding 1**. Multiple requiring sources use an extra arbitration rule described below. |
| Update shown with old/new version | `install.ts:63–66`, `:132`. Present. |
| Refusals name conflicting ranges or absent requirement | `install.ts:109–121`. Present; gathered dependent/range diagnostics and absent-source error. |
| Greedy, no backtracking | `install.ts:112`. Present; later conflicts with selected/requested versions refuse. |
| Approved dependencies all on approved list | List CI is assigned this rule by the plan; CI is outside this branch. A single-source approved request only fetches from that source. Mixed-source request arbitration is not an independently enforced approval policy here. |
| Optional never fetched; out of range treated absent | Resolver traverses `requires` only; final `orderMods` supplies optional presence. Present. |
| Cycles refused through orderMods | `install.ts:128–130`. Present, including in-range optional cycles. |
| Removal refused while required, naming dependent | `install.ts:147–148`. Present; also checks built-in dependents. |
| Offer orphaned library with last dependent | `install.ts:149–160`. Present; separate `orphaned` list, transitive offers, shared libraries retained. Tick-by-default UI is later screen work. |

## Security traces and scratch results

All scratch config, tests, certificates, generated fixture folders and logs are outside the checkout, under `/workspace/work/mod-sources-review/`. No scratch files were added to the implementation or report commit.

- **Custom `file:`:** `readCustom('file:///…')` reaches `modSourceAddress` with its default `allowFile = false`, fails `MOD_SOURCE_ADDRESS`, and never reads a file. Main settings additions use the same validation. A redirect to `file:` is also checked without file permission.
- **Packaged override:** with `app.isPackaged` true, `approvedAddress` never reads `VU_MOD_SOURCE`; the fixed HTTPS address is passed to `readList`. The tests supply a file override in packaged mode and confirm the fixed address remains selected. The constructor's explicit override is a trusted main/test dependency-injection option, not renderer input.
- **HTTP downgrade:** an HTTPS response with `302 Location: http://…` is cancelled, then its location fails validation before the second fetch. The existing injected-fetch test confirms one request only. No automatic redirect mode is used.
- **Missing or lying Content-Length:** every decoded chunk passes through `take`, decrementing the remaining budget independently of headers. The stream test without a length is stopped after exceeding 2 MiB and cancelled. A larger declared length is rejected before reading. A smaller declaration does not remove the per-chunk check.
- **Many GitHub pages:** `readRepo` creates its reader once, outside the page loop. The scratch response was 1,202,801 bytes/page with 100 skipped draft rows. The second page failed `MOD_SOURCE_SIZE` against the same 2,097,152-byte budget. A second scratch case delayed each 100-row page: the overall 35 ms deadline failed with `MOD_SOURCE_TIMEOUT`, rather than resetting per page.
- **Approval claims:** a valid `approved` block survives `readApproved` but is destructured away by `readCustom` on the same JSON. Custom list format validation occurs before stripping, so a malformed approval block refuses the source rather than being silently ignored.
- **Renderer settings:** `SettingsPatch` omits `modSources`; runtime `mergePatch` at `settingsRules.ts:399` spreads the current settings and writes an explicit list of permitted fields, never this one. A forged renderer patch carrying a replacement `modSources` preserves the current list in the test. No new IPC grants another write path.

### Cancellation await limitation — confirmed with an adapter; production exploit unverified

`sources.ts:105`, `:116` and `:127` await stream cancellation outside `beforeDeadline`. With an injected `Response` whose stream `cancel()` returns a never-settling promise, a 10 ms timeout reached the cancellation path but the read was still pending after 100 ms:

```text
CANCEL_PROBE {"timeoutMs":10,"observedAfterMs":100,
"outcome":"still pending after 100ms"}
```

This is a traced limitation of the supported injected-fetch path, not an established remote-server exploit. A server cannot supply a JavaScript `cancel` callback to native fetch. Suggested hardening is to avoid awaiting unbounded cancellation on an error path, or bound cancellation while preserving the original error.

I also exercised real Node fetch against a scratch **local HTTPS** server with a temporary self-signed certificate. Certificate verification was disabled only in that scratch subprocess for that local fixture. Production source code and TLS policy were unchanged. Native outcomes:

```text
/stall     MOD_SOURCE_TIMEOUT   157 ms   (150 ms deadline)
/oversize  MOD_SOURCE_SIZE       15 ms
/redirect  MOD_SOURCE_TIMEOUT   152 ms   (redirect body kept open)
```

Those production-transport cases settled correctly. Confirming an externally triggerable cancellation problem would require a native Node/Electron HTTPS response sequence that leaves cancellation pending after abort; the injected callback alone does not establish that. I am not counting this as a confirmed security finding.

## Resolver termination, preservation and ordering

- For finite parsed sources, I found no infinite `for (;;)` path. Each productive pass selects a release. A selected version still present cannot be replaced again: a later range conflict refuses at `:112`. Original installed/built-in IDs are permanent roots. Only a root's one-time replacement can remove reachability to previously picked non-root descendants; once root versions are fixed, dependency discovery only adds reachable choices from a finite set of IDs. The reachability queue checks `reachable` before expanding a node. Cycles terminate discovery and are refused by ordering.
- Installed IDs cannot disappear through pruning: all of them are in `roots`, which seeds `reachable` on every pass. A broken graph returns refusal rather than a partial successful plan. Built-in identity wins where snapshots overlap, matching the loader's built-in policy.
- Core-hook-incompatible and withdrawn **candidates** are removed in `available`. Retaining an already installed withdrawn version is distinct from offering a new install; clearing installed approval and showing withdrawal warnings belongs to later update work.
- Candidate fetching never searches a second source after the chosen requiring source fails. The existing cross-source test establishes that a missing requirement elsewhere does not become available implicitly. Mixed-source arbitration remains a policy detail below.
- The final result uses the exact successful `orderMods` result and refuses any nonempty `blocked` map. I found no successful plan that the same ordering inputs would refuse. This says nothing about the additional export check in the loader: finding 1 is outside `orderMods`.
- A scratch sweep of **1,000** deterministic five-ID/two-version required graphs terminated: **795 successful, 205 refused**. Every successful result retained an unrelated installed root and exactly matched a separate `orderMods` call with an empty blocked map. This is additional evidence, not an exhaustive proof or a substitute for export validation.

## Test assessment and unchanged ordering

Confirmed **81 new tests**: 49 parser, 15 resolver/removal, 17 fetching/settings. They largely check behavior: invalid inputs refuse, copies do not alias, plans identify exact versions/updates, optional presence is correct, wrong-source fallbacks refuse, hashes are absent from repo answers, cache answers are isolated, streams are bounded/cancelled and renderer writes are ignored.

All step-1 section-10 cases are represented: installed kept; update; incompatible ranges; built-in; missing same-source requirement; optional not installed; cycles; required removal refusal; orphan offer; repo complete/incomplete assets and drafts. Covers/screenshots and development/HTTPS/cap requirements are represented too. Finding 3 identifies the avoidable English-phrase assertion.

Weak or missing defenses:

- `install.test.ts:15` checks only the `install` changes through a helper. It would also pass if the already-installed library vanished from `keep`/`order`. The implementation preserves it, but the test should assert that preservation directly.
- The missing-export planner/loader behavior in finding 1 is absent. The existing loader-only test does not catch the planner's filtering mistake.
- The repo pagination test checks that page 2 is fetched, but does not prove a shared byte/time limit. The scratch probes above fill that review gap; no tracked tests were changed.
- Some refusal checks use only `ok === false`, so a wrong refusal cause could pass (notably cycle/removal checks). Test semantic identities/reasons where important, without hardcoding prose.

Old/new ordering comparison:

```diff
-import { satisfies } from '../../../packages/modkit/src/shared/range'
+import { satisfies } from './range'
```

That is the **only** difference between org core's old `src/main/mods/order.ts` and the new kit implementation. The old main path re-exports `orderMods` and its types. Its eight existing tests still import that path; 19 loader tests exercise the consuming loader. The focused run of the three new files plus these two existing files passed **108/108** tests.

## Extra policy and scope decisions not spelled out by sections 1 and 4

These are real additions/interpretations, not independently confirmed defects:

- Request entries carry `{ version, source }`, not just the plan's shorthand version. For several dependents with different source addresses, a newly requested/selected dependent wins over an unchanged installed one, otherwise the first recorded requiring source wins (`install.ts:113–115`). That policy is deterministic but not specified by the plan. It should be settled before mixed-source plans are exposed; it is not an approval-isolation check.
- The resolver validates the entire installed graph, so an unrelated already-broken requirement can refuse a new plan. It suppresses outgoing requirements of versions known to need replacement and prunes newly planned, unreachable descendants. These mechanics support updates but are additional algorithm choices.
- `resolveRemoval` is a separate exported function; it protects built-ins/built-in dependents and offers orphan chains separately.
- Exact approval PR/date checks, positive safe-integer sizes, duplicate withdrawal refusal, empty release lists and withdrawals for versions not currently listed are parser policy beyond the illustrative format.
- Limits are 2 **MiB**, 30 seconds, five redirects, with one aggregate budget/deadline across repo pages and manifests. Pagination, failed-cache eviction, canonical repo addresses and cloned cache results are extra transport behavior.
- URL credentials/fragments are rejected for fetched source addresses. Custom settings are canonicalized/deduplicated; adding the fixed approved address is a no-op. Invalid stored settings refuse rather than being repaired. Malformed custom approval metadata is validated before being ignored.
- Artwork byte fetching/type sniffing, IPC, transactions, trust confirmation/installed approval writes, pending changes, screen and migration are absent. Section 11 explicitly puts IPC/installation and screens in subsequent steps. Decision 17's metadata is implemented now; actual image serving remains outstanding for the screen step.

## Paperwork and checks found fine

- `MODDING.md:1022` describes the implemented host functions, request shape, greedy rules, main fetching/settings and no-IPC scope accurately, subject to finding 1's incomplete compatibility promise.
- Kit changelog has an `Unreleased` entry. Kit version remains **0.7.0**; package metadata/version files are unchanged.
- Parser/resolver/ordering exports belong in the host shared half. They contain no Electron/Node transport dependencies, remain outside mod imports, and the network/settings edge stays in main. Existing public API report generation excludes this host-only surface; `report:check` passes.
- No added code/comment points at `DESIGN_GUIDE.md`, `UI_STYLE_GUIDE.md`, a plan document or a section number. “Install planner” in a descriptive comment is not a pointer to the plan. The density request above is separate from this check.
- Protected guides/docs, root `package.json` and root `package-lock.json` are unchanged. Installation left no tracked changes; the implementation checkout remains clean and detached at the reviewed commit.

## Commands and results

Ran `npm install`, `npm --prefix packages/modkit install`, then the requested `chmod`; both installs succeeded. Used the existing local Electron distribution for tests (`ELECTRON_OVERRIDE_DIST_PATH=/workspace/work/mod-audit/electron-dist`) and the environment proxy setting for dependency installation.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0 |
| `npm test` | Exit 1: only the known Linux `getComfyOutputFilePath` failure; **2,640 passed, 1 failed, 4 skipped** tests; **212 passed, 1 failed, 3 skipped** files |
| `npm run build` | PASS, exit 0 |
| `npm run build:web` | PASS, exit 0 |
| `npm --prefix packages/modkit run report:check` | PASS, exit 0; reports up to date |
| Focused new + ordering + loader tests | PASS: **5 files, 108 tests**, including all 81 new tests |
| Scratch tests via external Vitest config | PASS: **2 files, 6 probes**, including the reproduced defect and transport limitations described above |
| `git diff --check`; protected-file/root-manifest comparisons; working-tree check | PASS; no tracked changes |

The full-suite failure output was:

```text
FAIL test/mainServices.test.ts > getComfyOutputFilePath >
refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }
Expected: { "code": "COMFY_OUTPUT_PATH_INVALID" }
Received: undefined
test/mainServices.test.ts:182:22

Test Files  1 failed | 212 passed | 3 skipped (216)
     Tests  1 failed | 2640 passed | 4 skipped (2645)
```

No fixes, implementation commits, implementation pushes or PRs were made during this review. Only this report is committed to the fork's `notes/standalone-mods` branch.

## Fixes

Applied on 18 November 2026 in [`ee21e953b1392f565c77795058edea8b49b35118`](https://github.com/naudh1r/venus-university/commit/ee21e953b1392f565c77795058edea8b49b35118), **`core: fix mod source planning and review findings`**. This is a new commit directly above the reviewed `e5ff13bc`; the original commit was not amended. The findings above describe the original reviewed head.

| Requested fix | Implementation | Fix commit |
| --- | --- | --- |
| 1. Resolver library exports | Added host-shared `libraryExportProblem` in `packages/modkit/src/shared/library.ts` and replaced the loader's local copy with it. The resolver uses the same rule while filtering library releases, checking retained libraries and validating the final graph. `InstalledMod.hooks` and `.exports` are optional so existing callers still typecheck. Known requested, newly picked, installed and built-in dependents constrain library exports; obsolete versions due for replacement do not constrain their replacements. Later conflicts with a greedy choice still refuse. Updated `MODDING.md` and the kit changelog. | `ee21e953` |
| 2. Readability | Reformatted every area identified in the review, including host export lists, fixtures and tests. `source.ts` now has named release, approval, withdrawal, screenshot and mod readers. `install.ts` names reachability pruning, demand collection, replacement detection and export checks. `sources.ts` separates bounded transport from JSON decoding and names stable-release/manifest/zip asset checks. Long conditions and records are wrapped; setup, mutations and assertions occupy separate lines. Existing parsing/source/ordering behavior is preserved apart from the requested functional fixes and missing-source diagnostic detail. | `ee21e953` |
| 3. Wording assertion | Removed the English-sentence match. The missing-requirement test checks refusal, the actual missing ID and the supplying source address. The refusal now identifies that source. Range and identity diagnostics remain tested without matching an English sentence. | `ee21e953` |
| 4. Weak tests | The retained-library case explicitly asserts `keep` and dependency order. Required/present-optional cycle refusals identify the involved IDs; removal refusals identify the library and dependent. Added cross-page byte-budget and shared-deadline tests using injected fetch. The deadline case verifies one deadline signal is created and applied to both pages, and that abort during the second page settles the read. | `ee21e953` |
| 5. Cancellation | All three cancellation sites initiate cleanup without awaiting it. Cleanup rejection/throw cannot replace the original result. Added never-settling cancellation cases for stalled bodies, declared and streamed size refusals, and redirect bodies, plus a rejecting-cancellation regression preserving the original size error. | `ee21e953` |

The exact export regression now selects `lib@1.0.0` with `greet` over `lib@2.0.0` with only `wave` for `uses-lib@1.0.0` using `lib:greet`; a source containing only the latter library version is refused. Additional regressions cover installed and built-in dependents, newly discovered dependents, an installed library needing an export-compatible update, a built-in library missing an export, a later greedy conflict, and final validation of a retained optional dependent.

Snapshot hook/export fields remain optional. Callers providing older snapshots without hook declarations retain their earlier behavior; the resolver can check only the export uses supplied to it. The loader's missing-library handling and export diagnostic are shared unchanged. Mixed-source arbitration remains unchanged for the PR discussion. No screen, IPC or installer transaction was added; kit version remains **0.7.0**.

### Fix validation

There are **16 additional regression tests**, taking the three source-related test files from **81 to 97**: parser **49**, resolver/removal **24**, fetching/settings **24**. The focused run also included the unchanged eight ordering tests and 19 loader tests: **124 passed across five files**.

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS: node, web and test configurations |
| `npm test` on the final committed implementation | **2,656 passed, 1 failed, 4 skipped** tests; **212 passed, 1 failed, 3 skipped** files. The sole failure remains the known Linux `getComfyOutputFilePath` case at `test/mainServices.test.ts:182`. |
| `npm run build` | PASS |
| `npm run build:web` | PASS |
| `npm --prefix packages/modkit run report` | PASS; public API reports unchanged because additions are host-only |
| `npm --prefix packages/modkit run report:check` | PASS; API reports up to date |
| Focused source/parser/resolver/ordering/loader run | PASS: **124/124** tests |
| Diff/working-tree checks | PASS; implementation checkout clean after the fix commit. Protected documents and root dependency manifests/lockfile unchanged. |

The implementation is published only to the fork's `hooks/mod-sources`, in one push after the checks. This appended report is committed separately, only to `notes/standalone-mods`. Both commits use `Naudh1r <102735014+naudh1r@users.noreply.github.com>` with `core:` titles and no co-author lines. No PR was opened.
