import { CLASS_CATALOG_RANGES, validateRecord, type ClassCatalogEdits, type ClassCatalogKey } from '@vx/modkit/shared'
import type { GlobalTextId } from './types'

export { CLASS_CATALOG_RANGES, DEFAULT_CLASS_CATALOG } from '@vx/modkit/shared'
export type { ClassCatalogEdits, ClassCatalogKey } from '@vx/modkit/shared'

/** The one version of the studio prompts record this build reads and writes. */
export const STUDIO_PROMPTS_SCHEMA_VERSION = 1

/** What Prompt Studio keeps for the game's own prompts: text blocks by id and the class call's pool sizes. */
export interface StudioPrompts {
  schemaVersion: number
  /** Unknown ids stay stored and are ignored. */
  blocks?: Partial<Record<GlobalTextId, string>>
  classCatalog?: ClassCatalogEdits
}

/** The record before anything has been edited. */
export const EMPTY_STUDIO_PROMPTS: StudioPrompts = { schemaVersion: STUDIO_PROMPTS_SCHEMA_VERSION }

/** A pool size as a whole number inside its range, or undefined where it is not a number. */
function clampedSize(key: ClassCatalogKey, value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const { min, max } = CLASS_CATALOG_RANGES[key]
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * The record as it is kept: blank blocks and non-string values left out, pool sizes whole and in
 * range, an empty map dropped. A block equal to its shipped text is the caller's to leave out.
 */
export function studioPromptsToKeep(record: Partial<StudioPrompts> | null | undefined): StudioPrompts {
  const blocks: Record<string, string> = {}
  const stored: unknown = record?.blocks
  if (typeof stored === 'object' && stored !== null && !Array.isArray(stored)) {
    for (const [id, text] of Object.entries(stored)) {
      if (typeof text === 'string' && text.trim() !== '') blocks[id] = text
    }
  }
  const catalog: ClassCatalogEdits = {}
  const sizes: unknown = record?.classCatalog
  if (typeof sizes === 'object' && sizes !== null && !Array.isArray(sizes)) {
    for (const key of Object.keys(CLASS_CATALOG_RANGES) as ClassCatalogKey[]) {
      const size = clampedSize(key, (sizes as Record<string, unknown>)[key])
      if (size !== undefined) catalog[key] = size
    }
  }
  return {
    schemaVersion: STUDIO_PROMPTS_SCHEMA_VERSION,
    ...(Object.keys(blocks).length > 0 ? { blocks: blocks as StudioPrompts['blocks'] } : {}),
    ...(Object.keys(catalog).length > 0 ? { classCatalog: catalog } : {})
  }
}

/** The record with one global block set, or cleared where `text` is undefined or blank. */
export function withBlockText(record: StudioPrompts, id: GlobalTextId, text: string | undefined): StudioPrompts {
  const blocks = { ...record.blocks }
  if (text === undefined) delete blocks[id]
  else blocks[id] = text
  return studioPromptsToKeep({ ...record, blocks })
}

/** Checks a parsed record: this build's version, and an object for each of its two maps. Refusals carry `where`. */
export function readStudioPrompts(parsed: unknown, where: string): StudioPrompts {
  const record = validateRecord<StudioPrompts>(parsed, where, {
    label: 'The studio prompts',
    malformed: { code: 'STUDIO_PROMPTS_MALFORMED', message: 'The studio prompts are damaged.' },
    schemaVersion: { code: 'STUDIO_PROMPTS_SCHEMA_VERSION' },
    expects: STUDIO_PROMPTS_SCHEMA_VERSION,
    required: { schemaVersion: true }
  })
  return studioPromptsToKeep(record)
}
