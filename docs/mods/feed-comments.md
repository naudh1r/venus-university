# Feed Comments

Comment on your contacts' posts, and they answer you. Needs Photo Feature, whose post comments it
takes over. Works with photos off.

## Playing

- Turn on **Feed Comments** in Mods. It needs **Photo Feature** on too; with Photo Feature off,
  Feed Comments is off and comes back when Photo Feature does.
- Under a contact's post there is a comment box. Every comment left on the post itself has a
  **Reply** link; replies under it do not.
- Type `@` to tag one of your contacts. A list of them opens under the box and narrows as you type;
  arrows and Enter or Tab pick one. A tag counts only while its `@handle` is still in what you send.
- What you write shows at once. Closing the phone sends everything you wrote during that visit as
  one call, in the background. The answers are stamped for the next slot, so they are waiting when
  it opens.
- The poster always answers your comments. Anybody you tagged answers too. Her friends and other
  students may react, one or two at most.
- She also answers up to three other people's comments under a post you are active on.
- Posts arrive with replies from strangers and from a few roster girls in their own voices: the
  poster's friends, or two random girls when she has none.
- Strangers' posts, and the slot's random student post, take no comments.
- She keeps one memory of your comments, the newest replacing the last. Scenes and texts can
  bring it up. It does not change her affection.
- Comments are public. Nobody agrees to meet, to a date, a time or a place in them; a girl who is
  keen keeps it open or tells you to message her. Nothing private or explicit is said there.

## What it costs

- Opening and closing the phone without commenting makes no call.
- One call per phone visit you commented in. It describes only the posts you commented under:
  the poster in full, and the girls who may react (her friends or two random girls, and anybody
  you tagged).
- The slot opening describes up to three possible repliers per post it writes, a few lines each.
- If a call fails, or you reload before it was saved, the slot's settling asks again for whatever
  is still unanswered.
- Off, no call is made, and posts go back to Photo Feature's plain comments.

## For modders

### Source map

| File | What it is |
| --- | --- |
| `src/shared/modEntries/feed-comments.ts` | The entry: anytime, off by default, requires `photo-feature`. |
| `src/shared/feedComments.ts` | The optional fields it adds to comments, posts and her record, and `threadWork`, what a thread still owes. |
| `src/renderer/modEntries/feed-comments.ts` | Registers the comment hand-off and the hooks. |
| `src/renderer/prompts/feedCommentsPrompt.ts` | The slot opening's reply lines, the replier block and the thread call's prompt. |
| `src/renderer/stores/feedComments.ts` | Who may reply under a post, and how the slot opening's replies are filed. |
| `src/renderer/stores/feedThreads.ts` | The thread call: what is owed, sending on phone close, filing the answers. |
| `src/renderer/components/FeedThread.tsx`, `vu_styles/FeedComments.css` | The thread, the comment box and the @ list. |
| `src/main/ipc.ts`, `src/preload/*`, `src/web/bridge.ts` | The `llm:completeFeedThreads` channel. |
| `test/feedComments.test.ts` | `threadWork`. |

### How it plugs in

- **Photo Feature's comment hand-off** (`stores/commentHandoff.ts`, Photo Feature 1.3.0): while
  Feed Comments is on, the slot opening asks for replies in its words and its schema (each reply
  names who wrote it), a filed post's replies are dressed by it with the picture's tier already
  known, and `PostComments` draws them with `FeedThread`.
- `requests['slot-intro']` adds the replier block. `prompts.scene` and `prompts.dm` add her feed
  memory. `slotSettled` sends whatever is still owed. `gameEntered` drops a visit not yet sent.
- The thread call is not blocked by a save: a save taken while it is out simply leaves those
  comments owed, and the next settling asks again.

### Save fields

All optional, so a save without the mod loads as before, and switching it off keeps them:
`charId`, `player`, `replyTo` and `tags` on a comment; `threadedThrough` on a post; `feedMemory`
on her record.

Comments keep Photo Feature's `comments` field. A comment written by Photo Feature alone reads as
a stranger's.
