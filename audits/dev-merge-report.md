# Venus Dev main → naudh1r-core merge report

Prepared 20 November 2026. Implementation branch: `naudh1r/venus-university:sync/dev-main`. No PR was opened, and neither `naudh1r-core` nor any org branch was pushed.

## Merge and scope

- Merge commit: [`151422e6063f1fd3c5b988f436ec40841878f467`](https://github.com/naudh1r/venus-university/commit/151422e6063f1fd3c5b988f436ec40841878f467) — `Merge Venus Dev main (17983b16) into naudh1r-core`.
- First parent: `4ac98264582ce79e40f511926854d79ee0700666` (`fork/naudh1r-core`).
- Second parent: `17983b16e8d71c201fe1c75cb2c62e918373e071` (`fork/main`).
- Org core fetched/studied: `c1e857cc4e7c9f02bdd6d911f5b826d8acd01743`; merge base of the two fork branches: `d80abeff1b2f3eab4469db2a7a42528631f83cd2`.
- Ran a real `git merge --no-commit fork/main`, then resolved and committed the merge. No rebase, squash, cherry-pick or amendment.
- Author/committer: `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, with no co-author trailer.

The initial merge produced **36 conflicted files and 298 changed files**, rather than the trial’s 262 changed files. The final merge changes **321** files, including integration adapters, API reports and regression tests. The four incoming mirror commits are `181998b6`, `4ab76882`, `cd9ba53c` and `17983b16`; their tree also contains the game changes not yet taken into org core, including genders/pronouns, romance/NPC relationships, transfer students and split New Game generation.

Studied `8c78ca507905108c9f67ab94984e4639aee23683` and `90fb15ecaf7f0fef767630564315463e70b48d9f`, including their remerge diffs in the same prompt/store/type paths. Followed their pattern: incoming native game behavior inside core’s hook, save and request boundaries. Read the guides and `CLAUDE.md` before resolving. `DESIGN_GUIDE.md` was resolved from existing text only; `UI_STYLE_GUIDE.md` takes its incoming automatic merge with no hand-authored additions.

## Every conflicted file

| File | Resolution |
| --- | --- |
| `DESIGN_GUIDE.md` | Combined. Kept incoming mood/gender and current slot-cycle prose; retained core’s unresolved-turn and interactive-activity End scene guards by copying their existing wording into the slot-cycle paragraph. Removed the duplicate old paragraph. No new guide prose. |
| `src/main/ipc.ts` | Core retained its generateSecrets endpoint through completeWithFinalRequest; incoming handlers and game changes remain. Classes/profiles still use their hook-aware endpoints for the new smaller calls. |
| `src/main/services/characterTransferService.ts` | Incoming member-name/pack preflight, refusal details and adoptedAt argument; core manifest-mod JSON, legacy keys, mod-parts staging, validation and adoption stay around the new native import. |
| `src/renderer/prompts/characterPrompt.ts` | Incoming gender-aware references, pronouns, pose choices and male swim outfit rules; core registered trait vocabulary, promptLines/fields/required and characterFromDraft remain. Designer text edits still apply. |
| `src/renderer/prompts/classPrompt.ts` | Incoming pool/major/interest part builders and validation win over the old single request. Re-applied core catalogSize overrides to shortfalls and per-pool asks, and text-edit/addition blocks to each new part. |
| `src/renderer/prompts/endingPostsPrompt.ts` | Incoming reader/cast wording; core narrationPersonaFor and global text edits stay. Passed the new reader pronouns through that persona helper. |
| `src/renderer/prompts/profilePrompt.ts` | Incoming major, per-student, returning-student and graduate builders, blank-field schemas, notes and integrated secrets. Re-applied core profile system/instruction/free-time/housing/handle/spring-break/graduate text blocks and additions to those builders. |
| `src/renderer/prompts/relationship.ts` | Incoming pronoun-aware RelationshipContext, attraction and loyalty rules; core modBlocked/stat-requirement guard and its precedence over native attraction hints remain. |
| `src/renderer/prompts/scenePrompt.ts` | Incoming gender/reader-aware PromptState, JSON rules, memory voice and game behavior; core named request parts, scene/global text edits and hook dispatch stay. The shared persona implementation now supplies incoming pronoun-aware defaults. |
| `src/renderer/prompts/secretsPrompt.ts` | Incoming secrets ride each student’s profile request, with asked-tier schemas and validation. Re-applied the secrets instruction/tier text edits; the combined profile/secrets system also keeps both families of additions. |
| `src/renderer/prompts/slotIntroPrompt.ts` | Incoming gender-aware/love-life reach-out topics, post wording and reader pronouns. Re-applied slot-reach-outs and slot-posts promptLines, retained narration text edits and the core opening/ledger hook path. |
| `src/renderer/prompts/textLedgerPrompt.ts` | Incoming third-person memoryVoiceLines and reader pronouns, without youDesc. Kept core text-ledger promptLines and editable ledger persona; added reader context without discarding text edits. |
| `src/renderer/prompts/textingPrompt.ts` | Incoming gender/romance/reader context and texting voice. Core held-message history window, messageSlotOf visibility, late-night/heldUntil/commitment context and location/meet-up suppression stay; adapted native location/meet-up calls to their new signatures. |
| `src/renderer/stores/applicationCompose.ts` | Incoming per-part planning, banking and validation replace the old one-shot compose flow. Restored RequestWorld.textEdits/classCatalog and forwarded them to major/student/returning/graduate, occasion and class-part requests, including pool asks. |
| `src/renderer/stores/characterStore.ts` | Incoming gender-specific subject tags; retained core’s registered traits when converting a generated draft. |
| `src/renderer/stores/feedView.ts` | Incoming NPC-couple feed entries; retained core’s outAtOf visibility tie-break after the normal newest-first comparison. |
| `src/renderer/stores/gameLoop.ts` | Combined incoming love-life/NPC settles, transfers, pronoun-aware openings and new memory status inputs with core buildOrAsk/run-stale guards, visible chat summaries, projected mod memory weights, ledger filters, slotSettled/status lines and all After Hours dispatches. Re-applied the deferred opening’s ledger argument. Held-night settlement also ends NPC couples left for the reader. Added persisted/validated deferred opening notes so advice outcomes and transfer counts reach the delayed morning, including after reload. |
| `src/renderer/stores/gameStore.ts` | Incoming transfer-aware semester loading, waiting characters, admission methods, scene redraft/vent state and gender-aware event folding. Core mod slices, unknown save/scene pass-through, game boundary/scene/save bindings, snapshot argument and held-night/chat fields remain. Added all incoming native save/scene keys to ownership lists, plus the new deferred notes field. |
| `src/renderer/stores/loop/exams.ts` | Incoming endingAwaitingTransfers wrapper; kept core’s fetchEndingOpening ledger/context arguments inside it. |
| `src/renderer/stores/loop/promptState.ts` | Incoming romance, reader pronouns and subject tags by gender; retained core ex promptStateParts and conditional textEdits. |
| `src/renderer/stores/sceneSanitizer.ts` | Incoming memoryOn/overTextMemory, gender-aware event folding and closed-relationship dating input. Retained core romance requirements and explicit settled date in both apply and projection, so held-night memories do not move to the already-open morning. |
| `src/renderer/stores/textingLoop.ts` | Kept the shared core textingState/held-reply path and added incoming romance/reader fields there. Kept afterReachOut only after delivered text, then applied incoming vent/crush advice and crushAsked bookkeeping without delivering messages twice. |
| `src/renderer/views/CharacterModal.tsx` | Incoming booru tag labels and tags option; retained traitColors and traitTone. The chip supports both independently. |
| `src/renderer/views/EraseArtifactsModal.tsx` | Retained the core comment explaining the in-progress save guard; incoming modal behavior is merged. No behavior conflict at this hunk. |
| `src/renderer/views/NewGameView.tsx` | Incoming withDatingAttraction import/behavior; retained core postLikes hook and rollPostLikes integration. |
| `src/renderer/views/SettingsAdvancedTab.tsx` | Incoming Other/ending-picture cap control, followed by core’s advancedSettingsEntry ModSlot. |
| `src/renderer/views/TransparencyFixModal.tsx` | Retained the core comment explaining the in-progress save guard; incoming modal behavior is merged. No behavior conflict at this hunk. |
| `src/renderer/views/characterFields.ts` | Incoming Gender and gender-aware field helpers; kept core characterTraitOptions so the picker still includes registered traits. |
| `src/shared/characterRules.ts` | Combined the optional-character keys: both core ex and incoming gender stay optional. |
| `src/shared/characterTransfer.ts` | Incoming truncate/error and pack handling; retained modPartEntryOf, mod manifest fields and mod-part allowance. |
| `src/shared/imagePrompt.ts` | Incoming gender-specific default tags; retained draftedParts around appearance and negatives for sprites, nude outfits and CG sets. |
| `src/shared/llm/cloudLlm.ts` | Kept core withoutLocalFields for parts/sceneSpot/modTags and incoming usageIn accounting as separate complete functions. Incoming provider changes remain; the OpenAI adapter’s core LLM_STOPPED fix is retained. |
| `src/shared/relationship.ts` | Incoming holder gender/pronoun-aware folding, plus core optional romance requirement context and event gate. Both apply and projection pass the new holder argument and core gate context. |
| `src/shared/saveRules.ts` | Kept core RequiredKeys-based native required-key tables, which automatically exclude new optional fields and mod extension fields. Combined record exclusions for mods/modVersions with incoming romance/playerPronouns. |
| `src/shared/settingsRules.ts` | Combined the comment’s incoming graduation-picture cap and core main-owned mod settings. Both sides’ actual optional settings/validation remain. |
| `src/shared/types.ts` | Combined enrollment ex with incoming romance; all auto-merged native fields and core extensions remain. Added optional DeferredOpeningNotes/heldNightOpening/openingNotes to carry delayed opening inputs safely through schema-13 saves. |

## Memory, hook and save compatibility

`cd9ba53c` removes generated `youDesc` and keeps one third-person `desc`. The scene/text ledger schemas and memory voice now follow that format. The native display/edit paths name the reader, preserve unchanged descriptions, and normalize edited names back to “the reader”. Older saved extra fields remain on disk/pass through where applicable, while the new native presentation ignores `youDesc`.

After Hours continues to receive the same ledger/filter/settlement hook contexts. Apply and projection use `memoryOn(date, entry)` with the date being settled, not the store’s already-advanced date. Held replies, ledger ownership, `ledgered`, `late`, `heldNight`, `heldNightLedger`, `morningOpening` and `chatShownThrough` remain. The new optional `heldNightOpening` stores transfer counts and love-life opening inputs while narration is deferred; it is normalized on load/boundary, included in night saves, and removed from the completed morning save. This keeps the incoming native opening behavior across a hold/reload rather than silently dropping its new inputs.

Read Bunnyfeeds’ actual kit-branch hooks and `bunnyfeedsMemory.ts`: its text-ledger additions use character keys; held feed memories use `type`/`desc` and `addMemory`; announcements call the kit’s two-argument `memoryStatusLine`. None of those paths reads `youDesc`. Its `slotSettled`, text-ledger additions and status dispatch remain available; the status helper now supplies the reader’s live name/pronouns before calling the native formatter.

Incoming native signatures would otherwise break existing kit calls. Kept the public signatures of `memoryStatusLine`, `readerize`, `profileLines`, `memoryLines` and `relationshipLines` through thin adapters that call the new native implementations with active reader/romance context. Shared helpers use a host-bound provider; renderer helpers read the current game. There is one native formatting/relationship algorithm, not a second copy. Updated the kit contract’s helper identity checks to the authoritative adapters, retaining exact export-table checks and adding behavior regressions.

Other adaptations outside the conflict list:

- `src/renderer/prompts/promptBlocks.ts`: incoming pronoun-aware scene/narration persona defaults and gender-neutral texting persona, retaining editable blocks and custom persona precedence.
- `src/renderer/mods/sceneInvitations.ts`: passes the character to the incoming four-argument homebound/mood rule.
- `src/shared/opening.ts`, `gameStore` and `loop/saves.ts`: checked/cloned deferred metadata, native ownership and night/morning serialization.
- Core-only tests now pass explicit character gender, reader/romance context, regen gender and the new memory-edit arguments; assertions about mod behavior remain.
- `MODDING.md` now describes the preserved kit signatures and their active-reader context accurately.
- Removed one trailing space from an incoming `RomanceModal.tsx` line; no behavior change.

The dispatch inventory is unchanged: `promptLines` 8→8, `promptFields` 5→5, `promptRequired` 5→5, `slotSettled` 1→1, `interludePreview` 3→3, `slotInterlude` 1→1, `interludeSettled` 1→1, `openingLook` 1→1, `afterReachOut` 1→1, `hangoutCheck` 1→1 and `textWhileBusy` 2→2. This inventory complements the contract/type checks; counts alone are not proof of behavior. The hook shim and registration surface are unchanged. `isBuiltInRow`, the mods browser, `memo(function MessageBubble…)` and `LLM_STOPPED` remain in their original core paths.

## API reports and dependencies

Regenerated `packages/modkit/api/shared.api.md` and `renderer.api.md`; `main.api.md` is unchanged. Kit version remains **0.8.0**. The shared report adds 12 lines; the renderer report adds 12 and removes one (the old subject-tags type).

- Shared report: incoming `Character.gender/attractedTo`, conversation advice, neutral job messages, native save fields (`npcCouples`, transfers/pendingTransfers, scenesSinceRedraft), record pronouns/romance, request raiseThinking, and optional `heldNightOpening`.
- Renderer report: new pronoun/romance/redraft/transfer context, subject tags keyed by gender, and opening people/NPC relationships/transfer count. Existing helper function call signatures are preserved by the adapters above.

Venus Dev changed neither root dependency file relative to the merge base. Kept the target’s existing `test:electron` script; the root lockfile remains byte-identical to `fork/main`. `npm install` and the kit install completed; install churn was not retained. Applied the requested 7za executable permission locally.

## Checks

| Command | Result |
| --- | --- |
| `npm install` | PASS |
| `npm --prefix packages/modkit install` | PASS |
| `chmod +x node_modules/7zip-bin/linux/x64/7za` | Applied; ZIP/backup/loader tests pass |
| `npm run typecheck` | PASS, node/web/test configurations |
| `npm test` (final sequential run) | **2,695 passed, 1 failed, 4 skipped** tests; **218 passed, 1 failed, 3 skipped** files (222 files / 2,700 tests total). No worker-limit or timeout override. |
| `npm run build` | PASS after freeing scratch disk space |
| `npm run build:web` | PASS after freeing scratch disk space |
| `npm --prefix packages/modkit run report` | PASS |
| `npm --prefix packages/modkit run report:check` | PASS; reports up to date |
| Focused opening/application/kit/held-reply/memory/save checks | **220/220 passed**, eight files |
| Conflict-marker scan, unmerged index, diff whitespace checks | PASS; zero markers/unmerged entries |

The sole final failure is unchanged:

```text
FAIL test/mainServices.test.ts > getComfyOutputFilePath >
refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }
test/mainServices.test.ts:182:22

Test Files  1 failed | 218 passed | 3 skipped (222)
     Tests  1 failed | 2695 passed | 4 skipped (2700)
Duration 101.24s
```

Tests used `NODE_USE_ENV_PROXY=1` and the existing local Electron distribution through `ELECTRON_OVERRIDE_DIST_PATH=/workspace/work/mod-audit/electron-dist`. All assertions ran with the normal test settings. The kit contract, mod hooks/readers and loader tests are included in the full suite. The `hookTie.ts` relationship mentioned by the hook-table comments has no separate named file in this checkout; the actual available contract/type checks passed.

Regression coverage includes split generation text/pool overrides, existing kit helper calls with a changing reader and new pronouns, held-night third-person memory dates, and deferred-opening validation/save round trips. The focused integration run passes **220 tests in eight files**. Kept the incoming tests and updated core-only calls for the new signatures; no NPC assertions or test timeouts were weakened.

A concurrent verification attempt hit `ENOSPC` during the desktop renderer output and a native NPC relationship property test exceeded its five-second timeout while builds competed for resources. That run was not accepted. Removed only task-created download caches and shared identical, Git-verified asset copies between the two scratch checkouts; tracked asset contents are unchanged. Re-ran verification sequentially with sufficient disk space. The final run used no worker-limit/timeout override; no NPC assertion or algorithm was weakened.

Searched the project tree for conflict markers and checked both the staged diff and remaining unmerged entries. No markers or unmerged files remain. All source, tests and regenerated reports belong to the merge commit; this report is committed separately, only under `audits/` on `notes/standalone-mods`.

## Limits and uncertainty

- Static inspection plus core/kit regression checks cover the After Hours and Bunnyfeeds seams. A packaged Electron playthrough with the released mod zips and live LLM replies was not run; no such runtime result is claimed.
- The legacy `memoryStatusLine(name, entry)` API supplies a display name rather than a character ID. Its presentation binding uses the first matching active character for holder gender, defaulting to female when absent. Same-first-name characters of different genders cannot be disambiguated by that old call alone; that ambiguity is unverified in a mod playthrough. Native callers with explicit holder context are unaffected.
