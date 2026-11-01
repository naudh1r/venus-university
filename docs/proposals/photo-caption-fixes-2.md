# Fixes: caption fixes review (b31aeded)

Amend `b31aeded` on `mod/photo-1.7.0-vu0.6.0`. Photo files only, no allowlist rows, no guide edits.

## 1. Don't leave the held object's tail behind

`PHOTO_CLAUSE_END` stops the "holding …" cut before `in`, `at`, `on` and `by`, but those words usually belong to the object, not the place:

- "A mirror selfie in her room holding an iced coffee in a paper cup." now becomes "A mirror selfie in her room in a paper cup."
- "A mirror selfie of her holding a bouquet at her chest beside the window." now becomes "A mirror selfie of her at her chest beside the window."

**Fix:** drop `in`, `at`, `on` and `by` from `PHOTO_CLAUSE_END`. Keep the unambiguous ones: `beside`, `next to`, `in front of`, `near`, `against`, `under`, `outside`, `inside`, `while`, `as`, `with her`, and `,.;`. The arcade case still works, since it uses "beside". Add both sentences above as tests. The expected results are "A mirror selfie in her room." and "A mirror selfie of her beside the window."

## 2. Duo photos: put back the removal of described clothes

The old `WORN_CLAUSE` removed every "wearing … / dressed in … / in their …" clause from a duo's shared scene, for the reason its comment gave: said over the whole picture, the two split the clothes between them (one in an open shirt over the other's camisole, left in nothing under it). Each half is dressed from her own wardrobe instead. The new code only removes set names, so "in matching pink hoodies" or "wearing sundresses" now reaches the shared scene again.

**Fix:** restore `WORN_CLAUSE` (with its comment) in `buildDuoPhotoPrompt`, applied after `withoutOutfitName`. Add a test showing that a described outfit is gone from the duo scene and each half keeps her own outfit tags.

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
