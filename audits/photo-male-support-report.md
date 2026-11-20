# Photo Feature 1.8.0 — male support

## Commits and scope

- Code branch: `mod/photo-feature-male`.
- Code commit: `4f17e4060d59c14c9169295a8b78229f0b5865d9`.
- Starting Photo branch: `d1b21b194d310b8c66a761b325ced0b58aea3689`.
- Current core already included: `82f97264b122a062634e78f439fe5a8dbb9912fb`.
- Only Photo-owned files, Photo documentation/tests, and its single MOD_FILES entry change. No core/kit changes, no PR, no Photo release zip. The report is committed separately on `notes/standalone-mods`.

## Requested work

1. **Image prompts:** gender-aware single/duo count tags, negatives and adult tags. Male-only prompts use mature_male; female halves retain mature_female. SFW male and mixed prompts retain nude, penis, sex and the other explicit negatives. Native male negative tags are used without banning anyone actually present.
2. **Body details:** male pools under the existing Generation controls; old female pools and valid saved choices are preserved. No save migration or new saved body keys. Editor gender context is temporary.
3. **Wardrobe, poses and coverage:** male anatomy and explicit hand actions, gender-aware partial exposure, male swim fallback when no swim set exists, and ordinary shirtless male photos. Explicit option/No NSFW gates still apply to male nudity below the waist. Cover rendering was checked for both genders with all four option combinations.
4. **AI text:** Photo-owned pronoun helpers fill character-specific briefs, group instructions and wardrobe lines. Generic cast instructions are neutral. Attached-photo history continues to quote the original saved caption.
5. **Duos:** all pairings, separated regional faces/clothes/colours, neutral option copy, current partners alongside friends at the existing odds. Breakups invalidate cached partner choices before filing; already-taken photos stay intact.
6. **Photo’s own wording:** neutral UI/option text and gendered tips; Bunnyfeeds and After Hours were read only and remain untouched.
7. **Old saves:** attachment normalization and file/sidecar formats are unchanged. Tests preserve legacy and slice attachment values and source records, female body picks and recorded female prompt metadata. A scratch comparison against the starting branch passes **21 exact female prompt comparisons**, including all three tiers and duo regional prompts.
8. **Paperwork:** ModDef 1.8.0, player-facing 1.8.0 notes and updated duo documentation. Copy alternatives were drafted outside the repository. No release archive was built or published.

## Female assumptions traced

| File and line | Change |
| --- | --- |
| `src/shared/photoGender.ts:32` | New Photo-owned gender, pronoun and adult-subject helpers. Missing gender stays female; anatomical/subject filtering respects tag boundaries so boyish hair and cowboy hats survive. |
| `src/shared/photoPrompt.ts:71` | Single subjects now use 1girl or 1boy, with mature_female or mature_male. Male negatives use 1girl and breasts; count bans follow the actual cast and SFW guards remain. |
| `src/shared/photoPrompt.ts:698` | Male bare chests keep their lower clothes without explicit tags. Male nudity uses penis and the native male nude vocabulary; partial undressing keeps the covered regions covered. |
| `src/shared/photoPrompt.ts:1152` | Each duo half uses its own gender, appearance, wardrobe, colours, expression and adult tag. Shared counts are 2girls, 2boys, or 1girl plus 1boy; negatives never ban the subjects present. |
| `src/shared/photoPrompt.ts:1201` | Name substitution and the shared-space instruction now use Photo’s pronouns or neutral wording. Caption splitting still separates the two expressions and gestures. |
| `src/shared/characterBody.ts:89` | Separate male build, chest and pubic-hair pools, shared shape controls where appropriate, and the existing female pools and five save keys retained. |
| `src/shared/characterBody.ts:190` | Normalization recognises male-only picks without migrating existing female slices. Drawing filters against actual character gender; body appearance and regenerate ownership include male picks. |
| `src/renderer/views/bodyFields.tsx:70` | The same Generation controls show the matching pools and a male Chest label. Temporary gender context follows edits and rerolls, then is stripped on write; existing female choices are preserved. |
| `src/renderer/prompts/bodyBrief.ts:27` | Generation sees both build pools with a matching-gender instruction. Host subject tags identify the requested gender; the male appearance schema supplies the fallback when subject tags were customised. |
| `src/renderer/modEntries/photo-feature.ts:126` | The creation hook passes that generation context into the male/female body draw using existing kit inputs; no kit addition. |
| `src/shared/photoGate.ts:192` | Male upper-only nudity is ordinary, including shirtless and waist-up descriptions. Lower nudity and sexual activity remain explicit. Female classification stays unchanged. |
| `src/shared/photoGate.ts:334` | A male’s own body is no longer mistaken for a partner. Known duos allow either subject’s body pronouns, reject sexual acts and third people, and classify coverage for both genders. |
| `src/shared/photoBody.ts:410` | Coverage emits male genital anatomy for male explicit photos and never female cleavage/body tags on males. Underwear and lower exposure recognise male garments. |
| `src/shared/photoPose.ts:1355` | Male captions match the existing composition rules. Male hand actions use male anatomy; female-only actions are replaced or removed. Sentence cleanup understands male phone, mirror and hand pronouns. |
| `src/shared/photoFraming.ts:88` | Framing cues read male possessives too, including face crops; female cue behavior is retained. |
| `src/shared/photoWardrobe.ts:88` | Saved outfits still win. A male without a swim set gets swim trunks and an uncovered upper body. Wardrobe names, removal parsing and the AI wardrobe brief accept his own pronouns. |
| `src/renderer/prompts/photoBrief.ts:66` | Character-specific DM and reach-out instructions fill Photo’s pronoun templates. Generic feed/comment instructions use neutral cast wording. Male briefs explicitly distinguish a bare chest from lower nudity. |
| `src/shared/photoDuo.ts:43` | Feed companions include friends or a pair with dating set, including day zero. Ended-only pairs are not partner candidates. Scene selection was already independent of gender; locals now say people. |
| `src/renderer/stores/photoGroup.ts:179` | Same one-in-four roll and one feed duo per slot, using the combined companion pool. Cached partner choices are rechecked after a breakup. Scene/feed photo instructions use the poster’s own pronouns. |
| `src/renderer/stores/photoPost.ts:40` | The feed gate receives both actual subjects. A male’s hand in a mixed duo no longer triggers the solo veto, while either person’s explicit coverage still refuses the public photo. |
| `src/renderer/stores/photoTurn.ts:24` | Streamed and completed DM decisions pass actual character gender through the same relationship/options gate; tips receive that gender too. Console failure messages are neutral. |
| `src/renderer/prompts/photoTips.ts:15` | The first-photo gallery tip uses the sender’s pronouns. Its persisted one-shot marker is unchanged. |
| `src/renderer/stores/photoTipDelivery.ts:13` | Tip delivery carries gender without changing its once-only save identity. |
| `src/renderer/components/PhotoInfo.tsx:282` | The reconstruction note is neutral. Existing generate/info/redraw calls already carry the full Character, including gender; integration tests check male and mixed reconstructions and recorded female metadata preservation. |
| `src/renderer/views/ContactGallery.tsx:264` | The feed empty state is neutral. Gallery IDs, attachment reads, sorting and tier-based covering remain shared across genders. |
| `src/renderer/stores/photoRecovery.ts:68` | The recovery log no longer calls every sender female; recovery payloads and filenames are unchanged. |
| `src/shared/photoDefinition.ts:41` | Neutral duo label and friend/partner hint; neutral mod blurb. Explicit option copy explains the shirtless-male exception. |
| `src/shared/modEntries/photo-feature.ts:7` | Version bumped to 1.8.0. |
| `docs/mods/photo-feature.md:133` | Player-facing release bullets, updated duo section, male coverage/settings notes and technical gender/body documentation. Older female examples and release history are explicitly retained as examples/history. |
| `test/kit/modFiles.ts:11` | Only Photo’s ownership entry changes, adding photoGender.ts. No forward or reverse allowlist entries were added. |

## Checks

Dependencies installed successfully with a workspace npm cache, including the kit install; 7za’s executable bit was set. Tracked dependency manifests/lockfiles are unchanged.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | Passed |
| `npm test` | 1 | Test Files  1 failed | 239 passed | 3 skipped (243); Tests  1 failed | 3291 passed | 4 skipped (3296) |
| `npm run build` | 0 | Passed |
| `npm run build:web` | 0 | Passed |
| `xvfb-run -a npm run test:electron` | 0 | 42 successful assertions; 0 failed assertions |

Boundary probe: **48 Photo files, 0 forward violations, 0 reverse violations, 0 forward allowlist rows, 0 reverse allowlist rows**. Both allowlist files are absent on this branch; the scanner treats absence as an empty list. The real boundary test also passes. Protected guides, README, TESTING_PLAN, core and kit have no diff.

New targeted coverage includes male singles at all three tiers, all four duo gender orderings, male and mixed expression/clothing separation, SFW negatives, male swim fallback, male face/explicit poses, separate body pools, old female picks and save attachments, body creation/editor round-trip, shirtless classification and cover rendering, current/day-zero partners and cache invalidation after breakup, mixed-duo coverage, and male/mixed photo-info reconstruction. Eight old brief test cases that matched English sentences were replaced with eligibility/schema/saved-reason checks rather than matching revised prose.

The sole permitted full-suite failure is the existing Linux interpretation of Windows paths:

```text
FAIL test/mainServices.test.ts > getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently
AssertionError: expected undefined to match object { code: 'COMFY_OUTPUT_PATH_INVALID' }
test/mainServices.test.ts:182
```

Electron finished with **42 successful assertions and zero failures** across its six real-app fixture flows. The container initially lacked Xvfb; the Debian Xvfb package was extracted outside the repository. Its Electron sandbox helper is not installed as root, and the default home configuration/cache paths are not writable. The successful run used a scratch launcher for the same Electron 43.7.0 binary with `--no-sandbox --disable-gpu --disable-dev-shm-usage`, local Xvfb on PATH, and workspace `XDG_CONFIG_HOME`/`XDG_CACHE_HOME`. No app or test-runner source changes were used to make it launch.

The two new test files pass **39 tests**; three more photo-info integration cases were added to the existing redraw suite. Full-suite totals above come from the final run after the last code change. The existing wording tests were rewritten around behavior; wording was reviewed manually.

## Other mods observed, unchanged

- `fork/mod/bunnyfeeds-kit`, `src/renderer/modEntries/bunnyfeeds.ts:115`: attached-photo ledger text says “With a photo of her…”. It needs the separate gender pass requested in the brief.
- `fork/mod/after-hours-kit`, `src/shared/afterHoursText.ts`: Busy option text, busy/night prompts, stay-over instructions and morning-return narration use she/her or “girl”. Those are separate After Hours changes; none were edited here.

## Limits and follow-up

- **Not visually verified in ComfyUI:** male render quality, the male body choices, male swim fallback and all duo combinations need the requested playing/image comparison before release. Prompt computation and app startup are checked; this is not a claim that generated faces/anatomy look correct.
- The Electron command exercises the real built app’s existing fixture-mod flows. It does not generate Photo images with a live LLM/ComfyUI service. Cover tests render the real shared component with synchronous kit readers for the test save.
- Historical female examples in comments and older documentation release notes remain examples, not gender filters. Existing main file IO, backup, recovery, gallery and redraw paths are already keyed by character IDs and attachment tiers; they did not need a new male save format.
- A broken-up pair can still be selected **as friends** if their current affinity meets the existing friendship rule. An ended-only pair with no current friendship is excluded. This preserves the existing friend policy while adding current partners.
