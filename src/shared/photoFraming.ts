import { saysAny } from './photoWords'

/**
 * How much of her a photo shows, read once off the caption and shared by what places her in it
 * (`photoPose`) and what of her body it names (`photoBody`), so the two never describe
 * different pictures.
 *
 * The tags are the ones that held in same-seed checks on the photo checkpoint. Plain
 * `upper_body` was ignored standing or sitting and only `(upper_body:1.3)` framed her from the
 * waist; plain `full_body` stays as it is, since weighting it drew her small, flat and younger.
 */
export type Framing = 'face' | 'lower' | 'waist' | 'knees' | 'full'

const CLOSE_UP = ['close-up', 'closeup', 'close up']
const MEDIUM_CLOSE_UP = ['medium close-up', 'medium close up']

const FRAMINGS: readonly { framing: Framing; cues: readonly string[]; tags: readonly string[] }[] =
  [
    {
      framing: 'face',
      cues: ['face shot', 'face only', 'just her face', 'headshot', 'her face filling', ...CLOSE_UP],
      tags: ['close-up', 'portrait']
    },
    {
      framing: 'lower',
      cues: ['waist down', 'from the waist down', 'hips down'],
      tags: ['lower_body']
    },
    {
      framing: 'waist',
      cues: [
        'waist up', 'waist-up', 'waist-high', 'from the waist', 'upper body',
        'chest up', 'bust shot', 'shoulders up',
        'medium shot', 'half body', 'half-body', ...MEDIUM_CLOSE_UP
      ],
      tags: ['(upper_body:1.3)']
    },
    {
      framing: 'knees',
      cues: [
        'knees up', 'from the knees', 'thighs up', 'thigh up', 'mid-thigh', 'mid thigh',
        'three-quarter', 'three quarter', 'cowboy shot', 'from the thighs'
      ],
      tags: ['cowboy_shot']
    },
    {
      framing: 'full',
      cues: [
        'full body',
        'full-body',
        'head to toe',
        'whole body',
        'full length',
        'full-length',
        'whole outfit',
        'full shot'
      ],
      tags: ['full_body']
    }
  ]

/** The framing the caption asks for, closest first, or null where it names none. */
export function framingOf(caption: string): Framing | null {
  const text = caption.toLowerCase()
  // A lower crop is explicit even when the caption also calls it a close-up.
  const lower = FRAMINGS.find((row) => row.framing === 'lower')
  if (lower && saysAny(text, lower.cues)) return lower.framing
  // A medium close-up includes her chest; a phone at arm's length does too.
  if (
    saysAny(text, MEDIUM_CLOSE_UP) ||
    (saysAny(text, CLOSE_UP) && saysAny(text, ['selfie']))
  ) {
    return 'waist'
  }
  return FRAMINGS.find((row) => saysAny(text, row.cues))?.framing ?? null
}

/** The tags one framing is drawn with. */
export function framingTags(framing: Framing): readonly string[] {
  return FRAMINGS.find((row) => row.framing === framing)?.tags ?? []
}

/** The words a caption asks for her whole body with. */
export const FULL_BODY_CUES = FRAMINGS.find((row) => row.framing === 'full')?.cues ?? []

/** Every tag a framing can be drawn with, for whatever replaces one framing with another. */
export const FRAMING_TAGS: ReadonlySet<string> = new Set([
  'close-up',
  'portrait',
  'upper_body',
  'cowboy_shot',
  'full_body',
  ...FRAMINGS.flatMap((row) => row.tags)
])

/** The framing a finished set of pose tags draws, for a caption that never said one. */
export function framingInTags(tags: readonly string[]): Framing | null {
  if (tags.includes('lower_body')) return 'lower'
  if (tags.includes('portrait')) return 'face'
  if (tags.includes('full_body')) return 'full'
  if (tags.some((tag) => tag === 'upper_body' || tag.startsWith('(upper_body:'))) return 'waist'
  if (tags.includes('cowboy_shot')) return 'knees'
  return null
}
