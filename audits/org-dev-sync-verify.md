# Org / Venus Dev sync verification

Audited on 21 November 2026. Review only: the sync branch and its source code were not changed; nothing was pushed and no PR/comment was opened or posted.

## Result

**The personal-content audit is clean.** The branch contains the org core and the pinned Venus Dev changes, plus the explicitly authorized compatibility layer and resolution/test adaptations. No disallowed After Hours fields/hooks, mods browser, personal kit release, readerWordsOf/GameFacts extension, LLM-stopped fix, night-ledger reuse or in-repo-mod test allowances were found.

All 35 conflict resolutions preserve core’s extensions alongside Venus Dev’s changes. One non-blocking compatibility limitation is recorded below; no blocking finding was found.

## Revisions and method

- Fork sync head: `e2233416f7b68570d0991aabc9841c044721e46a` (`integrate/vu-main-core-20261121`).
- Org core: `c1e857cc` (the fetched org ref matched the brief).
- Venus Dev endpoint: `2da122cac7ddd996cbee2c441c326040bc027002`. The later fetched dev/main was deliberately excluded from this pinned audit.
- Personal-core comparison: `90d2a5d3c8ca83d4e2a891fdb492dbc7418cfc46`; exactly 22 non-merge personal commits after excluding org core and the pinned Dev ancestry.
- Reference integration: `8c78ca507905108c9f67ab94984e4639aee23683` (#271). Applied its keep-both approach to native changes plus core’s hooks, save/backup boundaries and image drafts.
- Existing remotes in this clone are named `upstream` for the org and `origin` for the fork. Equivalent personal inventory: `git log --no-merges c1e857cc..90d2a5d3 ^2da122ca`.

Recreated an actual detached `git merge --no-commit --no-ff 2da122ca` from org core, leaving its conflicts unresolved. It produced the same 35 original conflicted files. Also generated Git’s conflict-bearing automatic tree, `734cd909c5330a4a3cd2589ada128f768bb16bdd`, and compared that whole tree with the reviewed head.

The head differs from that automatic tree in **59 files: the 35 conflicted files and 24 explicitly accounted-for files below**. Every other file, including binary assets, matches the plain merge. Thus no other file can carry a reused personal resolution or personal asset. The 3,375-line comparison includes the removed conflict markers and duplicate alternatives, not 3,375 independent new lines of behavior. Each resolution and each additional file is accounted for below.

The head’s only commits beyond the sources are two merge commits: `be71a9de` merges Dev `463a1666` into `c1e857cc`, then `e2233416` merges `2da122ca`. None of the 22 personal non-merge commits is an ancestor outside the accepted sources. I also screened their added lines against both allowed sources and reviewed the resulting candidates; ancestry and string searches were not used alone to decide scope.

Read CLAUDE.md, the design and UI guides, and the relevant MODDING sections. No guide or application file was edited.

## Findings

### N1 — note: the one-argument normalizer retains a female breakup holder

**Locations:** `packages/modkit/src/shared/memory.ts:21` and `src/renderer/stores/modsStore.ts:114`.

The shim calls `presentationOf()` without a character name. The bound reader finds no character for undefined, so its holder is female. With a male Sam loaded and a she/her reader, `readerize('the two of you broke up')` returns `she and the reader broke up`; the native helper called with holder=male returns `he and the reader broke up`.

This preserves the old one-argument helper’s female-holder behavior, and the native game still supplies the correct gender to its own calls. However, a mod normalizing a male character’s breakup memory through the legacy kit helper cannot express the holder and can file the wrong pronoun. The current reader’s reflexive (herself/themself) and the named memoryStatusLine binding work correctly in the probes.

**Suggested follow-up:** if this old kit API must cover male-holder breakup memories too, keep its one-argument form and add an optional explicit holder/character context, or provide a separate contextual helper. Do not infer a memory’s owner from the reader’s pronouns. This note requires no personal-core feature to be imported.

**Proof:** throwaway probe 3 compares the two native holder values with the actual modsStore binding. No source change or probe was committed.

## The 35 conflict resolutions

“Yes” below means the relevant behavior survived review; it does not mean every file has a mod hook. A comment/import-only conflict is identified as such.

| File | Core hooks/fields and behavior retained | Venus Dev change retained |
|---|---|---|
| `DESIGN_GUIDE.md` | Core End Scene error/activity restrictions remain in the combined paragraph. | The newer slot-cycle and native End Scene description is retained. |
| `src/main/ipc.ts` | Final-request hooks, mod IPC and installed-mod session remain. | Native generation/service calls and newer argument paths remain; no catalogue IPC added. |
| `src/main/services/characterTransferService.ts` | Mod manifest data, part validation/adoption and atomic zip replacement remain. | New archive member checks, refusal types and adoptedAt are retained, including the call after mod validation. |
| `src/renderer/prompts/characterPrompt.ts` | Registered traits, character fields, additions and designer text edits remain. | Gender-aware drafting, attraction and male outfit/schema rules remain. |
| `src/renderer/prompts/classPrompt.ts` | Catalogue limits and system/instruction/addition edits are threaded into the new parts. | The separate pool, major and interest requests, taken-code restrictions and native reply schemas remain. |
| `src/renderer/prompts/endingPostsPrompt.ts` | Global edits and narration persona override remain. | Reader pronouns reach narrationPersonaFor alongside the edits. |
| `src/renderer/prompts/profilePrompt.ts` | All existing newgame.profiles text IDs remain reachable, including next-semester IDs. | Majors, individual students, returning students and graduates use the new native builders, schemas and gender-neutral wording. |
| `src/renderer/prompts/relationship.ts` | The modBlocked guard and additional romance requirements remain. | Reader/holder pronouns and the native relationship options remain; the new explanatory comment also survives. |
| `src/renderer/prompts/scenePrompt.ts` | Prompt parts, edits, request hooks and fields remain. | Gender/reader-aware JSON rules and persona calls remain; persona implementation moves into core’s existing promptBlocks module. |
| `src/renderer/prompts/secretsPrompt.ts` | Secret instructions/tier edits remain here; system/additions move through profilePrompt’s combined student path. | The newer per-student secret tiers, wording and reply validation remain. |
| `src/renderer/prompts/slotIntroPrompt.ts` | modRequest, per-call mod fields, poster/reach-out lines and global edits remain. | Reader pronouns, romance, people, ages and new-transfer inputs remain; no personal interlude is inserted. |
| `src/renderer/prompts/textLedgerPrompt.ts` | Global text edits remain as the fourth argument. | ReaderPronouns is the third argument and feeds native memory wording; default he keeps older direct calls usable. |
| `src/renderer/prompts/textingPrompt.ts` | History limits, lead/trailing fields, prompt/request hooks and text edits remain. | Native romance, reader pronouns, advice and character-aware prompt inputs remain; persona wording is carried into promptBlocks. |
| `src/renderer/stores/applicationCompose.ts` | world.textEdits and world.classCatalog reach every relevant new request part. | Native partOf/bankedReply and split profile/class generation remain. The two new regression tests exercise both bridges. |
| `src/renderer/stores/characterStore.ts` | Captured registered traits and draft hooks remain. | Subject tags are selected for the character’s gender before draftToCharacter receives both the subject tags and traits. |
| `src/renderer/stores/feedView.ts` | Mod post filtering and outAt tie-break ordering remain. | visibleCouples rows are appended before sorting, alongside native friendship rows. |
| `src/renderer/stores/gameLoop.ts` | Build-error retry gates, projected mod memories, stats hooks, slot status lines, post hooks and stale-run gates remain. | Transfer/age/romance inputs, couple/affair settlement, ignored-vent memories and reader pronouns remain. Both sets of arguments are combined, rather than choosing one side. |
| `src/renderer/stores/gameStore.ts` | Unknown-key pass-through, mod slices, scene fields, load boundaries and parameterized toGameSave remain. | Transfers and pending-transfer actions, NPC couples, redraft, ignored vents and reader/romance state remain. Native save/scene keys are recognized instead of being treated as foreign data. |
| `src/renderer/stores/loop/promptState.ts` | ex from promptStateParts and promptTextEdits remain. | Native romance, reader pronouns, ages and per-gender subject tags remain. |
| `src/renderer/stores/sceneSanitizer.ts` | Mod romance requirements still gate acts and projected milestone events. | genderOf(holder) remains an argument to foldRelationshipEvents; the additional core requirement context is passed after it. |
| `src/renderer/stores/textingLoop.ts` | dmReplyLead cancellation, afterDmReply, afterReachOut and global edits remain. | Native advice/crush bookkeeping follows afterReachOut, including withCrushAsked. Native completion/pacing and cancellation paths remain; no held-reply machinery is present. |
| `src/renderer/views/CharacterModal.tsx` | editCharacterImages slot and registered-trait colors remain. | Native gender/attraction display and tag display changes remain. |
| `src/renderer/views/EraseArtifactsModal.tsx` | The existing core comment explaining the saving guard remains; no mod hook in this conflict. | Native saving/discard/close behavior remains. |
| `src/renderer/views/NewGameView.tsx` | Post-like hook, playthrough mod/version recording and enrollment ex remain. | Native gender/romance choices and winter-post dealing remain. |
| `src/renderer/views/SettingsAdvancedTab.tsx` | advancedSettingsEntry slot receives theme/busy after destructuring all native arguments. | The native backgrounds callback and new settings controls remain. |
| `src/renderer/views/TransparencyFixModal.tsx` | The existing core saving-guard comment remains; no mod hook in this conflict. | Native saving/discard/close behavior remains. |
| `src/renderer/views/characterFields.ts` | characterTraitOptions stays the trait source. | PRONOUNS and the new native gender/attraction types and options remain. |
| `src/shared/characterRules.ts` | Optional ex remains excluded from required character keys. | Native gender/attraction and character validation remain. |
| `src/shared/characterTransfer.ts` | Manifest mod data and classified mod-file entries remain. | Native pack/refusal/member validation and import-entry classification remain. |
| `src/shared/imagePrompt.ts` | draftedParts still augments appearance and default/set negatives, with the character’s own negatives last. | Native gender-specific default groups remain, following the same keep-both rule as #271. |
| `src/shared/llm/cloudLlm.ts` | Local-only mod metadata stripping, sampling overrides and cancellation behavior remain. | Native provider/model/thinking and usage handling remain. Personal LLM_STOPPED edits are absent. |
| `src/shared/relationship.ts` | Mod romance guards and foreign data on rewritten memories remain. | Holder gender, reader pronouns and the native milestone wording remain; holder precedes optional mod context. |
| `src/shared/saveRules.ts` | RequiredKeys continues to exempt optional mod declarations; mod/version record keys remain optional. | Native romance/playerPronouns and newer optional save fields remain optional. Native validators are retained. |
| `src/shared/settingsRules.ts` | Installed-mod settings remain optional. | All native settings validation and the newer native optional keys remain. |
| `src/shared/types.ts` | NativeGameSave plus extensible GameSave, ex slices, mod scene/enrollment fields, request metadata and reach-out extension fields remain. | Gender/attraction, reader pronouns, romance, transfers, couples, redraft and youDesc data are retained. Personal held/night/chat fields are absent. |

The highest-risk joins were checked at their call sites, not just their imports: text-ledger reader pronouns plus global edits; relationship holder plus mod requirement context; native couple/affair settlement plus projected mod memories; ignored vents plus mod status lines; transfer actions plus the parameterized core save writer; native redraft plus core scene records; and native per-gender subject tags plus registered draft traits.

## All 24 additional differences from the automatic merge

| Files | Why the difference is present |
|---|---|
| `packages/modkit/CHANGELOG.md` | One Unreleased compatibility entry; no release/version bump. |
| `packages/modkit/api/renderer.api.md`, `api/shared.api.md` | Regenerated reports reflect native gender/pronoun/romance/transfer fields and updated public prompt types. They pass a clean regeneration. The readerPronouns row belongs to PromptState, not GameFacts. |
| `packages/modkit/src/bridge/renderer.ts`, `src/shared/index.ts` | The five existing public helpers route through the approved compatibility layer; no new public capability is added. Paths here are relative to packages/modkit. |
| `packages/modkit/src/shared/memory.ts`, `memoryPresentation.ts`, `src/host/shared.ts` | Approved memory helpers and isolated setter. The setter module has only a type import of native shared code, preventing the load-time cycle. Paths here are relative to packages/modkit. |
| `src/renderer/mods/promptReaders.ts` | Three approved old-arity prompt readers supply the active native reader/romance context. |
| `src/renderer/stores/modsStore.ts` | Binds reader name/pronouns and a named character’s gender to the approved shared helper layer. |
| `src/renderer/mods/sceneInvitations.ts` | Passes character plus charInfo into native isHomebound’s new signature. |
| `src/renderer/prompts/promptBlocks.ts` | Moves Dev’s persona/pronoun wording into core’s editable persona blocks and forwards reader pronouns. |
| `test/applicationCompose.test.ts` | Two regression checks for text edits and catalogue limits surviving the new split generation. |
| `test/backupImportPreflight.test.ts`, `characterTraits.test.ts`, `characterTransferPart.test.ts`, `dmHistoryWindow.test.ts`, `imagePromptDrafts.test.ts`, `romanceRequirements.test.ts`, `savePassThrough.test.ts` | Calls/fixtures updated for the new native gender, pronoun, subject-tag or relationship arguments. No in-repo-mod allowances. Test paths are relative to test/. |
| `test/kit/contract.test.ts` | Contract assertions now name the approved adapters, while untouched helpers remain native exports. |
| `test/kit/memoryPresentation.test.ts`, `promptReaders.test.ts` | Five adapter regression tests. Second path is relative to test/kit/. |
| `test/sceneSanitizer.test.ts` | A blank-line-only difference; no test behavior change. A separate blank line in savePassThrough is also inert. |

This accounts for every path outside the 35 conflicts. The compatibility layer is the explicit exception permitted by the brief, including the host/shared split from personal commit 82f97264. No additional personal feature is needed to make it load.

## Personal additions checked

The hook table (including KIT_APIS), kit version source, kit package.json and lockfile are byte-identical to org core. The kit remains **0.7.0**. The game’s native 0.8.0 package version is separate from the prohibited personal kit bumps.

`src/renderer/mods/readers.ts` is also byte-identical to org core: gameFacts has only playthroughId/readerName, with no personal GameFacts.readerPronouns. readerWordsOf is absent. Native playerPronouns and PromptState.readerPronouns are required Venus Dev data and remain.

All named After Hours identifiers were checked in src, packages and tests. The sole relaxLine match is the pre-existing private function in `src/renderer/stores/loop/relax.ts`, which is byte-identical to org core; it is not a hook. No held/night interlude state, personal bank/reuse path or personal chat clock exists. The mods browser’s catalog.ts, Browse views, covers and screenshots are absent; all shipped assets match the plain source merge.

The personal LLM-stopped edit is absent: silentRetry.ts and openaiAdapter.ts are byte-identical to org core, and no LLM_STOPPED symbol was found. The in-repo-mod allowance files—mods.test, installedMods, devFolderReload, enterGame and replayStay—are byte-identical to org core.

| Personal commit | Change | Result |
|---|---|---|
| `342ef46b` | core: expose reader pronouns to mods | Absent. A matching renderer report line describes native PromptState.readerPronouns; GameFacts and readerWordsOf are unchanged/absent. |
| `82f97264` | core: keep the memory presentation setter apart from the game's shared code | Only the explicitly authorized memoryPresentation split/setter is reused; no personal commit ancestry. |
| `80d0f2ed` | core: a reloaded night's kept ledger stops the cast step paying for it again (restored) | Personal change absent; checked against the patch and the plain-merge comparison. |
| `0d2ad7f2` | Revert "core: a reloaded night's kept ledger stops the cast step paying for it again" | Personal change absent; checked against the patch and the plain-merge comparison. |
| `7e9d2bda` | core: a reloaded night's kept ledger stops the cast step paying for it again | Personal change absent; checked against the patch and the plain-merge comparison. |
| `e29dabb4` | naudh1r-core: screenshots in the mods browser fill their frame again | Personal change absent; checked against the patch and the plain-merge comparison. |
| `e206d5e0` | naudh1r-core: screenshots in the mods browser have an outline and show whole | Personal change absent; checked against the patch and the plain-merge comparison. |
| `3a52e330` | naudh1r-core: a mod's description keeps its line breaks in the mods browser | Personal change absent; checked against the patch and the plain-merge comparison. |
| `73036511` | core: keep a night's paid ledger and its finished morning opening on the save, so a reload pays for neither again | Personal change absent; checked against the patch and the plain-merge comparison. |
| `c4fc0a6d` | core: refuse a save whose held-reply, late-night, chat-clock or opening fields are malformed | Personal change absent; checked against the patch and the plain-merge comparison. |
| `17aaed30` | core: resume a save's held replies only once its lorebook has been read | Personal change absent; checked against the patch and the plain-merge comparison. |
| `180e75b1` | naudh1r-core: the mods test allows an in-repo mod that is on by default | Personal change absent; checked against the patch and the plain-merge comparison. |
| `932f21ef` | naudh1r-core: drop main's model-kit fixture from two game tests | Personal change absent; checked against the patch and the plain-merge comparison. |
| `270436e9` | naudh1r-core: the game tests that read MODS allow in-repo mods | Personal change absent; checked against the patch and the plain-merge comparison. |
| `debab21d` | naudh1r-core: kit 0.8.0, one ahead of the org's 0.7.0 | Personal change absent; checked against the patch and the plain-merge comparison. |
| `312097d9` | Mods catalogue: test against the kit this build carries | Personal change absent; checked against the patch and the plain-merge comparison. |
| `23a162c5` | core: After Hours' game and kit changes, on core | Personal change absent; checked against the patch and the plain-merge comparison. |
| `5c64191f` | core: a reply the endpoint stopped without a reason can be edited | Personal change absent; checked against the patch and the plain-merge comparison. |
| `72b2a7e3` | Show a mod's screenshots on its catalogue page | Personal change absent; checked against the patch and the plain-merge comparison. |
| `0f5fda14` | Give covers without art their initials and a tone each, and say All mods on the way back | Personal change absent; checked against the patch and the plain-merge comparison. |
| `0f9b588c` | Present the mod catalogue as a store with covers and mod pages | Personal change absent; checked against the patch and the plain-merge comparison. |
| `93fac725` | Prototype a mod catalogue with verified installs and updates | Personal change absent; checked against the patch and the plain-merge comparison. |

## Automated checks

| Check | Result |
|---|---|
| Plain org-core + pinned Venus Dev merge | ✅ Reproduced exactly 35 conflicted files |
| Typecheck | ✅ All three projects |
| Full npm test | ✅ No unexpected failures: 2,634 passed, four skipped; only the brief’s permitted Linux exception |
| Focused kit tests | ✅ 207 passed across 19 files |
| Throwaway probes | ✅ 3/3 passed |
| Kit report:check, dist deleted first | ✅ All three API entries |
| Desktop build | ✅ Passed |
| Web build | ✅ Passed |
| Electron under xvfb-run | ✅ 42/42; fixture explicitly contains noNsfwImages=false and lessNsfwText=false |


Both settings keys are present in test/e2e/mods.e2e.mjs’s SETTINGS object. The Electron run used the branch’s unmodified runner, which writes them explicitly into its temporary settings.json; no player data was used. Electron reports “Every check passed.”

The initial kit dependency install ran out of workspace space. After freeing unused dependencies and sharing identical scratch assets, its install and clean report check both succeeded. The final report result uses that successful rerun. Typecheck, both builds and the full source suite ran without source edits. A mistaken import in the first throwaway probe fixture was corrected; the three probes then passed. The 207 kit tests had already passed separately from those fixture errors.

### Throwaway probe reproduction

The probes tested (1) actual modsStore binding across a changed reader name/pronouns, (2) redraft/ignored-vent fields and unknown save/mod data through load/save, and (3) the normalizer limit in N1. The scratch source and logs are retained outside the repository at `/workspace/org-dev-sync-verify-logs/`.

To rerun the minimal N1 proof in an installed checkout of e2233416, create this temporary file as test/syncReaderizeProbe.test.ts, run `npx vitest run test/syncReaderizeProbe.test.ts`, then remove it:

```ts
import { expect, it } from 'vitest'
import { character, stubApi } from './fixtures'
import { readerize as nativeReaderize } from '@shared/readerVoice'
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../src/renderer/stores/gameStore')
await import('../src/renderer/stores/modsStore')
const { readerize } = await import('@vx/modkit/shared')
it('records the legacy holder used by the one-argument adapter', () => {
  useGameStore.getState().reset()
  useGameStore.setState({ playerPronouns: 'she', characters: {
    sam: character({ charId: 'sam', firstName: 'Sam', gender: 'male' })
  } })
  const text = 'the two of you broke up'
  expect(readerize(text)).toBe(nativeReaderize(text, 'female', 'she'))
  expect(readerize(text)).not.toBe(nativeReaderize(text, 'male', 'she'))
})
```

## Uncertainty and limits

- The source and automated evidence support the stated absence of personal content and the 35 keep-both resolutions. No unresolved scope or conflict-resolution question remains from this audit.
- N1 is a reproduced legacy-interface limitation. Whether mods need to normalize male-holder breakup memories through that old one-argument API is a compatibility-policy question; this audit does not assume they do not.
- No live LLM, ComfyUI generation or interactive playthrough was run. The Electron suite exercises the real built app with fixture mods and temporary settings.

## Delivery

Only `audits/org-dev-sync-verify.md` is committed on the fork clone’s local `notes/standalone-mods` branch, with author and committer Naudh1r <102735014+naudh1r@users.noreply.github.com> and no co-author lines. No push was performed. Detached audit worktrees and the notes worktree are removed after delivery; existing checkouts retain their branches and clean tracked state.
