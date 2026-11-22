# PR #339 versus naudh1r-core: Venus Dev 0.9.2

Audited 22 November 2026. Review only; no code edits, pushes, GitHub comments or PR actions.

| Source | Pinned revision |
|---|---|
| Org #339 | `6933037d796cc7f69ef20f695c0f3ad4707482fc` |
| Its org core base | `afa43b06a384187b1dd277f2aba1ce095ccc145e` |
| Fork naudh1r-core | `5a0d1c70c27f4b2fc395c6892f62a01a8df1ca2b` |
| Official Venus Dev reference | `7615a5a6d3097c642ab07f2cf17167cb0c104bb9` |

Read #339’s complete description, its Review follow-up and morrowkiln’s review of 582518fe. The findings below concern the pinned final heads, not the older reviewed head. Read the repository instructions and relevant design, UI and modding guidance. Only this report is committed, under audits/ on notes/standalone-mods.

**Summary:** both heads match all **143 complete, unedited upstream request cases**, the texting persona, six scene-persona variants and both ledger-persona variants. The differences found concern compatibility and edited requests. The fork has concrete legacy request/type and context omissions. #339 keeps the old helper defaults, while the fork’s adapters use the current game’s reader/romance context; Part 2 records those measured differences as review notes with an explicit policy question.

The two numbered parts below each include their own revision, trigger, location and suggested change so they can be used independently.

## 1. Gaps in naudh1r-core

This part compares fork `5a0d1c70` with org #339 `6933037d`, both integrating official `7615a5a6`. Personal After Hours behavior, the mods browser, kit-only node packs/options and unrelated personal fixes are excluded. No request-spacing or texting-persona defect was reproduced on this fork head.

### F1. Global text edits stop before transfer generation

**Locations on 5a0d1c70:** `src/renderer/stores/transferCompose.ts:98`, `:202`, `:228`, `:412`, `:434`; `src/renderer/stores/loop/transfers.ts:153`.

TransferContext has no textEdits, contextOf does not capture promptTextEdits, and the majors, student/profile-secrets, interest-course and major-course builders receive no edits argument. Supplying `newgame.profiles.system=PROFILE_MARKER`, `newgame.secrets.system=SECRET_MARKER` and `newgame.classes.instructions=CLASS_MARKER` changes the corresponding #339 requests. The same four fork requests contain none of those markers, even if an extra textEdits property is supplied at runtime.

A mod’s New Game edits therefore do not reach a transfer student’s generation. #339 captures the enabled global edits and forwards them through all four requests, including the native transfer entry point. Its native-entry regression test passes in the full suite.

**Suggested fix:** add optional TextEdits<GlobalTextId> to TransferContext, capture promptTextEdits()?.global in contextOf, and pass ctx.textEdits to all four builders. Preserve the existing schemas and empty-edit behavior.

### F2. PromptState.subjectTags breaks the old list contract

**Locations:** `src/renderer/prompts/scenePrompt.ts:399`, `:659`; `src/renderer/stores/loop/promptState.ts:595`; `packages/modkit/api/renderer.api.md:948`.

The kit’s former `readonly string[]` is now a female/male record. An old typed consumer assigning `subjectTags: ['legacy_subject']` fails with TS2739. A compiled old consumer still sending that list is also handled incorrectly: the cast builder reads `subjectTags[gender]`, gets undefined and leaves `legacy_subject` in the character’s Appearance prompt. The #339 request removes it correctly. Reading `.includes()` on the live fork value would also encounter a record rather than the documented former list.

#339 retains subjectTags as the legacy list, adds subjectTagsByGender, and chooses the appropriate list without changing normal native gender-aware prompts.

**Suggested fix:** adopt the separate fields and fallback behavior; regenerate the public report. Keep the legacy array accepted at runtime as well as in types.

### F3. The legacy structured-request contract is only partly preserved

**Locations:** `src/shared/types.ts:84`; `src/shared/providers.ts:417`; `src/shared/llm/cloudLlm.ts:223`; the StructuredRequest re-export in `packages/modkit/src/bridge/shared.ts`.

There are two reproducible source/runtime breaks:

1. A mod importing StructuredRequest and declaring `{ system, user, schema }` now fails with TS2741 because thinking is required. The optional-thinking parameter types on completeStructured and completeModStructured do not repair the separately exported shared type. #339 accepts the same declaration.
2. `minThinking` is absent from the fork’s request type and resolver. An old request containing `minThinking: 'medium'` fails with TS2561. An existing compiled bundle still sends the property, but the fork ignores it: with a custom endpoint’s Scenes level set to low, it resolves to **low**; #339 resolves to **medium**. The same difference is present through the main-side mod request wrapper. Under lowLatency=true, #339 still honors the explicit floor; the fork resolves to minimal.

**Suggested fix:** expose a backwards-compatible mod request type with optional thinking and legacy minThinking; retain the required thinking row on the game’s native type if desired. Forward and resolve the legacy floor against the actual model’s supported levels, as #339 does. New native requests that set a row and no floor should keep their 0.9.2 behavior.

### F4. Explicit undefined defeats the fork’s thinking default

**Locations:** `src/renderer/mods/llm.ts:16`; `src/main/mods/structuredRequest.ts:16`.

Both wrappers build `{ thinking: 'scenes', ...request }`. A genuinely absent thinking property works. A common optional-property object, `{ ...request, thinking: undefined }`, overwrites that default.

With a custom endpoint’s Scenes row set to high, the renderer probe and the main-side probe both resolve this explicit-undefined request to **minimal** on the fork and **high** on #339. #339’s resolver defaults an undefined argument to scenes, so an omitted property and an explicitly undefined one behave alike.

**Suggested fix:** normalize after spreading: `{ ...request, thinking: request.thinking ?? 'scenes' }` in both wrappers, or apply the equivalent default in the provider resolver. Preserve a caller’s defined row/fixed level. Ordinary lowLatency calls already resolve to minimal on both heads.

### F5. defaultBlockText resets pronoun-aware personas to he/him

**Locations:** `src/renderer/prompts/promptBlocks.ts:748–758`; `packages/modkit/api/renderer.api.md:205`.

The settings type has no readerPronouns field and the scene/narration branches call personaFor without one. Calling the helper with a she or they reader at runtime still returns “things he does and says.” If a mod saves that reset result as an explicit edit, it overrides the otherwise correct live persona.

There are eight measured reset differences: scene and narration × she/they × lessNsfwText false/true. The live persona builders themselves match official upstream in all six reader/content-setting variants.

**Suggested fix:** add optional readerPronouns to the settings argument and forward it for scene/narration resets, retaining the custom scene-persona override and the old optional-reader call shape. #339 does this and reports the type correctly.

### F6. Scene-exchange context lacks native gender and reader pronouns

**Locations:** `src/renderer/mods/sceneExchange.ts:45`, `:50`, `:59`, `:66`.

For a male Sam in a she/her game, the fork’s detached context has neither `people[i].profile.gender` nor `scene.readerPronouns`. #339 returns male and she. The same results were observed for a synthetic Creator context without a story playthrough; a character whose name is not known remains represented without changing nameKnown.

A mod composing a scene request from this restricted context has no corresponding identity fields to use. The personal GameFacts addition elsewhere is outside this comparison and is not needed for the #339 solution.

**Suggested fix:** add normalized genderOf(person) to each profile and the current reader pronouns to scene, update the context type/report, and retain the detached clone. #339’s test also checks that mutating the returned gender cannot mutate the character.

### F7. Two-argument memory status lines change voice

**Location:** `packages/modkit/src/shared/memory.ts:15–16`.

For `{ type: 'liked', desc: 'the reader was kind' }`, the same two-argument kit call produces:

```text
#339:           Sarah liked that you were kind.
naudh1r-core:   Sarah liked that Alex was kind.
```

The fork supplies the active reader’s name to the native helper, selecting its new third-person fallback. #339 distinguishes a legacy two-argument call and keeps its former second-person status wording. Entries with an explicit youDesc may already display second-person wording on the fork; the reproduced case has none.

**Suggested fix:** retain the old two-argument voice in the kit adapter, for example by supplying the compatible spoken description, while leaving the native game’s explicit-argument calls unchanged. This is an observable presentation-compatibility difference, not lost saved data.

### F8. A combined profile/secrets request drops one system edit

**Location:** `src/renderer/prompts/profilePrompt.ts:450–451`.

Build one student with a profile field and a secret tier, supplying both `newgame.profiles.system=PROFILE_MARKER` and `newgame.secrets.system=SECRET_MARKER`. The fork first selects the secret role, then replaces it with the profile role. Its final system contains PROFILE_MARKER only. #339’s final system contains both markers.

Two enabled mods editing those separate existing blocks can therefore overwrite one another on the fork’s combined request even though both blocks individually work. This is separate from F1; it also affects New Game, where edits do reach the builder.

**Suggested fix:** combine the explicitly edited profile and secret systems deliberately, as #339’s studentSystem does, and append each additions block once. Keep the unedited combined native role byte-for-byte; both current heads already pass the unedited parity cases.

## 2. Gaps in #339

This part concerns org head `6933037d` against fork `5a0d1c70`. Both heads pass the 143 unedited official `7615a5a6` request cases and their own typechecks/API checks. The examples below use public kit calls in an active playthrough; the fork’s comparison behavior comes from its small prompt/memory adapters, without needing its personal features.

**Scope and priority:** these are active-game context-consistency notes. Each old call still compiles and runs on #339, which deliberately preserves legacy defaults. Whether an old-arity kit reader should automatically follow the current game’s reader/romance settings is an API-policy question. The outputs below are measured. None of these observations shows a defect in the native game’s full-context calls or a failed upstream prompt fingerprint.

### O1. Old memory helpers use he/him in a she/her game

**Locations on 6933037d:** `src/shared/readerVoice.ts:84–87`; `src/renderer/prompts/scenePrompt.ts:1100–1105`. They are re-exported through the kit.

With playerPronouns=she, the public calls give:

```ts
readerize('you were kind to yourself')
// #339:         'the reader was kind to himself'
// naudh1r-core: 'the reader was kind to herself'

memoryLines(character, [
  { date: 1, type: 'liked', desc: 'you were kind to yourself' }
], undefined, 'spring')
// #339's memory line ends in 'himself'; the fork's ends in 'herself'.
```

The defaults on the native functions are he. The fork’s kit adapters supply useGameStore.getState().playerPronouns. #339 also accepts explicit new pronoun arguments, which is a workaround for a caller that already has the context.

**Suggested fix:** bind the old kit forms to the current reader through a small kit/game adapter, with the old defaults when no game is loaded. Keep the native explicit-argument functions and native request builders unchanged.

**Suggested review comment:**

> Could the old kit forms of readerize and memoryLines take the active reader’s pronouns? On 6933037d, in a she/her game, readerize('you were kind to yourself') returns “the reader was kind to himself”; the four-argument memoryLines call does the same. The native explicit-argument calls are correct. A kit adapter supplying the current reader would keep the old call shape while matching the playthrough. If preserving the old default independently of the current game is intentional, please document that expectation.

### O2. The positional relationship helper bypasses the playthrough’s romance gate

**Location:** `src/renderer/prompts/relationship.ts:222–231`.

Set female romance to none, use a female character with hasMet=true and no romantic history, then call the old positional `relationshipLines(character, flags, true, 0, undefined, stats)` through the kit. #339 sets romanceable=true in its legacy context and emits no permanent-refusal line. The fork computes isRomanceable with the active game and emits:

```text
Sarah doesn't feel any attraction towards the reader and never will.
Sarah won't make or accept romantic advances.
```

The fork’s output equals the native helper called with the game’s actual context. #339’s native callers already pass that full context and are correct; this case is the positional mod path.

**Suggested fix:** have the kit’s positional adapter derive current romanceability, reader pronouns and loyalty, while retaining the explicit created-scene attractionGate=false override. Keep the new-context native path unchanged.

**Suggested review comment:**

> Could the positional kit relationshipLines call use the current romance settings? With female romance set to none and no existing romantic history, relationshipLines(character, flags, true, 0, undefined, stats) takes romanceable=true at lines 222–231, so it omits the refusal that the native full-context call includes. The fork’s adapter supplies the current context. This would let an older mod use the same romance rules as the rest of the playthrough without changing its call shape.

### O3. The positional profile helper uses base attraction rather than active-game attraction

**Location:** `src/renderer/prompts/scenePrompt.ts:909–913`.

Use a female character whose base attraction is straight, set female romance to all, and use a she/her reader. The old `profileLines(character, flags, 1)` kit call says “Sarah is straight” on #339. The fork and the native helper with attractionInPlay say “Sarah is bisexual” under those playthrough rules. The probe compares the entire returned array, not just whether the call succeeds.

The numeric legacy argument chooses attractionOf(character), while the fork adapter supplies attractionInPlay(character, current info/flags, game.romance, game.playerPronouns).

**Suggested fix:** resolve the active attraction in the kit’s old numeric/omitted-argument form; keep an explicitly supplied new attraction record authoritative and leave the native game’s full-context calls unchanged.

**Suggested review comment:**

> Could the old numeric profileLines form use attractionInPlay for the current game? For a base-straight female character with female romance set to all and a she/her reader, profileLines(character, flags, 1) still says she is straight on 6933037d. The native call supplied with the playthrough’s attraction, and the fork’s adapter, both describe the effective bisexual attraction. The difference is the fallback at lines 909–913; an adapter could handle the old form while keeping explicit attraction arguments intact.

### Other #339 type-design difference already acknowledged in the review

`src/shared/types.ts:82` makes thinking optional on the game’s StructuredRequest too. The fork keeps the game type required and makes only the two mod request parameters optional. Thus the fork retains upstream’s compile-time check against a game request forgetting its thinking row, although its separately exported kit type also breaks an old mod declaration (Part 1’s typed-request case).

A separate native request type and backwards-compatible public mod request type could retain both guarantees. #339’s description explicitly leaves the optional cleanup/API-design observations separate, and morrowkiln’s earlier review treated this point as non-blocking. This report does not turn it into another required follow-up.

## Item-by-item comparison

| Item from the brief | #339 at 6933037d | naudh1r-core at 5a0d1c70 | Same behavior for a mod? |
|---|---|---|---|
| memoryStatusLine, two arguments | Preserves legacy second person; accepts explicit new context too | Old-arity wrapper supplies current reader name/gender/pronouns | No: you versus Alex for a legacy desc without youDesc |
| readerize, one argument | Native defaults female/he; accepts explicit holder/reader | Kit wrapper supplies current reader pronouns; unnamed holder falls back female | No for a non-he reader; both legacy forms retain a female-holder assumption |
| relationshipLines, positional | Overload in native helper; legacy romanceable=true, reader=he | Kit adapter computes current romanceability, loyalty and reader | Calling shape preserved on both; context differs |
| memoryLines, four arguments | Reader defaults he; optional fifth reader available | Four-argument adapter supplies current reader | No for a non-he reader |
| profileLines, numeric third argument | Overload uses base attraction; accepts explicit new attraction record | Adapter supplies active attraction, keeps numeric cast size | No when playthrough attraction differs from base |
| Renderer completeStructured, omitted thinking | Public request permits omission; provider resolver defaults scenes | Mod parameter permits omission; wrapper inserts scenes | Yes for a genuinely omitted property; explicit undefined differs |
| Main completeModStructured, omitted thinking | Resolver defaults scenes; lowLatency lowers the Scenes settings | Wrapper inserts scenes; same lowLatency settings override | Yes normally; explicit undefined differs at normal latency |
| Legacy shared StructuredRequest declaration | Thinking remains optional; minThinking retained | Shared type requires thinking; only the two mod function arguments relax it | No: the old typed declaration fails on the fork |
| Legacy minThinking floors | Resolved/clamped against the actual model, only when supplied | Type removed and property ignored by the resolver | No: medium floor resolves medium versus low in the probe |
| subject-tag lists | Keeps subjectTags list and adds subjectTagsByGender | Changes subjectTags itself to a gender record | No for an old array consumer |
| Scene-exchange gender/pronouns | Normalized gender and scene.readerPronouns; detached, including unmet participants and Creator | Both fields absent from context | No |
| Texting persona follow-up | Verbatim official fixture | Verbatim same official fixture | Yes |
| Interest-class spacing follow-up | Exact in all measured requests | Already exact in all measured requests | Yes; no fork defect reproduced |
| Selective free-time spacing follow-up | Exact across all measured haunt masks | Already exact across the same masks | Yes |
| Later-semester newcomer spacing follow-up | Blank addition omitted | Already filters a blank addition | Yes with no edits |
| Transfer global edits follow-up | Captured at native entry, passed through all four calls | Context and forwarding absent | No |
| defaultBlockText pronouns follow-up | Optional readerPronouns, custom scene persona preserved | No reader argument; resets use he | No: eight scene/narration reset variants differ |
| Mod-loader test race follow-up | modsServiceRules fixture waits for startup known.json | No background known.json writer exists on this fork | The particular race is inapplicable to the fork |
| Combined profile/secrets system edits | Retains both independently supplied system blocks | Profile system can replace secret system | No when both are edited |

The fork’s wrapper-only kit exposes the old helper shapes. #339 exposes those shapes plus the optional new native context arguments. They are not fully interchangeable APIs even where the ordinary legacy call works on both.

## Core hooks and fields through the integration

Compared the original core calls and fields at afa43b06 with both heads using TypeScript syntax trees, then checked the differing joins in source. Counting a call alone was not treated as proof that edits reach the request; transfer forwarding and combined systems were exercised separately.

| File/area | What survived on both / differences |
|---|---|
| gameLoop.ts | All ten imported core hook calls remain: filterSceneLedger, promptTextEdits, exercisedStats, projectSlotMemories, settleSceneStats, slotActivityAvailable, slotSettled, slotStatusLines, gameEntered and playerActs. Four buildOrAsk sites remain on each. Native pronouns/romance, transfers and couple/affair settlement are retained. |
| gameStore.ts | read/writeModSlices, bindGameBoundary, bindSaveFieldStore, bindSceneFieldStore and both sceneCut sites remain. Unknown save/scene fields, ex data and the parameterized save writer remain. |
| textingLoop.ts | afterReachOut, dmReplyLead and promptTextEdits each remain at one call site. afterDmReply has one ordinary site on #339 and two mutually exclusive held/ordinary sites on the fork; the held branch returns before the ordinary call. That additional branch belongs to personal After Hours scope. |
| slotIntroPrompt.ts | modRequest, promptFields, promptRequired and all three promptLines sites remain. The fork additionally supplies its personal ledger context. |
| scenePrompt.ts | Three modRequest sites and both promptLines sites remain, with native thinking rows and mod request parts. The exposed subjectTags shape differs as recorded above. |
| promptState.ts | promptStateParts('scene') and promptTextEdits remain. Native romance/reader/age fields survive. Subject-tag representation differs. Fork chat visibility/night logic is personal scope. |
| sceneSanitizer.ts | Mod romance requirements still gate intimate acts and projected milestone events alongside the native holder gender. The fork’s explicit date support belongs to its personal night settlement; the normal default remains the game date. |
| saveRules.ts | RequiredKeys still allows optional declared mod fields. Native optional romance/pronoun/transfer data remain optional. Personal held/night validation on the fork is excluded. |
| types.ts / key lists | Every original core property is retained on both in Character, NativeGameSave, SceneState, PlaythroughRecord, ModSlice and the extension interfaces. The fork loses StructuredRequest.minThinking, recorded in Part 1. |
| promptBlocks.ts | Existing text IDs and persona edit boundaries remain. Both heads preserve the measured unedited native text. Edited combined systems and default persona resets differ. |
| settingsRules.ts | Native settings and optional core installed-mod fields remain. The core mods-known feature’s additional optional field is separate from Venus Dev’s integration and absent from this fork’s older org base. |

SAVE_KEYS has 60 baseline names, all present: 64 on #339 and 69 on the fork. SCENE_KEYS has 41 baseline names, all present: 43 on #339 and 44 on the fork. Both explicitly recognize transfers, pendingTransfers, scenesSinceRedraft, npcCouples, ignoredVents and redraft, so they are not stranded in the unknown-key remainder. The fork’s additional keys are personal features, not missing requirements for #339.

Core advanced from c1e857cc to afa43b06 through #335 (installation-plan documentation) and #337 (known-mod recording). The fork does not include that later known-mod writer: startModSession ends after bindModSession at line 85, whereas #339 starts recordKnownMods at line 86. Therefore the missing wait in the fork’s modsServiceRules fixture is not evidence of the same race. Do not copy the wait there without the corresponding runtime writer.

## Upstream prompt parity: every measured difference

The oracle was regenerated independently from official 7615a5a6 Git objects, including its transitive source imports. It exactly matches #339’s committed upstream fixture. The test inputs/case names are #339’s newGamePromptCases; all mods were switched off and no edits supplied.

| Measurement | #339 | naudh1r-core |
|---|---|---|
| Complete New Game request fingerprints | ✅ 143/143 exact | ✅ 143/143 exact |
| Complete texting persona | ✅ exact | ✅ exact |
| Live scene/narration persona: he/she/they × both content settings | ✅ 6/6 exact | ✅ 6/6 exact |
| Ledger/solo persona: both content settings | ✅ 2/2 exact | ✅ 2/2 exact |

**List of differences in these unedited measurements: none.** Fingerprints ignore object-key order and retain every request value, schema array, thinking row, cache key and exact whitespace. The 143 cases cover male/female profiles, all profile fields, all 32 haunt masks, secret tiers, returning/graduate requests, later-semester newcomers, majors and class parts, including existing-course context.

This result does not claim exhaustive equality for every gameplay request or personal interlude. The persona reset helper’s eight differences occur when explicitly resetting a non-he reader’s stored text; the live builders already use the right persona. Transfer and combined-system edit defects require edits, so they do not contradict the no-edit parity result.

## What ran

| Check on pinned, unmodified source | #339 | naudh1r-core |
|---|---|---|
| npm run typecheck | ✅ all three projects | ✅ all three projects |
| npm test | 2,803 passed / 4 skipped / 1 known Linux failure; 218 files | 2,715 passed / 4 skipped / 1 known Linux failure; 223 files |
| Kit report:check, dist deleted first | ✅ all three reports | ✅ all three reports |
| Throwaway request/persona capture | ✅ 1/1 | ✅ 1/1 |
| Throwaway public-kit/context/transfer capture | ✅ 1/1 | ✅ 1/1 |
| Throwaway main wrapper capture | ✅ 1/1 | ✅ 1/1 |
| Old public-consumer type probe | ✅ accepted | Reproduced three errors: list shape, minThinking, required thinking |

The sole full-suite failure on each head is the known Linux `mainServices.test.ts > getComfyOutputFilePath` Windows-path assertion. There were no other failures or unhandled-error reports. Full tests ran before adding temporary probes, so the probes do not inflate the source-suite counts.

The main-side probe mocks provider I/O and records the wrapper’s actual arguments, then uses each head’s real reasoningToSend resolver. Renderer calls use the synthetic bridge. No real model call, key, player save or installed player build was used.

Root package.json/package-lock.json are identical between heads; kit dependency locks differ only in the package’s own version. To stay within disk limits, dependency trees were reused, with each head running its own root and kit npm install --no-save. Source files, per-head API dist generation and test processes were separate. Each report check deleted that head’s kit dist first. The final source worktrees are clean and all temporary test files are removed.

Additional cross-head evidence: 26 explicit comparison assertions passed over the captured outputs; syntax inventories account for the named hooks and native/core field lists. Builds and Electron were not run for this task; the brief requests typecheck, tests and API reports on each head, and prior PR/audit build results were not reused as current verification.

## Reproduction and evidence

The external `/workspace/pr339-comparison-logs/` directory holds the PR description/review, head-specific check logs and exit codes, the 143 complete oracle requests, actual head requests/personas, API/main captures, hook/field inventories and these throwaway sources/runners:

- `generate-oracle.mjs` and `generate-personas.mjs`: official source oracle, using the pinned Git objects rather than either candidate’s text.
- `pr339Cases.ts`, `pr339Capture.test.ts`, `run-capture.py`: the exact 143 cases and persona capture on each head.
- `pr339ApiProbe.test.ts`, `run-api-probe.py`: old helper forms, legacy subject list, ordinary/Creator context, combined system edits, transfer builders, resets and renderer thinking.
- `pr339MainProbe.test.ts`, `run-main-probe.py`: main-side missing/undefined thinking and reasoning floors at both latency settings.
- `pr339ConsumerProbe.ts`, `run-type-probe.py`: the old public source consumer. Run this consumer under each head’s test typecheck; the three reported fork errors are expected reproduction results, not failures in the untouched fork suite.

To rerun with recreated installed worktrees at `/workspace/compare-339-org` and `/workspace/compare-339-fork`, invoke each run-*.py with org or fork. The runners copy only new, temporary files into test/ (and the temporary cases helper into test/fixtures/) and remove them in finally. Run npm test and the ordinary typechecks without those temporary files. All report locations above refer to the pinned source heads.

## Scope and uncertainty

The personal inventory `git log --no-merges afa43b06..5a0d1c70 ^7615a5a6` contains 23 commits. After Hours hooks/fields and their scheduling, the mods browser, kit 0.8.0–0.8.2 releases, readerWordsOf, personal GameFacts.readerPronouns, ComfyUI node packs/optionControls/external-pack behavior, the personal LLM-stopped/night-ledger fixes and in-repo-mod test allowances are excluded as requested. The memory/prompt/LLM adapters are compared because they solve the same upstream compatibility problem.

Uncertain policy is confined to Part 2’s old-arity context defaults: #339 preserves legacy assumptions and exposes explicit new arguments; the fork follows the active playthrough implicitly. The concrete outputs are proven, but the report does not decide the project’s intended contract for that choice. No unsupported claim is made that #339’s native game requests misgender the reader or ignore romance settings.

The request corpus is finite. Full scene/texting/slot-intro gameplay permutations, actual providers, Windows execution, live UI gameplay and personal-feature parity were not exhaustively exercised. The mod-loader race’s fork inapplicability is established from source; no Windows race reproduction was attempted.

Only audits/pr339-comparison.md is added on the fork clone’s local notes/standalone-mods. The notes history is reconciled with the current fork notes tip without reintroducing or changing other report content. Author and committer are Naudh1r <102735014+naudh1r@users.noreply.github.com>; no co-author line. Nothing is pushed or posted, and no source branch is changed.
