# Third- and fourth-pass QA follow-up — October 14, 2026

## Review split

Base-game backup preflight, safe ZIP replacement and ordinary texting request ownership have been extracted into separate core and upstream branches. Their original mixed-mod regressions remain in the Echo integration. #57 now contains only the community-mod fixes; prior validation totals below describe the pre-split combined work. Regeneration context and mod reply hooks remain here. See qa-base-game-split-2026-10-14.md for the branch mapping and updated checks.

The supplied fourth-pass archive was hash-checked before running its synthetic reproductions. Against the original combined #53/#57 source, its 20 tests produced five failures and fifteen passes. The hidden-recap test was a passing characterization of incorrect editor behavior, not evidence that the bug was absent. The encounter answer lifecycle controls passed; they prompted no production changes. Third-pass reproductions had already established five additional issue groups.

## Community fixes in #57

- Break visits restore the source playthrough record before loading their snapshot, so City Life and Character Dynamics use that run's switches. The visit still has no writable ordinary playthrough ID.
- Hare & Quill confession bookkeeping excludes departed bystanders. Graduation goodbyes retain known identities but deliberately cannot initiate a first identity discovery: that route has no ledger to validate and save a confession. Ordinary eligible private scenes still can.
- Failed overlapping mod-setting writes roll back to the last acknowledged stored switches. Thrown transport errors cannot poison subsequent queued writes.
- Save and character exports create and validate a separate ZIP beside the destination before replacing it. Preparation, creation, validation or replacement failures preserve the old export; temporary cleanup never deletes the destination.
- A late old-session DM reply or retry cannot unlock or delete a newer session's in-flight reply for the same character.
- Editing an encounter recap preserves its hidden flag and other edit metadata. Hidden content stays excluded from recall after the edit is saved; Standard and Light budgets are unchanged.
- Canceling the soundtrack picker or a no-op cleanup no longer invalidates the initial soundtrack load. Successful changes still reject stale loads.

## Echo fixes in #53

- Ready or pending question preparation survives the ordinary-scene-to-Unspoken link handoff. Failed saves preserve the original preparation and spirit; provider, load and relevant context changes still invalidate stale work.
- First-person whispers accept ordinary words that collide with names such as May, Hope and Faith. Explicit third-person owner narration remains rejected. This bounded text validator does not establish live narrative quality.
- The supplied six answer lifecycle controls cover cancellation, loading, reset, delayed final growth, failed saves and commit-time duplicate prevention. They already pass and are retained as regressions.

## Validation

All requests were mocked and test data synthetic; no paid requests or personal saves were used.

- Community alone: 2,192 passed, one existing skip, 182 files; node, renderer and test typechecks; desktop and web production builds.
- Echo alone before integrating #57: 2,444 passed, one existing skip, 190 files; all three typechecks.
- Combined source: 2,516 passed, one existing skip, 207 files; all three typechecks; desktop and web production builds; eight installer tests.
- Additional archive failure tests cover partial creation, validation and rename failures. The combined suite includes corrupt portable Unheard Soul preservation and earned-growth DM regeneration with Character Dynamics on and off.

The original submitted evidence remains unchanged locally. #57 remains reviewable without Echo modules. #53 incorporates #57 as a dependency so the combined build is represented by published source; merge #57 first. Neither PR is merged by this update. Echo remains draft pending broader live-model, balance and release review. Windows validation does not establish a fresh Linux result or certify all model behavior.
