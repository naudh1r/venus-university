# Photo Feature

An unofficial mod for Venus University by **naudh1r**. Version **1.2.0**, for the game's 0.4.0.

The girls send you photos in their DMs and post them on their feeds, with comments from the rest
of campus. Each contact gets a gallery, and characters can get optional body details. Photos are
drawn on your own machine by the game's local ComfyUI.

It is separate from the game's own **Photos** tab in the Bunnyboard, where you make pictures
yourself. This mod is about the photos *she* sends and posts.

This is not made or supported by Venus Dev. Please do not report problems with it to them.

## What you need

- The desktop game, with local image generation (ComfyUI) working. The browser version never
  makes photos.
- Photos use the game's own photo checkpoint and LoRA (`assets/workflows/characterPhoto.json`).
  Nothing else to download.

## Settings

Everything is in **Mods → Photo Feature**.

| Option | Default | What it does |
|---|---|---|
| Photo Feature | on | Off, nobody sends a new photo and posts get no new comments. Photos, galleries and comments already made are hidden, not deleted, and come back when it is on again. |
| Photo generation | on | Off, no new photos are made and the girls are not told they can send one. Photos already sent stay visible. |
| Explicit photos | on | Off, nobody sends an undressed photo and ones already sent stay covered. The game's own "No NSFW images" turns them off too. |
| Body details | off | Characters get a build, chest, hips, backside and hair from fixed tag lists, asked for when they are made, editable in their character editor, and drawn in their sprites, CGs and photos. The default characters can't be edited, so clone one first to give her body details. Off, what they have is kept but not used. |
| Save photos as WebP | on | New photos are saved as WebP at 85% quality, much smaller than PNG. Off, they are saved as PNG. Photos already saved stay as they are. |
| Loading animation | Bunny hop | What a photo shows while it is being drawn: Bunny hop, Dot shimmer or Typing dots. |

## How a photo is made

1. In a DM, she decides whether a picture fits the moment. She can send one when you ask, or on
   her own. On the feed, some of her posts come with one.
2. She writes one sentence describing it: where she is, what she wears, her pose, what her hands
   are doing, how close the shot is.
3. The game decides how much the photo may show (everyday, suggestive or explicit) from your
   save and your settings. She cannot go past it.
4. The mod turns her sentence into the photo prompt. It keeps the sentence and adds tags it
   reads off it:
   - **Pose and framing**: standing, sitting, lying on her back, side or stomach; close-up,
     waist up, knees up, full body; from above, from below, from behind, side view.
   - **Style**: a selfie, a mirror selfie, or a photo somebody took of her; on the feed also a
     candid one where she is not posing.
   - **Selfies**: her arm reaches out of the picture and no phone is drawn. A mirror selfie
     shows the phone and nothing else in her hands. Lying-down selfies are framed from the
     waist up.
   - **Hands**: one thing for her hands per photo, so nobody grows a third hand.
   - **Her body**: only the parts in the shot, as far as her clothes allow.
   - **Cleanup**: names are taken out, a selfie loses how she holds the phone, "the camera"
     becomes the viewer, whoever took the photo is left out (they were drawn in), colours named
     after food are said plainly (a "cream shirt" was drawn as cream), a "liquid" becomes a
     drink (it was splashed everywhere), and a bubble tea shop becomes a tea shop (it put a cup
     in her hand).
   - **Things kept out**: legwear she was not given (colours in the prompt bleed onto her legs),
     a phone or camera, anyone else in the picture, splashes and stains, and on everyday photos
     cleavage and undressing (a top slipping off a shoulder stays how she wears it).
5. ComfyUI draws it, and it lands in the bubble or the post.

Every tag the mod adds has been checked in ComfyUI on the photo checkpoint, side by side with the
same seed. Many plain tags turned out to do nothing, so some rules use weights or special
combinations. The comment beside each rule in the code says what was tried.

## Where photos are kept

`data/saves/<save>/photos/<character>/`, named after her, for example `risa_chat_004.webp` or
`risa_bunnyboard_002.webp`. They belong to that save; a continued semester copies them across.

## If a photo looks wrong

Open the console (Ctrl+Shift+I) and find the line starting with `photo:`. It shows the tier,
seed, file name, the full prompt and the negative. Send it with the picture: most problems so far
were one word in her sentence the model drew too literally, and each is a small fix.

If a photo stays PNG while WebP is on, look for a `[photo] kept ... as PNG:` line.

## 1.2.0

For Venus University 0.4.0, on the shared mod build, with a lot of photo tuning.

- **New**: "Save photos as WebP" option. Body details moved into the Mods menu too, so the mod
  keeps nothing in the game's own settings; your old choice carries over. All Photo Feature settings are in the Mods menu. Its
  description now says it is separate from the game's own Photos tab.
- **Selfies**: no phone or camera in her hand, her arm goes out of frame. Mirror selfies show the
  phone. Selfies lying down, from below and from above work. A peace sign is fine unless she is
  holding something. Mirror selfies keep her hands to the phone; anything else she held was
  drawn wrong.
- **Styles**: she picks a selfie, a mirror selfie or a photo somebody took, whichever fits, so
  not every photo is a selfie. Feed posts can also be candid shots.
- **Photos**: framing follows what she describes. From above, from below, side view and from
  behind work. Holding a drink, book or food no longer grows an extra hand. Lying poses stay in
  close-ups. Explicit photos where she is still partly dressed no longer go fully nude. One hand placement
  per photo. Sitting cross-legged is drawn cross-legged. Everyday photos no longer show undressing,
  or cleavage unless her outfit shows it.
- **Colours and words**: legwear she was not given stays off her legs, in any colour. Colours
  named after food are drawn as colours. A drink is no longer splashed over her, a bubble tea
  shop no longer hands her a cup, and no camera turns up in her hands.
- **Sprites**: petite and curvy builds show up more on character sprites.
- **Fixes**: the eye icon on hidden photos was dark in the day theme.

## Known limits

- A colour from her outfit can still bleed onto her legs on some seeds.
- Nude photos on her side or stomach can drift onto her back.
- A bikini can take its colour from her own swimsuit set instead of her sentence.

## For modders

How the mod plugs into the game (its switches, hooks and files) is in `MODDING.md`, under
"How Photo Feature uses it".

## Licence

The code is AGPL-3.0-only, like the game (`LICENSE`). Images, audio and video remain © Venus Dev
(`LICENSE-ASSETS.md`).
