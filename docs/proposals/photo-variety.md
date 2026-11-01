# Brief: Photo Feature 1.7.0 — caption fixes review, and more varied photos

On `mod/photo-1.7.0-vu0.6.0`. Two commits:
1. **Amend `b31aeded`** with Part A.
2. **One new commit** for Part B.

Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only, no allowlist rows, no guide edits. Push to `origin`.

All prompt text below is a draft. Match the neighbouring lines' plain voice, and keep every added line short: the photo brief is sent on every DM turn where she may send one.

---

## Part A: fixes to the caption commit

### A1. Don't leave the held object's tail behind (`photoPose.ts`)

`PHOTO_CLAUSE_END` stops the "holding …" cut before `in`, `at`, `on` and `by`, but those words usually belong to the object:

- "A mirror selfie in her room holding an iced coffee in a paper cup." now becomes "A mirror selfie in her room in a paper cup."
- "A mirror selfie of her holding a bouquet at her chest beside the window." now becomes "A mirror selfie of her at her chest beside the window."

**Fix:** drop `in`, `at`, `on` and `by` from it. Keep `beside`, `next to`, `in front of`, `near`, `against`, `under`, `outside`, `inside`, `while`, `as`, `with her`, and `,.;`.

**Tests:** both sentences, expected to become "A mirror selfie in her room." and "A mirror selfie of her beside the window." The arcade test must still pass.

### A2. Duo photos: put back the removal of described clothes (`photoPrompt.ts`)

Restore `WORN_CLAUSE` and its comment in `buildDuoPhotoPrompt`, applied after `withoutOutfitName`. Said over the whole picture, described clothes get split between the two girls; each half is dressed from her own wardrobe instead.

**Test:** "in matching pink hoodies" is gone from the duo scene, and each half keeps her own outfit tags.

---

## Part B: more varied photos

Players report that DM photos are nearly always selfies. In two logs, 14 of 16 DM photos were selfies (9 mirror selfies), all taken where she was at that moment. Across 67 captions from both logs:
- 53 matched no framing phrase in `framingOf`, so they fell back to pose defaults: 30 upper body, 18 full body.
- The AI wrote "close-up" 22 times, and only 5 of those got close-up tags.
- From below and from the side never appeared.

### B1. Photos from earlier, and taken by someone else (`photoBrief.ts`)

Replace the DM line "It can be a selfie, a mirror selfie, or a photo somebody took of her, whichever fits the moment." with something like:

> "It doesn't have to be taken now. It can be one from earlier — today, a weekend, a trip, a night out — or one a friend took of her. A selfie is for showing him right now."

- Keep the existing mirror-selfie line after it.
- In the feed version, which also offers "a candid one where she is not posing for it", do the same and keep the candid option.
- List "a friend took of her" before "a selfie": models favour what comes first.
- Add, next to "would not send the same one twice": "…and not the same kind of shot every time." Fit it into that sentence rather than adding a new line.

### B2. Name a set, or say what she is wearing (`photoWardrobe.ts`, end of `wardrobeLine`)

Today it ends: "…Otherwise dress her in what she would actually wear there, in her own style: not an oversized knit sweater, cardigan or hoodie unless one is hers."

Make it say, in effect:

> "If she is in something else, or the picture is from another day, say what she is wearing in a few words, with its colour, the way she would actually dress for it, in her own style: not an oversized knit sweater, cardigan or hoodie unless one is hers."

- Don't ask for the whole outfit garment by garment. Photo's framing and coverage steps decide what shows.
- The line is shared by the DM, texting-first and feed prompts.

### B3. An accessory alone doesn't dress her (`photoPrompt.ts`, `describesClothing`)

A caption whose only clothing words are accessories must not count as dressing her, so her set still goes underneath. Accessories: hat, beanie, cap, scarf, glasses, sunglasses, earrings, necklace, choker, bracelet, ring, bag, purse, backpack, hair clip, ribbon, headphones, watch.

- "Waving in a beanie" → her everyday set plus the beanie.
- "In a black slip dress and a choker" → still described, so no set.

**Tests:** both cases.

### B4. Framing: name it, and understand the AI's words

- **Prompt:** in both caption lines, change "how close the shot is" to "how close the shot is — her face, from the waist up, from the knees up, or head to toe".
- **Code (`photoFraming.ts` cues), keeping each table's existing phrases:**
  - Face: "close-up", "closeup", "close up". A **close-up selfie** is the exception: it maps to waist-up (chest-up), because a phone at arm's length doesn't frame only a face. Make `framingOf` check for "close-up/closeup/close up" together with "selfie" before the face row.
  - Waist-up: "medium shot", "medium close-up", "medium close up", "half body", "half-body".
  - Knees-up: "three-quarter", "three quarter", "cowboy shot", "from the thighs".
  - Full body: "full shot".
- Check that `photoPose`'s own framing defaults don't override an explicit `framingOf` result. Today a mirror selfie gets `full_body` by default; "a close-up mirror selfie" must come out close.
- **Tests:** "A close-up in a cozy booth…" → face; "A close-up selfie in a sunlit dorm room…" → waist; "A medium shot standing in an aisle…" → waist; "a three-quarter shot…" → knees; "a close-up mirror selfie…" → not full body.

### B5. Camera angles (`photoBrief.ts`, `photoPose.ts`)

- **Prompt:** extend the same caption line with: "and the angle, if it isn't straight on: from above, from below, from the side, or from behind — from behind only if somebody else took it, or in a mirror."
- **Code:** add "overhead" and "bird's-eye" / "birds-eye" to the from-above cues, and "worm's-eye" / "worms-eye" to the from-below cues.
- **Tests:** "an overhead shot…" and "…from overhead" → `from_above`.

### Changelog

Add one bullet to `## 1.7.0` in the page's voice. For example: her photos aren't always selfies any more — some are from earlier or taken by a friend, closer or wider, from different angles, and in whatever she wore that day.

---

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus every new case above.
- No other test's expectations change, except where they assert the old framing defaults that B4 is meant to change; say which in the commit message.
