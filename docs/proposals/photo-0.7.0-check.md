# Brief: check what game 0.7.0 changed for Photo Feature (read-only)

**Read-only.** Change no code and push no branch. Write the findings to `docs/proposals/photo-0.7.0-report.md` on `notes/photo-inspect-redraw`, commit only that file (author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines), and push that branch to `origin`.

## The setup

- `origin/main` is now game 0.7.0, at `4b61c663` (org PR #237). The old base was `55eac8eb` (0.6.0).
- The org's `core` is one PR ahead, at `38448c7d` (PR #238, a timeout on the `switchedOn` readers). Note whether #238 touches anything below.
- Photo work to be moved onto 0.7.0:
  - `core/photo-hook-1.7.0` (`99448bc6`): fork-only core change, adding the `lead` field option and the `dmReplyLead` hook.
  - `mod/photo-1.7.0-vu0.6.0` (head `834ed9e1`): Photo 1.7.0, which merges the core branch.
  - `mod/photo-kit-switch`: the kit switch plus 1.6.0 inspect/redraw.

## What to check (diff `55eac8eb..4b61c663`)

1. **Kit (`packages/modkit`):** anything changed, added or removed that Photo uses: `PromptAddition`, `promptFields`/`promptRequired`, `afterDmReply`, `afterReachOut`, `dmHistoryNote`, `PostPictureProps`, `useModalShell`, `useDismissLayer`, `TextField`, `TitleTab`, `gestures`, the motion presets, `modState`/`saveField`, the hook table and the contract version.
2. **Texting:** `textingLoop.ts`, `textingStream.ts`, `textingPrompt.ts`, `textingSchema`, where `afterDmReply` and `afterReachOut` are called, and the delta handler. Will `core/photo-hook-1.7.0` still apply, and where would it conflict?
3. **Boundary:** `test/kit/boundaryAllowlist.json` and `test/kit/modFiles.ts`. Photo's rows and globs on 0.7.0, and whether any Photo import that was allowlisted is now gone or renamed.
4. **Photo's own files:** did 0.7.0 touch any file in the `photo-feature` globs (`photoPrompt`, `photoPose`, `photoWardrobe`, `PhotoBubble`, `ContactGallery`, `photoApi`, `photoIpc`, `localPhotoService`, …)?
5. **Main side:** `comfyService.runGenerationJob`, `jsonFile.writeAtomicBytes`, `imageFiles`, `paths`/`photoProtocol`, the backup and archive code, `mod:invoke`/main readers (#226/#227) and `renderComfyImage`: did any land in 0.7.0?
6. **Trial merges** (in a scratch worktree, not pushed):
   - `core/photo-hook-1.7.0` onto `4b61c663`;
   - `mod/photo-1.7.0-vu0.6.0` onto that result;
   - `mod/photo-kit-switch` onto `4b61c663`.

   For each, record the conflicts and whether `npm run typecheck` and the kit and photo tests pass after a straightforward resolution. Don't keep the result.
7. **Versions:** the game version string, and whether a mod's `ModDef` or compat range needs a change for 0.7.0.

## The report

For each item: what changed (files and commits), whether Photo is affected, and what the rebuild will need. End with a short list of the work to rebuild `core/photo-hook-1.7.0`, `mod/photo-1.7.0-vu0.7.0` and the kit switch on 0.7.0, with anything risky first.
