# Mods in this build

This branch is a proposal for how the community mods share one build: every mod's code is
always in the game, and a switch decides whether it acts. Players turn mods on and off from
**Mods** on the main menu; nothing is chosen at install time.

It carries no mods yet. This is the frame alone, on the game as Venus Dev released it (0.3.1),
so any mod can start from it. The `extracurriculars-base` branch adds Continuing Semesters on
top as a worked example.

## The three things a mod does

**1. Register** in `MODS`, in `src/shared/mods.ts`:

```ts
{
  id: 'city-life-locations',        // written to disk: never changes once shipped
  name: 'City Life locations',
  author: 'Maestro Leeds',
  version: '1.7.1',
  scope: 'playthrough',             // or 'anytime', see below
  defaultOn: true,
  blurb: 'Three new places on the map.',
  requires: [],                     // ids of mods this one cannot act without
  options: [{ id: 'some-option', label: '…', hint: '…', default: true }]
}
```

That is all the Mods screen, the main menu's count and the log need.

Options that are one choice among several share a `group`, and the mod names the group in
`optionGroups`. One option of a group is on at a time: turning one on turns the others off, and
the one that is on stays on until another is picked. The Mods screen shows a group as one box,
with the group's label and hint once and a row for each choice. They are still plain on/off
values in `data/mods.json`.

```ts
options: [
  { id: 'loader-bunny', label: 'Bunny hop', hint: '', default: true, group: 'loader' },
  { id: 'loader-dots', label: 'Typing dots', hint: '', default: false, group: 'loader' }
],
optionGroups: [{ id: 'loader', label: 'Loading animation', hint: 'The animation shown while…' }]
```

**2. Ask before acting**, wherever the mod would do something:

```ts
// in a component
const on = useModOn('city-life-locations', record)
// anywhere else in the renderer
if (modIsOn('city-life-locations', record)) { … }
// in main or shared code, with the switches in hand
modOn(switches, 'city-life-locations', record)
```

An option is read the same way: `useModOption(modId, optionId)` or `optionOn(switches, …)`.

**3. Keep its data when it is off.** Off stops a mod acting. It never deletes what the mod
wrote, so a save always loads and switching back on finds everything where it was.

## The two kinds of switch

- **`anytime`**: read where the mod acts. The player can flip it whenever they like. Use it
  for anything a save does not depend on.
- **`playthrough`**: fixed when a playthrough starts. The playthrough's record names the mods
  it started with (`record.mods`), and `modOn(…, record)` answers from that, whatever the
  switch says later. The switch is what a *new* playthrough gets. Use it for a mod that changes
  the game's rules or adds things a save refers to.

Pass the playthrough's record whenever there is one. With none, a `playthrough` mod answers
what a new playthrough would get. A record written before this list existed names no mods, so
no `playthrough` mod is on for it.

A mod whose requirement is off is off too, and comes back when the requirement does; its own
switch is left as the player set it.

## Where it is stored

- `data/mods.json`: the player's switches and options, `{ schemaVersion, on, options }`. A mod
  or option missing from it is at its default, so adding a mod needs no migration. Ids this
  build does not know are kept.
- `playthrough.json`: `mods`, the `playthrough` mods that playthrough started with.

## Where the code is

| File | What it is |
| --- | --- |
| `src/shared/mods.ts` | The list, the switches' shape and every rule above. |
| `src/main/services/modsService.ts` | Reads and writes `data/mods.json`. |
| `src/renderer/stores/modsStore.ts` | The switches in the renderer, and the hooks. |
| `src/renderer/views/ModsModal.tsx` | The Mods screen. |
| `src/renderer/mods/hooks.ts` | The hook points (below). |
| `src/renderer/mods/index.ts` | Registers every mod's hooks at boot. |
| `test/mods.test.ts` | The rules, tested against a list with every shape of mod. |
| `src/renderer/mods/hooks.ts` | The hook points (prototype, below). |
| `src/renderer/mods/index.ts` | Registers every mod's hooks at boot. |

## A rule in shared code

Shared code holds no switches. Where a rule there has to follow one, give the rule a flag with
a setter, and set it from `modsStore.ts` at boot and whenever a switch moves
(`useModsStore.subscribe`). Continuing Semesters does this for its seniors option.

## How Photo Feature uses it

It is `anytime`, and it checks its own switch: the mod keeps its switches in
`src/shared/photoSwitches.ts` and asks there wherever it acts, so the build only hands them
over. That is three places:

- `photoSwitchesOf(switches)` in `mods.ts` turns the Mods screen's switches into the mod's own.
- `modsStore.ts` passes them to `setPhotoSwitches` at boot and whenever a switch moves.
- `modsService.ts` does the same in main, when the switches are read or written. Main keeps its
  own copy because body details are drawn there.

Its entry in `MODS` is `PHOTO_FEATURE_MOD` from `photoSwitches.ts`, with the version added, so
its name, text and options come from the mod.

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

## Hook points

A switch decides whether a mod acts. Hook points decide **where** it acts without editing the
game there. At each place mods commonly add to, the game asks once, in one line of its own
file; a mod answers from its own files. Two mods adding to the same place then never touch the
same lines, and neither touches the game's code at that place.

Everything is in `src/renderer/mods/hooks.ts`. The game's side, at each place:

```ts
...promptLines('dm', { character, info, state })   // in textingPrompt.ts
afterDmReply({ charId, character, reply: data })    // in textingLoop.ts
```

A mod's side, once, in its own file:

```ts
registerHooks(PHOTO_FEATURE, {
  prompts: { dm: { lines: (ctx) => photoLines(ctx.character, ctx.info, ctx.state) } },
  afterDmReply: ({ charId, character, reply }) => void sendPhoto(charId, character, reply)
})
```

and one line in `src/renderer/mods/index.ts` (`import './photoFeature'`), which `App.tsx`
imports at boot.

### The rules

- **Only mods that are on are asked.** The mods store hands the hooks its switches
  (`setHookRules`), so a mod that is off is never called and the game runs as it would without
  it. A mod rarely needs to check its own switch at a hook.
- **Mods are asked in the order `MODS` lists them**, whatever order they registered in.
- **Adding to the game, not replacing it.** Lines, fields and events from every mod are all
  used. Where only one answer can win (likes), the first mod that answers decides and the game's
  own roll is the fallback.

### The hook points

| Hook | Where the game asks | What a mod can do |
| --- | --- | --- |
| `prompts.dm` | `textingPrompt.ts` | Add lines to her DM prompt, and fields to its reply |
| `prompts['slot-posts']` | `slotIntroPrompt.ts` | Add lines about status posts, and fields to each post |
| `prompts.character` | `characterPrompt.ts` | Add lines and fields to character generation |
| `dmHistoryNote` | `textingPrompt.ts` | Add a note after a DM in the history the prompt quotes |
| `characterFromDraft` | `characterPrompt.ts` | Fill fields of a generated character from the reply |
| `afterDmReply` | `textingLoop.ts` | Act after her reply in a DM has landed |
| `playerActs` | `gameLoop.ts` (`submitAction`), `loop/hangouts.ts` | Act when the reader commits to something |
| `gameEntered` | `gameLoop.ts` (`enterGame`) | Act when a game is entered, new or loaded |
| `fileFeedPost` | `loop/feed.ts` | Change a slot post before it is filed, or file it later itself (`held`) |
| `postLikes` | `loop/feed.ts`, `NewGameView.tsx` | Decide likes on ending, stranger and winter posts |
| `postVisible` | `feedView.ts`, `loop/feed.ts`, `ContactPage.tsx` | Keep a post off the feed for now |

A hook point is added where mods actually meet, not ahead of need. Once mods use one, it stays
as it is: renaming it or changing what it passes breaks them. A change that is needed goes in
as a new hook beside the old one.

### Photo Feature on hooks

All of Photo Feature's prompt, event and feed additions are in `src/renderer/mods/photoFeature.ts`.
In the ten game files involved, lines naming Photo Feature went from 67 to 4: two for its gallery
on `ContactPage.tsx` (screens have no hook points yet) and two that are Continuing Semesters'
own photo carry-over in `NewGameView.tsx`.

Off, three things differ from before hooks, all because a mod that is off is not asked: the
photo fields leave the reply's schema rather than being asked for empty; old DMs lose their
"[attached a photo]" note in the history the prompt quotes; and a render left unfinished from
an earlier session is settled only once the mod is on again.

### Not covered yet

- Screens: a mod's own panels, menu entries and editor fields.
- Main process: IPC, protocols, services, settings and character rules.
- Saves: a mod's own fields in a save, and what carries into the next semester.

Both are still direct edits, as before.

### Tests

- `test/modHooks.test.ts`: only mods that are on are asked, in list order; likes fall back to
  the game's own; a post a mod holds is not passed on.
- `test/photoHooks.test.ts`: every hook line is still in the game's files after a merge, and
  Photo Feature is still registered.

## Opening a pull request

The build lives at `venus-extracurriculars/build`, which is a fork of Venus Dev's repository.
On a fork, GitHub's **Compare & pull request** button offers to open the pull request on Venus
Dev's repository instead of ours. Skip the button and use this address, with your branch's name
at the end:

```
https://github.com/venus-extracurriculars/build/compare/main...your-branch
```

Use `core` in place of `main` for a change to the mod system itself. Before you click **Create
pull request**, check that the top left of the page reads `venus-extracurriculars / build`. If
it reads `venus-uni-dev / venus-university`, stop: that is Venus Dev's repository.

From the command line, `gh repo set-default venus-extracurriculars/build` once, and
`gh pr create` targets the right repository from then on.

Where a branch goes:

- `core`: the mod system on the current game version, with no mods.
- `mod/<name>`: one mod, built on `core`, looked after by its author.
- `main`: what players get, assembled from `core` and every mod branch.

## Not decided yet

- The build's name and version (`BUILD` in `mods.ts`).
- Whether `data/mods.json` goes into the game's own backup; it does not today.
- How a mod that patches the built code, rather than the source, reads its switch.
- Whether hook points go into the framework, and which ones.
