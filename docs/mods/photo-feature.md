# Photo Feature

An unofficial mod for Venus University by **naudh1r**. Version **1.8.0**, for the game with male characters and NPC relationships.

Characters send you photos in their DMs and post them on their feeds, with comments from the rest
of campus. Each contact gets a gallery, and characters can get optional body details. Photos are
drawn on your own machine by ComfyUI, the game's own or yours.

It is separate from the game's own **Photos** tab in the Bunnyboard, where you make pictures
yourself. This mod is about the photos characters send and post.

This is not made or supported by Venus Dev. Please do not report problems with it to them.

## What you need

- The desktop game, with image generation working: the game's own ComfyUI, or your own one set
  in Settings. The browser version never makes photos.
- Photos use the game's own photo checkpoint and style LoRA (`assets/workflows/characterPhoto.json`).
  Photos of one person need nothing else.
- Photos of two need ComfyUI-ppm. Install it from **Mods → Photo Feature**, under
  **Two in one photo**. If you use your own ComfyUI, install the pack there instead.

## Settings

Everything is in **Mods → Photo Feature**. The mod is off until you turn it on there.

| Option | Default | What it does |
|---|---|---|
| Photo Feature | on | Off, nobody sends a new photo and posts get no new comments. Photos, galleries and comments already made are hidden, not deleted, and come back when it is on again. |
| Photo generation | on | Off, no new photos are made and characters are not told they can send one. Photos already sent stay visible. |
| Explicit photos | on | Off, nobody sends an undressed photo and ones already sent stay covered. The game's own "No NSFW images" turns them off too. |
| Body details | off | Characters get a build, chest, hips, backside and hair from fixed tag lists, asked for when they are made, editable from the main menu in Manage Characters, under a character's Generation settings (the default characters too), and drawn in their sprites, CGs and photos. Off, what they have is kept but not used. |
| Two in one photo (experimental) | off | A feed post can show its author with a friend or current partner. A scene can bring a photo of any two characters, never more. Needs ComfyUI-ppm, installed under this option. Without it, every photo shows one person. |
| Save photos as WebP | on | New photos are saved as WebP, with no visible quality loss while taking much less space than PNG. Off, they are saved as PNG. Photos already saved stay as they are. |
| Loading animation | Bunny hop | What a photo shows while it is being drawn: Bunny hop, Dot shimmer or Typing dots. |

Male and female characters use the same settings. A bare male chest is ordinary; male nudity
below the waist is explicit. A girl’s coverage rules are unchanged. Explicit photos stay covered
while either Explicit photos is off or No NSFW images is on, regardless of gender.

The examples below use a female character; male photos follow the same steps with his own
appearance, wardrobe, body details and pronouns.

## How a photo is made

1. In a DM, she decides whether a picture fits the moment. She can send one when you ask, or on
   her own, and when she texts you first she can send one with it. On the feed, the game picks
   which of the slot's posts come with one, two at most (see below).
2. She writes one sentence describing it: where she is, what she wears, her pose, what her hands
   are doing, how close the shot is.
3. The game decides how much the photo may show (everyday, suggestive or explicit) from your
   save and your settings. She cannot go past it.
4. The mod turns her sentence into the photo prompt. It keeps the sentence and adds tags it
   reads off it:
   - **Pose and framing**: standing, sitting, lying on her back, side or stomach; her face,
     close-up, waist up, knees up, full body; from above, from below, from behind, side view.
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
5. ComfyUI draws it with the style LoRA, followed by her own LoRA if she has one under her
   Generation settings. Pictures of two people use the style LoRA alone. It lands in the bubble
   or the post.

The earlier female tags were checked in ComfyUI on the photo checkpoint, side by side with the
same seed. The male additions use the game’s male subject and nude vocabulary. Many plain tags turned out to do nothing, so some rules use weights or special
combinations. The comment beside each rule in the code says what was tried.

## Two in one photo (experimental)

Each slot, the feed has up to two pictures: one poster alone, and one poster with a friend or
current partner who is with them right now. That second one needs someone you know by name, who
has not been in a picture with the poster in the last week. When no poster has anyone like that
with them, it is a second picture of one poster alone.

A scene with two or more characters also brings a photo, posted on one's feed, once a slot. It
shows two of them who are not enemies and have not been in a picture together in the last week,
picked at random. When no pair is left, it shows one of them alone. It is written as the scene
begins and waits on the feed until its picture lands, behind the slot's other waiting pictures.
Likes and comments work as on any feed post.

With the option off, every one of these pictures shows one person alone. Any pairing works: two
girls, two guys or one of each. A breakup ends partner eligibility; someone who is still a
friend remains eligible as a friend.
Only everyday clothes or swimwear are used for these duos, as before. A feed photo never goes
past suggestive, and a mixed pair follows the same coverage rules for both people.

The two are drawn side by side, from the waist up, without touching. Each keeps their own
appearance, clothes, colours, expression and gestures in a separate half. Selfies give only
the poster the arm holding the phone. The picture belongs to the poster’s gallery.

Photos of two need [ComfyUI-ppm](https://github.com/pamparamm/ComfyUI-ppm). The game's own
ComfyUI installs it from under **Two in one photo** in **Mods → Photo Feature**, after asking.
It needs a recent ComfyUI, tested on 0.37.1. ComfyUI restarts once it is installed. On your own
ComfyUI, install the pack there yourself and restart that server.

Without the pack installed, Two in one photo counts as off. Feed posts and scenes bring photos
of one person, with no pair chosen or pair cooldown used. The switch keeps your choice for when
the pack is available. Until the pack's state is known, photos show one person too.

Photos of two start wide, 1216x832. The info panel can redraw them portrait, 832x1216, with ppm
too. A solo photo starts wide or portrait at random, a standing head-to-toe shot or standing
mirror selfie always portrait, and either can be redrawn in the other shape. Older photos of two stay visible.
Their next redraw uses ppm, with new halves shown in the info panel beforehand. Without ppm,
a redraw of a photo of two fails and keeps the old picture. It never uses the older drawing method.

Still being tuned: a face, outfit or colour sometimes comes out wrong. Close-ups and rear views
hold less well than plain shots. Where one person reaches into the other's half, a hand, an arm
or hair, the two can still meet in the middle and their colours can bleed. A wide photo makes
that rarer, but not always, and a reroll usually fixes it. A portrait photo of two leaves each
person only half of a narrow picture: once they lean together, one's hair and colours land on the
other, so wide is the shape to keep them apart in. A guy beside a girl is drawn taller, so in a portrait photo
or a close-up his head often leaves the top of the picture. Wide, from the waist up, keeps both
whole. Hair colour spills less often since
each colour is weighted. A long dress beside a top can pull one person further down. A chin resting on a hand stays in
the sentence, since tagging it made elbows merge across the picture.

## Where photos are kept

`data/saves/<save>/mod-data/photo-feature/<character>/`, named after her, for example `risa_chat_004.webp` or
`risa_bunnyboard_002.webp`. They belong to that save; a continued semester copies them across.
Older photos move here automatically when you next view them.

Finished photos travel in the game's normal backup now. To restore an older backup, keep its
`.photos.zip` beside it; Photo reads that companion automatically.

## If a photo looks wrong

Hover the photo and open the **info icon** in its bottom-right corner. It shows the prompt,
negative, seed and LoRA used to draw it. Most problems are one word in her sentence the model
drew too literally: change or remove it, then redraw. **Redraw with same seed** keeps the rest of
the picture close to what it was, so you can see what your change did. **Switch to wide** or
**Switch to portrait** redraws it the other way round, with the same seed where it has one.
Both choices keep the prompts in the fields. Photos of two need ppm installed for any redraw.
For an older photo of two, the panel rebuilds its two halves for ppm while keeping the recorded
scene, negative and seed. You can edit those new halves before drawing. A ppm photo keeps its
own prompts until you choose **Rebuild**, which replaces them from the characters' current tags.
A photo taken before 1.7.0 shows a rebuilt prompt and no seed, so it can only be redrawn with a
new one. A redraw during a scene
is kept once the scene next saves, at its next choice or its end: quit before then, and the photo
you had before comes back.

If a photo stays PNG while WebP is on, look in `data/app.log` for a `[photo] kept ... as PNG:` line.

If a photo leaves out a pose or a gesture her sentence asked for, look in `data/app.log` for a
`[photo] no tags read for` line: it names the photo's sentence, which helps widen what the mod reads.

## 1.9.0

- Wide photos on feed posts and in DMs keep the height of a portrait photo, and can open
  twice as wide in the full view. Portrait photos keep their usual size.
- Wide photos take two tiles in a contact's gallery, cropped at the centre. Opening one shows
  the whole picture. Portraits fill the gaps, so the newest photos may stand slightly out of order.
- A photo's waiting frame follows the shape being drawn, including when switching between wide
  and portrait. A failed redraw brings back the old picture in its old shape.
- Photos of two need ComfyUI-ppm, installed under **Two in one photo** in Mods. On your own
  ComfyUI, install the pack there. Without it, every new photo shows one person.
- Photos of two start wide and can be redrawn portrait with ppm too.
- Older photos of two stay visible. Their next redraw uses ppm, with new halves shown in the
  info panel first. The recorded scene, negative and seed are kept.
- The photo info panel can switch a photo between wide and portrait and redraw it.
- A new photo of one person is wide about half the time. A standing head-to-toe shot or a
  standing mirror selfie stays portrait.
- In a photo of two, each person keeps their own hair colour more often, without the other's
  colour streaking into it.
- A feed post's picture shows what the post talks about, such as the rain or the coffee it names.
- A guy's own name in his caption becomes "him" or "his" instead of leaving a gap, and his photos
  no longer ask for a flat chest.

## 1.8.0

- Guys can send photos in DMs, post them and keep them in the gallery, with the same settings
  and redraw controls as everyone else.
- Body details have build and chest choices for each character’s gender, under the same
  Generation controls. Existing choices for girls stay as they are.
- A guy without a shirt is an ordinary photo and stays uncovered. Nudity below the waist follows
  Explicit photos and No NSFW images, including the covers on pictures already sent.
- Two in one photo works for any pair. Feed duos can include a current partner as well as a friend.
- The game picks which posts carry a picture: two each slot on the feed, one person alone and one
  with a friend or partner they're with right now, and one more from a scene with two or more
  people. The same two aren't pictured together again for a week. With Two in one photo off,
  every one of them shows one person alone.

## 1.7.3

- **More of her gestures**: an OK sign, a salute, finger guns, a peace sign with both hands, cat
  claws, pointing at you or at herself, shushing, a hand over her mouth, a facepalm, hands on her
  cheeks, reaching out to you, a fist pump, a shrug, arms in the air, hands on her hips, and
  flipping you off.
- **Reads her sentence more ways**: "flips off" and "flipped off" as well as "flipping off", and a
  pose she puts in words of her own is no longer drawn standing.
- **Mirror selfies** she describes as facing the mirror with her phone up are drawn as mirror
  selfies again, and the mirror is left out of the picture's sentence so it draws no second her.
- **More varied shots**: she picks how close and from which angle to suit the moment, rather than
  the same one each time, and asks for the light. A photo she takes now is where she is, at that
  time of day. Standing, she no longer always has a hand on her hip.
- **Knees-up shots** are framed that way only while she stands. Sitting, kneeling or lying down,
  her sentence frames the shot.
- **Photos of two girls**: her friend's face is read past a comma ("an awkward, shy smile"), and
  what both of them do goes to both.

## 1.7.2

- **Closer to her sentence**: her photos follow what she wrote more closely: how she sits, leans
  or lies, what her hands are doing, and what she holds, one thing at most.
- **Her face up close**: a new shot, a close-up of her face, for her look rather than her outfit
  or the place.
- **Mirror selfies**: drawn as the picture she took, without a second her in the glass. A photo of
  her from behind has no mirror in it.
- **Photos of two girls**: each has her own face and hands, with a little room between them, and
  the shot is sometimes a selfie, sometimes a photo somebody took.

## 1.7.1

- Your older photos stay with their texts and posts, including pictures still waiting to appear
  and photos of two girls.
- A body tag her appearance already names is no longer doubled in sprites or CGs.
- Your photos are kept in Photo Feature's own folder now; older ones move there when you
  next view that playthrough's photos.

## 1.7.0

- **More than selfies**: her photos can be from earlier or taken by a friend, closer or wider,
  from different angles, in what she wore that day, and with her hands on what she's doing —
  a guitar, a book, a game.
- **Keep the place**: photos keep the place she described, and no longer put the name of her
  outfit into the picture's prompt once her own tags dress her.

- **See what drew a photo**: hover it and open the info icon for its prompt, negative, seed and
  LoRA. Photos taken before 1.7.0 show a rebuilt prompt and no seed.
- **Redraw a photo**: edit its prompts, or **Rebuild** them from her current tags first, and draw
  it again with the same seed or a new one. The new picture replaces it once it lands, and the old
  one is kept until a save has the new one. If it fails, the old one stays and says so for a few
  seconds. Nothing she said changes.
- **A head start on her photo**: it starts drawing as soon as she decides to send it, while she's
  still typing. It arrives on her last text as before.

## 1.6.0

- **Her friend tagged in the picture**: a person icon on a photo of two girls shows her friend's
  `@handle` when tapped, only while the two are friends with each other. Tap it again, or tap
  elsewhere on the picture, to hide her tag.
- **No enemy pairs**: a scene's group photo leaves enemy pairs out. Acquaintances can still be
  in one together; if no pair is left, no group photo is asked for.
- **Her own LoRA in her photos**: a LoRA set under her Generation settings is used in her solo
  photos too, as in her sprites. Photos of two girls stay as they were.
- **Body details kept with the mod**: her build, chest, hips, backside and hair are saved in Photo
  Feature's own place on her, rather than as a field of the game's. Her pictures don't change, and
  a character made before keeps hers: it moves over the first time she is saved. An older Photo
  Feature reading a character saved by 1.6.0 finds no body details on her.

## 1.5.0

- **Fixed**: a post waiting on its picture came out under the posts its slot already showed, as
  if it were older. It now goes on top when it comes out.
- **Two in one photo (experimental)**: a scene with two or more of the girls brings a photo of two of
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

### Gender and body details

`photoGender.ts` owns Photo’s pronouns, adult subject tags and caption cue normalization. It reads
`Character.gender`; an absent gender is female. It imports only the kit. Original captions and
recorded prompts are kept intact. Caption matching accepts male pronouns without changing the
female cue tables.

`characterBody.ts` keeps the old five body keys and female pools. Male characters use separate
build, chest and pubic-hair pools, with shared tags only where appropriate. Normalization recognises
male-only picks; drawing and the editor filter against the actual character’s gender. The editor’s
gender context is temporary and is not written into the body slice. Character generation gets
its gender from the host’s subject tags, falling back to the gender-specific appearance shape
when those tags have been customised. The model chooses from the matching build pool.

`photoGate.ts` treats a male bare chest as ordinary and lower nudity or sexual activity as explicit.
The same Explicit photos and No NSFW images switches still govern sending and uncovering explicit
photos. Male characters without a saved swim outfit get Photo’s swim-trunks fallback; a saved
swim outfit wins. Duo count bans follow both characters; mixed duos retain the full SFW guard.
Current partners join friends in the existing feed roll while their `dating` field is set.

### Switches

It is `anytime`, and it checks its own switch: `src/shared/photoSwitches.ts` answers whether the
mod is on and where each option stands, and everywhere the mod acts asks there. It reads them from
the kit when asked, so the game hands it nothing:

- Whether it is on: `sharedModOn`, which both sides bind.
- Its options: the `modOptionOn` of the side it runs on. Shared code cannot import either side's
  kit, so each entry plugs its own in with `bindPhotoOptionReader` (the renderer's in
  `src/renderer/modEntries/photo-feature.ts`, main's in `src/main/modEntries/photo-feature.ts`).
  Main needs them because body details are drawn there.
- In components, `usePhotoSwitches` draws again when a switch moves, through `useModOn` and
  `useModOption`.

Its entry, `src/shared/modEntries/photo-feature.ts`, is `PHOTO_FEATURE_MOD` from
`photoDefinition.ts` with the version added, so its name, text and options come from the mod.
Body details reach the game's sprite and CG prompts through an image-prompt draft. It is
registered once the mod catalogue has loaded, by the renderer entry and by Photo's main
startup, since both draw prompts; registering while the catalogue loads would find the kit
half-made.

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

Photo Feature reads nothing of the game's settings but "No NSFW images", which it obeys and never
changes.

Option ids are written to disk, so they never change: `photos`, `explicit`, `body`, `webp`,
`loader-bunny`, `loader-shimmer`, `loader-dots`, `ppm`. `test/photoSwitchReaders.test.ts` and
`test/photoMainSwitchReaders.test.ts` read each of them on both sides.

### WebP photos

ComfyUI only saves PNG, and main has no image encoder. So a photo whose name is reserved as
`.webp` is rendered to the `.png` beside it; the renderer then gets the PNG's bytes through `invoke`,
encodes them with Chromium at 85%, and main keeps the WebP and deletes the PNG
(`src/renderer/stores/photoWebp.ts`, `storeWebpPhoto` in `localPhotoService.ts`).

Every reader takes whichever of the two is on disk: the `vxmod://photo-feature/@/photos/…` route, the check for a
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

`buildDuoPhotoPrompt(..., 'ppm')` in `photoPrompt.ts` writes the scene, sender's half,
friend's half and negative independently of orientation. Photos of two use only
`assets/photo/characterPhotoDuoWide.json` at 1216x832 or
`assets/photo/characterPhotoDuoPpm.json` at 832x1216. `AttentionCouplePPM` patches the model with
the scene over a full mask and each person's prompt over their half. Each half opens on
`duoHeadCount` and drops `solo` and `male_focus`. `faceHalfOf` restores the person's own subject
for face-pass nodes 80 and 81. The older area graphs and their render/fallback paths are removed.

The ppm graphs stay outside `assets/workflows`, which core checks against every server. Each
crops the two face passes separately and composites them at the same x coordinates. The portrait's
upscaled image is 1165x1702, split 582 + 583. The wide image is 1702x1165, split 851 + 851.
A solo wide photo keeps the solo graph with its latent set to 1216x832.

`main/photoNodePack.ts` pins the pack and the main entry registers it. `photoPpmState` directly
reads the kit's pack state without an option check. For a player's own ComfyUI, the kit checks
its loaded node classes with a two-second deadline and a one-minute cache. Unreachable or
unanswered probes return unmanaged, which does not permit duos. Managed probe behavior is unchanged.

`renderer/stores/photoPpm.ts` keeps one non-persistent answer, initially unknown. The renderer
entry binds `duoPhotosOn()` to it and refreshes at entry, on game entry, when the selected ComfyUI
source or external address changes and after an install. Mounting the Mods control also refreshes it. A failed duo
render refreshes it before completing its failure, so subsequent slots see a missing pack.
`duoPhotosOn()` requires photo generation, the duo option and an installed answer. Without that
answer, feed and scene pairing use the same solo path as with the option off. The old saved ppm
switch is ignored and remains safe to load.

`optionControls: { duo: PhotoPpmControl }` puts the state and install control under Two in one
photo while that option is on. An external server without the pack gets installation instructions
for that server. A render independently checks for installed ppm before drawing. There is no
try/fallback path. If nodes disappear between the check and render, the render fails normally.

A sidecar's optional `orientation: 'wide'` records shape, with absent meaning portrait.
`couple: 'ppm'` records ppm and remains valid only with both halves. An absent couple is still
accepted for old photos. Info rebuilds those old halves for ppm and preserves the saved scene,
negative and seed. The dialog sends `couple: 'ppm'` explicitly with those editable halves to a
new reserved filename. Main also converts old halves on redraw when the caller has not already
supplied ppm halves. Every successful duo redraw records ppm.

A ppm photo returns its recorded prompts unchanged without Rebuild, including when another
orientation is requested. Explicit Rebuild always builds ppm prompts and keeps the seed and
orientation. The orientation button resends the fields without rebuilding. Inspection never
rewrites the sidecar, and redrawing without installed ppm changes no saved files.

Who is in a duo is `photoDuo.ts`; picking a pair and filing a scene's post is `photoGroup.ts`.
Its picture joins the feed queue through `fileLatePost`.

### Wide pictures on screen

A loaded photo's own dimensions tell the feed, gallery and full view its orientation
(`renderer/stores/photoOrientation.ts`). A wide picture keeps the height of a portrait: about 482px on a post
(330px portrait width) and 409px in a DM (280px portrait width). Its width follows the wide
ratio, capped by its card or thread; both dimensions shrink together if needed. Photo's wrapper around the shared Lightbox raises only a wide photo's cap to 1520px.
The shared component and its stylesheet are unchanged.

The contact gallery keeps portrait tiles at 2:3. Wide pictures span two columns in a row of the
same height and crop at the centre; dense packing fills the slot they skip. At one column a wide
tile spans only that column. Opening either kind shows the whole picture.

Redraw state carries the requested orientation until that attempt ends, independently of the
saved photo. A failed attempt restores the old image and its dimensions. For a first duo the
waiting frame uses wide once the shared renderer state confirms ppm installed. Named pending and failed
photos keep their gallery tile, source label and place in the count.

The graph has three prompt areas. `localPhotoService.ts` passes them through the kit's
`renderComfyImage`, using the same cancellation signal as Photo's main invocation.

### Comments and the picture on a post

A post's comments are the game's (`comments` on `SocialPost`, `shared/postComments.ts`), and the
game moves them with the post through New Game+. Photo Feature registers `postComments` to draw
its stranger comments and `postPicture` to draw her picture, both in
`components/PhotoPostSpots.tsx`. Only one mod draws comments at a time, the first that is on in
the mods list; Photo Feature asks the slot's opening for comments, and files them, only while it
is that mod (`ownsPostComments`). It never names any other mod.

### Source map

| Files | Kit APIs and responsibilities |
| --- | --- |
| `renderer/modEntries/photo-feature.ts` | `registerHooks`: prompts, DM/reach-out events, post filing, visibility, ordering, picture/comment slots, gallery and Lightbox. Initial pictures decorate `filing.post` through `recordField.with`; core files held posts without an early BunnyBot nudge. |
| `renderer/stores/photoRecords.ts` | Separate message and post `recordField` handles, with `legacy: ['photo']`. `read` accepts older records; `set`/`update` move a changed record into its `ex['photo-feature']` slice. Native record fields and other mods' slices stay intact. |
| `shared/photoTypes.ts`, `shared/heldPosts.ts` | Normalize attachment state and read the same payload for shared visibility. An explicitly cleared slice wins over an old field. |
| `renderer/stores/photoGame.ts` | Composes `character`, `characterInfo`, `conversation`, `rosterIds`, `npcRelationships`, `clock`, `gameFacts` and `currentRun` for Photo's decisions. |
| `renderer/stores/localPhotoStore.ts` | Scoped message/post writes through the handles and `RecordRef`; `saveChanges` with the current run saves arrivals now, or defers to the next loop save during playback. |
| `renderer/stores/photoTurn.ts`, `photoPost.ts`, `photoRecovery.ts`, `photoGroup.ts`, `photoComments.ts`, `photoTipDelivery.ts` | Kit game readers and run fences; post filing through `fileLatePost`, one-shot tips through `bunnybotSays`, identity draws through the kit. Photo keeps a held post's release timestamp and nudges when it comes out. |
| `renderer/components/PhotoBubble.tsx`, `PhotoPostSpots.tsx`, `renderer/views/ContactGallery.tsx` | Reactive `useCharacter`, `useCharacterInfo`, `useConversation`, `useFeed`, `useNpcRelationships`, `useClock` and `useGameFacts`; saved attachments read through the handles. |
| `renderer/stores/photoInvoke.ts` | `invoke('photo-feature', name, args)`. Only `DESKTOP_ONLY` gets Photo's browser answer: carry succeeds empty; other calls retain Photo's note. |
| `main/modEntries/photo-feature.ts`, `main/photoIpc.ts` | Built-in main entry exports `invoke` handlers: `reserve-name`, `carry`, `landed`, `read`, `store-webp`, `info`, `drop`, `generate`, `generate-duo`, `ppm-state`, `install-ppm`, and registers ComfyUI-ppm. `info` takes an optional orientation after `rebuild`; duo redraw options also carry `couple`, separately from `orientation`. `ppm-state` reports `off` when disabled. |
| `main/photoProtocol.ts`, `shared/photoFiles.ts` | Main entry's `photos` protocol route, `vxmod://photo-feature/@/photos/<playthrough>/<character>/<file>`. Saves keep file names, including older names; the URL is built when displayed. |
| `main/services/localPhotoService.ts`, `main/photoFiles.ts` | `renderComfyImage`, mod data paths and saved-checkpoint checks before retiring replaced files. A deferred save alone never permits deleting an old picture. |
| `renderer/stores/bunnyfeedsThreads.ts`, `pictureOf` only | Reads the versioned Photo slice as plain data, falling back to the old field. Companion names use kit `character`; no dependency on Photo's renderer is introduced. |

Off, the photo fields leave the reply's schema; old DMs omit their photo history note; a render
left unfinished from an earlier session is settled only once the mod is on again. Saved photos
are kept either way.

## Licence

The code is AGPL-3.0-only, like the game (`LICENSE`). Images, audio and video remain © Venus Dev
(`LICENSE-ASSETS.md`).

Wide photos of two use [ComfyUI-ppm](https://github.com/pamparamm/ComfyUI-ppm) by pamparamm,
AGPL-3.0, which the game downloads into its own ComfyUI only when you install it from Mods.
