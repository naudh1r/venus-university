# Bunnyfeeds

Comment on your contacts' posts, and they answer you. It needs no other mod: posts with a picture
on them, from any mod that puts one there, get threads like any other post.

## Playing

- Turn on **Bunnyfeeds** in Mods. Other mods can be on or off around it: threads carry on.
- In the feed a post shows one comment (yours if you left one, otherwise the newest), its reply
  count, **View all N comments**, and a speech-bubble pill with the count beside the heart.
- The pill or **View all** opens the post in a popup over the whole screen, like a photo: the
  post, its photo, every comment with replies folded behind **View N replies** (yours open), and a
  box at the foot for commenting on the post. You comment on a post once; after that you carry on
  through Reply, as often as you like. **Reply** shows when you hover a comment, any comment in
  the thread; it opens a box under that thread addressed to its author (`@handle`, tagged if she
  is a contact), so a conversation can carry on there. ✕, Escape or a click outside closes it.
- Type `@` to tag one of your contacts. A list of them opens under the box and narrows as you type;
  arrows and Enter or Tab pick one. A tag counts only while its `@handle` is still in what you send.
- What you write shows at once. Closing the post view, or the phone, sends everything you wrote
  since as one call, in the background. The answers are stamped for the next slot, so they are
  waiting when it opens.
- A post only grows while you are in its thread. Once she has answered you and you stop
  replying, nothing new is written under it and it costs nothing.
- The poster always answers your comments. Anybody you tagged answers too. Her friends and other
  students may join in, one or two at most each time: answering you, each other or her, or
  leaving a comment of their own on the post.
- She also answers up to three other people's comments under a post you are active on.
- Each comment shows its writer's handle on its own line, and a reply opens with whom it answers
  ("@handle"), drawn like the handle above it. You have no handle, so you show as @ and your
  first name.
- After about six of your comments under one post, the thread winds down: she keeps her answers
  short and starts wrapping it up, and only girls you tag still join in. You can keep replying.
- Posts arrive with replies from strangers and from a few roster girls in their own voices: the
  poster's friends, or two random girls when she has none.
- Commenting is closed during a scene, exactly when texting is: the post view's box says so, and
  Reply is hidden. Reading stays open.
- Strangers' posts, and the slot's random student post, take no comments.
- Threads carry through New Game+: what she still owes you and what she has yet to remember move
  onto the next semester with her post, comments and all.
- She keeps one memory of your comments among her own, arriving with her answers, the newest
  replacing the last, as her texting memory does. It shows in her Memories ("…, on her post"), can
  be edited there, counts in her affection like any memory, and every scene, text and slot opening
  can bring it up. The closing before her answers show announces it, as it does any memory;
  switch off "Announce feed memories" in the Mods screen to keep it quiet.
- A roster girl who has met you and answers you under somebody else's post keeps the same kind of
  memory ending "…, under <name>'s post", so she can bring it up in her own texts and scenes.
  It comes out of the same call and replaces her last feed memory, whether she posted or commented.
- Talking about her post or your comment in her DMs is not filed as something said over text:
  the texting bookkeeping is told that comments belong to the feed.
- In her texts and in scenes with her, she sees her two newest posts, with what you commented
  under them and what she answered, so she knows what she posted and what you said there.
- When she answers you she knows her profile, how she stands with you, her latest memories of
  you and what she made of your last comments. A friend or tagged contact who has met you also
  knows how she stands with you and the last thing she remembers of you.
- Comments are public. Nobody agrees to meet, to a date, a time or a place in them; a girl who is
  keen keeps it open or tells you to message her. Nothing private or explicit is said there.

## What it costs

Bunnyfeeds makes **one extra AI call** of its own, to your usual model, on top of the game's calls.

- Opening and closing the phone without commenting makes no call.
- One call per phone visit you commented in. It describes only the posts you commented under:
  the poster in full, and the girls who may react (her friends or two random girls, and anybody
  you tagged).
- Each call is roughly **2,000 to 4,000 tokens in and 200 to 500 out**, more when you comment
  under several posts in one visit. These are estimates from what the prompt holds; your
  provider's usage page shows the real numbers. Several comments in one visit still make one
  call, not one per comment.
- The slot opening describes up to three possible repliers per post it writes, a few lines each:
  no extra call, a few hundred tokens more on a call the game makes anyway.
- The closing's feed memory lines and the note to the texting bookkeeping are a line or two on
  calls the game already makes.
- If a call fails, or you reload before it was saved, the slot's settling asks again for whatever
  is still unanswered.
- Off, no call is made and the threads are hidden. Another mod that draws comments under posts
  draws its own instead.

## For modders

### Source map

| File | What it is |
| --- | --- |
| `src/shared/modEntries/bunnyfeeds.ts` | The entry: anytime, off by default, no requirements. |
| `src/shared/bunnyfeeds.ts` | The optional fields it adds to comments and posts, the thread call's reply shape, and `threadWork`, what a thread still owes. |
| `src/renderer/modEntries/bunnyfeeds.ts` | Registers the hooks, the post comments it draws among them. |
| `src/renderer/prompts/bunnyfeedsPrompt.ts` | The slot opening's reply lines, the replier block, the thread call's prompt and the texting bookkeeping's note. |
| `src/renderer/stores/bunnyfeedsReplies.ts` | Who may reply under a post, and how the slot opening's replies are filed. |
| `src/shared/bunnyfeedsCrowd.ts` | How many answer a post: her following, and whether it carries a picture. |
| `src/renderer/stores/bunnyfeedsThreads.ts` | The thread call: what is owed, sending on phone close, filing the answers. |
| `src/renderer/stores/bunnyfeedsMemory.ts` | Feed memories: held until the answers show, filed, announced in the closing; and the texting bookkeeping's note. |
| `src/renderer/stores/bunnyfeedsVisit.ts` | Whether he commented during this phone visit. |
| `src/renderer/components/BunnyfeedsThread.tsx`, `vu_styles/Bunnyfeeds.css` | The feed preview, the comment pill, the post view with its thread, the comment box and the @ list. |
| `src/main/ipc.ts`, `src/preload/*`, `src/web/bridge.ts` | The `llm:completeFeedThreads` channel (direct edit). |
| `src/renderer/prompts/textLedgerPrompt.ts` | One line adding `textLedgerFeedLines` (direct edit). |
| `src/renderer/stores/gameLoop.ts` | One line adding `feedStatusLines` to the closing's memories (direct edit). |
| `test/bunnyfeeds.test.ts` | `threadWork` and `carriedThread`. |

It uses nothing of any other mod: only the game's places on a post (`postComments`,
`PostPicture`) and the post's `comments` field, both the game's own.

### How it plugs in

- **`postComments`**: it draws the thread's preview under each post and puts its comment pill
  beside the like. Only one mod draws comments at a time, the first on in the mods list, so with
  another comment-drawing mod on it is asked first. Its `claims` marks the comments only it writes
  (yours, roster girls', replies), which another mod drawing comments leaves out while Bunnyfeeds
  is off.
- While it is the mod drawing comments (`ownsPostComments`), it asks the slot opening for each
  post's replies (`prompts['slot-posts']`, each reply naming who wrote it) and files them
  (`fileFeedPost`); a post another mod is putting a picture on, read off the post's `image` as plain
  data, draws more. So replies are never asked for twice.
- The post view draws the post's picture through the game's `PostPicture`, whichever mod draws it,
  and the thread call is told what a picture shows where a mod described one on the post.
- Two direct edits, where no hook exists: `textLedgerPrompt.ts` adds `textLedgerFeedLines`, telling
  the end-of-slot texting bookkeeping that comments under her posts are the feed's, so talk about a
  post in her DMs is not filed as something said over text; `gameLoop.ts` adds `feedStatusLines` to
  the closing's memories. Both do nothing while the mod is off.
- `requests['slot-intro']` adds the replier block. `prompts.dm` and `prompts.scene` add her two
  newest posts with his comments and her answers. `slotSettled` sends whatever is still owed.
  `gameEntered` drops a visit not yet sent.
- The thread call is not blocked by a save: a save taken while it is out simply leaves those
  comments owed, and the next settling asks again.

### Save fields

All optional, so a save without the mod loads as before, and switching it off keeps them: `charId`,
`player`, `replyTo` and `tags` on a comment; `threadedThrough` and `heldMemories` on a post. A
memory the thread call writes waits in `heldMemories` until the slot its answers show, and is filed
into her memories as the slot before it settles, so it arrives with the answers. What she made of
his comments is one of her ordinary memories, ending ", on her post" or ", under <name>'s post",
which is how the next one finds and replaces it.

Comments live in the game's own `comments` field on a post, so New Game+ moves them with the post;
`carriedThread` moves `threadedThrough` and the held memories the same way. A comment with none of
its fields reads as a stranger's. While Bunnyfeeds is off, a mod drawing comments in its place
leaves out the ones only Bunnyfeeds writes; they stay saved and come back with it.
