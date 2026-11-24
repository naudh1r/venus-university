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

/**
 * Turned to look back at the camera. "Over her shoulder" alone also reads a bag slung over it, so
 * only a look over it counts.
 */
export const LOOKING_BACK_CUES = [
  'looking back', 'glancing back', 'peeking back', 'back over her shoulder',
  'looking over her shoulder', 'glancing over her shoulder', 'peeking over her shoulder',
  'smiling over her shoulder', 'over her shoulder at the camera', 'over her shoulder at the viewer',
  'over her shoulder toward the camera', 'over her shoulder towards the camera'
]

const BACK_SHOT_CUES = [
  ...LOOKING_BACK_CUES,
  'from behind', 'back view', 'rear view', 'back turned', 'facing away',
  'back to the camera', 'backs to the camera'
]

/** Lying on her front. "Face down" alone is also a phone on a table. */
export const FACE_DOWN_CUES = [
  'on her stomach', 'on her front', 'lying face down', 'lying face-down', 'lies face down',
  'lies face-down', 'lay face down', 'lay face-down', 'face down on the bed', 'face down on her bed',
  'face-down on the bed', 'face-down on her bed', 'prone'
]
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
  // "Rear" only as hers: "a photo of the rear courtyard" is a place.
  const rear = '(?:ass|butt|booty|backside|bum|(?<=her (?:bare )?)rear)(?![\\w-])'
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

/**
 * Turned away, unless from something else: "turned away from the window to smile" faces the
 * camera. From the back, unless of a place: "the back of the bus", "the back row".
 */
const TURNED_AWAY = /(?<![a-z0-9])turn(?:s|ed|ing)? away(?! from (?!the camera|the viewer|the lens))(?![a-z0-9])/
const FROM_THE_BACK =
  /(?<![a-z0-9])from the back(?! (?:of|row|rows|seat|seats|door|entrance|corner|table|booth|bench))(?![a-z0-9])/

/** Caption text here is already normalised to the shared pronouns. */
export function isBackShot(text: string): boolean {
  return saysAny(text, BACK_SHOT_CUES) || TURNED_AWAY.test(text) || FROM_THE_BACK.test(text) ||
    focusesOnBackside(text) || saysAny(text, SPREAD_CHEEKS_CUES)
}

/** In a face-down pose the camera sees the back of the body even without a facing cue. */
export function isRearView(text: string): boolean {
  return isBackShot(text) || saysAny(text, FACE_DOWN_CUES)
}
