# Story Assistant

Story Assistant is an independent `anytime` switch in Mods (`story-assistant`), off by default.
It needs no other mod, and it is built on the kit: it edits no file of the game's.

## Playing

On the reader's turn in a cast scene — at the action box, or over a finished reply's last line
where the row there lets a turn through — the assistant reads the scene, and its ways forward
stand over the dialogue box as a visual novel's menu: pressing one sends it as the reader's
turn, exactly as typing it into the action box would. The action box stays open beneath for a
turn of the player's own. While a read is on its way one line where the menu will stand says
so; a read that fails says why there, with **Retry**, and is never sent again on its own. What
the assistant makes of the scene is shown in the panel alone.

None of it is offered where there is no cast scene to talk about: a solo scene, an exam, a
replay, a created scene, the orientation, the graduation epilogue, and a scene once it has
reached its ending. It stands down while a panel, a modal or a failure is over the scene, behind
a crossing and while the interface is hidden.

The rail carries a speech-bubble seat too, live on the reader's turn and dim while a reply is
still arriving or being read. It opens a panel that shows the same read: **Ask about the scene**
takes a question in place of the general read, **Ask** sends it, **Read again** asks for a fresh
read. Picking a way forward there copies its words into **Your turn**, where the player can
change them before **Send**. Whatever the panel last read — a question's answer included —
offers its ways forward in the menu once it closes.

There is one read per point of the scene. Any change to the scene — a new line, a rewind's cut, a
rewritten line, a load — retires it and cancels one still on its way; a copy of the same lines is
the same point. The pop-up asks only on a scene with lines on it, and reads the store afresh as
it does, so a point is never asked twice. Reads live in the mod's `modState`, which a game
entered or left starts over: nothing is written to a save, and switching the mod off leaves
nothing behind.

## Options

- **Pop up every turn**, on by default: the scene is read of its own accord at every decision
  point, one call each. Off, nothing is read until the panel is opened.
- **Choices per turn**: **Exactly four** (the default) asks for four ways forward and holds the
  reply to four; **As many as fit** lets the model offer one to four.

## The prompt

The mod's page on the Mods screen, drawn while the mod is on, carries both options and the
prompt every read is written from: who the assistant is and what its two fields hold. It is kept
as the box is left, and **Reset to default** puts the shipped one back; a prompt saved blank, or
identical to the shipped one, is kept as absent. The app adds two lines after it whatever it
says: how many ways forward to offer, from the option, and, under `lessNsfwText`, a line keeping
the read short of explicit sex. The JSON schema still holds the reply to its two fields.

It is kept on this computer in the window's own storage, under `vu-story-assistant:prompt`, on
both builds, as Emoji Extended keeps its preferences. It is not in a save or in the game's
backup. Storage that cannot be read leaves the shipped prompt standing; one that cannot be
written leaves the player's text in the box with the reason under it.

## What the assistant is told

The request is built by `buildStoryAssistantPrompt` from what the player has been shown and
nothing else:

- the playthrough's setting and the `READER` block;
- the reader's Brain, Body and Heart as points with their ranks, and that 100 is a soft limit:
  a stat climbs past it, but its rank and wording stay at Godly;
- the date and half of the day;
- the four newest finished slots' summaries, and up to four older ones that name a girl in the
  scene by the name the reader knows her by;
- each girl still in the scene: her contact page's tag, the milestones the player has watched
  happen (dating, kissed, slept together, breakups, friendzones, her number, a block), and —
  once she has given him her number — what her contact page has open: likes and dislikes, her
  type, backstory and love life on the page's own thresholds, read through `dispositionOf`, and
  her memories under the cast-scene memory budget; her told secrets, the player's notes and the
  plans ahead with her;
- the running summary and the transcript's tail, exactly as a continuation call reads them.

It is never told an untold secret, a crush, her personality or behaviour lines, her haunts,
affection as a number or the balance. A girl whose name the reader has not learned is listed by
a label alone, and every spelling of her first, last and whole name anywhere in the request is
replaced by that label, sparing a name a named girl of the cast also answers to. A girl who has
left the scene is not listed, but her lines are still in its tail, so her name is masked the same
way and she is numbered after the girls still there.

A read is taken only at a decision point, and there every delivered line has been read, so the
running summary covers nothing the player has not seen.

## Cost and failures

Each read is one structured call through the kit's `completeStructured`, under a cancel group of
its own, on the main writer model at the player's own effort; it is not routed to the secondary
model and no preset is applied. With **Pop up every turn** on that is one call per turn of every
cast scene. Asking again, the scene moving on and leaving the game cancel the call in flight
(`cancelCalls`); closing the panel does not, so a read asked for there still lands in the menu.
The reply is sanitized in the renderer (`storyAssistantReplyOf`): blank and repeated ways forward
are dropped and at most four kept.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/modEntries/story-assistant.ts` | The switch and its options |
| `src/shared/storyAssistant.ts` | The id, option ids, limits, the reply's shape and its cleaning, the prompt's cleaning |
| `src/renderer/prompts/storyAssistantPrompt.ts` | The shipped prompt, the pure request builder and the name masking |
| `src/renderer/stores/storyAssistant.ts` | The seat's gate, the kept prompt, the read's state, the context read off the game, and the call |
| `src/renderer/views/StoryAssistantStage.tsx` | The menu over the stage, its waiting and failure line, and the pop-up's own ask |
| `src/renderer/views/StoryAssistantPanel.tsx` | The rail seat, the panel and the mark |
| `src/renderer/views/StoryAssistantPage.tsx` | The mod's page on the Mods screen |
| `src/renderer/vu_styles/StoryAssistant.css` | All three surfaces' layout |
| `src/renderer/modEntries/story-assistant.ts` | Registers `scenePlay`, `stageLayer` and `modDetail`, each screen loaded when it is first drawn |

The kit has no reader yet for the scene being played, so the store reads the game store and the
helpers a continuation's prompt is built from (the transcript stubs, her memory, secret and notes
lines, the plans ahead, the setting, the `READER` block, the budgets), and the panel and the menu
take `spin` and `dealtItem` from the game's motion. Those imports are the mod's lines in
`test/kit/boundaryAllowlist.json`; everything else comes from the kit.

## How it looks

Over the stage, one column stands between the dialogue box's own insets and ends clear of the
speaker label over the box, so neither the box nor who is talking is covered; the column takes no
pointer, only what is in it does. The choices are answers, so they take the action shape, flat on
the left, on the surface face with the paper shadow; each holds its few words over the turn it
sends, and the menu deals them in one after another. The waiting or failure line is a full pill
on the same face, muted and italic, with its Retry a `.vu-pill`.

The panel is the shared `.vu-sheet` under a title tab, its foot Back, Ask or Read again, then
Send. The question and the turn are ordinary fields; the read is body text at reading size;
each way forward is a quiet `.vu-row` with its few words over the turn it would send. Only the
body scrolls, padded for a hovered row's lift.

The Mods page draws the options as the Mods screen draws any mod's, then the prompt's heading
with **Reset to default** at the end of its row while the prompt is the player's own, and the
prompt in a multiline field.
