# Brief: Photo Feature 1.7.0 — a partly undressed photo shows what the caption bares

On `mod/photo-1.7.0-vu0.6.0`, as one commit on top of `ef44420c`. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only (`photoPose.ts`, `photoPrompt.ts`, `photoBody.ts`, `photoWardrobe.ts` and their tests), no allowlist rows, no guide edits. Push to `origin`.

**Every tag added must exist in the Danbooru catalog.** Where a name below is missing there, use the nearest canonical tag, and list the substitutions in the commit message.

## The case

An explicit caption: "In the restaurant restroom stall, she stands with her lavender pleated mini skirt hitched up to her ribcage, having completely removed her panties which she dangles from one trembling finger, fully exposing her … bare pink slit and flushed inner thighs, looking down toward the viewer…, captured from the knees up."

Sent:
- Body: `nipples, navel, wide_hips`.
- Wardrobe: `partially_undressed, skirt_lift, uncensored`.
- Pose: `standing, solo, hand_on_own_hip, blush, cowboy_shot`.

Four conflicts:
1. `hand_on_own_hip`, though one hand dangles her panties.
2. `nipples`, though only her lower half is bared and her top is never mentioned.
3. Nothing names what is bared: no `pussy` and no `no_panties`.
4. No top at all. The skirt belongs to her everyday set, but the set isn't named, so no outfit tags are added.

## 1. Busy hands: dangling and holding up clothing

- Add to `BUSY_HAND_CUES`: dangling, dangles, swinging, twirling, "hanging from her finger", "holding up her (panties|bra|top)".
- Panties held or dangled → `holding_panties`. A bra held → `holding_bra`, if it's in the catalog.

## 2. Coverage follows the half that is bare (partially undressed only)

Today a partially undressed photo gets the bare-body tags for her whole body. Decide which half the caption bares, from the reveal tags and the caption:

- **Lower reveal** (skirt lifted, panties removed or pulled down, bottomless, pussy or slit shown): add lower bare tags (`pussy`, `bottomless` where nothing covers her below), and **no** `nipples` or `breasts_out`.
- **Upper reveal** (top or neckline pulled down, shirt lifted to bare her breasts, topless): upper bare tags (`nipples`, `breasts_out`), and **no** `pussy`.
- **Both:** both sets, when the caption bares both, or says "fully naked" or "nothing on".
- **Neither recognised:** keep today's behaviour.

Fully nude photos are unchanged.

## 3. More reveal phrasings (explicit)

| Caption | Tags |
|---|---|
| removed or took off her panties, no panties | `no_panties` (or `panties_removed`) |
| panties around her ankle, knee or one leg | `panties_around_one_leg` / `panty_pull` |
| bare slit, pussy showing or exposed | `pussy` |
| skirt hitched or pulled up | `skirt_lift` (already handled; keep it) |

## 4. Her set from a described garment (partially undressed)

If a partially undressed caption doesn't name a set but describes a garment from one of her sets, by colour and garment word ("lavender pleated mini skirt" matching her everyday `lavender pleated mini skirt`), treat it as naming that set:
- Add the set's tags, so her top is drawn.
- The reveal tags say what's lifted or removed.
- Strip nothing from the sentence: the garment words stay.

Match on the garment noun plus at least one of its words (colour or style), so "a skirt" alone doesn't pull in a set.

## Tests

- **The restroom caption:**
  - No `hand_on_own_hip`.
  - Has `holding_panties`.
  - Has `pussy` and `no_panties`.
  - No `nipples`.
  - Includes her everyday set's tags.
- **"Pulling down her top to bare her breasts"** (partially undressed) → `nipples`, `breasts_out`, no `pussy`.
- **"Fully naked on her bed"** → unchanged nude behaviour.
- **"Lifting a skirt"** with no match to any of her sets → no set added.

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
