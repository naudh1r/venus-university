# Godlike Standards

An optional character-trait mod by Maestro Leeds.

In **Manage Characters → Edit → Traits**, select **Godlike** from the trait picker and save
the character. The selected tag is gold in the editor, character details and the revealed
contact profile. No existing character is tagged automatically, and normal AI character
generation does not assign this opt-in trait.

The mod ships off by default. Enable **Godlike Standards** in Mods to apply its extra
requirement. The character's tag is retained when the mod is off.

## Rules

- Brain, Body and Heart must **each** be at least **Godly (100)** before a new romance can
  start. An average of 100 is not enough: 120 / 99 / 120 is still locked.
- Friendship, affection, gifts and ordinary contact can grow while locked. High affection
  does not bypass the stat requirement. Qualifying opens the normal crush chance; it does
  not automatically award a crush or relationship.
- Scene and texting prompts explain the restriction. Promiscuous mood guidance does not
  override it. AI-reported kisses, intimate acts and new lover milestones are also checked
  before projection and saving.
- Existing lovers continue under the game's ordinary relationship rules. There is no new
  upkeep mechanic, decay adjustment, automatic breakup, stat bonus or BP change. If a couple
  breaks up, starting again requires meeting the threshold again.
- Created scenes retain the game's native attraction override and do not advance a campaign.
- The character tag survives ZIP export, import and duplication. Enforcement requires a
  build with this mod enabled; the tag alone cannot add rules to an unmodified game.

## Implementation and limits

The shared entry holds only the mod definition. At renderer boot, after the shared catalogue
has loaded, `src/renderer/modEntries/godlike-standards.ts` registers the trait and threshold
through `registerCharacterTrait` and `registerRomanceRequirement` from `@vx/modkit/shared`.
It registers even while switched off, so the editor retains the opt-in tag and its gold tone.
The core-owned additive extension in `src/shared/romanceRequirements.ts` and `sharedModOn` supply the
live mod lookup. Disabled or absent rules add no requirements; multiple rules combine by taking
the highest minimum per stat.

`relationship.ts` uses these requirements for crush eligibility, requirement hints and an
optional context on `foldRelationshipEvents`. `gameStore.ts` and `sceneSanitizer.ts` supply
that context for both saved and projected milestones. The sanitizer rejects an entire
blocked group act rather than inventing a different pairing. Stored crush awards are checked
as well. The romance registry is core's implementation, identical on core and main, rather
than a Godlike-owned file. Godlike's shared and renderer entries now import only the public
kit; its boundary exception count is zero. Packaging/install validation remains separate.

`prompts/relationship.ts` adds the same requirement to scene, texting and opening context.
An AI can still write inconsistent free-form prose; the code prevents that prose from
automatically granting a blocked romantic milestone, but does not rewrite generated dialogue.

`traits.ts`, `characterFields.ts`, `TagSelect.tsx`, `CharacterModal.tsx` and `ContactPage.tsx`
provide the trait vocabulary and gold appearance. The name and added description are
gender-neutral; this does not introduce a new character-gender system.

Tests: `test/godlikeStandards.test.ts`, the opt-in generation case in
`test/characterPrompt.test.ts`, and the real ZIP round-trip in `test/characterTransfer.test.ts`.
They cover threshold boundaries, mixed stats, mod switches, ordinary/High Standards
characters, milestones, group acts, existing lovers, breakup, prompts and tag rendering.
