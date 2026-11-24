# QA review split — 2026-10-14

PR #57 now contains community-mod fixes only. Its DESIGN_GUIDE.md change has been removed; the restore note is recorded here instead:

> Both restore paths preflight collection shapes, IDs and row records before live writes; the browser explicitly aborts its transaction on a synchronous or asynchronous write failure.

That behavior belongs to the separate base-game fixes, not to #57 alone.

## Separate base-game changes

- Backup import preflight and explicit browser transaction aborts.
- Safe replacement of full-backup and character ZIP exports.
- Ordinary texting send/retry request ownership across playthrough changes.

These are prepared independently on core (fix/base-game-qa) and current Venus Dev main (fix/base-game-qa-upstream). The upstream version preserves its newer semester data and migrations. Neither version depends on community mod hooks. See the base branch's docs/qa-base-game-fixes-2026-10-14.md for reproduction and validation details.

## Changes retained in #57

Text Regeneration still receives current mod prompt context and dispatches committed reply hooks. Hare & Quill continuity, Story Memory recall/editor behavior, Photo Feature reservations, City Life, Character Dynamics, mod-switch persistence and custom soundtrack lifecycle fixes stay here. The mixed-mod backup/regeneration regressions remain in the combined Echo PR #53, alongside both sets of fixes.

The earlier QA reports are historical evidence, including their original test counts. Their base-game findings are addressed by the extracted branch, not by #57's final diff. On the split #57 branch all three typechecks pass, with 2,182 passing tests and one existing skip across 179 files.

Merge the base-game core PR, propagate core into main, then merge #57 and the combined Echo PR #53 using regular merges. The Echo integration preserves the already tested runtime fixes and carries both branch histories. This source split does not require reinstalling an existing combined build.
