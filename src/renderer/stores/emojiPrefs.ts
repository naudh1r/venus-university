import { create } from 'zustand'

/**
 * The emoji the player reached for last and the skin tone his hands and people are drawn in.
 * Kept on this computer, beside no save: it is how he types, not something a playthrough
 * depends on.
 */

const KEPT = 'vu-emoji:prefs'

/** How many recent emoji are kept; the composer's row shows the first of them. */
export const RECENT_KEPT = 24

/** What the row offers before he has picked anything. */
const FIRST_RECENT = ['😂', '😭', '❤️', '👍', '🍆', '😳', '🔥', '🥺']

/** The five skin-tone modifiers, light to dark; no tone is the default yellow. */
export const SKIN_TONES = [0x1f3fb, 0x1f3fc, 0x1f3fd, 0x1f3fe, 0x1f3ff] as const

interface Kept {
  recent: string[]
  /** An index into {@link SKIN_TONES}, or null for the default yellow. */
  tone: number | null
}

function kept(): Kept {
  try {
    const raw = localStorage.getItem(KEPT)
    const read = raw ? (JSON.parse(raw) as Partial<Kept>) : {}
    const recent = Array.isArray(read.recent)
      ? read.recent.filter((one): one is string => typeof one === 'string').slice(0, RECENT_KEPT)
      : []
    const tone =
      typeof read.tone === 'number' && read.tone >= 0 && read.tone < SKIN_TONES.length
        ? read.tone
        : null
    return { recent: recent.length > 0 ? recent : FIRST_RECENT, tone }
  } catch {
    return { recent: FIRST_RECENT, tone: null }
  }
}

function keep(state: Kept): void {
  try {
    localStorage.setItem(KEPT, JSON.stringify({ recent: state.recent, tone: state.tone }))
  } catch {
    // A browser that keeps nothing still types; the row starts over next time.
  }
}

interface EmojiPrefsState extends Kept {
  /** Puts an emoji, untoned, at the front of the recent list. */
  used: (emoji: string) => void
  setTone: (tone: number | null) => void
}

export const useEmojiPrefs = create<EmojiPrefsState>((set, get) => ({
  ...kept(),
  used: (emoji) => {
    const recent = [emoji, ...get().recent.filter((one) => one !== emoji)].slice(0, RECENT_KEPT)
    set({ recent })
    keep(get())
  },
  setTone: (tone) => {
    set({ tone })
    keep(get())
  }
}))

/** A hand or a person in a skin tone: the tone after its first code point, its FE0F dropped. */
export function tonedEmoji(emoji: string, tone: number | null): string {
  if (tone === null) return emoji
  const points = [...emoji].map((char) => char.codePointAt(0) ?? 0)
  const rest = points[1] === 0xfe0f ? points.slice(2) : points.slice(1)
  return String.fromCodePoint(points[0], SKIN_TONES[tone], ...rest)
}
