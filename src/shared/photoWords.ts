/**
 * How the photo feature reads a caption for a cue: as words of their own, never as letters inside
 * another word. Read as a substring, "bra" fired on "library", "lace" on "necklace", "dress" on
 * "address" and "cum" on "document" — and each one put something on a picture, or kept it off,
 * that the caption never asked for.
 *
 * A cue may take a plural ("bras", "dresses"). A cue ending in `*` is a stem and matches any word
 * that starts with it ("masturbat*" for "masturbates", "masturbating").
 */

/** The letters a cue is bounded by; anything else — a space, a hyphen, a comma — ends a word. */
const WORD_CHAR = '[a-z0-9]'

const compiled = new Map<string, RegExp>()

function escaped(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** An -ing verb with its other forms: "flipping" to flip, flips, flipped, flipping. */
function verbForms(word: string): string {
  const root = word.slice(0, -3)
  const roots = new Set([root, `${root}e`])
  if (/([b-df-hj-np-tv-z])\1$/.test(root)) roots.add(root.slice(0, -1))
  const forms = new Set([word])
  for (const one of roots) {
    for (const end of ['s', 'es', 'ed', 'd']) forms.add(`${one}${end}`)
  }
  return `(?:${[...forms].map(escaped).join('|')})`
}

function patternOf(cue: string): RegExp {
  const cached = compiled.get(cue)
  if (cached) return cached
  const stem = cue.endsWith('*')
  const words = (stem ? cue.slice(0, -1) : cue).split(' ')
  // In a cue of two words or more, a verb in -ing also matches its other forms: "flipping off"
  // reads "flips off" and "flipped off". A cue of one word stays as written: "waving" would
  // otherwise read "waves" on a beach.
  const body = words
    .map((word, index) =>
      words.length > 1 && index === 0 && /^[a-z]{3,}ing$/.test(word) ? verbForms(word) : escaped(word)
    )
    .join(' ')
  const tail = stem ? `${WORD_CHAR}*` : '(?:s|es)?'
  const pattern = new RegExp(`(?<!${WORD_CHAR})${body}${tail}(?!${WORD_CHAR})`)
  compiled.set(cue, pattern)
  return pattern
}

/** Whether a lowercased caption says `cue`. */
export function says(text: string, cue: string): boolean {
  return patternOf(cue).test(text)
}

/** Whether a lowercased caption says any of `cues`. */
export function saysAny(text: string, cues: readonly string[]): boolean {
  return cues.some((cue) => says(text, cue))
}
