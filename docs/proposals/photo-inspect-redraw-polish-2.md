# Polish 2: field scrollbar, tag icon size and focus, gallery row gap

Amend the same single commit on `mod/photo-1.6.0-redraw-vu0.6.0`, then redo the cherry-pick onto `mod/photo-kit-switch`. No new allowlist rows. Don't edit any guide.

## 1. No scrollbar on a fitted prompt field

- **Today:** a prompt field fitted to its text (the positive one, with its blank lines) still shows a scrollbar whose thumb fills almost the whole track. It is overflowing by a pixel or so.
- **Likely cause:** `scrollHeight` is a whole number, while the text's real height is fractional and adds up over lines.
- **Fix:** in the fit in `PhotoInfo.tsx`, after setting the height, read the field again. If `scrollHeight > clientHeight`, add the difference plus 1px. Do this both for the reset fit and for the grow-while-typing fit. Everything else about the fields stays as it is: they still drag-resize, and scroll when dragged shorter.

## 2. The person glyph a little smaller

The friend tag's person glyph (`PhotoPostSpots.tsx`) reads as heavy beside the info icon's "i".
- Draw it at 14px instead of 16px, keeping its 24-unit `viewBox` and shape.
- Raise its `strokeWidth` to 2.85, so the drawn line matches the info icon's 2.5 at 16px.
- The circle stays 30px, and the info icon is unchanged.

## 3. The tag icon's focus outline back

The last polish removed `.vu-bb-photo-tags-toggle:focus-visible`, and since the tag is always visible, keyboard focus on it now shows nothing. Restore it: `outline: 2px solid var(--night-text); outline-offset: 3px;`

## 4. Gallery rows only as far apart as a grown tile needs

- **Today:** `row-gap: calc(16px + var(--photo-overhang) * 2)` leaves room for two grown tiles meeting. Only one tile grows at a time, so rows sit about 60px apart, and that looks too loose next to the columns.
- **What looks right:** sideways. A grown tile overhangs 5% of its width on each side, which the 16px column gap just absorbs.
- **Fix:** give rows the same margin. A grown tile overhangs 7.5% of its width above and below, so the row gap is the column gap plus the extra 2.5%:

  ```css
  row-gap: calc(16px + var(--photo-tile-width) * 0.025);
  ```

  That comes to about 23px at today's size. It may be clearer to name the two overhangs: `--photo-overhang-x: 0.05`, `--photo-overhang-y: 0.075`.
- Keep `padding-block: var(--photo-overhang)` at the full 7.5%, so the first and last rows still don't clip at the scroller's edges.

## Checks

- `npm run typecheck` passes on both branches; the kit and photo tests pass.
- The allowlist is unchanged.
- By hand: a long solo and a long duo prompt open with no field scrollbar. In a post, the person glyph sits a touch smaller than the "i", with the same line weight. Tabbing to the tag shows its outline. In the gallery, rows sit only a little further apart than columns, and a grown tile clears the row above and below by about as much as it clears its side neighbours.
