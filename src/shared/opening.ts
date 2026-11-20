import { isEmotion } from './emotions'
import { spriteAction } from './sceneActions'
import type { DeferredOpeningNotes, SceneLine } from './types'

/** The temporary stage a mod chooses for part of a slot opening. */
export interface OpeningLook {
  room?: { kind: 'herRoom' | 'hisRoom'; charId: string }
  cast?: readonly string[]
  until?: number
}

/** The opening's canonical pages and their indices in the written reply. */
export interface OpeningPlayback {
  reply: Record<string, unknown>
  lines: SceneLine[]
  indices: number[]
  index: number
}

/** A safe opening line; malformed dialogue keeps only its narration text. */
export function parseOpeningLine(value: unknown, speakers: readonly string[]): SceneLine | null {
  const fields = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
  const text = typeof value === 'string' ? value.trim()
    : typeof fields?.text === 'string' ? fields.text.trim() : ''
  if (!text) return null
  const speaker = typeof fields?.speaker === 'string' ? fields.speaker.trim() : ''
  if (!speakers.includes(speaker) || typeof fields?.emotion !== 'string' || !isEmotion(fields.emotion)) {
    return { speaker: '', text }
  }
  return { speaker, text, actions: [spriteAction(speaker, fields.emotion)] }
}

/** Whether this written line still belongs to the mod's opening stage. */
export function openingStagedAt(look: OpeningLook | null, index: number): boolean {
  return look !== null && (look.until === undefined || index < look.until)
}

/** Reads the small opening context a saved night carries, isolating malformed entries. */
export function readDeferredOpeningNotes(value: unknown): DeferredOpeningNotes | null {
  if (!value || typeof value !== 'object') return null
  const notes = value as Record<string, unknown>
  const love = notes.love && typeof notes.love === 'object'
    ? notes.love as Record<string, unknown> : {}
  const argued: DeferredOpeningNotes['love']['argued'][number][] = []
  for (const entry of Array.isArray(love.argued) ? love.argued : []) {
    if (entry && typeof entry.a === 'string' && typeof entry.b === 'string') {
      argued.push({ a: entry.a, b: entry.b })
    }
  }
  const outcomes: DeferredOpeningNotes['love']['outcomes'][number][] = []
  for (const entry of Array.isArray(love.outcomes) ? love.outcomes : []) {
    if (entry && typeof entry.charId === 'string' && typeof entry.about === 'string' &&
      ['together', 'turnedDown', 'brokeUp'].includes(entry.result)) {
      outcomes.push({ charId: entry.charId, about: entry.about, result: entry.result })
    }
  }
  const count = notes.newTransfers
  return {
    newTransfers: typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : 0,
    love: { argued, outcomes }
  }
}
