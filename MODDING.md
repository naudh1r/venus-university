# Mods in this build

This is how the community mods share one build: every mod's code is always in the game, and a
switch decides whether it acts. Players turn mods on and off from **Mods** on the main menu;
nothing is chosen at install time.

`core` is the frame alone, on the game from Venus Dev's public repository, so any mod can
start from it.
`main` is `core` with every mod, and each mod's own guide is in `docs/mods/`.

## The three things a mod does

**1. Register** by adding one file, `src/shared/modEntries/<id>.ts`, named for the mod's id,
whose default export is its entry:

```ts
import type { ModDef } from '../mods'

const mod: ModDef = {
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
export default mod
```

That is all the Mods screen, the main menu's count and the log need. Nothing else names the mod:
`MODS` in `src/shared/mods.ts` is built from whatever files that folder holds, sorted by id, so
two mods added side by side never edit the same line. A test holds each file's name to its id.
The entry may import the mod's own modules for what they set up (a `registerTermCarry`, say).

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


## Options that are one choice

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

## Where the code is

| File | What it is |
| --- | --- |
| `src/shared/mods.ts` | The list, the switches' shape and every rule above. No dependencies. |
| `src/shared/modEntries/` | One file per mod, named for its id: its entry. |
| `src/main/services/modsService.ts` | Reads and writes `data/mods.json`. |
| `src/renderer/stores/modsStore.ts` | The switches in the renderer, and the hooks. |
| `src/renderer/views/ModsModal.tsx` | The Mods screen. |
| `src/renderer/mods/hooks.ts` | The hook points (below). |
| `src/renderer/modEntries/` | One file per mod with hooks, named for its id: its `registerHooks`. |
| `src/renderer/mods/index.ts` | Loads every file in `modEntries/` at boot. |
| `test/mods.test.ts` | The rules, tested against a list with every shape of mod. |

## A rule in shared code

Shared code holds no switches. Where a rule there has to follow one, give the rule a flag with
a setter, and set it from `modsStore.ts` at boot and whenever a switch moves
(`useModsStore.subscribe`). Continuing Semesters does this for its seniors option.

## Additive romance requirements

`shared/romanceRequirements.ts` lets a shared mod entry register a pure rule with
`registerRomanceRequirement(modId, character => minimumsOrNull)`. The character supplies
`traits` and `preferredStat` and can be absent. Return any subset of Brain, Body and Heart
**point** minimums. Core takes the maximum for each stat across active providers; this is a
merge, not first-wins or a multiplier. The native preferred-stat and High Standards checks
still apply. With no enabled providers, native behavior is unchanged.

```ts
registerRomanceRequirement(MY_MOD, character =>
  character?.preferredStat === 'brain' ? { brain: 60, heart: 35 } : null
)
```

The enable lookup is `sharedModOn`, bound once via `setSharedModRules` to current switches/playthrough selection
by `modsStore`. Disabled callbacks are not called. Register once at boot; the current registry
holds one rule per mod ID, and a second registration for that ID replaces its rule. Results
must be pure and finite; non-finite values are ignored. Exceptions propagate to the caller,
rather than silently bypassing a failed requirement. This ports the existing `main` contract;
it does not add a loader, hot-unload lifecycle or a second hook ordering system.

Core reads requirements at crush eligibility/hints, direct crush awards, relationship prompt
construction, ledger acts, projected milestones and committed milestones. A blocked group act
is dropped as a whole. Friendship and affection can still grow; existing lovers are exempt.
After a breakup, a new romance is gated again. Scene Creator's existing prompt-attraction
override remains intentional. Callers of `foldRelationshipEvents` must supply character and
stats to enforce optional requirements; its context-free form remains the native fold.

`crushHintUpdate` can reopen a previously met hint when a newly active requirement is unmet.
A saved `{ met: true }` therefore is not permanent eligibility: the next hint names the missing
stat, and marks the hint met again once all active requirements are satisfied.

The tests in `test/romanceRequirements.test.ts` use a synthetic registration, not a shipped
mod. They check order-independent composition, disabled/invalid responses, prompts, direct
awards, roll eligibility, group acts, projections, saved milestones and the lover exception.

## Screens and the files in the root

A mod's screens follow `UI_STYLE_GUIDE.md`, but nobody edits it, nor any other file in the root
besides this one (`DESIGN_GUIDE.md`, `README.md`, …): they come from Venus Dev and are replaced
whenever a new version of the game is synced in. How a mod's own screens look goes in its guide
under `docs/mods/`; how a hook point draws goes in its entry here.

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

in a file of its own, `src/renderer/modEntries/photo-feature.ts`, named for the mod's id.
`src/renderer/mods/index.ts`, which `App.tsx` imports, loads every file there at boot; nothing
else names it.

### The rules

- **Only mods that are on are asked.** The mods store hands the hooks its switches
  (`setHookRules`), so a mod that is off is never called and the game runs as it would without
  it. A mod rarely needs to check its own switch at a hook.
- **Mods are asked in the order `MODS` lists them**, by id, whatever order they registered in.
- **Adding to the game, not replacing it.** Lines, fields and events from every mod are all
  used. Where only one answer can win (likes), the first mod that answers decides and the game's
  own roll is the fallback.

### The hook points

| Hook | Where the game asks | What a mod can do |
| --- | --- | --- |
| `prompts.dm` | `textingPrompt.ts` | Add lines to her DM prompt, and fields to its reply |
| `prompts['slot-posts']` | `slotIntroPrompt.ts` | Add lines about status posts, and fields to each post |
| `prompts['slot-poster']` | `slotIntroPrompt.ts` | Add lines under each girl posting, by her name, given the slot the opening is for |
| `prompts['slot-reach-outs']` | `slotIntroPrompt.ts` | Add lines under a girl texting first, and fields to her entry |
| `prompts['text-ledger']` | `textLedgerPrompt.ts` | Add lines to the texting bookkeeping, below the slot's messages, handed the girls he texted |
| `prompts.character` | `characterPrompt.ts` | Add lines and fields to character generation |
| `dmHistoryNote` | `textingPrompt.ts` | Add a note after a DM in the history the prompt quotes |
| `characterFromDraft` | `characterPrompt.ts` | Fill fields of a generated character from the reply |
| `afterDmReply` | `textingLoop.ts` | Act after her reply in a DM has landed |
| `afterSceneReply` | `loop/turn.ts` | Read a landed scene reply as the model wrote it, fields a mod asked for included. A turn's reply only: a scene's closing reply is not handed over |
| `scenePlay` | `SceneChrome.tsx`, `GameView.tsx` | Stand a seat on the scene's rail, and open a panel of its own over the scene |
| `afterReachOut` | `textingLoop.ts` | Act after the texts of a girl texting first have landed |
| `playerActs` | `gameLoop.ts` (`submitAction`), `loop/hangouts.ts`, `loop/relax.ts` | Act when the reader commits to something: an action, a hangout begun, or Relax |
| `gameEntered` | `gameLoop.ts` (`enterGame`) | Act when a game is entered, new or loaded |
| `fileFeedPost` | `loop/feed.ts` | Change a slot post before it is filed, or file it later itself (`held`) |
| `postLikes` | `loop/feed.ts`, `NewGameView.tsx` | Decide likes on ending, stranger and winter posts |
| `postVisible` | `feedView.ts`, `loop/feed.ts`, `ContactPage.tsx` | Keep a post off the feed for now |
| `postOutAt` | `feedView.ts`, `ContactPage.tsx` | When a post kept off came out, so it stands above its slot's posts already showing |
| `postComments` | `BunnyboardModal.tsx` (`PostSpots.tsx`) | Draw the comments under a post and a control beside its like; one mod at a time |
| `postPicture` | `BunnyboardModal.tsx` (`PostSpots.tsx`) | Draw a post's picture under its text |
| `emojiTool` | `BunnyboardModal.tsx` (`TextSpots.tsx`) | Stand an emoji tool beside a box being typed in, in place of the phone's row of quick emoji; one mod at a time |
| `sentText` | `BunnyboardModal.tsx` (`TextSpots.tsx`) | Draw what somebody sent (a message, a post) and say which messages stand with no bubble; one mod at a time |
| `endingChoice` | `GameView.tsx` | Offer a way on from the ending, beside "Return to the main menu" |
| `saveChoice` | `LoadGameModal.tsx` | Offer something for a picked save, beside "Load" |
| `modDetail` | `ModsModal.tsx` | Draw a page of its own for the mod picked on the Mods screen, its own or one built on it, in place of the list of that mod's options |
| `updatesTab` | `BunnyboardModal.tsx` | Add a page beside the feed in the Updates tab, with an unread count |
| `optionPreviews` | `ModsModal.tsx` | Draw a preview under one of the mod's option groups on the Mods screen |
| `saveNote` | `SaveGameModal.tsx` | Add a line to Save Game about what a save of the scene keeps of the mod's own |
| `statActivities` | `slotActions.ts` | Offer a training activity in place of one of the landing's stat suggestions |
| `slotActivityAvailable` | `gameLoop.ts`, `slotActions.ts`, `GameView.tsx` | Say whether a training activity is still there to commit to or resume |
| `exercisedStats` | `gameLoop.ts` (`resolveScene`) | Change what the hour exercised, before the game resolves what that pays |
| `settleSceneStats` | `gameLoop.ts` (`resolveScene`) | Change what a finished scene does to the reader's stats, and the lines that say so |
| `statFloor` | `gameLoop.ts`, `gameStore.ts` | Say the lowest a stat may fall to; the first mod that answers decides |
| `settingsSection` | `AppSettingsModal.tsx` | Draw a component in app settings, in the Game tab under the volume sliders. Props: `theme`, `busy` (a backup or restore is running) |
| `portraitOverlay` | `GameView.tsx` (`PortraitSlot`) | Draw a component in each portrait on the stage, under her sprite. Props: `charId` |
| `phoneOverlay` | `BunnyboardModal.tsx` | Mount a component in the phone's veil while the phone is open, over the phone. Props: none |
| `mapOverlay` | `MapModal.tsx` | Draw a component on the map, under the places and above its foot. Props: `canTravel` (the map was opened to go somewhere), `close` |
| `photosPageSection` | `PhotosPage.tsx` | Draw a component on the Photos page, under the grid. Props: `theme` |
| `editCharacterImages` | `EditCharacterModal.tsx`, `CharacterModal.tsx` | Draw a component first among her images, in the character editor and the character view. Props: `charId`, `name`, `theme`, `height` |
| `editorField` | `EditCharacterModal.tsx` | Add a field to the character editor, under Generation settings, saved with her |
| `stageLayer` | `GameView.tsx` | Mount a component over the stage and under the scene's chrome, on every screen of the game view. Props: `sceneMode`, `cinematic`, `covered`, `uiHidden`, `rowShown`, `blocked`, `quiz`, `interjectRow`, `awaitingInput` |
| `panelLayer` | `GameView.tsx` | Mount a component among the game view's panels, over the chrome, on every screen of the game view. Props: `cinematic`, `covered`, `uiHidden`, `blocked`, `panelOpen`, `openGameMenu` |

The two ways on (`endingChoice`, `saveChoice`) share one shape, `WayOn`. Its `prepare` runs
while nothing has been torn down, does whatever may fail and reports it, and returns `enter`,
which the game calls once any running game is gone: it stages what the mod needs and names the
screen to show. The first mod that answers is offered; the game's own choice always stays.
While `prepare` runs, the screen that offered the choice keeps every button locked; an answer
that comes back after that screen closed, or after its game was left, opens nothing.

The places on screen (`settingsSection` to `panelLayer` above) each take a component. Every mod
that is on and has one there is drawn, in list order, and drawn again when a switch moves or a
game is entered or left (a `playthrough` mod is on as the game's record says); a mod that is
off is not drawn. The props are the facts the game has at that place, and only the ones a
mod reads; a component works out its own hidden or blocked state from them. A component that
throws draws nothing from then on, and the screen around it carries on. `phoneOverlay` is mounted
in the phone's veil, so it is there only while the phone is open, and stands over the phone: it
is not a layer over the whole app. `blocked` is the game's own: a panel, a modal or a failure
standing over the scene. Once mods use one of these places, its name and its props stay as they
are; a change goes in as a new place beside it.

A place on the scene screen (`scenePlay`) is two components. `Seat` is mounted on the rail for
as long as the scene's chrome is; the game hands it the rail's own seat to draw with, whether
the rail is up, and `open`. It decides for itself when it has something to offer, and stands
down (`state: 'gone'`) otherwise. `Panel` is mounted while open, as one of the scene's own
panels: the scene behind it takes no key, click or turn until it closes. A field a mod adds to
the scene's reply (`requests.scene`) comes back whole in `afterSceneReply`, once the reply's
lines are on the transcript.

A panel that sends a turn of its own takes the reader's turn first with `takeTurnFromReply()`
from `stores/gameLoop.ts`, then sends with `submitAction`. It sends nothing itself: it brings the
scene to a decision point a turn can go out from, the way an interjection does. Lines still
being read are cut, the live scene call and any pending ending are dropped and the cut is written
as a decision point; over a reply's last line, that line is taken as turned; at a decision point
already, nothing changes. It returns `false` when none of these applies (the scene is busy, or
nothing is waiting on the reader), and then the panel sends nothing.

A hook point is added where mods actually meet, not ahead of need. Once mods use one, it stays
as it is: renaming it or changing what it passes breaks them. A change that is needed goes in
as a new hook beside the old one.

A field in the character editor (`editorField`) is `read`, `Field` and `write`. `read` takes
its value off her as the editor opens; `Field` is drawn under Generation settings, after the
appearance tags, handed `value`, `onChange`, `charId` and her `baseAppearance` as the form holds
it; `write` turns the value into what saving puts on her. Write only your own fields: the game's
own are written over whatever a mod returns, so a mod cannot change her name or her traits by
mistake. Save and the unsaved-changes check see it as they see the game's fields. A mod that is off draws no
field and writes nothing, so what it saved on her stays.

### Not covered yet

- Screens: a mod's menu entries, buttons on the rail and the landing, and editor fields, and its
  own panels beyond one over a scene (`scenePlay`), a page beside the feed (`updatesTab`), a
  preview on the Mods screen (`optionPreviews`) and the places on screen above.
- Main process: IPC, protocols, services, settings and character rules.
- Saves: a mod's own fields in a save. Carrying them into the next semester is covered below.

These are still direct edits, as before.

### Tests

`test/modHooks.test.ts`: only mods that are on are asked, in list order; likes fall back to the
game's own; a post a mod holds is not passed on; scene places and landed scene replies go to
the mods that are on. `test/modSlots.test.ts`: each place on screen draws the components of the
mods that are on and not those that are off, each in a boundary of its own that turns a throw
into nothing drawn.

The hook points are naudh1r's design, lifted from his Photo Feature branch, which is the first
mod on them.

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
- `integrate/<name>`: the mod merged with `main`, where conflicts with other mods are settled;
  its pull request goes into `main`.
- `main`: what players get, assembled from `core` and every mod branch.

## Not decided yet

- The build's version numbering (`BUILD.version` in `mods.ts`).
- Whether `data/mods.json` goes into the game's own backup; it does not today.
- How a mod that patches the built code, rather than the source, reads its switch.

## Scene and memory hooks

- `prompts.scene` adds context to cast and solo scenes, including continuations and closing requests.
- `requests.scene`, `requests.dm`, `requests.ledger` and `requests['slot-intro']` extend a completed request in mod-list order. Preserve the request and schema fields received from earlier mods. DM hooks run for normal and regenerated replies because both use the same builder.
- `slotSettled` receives the scene's starting state, the completed ledger and closing cast after bookkeeping, before clock advancement and the boundary save. It is synchronous so mod state is included in that save.
- `slotStatusLines` adds lines to the slot's closing report, after what each girl took away from it, written with `memoryStatusLine` as the game writes its own. It is handed `nextSlot`, the global slot about to begin, and every mod that is on is asked, in list order.
- `fileLatePost(post)` in `loop/feed.ts` files a post a mod wrote mid-slot, outside the slot's opening, the way the opening files its own: through `fileFeedPost`, so it can be held like any other. It leaves the slot's teaser and fill as they were drawn.
- `texts` on a ComfyUI job in `comfyService.ts` fills more prompt nodes by id, for a graph with more prompts than the positive, negative and detailer the job already fills.

These hooks add to the existing API; existing hooks and their arguments are unchanged. Screens, IPC and save fields still use direct integration as documented above.

- `bunnyboardPage` registers an independently gated tab with `id`, `word`, `Mark` and `Page`. Disabling its mod unmounts the page and returns the phone to Chats. Native tab IDs cannot be replaced. Other screen integration remains direct.
- `optionPreviews` draws a preview under an option group on the Mods screen, keyed by the group's id. The game hands it `optionId`, the option picked (or null), and draws it under the group's switches on the recessed ground. It is asked whether or not the mod is on, so a player sees it before switching the mod on.
- `updatesTab` puts a page beside the feed in the Updates tab, with `id`, `word`, `Page`, an optional `unread(game)` and an optional `Action`, drawn at the end of the titles' row while the page is showing. With one or more on, Updates draws a row of titles you press, its own first (the one showing drawn as the screen's title, the rest muted over a faded blob), and the game puts each `unread` on the far corner of its title's blob and sums them onto the Updates tile and the landing's Bunnyboard badge. The page is drawn under the title; it brings its own `vu-bb-scroll`. The feed's id, `feed`, cannot be replaced; leaving the tab, or the mod switching off, comes back to the feed.

### DM request history window

`buildTextingPrompt` accepts an optional `historyLimit` on its `TextingPromptState`.
This is a request-builder option, not a global hook or a saved preference: the caller that
owns a replay supplies it for that request. Ordinary texting still includes the newest 20
stored messages. A finite override is rounded down and clamped to 20–160; missing or
non-finite values use 20. The pending player message is added once after those messages,
so the maximum is 160 stored messages plus the pending text. This is a message count,
not a token or character budget, and does not change stored history or summary retention.

The supplied conversation is read without mutation. A caller rebuilding a rejected reply
must first supply a snapshot from **before** that reply, with its earlier summary (or null
when that summary is unavailable); this option does not identify or remove rejected turns.
The native lorebook scan reads the selected history, and `dmHistoryNote`, `prompts.dm` and
`requests.dm` still run normally. A larger window can increase request size and cost; use it
only when the earlier summary is unavailable. Model selection and request dispatch do not change.

The future texting kit can forward this option from `buildDmRequest`. Thread leases, safe
conversation replacement, mod activation checks and persistence remain the caller's
responsibility; this capability alone is not a complete regeneration or loader API.
See `test/dmHistoryWindow.test.ts` for bounded requests, replay snapshots and hook composition.

### Comments under posts

The game keeps a post's comments (`comments` on `SocialPost`, shaped as `PostComment` in
`shared/postComments.ts`) and moves them with the post through New Game+, but writes and draws
none of its own. A mod that does registers `postComments`: only one draws them at a time, the
first that is on in `MODS` order (`postCommentsOwner`), and a mod asks `ownsPostComments(id)`
before writing any, so two mods never both ask the slot's opening for them. Its `claims` marks the
comments only it writes; another mod drawing comments leaves those out, whether or not it is on.
A mod adds its own fields to `PostComment` by declaration merging. `PostCommentsView`,
`PostCommentAction` and `PostPicture` in `components/PostSpots.tsx` draw a post's spots in a
mod's own screens too.

### Emoji and sent text

The phone's composer stands the row of quick emoji under its field, and draws messages and
posts as their bare text. A mod that draws either itself registers `emojiTool`, `sentText` or
both: only one draws each, the first that is on in `MODS` order. `emojiTool` is a component the
game hands `dead` (the box is shut) and `onPick(emoji)`, which puts the emoji in at the caret;
with one on, it stands beside the field and the row of quick emoji goes. `sentText` is a `Text`
component, handed the `text` and `big` (off on a one-line preview), and an optional
`bare(text)` saying which messages stand with no bubble behind them. `EmojiTool`, `SentText`,
`useEmojiTool` and `useBareMessage` in `components/TextSpots.tsx` draw them in a mod's own
screens too, so a mod with a box of its own takes the same tool without importing the mod that
draws it. What is sent and saved is the text as typed either way.

### Optional semester carryover

A mod may augment `ModCarryFields` and register its own pure adapter with `registerTermCarry` in `shared/modCarry.ts`, imported by its entry in `shared/modEntries/`. The game's New Game+ calls them: Continue reads every registered field off the ending's save (`modFieldsLeaving` in `renderer/stores/semesterModCarry.ts`, with the outgoing semester's index, the days its dates move back, and the characters) and keeps it on the carry beside the game's own, and the next semester's opening save takes it back in through `carriedModFields`. These adapters retain saved data even with a switch off; they must not trigger generation. The registry itself requires neither Continuing Semesters nor any feature mod.

Fields a mod adds to a feed post that hold a time (the last slot it answered, say) are carried by the mod too: New Game+ moves each post's own date back onto the next semester's clock, and `registerPostCarry(modId, (post, days) => …)` in `shared/modCarry.ts` moves the mod's fields back the same `days` (a global slot moves twice that). Like the adapters, it runs with the switch off.

Files a mod keeps per playthrough outside the save (pictures, say) need nothing: New Game+ continues the same playthrough, so they stay where they are. `registerTermFiles(modId, async ({ from, to }) => …)` is kept for an extension that starts a new playthrough per semester, which calls `carryModFiles({ from, to })` once the new playthrough is written, before it is entered; the game itself never calls it. A copier runs with its mod's switch off too, and one that fails costs only its own files.

## Managed ComfyUI launch environment

Trusted main-process setup can register a synchronous provider with
`registerComfyLaunchEnvironment(modId, ({ root, platform }) => ({ KEY: value }))` from
`main/services/comfyLaunchEnvironment.ts`. `root` is the managed ComfyUI installation's
working directory. Return a plain string-valued object, or `null` to contribute nothing.
This is a main-process registry, not a renderer hook, IPC endpoint, or permission grant.

The service reads a frozen context immediately before each new managed process is spawned,
before opening its log. No providers means the existing inherited environment. Contributions
override inherited values only in the child; `process.env` is never changed by the registry.
Different keys combine, identical values coalesce, and different values for the same key
refuse that launch with both owners named. Windows names are compared without case, including
inherited aliases such as `Path`/`PATH`. Invalid names/values and provider exceptions fail the
launch with an owner-labelled error; diagnostics do not print environment values.

External servers and an already-running managed server are never changed or restarted by
this hook. A changed registration affects the **next managed boot**; a running server needs
an explicit stop/start. The normal start guard still shares one boot between callers.

Duplicate owner registrations fail. The returned disposer unregisters only its own entry and
is safe to call twice or after a replacement. The trusted host/mod entry owns registration,
availability and disposal; renderer switches are not implicitly read in main. An inactive
provider can return `null`. Installation-level configuration needed by installed custom nodes
may intentionally remain present while their gameplay effects are off. This PR supplies no
loader or activation policy: a future loader must enforce its reviewed-main-code policy and
wire that lifecycle before offering custom-source installation.

See `test/comfyLaunchEnvironment.test.ts` and `test/comfyLaunchProcess.test.ts` for composition,
Windows aliases, errors/disposal, and the real service's launch boundary with mocked processes.

## Shared gameplay extensions

- A mod keeps data with the scene being played by declaring optional fields on
  `ModSceneFields` in `shared/types.ts` by declaration merging, and reading and writing them on
  the game store's `sceneMods`, leaving other mods' fields as they are. They are saved as the
  scene's `mods`, restored with it and cleared when the next scene is cast, so they must be
  plain data.
- A slot activity is something a mod offers on the landing in place of a stat suggestion
  (`statActivities`), such as a game to train a stat with. Committing to one saves it with the
  scene as `activity`; the scene is cast as usual, held open while the activity is pending, and
  told to stage only the arrival (`COMMITTED SLOT ACTIVITY` in the system prompt). The mod opens
  its own surface and calls `finishSlotActivity(owner, id, completed, result)` once; the game
  saves the result, then sends a closing turn that ends the scene. Once the reply to that closing
  has landed the activity is closed and the scene runs as any other. A reload resumes a settled
  activity's closing rather than its play, and `slotActivityAvailable` is asked again at commit
  and on reload; one no longer available ends without being completed. The game pays nothing
  for an activity itself: a mod whose activity trains a stat says so in `exercisedStats`, and one
  that rewards it beyond that does so in `settleSceneStats`.
- `exercisedStats` changes what the hour exercised — the ledger's verdict on which stats the
  scene worked — before the game resolves what that pays, so every mod settling afterwards sees
  the exercise as the ledger. It runs for enabled mods in list order, each handed what the one
  before left. A mod changing the exercise belongs here, not in `settleSceneStats`: there it
  would run after another mod's bonus on the exercise it is about to change, and list order
  would decide the outcome.
- `settleSceneStats` changes the stats a finished scene settles, after the game has resolved
  them from the exercise. It runs for enabled mods in list order, each handed what the one before
  left, with the exercise as `exercisedStats` left it and the scene's facts. Both run for the
  projections before the ending too, so return fresh values and write nothing. `statFloor` gives the lowest a stat may
  fall to wherever the game applies stats; the first mod that answers decides, and the game's own
  floor stands where none does.
- `projectSlotMemories` transforms the projected character memories before the crush roll
  and next opening. It runs for enabled mods in list order. Return fresh values; do not write
  stores, award currency, consume an ability or roll randomness. Commit effects at
  `slotSettled` instead. With no active handler, the native projection passes through.
- `sharedModOn` in `shared/modRules.ts` uses the same live lookup as renderer hooks,
  without importing renderer stores. It defaults off before binding. A mod's renderer entry
  owns any mod-specific setup; framework stores should not import feature modules.
- Mods may add optional fields to `GameSave`, `CharMemory` and `ProjectSession` by
  TypeScript declaration merging in their own modules. Enrollment additions go on
  `ModEnrollmentFields`. Save/enrollment validation requires the native required keys;
  optional additions do not make older files invalid. Mods own normalization and carryover.
- The native `lorebook` Bunnyboard tab is reserved, like Chats and Friends.

## Character trait registration

`shared/traits.ts` owns the native trait vocabulary and an additive registry. Register from
the mod's shared entry before the first screen/request. The exact `value` is both the label
and permanent string in `character.json`; do not rename a shipped value without a migration.

```ts
const unregister = registerCharacterTrait(MY_MOD, {
  value: 'My stored trait',
  description: 'What this trait means',
  editor: true,          // default: offered by the editor when installed
  generated: false,     // default: AI must never assign it
  tone: 'my-mod-gold',   // optional data-tone token; the mod supplies its CSS
  hint: 'A short explanation for the player.'
})
```

This is one **registry** family, not a gameplay rule. Duplicate stored values, including a
native value, throw an error naming both owners rather than picking by load order. Metadata
is copied and frozen. Native traits keep their existing order; extensions sort by owner ID
then stored value. The returned disposer removes only that registration and is safe to call
twice; it does not change saved characters. The loader/diagnostic UI is separate work.

#### When the registry is read

| Consumer | Timing and policy |
| --- | --- |
| Character generator | `generatedCharacterTraits()` snapshots native traits plus explicitly `generated: true` traits whose owner is currently on. The writing pipeline takes one snapshot before building/queuing the request. Prompt text, schema and response parsing share it even if a mod is toggled or unregistered while generation is pending. A later registration can only affect the next request. |
| Editor | `traitOptions(form.traits)` reads at each render, not module import. Installed metadata is available with the mod switch off, independently of its gameplay effect. `editor: false` prevents new selections; an already-saved value still gets its chip metadata. `selectedTraitHints` supplies the selected explanations. |
| Character/contact chips | `traitTone` reads installed metadata when rendered. The contact page shows only known traits, behind its existing discovery conditions; a missing provider's tag stays saved but is not drawn there. The character editor/sheet can still show its raw saved name. Native editor chips keep their existing lack of tooltips; extensions use their explicit hint, falling back to their description. Core supplies `data-tone`, not a mod's visual design. |
| Character card export | `traitDescription` reads metadata while constructing the card; an unknown trait exports its raw name without an `undefined` description. |
| Scene/DM prompts | This registry does not automatically inject new instructions or enforce gameplay effects. Use the existing prompt hooks or a gameplay rule such as romance requirements. Native trait mechanics are unchanged. |

Registration is currently a boot operation, before requests/screens. Functions reflect later
registrations on their next call, but registration alone does not force a mounted React screen
to rerender. An eventual hot installer must remount/refresh affected screens; this PR does not
claim that loader lifecycle exists.

`CHARACTER_TRAITS` and `TRAIT_DESCRIPTIONS` remain **native-only** constants for compatibility;
new consumers must use the registry readers above. `isCharacterTrait` means "currently known",
not "allowed from AI" and not "safe to retain on disk". Generation uses its explicit snapshot.
Saved `CharacterTrait` strings are open, and load/import/export preserve unknown values.
`editedCharacterTraits` permits offered additions while retaining existing unknown/hidden tags;
only an explicit player removal drops one. A missing mod never rewrites the card.

See `test/characterTraits.test.ts` for generator/editor separation, import-before-registration,
pending-request snapshots, duplicate owners, deterministic order, metadata disposal, UI tone
and hints, and read/edit/export with a missing provider. No particular mod trait ships in core.
