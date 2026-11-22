import { Fragment, type JSX } from 'react'
import '../vu_styles/EmojiText.css'

/** The most emoji a message can hold and still be drawn big, as a messenger draws a lone one. */
const BIG_AT_MOST = 3

/**
 * Whether one grapheme is an emoji drawn as a picture: one Unicode draws as an emoji by default
 * (☕ and 😂 alike), or any with the emoji presentation selector, a joiner or a keycap. ©, ™, a
 * bare ❤ and a digit stay text, as a phone sets them.
 */
function isEmoji(grapheme: string): boolean {
  return /\p{Emoji_Presentation}|\p{Regional_Indicator}|[\ufe0f\u20e3\u200d]/u.test(grapheme)
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The text in runs, each either words or emoji. */
function runsOf(text: string): Array<{ emoji: boolean; text: string }> {
  const runs: Array<{ emoji: boolean; text: string }> = []
  for (const { segment } of graphemes.segment(text)) {
    const emoji = isEmoji(segment)
    const last = runs[runs.length - 1]
    if (last && last.emoji === emoji) last.text += segment
    else runs.push({ emoji, text: segment })
  }
  return runs
}

/** Whether a message is nothing but one to three emoji, which are then drawn big. */
export function emojiOnly(text: string): boolean {
  const kept = [...graphemes.segment(text.trim())].map(({ segment }) => segment)
  const emoji = kept.filter((one) => one.trim() !== '')
  return emoji.length > 0 && emoji.length <= BIG_AT_MOST && emoji.every(isEmoji)
}

/**
 * Text with its emoji drawn a size up from the words around them, since an emoji's picture sits
 * smaller than the letters it is set at; a message of nothing but a few emoji draws them big,
 * unless `big` is off, as on a one-line preview.
 */
export function EmojiText({ text, big = true }: { text: string; big?: boolean }): JSX.Element {
  if (big && emojiOnly(text)) return <span className="vu-emoji-big">{text.trim()}</span>
  return (
    <>
      {runsOf(text).map((run, i) =>
        run.emoji ? (
          <span key={i} className="vu-emoji-inline">
            {run.text}
          </span>
        ) : (
          <Fragment key={i}>{run.text}</Fragment>
        )
      )}
    </>
  )
}
