# Darts 0.2.1 audit

## Commits and release status

- Implementation to date is `ca3ba1e71c7593ce7f1c8dcaaf871825ffbfab5a`
  (`Darts 0.2.1: name companions and use their pronouns`), based on org
  `main` at `21ab511407d2211bd404d0cffcad583ec13519c1`.
- Follow-up `4f47d3884fe2c4fc20b165c6e5f1c7901b34f514`
  (`Darts 0.2.1: use the mini-game kit for pronouns`) makes the existing
  ModKit helpers available through the approved mini-game kit import.
- The implementation and this separate audit were committed as
  `Naudh1r <102735014+naudh1r@users.noreply.github.com>` without co-author trailers.
- [Org #355](https://github.com/venus-extracurriculars/build/pull/355) was open at
  verification. The shared mod entry and feature-branch publication are pending
  the merge of #355.

## How the title gets its names

The mini-games table supplies each seated companion’s first name once the reader
knows it. Darts uses that name or the seat’s `Companion 1` / `Companion 2` label
when the name has yet to be learned. The picker passes the seated opponents’
labels to `extraModeTitle`. The game passes the NPC seats from the current
match. The title, scoreboard and score summary use ` & `. The rule and scene
descriptions use `and`, with the seats kept in throw order. Chase the Leader,
Precision Duel and Exact Total keep their fixed titles.

`Player vs Pair` remains in the shared mode definition used before seating,
including the generic Pack page options, and in the unavailable-mode picker
when it has fewer than two companion seats. The docs use it as the mode heading.

## Saved data

The renderer holds the Darts match in React state. The mini-games framework
checkpoints the game ID, companion IDs, numeric options and, when available,
result prose and account lines. `darts-mode: 3` is the persisted selection for
this mode. The match object, throw plan and computed score are all local.
`girls-team` was also interpolated into the live round request as prompt text.
No path that reads a save uses `girls-team`, `girlsBalance` or the temporary
checkout marker `girls`. Existing saved result prose may still contain the old
title or labels as historical text. The renamed fields are `pair`,
`pairBalance` and `pair` respectively. Numeric options and public
`won` / `lost` / `draw` outcomes retain their meanings.

## Wording players see

Brackets represent values inserted at runtime. Rows show the changed passage
where a longer string otherwise reads the same.

| Surface | Before | After |
| --- | --- | --- |
| Mode heading, About label, unlocked game title and mode picker | Player vs Girls Team | Player vs Lina & Mika |
| Picker without two seats and generic pack options | Player vs Girls Team | Player vs Pair |
| Pair scoreboard active balance | GIRLS REMAINING | LINA & MIKA REMAINING |
| Pair scoreboard team label | GIRLS TEAM | LINA & MIKA |
| Pair balance in the result summary | You 301 remaining; girls team 301 remaining. | You have 301 remaining. Lina & Mika have 301 remaining. |
| Other extra-mode score summaries | [name] [points] points; [name] [points] points. | [name] [points] points, [name] [points] points. |
| Pair mode help | Two girls share a 301-point balance against your separate balance. Order: girl 1, girl 2, you. Three darts each per round, three rounds. Exact zero wins immediately; otherwise the lower balance wins. Bust cancels that visit. The girls have twice as many darts: this is a 1-vs-2 challenge. | Lina and Mika share a 301-point balance against your separate balance. Order: Lina, Mika, you. Three darts each per round, three rounds. Exact zero wins immediately. Otherwise, the lower balance wins. A bust cancels that visit. Your opponents have twice as many darts in this 1-vs-2 challenge. |
| Chase the Leader help | Most points wins; tied leaders share the win. | Most points wins. Tied leaders share the win. |
| Precision Duel help | Each correct hit earns 1 point; most points wins. | Each correct hit earns 1 point. Most points wins. |
| Exact Total help | A successful finish beats a failure; fewer darts wins the target. | A successful finish beats a failure. The player who uses fewer darts wins the target. |
| Exact Total play-by-play | Bust: the accumulated total resets to zero; used darts stay used. | Bust: the accumulated total resets to zero. Used darts stay used. |
| 301 Rival Match help | Otherwise, the lowest balance wins; equal lowest balances tie. | Otherwise, the lowest balance wins. Players with the same lowest balance tie. |
| Cooperative Beat the House help | You get 3 visits; each companion gets 2. | You get 3 visits and each companion gets 2. |
| Controls in the Pack page | Solo: Next round starts your next three darts. With companions: Change turn hands over to the girls; My turn takes the darts back. | In solo play, Next round starts your next three darts. Change turn hands the darts to your companions. My turn takes them back. |
| Participant labels, ready status, results and narration when a first name is unknown | [object pronoun] | Companion 1 / Companion 2, according to the seat |
| Beat the House / Rival Match visit account | [name], visit [number]: [hits]; [points] credited[bust detail]; [balance] remaining. | [name], visit [number]: [hits]. [points] credited[bust detail]. [balance] remaining. |
| Beat the House closing account | [balance] remains from [target]; [you beat the house / the team beat the house / the house won / the match is unfinished]. | [balance] remains from [target]. [You beat the house / The team beat the house / The house won / The match is unfinished]. |
| Rival Match closing account | [name]: [balance] remaining; [name]: [balance] remaining. | [name]: [balance] remaining, [name]: [balance] remaining. |
| Extra-mode visit account | [name], round [number]: [hits]; visit total [total][bust or completion detail]. | [name], round [number]: [hits]. Visit total [total][bust or completion detail]. |

The shared mod blurb is pending #355. Its present text is
“Darts with the girls: team up against the house or play a 301 rival match.”
The requested 0.2.1 text is “Darts with your friends: team up against the house
or play a 301 rival match.”

## Wording the AI reads

The game account and situation reuse the changed title, mode help, and score
and visit wording above. The additional prompt-specific changes follow.

| Surface | Before | After |
| --- | --- | --- |
| Beat the House format | The reader can play Beat the House alone, or with one or two girls. Alone, he has five visits against a 301, 501 or 701 countdown. A team shares that countdown and rotates reader then each girl; the reader gets three visits and each girl two. | The reader can play Beat the House alone, or with one or two companions. Alone, the reader has five visits against a 301, 501 or 701 countdown. A team shares that countdown and rotates from the reader to each companion. The reader gets three visits and each companion gets two. |
| Rival Match format | Rival Match requires at least one girl and gives every player a separate 301 balance for three rounds. | Rival Match requires at least one companion and gives every player a separate 301 balance for three rounds. |
| Pair format | Player vs Girls Team requires two girls: girl 1, girl 2, reader; the girls share a balance and have twice as many darts, with three rounds each and the lower side balance winning if nobody checks out. | Player vs Pair requires two companions. The first companion throws, then the second, then the reader. The companions share a balance and have twice as many darts. Each player gets three rounds, and the side with the lower balance wins if nobody checks out. |
| Chase the Leader format | Chase the Leader requires two girls: 3 or 9 rounds, rotating leader; each challenger scores 1 for matching or beating the leader, or the leader scores 1 if both fail. | Chase the Leader requires two companions. Play 3 or 9 rounds with a rotating leader. Each challenger scores 1 for matching or beating the leader, or the leader scores 1 if both fail. |
| Precision Duel format | Precision Duel requires exactly one girl at Darts skill tier 4 or 5 | Precision Duel requires exactly one companion at Darts skill tier 4 or 5 |
| Exact Total format | Exact Total requires exactly one girl at Darts skill tier 3 or higher: five identical total targets, three darts per target; bust resets that visit total to 0 without refunding darts. A successful finish beats a failure and fewer used darts wins each target; equal successful finishes share 1 point. | Exact Total requires exactly one companion at Darts skill tier 3 or higher: five identical total targets, three darts per target. A bust resets that visit total to 0 without refunding darts. A successful finish beats a failure and fewer used darts wins each target. Equal successful finishes share 1 point. |
| Challenge results in format | Most points wins these challenge modes; tied highest totals share the win. | Most points wins these challenge modes. Tied highest totals share the win. |
| Result brief | Past-tense references to a memorable hit are fine; do not stage it happening again. | They may recall a memorable hit. Do not stage it happening again. |
| Skill brief | repeats her throw | repeats their throw |
| Consistency axis | whether her performance swings | whether their performance swings |
| `darts-mode` value 3 | Player vs Girls Team | Player vs Pair |
| `darts-mode` description | 1 solo/co-op; 2 individual rivals; 3 girls team (two girls); 4 leader (two girls); 5 precision (one girl, tier 4+); 6 exact total (one girl, tier 3+) | 1 solo/co-op. 2 individual rivals. 3 pair team (two companions). 4 leader (two companions). 5 precision (one companion, tier 4+). 6 exact total (one companion, tier 3+) |
| `darts-start` description | countdown for Beat the House and Girls Team; individual Rival Match stays at 301 | Starting countdown for Beat the House and Player vs Pair. Individual Rival Match stays at 301. |
| `darts-leader-length` description | only used for Chase the Leader; everyone leads equally often | Only used for Chase the Leader. Everyone leads equally often. |
| Extra-mode round briefing | Rules: [description]. Mode [internal ID]; current situation: [situation]; reader's most recent visit total [total]. | Mode: [display title]. [Description] Current situation: [situation] The reader’s most recent visit total was [total]. |
| Extra-mode reaction timing | The reader has already played; react only to the recorded visit. | The reader has already played. React only to the recorded visit. |
| Extra-mode scene rule | Both girls team up only in Girls Team; otherwise they compete individually. Never refer to them as sharing a score in an individual mode. | In pair mode, “Lina and Mika team up only in this mode. They share one score.” In other modes, “The players compete individually. Keep their scores separate.” |
| Speaker facts in both round briefs | p1 speaker is [name or object pronoun] ([id]). | p1 speaker is [name or seat label] ([id], pronouns [subject]/[object]/[possessive]). |
| Reader’s pronouns in both round briefs | No Darts-specific instruction. | Use [kit pronoun list] when referring to the reader by pronoun. |
| Round brief’s introductory list of speakers | [first name or object pronoun] | [first name or seat label] |
| Next throw in the live situation | [name or object pronoun] throws next. / You throws next. | [name or kit subject pronoun] throws next. / You throw next. |

The hard-coded companion fallback reactions are first-person lines. The
third-person turn line uses `pronounsOf` and is covered by a pure test.
The round briefs use `readerWordsOf(gameFacts().readerPronouns)` and derive the
speakers’ pronouns from the kit for each visit.

## Documentation wording

| Location | Before | After |
| --- | --- | --- |
| Introduction and Rival Match | one or two girls | one or two companions |
| Beat the House turn order | Player + one girl / Player → girl → player → girl → player | Player + one companion / Player → companion → player → companion → player |
| Beat the House turn order | Player + two girls / Player → first girl → second girl → repeat, ending with the player | Player + two companions / Player → first companion → second companion → repeat, ending with the player |
| Rival Match | alternating player, first girl and second girl where present | alternating player, first companion and second companion where present |
| Mode heading | Player vs Girls Team | Player vs Pair |
| Pair rules and name display | Exactly two girls share a countdown balance against your separate balance. Choose 301, 501 or 701. Turn order is girl 1 → girl 2 → player for three rounds, with three darts per visit. Exact zero wins immediately; otherwise the lower balance wins at the round limit. A bust cancels only that visit. The girls deliberately have twice as many darts: this is a 1-vs-2 challenge. | The game shows the companions’ first names in this mode’s title once the reader knows them. Two companions share a countdown balance against your separate balance. Choose 301, 501 or 701. The first companion throws, then the second, then you. Each player gets three darts per visit for three rounds. Exact zero wins immediately. Otherwise, the lower balance wins at the round limit. A bust cancels only that visit. Your opponents have twice as many darts in this 1-vs-2 challenge. |
| Chase the Leader | Three players: you and two girls. | You play alongside two companions. |
| Precision Duel and Exact Total | One girl with cached Darts skill tier | One companion with cached Darts skill tier |
| Dialogue batching | With two girls, both consecutive NPC visits are included in **one batch call**, rather than a call for every dart or girl. | With two companions, both consecutive NPC visits are included in **one batch call**. |
| Reaction timing | Her bound reaction and expression appear about **350 ms after landing**. Each reaction finishes before the next throw; another brief pause separates the girls. | Their bound reaction and expression appear about **350 ms after landing**. Each reaction finishes before the next throw; another brief pause separates the companions. |
| Turn button | the active girl's name while she plays | the active companion’s name |
| Changelog | No entry. | **0.2.1**. The pair mode shows the companions’ first names. Darts uses neutral wording for generic roles and the seated companions’ pronouns in turn and reaction prompts. |

## Checks

| Check | Result |
| --- | --- |
| `npm ci` | Installed 456 packages. The retry used a writable npm cache under `/tmp` after the default home cache failed. |
| `npm run typecheck` | Passed all 3 TypeScript projects on the final implementation. |
| `npm run build` | Passed main, preload and renderer builds on the final implementation. |
| Focused Darts and boundary tests | 59 passed across 4 files. This covers the title, description order, score summary, existing pair gameplay and the male companion turn line. Both import checks passed without changes to the allowlist. |
| Initial `npm test` | 407 files passed, 21 failed, 3 skipped. 5,265 tests passed, 102 failed, 4 skipped. |
| Clean org main comparison | Two targeted runs reproduced 98 archive-dependent failures and the one ComfyUI path test failure across 11 files. |
| Darts wording sweep | 1 match across the Darts mod globs, both mod entries and the docs. The shared mod entry’s existing blurb is the only match and is pending #355. |
| `git diff --check` | Passed. |

In the initial full run, 98 test failures came from the non-executable bundled
archive helper, 7 suites could not collect because Electron’s lazy download
failed, two long simulations timed out (Poker and NPC relationships), and one
ComfyUI path assertion also failed on clean org main. The Darts-related failure
was the mini-game pack import check. The follow-up commit moved the helper imports
through the mini-game kit and both import checks passed on rerun.

The final targeted rerun exercised the 21 files that failed in the initial run
and three Darts and kit-boundary files. It used the executable bundled 7-Zip
helper, the checksum-verified Electron 43.7.0 binary and a 30-second test
timeout. **23 files and 437 tests passed.** Only the same ComfyUI output-path
assertion failed. The other archive, Electron collection, simulation timeout
and mini-game pack import failures cleared.

## Open items

- **Pending upstream.** After #355 lands, merge the resulting org `main` into
  the feature branch, set the shared mod entry to `0.2.1` with the new blurb
  and retain `game: '0.9.2'`. Then check and publish the feature branch on the fork.
- **Name visibility.** The mini-games table reveals first names as the reader
  learns them. The numbered labels are the Darts fallback for hidden names.
