# Photo Feature 1.9.0 male body, back shots and framing

## Commits

- Feature branch `mod/photo-1.9.0-male-body` starts at `2979cb7b55538e65438ff21ab077651b280f8c7e` on `mod/photo-feature-1.9.0`.
- `4ea9a971fa4196659eb26416cfa857246008e598` implements the changes under Photo Feature 1.9.0.
- `7c9a6702a04ae148ccba72460085ae54216cae9b` covers rear-focused caption fragments.
- `89a8bfad91e2f8bd317baf2471a7a188e15265c0` keeps retired fields out of the male negative prompt.
- This audit is the only file in the report commit on `notes/standalone-mods`. All commits use Naudh1r <102735014+naudh1r@users.noreply.github.com>.

## Back shots and poses

Photo normalizes he, his and him to the shared caption vocabulary. The rear-facing cues are
`from behind`, `back view`, `rear view`, `back turned`, `looking back`, `glancing back`,
`over her shoulder`, `facing away`, `turned away`, `turning away`, `back to the camera`
(includes `her back to the camera`) and `from the back`. `Backs to the camera` covers plural
captions. The look-back cues also emit `looking_back`.

Facing and position combine. A rear-facing photo can keep `kneeling`, `sitting`, `lying`,
`standing`, `bent_over` or `all_fours`. Kneels, kneeling, on her knees and knelt all pick
`kneeling`, so the former repair rule is unnecessary. Knees-up crops of low poses leave the
framing tag out and use the caption to specify the crop. The clothes still use the requested
knees-up crop. Photos with no crop specified keep the normal pose defaults, with no standing
crop on sitting, kneeling or lying.

A rear view drops chest size, bust, nipples and navel. Bent over or on all fours can still show
the pubic region on a girl, subject to the crop and clothing. A guy's rear view leaves that
region out. A face-down pose supplies `lying` and `on_stomach`, with hips and backside in shot.
A girl spreading her cheeks can show the pubic region when bent over, on all fours or face
down, while standing keeps `spread_ass` and `ass_focus` with no pubic tag. A rear-focused caption or fragment turns the subject around with `ass_focus`, including a caption about her bare ass in a
mirror. A face-up caption such as “lying on her back, legs up” still shows the front.

The cited Danbooru catalog lists `handprint`, `small_penis`, `large_penis` and `huge_penis`
as canonical entries. [Catalog](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/danbooru.csv)

## Body details and saves

The new optional `penis` key lives in `ex['photo-feature'].data`. Average has no tag, including
on older records without the key. Reading uses the character's gender and drops a girl's
invalid `penis` key, a guy's `hipsThighs` and the two invalid large backside picks, `huge_ass`
and `(huge_ass:0.6)`. Reading leaves the source record intact until the player saves it.
Rerolls keep the selected build and chest and draw average 70% of the time for each of a
guy's backside and penis fields. When applicable, size is inserted immediately after `penis`
in a bare solo photo. An erection stays a caption detail. A mixed duo shares a negative
prompt, so his female-only chest and backside negatives are left out there to preserve her choices.

## Footwear audit

The same filter runs on one person's wardrobe and on each half of a photo of two. It keeps
footwear and socks in full-body and waist-down shots, or when the caption names footwear or
feet. Thighhighs, stockings and pantyhose also stay in a knees-up shot. A waist-up or face
crop drops lower garments such as skirts, shorts and trousers. Only waist-up and face
duos strip the length descriptor from dresses. Unframed solos drop footwear, including
sitting and lying.

I read each of the 42 shipped character archives and checked the everyday, PE, swim and custom
outfit fields. There were 898 entries and 475 distinct tags. The original word list would have
missed `black trainers`, `brown leather_oxfords` and `bare_feet`. The final rule covers all three.
A separate pass over the full tag inventory found no other footwear. The matched ankle, crew,
tube and knee-high socks follow shoes. Thigh-high socks follow thighhighs.

### Exact shipped shoe tags

`ankle_boots`, `black basketball sneakers`, `black chunky platform sneakers`, `black high heels`, `black leather boots`, `black leather buckled ankle boots`, `black platform patent loafers`, `black pointed high heels`, `black running shoes`, `black studded combat boots`, `black trainers`, `black_leather_boots`, `black_leather_chelsea_boots`, `black_leather_mary_janes`, `black_platform_goth_boots`, `black_sneakers`, `brown leather cowboy boots`, `brown leather platform ankle boots`, `brown leather_oxfords`, `brown_distressed_leather_boots`, `brown_leather_loafers`, `chunky_white_sneakers`, `cream_pointed_toe_heels`, `dark_brown_leather_loafers`, `dark_brown_leather_work_boots`, `distressed_leather_work_boots`, `gold high heels`, `grey running shoes`, `grey_running_shoes`, `grey_running_sneakers`, `leather brown loafers`, `light_brown_leather_ankle_boots`, `loafers`, `navy running shoes`, `oxblood_leather_oxford_shoes`, `oxford leather shoes`, `pastel pink platform loafers`, `pink pastel sneakers`, `pink platform loafers`, `pink_platform_heels`, `platform_white_sneakers`, `red_running_shoes`, `running shoes`, `sage green running sneakers`, `teal running shoes`, `white canvas sneakers`, `white gold-accented sneakers`, `white leather sneakers`, `white platform sneakers`, `white running shoes`, `white running sneakers`, `white running_shoes`, `white sneakers`, `white_canvas_sneakers`, `white_leather_sneakers`, `white_platform_heels`, `white_running_shoes`, `white_running_sneakers`, `white_sneakers`, `yellow_running_shoes`.

### Bare feet and socks that follow shoes

`bare_feet`, `black ankle socks`, `black_knee_high_socks`, `white ankle socks`, `white ankle_socks`, `white athletic crew socks`, `white crew socks`, `white crew_socks`, `white tube socks`, `white_ankle_socks`, `white_crew_socks`, `white_slouch_ankle_socks`, `white_socks`.

## Captured prompts

The samples use representative Risa and Kai records with a known chest tag each and matching
outfits across the solo and duo cases. The DM caption is verbatim. The prompt builder expands
the character and framing tags before anything reaches ComfyUI. ComfyUI was unavailable, so
these checks cover the inputs to the render.

### DM caption before the change

```text
masterpiece, best_quality, very_aesthetic, mature_female, solo, depth_of_field,

1girl, small_breasts, brown_hair, green_eyes,

navel,

nude, completely_nude, uncensored,

In her bedroom under pale morning light filtering through the blinds, completely naked, she kneels on her unmade bed facing away from the camera while glaring back over her shoulder with a sharp smirk, both hands gripping the edge of the mattress, shot from behind from the knees up showing the red handprint marks across her bare ass, from_behind, solo, ass_focus, looking_back, cowboy_shot
```

### DM caption after the change

```text
masterpiece, best_quality, very_aesthetic, mature_female, solo, depth_of_field,

1girl, brown_hair, green_eyes,

nude, completely_nude, uncensored,

In her bedroom under pale morning light filtering through the blinds, completely naked, she kneels on her unmade bed facing away from the camera while glaring back over her shoulder with a sharp smirk, both hands gripping the edge of the mattress, shot from behind from the knees up showing the red handprint marks across her bare ass, kneeling, solo, looking_back, from_behind, ass_focus, handprint
```

The negative prompt was the same before and after.

```text
worst_quality, bad_quality, lowres, simple_background, white_background, transparent_background, multiple_views, reference_sheet, english_text, speech_bubble, artist_name, watermark, signature, 1boy, multiple_boys, multiple_girls, 2girls, hetero, penis, sex, gold, photo_(medium), cum, bad_hands, extra_digits, fewer_digits, paint_splatter, splashing, stain, camera
```

### Girl from behind

```text
masterpiece, best_quality, very_aesthetic, mature_female, solo, depth_of_field,

1girl, brown_hair, green_eyes,

nude, completely_nude, uncensored,

Naked, standing with her back to the viewer, looking back over her shoulder, standing, solo, cowboy_shot, looking_back, from_behind, ass_focus
```

### Guy from behind

```text
masterpiece, best_quality, very_aesthetic, male_focus, mature_male, solo, depth_of_field,

1boy, black_hair, brown_eyes,

flat_ass,

nude, completely_nude, uncensored, bare_arms, bare_legs, bare_shoulders,

Naked, standing with his back to the viewer, looking back over his shoulder, standing, solo, cowboy_shot, looking_back, from_behind, ass_focus
```

### Standing, knees up, with shoes in the outfit

```text
masterpiece, best_quality, very_aesthetic, mature_female, solo, depth_of_field,

1girl, small_breasts, brown_hair, green_eyes,

(white_top:1.2), blue_skirt, black_thighhighs,

Standing by the window, knees up, standing, cowboy_shot
```

### Photos of two

Both halves use the same crop as the shared scene. Explicit face, waist-up, knees-up,
full body and waist-down use the caption's framing. With no framing cue, a regular
photo uses `upper_body` and an arm's-length selfie uses `cowboy_shot`. A close-up
still gets the previous weighting. `same height` stays in the shared scene.

#### Full body

Shared positive

```text
masterpiece, best_quality, very_aesthetic, 1girl, 1boy, mature_female, mature_male, depth_of_field, Her and her friend standing together at the park, full body, side by side, same height, full_body
```

Left half

```text
masterpiece, best_quality, very_aesthetic, 1girl, small_breasts, (brown_hair:1.3), green_eyes, mature_female, (white_top:1.2), blue_skirt, black_thighhighs, white_ankle_socks, white_sneakers, standing, smile, full_body
```

Right half

```text
masterpiece, best_quality, very_aesthetic, 1boy, (black_hair:1.3), brown_eyes, pectorals, mature_male, (green_shirt:1.2), blue_jeans, black_trainers, standing, smile, full_body
```

#### Knees up

Shared positive

```text
masterpiece, best_quality, very_aesthetic, 1girl, 1boy, mature_female, mature_male, depth_of_field, Her and her friend standing together at the park, knees up, side by side, same height, cowboy_shot
```

Left half

```text
masterpiece, best_quality, very_aesthetic, 1girl, small_breasts, (brown_hair:1.3), green_eyes, mature_female, (white_top:1.2), blue_skirt, black_thighhighs, standing, smile, cowboy_shot
```

Right half

```text
masterpiece, best_quality, very_aesthetic, 1boy, (black_hair:1.3), brown_eyes, pectorals, mature_male, (green_shirt:1.2), blue_jeans, standing, smile, cowboy_shot
```

#### No framing in the caption

Shared positive

```text
masterpiece, best_quality, very_aesthetic, 1girl, 1boy, mature_female, mature_male, depth_of_field, Her and her friend standing together at the park, side by side, same height, upper_body
```

Left half

```text
masterpiece, best_quality, very_aesthetic, 1girl, small_breasts, (brown_hair:1.3), green_eyes, mature_female, (white_top:1.2), standing, smile, upper_body
```

Right half

```text
masterpiece, best_quality, very_aesthetic, 1boy, (black_hair:1.3), brown_eyes, pectorals, mature_male, (green_shirt:1.2), standing, smile, upper_body
```

## Checks

- `npm ci` installed 456 packages using a fresh temporary cache.
- `npm run typecheck` and `npm run build` passed.
- The Photo and body tests plus the kit boundary check passed, 763 tests across 31 files.
  After the follow-ups, the final prompt, body and boundary rerun passed 153 tests across three
  files. The boundary inventory needed no new rows.
- `npm test` with the archive helper unavailable finished with 5,389 passed, 101 failed and 4
  skipped across 430 files. The 101 comprise 98 archive-dependent failures and the three
  failures below. After enabling the installed 7-Zip executable locally, all 134 tests in
  the 10 archive-related files passed.
- `mainServices.test.ts` accepted a path that its Comfy output path test expects to reject.
  `pool.test.ts` exceeded its 50 ms shot-selection budget. Both also failed on the
  unchanged base in this container.
- `npcRelationships.test.ts` timed out at 5 seconds during the full run. It passed all
  43 tests on both the feature branch and unchanged base in separate runs.
- The built Electron app showed the five fields for Dorien and the existing form for Min-ha
  under Manage Characters → Generation settings. Screenshots are outside both branches.
- No image or pose was visually checked through ComfyUI. The captured strings above are the
  prompt and masked halves sent to the ppm workflow.
