# Maestro legacy semester carry

These adapters retain the existing `ex*` fields across native New Game+. They register
from each mod's renderer entry after the shared catalogue is loaded and before the first
screen, using `registerTermCarry` from `@vx/modkit/shared`. The shared metadata entries do
not register carry callbacks while the catalogue is still evaluating.

Registration is unconditional, including when a feature is switched off. Switching off
effects must not remove its saved history or prevent an old prepared continuation from
being recognized. The callback still applies the same normalization, calendar shifts and
per-semester resets as before; this migration changes where registration happens, not
what is carried. Native semester stat decay is untouched.

| Mod | Adapter | Legacy field |
| --- | --- | --- |
| Breakthrough | `src/shared/breakthroughCarry.ts` | `exBreakthrough` |
| Campus Talents | `src/shared/talentCarry.ts` | `exTalents` |
| Character Dynamics | `src/shared/characterDynamicsCarry.ts` | `exCharacterDynamics` |
| Echo | `src/shared/echoCarry.ts` | `exEcho` |
| Meanwhile | `src/shared/meanwhileCarry.ts` | `exNpcWatch` |
| Breaking Through the Silence | `src/shared/reckoningCarry.ts` | `exReckoning` |
| Starting Challenge | `src/shared/startingChallengeCarry.ts` | `exStartingChallenge` |
| Story Memory | `src/shared/storyMemoryCarry.ts` | `exStoryMemory` |
| The Hare & Quill | `src/shared/whisperCarry.ts` | `exVenusWhisper` |

The native carry functions execute in the renderer. No main-process carry consumer is
added, and no file paths or data formats move. Current versioned mod slices and their
own `saveField.carry` logic are separate from these legacy adapters.

The erased module augmentations still name the in-repo `modCarry` facade. Moving just one
augmentation to the public kit barrel shadows the other legacy fields during typechecking.
Those declarations need a coordinated public typing change before the legacy source can
be independently typechecked as standalone packages. Removing runtime import exceptions
does not finish that packaging step.

`test/maestroCarryKitBoot.test.ts` verifies that real renderer entries register every
prepared carry field with all nine features switched off. Store-only carry tests initialize
the adapters explicitly, since they do not boot the renderer. The native-semester test
also checks retained data through all eight semesters and older branch reloads.
