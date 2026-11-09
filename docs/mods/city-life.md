# City Life

Two separate switches appear in Mods. **City Life locations** adds Lucky Strike Lanes,
Starlight Roller Rink, Purr & Pour Cat Café, and Dance Studio. **City Life jobs** adds part-time work at
those venues and requires the locations switch. Locations work without jobs or any other mod.

Both choices are fixed when a playthrough is created. A pre-framework playthrough with no
mod list keeps its original world. This port does not rewrite an existing roster's haunts,
jobs, or saves. Changing the menu switches changes future playthroughs; existing ones keep
their recorded choices. Slot saves continue using native location/job IDs and schedules.

## Gameplay

The profile generator can choose the venues as recurring hobbies or fun spots, and NPC
group outings can select them. The native scheduler fits visits around classes and shifts;
not every NPC is guaranteed a visit. The map uses normal known NPC whereabouts: an empty
venue gets no extra Go button. A typed scene prompt can still take the player there.
Each location has day/night background art and lore injected when relevant, not a large
always-on context block. Visiting alone awards no automatic affection or money deductions.

| Job | Pay per shift | Minimum stat tiers |
| --- | --- | --- |
| Lane & Counter Attendant | $125 | Body 2 |
| Rink & Rental Attendant | $150 | Body 2, Heart 2 |
| Café & Cat Lounge Assistant | $140 | Brain 2, Heart 2 |
| Dance Instructor | $300 | Good Body (35+), Good Heart (35+), and Dancer III through Campus Talents |

There is no application fee. Native hiring, scheduling, closure rolls, pay raises, shift
gains, boss texts, absences, and dismissal rules apply. NPC jobs use the same venue IDs, so
workers appear at their workplace through the existing timetable and scene casting.

## Code map and integration

- `src/shared/cityLifeCatalog.ts`: typed venue/job content, preserving `ex_bowling`,
  `ex_roller`, and `ex_cat_cafe` IDs from the earlier mod. The new `ex_dance_instructor`
  job uses the new `dance_studio` location.
- `src/shared/cityLife.ts`: shared availability rules. Catalog definitions remain readable
  when disabled so saved references can still be displayed. Only selection paths are gated.
- `src/shared/modEntries/city-life-locations.ts` and `city-life-jobs.ts`: the two independent definitions and the jobs requirement.
- `src/renderer/stores/gameStore.ts`: `playthroughMods` reads the immutable record on load.
  It is runtime context, not a second copy inside each save.
- `src/renderer/stores/modsStore.ts`: synchronizes shared availability with the current
  playthrough record, or with menu switches while creating a game.
- `src/shared/locations.ts` and `jobs.ts`: catalog integration and available openings.
- `src/renderer/prompts/profilePrompt.ts`: generation menus, schemas and validation all
  respect the switches; old IDs remain resolvable when reading existing assignments.
- `src/renderer/stores/loop/npc.ts`: filters new outing destinations.
- `src/renderer/prompts/cityLifeLore.ts`, `lorebook.ts` and `stores/gameLoop.ts`: place lore
  and switch-aware rumor selection.
- `src/renderer/stores/loop/promptState.ts`: keeps disabled venue backgrounds out of prompts.
- `src/renderer/views/JobsModal.tsx` and `mapLayout.ts`: native job board and map anchors.
- `assets/bg/interior/{bowling_alley,roller_rink,cat_cafe,dance_studio}_{day,night}.png`: eight generated
  venue images discovered by the existing desktop/browser asset pipelines. Attribution and
  redistribution notice are in `city-life-assets.txt` beside this document.
- `test/cityLife.test.ts`: switch isolation, immutable playthrough choices, normal work
  arithmetic, schedule constraints, and map occupancy.

City Life uses the shared framework. When updating or integrating it, retain other modules'
registry entries and shared imports. No Story & Social, SQLite, Plot Twist,
Breakthrough, or custom character package is required.

With native 0.5.0 New Game+, an NPC's existing employer remains readable and
is retained across semesters. New City Life job assignments still require the jobs switch.
Scene background choices respect both City Life's switches and the break's off-campus rules.
The combined job behavior is covered in `test/profilePrompt.test.ts`.

Story Memory can recall the native scene history that describes these visits without a
hard-coded venue list. City Life has no SQLite dependency and creates no parallel narrative
history. Both switches and existing saved venue/job IDs must remain stable during updates.

## Framework registration

- `src/shared/modEntries/city-life-locations.ts` supplies its existing mod definition.
- `src/shared/modEntries/city-life-jobs.ts` supplies its existing mod definition.
- This mod has no renderer hook registration; its existing switch-gated integration stays in place.

Existing IDs, switch defaults, mod dependencies and save fields stay compatible. The Dance Studio addition is described below. Native character notes, scene-creator saves and calendar replays remain separate base-game features. Merge framework updates from `core` into this mod branch; resolve conflicts with `main` on a separate `integrate/city-life` branch.

## Dance Studio and Dancer III

Campus Talents does not require City Life. All three Dancer ranks retain their original
dance capabilities anywhere appropriate, including playthroughs with neither City Life
switch enabled. The studio job is an optional integration; its career guidance appears
under Dancer only when the current playthrough has both City Life locations and jobs.

City Life 1.1.0 adds Dance Studio as an ordinary Downtown location. Every player may
visit, practice or arrange a social scene there: no talent, stat or employment check
restricts entry. Campus Talents and City Life jobs can both be off while the venue
remains available through City Life locations. Old City Life playthroughs gain the
catalog entry without rewriting character schedules; a typed visit works even when
no known NPC is there to put it on the map.

With City Life jobs enabled, Dance Instructor stays visible on the Jobs board even
when the player cannot apply. Hiring requires **all three**: Dancer III, Good Body
(35 points), and Good Heart (35 points). Campus Talents must be active for its rank
to count. The three requirement chips and the detail text explain what is missing.
Apply normally and choose shifts; mastering Dancer never hires the player automatically.
This uses the existing single job slot. There is no Brain requirement or application fee.

Base pay is $300 per completed shift, matching Barback. Native raises and active Money-tree wage perks
apply. Each shift has one native +1 Body **or** +1 Heart gain; existing applicable
training perks still apply. Visiting or describing a lesson outside a real job shift
does not create a second reward path. NPC teachers use the normal profession system;
player talent requirements do not create NPC talent trees.

Requirements are checked when hiring, not as an ongoing employment penalty. After a
valid hire, lowering stats or turning Campus Talents off preserves the job and its
normal shifts/pay. Reapplying must meet the requirements again. Other City Life jobs
have no Campus Talents dependency.

Implementation: `JobDef.requiresSkills`, `JobSkillRanks` and
`unmetSkillRequirements` in `src/shared/jobs.ts` provide an additive qualification
check. Callers supply ranks from active mods only; absent ranks fail closed. The
Jobs view checks both stat and skill qualifications; `gameStore.takeJob` rechecks
talent-gated hires, mod availability, existing/closed jobs and valid shift selections
before modifying state. Its boolean result prevents a rejected hire from sending a
welcome text. Existing native hiring behavior for other jobs is retained.

`test/danceStudio.test.ts` covers the toggle matrix, rank/stat boundaries, direct
store calls, schedules, saved employment and ordinary pay. The day/night images and
WebP thumbnails use the normal bundled background pipeline. No save migration or
additional AI request is needed. See `city-life-assets.txt` for attribution and
`dance-studio-art.md` for the image-generation prompts.

The studio scene lore defaults students and instructors to PE wear, including practice and paid teaching. It uses existing PE wardrobe sprites; characters without rendered PE art retain their main outfit through the native fallback. Explicit outfit choices remain possible.
