# Reader pronouns in the kit, Bunnyfeeds and After Hours

| Branch | Commit |
| --- | --- |
| `hooks/reader-pronouns` | `1877a88bea4380c7ec92abe3c34ed0220327e074` |
| `mod/bunnyfeeds-reader` | `76537cbd549cc60e75ae19b9d5bbeed2434ea6a9` |
| `mod/after-hours-pronouns` | `de0c54616af401dfb0bfa94c6f0b563e99531852` |

## Kit 0.8.1

`gameFacts` and `useGameFacts` now include the reader’s selected pronouns, with the native he/him fallback for older saves. The kit exports the native `ReaderPronouns` type and exposes the game’s own `readerWords` as `readerWordsOf`. There is one table. The helper uses “the reader” as the subject for they/them and can distinguish two people who share pronouns. The kit test compares the game and kit output for all three sets.

## Bunnyfeeds 1.1.7

| Location | Before | Now |
| --- | --- | --- |
| `src/renderer/stores/bunnyfeedsReadContext.ts:43,78,98` | The snapshot carried the reader’s name and clock. | It also carries the selected pronouns and invalidates the snapshot when they change. |
| `src/renderer/stores/bunnyfeedsThreads.ts:336` and `src/renderer/prompts/bunnyfeedsPrompt.ts:172` | The thread request input had no reader pronouns. | The request receives the set from the snapshot. |
| `src/renderer/prompts/bunnyfeedsPrompt.ts:212` | The system persona used he/him/his for the reader’s writing. | It uses the kit’s subject, object and possessive forms. |
| `src/renderer/prompts/bunnyfeedsPrompt.ts:268,285` | Lore about what a replier remembers and how they know the reader said “him” and “his comment.” | It uses the reader’s object form, or names the reader when both people have the same pronouns. |
| `src/renderer/prompts/bunnyfeedsPrompt.ts:306,339` | The direct-answer instruction said “answers him back.” | It uses the selected object form. |
| `src/renderer/prompts/bunnyfeedsPrompt.ts:377,390` | The general reply, private-message and memory directions used “he,” “him” and “his.” | They use the kit forms, with “the reader” or “a private message” where that makes the referent clear. |
| `src/renderer/modEntries/bunnyfeeds.ts:92,99,119` | The recent-post context said each poster “answered him.” | It uses the reader’s object form, distinguishing the poster where necessary. |
| `docs/mods/bunnyfeeds.md:99,203,230` | The unreleased notes did not mention reader pronouns, and the implementation descriptions used “he” and “his.” | The release note says replies and memories follow the reader’s pronouns. The descriptions name the reader. |
| `test/bunnyfeedsMigration.test.ts:250` | Legacy memory replacement had a general fixture. | Three cases replace an old feed memory with a he, she or named reader subject, plus a legacy he entry in each case. |

- `FEED_MEMORY_END` in `bunnyfeedsMemory.ts:13` matches where the memory was filed. It still accepts `on the feed`, `on Bunnyboard`, `on her post`, `on his post`, and a named poster’s post. Those places refer to the poster, not the reader. No regex change was needed.
- `SAID_WHERE` in `bunnyfeedsThreads.ts:563` strips an extra place suffix and already accepts her, his, their and a named possessive. It does not parse the subject. No change was needed.
- The native kit readers for profile, relationship and memory text already use the loaded reader’s pronouns. The mod’s existing character pronoun table was left in place.

## After Hours 0.7.0

| Location | Before | Now |
| --- | --- | --- |
| `src/shared/afterHoursText.ts:7–16` | The catalogue, switch note, Busy texting option and night hint referred to “her,” “she” and “girls.” | They speak about contacts or someone the reader spends the night with. |
| `src/shared/afterHours.ts:33,57` and `src/renderer/mods/afterHours.tsx:35,45,150,164` | The ledger lookup and staging called the partner a girl. | They use partner or contact wording. Matching still uses the same character key and saved room. |
| `src/shared/afterHours.ts:70,79,85` and `src/renderer/mods/afterHours.tsx:234` | The Busy and night DM lines referred to every contact as “she.” | They use the contact’s gender, with female as the default. |
| `src/shared/afterHours.ts:90,93` and `src/renderer/mods/afterHours.tsx:176,223` | The evening and ledger instructions said “her dorm,” “the girl” and “he.” | They state which character and room the keys mean, and use the reader’s selected subject. |
| `src/shared/afterHours.ts:99` and `src/renderer/mods/afterHours.tsx:196` | The morning described “him” waking beside “her” and going back to “his” room. | Both people have their own forms. When they share pronouns, the prompt names the reader to distinguish them. |
| `src/shared/afterHours.ts:120` and `src/renderer/mods/afterHours.tsx:233` | Held text said “she,” “her shift” and “what he said.” | It uses the contact’s forms and the kit’s reader subject. Class and work still use their actual titles. |
| `src/shared/modEntries/after-hours.ts:8`, `docs/mods/after-hours.md:14,27,42,66,78,83,92` | The version was 0.6.7 and the guide used female contact wording. | 0.7.0 describes the pronoun support, and the playing guide describes contacts and their parting words. |
| `test/afterHours.test.ts:84` | The ledger parser checked one female partner in both rooms. | It checks male and female partners against both saved room keys. |

The held reply uses the structured commitment and due clock. It does not parse the prompt’s prose. The night ledger and old saves still use the character key and `herRoom`/`hisRoom` identifiers. The opening reads the structured speaker and `homeLine` fields, independent of the line’s pronouns. No read-back regex or save migration was needed. The prompt builders live in the existing logic module, leaving the shared catalogue copy usable by the mod registry without a kit import cycle.

## Review coverage

The rendered prompt review covered he/him, she/her and they/them for the Bunnyfeeds thread request and After Hours. After Hours also covered both contact genders, both rooms, and class and shift replies. Kit boundary tests ran in the full suites. The checkout excluded the bundled character archives to fit its disk quota. Electron exercised the installed-mod suite with both first-run content settings supplied. It did not play through a live model-generated feed exchange or stay-over. No release packages were built.

## Check results

| Branch | Typecheck | Unit suite | Desktop and web builds | Kit API report | Electron under Xvfb |
| --- | --- | --- | --- | --- | --- |
| Kit | Pass | 2,696 passed, 4 skipped, 1 known failure | Pass | Pass | 42 checks passed |
| Bunnyfeeds | Pass | 2,734 passed, 4 skipped, 1 known failure | Pass | Pass | 42 checks passed |
| After Hours | Pass | 2,715 passed, 4 skipped, 1 known failure | Pass | Pass | 42 checks passed |

The sole failure in each final unit run was the allowed Linux `getComfyOutputFilePath` assertion in `test/mainServices.test.ts:182`. No mod boundary exceptions or lockfile changes were added.
