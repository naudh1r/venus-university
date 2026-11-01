# Brief: Photo Feature 1.7.0 — keep the place, drop the outfit name, saner mirror selfies

On `mod/photo-1.7.0-vu0.6.0`, as one commit on top. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only. No allowlist rows, no guide edits. Push to `origin`.

## The case, from a player's log

A feed post's `image` read:

> "A mirror selfie of her in her everyday clothes holding an empty token cup beside a row of brightly lit arcade cabinets."

The prompt Photo sent ended:

> `A mirror selfie of her in her everyday clothes, mirror, reflection, holding_phone, full_body`

Two things went wrong: the arcade was lost, and "in her everyday clothes" was sent as text even though the outfit's own tags (`(oversized off-shoulder ivory knitted_sweater:1.2), brown plaid pleated_skirt, …`) were already in the prompt. The result was a hallway mirror selfie.

## 1. Keep the place when a held object is cut (`photoPose.ts`)

- **The bug:** `withoutHeldObject`'s `holding` pattern cuts from the verb to the next `,` `.` `;`, which took "beside a row of brightly lit arcade cabinets" along with the cup.
- **Fix:** stop the cut before a place or clause phrase, so only the held object goes. For example: `beside`, `next to`, `in front of`, `near`, `by`, `at`, `in`, `on`, `against`, `under`, `outside`, `inside`, `while`, `as`, `with her`.
  - "…holding an empty token cup beside a row of brightly lit arcade cabinets." becomes "…beside a row of brightly lit arcade cabinets."
- Also check the other trimming steps the caption passes through (`withoutCameraHold`, `withoutWhoTookIt`, `withoutSelfieWord`, `withoutNames` and any similar one) for the same cut-to-the-end pattern, and fix them the same way where they have it.
- **Test:** the sentence above, plus one where the place comes after a camera hold, if `withoutCameraHold` had the bug.

## 2. Drop the outfit's name once its tags are in (`photoPrompt.ts`, beside the wardrobe)

- **Why:** the brief asks the AI to name her set ("her everyday clothes", "her PE kit", "her swimsuit", or a custom set's name) so `photoWardrobe` can pick its tags. After that, the name is noise: "everyday clothes" means nothing to the checkpoint, and it competes with the real tags.
- **Fix:** once `photoWardrobe` has matched a set, remove that reference from the caption before it goes into the positive prompt, with its joining words:
  - Covers "in", "wearing", "dressed in" and "in her own"; "her" or "their"; and clothes, cloth or outfit.
  - Also covers the PE kit, the swimsuit and the matched custom set's name.
  - Then tidy the commas and spacing.
  - "A mirror selfie of her in her room wearing her everyday clothes, smiling sweetly at the viewer…" becomes "A mirror selfie of her in her room, smiling sweetly at the viewer…".
- **Only when a set was matched:** a caption that describes real clothes ("in a red raincoat") keeps them, because those words *are* the outfit.
- **Duo photos:** do the same to the scene prompt for "in their everyday clothes", "in their PE kit" and "in their swimsuits". Each girl's outfit tags are already in her own node.
- **Test:** the two sentences above, the duo "in their everyday clothes" case, and the red-raincoat case staying unchanged.

## 3. Prompt: a mirror selfie only where there is a mirror (`photoBrief.ts`)

- Add to the DM brief's `captioning` and to `postPhotoLines`, next to the line that names the kinds of photo: a mirror selfie only where there is one — her room, a bathroom, a changing room.
- Draft it against the neighbouring lines, keeping their plain voice. For example: "A mirror selfie only where there would be a mirror: her room, a bathroom, a changing room."

## 4. Prompt: the place first (`photoBrief.ts`)

- In the same two places, ask for the caption to open on where she is: "Start with where she is, then what she is doing." Draft it against the existing "One sentence, and a full one: where she is, …" line, and merge it into that line rather than adding a separate one if that reads better.
- No test: it's prompt wording.

## Changelog

Fold into `## 1.7.0` as one bullet in the page's voice. For example: photos keep the place she described, and no longer put the name of her outfit into the picture's prompt.

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
- By hand: a feed or DM photo whose caption has "holding … beside …" keeps the place in the prompt (info icon), and no prompt contains "everyday clothes", "PE kit" or "swimsuit" as text when that set's tags are present.
