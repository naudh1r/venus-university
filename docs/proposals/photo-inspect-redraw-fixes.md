# Fixes: inspect and redraw (review of 915579bf / b4cf2348)

The feature works as briefed. Apply the fixes below to the same single commit on `mod/photo-1.6.0-redraw-vu0.6.0` (amend it), then redo the cherry-pick onto `mod/photo-kit-switch`. Same rules as before: no new allowlist rows.

## Must fix

1. **Revert `UI_STYLE_GUIDE.md`.** That file is never edited in this work. The feature's appearance lives in `PhotoInfo.css` and its comments.
2. **Validate the redraw overrides in main**, in `generatePhoto` and `generateDuoPhoto`, before anything is queued:
   - `seed` must be a safe integer ≥ 0.
   - `prompts.positive` and `prompts.negative` must be strings, and `positive` must be non-blank.
   - A duo also needs `left` and `right` strings, and a solo photo must not carry them.
   - Cap each text at a Photo-owned constant (8000 characters).
   - Anything else throws an `appError` with a `PHOTO_OVERRIDE_INVALID` code.
   - The renderer is ours, but every other channel here checks what it is handed.
3. **Duo photo whose friend has left the roster:** `redraw*Photo` returns silently, and the overlay calls `photoInfo` with no friend, so it shows and would send a *solo* prompt for a duo photo. Don't render the info button when `photo.with` is set but the friend isn't in `characters`.

## Should fix

4. **Merge the duplicate redraw flow.** `redrawMessagePhoto` and `redrawPostPhoto` are the same 50 lines. Move the flow into `photoRedraw.ts` as one function that takes:

   ```
   { playthroughId, character, friend, kind: 'chat' | 'bunnyboard',
     read: () => ChatPhoto | undefined, write: (photo: ChatPhoto) => void,
     live: () => boolean, inSave: () => string[] }
   ```

   Keep `redrawMessagePhoto` and `redrawPostPhoto` as thin wrappers in `photoTurn.ts` and `photoPost.ts`, the only places that touch the game store. `photoRedraw.ts` must still import nothing outside the kit and Photo's own files.
5. **The overlay's leave animation is cut.** Pressing Redraw calls `onClose()` and then starts the redraw, which makes `MessagePhoto` and the gallery `Shot` return `<PhotoWait />` early. That unmounts `PhotoInfoButton` and the modal it holds, so the modal vanishes mid-exit. Keep the button mounted through the redraw: render the wait inside the same frame or `li` and hide only the picture and the button.
6. **Match the surrounding code style.** New code packs several statements and props onto long single lines. The files around it wrap at about 100 columns, put one JSX prop per line once a tag wraps, and carry a one-line comment on each IPC handler (see the existing ones in `photoIpc.ts`). Reformat `PhotoInfo.tsx`, the new parts of `localPhotoService.ts`, `localPhotoBackup.ts`, `photoIpc.ts`, `photoApi.ts` and `photoRedraw.ts` to match. No behaviour change.

## Mod page

7. A player can't tell what "before this change" means: say "before 1.6.0" in both places.
8. In `## If a photo looks wrong`, drop the Rebuild sentence. That section is for reporting a bad photo; the changelog bullet already covers Rebuild. Fold it into the Redraw bullet as one clause, for example "…or **Rebuild** them from her current tags first."

## Checks

- `npm run typecheck` passes on both branches.
- `npm test` matches `main`. In this sandbox, `main` itself fails 92 tests in the backup, archive and soundtrack suites because it can't write zip temp files to `/tmp`. The branch's failures must be the same set, plus `test/photoSidecars.test.ts` passing.
- Allowlist unchanged on both branches.
