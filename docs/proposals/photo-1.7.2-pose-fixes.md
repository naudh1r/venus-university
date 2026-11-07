# Photo 1.7.2: pose, hand and framing fixes

Branch: `mod/photo-1.7.2-pose-fixes` (from `mod/photo-final` `bd048305`). Do not touch `mod/photo-final`.

Source: two play logs (39 renders). I re-ran every caption below through `photoPose` on `bd048305`.
Already fixed there, leave alone: peace sign → `v`, cups/fries/cartons strip the position hand,
"two fingers" no longer fires on a mouth, hand-on-hip from the caption.

`SemiRrealism` is the correct LoRA trigger. Not a bug.

## Rule to keep

The checkpoint draws hands from the sentence. A position's default hand
(`hands_on_lap`, `hands_on_own_thighs`, `hand_on_own_hip`, `hand_on_own_chin`) is only a filler
for captions that say nothing about hands. Every failure below is that filler firing when the
caption already placed her hands.

## 1. Caption places hands → strip the filler (`photoPose.ts`)

Still on `bd048305` (caption → current output):

| Caption (short) | Now | Want |
|---|---|---|
| resting her chin on one manicured hand, sitting | `hands_on_lap` | `head_rest`, no filler |
| propping her chin on one pale hand, sitting | `hands_on_lap` | `head_rest`, no filler |
| winding a ribbon around her neck with both hands, kneeling | `hands_on_own_thighs` | no filler |
| two fingers pressed into her open mouth, kneeling | `hands_on_own_thighs` | `finger_in_own_mouth`, no filler |
| one hand cupping the underside of her breast, other on her stomach | `hands_on_lap` | breast action fires, no filler |
| using both hands to spread her thighs, sitting | `hands_on_lap` | no filler |
| leaning over a cart, hands resting on the handle | `hand_on_own_chin` | no filler |
| one hand resting on a shopping basket, standing | `hand_on_own_hip` | no filler |
| camisole pulled down with one hand, standing | `hand_on_own_hip` | `clothes_pull`, no filler |
| glancing back over one shoulder (arcade) | `hand_on_own_hip` | no filler (FACING rows add it; drop it there) |

Fix:
- Add a general "hands are described" check to the busy-hand test: `one hand`, `both hands`,
  `her hands`, `her hand`, `with her fingers`, `fingers`, `palm`, plus verb forms the current
  list misses (`propping`, `resting her chin`, `on the handle`, `hand on/resting on <object>`).
  When it fires, strip `PLACEMENT_TAGS` as today. Keep it a cue list, no new parser.
- Chin on hand / palm (`chin on`, `propping her chin`, `resting her chin`) → add `head_rest`.
  Today `head_rest` is in `PLACEMENT_TAGS`, so add it after the strip.
- Breast row: add `cupping her breast`, `cupping the underside`, `cupping her bare breast`.
- `finger in her mouth` exists; add `fingers in her mouth`, `fingers into her mouth`,
  `fingers pressed into her mouth` and tag `finger_in_own_mouth`.
- Clothing pulled by her hand → `clothes_pull`: `pulled down`, `pulling down`, `tugging down`,
  `tugging at her`. Skirt hem → `skirt_lift`: `lifting the hem`, `lifting her skirt`.
- FACING `looking back` / `from behind` rows: remove `hand_on_own_hip`.

## 2. Small adds (`photoPose.ts`)

- `wink`, `winking` → `one_eye_closed`.
- "lounging sideways … resting on one elbow" → `lying`, `on_side`. Add `lounging sideways`,
  `lying sideways`, `on one elbow`, `propped on her elbow` to the on-side rows.

## 3. Framing (`photoFraming.ts`)

- New framing `lower` for `waist down`, `from the waist down`, `hips down`. Tag `lower_body`.
  It must be checked before `waist` (today "from the waist down" matches `from the waist` and
  draws `(upper_body:1.3)`, the opposite). Check how `photoBody` and `closeLying` read a framing
  and give `lower` a sane branch.
- `waist-up`, `waist-high` hyphenated: add to the `waist` cues (today it falls through to the
  standing row's `cowboy_shot`).

## 4. Wardrobe (`photoWardrobe.ts`)

- Removed garment: "without her jacket", "jacket off", "jacket draped over …", "took off her X",
  "discarded X". Drop that garment's tags from the outfit. Match on the garment noun the
  outfit line already contains (jacket, cardigan, hoodie, sweater, shoes, …). Seen twice: Celest's
  `pastel pink cropped tweed jacket` stayed in both renders.
- Upper-body framing (`waist` / `face`): drop below-waist garments (skirt, shorts, jeans,
  thighhighs, socks, shoes, boots, loafers, heels) and `thighs`. Seen on 6 renders. `lower`
  framing drops nothing.

## Out of scope

Object tags for what she holds (`holding_cup` etc.). The busy-hand comment explains why they are
left out; keep it that way.

## Tests

Add caption → tags rows to `test/photoPose.test.ts` and `test/photoFraming.test.ts` only for
behaviour that changes (the table above, `waist down`, `waist-up`). One wardrobe test for a
removed garment and one for upper-body dropping shoes. No wording tests.

## Done when

`npm run typecheck` and `npm test` pass. Report the table above re-run on the new branch.
