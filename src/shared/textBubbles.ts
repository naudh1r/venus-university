/**
 * The bubbles one of her texts arrives as.
 *
 * Every entry of a texting reply is one bubble, and a bubble shows its line breaks as they are
 * written. A cheap model asked for texts writes a paragraph into one entry instead — two or three
 * lines stacked in a single tall bubble, which reads like a letter rather than a phone thread.
 * Under `strictSchema` a line break is read as the send button it would be on a phone: each line
 * is a bubble of its own.
 *
 * Off, a text is one bubble however it is written, which is how this build has always shown it.
 */
export function textBubbles(text: string, strictSchema: boolean): string[] {
  if (!strictSchema) {
    const whole = text.trim()
    return whole ? [whole] : []
  }
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}
