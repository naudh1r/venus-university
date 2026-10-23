import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type EmojiToolProps } from '../mods/hooks'
import { EmojiText, emojiOnly } from '../components/EmojiText'

/** The panel, loaded the first time a composer with its smiley is drawn. */
const LazyButton = lazy(() =>
  import('../components/EmojiPicker').then((module) => ({ default: module.EmojiButton }))
)

/** The smiley beside a box, drawn once its code has loaded. */
function EmojiToolView(props: EmojiToolProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyButton, props))
}

registerHooks('emoji-extended', {
  // Every emoji, beside the phone's field and any mod's own box, in place of the row of eight.
  emojiTool: EmojiToolView,
  // Emoji a size up among words, and a message of one to three drawn big with no bubble.
  sentText: { Text: EmojiText, bare: emojiOnly }
})
