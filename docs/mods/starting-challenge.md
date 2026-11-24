# Starting Challenge

An optional, independent mod by Maestro Leeds. Enable it in **Main Menu → Mods → Starting
Challenge**, then start **New Game**, **Quickstart**, or **Scene Creator**. It is not in the Skill trees panel.

On the name screen, use the game's normal minus/plus controls to set **Brain, Body and Heart
separately**. Each row defaults to Unremarkable. The arrow rows show **rank titles
only**, without point values. All normal choices remain available, with four extra choices
below the native −15 option. The same names appear in stat displays after setup:

| Starting tier | Points | Saved floor for that stat |
| --- | ---: | ---: |
| Peaked in the Womb | −100 | −100 |
| Life’s Punchline | −80 | −80 |
| Rock Bottom | −60 | −60 |
| Struggling | −30 | −30 |
| Below Average | −15 | −15 |
| Unremarkable and higher native tiers | 0 and higher | −15 |

For example, you can start with Brain at −80, Body at −100 and Heart at zero. Nothing forces
all three stats to match. The full selection is −100, −80, −60, −30, −15, 0, 15, 35, 60, 100.

Scene Creator offers the same ranks in its Brain, Body and Heart dropdowns, using names only.
It copies the reader's displayed ranks from the newest save, including challenge ranks, and
keeps the selected values when saving or replaying a created scene. These choices do not
change the source playthrough. Turning the mod off hides new challenge choices, while a
challenge rank already copied into the draft remains visible and saved scenes keep their ranks.

The mod ships off by default and does not require Campus Talents, Echo or Breakthrough.
With it off, native New Game choices and Quickstart defaults apply.

Regular class, work and training gains recover stats point by point. Displayed tiers advance
from Peaked in the Womb to Life’s Punchline at −80, Rock Bottom at −60, Struggling at
−30, Below Average at −15, then Unremarkable at zero.
Reader descriptions reflect the lower stats. Native job/attraction tier numbering remains
unchanged: all four lower tiers still fail requirements that Below Average fails.

The choice is saved with registration and every save. Each stat keeps its own original floor
even after improving. Reloading, resuming registration, changing the global toggle or continuing
into a later semester never reapplies the starting values. Old whole-reader challenge saves
retain progress and their original −30/−60 floor. Existing normal saves are unchanged.

## Implementation

- [Mod registration](../../src/shared/modEntries/starting-challenge.ts): default-off, playthrough
  scope, no dependency, and the semester carry adapter. No global difficulty options.
- [Challenge rules](../../src/shared/startingChallenge.ts): legacy strings and version-2 per-stat
  floor records, setup selection and opening-floor capture. Floors are never recalculated on load.
- [Stat arithmetic](../../src/shared/playerStats.ts): extra starting/display tiers −4 through −1,
  names, descriptions and recovery milestones. Mechanical tiers 0–5 stay fixed.
- [Renderer registration](../../src/renderer/modEntries/starting-challenge.ts): supplies the
  playthrough's saved per-stat floors through `statFloor`. Projections, rank-up messages and
  committed gains use the same hook; arithmetic no longer accepts a challenge-specific argument.
- [Name modal](../../src/renderer/views/PlayerNameModal.tsx) and
  [setup flow](../../src/renderer/views/NewGameView.tsx): native controls in both start routes,
  snapshot into enrollment and initial save. Quickstart shows stat controls when enabled.
- [Scene Creator](../../src/renderer/views/SceneCreatorView.tsx), its
  [draft store](../../src/renderer/stores/sceneCreatorStore.ts), and
  [saved-scene rules](../../src/shared/sceneCreator.ts): the same starting tiers in standalone
  scenes, including copying challenge ranks from the newest reader and replaying them.
- [Stat badges](../../src/renderer/components/StatRadar.tsx) and their
  [styles](../../src/renderer/vu_styles/StatRadar.css): wrap the two longer challenge names,
  including a rank-up crossfade, so the Body and Heart badges do not overlap.
- Optional **exStartingChallenge** in saves and enrollments; **gameStore.ts** loads, resets and saves it.
- [Tests](../../test/startingChallenge.test.ts): normal-save isolation, mixed starts, loss floors,
  recovery, registration persistence, save round trips, legacy compatibility and semester carry.

The persisted shape is **{ version: 2, floors: { brain: -80, body: -100, heart: -15 } }** for
the example above. The values describe loss limits, not current stats. The current stats stay
in the game's normal **stats** record.

Supported floors are exactly −100, −80, −60, −30 and −15. The existing version-2 format is
retained; older binaries cannot read the two newly supported floor values, so use this build
or a newer compatible one for those new playthroughs. Existing −30/−60 saves remain compatible.

Starting Challenge is not a mid-playthrough stat editor. Academic penalties still apply: with Brain and Heart still at
−80 or −100, even perfect exams or fully completed projects score zero before perks. Recovering
Brain before assessments matters. No grading, semester decay or BP rules were changed here.

With Campus Talents enabled, the existing continuous BP curve gives 280% rewards at an average
stat of −80 and 300% at −100. Mixed starts use the average; intermediate values count too.
Activities and skills award their full stat gains throughout this range and above zero.
Personal Growth purchases work throughout this range, under the same weekly limits.

See [Campus Talents](campus-talents.md#bond-points) for the full BP curve.

## Legacy semester registration

The legacy carry adapter registers at renderer boot, after the shared catalogue, even
while the feature is off. See [Maestro legacy semester carry](legacy-semester-carry.md)
for the adapter paths, retention guarantees and remaining standalone typing limitation.
