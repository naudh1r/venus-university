# Brief: Photo 1.7.0 on game 0.7.0, then into the kit switch

Replaces the earlier version of this brief. Follow `photo-0.7.0-report.md`. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Push to `origin` only. Don't edit any guide. Report the commit hashes.

## Bases

- **0.7.0:** the org's `main` at `b5b066b6` (PR #239). If `origin/main` is still behind it, fetch `https://github.com/venus-extracurriculars/build main` and use that commit. Don't push `main`.
- **The core hooks:** PR #241 is not merged yet. Use its branch, `origin/core/photo-hook-1.7.0-vu0.7.0` at `8fe38547`. It has the early-DM hook (`71c123f1`) and `renderComfyImage` (`2f9f2f6e`). When #241 lands in `main`, these are the same commits, so a later merge of `main` is clean.

## Step 1: `mod/photo-1.7.0-vu0.7.0`

1. Branch from `b5b066b6`.
2. Merge `8fe38547` with a merge commit.
3. Merge `origin/mod/photo-1.7.0-vu0.6.0` (`834ed9e1`) with a merge commit. That branch carries a 0.6.0 copy of the core hook (`99448bc6`). Where the two overlap, keep the `71c123f1` version: `since: '0.7.0'`, the separate `dmReplyLead` import next to the `textingStream` import, `promptTextEdits`, and LF line endings in the API reports.
4. One commit with the fixes:
   - **`test/qa2-textregen-photo.test.ts`:** add the fourth argument `true` to both `sendPhoto` assertions. All five cases must pass.
   - **Early-render tests (`photoTurn`):** an early render must not attach when a game is loaded mid-reply, when Photo is switched off, on a blocked reply, on a failed reply, or when the final reply's `photoPrompt`, `sendPhoto` or tier differs from the lead. Each leaves no message pointing at the early file, and `drop`s it once settled. Add one test where a matching reply attaches the running render.

## Step 2: `mod/photo-kit-switch` gets 0.7.0 and 1.7.0

On the existing `mod/photo-kit-switch` (head `86547c53`):

1. Merge `b5b066b6`. Resolve `test/kit/boundaryAllowlist.json` as the report describes: from the common base, keep a row only if both sides keep it, and keep either side's new rows.
2. Merge `mod/photo-1.7.0-vu0.7.0`. The kit switch's own inspect/redraw commit (`86547c53`) is an older copy of what 1.7.0 has.
   - In every overlapping Photo file, keep **1.7.0's behaviour** and the **kit switch's imports** (`@vx/modkit/*` in place of direct game imports).
   - Don't take a 1.6.0 copy of a file over its 1.7.0 copy: prompt, pose, wardrobe, framing, sidecar, inspect/redraw and early render all come from 1.7.0.
   - The version is `1.7.0`, the mod page keeps 1.7.0's changelog, and `test/kit/modFiles.ts` keeps both sides' additions.
3. One commit moving Photo's main side to the kit where an API now exists:
   - `renderComfyImage` (from #241) in place of `comfyService.runGenerationJob`;
   - `writeAtomicBytes` from `@vx/modkit/main` in place of `./jsonFile`.

   Drop each allowlist row that becomes unused, and add none. If `renderComfyImage` can't express something Photo's render needs (the duo graph's extra text nodes, the LoRA node, the PNG destination, cancellation, progress), keep `runGenerationJob` for that path and say why in the commit message.
4. Report the Photo allowlist count before and after (79 → 37 from the kit switch, then lower).

## Step 3: the test branch

Build `test/photo-1.7.0-kit-vu0.7.0`: `b5b066b6` with `8fe38547` and `mod/photo-kit-switch` merged in, for play-testing.

## Checks, on both mod branches

- `npm run typecheck`.
- The kit tests, every `test/*photo*.test.ts` (case-insensitive, including the `qa2` ones), `test/textingLead.test.ts`, `test/switchedOn.test.ts` and `test/modComfyRender.test.ts`.
- The full suite, with only the known baseline failures.
- No new allowlist rows.
