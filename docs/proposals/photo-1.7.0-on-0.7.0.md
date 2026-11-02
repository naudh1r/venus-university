# Brief: rebuild Photo 1.7.0 on game 0.7.0

Follow `photo-0.7.0-report.md`. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Push to `origin` only. Don't edit any guide.

## Branches

1. **`mod/photo-1.7.0-vu0.7.0`**, from `origin/main` (`4b61c663`, game 0.7.0):
   - merge `origin/core/photo-hook-1.7.0-vu0.7.0` (`71c123f1`) with a merge commit;
   - merge `origin/mod/photo-1.7.0-vu0.6.0` (`834ed9e1`) with a merge commit.

   The core branch carries a 0.6.0-based copy of the hook (`99448bc6`). Where git reports the two cores as overlapping, keep the `71c123f1` version: `since: '0.7.0'`, the separate `dmReplyLead` import, `promptTextEdits`, LF line endings in the API reports.
2. **`test/photo-1.7.0-vu0.7.0`**: `origin/main` with `mod/photo-1.7.0-vu0.7.0` merged in, for play-testing.

## Fixes on top (one commit)

- **`test/qa2-textregen-photo.test.ts`:** both `toHaveBeenCalledWith` assertions on `sendPhoto` gain the fourth argument `true`. All five cases must pass.
- **Early-render tests:** add focused tests in `photoTurn` for an early render that must not attach:
  - a game loaded mid-reply;
  - Photo switched off;
  - a blocked reply;
  - a failed reply;
  - a final reply whose `photoPrompt`, `sendPhoto` or tier differs from the lead.

  Each must leave no message pointing at the early file, and `drop` it once its render settles. Also cover a matching reply that attaches the running render.
- **The sidecar write:** take `writeAtomicBytes` from `@vx/modkit/main` instead of `./jsonFile`, and drop that allowlist row if nothing else in `localPhotoService.ts` needs `./jsonFile`.

## Checks

- `npm run typecheck`.
- The kit tests, every `test/*photo*.test.ts` (case-insensitive, including the `qa2` ones), `test/textingLead.test.ts` and `test/switchedOn.test.ts`.
- The full suite, with only the known baseline failures.
- The allowlist has no new rows.
- Report the commit hashes.
