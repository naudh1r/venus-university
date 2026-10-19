# Mini-games: writing a game pack


A game pack is a mod that brings one or more mini-games: something the reader plays inside a
scene, alone or with the girls who are there. The framework is a mod of its own (`mini-games`),
and every pack requires it. The model writes the scene around a game and one-line remarks during
it; the game itself is played by the pack's code, for real.

High-Low is the worked example throughout. The other packs show what it does not: Air Hockey a
table in real time, Bowling and Blackjack several girls at once, Bowling and PARADISO the
keyboard.

## Who does what

| The framework | The game |
| --- | --- |
| Whether the game is on offer in this scene, and the dice seat on the rail | Its rules |
| Asking her, her yes or no, and a game agreed in the scene's own lines | Everything drawn on the surface |
| The stake, and the options as settled | What its options mean |
| Her skill at the game, judged once and kept | Her moves, from that skill |
| The surface, and where it hangs so it covers nobody playing | What is narrated, and the moments she speaks |
| The dialogue box and its pacing | How often she speaks at each chattiness |
| The reader's line to the table, and her answer to it | How the game stands, in a sentence (`situation`) |
| **Not now** and **Walk away** | The result: outcome, summary, account |
| Taking the result into the scene | |
| The player's options: how much she talks, and girls suggesting games often | |

A pack touches none of the left column and edits no file of the framework or the game.

## The files a pack adds

A pack is one mod and any number of games. For the game `high-low`, in the pack
`morrowkiln-card-games`:

| File | What it is |
| --- | --- |
| `src/shared/modEntries/morrowkiln-card-games.ts` | The pack's entry on the Mods screen, named for the mod's id, as any mod's. One per pack. |
| `src/renderer/modEntries/morrowkiln-card-games.ts` | Named for the mod's id: hands the framework each game's component. One per pack. |
| `src/shared/minigameEntries/high-low.ts` | The game on paper, named for the game's id: its `MiniGameDef`, default export. Its `modId` is the pack's id. |
| `src/shared/minigameRules/highLow.ts` | The rules, pure: no React, no stores, nothing from the renderer. |
| `src/renderer/minigames/games/HighLow.tsx` | The component the game is played with. |
| `src/renderer/vu_styles/HighLow.css` | What it looks like, imported by the component. |
| `test/highLow.test.ts` | Tests of the rules file. |

All three folders of entries are read by glob (`MODS` in `src/shared/mods.ts`, `MINI_GAMES_LIST`
in `src/shared/minigames.ts`, `src/renderer/mods/index.ts`), so nothing is registered by hand and
two packs never edit the same line. The framework itself brings no game: a build with the
framework and somebody else's pack, and none of these, is a whole one.

The pack's entry is made by `packMod`, which requires the framework and gives every game a
switch of its own among the mod's options, on until the player turns it off:

```ts
import { packMod } from '../minigameKit'
import HIGH_LOW from '../minigameEntries/high-low'
import BLACKJACK from '../minigameEntries/blackjack'

export default packMod({
  id: 'morrowkiln-card-games',
  name: '[MK] Card Games',
  author: 'morrowkiln',
  version: '0.1.0',
  blurb: 'Cards on the table: quick ones for anywhere, and longer ones for an evening in.',
  games: [HIGH_LOW, BLACKJACK]
})
```

Its `scope` is `anytime`: no save depends on a game. With the framework off the pack is off too.
Name a pack for who made it and what is in it, so two people's card games sit side by side.

The renderer's entry is the whole of the registration, a line per game:

```ts
import HIGH_LOW from '@shared/minigameEntries/high-low'
import { HighLow } from '../minigames/games/HighLow'
import { registerGame } from '../minigames/kit'

registerGame(HIGH_LOW.id, HighLow)
```

A game with no registered component is never offered. A pack of several games has one file in
`minigameEntries/` per game, all with the pack's `modId`, and one `registerGame` each.

## The kit: the only things a pack imports

A pack is self-contained. Beyond its own files it imports React, `motion/react`, and the two kits
the framework offers, and nothing else of the game: no store, no view, no other pack. The game can
then change underneath without a pack noticing, and anyone's pack sits beside anyone else's.
`test/minigamePacks.test.ts` fails a pack that reaches past them. If a game needs something the
kits do not have, the thing to do is add it to the kit, for every pack.

| Kit | For | What is in it |
| --- | --- | --- |
| `@shared/minigameKit` | Games on paper, the pack's entry, the rules | `MiniGameDef` and its types, `packMod`, `listed`, `fewestWith`, `SkillLevel`; playing cards (`Card`, `Suit`, `freshDeck`, `rankMark`, `rankWord`); `seededRand`, `shuffle`, `pick` |
| `src/renderer/minigames/kit` | The component and the entry that registers it | `GamePlay` and its types, `registerGame`; the game's own controls (`gestures`, `lift`, `press`, `quietLift`, `quietPress`, `toggleLift`, `TextField`, `BunnyMark`); `useWindowKeydown` and `typingIn`; and the helpers below |

| Helper | What it saves writing |
| --- | --- |
| `useOnTable()` | Asks whether the table is still up, for a timer or a promise that comes back late. |
| `useAway()` | True while the window has lost focus or the page is hidden: a game on a clock stops it. |
| `sayCapped(play, charId, cue, capMs)` | Her line, waited on no longer than the cap, never rejecting. |
| `remarkBudget(chattiness, caps)` | The table's remarks for the game, counted down. |
| `pointIn(svg, event)` | A pointer in an SVG's own units, read through the surface's tilt. |
| `useReducedMotion()` | True where the player has asked for less motion. |

A pack's styles use the game's design system directly, as `UI_STYLE_GUIDE.md` gives it: the
theme-role variables (`--vu-accent`, `--vu-text`, `--vu-text-muted`, `--vu-text-body`,
`--vu-border`, `--vu-surface`, `--vu-recessed`, `--vu-tint`, `--vu-accent-ink`,
`--vu-accent-shadow`, `--vu-good`, `--vu-warn`, `--vu-danger`, and the fonts `--font-display`,
`--font-body`, `--font-mono`) and the shared classes (`vu-btn`, `vu-pill`, `vu-paper`,
`vu-empty`). A pack's own classes and variables carry its own prefix (`vu-highlow-…`).

## The game on paper

`MiniGameDef`, in `src/shared/minigames.ts`:

| Field | What it is |
| --- | --- |
| `id` | Lower case with dashes. Her skill is kept under it and the model answers with it: it never changes once shipped. |
| `modId` | The mod that brings the game. The game is offered only while that mod is on. |
| `name` | On the surface, on the dice seat, in the list, and what the model calls the game. |
| `icon` | One glyph, in the list. |
| `blurb` | What the game is, in a line. Told to the model wherever the game is named, the judging of her skill included. Lower case, no full stop: it is set into sentences (`High-Low (id "high-low"): <blurb>.`). |
| `locations` | The location ids it is played at; absent, anywhere. |
| `players` | `{ min, max }`: how many girls play against the reader. |
| `format` | How a game goes, as the table really runs it. Told to the model as what she can agree to. |
| `options` | What may be settled before it starts; absent, the game is played the one way. |
| `suggest`, `suggestAt` | How readily a girl brings it up herself, and the same at particular places. |
| `calledAs` | Other words the player might call it by ("cards", "race"), beyond its `name`. |
| `surface` | `table` (the default), `board` or `screen`. |
| `keys` | `true` for a game played on the keyboard. |
| `skillBrief` | What makes someone good at it, in a sentence. |
| `options[].label`, `options[].values` | An option's name on the game's page, and what its values are called where a number alone says nothing (`{ 1: '100 m', 2: '400 m' }`). The page lists them under "Ways to play". |
| `stepped` | For a game played in turns: whether its text usually waits for the reader to move on (`true`) or keeps its own pace (`false`). The player can have it the other way on the game's page. Such a game reads `play.stepped` and, while it is set, awaits each `narrate` before its next move and drops its own pauses for reading. A game against a clock leaves it unset. |
| `playByPlay` | Whether `narrate` puts the game's moves in the dialogue box. Off where unset: the reader sees every move on the table, so the box keeps to what people say and a girl's line stays there while the game goes on, and `narrate` only gives a short beat. Anything the reader must notice (whose turn, her decision, a result, a reshuffle) has to be on the game's own surface. `true` for a game whose text is the game itself (Truth or Dare). The player can have it the other way on the game's page; the game reads `play.playByPlay`. |
| `controls` | How it is played, for the player: the keys or the pointer, in a sentence. Shown on the game's page. |

The framework draws a pack's page on the Mods screen from these: the pack's games, each with its
switch, and a page for each game saying what it is, with whom and where it is played and its
`controls`, where the player sets the value each option starts from and how readily a girl
suggests it. A pack writes no screen of its own for any of that.

**What the model is told, and why the wording matters.** On every turn the reader takes with a
girl where she may suggest the game, the model is given `name`, `blurb`, `format`, each option and
how readily she suggests it. It is also told that this is the whole of what the table can do, and
that she steers back to it or says no when asked for anything else. So `format` has to say exactly
what the component does: who goes first, how it is scored, how it ends, whether there can be a
draw. A rule the component does not play is a promise the scene will make and the table will
break; a rule left out is one she cannot explain. High-Low's:

```ts
format:
  'One deck. A card is face up; the player whose turn it is calls whether the next card will be higher or lower, the card is turned, and a right call scores. The two take turns, the reader first, each making the same number of calls, and the better count wins; level counts are a draw. […] Twos are low, aces high, and the same rank again is a miss.',
```

**Options.** Each is a whole number in a range: `{ id, describe, min, max, default }`. A choice of
two is `min: 0, max: 1`. `describe` is a clause the model reads as
`Option "calls": <describe>. From 1 to 5; 5 is the standard game.`, and it is told to keep the
default unless another value was named out loud. Write `describe` so that what people would
actually say maps onto it: High-Low's `sudden` says it is "how a tiebreak or a death match is
played". The component is handed every option it declares (`play.options`), already a whole
number inside its range; anything else that came back is the default. A game played alone always
gets the defaults. An option id that two games share is asked for once, at the widest of their
ranges, so give an id one meaning.

**Locations** are ids, as `src/shared/locations.ts` has them, and may be ids another mod adds:
Air Hockey and Bowling name City Life's `bowling_alley`. Naming a place a playthrough does not
have is harmless: nobody is ever stood there, so the game is not on offer.

**Players.** A game is on offer when at least `min` girls are in the scene. The dice seat then
lists, for each game:

- "ask *her* to play", once for each girl here, where `max` is 1 or more and `min` is 0 or 1;
- one row for each full table of two or more: everyone here where `max` allows, otherwise each
  way of filling `max` seats (`groupsFor`);
- "play alone", where `min` is 0.

So `{ min: 0, max: 1 }` is alone or with one girl, `{ min: 1, max: 1 }` needs her,
`{ min: 1, max: 3 }` is one girl or everyone up to three, and `max: 0` is a game nobody joins,
which the model is never told about. Where the only thing on offer is one game alone, the seat
opens straight on it.

**Suggesting.** `suggest` is `often`, `sometimes` (the default), `rarely` or `never`;
`suggestAt` gives a rate by location id and wins at that place (`suggestRate`). The framework
overrides both: in a class, on a shift or on a project nobody suggests a game, and with the
player's "Girls suggest games often" on, every game is `often` wherever else it can be played.
A game that comes out `never` at a place is left out of what the model is told there
(`gamesSuggested`), which keeps every turn's request short; the girls cannot bring it up and the
scene cannot agree to it on its own, unless the player's action that turn names it: by its
`name` or a word in `calledAs`, as whole words, a plural included (`gamesNamed`). Then that game
is added to that turn's request, so "want to play poker?" typed at the arcade still opens the
table when she says yes. None of it limits the reader, who may also ask for any game on offer
from the table: his proposal is its own turn and tells the model about that game.

So name the places a game belongs and leave it `never` everywhere else it can be played:

```ts
suggest: 'never',
suggestAt: { cutetea: 'sometimes', lowrise_dorms: 'sometimes', room: 'sometimes' },
```

**Surface.** The scene stays lit behind all three, and the dialogue box stays the scene's.

| Surface | Size (`MiniGames.css`) | For |
| --- | --- | --- |
| `table` | As wide as what is drawn, 380px at least; hung beside or between the girls. | Cards, a board, a few buttons. |
| `board` | `min(1100px, 100% - 240px)` wide, 560px high at least. | A lane, a table seen from above. |
| `screen` | The stage less 30px all round. | A game that is all action. |

**Keys.** With a girl at the table the reader has a text field to speak to her, and it takes the
focus when the table opens. `keys: true` leaves the focus alone, so the first key pressed plays.

## The component

The component is `({ play }: { play: GamePlay })`, from the kit (`src/renderer/minigames/kit`). The
framework draws the surface, the game's name over it and the way out under it; the component
draws what is between.

| Member | What it is, and when to use it |
| --- | --- |
| `opponents` | The girls playing, in the order they sit: `{ charId, name, skill, style }`. Empty for a game alone. `name` is what the reader calls her, and is `her` until he knows her name. |
| `stake` | What is riding on it, as the scene settled it, in a sentence; empty where nothing is. |
| `chattiness` | `quiet`, `some` or `lots`, as the player has it set. |
| `options` | Every option the game declares, by id. |
| `started()` | The first move is made. From here the way out reads **Walk away**. |
| `narrate(text)` | A line of narration in the dialogue box, in the game's words, at once and free. |
| `say(charId, cue)` | A model call. She says one short line about `cue`. |
| `speak(charId, text)` | Puts words the game already has on the box as hers. No model call. |
| `readerSays(text)` | Puts words on the scene as the reader's own, as part of the game. Nobody answers. |
| `round(ask)` | A model call. One round no code can play; see below. |
| `situation(text)` | How the game stands now. Free; call it whenever it changes. |
| `ask(placeholder)` / `stopAsking()` | Has the reader type something in the scene's own line under the dialogue box, the one place he types; resolves with his words, or null if the asking ended first. A game played in words sets `typed: true` in its def, which makes that line the game's alone. Free. |
| `progress(account)` | What the scene should know of the game so far, were the reader to walk away now: account lines, said again whenever there is more. Free. A game whose point is what was said in it (Truth or Dare) calls it each turn. |
| `finish(result)` | The game is over. |

The rules that matter:

- **The first move starts the game.** Until then the way out is **Not now**, the table closes
  without a word and the reply being read is left as it was. The first `started`, `narrate`,
  `say`, `speak`, `readerSays` or `round` takes the reader's turn: whatever of the reply was
  unread is dropped, and leaving is walking away. A game agreed with a girl is under way as the
  table opens, and says so at once; alone, High-Low says nothing until the first call. A game
  whose first move narrates nothing calls `started()` itself, as Bowling does when the first
  sweep is stopped.

  ```ts
  useEffect(() => {
    if (her) play.narrate(`${her.name} cuts the deck and turns the top card: ${rankWord(deck[0].rank)}. …`)
    // Once, as the table opens.
  }, [])
  ```

- **Narration is paced for you.** Each line holds the box for as long as it takes to type out
  and be read, and the next waits behind it, so `narrate` can be called as fast as the game
  moves. Keep a line to one move: `You call higher. A nine: right.`
- **`say` costs a model call and a moment.** The model is given her character, the last of the
  scene, the `situation` and the `cue`, and writes at most 20 words; it is told she does not
  explain the rules or read out the score. The cue is a plain account of what just happened, with
  the reader as "the reader": `Ana called lower on a queen and an ace came: a miss, a safe call
  that failed: plain bad luck.` The promise resolves once her line has had its time on the box,
  or at once where there will be none (the call failed or took over six seconds). Hold her next
  move on it if you like, as High-Low does; a game on a clock puts its own limit on the wait, as
  Air Hockey does, and a game that cannot stop does not wait at all.
- **Respect `chattiness`.** What each level comes to is the game's call. The shipped packs keep a
  count and a cap, `{ quiet: 0, some: 3, lots: 8 }` in High-Low, speak only at moments worth it
  (a call out of the ordinary, the lead changing hands) and let `lots` remark on ordinary ones
  too. At `quiet` the game never calls `say`.
- **Never on the last move.** The scene's own reply answers the result; a remark there is said
  twice.
- **One remark per moment.** With several girls one of them speaks, not each, and the cap is for
  the table. Bowling and Blackjack also count per girl so the word goes round.
- **Keep `situation` current.** It is what she is reminded of whenever she speaks, the reader's
  own remarks included, and what a `round` is told. High-Low sets it after every render: the game
  and its terms, the count, the card showing, whose call it is, the stake.
- **Call `finish` exactly once**, and nothing after it. The component keeps showing how it ended;
  the framework disables the way out, waits for the box to finish and a beat more, clears the
  table and takes the result into the scene.
- **The table can close at any moment**: Walk away, the scene moving on, the mod switched off.
  Clear every timer, animation frame and listener on unmount, and set no state after it. A loop
  that outlives a render reads `play` through a ref (`latest.current = play`), as Air Hockey does.
- **Development runs under StrictMode**, which mounts a component, takes it down and mounts it
  again. Whatever is set up in an effect has to be undone by its cleanup, and whatever must happen
  once (the opening `narrate`, a `finish`) wants a ref that says it has. Cut the deck in a
  `useState` initializer and keep it pure.
- **A key handler ignores typing.** The reader's field to the table is on screen through the
  game. A listener on `window` returns early when the event's target is an `INPUT`, a `TEXTAREA`,
  a `BUTTON` or `isContentEditable`, as Bowling's does.
- **The reader's line to the table is not yours.** The framework shows the field wherever there
  is an opponent, has the girl he names answer (or each in turn), and does not hold the game for
  it. There is nothing to handle.

## Her skill

Each opponent has a `skill` from 1 (hopeless) to 5 (hard to beat) and a `style` of a few words.
The model judges both once, from who she is, the `blurb` and the `skillBrief`, and they are kept
for the playthrough, so she plays the same way next time. Where nothing could be judged she is a
3 with an empty style. Most girls are a 2 or a 3. `skillBrief` says what a good player does and
what a poor one does:

```ts
skillBrief:
  'A good player keeps track of the cards already turned and calls with the odds; a poor one goes on hunches.'
```

What the number means is the game's. Put it in the rules file, as a pure function of the
position and her skill, with the random source passed in so a test can fix it:

```ts
/** The edge under which she stops reading the cards and goes on a hunch, by skill. */
const HUNCH_UNDER: Record<Skill, number> = { 1: 0.5, 2: 0.35, 3: 0.2, 4: 0.1, 5: 0 }

export function herCall(shown: Card, seen: readonly Card[], skill: Skill, rand: () => number = Math.random): Call {
  const { call, edge } = oddsCall(shown, seen)
  if (edge > HUNCH_UNDER[skill]) return call
  return rand() < 0.5 ? 'higher' : 'lower'
}
```

Skill should change the decisions a person would get wrong, not add noise to all of them: every
girl calls lower on a king. A real-time game does the same with reach, reaction and aim. `style`
is not used by the framework after it is judged; a game may put it in a cue or the account.

## Several girls

With `players.max` above 1, `opponents` holds everyone who is in, in seat order; the reader plays
first by convention and `format` says so. `say` takes the `charId` of the one who speaks, and she
is told who else is playing. The outcome is the reader's: `won` only if he alone is on top,
`draw` if he shares it, `lost` otherwise. Name everyone in the opening line, the summary and the
account (`listed` in `src/shared/minigames.ts` writes "Ana, Bea and Cy"). The same component
plays one girl and three: write it for `opponents.length`, not for `opponents[0]`.

## Rounds the model runs

Most games need none of this. A game of questions, dares or judging has rounds no code can play,
and asks the model for one:

```ts
const got = await play.round({
  brief: 'Ana asks the reader one question he must answer truthfully. "question" is what she asks.',
  fields: { question: 'text', mood: ['teasing', 'serious'] }
})
```

`brief` is the rule for this round, what has just happened and what each field is for; who is at
the table, the scene so far, the `situation` and the stake are added. Each field comes back as a
line of text or as one of the choices listed. It takes a few seconds, 25 at most, and comes back
`null` where the model could not be had or any field was not what was asked for: the game must
have something to carry on with, a stock question or a pick of its own. Nothing a round returns
is on the scene until the game puts it there: `speak(charId, got.question)` for her words,
`readerSays(text)` for what the reader types into the game's own field. No shipped pack uses
these three yet.

## The result

```ts
play.finish({
  outcome: a > b ? 'won' : a < b ? 'lost' : 'draw',
  summary: versusSummary(her.name, a, b),
  account: versusAccount(her.name, deck, all, sudden)
})
```

- **`outcome`** is `won`, `lost` or `draw` from the reader's side, or `played` for a game with
  nobody to beat. `abandoned` is the framework's own. The scene does not read the outcome: who
  won reaches the model only through the summary and the account, so both have to say it.
- **`summary`** is a sentence or two of the scene's narration, in the second person: `You play
  High-Low with Ana and win, 4 calls to 2.` After a game with a girl it is sent as the reader's
  turn, and her reaction is the reply. After a game alone it is a line of narration on the box.
- **`account`** is for the scene's writer and is never shown to the reader: one line each, the
  reader as "the reader". It rides hidden with the turn that carries the summary, with the stake
  added by the framework ("It is owed now"), so leave the stake out. After a game alone it rides
  with the reader's next turn, for whoever was there to have watched.

A good account lets her react to how it went, not just to the score. Say the terms in a line,
the moves worth a remark, and tell play from luck: High-Low marks "a long shot that came in", "a
safe call that failed: plain bad luck" and "a bad call: the cards clearly favoured lower", then
closes with `Ana called against the odds 2 times: poor play, not bad luck.` and the final count.
Keep it compact: a long game is summed up, not replayed.

When the table clears, the game's move-by-move narration is taken back off the scene's
transcript, since every later request quotes it; what was said across the table stays, and the
reader still has all of it in the chat log. What the scene keeps of the game is the result.

Walking away needs nothing from the game. The framework files `You walk away from the game of
High-Low with Ana before it is over.`, tells the model nobody won, and leaves what that means
for the stake to the two of them. The component is simply unmounted.

## Style

- Colours come from the theme's roles only: `--vu-surface`, `--vu-text`, `--vu-text-body`,
  `--vu-text-muted`, `--vu-border`, `--vu-accent`, `--vu-accent-ink`, `--vu-accent-shadow`. No
  colour is written out, so the game is right by day and by night. Faces are `--font-display`,
  `--font-body` and `--font-mono`.
- Every class is the game's own: `vu-highlow`, `vu-highlow-card`. Buttons are `base.css`'s
  (`vu-btn vu-btn--outline vu-paper vu-btn--panel`), with the gestures from the kit.
- Size it for its surface on a stage laid out 1080px high. The surface hangs 150px from the top
  and the dialogue box is below it. High-Low's whole table is two 124 by 172 cards, a line of
  count and two buttons.
- Keep what cannot be used in its place, dimmed, so the surface does not jump: High-Low's calls
  are `inert` on her turn.
- No assets are needed. The shipped games are drawn in CSS, glyphs and inline SVG.
- Anything on screen follows `UI_STYLE_GUIDE.md`.

## Checklist

- [ ] The files named as above; `modId` is the mod's `id`; the mod `requires: [MINI_GAMES]`.
- [ ] `format` and every `describe` say what the component does, and nothing it does not.
- [ ] `players` fits what the component can seat, alone included if `min` is 0.
- [ ] Every option is read from `play.options`, and every value in its range plays.
- [ ] The first move calls `narrate` or `started()`; `finish` is called once.
- [ ] `situation` is current whenever she might speak.
- [ ] Remarks: none at `quiet`, capped otherwise, none on the last move, one voice a moment.
- [ ] Walking away mid-move, mid-remark and mid-animation leaves nothing running.
- [ ] Nothing is said or dealt twice in development.
- [ ] Keys do nothing while the reader types to her.
- [ ] The summary reads as narration to "you" and says who won; the account tells play from luck.
- [ ] Played in the day and the night theme, with one girl, with the most it seats, and alone.

## Testing a pack

`npm run typecheck` and `npm test` must pass. What is worth a test is the rules file, which is
why it is pure: what wins, how a game ends, and that her play follows her skill, with the random
source fixed.

```ts
const never = (): number => {
  throw new Error('guessed')
}
// A king is lower for anyone, with no guess taken.
expect(herCall(king, [king], 1, never)).toBe('lower')
expect(herCall(eight, seen, 1, () => 0.9)).toBe('lower')
```

`npx vitest run test/highLow.test.ts` runs one file. No tests for wording: the summary, the
account and the cues are read in the running app, as is everything the component does. The
quickest way to a table is a game with `min: 0`, which opens from the dice seat with nobody
asked.
