import { useLayoutEffect, useRef, type JSX } from 'react'
import { emojiTool, sentText, type EmojiToolProps } from '../mods/hooks'
import { useModsStore } from '../stores/modsStore'

/**
 * The places in a box being typed in and in what was sent that a mod may draw: an emoji tool,
 * and the sent text itself. Each reads the switches, so a mod turned on or off redraws them.
 */

/** Whether a mod draws an emoji tool, so a caller can stand its own in place of none. */
export function useEmojiTool(): boolean {
  useModsStore((s) => s.switches)
  return emojiTool() !== null
}

/** The emoji tool beside a box, drawn by the first mod on that has one; nothing otherwise. */
export function EmojiTool(props: EmojiToolProps): JSX.Element | null {
  useModsStore((s) => s.switches)
  const Tool = emojiTool()
  return Tool ? <Tool {...props} /> : null
}

/** What somebody sent, as the mod drawing sent text draws it; the bare text otherwise. */
export function SentText({ text, big }: { text: string; big?: boolean }): JSX.Element {
  useModsStore((s) => s.switches)
  const Text = sentText()?.Text
  return Text ? <Text text={text} big={big} /> : <>{text}</>
}

const receiptGraphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Renders the original text with room next to its final word for a receipt. */
export function ReceiptSentText({ text }: { text: string }): JSX.Element {
  useModsStore((s) => s.switches)
  const Text = sentText()?.Text
  const rendered = useRef<HTMLSpanElement>(null)
  const spacer = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const output = rendered.current
    const space = spacer.current
    const bubble = output?.parentElement
    if (!Text || !output || !space || !bubble) return

    // An opaque mod renderer keeps its own markup. Give a long token more break
    // opportunities only if the browser put the joined space on a line by itself.
    const breakClass = 'vu-bb-receipt-rendered--break'
    const fit = (): void => {
      output.classList.remove(breakClass)
      const range = document.createRange()
      range.selectNodeContents(output)
      if (space.getBoundingClientRect().top >= range.getBoundingClientRect().bottom) {
        output.classList.add(breakClass)
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(bubble)
    return () => {
      observer.disconnect()
      output.classList.remove(breakClass)
    }
  }, [Text, text])

  if (Text) {
    return (
      <>
        <span ref={rendered}><Text text={text} /></span>
        <span ref={spacer} className="vu-bb-receipt-joined-space" aria-hidden="true" />
      </>
    )
  }

  const end = text.trimEnd().length
  const begin = text.slice(0, end).search(/\S+$/u)
  if (begin < 0) return <>{text}</>
  const word = text.slice(begin, end)
  const last = receiptGraphemes.segment(word).containing(word.length - 1)?.index ?? 0

  return (
    <>
      {text.slice(0, begin)}
      <span className="vu-bb-receipt-word">
        {word.slice(0, last)}
        <span className="vu-bb-receipt-end">
          {word.slice(last)}
          <span className="vu-bb-receipt-spacer" aria-hidden="true" />
        </span>
      </span>
      {text.slice(end)}
    </>
  )
}

/** Whether a phone message is drawn with no bubble behind it, as the mod drawing it says. */
export function useBareMessage(text: string): boolean {
  useModsStore((s) => s.switches)
  return sentText()?.bare?.(text) ?? false
}
