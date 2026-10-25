# Photo Feature

An unofficial mod for Venus University by **naudh1r**. Version **1.5.0**, for the game's 0.6.0.

The girls send you photos in their DMs and post them on their feeds, with comments from the rest
of campus. Each contact gets a gallery, and characters can get optional body details. Photos are
drawn on your own machine by ComfyUI, the game's own or yours.

It is separate from the game's own **Photos** tab in the Bunnyboard, where you make pictures
yourself. This mod is about the photos *she* sends and posts.

This is not made or supported by Venus Dev. Please do not report problems with it to them.

## What you need

- The desktop game, with image generation working: the game's own ComfyUI, or your own one set
  in Settings. The browser version never makes photos.
- Photos use the game's own photo checkpoint and LoRA (`assets/workflows/characterPhoto.json`).
  Nothing else to download.

## Settings

Everything is in **Mods → Photo Feature**. The mod is off until you turn it on there.

| Option | Default | What it does |
|---|---|---|
| Photo Feature | on | Off, nobody sends a new photo and posts get no new comments. Photos, galleries and comments already made are hidden, not deleted, and come back when it is on again. |
| Photo generation | on | Off, no new photos are made and the girls are not told they can send one. Photos already sent stay visible. |
| Explicit photos | on | Off, nobody sends an undressed photo and ones already sent stay covered. The game's own "No NSFW images" turns them off too. |
| Body details | off | Characters get a build, chest, hips, backside and hair from fixed tag lists, asked for when they are made, editable from the main menu in Manage Characters, under a character's Generation settings (the default characters too), and drawn in their sprites, CGs and photos. Off, what they have is kept but not used. |
| 2 girls 1 photo (experimental) | off | A girl's feed post can be a photo of her and a friend, and a scene you are in with other girls can bring a photo of two of them on one's feed. Always two girls, never more. See below. |
| Save photos as WebP | on | New photos are saved as WebP, with no visible quality loss while taking much less space than PNG. Off, they are saved as PNG. Photos already saved stay as they are. |
| Loading animation | Bunny hop | What a photo shows while it is being drawn: Bunny hop, Dot shimmer or Typing dots. |

## How a photo is made

1. In a DM, she decides whether a picture fits the moment. She can send one when you ask, or on
   her own, and when she texts you first she can send one with it. On the feed, some of her posts
   come with one.
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
     waist up. A selfie with both her hands on something is drawn as a photo somebody took.
   - **Hands**: one thing for her hands per photo, so nobody grows a third hand. Hands she is
     leaning on count.
   - **Her clothes**: her top is weighted where it names a colour, so a dark or neon-lit scene
     does not turn it black. "Topless" bares her top half only and "bottomless" her bottom
     half; what the sentence still names stays on.
   - **Her body**: only the parts in the shot, as far as her clothes allow.
   - **Cleanup**: names are taken out, a selfie loses the words about how she holds the phone, "the camera"
     becomes the viewer, whoever took the photo is left out (they were drawn in), colours named
     after food are said plainly (a "cream shirt" was drawn as cream), a "liquid" becomes a
     drink (it was splashed everywhere), and a bubble tea shop becomes a tea shop (it put a cup
     in her hand).
   - **Things kept out**: a phone or camera, anyone else in the picture, splashes and stains,
     and on everyday photos cleavage and undressing (a top slipping off a shoulder stays how
     she wears it). Nothing on her legs, under her skirt or between her legs is named in the
     negative: naming legwear, `pantyshot` or censoring there drew a smudge or a coloured leg
     in its place.
5. ComfyUI draws it, and it lands in the bubble or the post.

Every tag the mod adds has been checked in ComfyUI on the photo checkpoint, side by side with the
same seed. Many plain tags turned out to do nothing, so some rules use weights or special
combinations. The comment beside each rule in the code says what was tried.

## 2 girls 1 photo (experimental)

With the option on, a scene you go into with two or more of the girls brings a photo of two of them,
never more: two picked at random where more are there, and one posts it on her feed, once a slot. The scene's first call writes it
beside the scene's opening lines, once the game has settled who is there, and it is filed like any
feed post: held until the picture lands, with likes and comments from whichever mod draws them. Its
picture is drawn under the scene, behind any of the slot's own feed pictures still waiting. They
are dressed for where they are, so the pool puts them in their swimsuits, and like every post it is
never past suggestive.

The option also lets a girl's own feed post be a picture of her and a friend. As the slot opens,
one of the girls posting, at most, is rolled a picture with one of her friends (1 in 4 for a girl
who has any), wherever either of them is: neither has to be in your scene. The opening is told so
under her name and writes it with her post. A friend stays in a picture only in everyday clothes
or swimwear; past that the picture is drawn of the poster alone. The console says so as the
opening is written (`[photo] X's post this slot is a picture with Y`).

- The two are drawn side by side and not touching, from the waist up, each in her own half of the
  picture: told as one prompt, the model swapped their hair and clothes between them, and where
  they touched their bodies merged. Each half is dressed from the waist up only: a skirt, jeans or a
  belt in either drew them down to the hips, where their sides fused. Their clothes are their own,
  never the caption's, and both carry the face the caption asks for, or a smile.
- The picture is the poster's, in her gallery only. The console names the pair when the scene is asked for it
  (`[photo] group photo asked of the scene: …`), and the `photo:` lines show each girl's prompt
  as `node 50` and `node 51`.

Still being tuned: now and then a face, an outfit or a colour comes out wrong, and close-ups and
from-behind shots hold less well than plain ones. Pictures from below are drawn at eye level.

## Where photos are kept

`data/saves/<save>/photos/<character>/`, named after her, for example `risa_chat_004.webp` or
`risa_bunnyboard_002.webp`. They belong to that save; a continued semester copies them across.

## If a photo looks wrong

Open the console (Ctrl+Shift+I) and find the line starting with `photo:`. It shows the tier,
seed, file name, the full prompt and the negative. Send it with the picture: most problems so far
were one word in her sentence the model drew too literally, and each is a small fix.

If a photo stays PNG while WebP is on, look for a `[photo] kept ... as PNG:` line.

## 1.5.0

- **Fixed**: a post waiting on its picture came out under the posts its slot already showed, as
  if it were older. It now goes on top when it comes out.
- **2 girls 1 photo (experimental)**: a scene with two or more of the girls brings a photo of two of
  them, never more, that one of them posts, off by default. The scene's first call writes it, so the two are girls
  you are with, and its picture is drawn under that scene. Now and then a girl's own post is a
  picture with one of her friends too.
- **Food colours in her own tags**: a colour named after a food in her outfit tags is said plainly,
  as it already was in captions: Lia's `cream_…_sweater` drew cream on her lip and a hand at her
  mouth, and is now `ivory_…_sweater`.

## 1.4.2

- **No more "dorm" in a picture**: Gemini refused to answer a thread where an undressed picture was
  remembered as taken "on her dorm bed". She is told to call it her room, and a picture already
  written that way is read back without the word ("on her bed").

## 1.4.1

- **Selfies keep their whole description**: a selfie that mentioned the camera while she held
  something else ("holding a mug with both hands and smiling at the camera") lost everything after
  the comma. Only the words about holding the phone are dropped now.
- **Both hands full**: a selfie where she holds something with both hands is drawn as a photo
  somebody took, instead of with an arm reaching out of the picture.
- **No more coloured legs**: stockings and leggings in colours from her hair or the scene, often
  on one leg only, came from the photo's own list of legwear to avoid. That list is gone.
- **No smudge between her legs**: sitting in a short skirt, or undressed, sometimes drew a smear
  between her legs, caused by the photo's own refusals of `pantyshot` and of censoring. Both are
  gone; nothing is censored and nothing more shows than before.
- **Topless and bottomless mean half**: "topless in her skirt" no longer draws what is under the
  skirt, and "in just her crop top, nothing on below" keeps the crop top on.
- **Her hands where she leans**: leaning back on her hands or on all fours no longer adds a hand
  on her thigh or hip as well.
- **Her top keeps its colour**: in dark or neon-lit scenes a pink or white top could come out black.
- **Her own clothes on the feed**: posts with a picture now know her wardrobe, and both DMs and
  posts are told not to put her in an oversized knit sweater she does not own.

## 1.4.0

- **Photos when she texts first**: a girl who texts you just to talk (new in 0.5.0) can send a
  picture with it when it fits, a selfie in bed with her cold or something she wants to show you.
  The same limits as her other DMs apply.
- **Comments survive New Game+**: comments on posts carried into the next semester show as they
  did, instead of staying hidden until the new semester caught up with the old dates.

## 1.3.0

- **Comments and pictures go through the game's own places on a post**: the game now keeps a
  post's comments and draws whatever a mod puts there. Another mod can draw the comments in place
  of Photo Feature's stranger comments; when none does, comments work exactly as in 1.2.0.
- **Off by default**: like every mod on the build, it starts off. Turn it on in **Mods**; nothing
  it made is lost while it is off.

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

- Now and then a seed still gets something wrong that no tag changed: a coloured mark on her
  face, a small photo stuck over her in an undressed picture. A reroll clears it.
- Nude photos on her side or stomach can drift onto her back.
- A bikini can take its colour from her own swimsuit set instead of her sentence.

Some things come from a girl's own tags rather than from the mod, and are fixed in her profile:

- **Sara**: her swimsuit has `tie_side_bikini_bottom`, which is not a Danbooru tag. The model
  reads "tie" and draws a green necktie on her in most beach photos, and once a brown glove.
  `side-tie_bikini_bottom` drew neither on six seeds of six.
- **Florentine**: her tag says `light_purple_hair`, but her sprites draw it dark purple, and her
  photos come out either. `dark_purple_hair` would match her sprites.
- **Lia**: `black_lace_bralette` with `clothing_cutout` under her off-shoulder sweater often
  shows as a black turtleneck or inner top. Take either tag out if she should not wear one.

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
  fixed tag lists, used in their sprites, CGs and photos. They are set from the main menu, in
  Manage Characters, under a character's Generation settings, the default characters too.
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
- **Weights on her clothes**: her top, where it names a colour, at 1.2. Not her shoes, skirt or
  what she wears under another top: weighting those drew shoes beside her, her hair in her
  clothes' colour, and her bralette as a top of its own.
- **Negatives**: a selfie's phone and camera; on a dressed photo nude, nipples, areolae and
  pussy, which tested harmless. Never what is on her legs, under her skirt or between her legs,
  nor censoring: a same-seed check drew a smudge or a coloured leg exactly where each of those
  pointed, and nothing they were meant to keep out showed without them.

Every tag these files can write has to be in the verified list in `test/photoTags.test.ts`,
which fails on any other. A tag goes on that list once a same-seed ComfyUI check shows the
checkpoint draws it.

### A picture of two

`buildDuoPhotoPrompt` in `photoPrompt.ts` writes four strings: the scene over the whole
picture, the sender's half, the friend's half and one negative. `assets/workflows/characterPhotoDuo.json`
is the photo graph with each girl's prompt held to her half by `ConditioningSetArea` (strength
2.0) and combined with the scene. Its face pass runs on each half on its own, cut out and put
back, with that girl's own prompt: one pass over the whole picture redraws each face in a crop where
the halves' whole-picture areas point at the wrong girl or past the crop's edge (which ComfyUI
refuses), and driven by the scene alone it changed their eye colours. Who is in it is `photoDuo.ts`;
picking the pair, asking the scene's first call for its post (`requests.scene`) and filing it
off the reply (`afterSceneReply`) is `photoGroup.ts`. The post is filed through `fileLatePost` in
`loop/feed.ts`, the opening's own filing for a post written mid-slot, and its picture joins the
feed's queue.

The graph has three prompts where `runGenerationJob` fills two, so `comfyService.ts` carries one
more edit beside the exported `runGenerationJob`: its `texts` field, which fills prompt nodes by
id. A sync that replaces the file has to put both back.

The group photo needs two more: `fileLatePost` in `loop/feed.ts`, and the `afterSceneReply` hook
(`hooks.ts`, `loop/turn.ts`, the reply on `SceneCall` in `loop/stream.ts`), ported as it is
written on the 0.5.0 core branches, so a merge with them meets the same code.

### Comments and the picture on a post

A post's comments are the game's (`comments` on `SocialPost`, `shared/postComments.ts`), and the
game moves them with the post through New Game+. Photo Feature registers `postComments` to draw
its stranger comments and `postPicture` to draw her picture, both in
`components/PhotoPostSpots.tsx`. Only one mod draws comments at a time, the first that is on in
the mods list; Photo Feature asks the slot's opening for comments, and files them, only while it
is that mod (`ownsPostComments`). It never names any other mod.

### Hooks

All of Photo Feature's prompt, event and feed additions are in
`src/renderer/modEntries/photo-feature.ts`.
Its picture and comments on the feed are drawn through the game's places on a post; its gallery
on `ContactPage.tsx` and the picture on a text are still direct edits, since those screens have
no places for a mod yet.

Off, three things differ from before hooks, all because a mod that is off is not asked: the
photo fields leave the reply's schema rather than being asked for empty; old DMs lose their
"[attached a photo]" note in the history the prompt quotes; and a render left unfinished from
an earlier session is settled only once the mod is on again.

## Licence

The code is AGPL-3.0-only, like the game (`LICENSE`). Images, audio and video remain © Venus Dev
(`LICENSE-ASSETS.md`).
