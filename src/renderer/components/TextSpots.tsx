import type { JSX } from 'react'
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

/** Whether a phone message is drawn with no bubble behind it, as the mod drawing it says. */
export function useBareMessage(text: string): boolean {
  useModsStore((s) => s.switches)
  return sentText()?.bare?.(text) ?? false
}
