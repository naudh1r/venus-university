import { appError } from '@vx/modkit/shared'
import { toPresetFile, validatePreset, type PresetFile } from './presetRules'
import {
  CLASS_CATALOG_RANGES,
  STUDIO_PROMPTS_SCHEMA_VERSION,
  studioPromptsToKeep,
  type StudioPrompts
} from './studioPrompts'
import type { Preset } from './types'

/**
 * Prompt Studio's section backups: one file each for the presets and the game's own prompts. Each
 * has its own marker and version, is checked whole before anything is kept, and is merged into
 * what the player has rather than replacing it.
 */

/** The two sections a backup can hold. */
export type StudioBackupKind = 'presets' | 'prompts'

/** The one version of a section backup this build reads and writes. */
export const STUDIO_BACKUP_SCHEMA_VERSION = 1

/** The largest backup file written or read; a longer one is refused. */
export const MAX_STUDIO_BACKUP_BYTES = 32 * 1024 * 1024

const MAX_BACKUP_PRESETS = 500

/** What each kind's marker is, and what the player calls it. */
const KINDS: Record<StudioBackupKind, { marker: string; word: string }> = {
  presets: { marker: 'venus-studio-presets', word: 'presets' },
  prompts: { marker: 'venus-studio-prompts', word: 'prompts' }
}

/** Every preset and the id in force. */
export interface PresetsBackup {
  kind: typeof KINDS.presets.marker
  schemaVersion: number
  active: string
  presets: PresetFile[]
}

/** The studio prompts record. */
export interface PromptsBackup {
  kind: typeof KINDS.prompts.marker
  schemaVersion: number
  prompts: StudioPrompts
}

/** The backup file of each kind. */
export interface StudioBackupOf {
  presets: PresetsBackup
  prompts: PromptsBackup
}

/** A backup file the player picked, unread by anything but its size. */
export interface StudioBackupFile {
  text: string
  fileName: string
}

/** What the player calls a kind of backup, for a button or a message. */
export function studioBackupWord(kind: StudioBackupKind): string {
  return KINDS[kind].word
}

/** What a backup is called: `prompt-studio-<kind>-<local date>.json`. */
export function studioBackupName(kind: StudioBackupKind, at = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `prompt-studio-${kind}-${date}.json`
}

/** What one exported preset is called: its name, without the characters a file name cannot hold. */
export function presetExportName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '')
  return `${safe === '' ? 'preset' : safe}.json`
}

/** The presets backup of a library. */
export function buildPresetsBackup(presets: readonly Preset[], active: string): PresetsBackup {
  return {
    kind: KINDS.presets.marker,
    schemaVersion: STUDIO_BACKUP_SCHEMA_VERSION,
    active,
    presets: presets.map(toPresetFile)
  }
}

/** The prompts backup of a record, as it is kept. */
export function buildPromptsBackup(prompts: StudioPrompts): PromptsBackup {
  return {
    kind: KINDS.prompts.marker,
    schemaVersion: STUDIO_BACKUP_SCHEMA_VERSION,
    prompts: studioPromptsToKeep(prompts)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The kind a marker names, or null where it names none. */
function kindOfMarker(marker: unknown): StudioBackupKind | null {
  return (Object.keys(KINDS) as StudioBackupKind[]).find((kind) => KINDS[kind].marker === marker) ?? null
}

/** Refuses a file longer than the cap, given its size. */
export function assertStudioBackupSize(size: number): void {
  if (size > MAX_STUDIO_BACKUP_BYTES) throw appError('STUDIO_BACKUP_TOO_LARGE', 'That backup file is too large.')
}

/** Refuses text that is not a Prompt Studio backup of some kind, before it is written out. */
export function assertStudioBackupText(text: string): void {
  assertStudioBackupSize(text.length)
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw appError('STUDIO_BACKUP_INVALID', 'Could not write the backup.', 'the backup is not JSON')
  }
  if (!isRecord(json) || kindOfMarker(json.kind) === null) {
    throw appError('STUDIO_BACKUP_INVALID', 'Could not write the backup.', 'the backup names no kind')
  }
}

type Checked<K extends StudioBackupKind> = { ok: true; backup: StudioBackupOf[K] } | { ok: false; error: string }

/** The presets section of a parsed file, checked whole. */
function checkPresets(json: Record<string, unknown>): Checked<'presets'> {
  if (!Array.isArray(json.presets)) return { ok: false, error: 'The backup holds no presets.' }
  if (json.presets.length > MAX_BACKUP_PRESETS) return { ok: false, error: 'The backup holds too many presets.' }
  const presets: PresetFile[] = []
  const ids = new Set<string>()
  for (const item of json.presets) {
    const checked = validatePreset(item)
    if (!checked.ok) return { ok: false, error: checked.error }
    if (ids.has(checked.preset.id)) return { ok: false, error: `Two presets share the id "${checked.preset.id}".` }
    ids.add(checked.preset.id)
    presets.push(checked.preset)
  }
  if (presets.length === 0) return { ok: false, error: 'The backup holds no presets.' }
  if (typeof json.active !== 'string' || !ids.has(json.active)) {
    return { ok: false, error: 'The backup\'s active preset is not one of its presets.' }
  }
  return { ok: true, backup: buildPresetsBackup(presets, json.active) as PresetsBackup }
}

/** The prompts section of a parsed file, checked whole. */
function checkPrompts(json: Record<string, unknown>): Checked<'prompts'> {
  const record = json.prompts
  if (!isRecord(record)) return { ok: false, error: 'The backup holds no prompts.' }
  if (record.schemaVersion !== STUDIO_PROMPTS_SCHEMA_VERSION) {
    return { ok: false, error: `The prompts have unsupported schemaVersion ${String(record.schemaVersion)}; this build expects ${STUDIO_PROMPTS_SCHEMA_VERSION}.` }
  }
  if (record.blocks !== undefined) {
    if (!isRecord(record.blocks) || Object.values(record.blocks).some((text) => typeof text !== 'string')) {
      return { ok: false, error: 'The prompt blocks are not text.' }
    }
  }
  if (record.classCatalog !== undefined) {
    if (!isRecord(record.classCatalog)) return { ok: false, error: 'The class catalog sizes are not valid.' }
    for (const key of Object.keys(CLASS_CATALOG_RANGES)) {
      const size = record.classCatalog[key]
      if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size))) {
        return { ok: false, error: 'The class catalog sizes are not valid.' }
      }
    }
  }
  return { ok: true, backup: buildPromptsBackup(record as unknown as StudioPrompts) }
}

/**
 * Reads a backup file's text as the kind the player asked to restore. A file of another kind is
 * refused by name, and any part that does not hold up refuses the whole file.
 */
export function parseStudioBackup<K extends StudioBackupKind>(kind: K, text: string): Checked<K> {
  if (text.length > MAX_STUDIO_BACKUP_BYTES) return { ok: false, error: 'That backup file is too large.' }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not a Prompt Studio backup.' }
  }
  if (!isRecord(json)) return { ok: false, error: 'That file is not a Prompt Studio backup.' }
  const found = kindOfMarker(json.kind)
  if (found === null) return { ok: false, error: 'That file is not a Prompt Studio backup.' }
  if (found !== kind) {
    return { ok: false, error: `This is a ${KINDS[found].word} backup, not a ${KINDS[kind].word} backup.` }
  }
  if (json.schemaVersion !== STUDIO_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `The backup has unsupported schemaVersion ${String(json.schemaVersion)}; this build expects ${STUDIO_BACKUP_SCHEMA_VERSION}.`
    }
  }
  const checked = kind === 'presets' ? checkPresets(json) : checkPrompts(json)
  return checked as Checked<K>
}

/**
 * The one preset an exported presets file holds, under `newId`, for Import preset; null where the
 * text is no presets backup. A backup of several presets is refused: Restore presets brings those in.
 */
export function presetFromBackup(text: string, newId: string): { ok: true; preset: Preset } | { ok: false; error: string } | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(json) || json.kind !== KINDS.presets.marker) return null
  const checked = parseStudioBackup('presets', text)
  if (!checked.ok) return checked
  if (checked.backup.presets.length !== 1) {
    return { ok: false, error: 'That file holds several presets. Restore presets brings them all in.' }
  }
  const { schemaVersion: _version, ...preset } = checked.backup.presets[0]
  return { ok: true, preset: { ...preset, id: newId } }
}

/** What restoring a presets backup writes: every preset in the file, and the file's active one in force. */
export interface PresetsMerge {
  save: PresetFile[]
  active: string
  /** Presets in the file that nothing here has the id of. */
  added: number
  /** Presets in the file that replace one here. */
  replaced: number
}

/** Presets merge by id, the file winning; the file's active preset becomes the active one. */
export function mergePresets(currentIds: readonly string[], file: PresetsBackup): PresetsMerge {
  const held = new Set(currentIds)
  const replaced = file.presets.filter((preset) => held.has(preset.id)).length
  return { save: file.presets, active: file.active, added: file.presets.length - replaced, replaced }
}

/** The record with the file's blocks over its own, block by block, and the file's catalog sizes over its own, size by size. */
export function mergePrompts(current: StudioPrompts, file: StudioPrompts): StudioPrompts {
  return studioPromptsToKeep({
    ...current,
    blocks: { ...current.blocks, ...file.blocks },
    classCatalog: { ...current.classCatalog, ...file.classCatalog }
  })
}
