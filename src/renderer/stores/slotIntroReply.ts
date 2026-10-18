import type { SlotIntroResponse } from '@shared/types'

/** Who the slot opening asked to write in each of its lists, as charKeys. */
export interface SlotIntroAsked {
  askers: ReadonlySet<string>
  breakups: ReadonlySet<string>
  posters: ReadonlySet<string>
  leavers: ReadonlySet<string>
  reachOuts: ReadonlySet<string>
  visitors: ReadonlySet<string>
}

/** The slot opening's reply with every list kept to the girls it was asked for, one entry each. */
export interface SlotIntroReply {
  /** The narration, trimmed, blanks dropped. */
  lines: string[]
  hangouts: NonNullable<SlotIntroResponse['hangouts']>
  breakups: NonNullable<SlotIntroResponse['breakups']>
  posts: NonNullable<SlotIntroResponse['posts']>
  springBreakTexts: NonNullable<SlotIntroResponse['springBreakTexts']>
  reachOuts: NonNullable<SlotIntroResponse['reachOuts']>
  homecomingTexts: NonNullable<SlotIntroResponse['homecomingTexts']>
}

type Fields = Record<string, unknown>

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `value` trimmed, or null when it is not a string or is blank. */
function textOf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** A run of texts: its string items trimmed, blanks dropped; anything but an array is none. */
function textsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = textOf(item)
    return text ? [text] : []
  })
}

/**
 * The entries of one keyed list that belong to a girl `listed` names, her first one only,
 * each read into its kept fields by `read` — null drops it.
 */
function entriesOf<T>(
  raw: unknown,
  field: string,
  listed: ReadonlySet<string>,
  read: (entry: Fields, char: string) => T | null
): T[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    console.warn(`[slot] "${field}" is not a list — dropping it.`)
    return []
  }
  const kept: T[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!isFields(entry) || typeof entry.char !== 'string') {
      console.warn(`[slot] "${field}" entry with no character — dropping it.`)
      continue
    }
    const char = entry.char
    if (!listed.has(char)) {
      console.warn(`[slot] "${field}" entry for "${char}", who was not asked for one — dropping it.`)
      continue
    }
    if (seen.has(char)) {
      console.warn(`[slot] a second "${field}" entry for "${char}" — dropping it.`)
      continue
    }
    const fields = read(entry, char)
    if (fields === null) {
      console.warn(`[slot] "${field}" entry for "${char}" has nothing to deliver — dropping it.`)
      continue
    }
    seen.add(char)
    kept.push(fields)
  }
  return kept
}

/** A run-of-texts entry, kept only when it has a text left. */
function runOf(entry: Fields, char: string): { char: string; texts: string[] } | null {
  const texts = textsOf(entry.texts)
  return texts.length > 0 ? { char, texts } : null
}

/** The slot opening's reply as parsed JSON, which no schema holds a custom endpoint to, made safe to deliver. */
export function sanitizeSlotIntro(data: unknown, asked: SlotIntroAsked): SlotIntroReply {
  const reply = isFields(data) ? data : {}
  if (!isFields(data)) console.warn('[slot] the reply is not an object — treating it as empty.')

  if (reply.lines !== undefined && !Array.isArray(reply.lines)) {
    console.warn('[slot] "lines" is not a list — the opening plays without narration.')
  }
  const lines = (Array.isArray(reply.lines) ? reply.lines : []).flatMap((line) => {
    const text = isFields(line) ? textOf(line.text) : null
    return text ? [text] : []
  })

  return {
    lines,
    hangouts: entriesOf(reply.hangouts, 'hangouts', asked.askers, (entry, char) => {
      const text = textOf(entry.text)
      const description = textOf(entry.description)
      return text && description ? { char, text, description } : null
    }),
    breakups: entriesOf(reply.breakups, 'breakups', asked.breakups, runOf),
    // A post and a reach-out keep whatever else their entry carries: the fields mods ask for
    // there (`prompts['slot-posts']`, `prompts['slot-reach-outs']`) are theirs to read.
    posts: entriesOf(reply.posts, 'posts', asked.posters, (entry, char) => {
      const text = textOf(entry.text)
      return text ? { ...entry, char, text } : null
    }),
    springBreakTexts: entriesOf(reply.springBreakTexts, 'springBreakTexts', asked.leavers, runOf),
    reachOuts: entriesOf(reply.reachOuts, 'reachOuts', asked.reachOuts, (entry, char) => {
      const run = runOf(entry, char)
      return run ? { ...entry, ...run } : null
    }),
    homecomingTexts: entriesOf(reply.homecomingTexts, 'homecomingTexts', asked.visitors, runOf)
  }
}
