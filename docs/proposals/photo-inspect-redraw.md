# Brief: Photo Feature — inspect and redraw a photo

Photo Feature stays at **1.6.0** (not shipped yet); this joins its changelog.

## Branches

1. Branch `mod/photo-1.6.0-redraw-vu0.6.0` from `origin/main` (1.6.0 is already merged there). One commit.
2. Cherry-pick that commit onto `mod/photo-kit-switch`. Fix imports to the kit paths that branch uses; no other changes. One commit.

Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Push to the fork only.

## Boundary rules

- **No new rows** in `test/kit/boundaryAllowlist.json` on either branch.
- Rows are counted per file and module. So:
  - Put the redraw logic **inside `photoTurn.ts` and `photoPost.ts`**, which already reach the game store.
  - New renderer files may import only `@vx/modkit/*` and Photo's own files.
  - Main-side changes stay in `localPhotoService.ts`, `photoIpc.ts`, `localPhotoBackup.ts` and `photoApi.ts`, using only modules those files already import.
- Add any new Photo file to the `photo-feature` globs in `test/kit/modFiles.ts`. The globs list files by name, for example `src/renderer/components/PhotoInfo.tsx`.

## What the player gets

- **Info icon:** hovering a landed photo (in a DM thread, on a feed post, in her contact gallery) shows a round info icon in its **bottom-right** corner: an italic "i" inside a circle.
  - Hidden until hover. Also shown on keyboard focus (`:focus-visible`).
  - Not shown on a pending, failed or covered (explicit, not yet uncovered) photo.
  - It copies `.vu-bb-photo-eye` exactly (30px round, `--vu-accent-shadow` fill, `--night-text` ink, 0.14s opacity fade), mirrored to the bottom-right.
  - Inline SVG, Lucide-shaped (stroke 2.5), `currentColor`.
  - A click opens the overlay only: `stopPropagation`, so neither the lightbox nor the friend tag reacts.
  - In the gallery, it is a sibling of the cell button, as the eye already is, because a button can't sit inside a button.
- **Overlay:** a modal on `useModalShell`, following the style guide's modal-shell section: it closes with a button in the foot, never a ✕. It shows:
  - A mono meta line: seed (or "unknown"), tier, LoRA `name @ weight` (or none), and the friend's first name for a duo.
  - A note when the prompt is **rebuilt** rather than recorded (see Sidecar).
  - Editable multiline `TextField`s holding exactly what ComfyUI received:
    - Solo: **Positive** and **Negative**.
    - Duo: **Scene**, **<Her first name>**, **<Friend's first name>** and **Negative**.
  - Foot, quiet answers first: **Close**, **Redraw with new seed**, and **Redraw with same seed** (primary).
    - "Same seed" is absent when the seed is unknown; "new seed" is then primary.
    - Both redraw buttons are disabled while photos are switched off (`photoGenerationOn`), with a `.vu-form-status` line saying so.
    - Draft the button and status wording against the existing "Image failed to generate." / "Reroll" voice.
  - Pressing a redraw button closes the overlay and starts the redraw.
- **Redraw:** the photo shows the loader the player picked (`PhotoWait`, via `usePhotoSwitches().loader`) wherever it appears, while it draws.
  - When the new picture lands, it replaces the old one, and the old file and its sidecar are deleted afterwards.
  - If the redraw fails, the old picture stays.
  - `scene`, `tier` and `with` never change: she remembers what she sent.

## Sidecar (main)

What ComfyUI received for each picture is kept in a small JSON file next to it, never in the save.

- **`photoFiles.ts`:**
  - `photoSidecarOf(file)` swaps the `.png`/`.webp` ending for `.json`.
  - `isPhotoSidecar(name)` matches only sidecars of names `isPhotoFile` accepts, including legacy names.
  - `nextPhotoIndex` must keep ignoring sidecars (today it does, since `photoIndexOf` requires png/webp; keep it that way).
- **Shape** (in `photoTypes.ts`):

  ```
  { schemaVersion: 1, seed: number, tier: string,
    positive: string, negative: string,   // the scene prompt for a duo
    left?: string, right?: string,        // duo only
    lora?: { name: string; weight: number } }
  ```

- **Writing it:** `generatePhoto` / `generateDuoPhoto`:
  - Take an optional final `{ seed?: number; prompts?: … }`.
  - Use the given seed or a random one, and the given prompts or `buildPhotoPrompt` / `buildDuoPhotoPrompt` as today.
  - After `runGenerationJob` succeeds, write the sidecar with `writeAtomicBytes` for exactly what was sent.
  - A sidecar write failure is logged and does not fail the photo.
- **New channel `photoInfo(playthroughId, character, friend | undefined, tier, scene, file)`:**
  - Returns the sidecar with `recorded: true`.
  - If there's no valid sidecar (photos from before this change), it returns `{ recorded: false, seed: undefined, … }` with prompts rebuilt by the same builders, after `withBodySetting`, plus the LoRA from `characterLoraOf` for solo photos.
- **New channel `dropPhoto(playthroughId, charId, file)`:** deletes the picture (both PNG and WebP twins) and its sidecar.
  - Missing files are fine.
  - It refuses a name `isPhotoFile` rejects.
- **Carry and backup:**
  - `carryPhotos` copies sidecars alongside pictures.
  - `localPhotoBackup` exports and imports them too. On import, accept a sidecar only by name (`isPhotoSidecar`), under 64 KB, and only if it parses as JSON.
- Extend `api.photo` (`photoTypes.ts` declaration, `photoApi.ts`, `photoIpc.ts`) to match.

## Redraw flow (renderer)

- **Where the code goes:**
  - `redrawMessagePhoto(charId, messageId, { seed?, prompts })` goes in `photoTurn.ts`.
  - `redrawPostPhoto(charId, postId, …)` goes in `photoPost.ts`.
  - Share a helper through a new Photo-own file only if it needs no game-store import.
- **Redraw state lives outside the save.** Keep a small module-level store of redrawing keys (`${playthroughId}:${charId}:${file}`), with a hook the bubble, the feed picture and the gallery cell read to show `PhotoWait`.
  - **Never set `pending` on the photo**: the save must keep pointing at the old, good file the whole time.
- **Steps:**
  1. **Guard:** the playthrough is live, photo generation is on, and the photo has `file` and `scene` and is not pending, failed or already redrawing.
  2. **Reserve a new name** with `reserveName`, using the same kind the original used (thread photos `chat`, post photos `bunnyboard`; reuse whatever the first render passed).
  3. **Mark it redrawing and render** with `renderPhoto` (extend it to pass `{ seed, prompts }`; WebP encoding stays as it is). Feed redraws don't need the held-post chain: main's job queue already serialises per girl.
  4. **On success:** if the playthrough is still live and the photo still points at the old file, set the photo to the same fields with `file: newFile`, call `savePhotoState()`, then `dropPhoto` the old file. If the photo or playthrough moved on, `dropPhoto` the **new** file instead.
  5. **On failure,** or no answer within `RENDER_PATIENCE_MS`: clear the redrawing mark, keep the photo, and `console.warn` with a `[photo]` line. A picture that lands after the patience ran out is still applied by step 4.
- **Reload mid-redraw:** the save still has the old file, so the photo just shows. A late landing gets cleaned up by step 4's "moved on" branch if the window survives. Otherwise it's an orphan file, which is acceptable.
- **Gallery:** `GalleryShot` needs the message or post id so its overlay can call the right redraw. Its cell shows `PhotoWait` while redrawing.

## Mod page (`docs/mods/photo-feature.md`)

- Add two bullets to `## 1.6.0`, in its voice: a bold lead, then plain sentences about what the player sees.
  - One for seeing what a photo was drawn from (prompt, negative, seed, LoRA). Photos taken before it show a rebuilt prompt and no seed.
  - One for Redraw: replaces once it lands, keeps the old one if it fails, and nothing she said changes.
- Rewrite `## If a photo looks wrong` around the info icon instead of Ctrl+Shift+I (dev tools are off in the official build), keeping the "send it with the picture" ask. Mention `data/app.log` as the fallback for the `[photo] kept ... as PNG:` line.

## Tests

One small test file for the pure name rules, since carry, backup and name reservation depend on them:
- `photoSidecarOf` round-trips for current and legacy names.
- `isPhotoSidecar` and `isPhotoFile` never accept each other's names.
- `nextPhotoIndex` ignores sidecars.

Nothing else: no tests of overlay wording.

## Done when

- `npm run typecheck` and `npm test` pass on both branches, and the allowlist count is unchanged on each.
- Checked by hand in the app:
  - The icon appears on hover in a thread, on a post and in the gallery, and not on covered, pending or failed photos.
  - The overlay shows recorded prompts and the seed for a new photo, and rebuilt prompts with no seed for an old one.
  - Same-seed and new-seed redraws work for a solo and a duo photo.
  - An edited prompt is sent and shows on reopening.
  - A failed redraw (ComfyUI killed mid-render) keeps the old picture.
  - The old file and its sidecar are gone after a successful redraw.
  - A continued semester carries the sidecars.
