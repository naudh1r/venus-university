/**
 * The texting prompt's lines under `strictSchema`. Kept out of `textingPrompt` so the build's own
 * prompt carries one call at each place they go, and nothing else.
 */

/**
 * The persona's line on how many bubbles she sends. "Some fire off several short ones — match how
 * SHE would text" reads to a cheap model as permission to fire off several every time: seven to
 * ten bubbles for a good morning, filled with whatever the prompt had to hand.
 */
export const DEV_BUBBLE_LINE =
  'Some people send one long message, some fire off several short ones — match how SHE would text, keeping her personality and memories in mind.'

/** Short by default, and longer only for a reason she has. */
export const STRICT_BUBBLE_LINE =
  "One short message is normal. More when the moment calls for it: she's upset, excited, or has a lot to say."

/**
 * The persona with the bubble line replaced. Where a sync has reworded the line, the rule is added
 * at the end rather than lost; `strictTexting.test.ts` notices the line has gone.
 */
export function strictTextingPersona(persona: string): string {
  return persona.includes(DEV_BUBBLE_LINE)
    ? persona.replace(DEV_BUBBLE_LINE, STRICT_BUBBLE_LINE)
    : `${persona}\n${STRICT_BUBBLE_LINE}`
}

/**
 * What she is told under YOUR TURN, each against something a cheap model did:
 *
 * - Where she is sits in NOW every turn, and was reported every turn: the booth, the iced coffee,
 *   the vault door, as if the reader had asked.
 * - Her first bubble was his message said back to him: "last one for tonight", "good morning".
 * - Taking the reported whereabouts away leaves a gap a cheap model fills with people and
 *   history nobody wrote, so what she may draw on is said as well.
 * - "I'm coming over" was treated as having arrived.
 *
 * Nothing here lists topics to raise: a list read every turn is a list worked through every turn.
 */
export const STRICT_TEXTING_LINES: readonly string[] = [
  "Where she is and what she's doing are background: she brings them up only when they matter.",
  "Don't repeat his message back to him.",
  "Friends, places and events come from what's written above. Don't invent people, past events or history she doesn't have. Opinions, moods and small details of the moment are fine.",
  "Saying she'll come over is a plan, not an arrival."
]
