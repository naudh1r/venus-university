import type { ModSlice } from '@vx/modkit/shared'

/** The maximum length of each player-edited prompt sent with a redraw. */
export const PHOTO_PROMPT_LIMIT = 8000

/** The text sent to the scene and, for a duo, each girl's own prompt node. */
export interface PhotoPrompts {
  positive: string
  negative: string
  left?: string
  right?: string
}

/** Optional overrides for a redraw; omitted values use today's builder and a fresh seed. */
export interface PhotoRenderOptions {
  seed?: number
  prompts?: PhotoPrompts
}

/** What reached ComfyUI, kept beside the picture rather than in the save. */
export interface PhotoSidecar extends PhotoPrompts {
  schemaVersion: 1
  seed: number
  tier: string
  lora?: { name: string; weight: number }
}

/** A recorded prompt, or today's reconstruction for a picture without a usable sidecar. */
export interface PhotoInfo extends PhotoPrompts {
  recorded: boolean
  seed?: number
  tier: string
  lora?: { name: string; weight: number }
}

/** One picture on a thread, in whichever state the render left it. */
export interface ChatPhoto {
  /** How far it goes, as the gate settled it; the bubble covers an explicit one until tapped. */
  tier: string
  /**
   * What the picture shows, in her own words. The render reads it, and so does the next turn's
   * history: a girl who cannot remember what she sent cannot be teased about it, and sends the
   * same shot twice.
   */
  scene?: string
  /** File name under the playthrough's own photo folder; absent until the render lands. */
  file?: string
  /** Still being drawn: the bubble holds a placeholder in its place. */
  pending?: true
  /** The render failed and nothing arrived; the bubble says so once, quietly. */
  failed?: true
  /**
   * A post's picture that has not been drawn yet. The post is in the save from the moment the
   * slot wrote it, so a reload or a new slot cannot lose it — and nobody sees it until the
   * picture lands or fails (`postIsOut`). Never on a thread's picture.
   */
  held?: true
  /** When a held post came out (ms since epoch), so it stands above its slot's posts already showing. */
  outAt?: number
  /** The friend beside her in it, by charId: a picture of two, drawn in her own folder. */
  with?: string
}

declare module './types' {
  interface TextingResponse {
    /** She attaches a picture to this reply. What it may show is `photoGate`'s to decide. */
    sendPhoto?: boolean
    /** The picture she wants, in her own words. */
    photoPrompt?: string
    /**
     * What she says that picture is — a `PhotoTier`. Read alongside the caption rather than
     * instead of it: it may only raise the reading, never lower it.
     */
    photoTier?: string
  }

}


/** Validates the attachment without changing a save or discarding its optional state. */
export function normalizePhoto(stored: unknown, legacy: Readonly<Record<string, unknown>>): ChatPhoto | null {
  const raw = stored !== undefined ? stored : legacy.photo
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (typeof value.tier !== 'string') return null
  const photo: ChatPhoto = { tier: value.tier }
  for (const key of ['scene', 'file', 'with'] as const) {
    if (typeof value[key] === 'string') photo[key] = value[key]
  }
  for (const key of ['held', 'pending', 'failed'] as const) {
    if (value[key] === true) photo[key] = true
  }
  if (typeof value.outAt === 'number' && Number.isFinite(value.outAt)) photo.outAt = value.outAt
  return photo
}

/** Shared visibility reads the same payload as the renderer's record handles. */
export function savedPhoto(record: { ex?: Record<string, ModSlice> }): ChatPhoto | null {
  return normalizePhoto(record.ex?.['photo-feature']?.data, record as Readonly<Record<string, unknown>>)
}
