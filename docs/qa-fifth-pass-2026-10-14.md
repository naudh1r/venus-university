# Fifth-pass QA verification — October 14, 2026

## Review split

Base-game backup preflight, safe ZIP replacement and ordinary texting request ownership have been extracted into separate core and upstream branches. Their original mixed-mod regressions remain in the Echo integration. #57 now contains only the community-mod fixes; prior validation totals below describe the pre-split combined work. Regeneration context and mod reply hooks remain here. See qa-base-game-split-2026-10-14.md for the branch mapping and updated checks.

The supplied evidence targeted an older Echo head. All seven supplied test files were rerun unchanged against the current combined branch before editing: 18 checks passed and five failed, covering three issues. Typechecking passed. Fixtures use temporary folders, synthetic profiles, fake IndexedDB and mocked model requests.

## Backup restore preflight (#57)

A malformed `characters` collection could reject a desktop restore after settings and saves had already changed. In the browser, an exception after requests were queued could leave those requests free to commit.

Both backends now check required collection shapes, row records, IDs and duplicate destinations before restoring data. Existing save, enrollment, character and photo record readers supply their version/required-field checks. Optional picture/photo collections are checked too. Existing extension, image, background, scene, replay and soundtrack integrity checks remain in place. The browser explicitly aborts the entire restore transaction after synchronous or asynchronous write failures.

Regression coverage verifies malformed metadata leaves existing saves/settings intact; valid imports still work; soundtrack integrity failures are rejected; invalid collection entries and duplicate destinations are refused; and an injected late browser write failure rolls back already queued changes. Existing backups without optional collections and supported version-2 character records remain accepted.

This is preflight validation and browser transaction rollback, not a new cross-filesystem desktop transaction. Unexpected disk errors during a desktop restore remain a separate limitation.

## Echo-specific follow-up (#53)

The Echo integration additionally fixes inactive carried Character Dynamics starting choices leaking into Unspoken context, and an acknowledged Echo edit being discarded from live state when its editor closes during saving. Its tests retain mixed Echo/reflection/music import coverage alongside the common checks.

The supplied ability dispatch, social carry and soundtrack controls already passed. No additional soundtrack regression was found in this pass. Automated tests do not establish live model judgment or narrative quality; no paid requests or personal saves were used.

## Final source checks

Community branch: 2,227 passing tests, one existing skip, all three typechecks and desktop/web builds. Combined Echo branch: 2578 passing tests, one existing skip across 217 files, all three typechecks and desktop/web builds. The combined suite includes invalid mixed Echo/reflection/music restore and successful mixed restore checks.
