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

- A colour from the picture can still bleed onto her legs on some seeds: from her outfit, her
  hair or the lighting (neon pink, for example). It can show as one coloured leg fading down to
  the sock. Blocking legwear in every colour the prompt names, and asking for bare legs, made it
  rarer but did not stop it, and no negative tag tried so far does. A reroll usually clears it.
- Nude photos on her side or stomach can drift onto her back.
- A bikini can take its colour from her own swimsuit set instead of her sentence.

## For modders

How the mod plugs into the shared mod system. The system itself is in `MODDING.md`.

### Switches

It is `anytime`, and it checks its own switch: the mod keeps its switches in
`src/shared/photoSwitches.ts` and asks there wherever it acts, so the build only hands them
over. That is three places:

- `photoSwitchesOf(switches)` in `mods.ts` turns the Mods screen's switches into the mod's own.
- `modsStore.ts` passes them to `setPhotoSwitches` at boot and whenever a switch moves.
- `modsService.ts` does the same in main, when the switches are read or written. Main keeps its
  own copy because body details are drawn there.

Its entry, `src/shared/modEntries/photo-feature.ts`, is `PHOTO_FEATURE_MOD` from
`photoSwitches.ts` with the version added, so its name, text and options come from the mod.

Off, nobody sends a new photo, posts get no new comments, body details are not used and likes
are the game's own. Photos, galleries and comments already made are hidden, not deleted. Its
options:

- **Photo generation**: off, no new photos are made and characters are not told they can send
  one. Photos already sent stay visible.
- **Explicit photos**: off, nobody sends an undressed photo and ones already sent stay covered.
  The game's own "No NSFW images" turns them off too.
- **Body details**: off by default. Characters get a build, chest, hips, backside and hair from
  fixed tag lists, used in their sprites, CGs and photos. The default characters can't be edited,
  so one has to be cloned first for the fields to show.
- **Save photos as WebP**: on by default. New photos are saved as WebP at 85% quality instead
  of PNG. Off, they are saved as PNG. Photos already saved stay as they are.
- **Loading animation**: a group of three, Bunny hop, Dot shimmer and Typing dots.

These used to be in the game's Settings, and the body switch in the game's `settings.json`.
`modsService.ts` reads a player's old choice straight off that file once
(`withPhotoSettingsCarried`) and keeps it in `mods.json`. Photo Feature reads nothing else of the
game's settings but "No NSFW images", which it obeys and never changes.

Option ids are written to disk, so they never change: `photos`, `explicit`, `body`, `webp`,
`loader-bunny`, `loader-shimmer`, `loader-dots`. `test/photoHooks.test.ts` fails if the handover in `modsStore.ts`
or `modsService.ts` goes missing.

### WebP photos

ComfyUI only saves PNG, and main has no image encoder. So a photo whose name is reserved as
`.webp` is rendered to the `.png` beside it; the renderer then gets the PNG's bytes over IPC,
encodes them with Chromium at 85%, and main keeps the WebP and deletes the PNG
(`src/renderer/stores/photoWebp.ts`, `storeWebpPhoto` in `localPhotoService.ts`).

Every reader takes whichever of the two is on disk: the `playimg://` protocol, the check for a
photo that landed after its save, backups. So an encode that fails, or a render that finished
after the game closed, still shows as PNG.

### How a photo prompt is built

The character's AI writes one sentence describing the photo. `src/shared/photoPrompt.ts` keeps
that sentence and adds tags read off it:

- **Pose, framing, angle, selfie** (`photoPose.ts`, `photoFraming.ts`): "on her side", "waist
  up", "from below", "a selfie", "mirror" and so on become the tags that held on the photo
  checkpoint. Some need a weight or a special combination; the comment beside each rule says
  what was tried.
- **Her body** (`photoBody.ts`): only the parts in shot, as far as her clothes allow, following
  the same framing.
- **Clean-up of the sentence**: names are taken out, a selfie loses how she holds the phone
  (the model draws "holding the camera" as a camera), and colours named after food are said
  plainly ("cream shirt" was drawn as cream).
- **Negatives**: legwear she was not given, in every colour the prompt names (a colour
  anywhere in the prompt bleeds onto her legs); a selfie's phone and camera.

Every tag these files can write has to be in the verified list in `test/photoTags.test.ts`,
which fails on any other. A tag goes on that list once a same-seed ComfyUI check shows the
checkpoint draws it.

### Hooks

All of Photo Feature's prompt, event and feed additions are in
`src/renderer/modEntries/photo-feature.ts`.
In the ten game files involved, lines naming Photo Feature went from 67 to 4: two for its gallery
on `ContactPage.tsx` (screens have no hook points yet) and two that are Continuing Semesters'
own photo carry-over in `NewGameView.tsx`.

Off, three things differ from before hooks, all because a mod that is off is not asked: the
photo fields leave the reply's schema rather than being asked for empty; old DMs lose their
"[attached a photo]" note in the history the prompt quotes; and a render left unfinished from
an earlier session is settled only once the mod is on again.

## Licence

The code is AGPL-3.0-only, like the game (`LICENSE`). Images, audio and video remain © Venus Dev
(`LICENSE-ASSETS.md`).
