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

export const LOOKING_BACK_CUES = ['looking back', 'glancing back', 'over her shoulder']

const BACK_SHOT_CUES = [
  ...LOOKING_BACK_CUES,
  'from behind', 'back view', 'rear view', 'back turned', 'facing away', 'turned away',
  'turning away', 'back to the camera', 'from the back', 'backs to the camera'
]

export const FACE_DOWN_CUES = ['on her stomach', 'on her front', 'face down', 'face-down', 'prone']
export const ALL_FOURS_CUES = ['all fours', 'hands and knees']
export const BENT_OVER_CUES = ['bent over', 'bending over', 'bent forward']

export const SPREAD_CHEEKS_CUES = [
  'spreading her ass', 'spreading her bare ass', 'spreading her cheeks', 'holding her cheeks apart',
  'spread her ass', 'spread her cheeks', 'spread her buttocks', 'spread her bare buttocks',
  'spreading her buttocks', 'spreading her bare buttocks', 'buttocks apart', 'buttocks wide apart',
  'buttock cheek'
]

/** A rear-focused caption names the subject of the shot or calls out bare skin. */
export function focusesOnBackside(text: string): boolean {
  const rear = '(?:ass|butt|booty|backside|bum|rear)(?![\\w-])'
  const focus = new RegExp(
    `\\b(?:of|showing(?: off)?|focusing on|focused on|framing|showcases?) (?:her |the |a |that )?(?:bare )?${rear}` +
      `|^\\s*(?:her|the) (?:bare )?${rear}\\b` +
      `|\\b(?:bare ${rear}|${rear} (?:shot|in (?:the )?frame|filling (?:the )?frame))\\b`
  )
  const coveredFront =
    saysAny(text, ['facing the camera', 'facing the viewer', 'front view', 'facing forward']) &&
    saysAny(text, ['covered', 'clothed', 'dressed', 'in her jeans', 'in her shorts', 'in her skirt'])
  return !coveredFront && focus.test(text)
}

/** Caption text here is already normalised to the shared pronouns. */
export function isBackShot(text: string): boolean {
  return saysAny(text, BACK_SHOT_CUES) || focusesOnBackside(text) || saysAny(text, SPREAD_CHEEKS_CUES)
}

/** In a face-down pose the camera sees the back of the body even without a facing cue. */
export function isRearView(text: string): boolean {
  return isBackShot(text) || saysAny(text, FACE_DOWN_CUES)
}
