# Character Dynamics

The setup screen gets its neutral-sprite URL through `@vx/modkit/renderer`'s native
`spriteUrl`, preserving the game's active image resolver. It no longer imports the
character store for portraits. This is a sprite URL, not the player's reader profile image;
roster selection, setup choices and save normalization are unchanged.

One optional Venus Extracurriculars mod, with one setup screen for two independent choices:

- **Starting relationship:** Ex-girlfriend, Resentful, Rival, or Antagonist. Each girl assigned a relationship requires her own explanation, up to 1,200 characters. This establishes background, not a permanent mood or a reward in stats.
- **Personality nudges:** 50 optional traits, listed alphabetically. Several can be applied to the same girl, gently supplementing her existing personality and voice. Search the palette by name or description, then drag a trait or use the click-to-place alternative.

## Playing

Enable **Character Dynamics** in the main menu's **Mods** screen before starting a playthrough. It is off by default and has no required mods. After the name question in New Game or Quickstart, the setup displays the selected roster. Choose a relationship and explain it, drag personality tags onto her card, or use either section by itself. A click-to-place alternative is available: select a tag, then click the girl's Add button. Tags can be removed individually. Unassigned girls are unchanged.

Continue is available when every chosen relationship has a nonblank explanation. Selecting no choices is valid. The setup establishes that girls with written shared history already know the reader; it does not grant affection, contact details, intimacy, trust reveals, or native relationship milestones. A prior relationship is history before this playthrough, not a new breakup or kiss for the ledger to award.

The choices are specific to this playthrough and do not rewrite reusable character files, native traits, or character notes. Changing the Mods switch affects future playthroughs, as with other playthrough-scoped mods. Existing playthroughs without this mod remain unchanged.

## Viewing choices during play

Open a girl's Bunnyboard profile and find **Backstory → Character Dynamics**. A small button and summary open a separate, read-only panel with her assigned traits, their meanings, her starting relationship, and the explanation entered during setup. Choices are shown from the currently loaded save. Girls with no assigned choices have no extra button.

The player-authored choices can be read before the native backstory is unlocked; the girl's own undiscovered backstory remains locked. **Starting background** records the setup rather than claiming she still feels the same way. Reading the panel does not edit her character file, notes, memories, or saved choices. Carried choices remain readable when the mod's effects are inactive.

## Trait catalog

The palette contains 50 traits in alphabetical order. Search filters this same ordered list.

| Trait | Gentle tendency |
| --- | --- |
| Adventurous | A little more willing to try an unfamiliar experience. |
| Affectionate | A little warmer with people she trusts, respecting their boundaries. |
| Ambitious | A little more motivated to pursue the goals she already cares about. |
| Analytical | A little more inclined to break a problem into understandable pieces. |
| Blunt | A little more plainspoken, while still capable of tact and kindness. |
| Cautious | A little more likely to weigh a risk before taking the next step. |
| Cheerful | A little more inclined to find everyday reasons to smile. |
| Competitive | A little more drawn to friendly challenges. |
| Curious | A little more eager to ask questions and explore an interesting idea. |
| Deadpan | A little more likely to deliver a joke with a straight face. |
| Dependable | A little more attentive to following through on her commitments. |
| Dramatic | A little more theatrical about everyday victories and setbacks. |
| Dreamy | A little more prone to imaginative what-ifs and pleasant daydreams. |
| Easily flustered | A little more bashful when attention catches her off guard. |
| Easygoing | A little more willing to shrug off minor inconveniences. |
| Empathetic | A little more inclined to consider another person's perspective. |
| Flirtatious | A little more playful with romantic interest when it is welcome. |
| Generous | A little more willing to share her time or resources when she can. |
| Goofy | A little more comfortable being silly and laughing at herself. |
| Guarded | A little slower to share personal feelings. |
| Headstrong | A little firmer in her convictions. |
| Humble | A little more comfortable acknowledging her limits and giving others credit. |
| Idealistic | A little more guided by hopes and principles. |
| Impulsive | A little more likely to act on a feeling. |
| Meticulous | A little more particular about preparation and small details. |
| Mischievous | A little more inclined toward playful teasing. |
| Observant | A little more attentive to details she can actually notice. |
| Patient | A little more willing to give people and problems time. |
| Philosophical | A little more drawn to thoughtful questions about everyday life. |
| Practical | A little more drawn to workable solutions and useful next steps. |
| Prickly | A little quicker to bristle, with room to soften. |
| Protective | A little quicker to look out for someone without deciding for them. |
| Proud | A little more protective of her dignity and pleased by earned achievements. |
| Pun-loving | A little more tempted by a wonderfully terrible pun. |
| Rebellious | A little more inclined to question expectations and find her own way. |
| Reserved | A little more expressive through small gestures. |
| Resourceful | A little more inclined to improvise a solution with what is available. |
| Romantic | A little more moved by thoughtful gestures and meaningful moments. |
| Self-assured | A little more direct and willing to initiate. |
| Sentimental | A little more attached to keepsakes and shared memories. |
| Skeptical | A little more likely to ask for reasons before accepting a claim. |
| Sleepy | A little more fond of slow mornings, cozy rests and drowsy humor, while staying engaged when it matters. |
| Social butterfly | A little more eager to start conversations and include people. |
| Spontaneous | A little more inclined to suggest an unplanned treat or change of plans. |
| Stoic | A little more composed under pressure, without lacking feelings. |
| Superstitious | A little more fond of lucky rituals and reading coincidences as signs. |
| Tenacious | A little more persistent through setbacks, while respecting other people's boundaries. |
| Tenderhearted | A little more attentive to hurt feelings. |
| Whimsical | A little more drawn to fanciful ideas and small, unexpected delights. |
| Witty | A little quicker with clever comebacks and wordplay. |

All choices use the same catalog for setup, saved-choice display, and prompt guidance. Adding these options does not assign any new traits to existing saves. Tags do not change stats, schedules, consent, or native game trait switches.

## AI behavior

Scene and DM hooks supply short guidance for the characters being written. The slot-opening request includes only its askers, breakup correspondents, and posters. Other characters' background is not dumped into unrelated requests. The guidance preserves original personalities, treats multiple traits as gentle situational tendencies, and gives later memories and current relationships precedence over initial feelings. Private history is not an instruction to announce it publicly.

These are prompt instructions, not deterministic personality mechanics. Actual dialogue depends on the selected model and the rest of the story context. No separate generation call is made for tags, and the mod requires neither Story Memory nor SQLite.

## Persistence and semester integration

New saves, enrollments, and `modCarry` use the `exCharacterDynamics` field, following the shared build's convention for mod-owned data. The enrollment switch is `exCharacterDynamicsEnabled`. Read-only compatibility helpers accept the earlier unprefixed fields from prerelease builds; the prefixed values take precedence, and subsequent saves use only the new name. Loading does not modify existing files, and no game schema-version bump is needed.

`exCharacterDynamics` is an optional, versioned field on the enrollment and each save. Keeping it on enrollment preserves it if the registrar is left and resumed. `exCharacterDynamicsEnabled` also freezes this mod's enrollment choice, so changing the main-menu switch before resuming cannot accidentally activate or discard the setup. The game store loads, resets, and serializes the choices explicitly; absent data stays absent and older saves need no schema upgrade. The stored object is preserved even when its effects are not active. Unknown future tags are retained on disk but are not applied by this version.

The shared entry imports a `modCarry` adapter. It copies choices independently of switches, retaining historical entries for girls no longer in the active roster. The setup component accepts all returning character IDs and makes those girls read-only, including returning girls with no tags. Only new girls can receive fresh choices. Native New Game+ opens that same screen after Finalize at the registrar, before Echo setup when Echo is enabled. Carried history and earned growth remain intact.

On continuation, setup is skipped if there are no newcomers or the playthrough did not start with this mod. The existing playthrough's mod list controls both a fresh continuation and resumed registration, even if the main-menu switches have changed. Accepted choices are written to registration before proceeding. `withContinuedModSetup` applies them to the native opening save, establishing acquaintance only for newcomers given shared history. Returning girls retain the flags and memories the native carry produces. Echo and Character Dynamics each work independently.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/modEntries/character-dynamics.ts` | Discovery, author credit, optional playthrough switch. |
| `src/shared/characterDynamics.ts` | Saved shape, catalog, required reasons, and settling new choices without changing returning girls. |
| `src/shared/characterDynamicsCarry.ts` | Pure semester retention adapter. |
| `src/shared/continuedModSetup.ts` | Returnee locks and newcomer choices applied to a native next-semester save. |
| `src/renderer/views/CharacterDynamicsModal.tsx` | One setup screen, drag/drop, click alternative, validation, read-only returnees. |
| `src/renderer/vu_styles/CharacterDynamics.css` | Native theme roles, scroll areas, character cards, searchable trait palette. |
| `src/renderer/views/CharacterDynamicsBackstory.tsx`, `src/renderer/vu_styles/CharacterDynamicsBackstory.css` | Compact Backstory link and separate read-only trait/background panel. |
| `src/renderer/views/ContactPage.tsx` | Displays the link from the current save while preserving native discovery gates. |
| `src/renderer/views/NewGameView.tsx` | Setup sequence, enrollment, first-save data, and initial acquaintance. |
| `src/shared/types.ts`, `src/shared/saveRules.ts` | Optional enrollment/save field without changing schema versions. |
| `src/renderer/stores/gameStore.ts` | Save round-trip and clearing data between runs. |
| `src/renderer/modEntries/character-dynamics.ts` | Additive hooks; native mod gating applies. |
| `src/renderer/prompts/characterDynamics.ts` | Character-scoped instructions preserving the original personality. |
| Scene, texting, slot prompt inputs and their store projections | Pass the same saved choices into each request snapshot. |
| `test/characterDynamics.test.ts` | Validation, data retention, cross-run isolation, carry, and hook routing. |

## Branches and validation

The `mod/character-dynamics` branch contains the standalone feature. The integrated `main` build connects its setup to native New Game+. Shared mod lists are discovered automatically; no manual registration or shared documentation section is needed.

Validate typechecks and the test suite, then exercise New Game and Quickstart, required explanations, multiple tags, duplicate drops, removal, no selections, resumed enrollment, save reload, and returning versus new girls in a continued semester. Check day/night themes, reduced motion, and the supported stage sizes. Use synthetic story backgrounds for test captures.

Validated on the integrated 0.3.1 build:

- All three typechecks and the desktop build pass.
- Full suite including the expanded trait catalog and separate viewing panel: 163 test files, 2,101 passed and one skipped.
- Isolated Electron checks exercised drag/drop, multiple tags, duplicate drops, removal, click-to-place, required reasons, both themes, and several window sizes.
- New Game and Quickstart wrote the choices into their first saves. Disabled Quickstart skipped the screen and did not inherit another run's choices.
- Continuing Semesters preserved returning girls' choices, memories, and relationship flags, plus a newcomer's new relationship and tags, through enrollment, leaving/resuming the registrar, and the first save.
- A disabled continuation retained stored choices without opening setup or enabling its effects.
- Compatibility checks loaded unprefixed prerelease data, continued its semester, resumed an unprefixed enrollment, and verified that the next save writes only `exCharacterDynamics`. Prefixed values take precedence; a frozen `false` enrollment choice is preserved.

- The expanded palette was checked with search, no results, clearing search, a new-trait drop, and saving the selection.
- The separate panel was checked in both themes, with Close and Escape, traits only, history only, no choices, an empty native backstory, and a contact not yet added. Viewing retained the saved choices and native discovery flags unchanged.
- All 34 traits plus a long starting explanation fit a scrollable panel with the footer visible at the supported stage sizes.

UI tests used canned generation results and synthetic saves; live model behavior still needs playtesting.

## Legacy semester registration

The legacy carry adapter registers at renderer boot, after the shared catalogue, even
while the feature is off. See [Maestro legacy semester carry](legacy-semester-carry.md)
for the adapter paths, retention guarantees and remaining standalone typing limitation.
