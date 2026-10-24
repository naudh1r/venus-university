# Emoji Extended

Every emoji on the phone, in place of the row of eight under the texting box. It needs no other
mod, and any mod with a box of its own takes the same panel through the game's `emojiTool` hook.

## Playing

- Turn on **Emoji Extended** in Mods. It can be switched on or off at any time.
- A smiley stands beside the box, level with Send. It opens a panel over the box: a search, a
  skin-tone hand, a row of tabs and the emoji under them. A press puts the emoji in at the caret
  and the panel stays open for the next; Escape, a right-click or a press outside closes it.
- The tabs are Recent, Smileys, People, Animals and nature, Food and drink, Activities, Travel and
  places, Objects and Symbols. Recent comes first, the last 24 you used, newest first; until you
  have used any it holds the phone's own eight.
- Search matches the start of any word of an emoji's name ("heart", "cat"); Enter in it puts in
  the first match and never sends the message.
- The hand beside the search sets one skin tone, or the default yellow, for every hand and person
  that has one. Recent emoji are kept untoned and drawn in the tone in force.
- Emoji in texts, posts and comments stand a size up from the words around them, so they are as
  tall as the letters. A text or comment of nothing but one to three emoji is drawn big, a text
  with no bubble behind it. A one-line preview, such as a Notifications row, stays small.
- What is sent and saved is the text as typed: the AI reads and writes emoji as it always has.
  Switching the mod off brings the row of eight back and draws everything as plain text again.

## What it costs

No AI calls and nothing in the save. The recent list and the skin tone are kept on this computer
(`localStorage`, key `vu-emoji:prefs`), beside no save. The emoji list is a 42 KB file loaded the
first time a panel opens.

## How it draws

- The emoji are the system's own font, Windows 11's on Windows, so they match every other emoji
  in the game. Country flags are left out, Windows drawing them as two letters; the other flags
  are under Symbols. The list stops at Emoji 15.0, what Windows 11's font draws.
- The panel stands on the stage itself, over the window it was opened from, its corner set against
  the smiley's, so a short post or a reply box deep in a thread never cuts it off.
- The grid puts only the rows in view on the page, about ten of them, and swaps rows in as it
  scrolls; the scrollbar still measures the whole tab.
- Each emoji in view is drawn once by the system font into a small picture, and the grid shows
  the picture. Colour emoji are slow to draw, and a grid of pictures scrolls without redrawing
  them. The pictures are drawn a few milliseconds' worth a frame, in the order shown, so a slow
  machine draws fewer a frame rather than dropping one; until its picture is ready a cell shows
  the emoji as text.
- An emoji is told apart from text by Unicode's own rule: one drawn as an emoji by default (☕ and
  😂 alike), or one with the emoji selector, a joiner or a keycap. ©, ™, a bare ❤ and digits stay
  text.

## Updating the emoji list

`scripts/emojiData.mjs` builds `src/renderer/components/emojiData.json` from Unicode's
`emoji-test.txt`:

```
node scripts/emojiData.mjs path/to/emoji-test.txt
```

Raise `MAX_VERSION` in the script once Windows draws a newer Emoji version.

## Source map

| File | Responsibility |
| --- | --- |
| `src/shared/modEntries/emoji-extended.ts` | The mod's switch. |
| `src/renderer/modEntries/emoji-extended.ts` | Registers `emojiTool` (the smiley and its panel, loaded when first drawn) and `sentText`. |
| `src/renderer/components/EmojiPicker.tsx` | The smiley, the panel, its tabs, search and tones, the rows in view and the pictures drawn of them. |
| `src/renderer/components/EmojiText.tsx` | Sent text with its emoji a size up, and a message of one to three drawn big. |
| `src/renderer/components/emojiData.json` | Every emoji the panel lists, by tab, with its name and whether it takes a tone. |
| `src/renderer/stores/emojiPrefs.ts` | The recent list and the skin tone, kept on this computer. |
| `src/renderer/vu_styles/EmojiPicker.css`, `EmojiText.css` | The panel; emoji among words and drawn big. |
| `scripts/emojiData.mjs` | Builds the emoji list from Unicode's file. |

## Changelog

### 1.0.0

- The panel: every emoji in tabs, search, the ones you used last first and one skin tone for
  every hand and person, beside the phone's box and any mod's that takes the game's emoji tool.
- Emoji in texts, posts and comments a size up from the words, and a message of one to three
  drawn big.
