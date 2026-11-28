# Install plan step 1

The fork's `hooks/mod-sources` branch preserves its two November 18 commits. Org `core` at
`49d62e279f64a300ce975e4cd955ce7094a0b5c9` was 36 commits ahead of their merge base. The refresh
merged that tip into the existing branch. The changelog was the only conflict and keeps both
sets of Unreleased entries. The reference is [the install plan on org core](https://github.com/venus-extracurriculars/build/blob/49d62e279f64a300ce975e4cd955ce7094a0b5c9/docs/install-plan.md)
and the [decision 17 review on #335](https://github.com/venus-extracurriculars/build/pull/335#pullrequestreview-5949644249).

| Commit | Subject |
| --- | --- |
| `e5ff13bc` | core: read mod sources and plan installs (install plan, step 1) |
| `63f04cf7` | core: fix mod source planning and review findings |
| `717e77a0` | core: merge org core into mod sources |
| `38b5dc95` | core: redact signed mod download credentials |
| `b6655b13` | core: close mod source checklist gaps |
| `9839a0cf` | core: install fixtures for optional library regression |

The new commits use the requested author and have no co-author trailers. No signing key was
available in the workspace. The merge has the old fork tip as first parent and the requested
org tip as second parent.

## Step 1 checklist

| Part | Implementation and verification |
| --- | --- |
| List format, §1 | `packages/modkit/src/shared/source.ts` validates schema 1 and all nested fields. It refuses unknown fields, duplicate IDs or versions, malformed manifests, mismatched manifest IDs or versions, insecure zip URLs, invalid hashes and invalid sizes. Newer schemas get the newer-game refusal. Successful listings and their nested values are frozen. |
| Artwork, decision 17 | The same parser validates the cover and up to eight HTTPS screenshots with optional captions. Each malformed screenshot refuses the source. Artwork downloads belong to step 3. |
| Requirements, §4 | `packages/modkit/src/shared/install.ts` keeps in-range built-ins and installed versions, then selects compatible releases from the requiring source in discovery order. Updates include the installed version and the selected release. The planner excludes withdrawn releases, respects present in-range optionals and uses the loader's host-shared `orderMods` to refuse cycles. Library-export checks share a rule in `library.ts`. This refresh makes those checks treat out-of-range optionals as absent in both planner and loader. |
| Removal, §4 | `resolveRemoval` refuses a mod required by another installed or built-in mod. Orphaned libraries are returned as default-selected offers. Removals travel by installed ID, so the plan can remove a local install whose originating release is unavailable. |
| Kit boundary | `packages/modkit/src/host/shared.ts` exports the parser and planners. The boundary fixture explicitly rejects the host shared import from a mod file. The changelog has an Unreleased entry and the kit remains at 0.7.0. |
| Approved address, §1 and decision 11 | `src/shared/modSource.ts` holds the approved list address. |
| Main source fetching, §1 | `src/main/mods/sources.ts` reads HTTPS sources, checks redirects and final URLs, and applies a 2 MiB cap and a 30-second deadline. `readModSources()` returns one outcome per source in settings order, starting with the approved list. Refusal addresses redact credentials. The reader honors `VU_MOD_SOURCE` only when unpackaged, where a `file:` URL is also allowed. |
| Repo sources, decision 4 | The main reader uses GitHub's release API and caches successful repo answers for the session. It skips drafts, prereleases and releases missing the asset pair. Matching `<id>-<version>.zip` and `vxmod.json` produce the same rows as lists, with repo provenance and no pinned hash. Tests inject the fetch function. |
| Settings | `src/shared/types.ts` and `src/shared/settingsRules.ts` define `modSources` with an empty default and preserve it on renderer patches. Main adds and removes validated, deduplicated addresses through `patchStoredSettings`. Older files may omit the field. |
| Trust fields, §§5–6 | The parser reads approvals, withdrawals and `bundledIn`. The main reader strips approval claims from custom lists. Revocation, update scheduling and install approval recording belong to later steps. |
| Signed URLs | `src/main/services/downloadService.ts` redacts `sig` and `jwt`. The regression in `test/mainServices.test.ts` preserves an unrelated query parameter while masking both credentials. |

## Plan details and open questions

- The parser limits captions to 200 JavaScript string units. The plan leaves “short” unspecified.
  Strict validation follows §1 and decision 17. The previous branch dropped malformed artwork.
- The inherited planner gives a newly requested or selected dependent's source precedence when
  sources differ. It then uses the first recorded requiring source in discovery order. §4 leaves
  arbitration between multiple requiring sources open. The whole prospective graph, including
  retained installed mods, participates in the range checks.
- The inherited transport applies one 2 MiB budget and 30-second deadline to a complete repo
  source, including release pages and manifest assets. GitHub discovery and source redirects were
  exercised with injected responses. The redactor uses a representative signed release URL.
  A live release-download transaction belongs to step 2.
- The redactor change moves the #335 follow-up into step 1 as directed. The source API is ready
  for step 2 IPC. The Mods screen and image fetching belong to step 3.

## Changes against org core

| File | Added | Removed |
| --- | ---: | ---: |
| `DESIGN_GUIDE.md` | 2 | 1 |
| `MODDING.md` | 29 | 0 |
| `packages/modkit/CHANGELOG.md` | 10 | 0 |
| `packages/modkit/src/host/shared.ts` | 34 | 1 |
| `packages/modkit/src/shared/install.ts` | 296 | 0 |
| `packages/modkit/src/shared/library.ts` | 33 | 0 |
| `packages/modkit/src/shared/order.ts` | 168 | 0 |
| `packages/modkit/src/shared/source.ts` | 255 | 0 |
| `src/main/mods/loader.ts` | 17 | 9 |
| `src/main/mods/order.ts` | 3 | 168 |
| `src/main/mods/sources.ts` | 418 | 0 |
| `src/main/services/downloadService.ts` | 2 | 0 |
| `src/shared/modSource.ts` | 2 | 0 |
| `src/shared/settingsRules.ts` | 3 | 1 |
| `src/shared/types.ts` | 3 | 0 |
| `test/fixtures/kit-boundary/bad-mod/renderer/entry.ts` | 2 | 1 |
| `test/kit/boundary.test.ts` | 1 | 0 |
| `test/mainServices.test.ts` | 6 | 0 |
| `test/mods/install.test.ts` | 370 | 0 |
| `test/mods/loader.test.ts` | 13 | 0 |
| `test/mods/source.test.ts` | 357 | 0 |
| `test/mods/sourceFixtures.ts` | 48 | 0 |
| `test/mods/sources.test.ts` | 401 | 0 |

Total against org core is 23 files, 2,473 insertions and 181 deletions, including the move of
the dependency-ordering implementation to the kit. The post-merge commits
account for 16 distinct files, 211 insertions and 59 deletions.

## Checks

| Check | Result |
| --- | --- |
| Root `npm ci` | Passed. 434 packages installed from the root lockfile. |
| Kit `npm ci` | Passed. 43 packages installed from the kit lockfile. |
| `npm run typecheck` | Passed for Node, web and test. |
| Kit `npm run report` and `npm run report:check` | Passed. The public API reports match org core. |
| `npm test` on the final tip | 2,939 passed, 4 skipped and 1 failed across 224 files. 220 files passed, 3 skipped and 1 failed. |
| Focused source, planner, loader, order and kit tests | 236 passed across 7 files. |
| Isolated reruns | NPC relationships passed 43 of 43. Kit contract passed 92 of 92. |
| `npm run build` | Passed for desktop main, preload and renderer. |
| `npm run build:web` | Passed. |
| `git diff --check` | Passed. |

The sole final failure is the known Linux ComfyUI output-path case at
`test/mainServices.test.ts:175`. The assertion expected `COMFY_OUTPUT_PATH_INVALID` and
received no thrown error. The archive helper was made executable after installation. The
final run had no archive-related failures.

The first run overlapped the builds. It hit a timeout in `npcRelationships.test.ts`, a
lazy Electron download failure in the kit contract test and missing fixture setup in the new
loader regression. The locked Electron binary was downloaded from the official release
and verified against the package checksum. The fixture setup was corrected in `9839a0cf`.
Those failures cleared in the final run.

## Draft PR description

**Title**  core: read mod sources and plan installs

**Branches**  `naudh1r:hooks/mod-sources` into `venus-extracurriculars:core`

This implements §11 step 1. The host shared kit reads strict `vxsource.json` listings under §1
and builds greedy install, update and removal plans under §4. It keeps in-range dependencies, resolves missing requirements
from their source, excludes withdrawn versions and uses the loader's rules for cycles and
library exports. [Install plan #335](https://github.com/venus-extracurriculars/build/pull/335)

Desktop main reads the approved list and configured HTTPS list and GitHub repo sources.
Each source has its own result. GitHub releases need the zip and manifest assets.
Development builds can substitute the approved list with `VU_MOD_SOURCE`. Main owns
`modSources` in settings.

Decision 17 adds validated cover and screenshot metadata. The #335 signed-URL follow-up masks
`sig` and `jwt` in errors. Step 2 handles source IPC and install transactions. Step 3 handles
the Mods screen and artwork fetching.
