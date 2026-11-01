# Addendum: failed-redraw line and Rebuild button

Two additions to the inspect-and-redraw brief. Same branches, same rules: no new allowlist rows, fold everything into the same single commit (amend it if it already exists), then cherry-pick onto `mod/photo-kit-switch` as before.

## 1. A line when a redraw fails

- **When:** a redraw fails, or gets no answer within `RENDER_PATIENCE_MS` (step 5 of the redraw flow). The old photo comes back, and it also shows one short line over its bottom edge for about four seconds, wherever it appears: thread, feed post and gallery cell.
- **Text:** "Redraw failed. This photo stays." Draft it against the existing "Image failed to generate." and keep it that short.
- **Style:** like the friend tag's handle over the picture: `--vu-accent-shadow` fill, `--night-text` ink. Give it `role="status"` and a fade in and out. Under reduced motion it appears and goes with no fade.
- **State:** keep it in the same module store as the redrawing marks, as a failed key with a timer. Never put it in the save. Starting another redraw clears it.

## 2. A Rebuild button in the overlay

- **Placement:** a quiet **Rebuild** button above the prompt fields, not in the foot (it answers nothing).
- **What it does:** it refills the fields with the prompt the engine would build for this photo now, from its `scene`, `tier`, friend and her current tags and body setting.
  - It doesn't redraw, and it keeps the recorded seed. A redraw afterwards sends the rebuilt text.
  - If the player closes without redrawing, nothing is kept: the sidecar only changes when a redraw lands.
- **When shown:** only for photos with a recorded prompt. A rebuilt photo already shows the current build.
- **Main:** `photoInfo` takes a final `rebuild = false`. With `rebuild`, it skips the sidecar's prompts and returns the current build, keeping the sidecar's seed and returning `recorded: false`.

## Extra checks by hand

- A failed redraw (ComfyUI killed mid-render) keeps the old picture and shows the line for a few seconds.
- Rebuild refills an edited photo's fields with the current build and keeps its seed.
