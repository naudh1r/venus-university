# Brief: Photo Feature 1.7.0 — undressing hands, reveal tags, an outfit to undress

**Start after the busy-hands commit has landed**, on top of it, as one commit on `mod/photo-1.7.0-vu0.6.0`. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only (`photoPose.ts`, `photoPrompt.ts` and their tests), no allowlist rows, no guide edits. Push to `origin`.

**Every tag added here must exist in the Danbooru catalog.** Where a name below is missing there, use the nearest canonical tag, and list the substitutions in the commit message.

## The case

An explicit photo's caption: "In a park at night, standing under a dim path light, pulling down the neckline of her everyday clothes with both hands to bare both breasts, looking straight into the viewer…"

Sent:
- Wardrobe: `partially_undressed, uncensored`.
- Pose: `standing, solo, hand_on_own_hip, (upper_body:1.3)`.

Three gaps:
1. "Pulling" isn't a busy-hand cue, so `hand_on_own_hip` stayed while both hands were at her neckline.
2. `displacedTags` read nothing from "pulling down the neckline … to bare both breasts", so nothing named the reveal.
3. "her everyday clothes" stayed in the sentence, and no outfit tags said what she was pulling down. Explicit photos skip both the outfit tags and `withoutOutfitName`.

## 1. Undressing actions are busy hands (every tier)

Add to `BUSY_HAND_CUES`: pulling, pulling down, pulling up, tugging, lifting, lowering, unbuttoning, unzipping, slipping off, sliding off, peeling off, holding up her (top/skirt/shirt).

- These strike placements in everyday, suggestive and explicit photos alike.
- They add no tags of their own; sections 2 and 3 handle that.
- The rows that already exist (e.g. "holding herself open") keep their own tags.

## 2. Reveal phrasings become tags

### 2a. Explicit (`displacedTags`)

Map phrasings to canonical tags:

| Caption | Tags |
|---|---|
| pulling/pulled down her neckline, top, shirt, dress | `clothes_pull`, plus `breasts_out` when breasts are bared or shown |
| lifting/lifted her shirt, top, sweater | `shirt_lift` (or `clothes_lift`), plus `breasts_out` / `underboob` as said |
| skirt lifted / lifting her skirt | `skirt_lift` |
| pulling down her panties, shorts, pants | `panty_pull` / `pants_pull` |
| open shirt, unbuttoned | `open_shirt` / `open_clothes` |
| bra pushed up / pulled down | `bra_lift` / `bra_pull` |

### 2b. Suggestive (new, a tier-safe subset)

Suggestive photos get only the non-explicit reveals, never `breasts_out`, `nipples` or anything bare:

| Caption | Tags |
|---|---|
| sweater/top off her shoulder | `off_shoulder` |
| strap slipping down | `strap_slip` |
| lifting her shirt to show her bra or stomach | `shirt_lift`, `bra` |
| tugging her neckline | `clothes_pull` |
| skirt flipping or lifted to show underwear | `skirt_lift`, `panties` |

- Add these beside her set's outfit tags.
- `photoGate`'s tier and the negative prompt stay as they are; this only names what the caption already says.
- **Everyday photos are unchanged:** `EVERYDAY_DROPS` still strips slipping-clothes tags, and 2b doesn't run there.

## 3. Explicit, partially undressed: give her the outfit she is undressing

When an explicit photo is `partially_undressed` (not fully nude) and its caption names one of her sets:
- Add that set's tags (`photoWardrobe` as usual) before `partially_undressed` and the reveal tags.
- Strip the set's name from the sentence with `withoutOutfitName`, as for a dressed photo.

A caption that describes its own clothes keeps them as words, as for any photo. Fully nude photos stay as they are.

## Tests

- **The park caption:**
  - No `hand_on_own_hip`.
  - Has `clothes_pull` and `breasts_out`.
  - Has her everyday set's tags.
  - "everyday clothes" is gone from the sentence.
- **A suggestive photo**, "…tugging her sweater off one shoulder, smiling at the viewer":
  - Has `off_shoulder`.
  - No placement tag.
  - No explicit tag.
- **An everyday photo** with "her sweater slipping off a shoulder": unchanged by 2b.
- **A fully nude explicit photo:** unchanged by section 3.

## Changelog

No player-facing bullet is needed beyond the existing 1.7.0 ones.

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
