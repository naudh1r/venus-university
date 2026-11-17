import { isEmotion } from './emotions'
import { spriteAction } from './sceneActions'
import type { SceneLine } from './types'

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
