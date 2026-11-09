# Core-to-main backup integration — 2026-10-14

This integration merges core at deb71d4cd4eef5ed662fb2a2d3770fca2b7b685c (including #58) into main at 494fb91aa72d504e83d8e31a2d4851239fe5fc26. The direct core-to-main PR #59 conflicts because Custom Soundtracks extends the same backup paths. The resolution lives on integrate/core-to-main, keeping the core branch free of mod code.

## Conflict resolution

- Shared backup classification retains soundtrack archive entries alongside core's collection/record preflight.
- Desktop restore runs core preflight and soundtrack integrity validation before any live data writes, then retains soundtrack restoration after the game records. Safe temporary-ZIP replacement and ordinary texting request ownership are retained from core.
- Browser restore keeps the soundtrack exclusive lock and both music stores in the same transaction as game data. Every music write is awaited inside core's abort-on-error guard. A music failure cannot commit an earlier settings write; a later character-write failure rolls music and saves back together.
- Older backups without music retain the player's existing soundtrack selections and files.

## Validation

All three typechecks pass. Full Windows suite: 2,170 passing tests, 1 existing skip across 170 files. Desktop and browser production builds pass. The focused six-file backup/archive/texting/soundtrack run has 57 passing tests.

Extended the existing native/browser import tests with real synthetic WAV bytes and distinct source/current assignments. Checks cover successful music-plus-save restore, malformed metadata, damaged music, old archives without music, and injected browser failures in both music and later character writes. Original core backup/export/texting regressions remain present. No paid requests, user saves or installed games were used.

Desktop multi-file restore still has no global filesystem rollback for unrelated I/O failures. Browser tests use fake IndexedDB; this is not a fresh Linux or installed-game QA run.

Use this integration PR to bring core into main, then continue with #57 and draft #53. Merge normally, without squashing, so the core ancestry remains connected. This branch does not include those unmerged PRs.
