# Polish: gallery hover and the info icon's look

Amend the same single commit on `mod/photo-1.6.0-redraw-vu0.6.0`, then redo the cherry-pick onto `mod/photo-kit-switch`. No new allowlist rows. Don't edit any guide.

## 1. Gallery: the icons grow with the tile

- **Today:** the gallery tile grows on hover (`quietLift`, scale 1.1), and that stays. But the eye and info buttons are siblings of the cell button (a button can't nest in a button), positioned on the `li`. So when the cell grows, they stay at the unscaled corners and float over the picture.
- **Fix:** put the hover growth on one element that holds the cell button, the DM/Feed chip, the eye and the info icon together, so they all scale as one tile and the icons stay in the grown tile's corners.
  - For example, make the `li` (or a wrapper inside it) the motion element: it takes `quietLift` on hover and `quietPress` on press, and the cell button keeps only its click.
  - Pressing the eye or the info icon must not trigger the tile's press or the lightbox.
  - Keep the tint `quietLift` gives the cell.
  - Reduced motion and disabled (locked explicit) tiles behave as they do today.
  - The redraw wait (`PhotoWait`) in a tile follows the same rule.

## 2. Gallery: a grown tile touches nothing

- **Today:** a 2:3 tile at scale 1.1 overhangs about 5% of its height above and below. The grid's 16px row gap and the scroller's edges can't absorb that, so a grown tile overlaps the row above or below and gets cut off at the scroller's top and bottom.
- **Fix:** in `ContactGallery.css`, scoped to `.vu-contact-shots` and its scroller only, so the game's other galleries are untouched:
  - Give the grid enough row gap that a grown tile never touches the tiles above or below it.
  - Give the scroll area enough vertical padding that the first and last rows never clip when grown.
  - The overhang scales with tile width (each side is 7.5% of the width), so derive the space from the tile size, not a guessed pixel value. For example, use container query units on the grid, or `calc()` from the column width. It must hold at every window size the game supports.
  - Columns stay as they are: left and right are already fine.
  - Check by hand at the smallest and largest window sizes that the first row, the last row and a middle row all grow without touching anything.

## 3. The info icon matches the friend tag icon

The info icon (bottom-right) must be an exact mirror of the friend tag's icon (`.vu-bb-photo-tags-toggle`, bottom-left):
- 12px from the bottom and right edges, not 8px.
- Background `color-mix(in srgb, var(--vu-accent-shadow) 72%, transparent)`, with no darker hover fill.
- SVG stroke width 2.75.
- A `motion.button` with `gestures(false, toggleLift, quietPress)`.
- Focus outline `2px solid var(--night-text)`, offset 3px.

The one difference stays: the info icon only shows on hover or keyboard focus. Fade it in and out with opacity as now, so the lift and press motion doesn't fight the fade. Leave the eye button as it is.

## Checks

- `npm run typecheck` passes on both branches; the kit and photo tests pass.
- The allowlist is unchanged.
- By hand: in the gallery, hover a tile in each row. It grows with its chip, eye and info icon in its corners, and touches neither its neighbours nor the scroller's edges. In a post, the info and tag icons mirror each other exactly.
