# Polish 2: field scrollbar, tag icon size and focus

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

## Checks

- `npm run typecheck` passes on both branches; the kit and photo tests pass.
- The allowlist is unchanged.
- By hand: a long solo and a long duo prompt open with no field scrollbar. In a post, the person glyph sits a touch smaller than the "i", with the same line weight. Tabbing to the tag shows its outline.
