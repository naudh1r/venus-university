# Brief: Photo Feature 1.7.0 — her free hand

On `mod/photo-1.7.0-vu0.6.0`, as one commit on top of `65bb3ad8`. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only (`photoPose.ts` and its tests), no allowlist rows, no guide edits. Push to `origin`.

**Every tag added must exist in the Danbooru catalog.** Where a name below is missing there, use the nearest canonical tag, and list the substitutions in the commit message.

## The case

A mirror selfie's caption: "A mirror selfie of her in her room, smiling sweetly at the viewer while toying with her choker."

Tags sent: `looking_at_viewer, mirror, reflection, holding_phone, full_body`, with no tag for the free hand. The model gave both hands a phone. Adding `hand_on_own_neck` to the positive and `dual_wielding, multiple_phones` to the negative, with the same seed, gave one phone and her free hand at her choker.

## 1. Everyday hand gestures (every tier, every shot)

Add rows to `FREE_HAND_GESTURES`, after waving and pointing, most specific first:

| Caption | Tag |
|---|---|
| toying with, touching, adjusting, fiddling with her choker or necklace | `hand_on_own_neck` |
| playing with, twirling, tucking or running a hand through her hair | `hand_in_own_hair` |
| hand on her cheek or face, cheek resting on her hand | `hand_on_own_cheek` (or `hand_on_own_face`) |
| a finger to her lips | `finger_to_mouth` |
| biting her finger or nail | `finger_biting` |
| hand on her chin | `hand_on_own_chin` |
| a hand over her heart | `hand_on_own_chest` |
| tugging her hem or sleeve, adjusting her clothes | `adjusting_clothes` |
| blowing a kiss | `blowing_kiss` |
| a heart with her hands | `heart_hands` |
| hands behind her back | `arms_behind_back` |
| covering her chest or herself (shy) | `covering_breasts` / `covering_crotch`, explicit and suggestive only |

- Add "toying", "fiddling", "touching" and "adjusting" to the busy-hand cues, so these strike the default placements.
- The existing "playing with her hair" activity row, which has no tags, now gets `hand_in_own_hair`.
- One gesture at most: the first match wins.
- Existing explicit `HAND_ACTIONS` outrank these gestures.

## 2. A mirror selfie has one free hand

In `selfieShot`'s mirror branch (one hand is always on the phone):

- **A one-handed act or gesture** (section 1, a peace sign, one breast, a hand between her legs): keep its tag.
- **A two-handed act** (the caption says "both hands", or the act is two-handed by nature, like `spread_pussy` with both hands or `grabbing_own_breast` on both breasts): replace it with its one-handed form where one exists.
  - `grabbing_own_breast` stays as is (it doesn't imply both).
  - Spreading becomes `spread_pussy` without `spread_legs` weighting.
  - Two-handed-only gestures (`heart_hands`, `arms_behind_back`) are dropped from a mirror selfie.
- **Negatives:** add `dual_wielding, multiple_phones` to every mirror selfie's negative prompt.

Other shots are unchanged: a plain selfie with both hands busy already becomes someone else's photo (`handsFull`), and a friend's or timer shot has no phone in hand.

## Tests

- The choker caption → `hand_on_own_neck`, `holding_phone`, and the negative has `dual_wielding` and `multiple_phones`.
- "A mirror selfie… twirling her hair and smiling" → `hand_in_own_hair`.
- "A mirror selfie… a peace sign" → `v`, and the second-phone negatives.
- "A mirror selfie… both hands on her breasts" (explicit) → `grabbing_own_breast` with no both-hands tag, plus `holding_phone` and the negatives.
- "A mirror selfie… making a heart with her hands" → no `heart_hands`.
- A friend's photo: "…making a heart with her hands" → `heart_hands`.
- "Sitting at a cafe table, chin on her hand" → `hand_on_own_chin`, no `hands_on_lap`.

## Changelog

No new bullet: the 1.7.0 "More than selfies" bullet already covers her hands.

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
