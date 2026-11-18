# Mod sources — install plan step 1

Implemented and checked on 18 November 2026. No PR was opened.

## Commits and scope

- Implementation: [`db3d86bab93d8fc57f6306293826c678d52d4b4a`](https://github.com/naudh1r/venus-university/commit/db3d86bab93d8fc57f6306293826c678d52d4b4a), on the fork's `hooks/mod-sources` branch.
- Base: org core `c1e857cc4e7c9f02bdd6d911f5b826d8acd01743`.
- Plan read: `docs/install-plan.md` at org `hooks/install-plan`, commit `21d3762fa890a61ff296826f8897f542cb9433e5`, including the whole plan and sections 1, 4, 10 and 11.
- Implementation commit author and committer: `Naudh1r <102735014+naudh1r@users.noreply.github.com>`. No co-author trailer.
- This report is committed separately, only to `notes/standalone-mods`, under `audits/`.

Read `CLAUDE.md`, `DESIGN_GUIDE.md` and `MODDING.md` before implementation. Inspected the fork's catalogue prototype without merging it. The implementation is one commit directly above the specified org core; no other fork features were brought across.

## What was built

| Requested item | Files / exports | Behavior |
| --- | --- | --- |
| Strict source parser | `packages/modkit/src/shared/source.ts`; `parseSource`, schema constants and source types exported by `@vx/modkit/host/shared` | Parses schema-1 lists. Unknown fields, duplicate mod IDs or release versions, missing hashes/sizes and invalid release manifests refuse the entire source. Manifest ID/version must match the entry. Higher schemas explain that a newer game is needed. Parses approval, withdrawal and bundled-in metadata. HTTPS cover; drops malformed screenshots and retains the first eight valid entries. |
| Pure resolver | `packages/modkit/src/shared/install.ts`; `resolveInstall`, `resolveRemoval` and their input/result types exported by host shared | Keeps built-ins and installed versions in range; otherwise picks the highest compatible version in the requiring source satisfying the known required ranges. Checks the prospective graph including unchanged installed dependents. Never fetches optional dependencies, never backtracks to an earlier lower pick, and refuses required/present-optional cycles through `orderMods`. Removal refuses required mods and separately offers newly orphaned libraries. |
| Shared ordering | `packages/modkit/src/shared/order.ts`; `src/main/mods/order.ts` re-exports it | Moves the existing ordering implementation unchanged except its range import, so the resolver and native loader use the same ordering rules. |
| Approved address | `src/shared/modSource.ts`; `APPROVED_MOD_SOURCE` | Holds `https://raw.githubusercontent.com/venus-extracurriculars/mods/main/vxsource.json`. |
| Main source fetching | `src/main/mods/sources.ts`; `ModSourceReader`, singleton `modSourceReader`, `modSourceAddress`, cap/deadline constants | Reads lists over HTTPS; development approved-source override may use `file:`. Enforces a streaming byte budget and deadline, including redirects and stalled response reads. Converts GitHub release sources to source records without a pinned hash. Successful repo answers are cached for the reader's session. Fetch is injectable; construction performs no network requests. |
| Main-owned settings | `src/shared/types.ts`, `src/shared/settingsRules.ts`, main `modSources`, `addModSource`, `removeModSource` helpers | Stores optional `Settings.modSources: string[]`; absence means no custom sources. Main writes through the existing serialized settings patch service. Renderer patch types exclude the field and the runtime settings patch allowlist cannot overwrite it. |
| Tests and paperwork | `test/mods/source.test.ts`, `install.test.ts`, `sources.test.ts`, shared `sourceFixtures.ts`; `MODDING.md`; kit `CHANGELOG.md` | Parser refusals, artwork metadata, resolver behavior, removal, repo discovery/cache, bounded fetches, development override and settings ownership are covered. Documentation describes the host APIs and preparation-only scope. |

The kit API reports were regenerated. They have no resulting tracked changes because these additions are on the host-only surface, outside the existing public API reports. `report:check` confirms the reports are current.

## Decisions where the plan left details open

1. **Host function signatures.** The plan describes behavior without an exact TypeScript signature. Install input contains `installed`, `builtIn`, `request`, `sources` and optional `core`. Requests map IDs to exact `{ version, source }` records; sources are `{ url, source }` records. Snapshots carry version, requirements, optionals and optional source/library metadata. The result carries dependency-ordered changes, old versions for updates, kept IDs and optional-presence information. Removal is a separate pure `resolveRemoval` function so it can offer orphaned libraries without silently deleting them.
2. **Several requiring sources.** An explicitly requested or newly selected dependent's source takes priority; otherwise the first recorded requiring source is used, in input/discovery order. No fallback to another source occurs if that source cannot satisfy the ranges. Duplicate source addresses are refused to avoid silently choosing one answer. The plan does not specify arbitration between two different custom sources for the same shared dependency; this deterministic rule is documented here for review.
3. **Prospective constraints.** Unchanged installed dependents participate in resolution; existing broken required edges can therefore refuse a plan. A version already known to need replacement does not impose its obsolete outgoing requirements on its replacement. Newly selected libraries no longer reachable after a parent update are pruned. A later conflict with a previously picked version refuses rather than backtracking.
4. **Compatibility.** Candidate releases must have `checkCompat(...).status === 'loads'`. Library export hook names are excluded from the core-hook check, as in the native loader; dependency relationships are handled by ordering. Installed versions already in range are retained as specified. Supplied snapshots do not model runtime load success, and this step does not replace the loader's export/runtime validation.
5. **Schema edge cases.** Approval requires a nonempty reviewer, positive integer PR number and real `YYYY-MM-DD` date; zip size is a positive safe integer. Duplicate withdrawal versions are refused. Empty mod/release lists and withdrawal records for versions absent from `releases` are allowed, so metadata can survive removal of downloadable releases. These exact validation details were not fully specified in the plan.
6. **Artwork metadata.** Invalid cover URLs refuse the list. Invalid screenshot containers/entries, unknown screenshot fields, non-HTTPS URLs and invalid captions are dropped; the first eight valid entries remain in order. This uses the prototype's tolerant screenshot approach while keeping the new list format strict elsewhere. Image bytes are not fetched in this step.
7. **Limits.** Interpreted the requested 2 MB cap as 2 MiB (`2 * 1024 * 1024` bytes), following the prototype's byte-limit convention. One 30-second deadline and byte budget cover the complete source operation, including all GitHub pages and manifests. Redirects are manual, capped at five and HTTPS-checked at every hop. Local development files use the same budget/deadline. Fetch/body awaits are bounded even for injected adapters that ignore abort signals. The shared repo budget can reject a large repository rather than partially presenting it.
8. **GitHub details.** Owner/repository roots are canonicalized to lowercase with no trailing slash. Releases are paginated at 100 per page; drafts and prereleases are skipped. A release requires a `vxmod.json` asset and its matching `<id>-<version>.zip`. Releases without the pair are skipped. A malformed eligible manifest, duplicate matching zip/version, or invalid zip size/address refuses the repo response. Repo records omit SHA-256 and approval. Concurrent reads share the cached promise; failed reads are evicted for retry and successful answers are cloned for callers.
9. **Approval boundary.** Custom-list approval blocks are parsed for format validity, then removed from the returned records. Only the approved reader preserves approval metadata. Its `approvedList` flag describes source identity; it grants no execution or installation permission by itself. Development replacement is honored only when unpackaged. Custom source settings never permit local files.
10. **Settings normalization.** Main validates HTTPS addresses, canonicalizes repo roots and deduplicates entries. Adding the fixed approved address is a no-op because it is already implicit. Malformed stored custom-source arrays are refused rather than silently overwritten.
11. **Kit version.** Left the kit at `0.7.0`, following the existing `Unreleased` convention for unreleased host additions. Added its changelog entry; no version or root dependency changes were needed.

## Checks

Ran installation in the implementation checkout:

```sh
npm install
npm --prefix packages/modkit install
chmod +x node_modules/7zip-bin/linux/x64/7za
```

Both installs succeeded. Root dependency manifests and lockfiles have no changes.

Final checks before the single implementation push:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS: node, web and test TypeScript configurations |
| `npm test` | Only the specified Linux failure: 2,640 passed, 1 failed, 4 skipped tests; 212 passed, 1 failed, 3 skipped files |
| `npm run build` | PASS: desktop main, preload and renderer build |
| `npm run build:web` | PASS |
| `npm --prefix packages/modkit run report` | PASS; generated reports unchanged |
| `npm --prefix packages/modkit run report:check` | PASS: “The API report is up to date.” |
| `git diff --check` and staged equivalent | PASS |

The sole failing test was unchanged `test/mainServices.test.ts:182`, `getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently`:

```text
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }
Expected: { "code": "COMFY_OUTPUT_PATH_INVALID" }
Received: undefined

Test Files  1 failed | 212 passed | 3 skipped (216)
     Tests  1 failed | 2640 passed | 4 skipped (2645)
```

Tests inject fetch responses; none depend on live GitHub/source traffic. Coverage includes header/body size caps, local-file caps, insecure redirects, redirect loops, stalled initial fetch and response-body deadlines, packaged override rejection, repo pagination, missing asset pairs, cache isolation/retry and renderer attempts to change main-owned settings.

Verified that `DESIGN_GUIDE.md`, `UI_STYLE_GUIDE.md`, `README.md`, `TESTING_PLAN.md`, root `package.json` and root `package-lock.json` are unchanged. The implementation checkout was clean after committing. No report was included on the implementation branch.

## Deferred and unclear

- No source IPC: section 11 puts source/install IPC in step 2. The main APIs are ready for those callers, but nothing fetches automatically or changes a player-facing screen.
- Zip download/hash verification, unpack validation, trust confirmation, pending-change transactions, actual installation/removal and startup application remain for later steps. This step only discovers sources and calculates plans.
- Update/trust revocation flows, bundled-mod migration, command-line/package/template work and Mods screen work remain in their later plan steps.
- Cover/screenshot **metadata** is implemented. Downloading and sniffing image bytes, including the prototype's 1 MB image limit, belongs with the later screen/image-serving work; there is no artwork fetch endpoint here.
- No Electron manual UI flow was exercised: this step exposes no screen or IPC to drive. Desktop and web builds were checked.
- The open details above—especially shared-dependency source arbitration, exact parser metadata checks, response budget interpretation and caller snapshot/API shape—are implementation choices for review, not additional settled plan decisions.
