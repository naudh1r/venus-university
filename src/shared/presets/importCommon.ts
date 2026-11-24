import { bySection, gamePartBlock, withGameParts } from './gameParts'
import { KNOWN_MACROS, macroNames } from './macros'
import type { GameMarker, Preset, PresetBlock, PresetSampling, PresetSource, RegexScript } from './types'

/** The outcome of reading a preset file: the preset and what the import left behind, or why it was refused. */
export type ImportResult =
  | { ok: true; preset: Preset; warnings: string[] }
  | { ok: false; error: string }

/** Where a foreign marker lands: game parts, or `drop` for one the game has no equivalent of. */
export type MarkerMapping = readonly GameMarker[] | 'drop'

/** The marker identifiers SillyTavern and Marinara share, and the game parts they become. */
const MARKER_IDENTIFIERS: Record<string, MarkerMapping> = {
  worldInfoBefore: ['lorebook'],
  worldInfoAfter: ['lorebook'],
  personaDescription: ['reader'],
  charDescription: ['cast'],
  charPersonality: ['cast'],
  scenario: ['setting'],
  dialogueExamples: 'drop',
  chatHistory: ['storySoFar', 'sceneSoFar']
}

/** Marinara's marker types, and the game parts they become. */
const MARKER_TYPES: Record<string, MarkerMapping> = {
  lorebook: ['lorebook'],
  persona: ['reader'],
  character: ['cast'],
  dialogue_examples: 'drop',
  chat_history: ['storySoFar', 'sceneSoFar']
}

/** The game parts a foreign marker stands for, or null when the identifier and type name no marker. */
export function markerMapping(identifier: string | undefined, type: string | undefined): MarkerMapping | null {
  if (type !== undefined && Object.prototype.hasOwnProperty.call(MARKER_TYPES, type)) return MARKER_TYPES[type]
  if (identifier !== undefined && Object.prototype.hasOwnProperty.call(MARKER_IDENTIFIERS, identifier)) {
    return MARKER_IDENTIFIERS[identifier]
  }
  return null
}

/** What the importer reads of one foreign prompt before it becomes a block. */
export interface RawBlock {
  identifier: string
  name: string
  role: unknown
  content: string
  enabled: boolean
  depth: number | null
  wrapXml?: string
}

/** A rule that turns a block off: a test on the block's name and its text (comments removed), and why. */
interface ConflictRule {
  test: (name: string, body: string, identifier: string) => boolean
  reason: string
}

/** Strips the `{{// … }}` comments and `{{trim}}` marks a preset uses as dividers and notes. */
export function withoutAnnotations(content: string): string {
  return content.replace(/\{\{\/\/[\s\S]*?\}\}/g, '').replace(/\{\{trim\}\}/gi, '')
}

const CONFLICT_RULES: readonly ConflictRule[] = [
  {
    test: (name, _body, identifier) => identifier === 'jailbreak' || /jailbreak|icebreaker/i.test(name),
    reason: 'A jailbreak prompt; the game does not need one.'
  },
  {
    test: (_name, body) => /IMG_PROMPT/.test(body),
    reason: 'Asks for image prompts; the game draws its own pictures.'
  },
  {
    test: (_name, body) => /<!--/.test(body) || /<(font|details|summary|div|span|style|img|table)\b/i.test(body),
    reason: 'Asks for HTML or hidden-comment output, but replies are JSON.'
  },
  {
    test: (name) => /time (and|&) place|pop.?in graphics|x feed|twitter|colored dialogue|internal states/i.test(name),
    reason: 'Asks for a header, feed or graphics block the game cannot show.'
  },
  {
    test: (name) => /relationships rpg/i.test(name),
    reason: 'The game already tracks how the characters feel about each other.'
  },
  {
    test: (name) => /\b(turn order|user agency)\b/i.test(name),
    reason: 'The game already decides who acts when.'
  }
]

/** Why a block should start off, or undefined when it fits the game's replies as it is. */
export function conflictOf(name: string, content: string, identifier: string): string | undefined {
  const body = withoutAnnotations(content)
  return CONFLICT_RULES.find((rule) => rule.test(name, body, identifier))?.reason
}

/** The role as a block holds it; anything unrecognised is sent as `user`, which keeps the cached system prompt still. */
function roleOf(role: unknown): PresetBlock['role'] {
  return role === 'system' || role === 'user' || role === 'assistant' ? role : 'user'
}

/** A name safe to use as an XML tag. */
function tagFrom(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** A block id not yet in `used`, taken from `base`. */
export function uniqueId(base: string, used: Set<string>): string {
  const root = base === '' ? 'block' : base
  let id = root
  for (let n = 2; used.has(id); n++) id = `${root}-${n}`
  used.add(id)
  return id
}

/** A foreign prompt as a block, turned off with a reason when it conflicts. */
export function toBlock(raw: RawBlock, used: Set<string>): PresetBlock {
  const conflict = conflictOf(raw.name, raw.content, raw.identifier)
  const block: PresetBlock = {
    id: uniqueId(raw.identifier, used),
    name: raw.name,
    role: roleOf(raw.role),
    enabled: raw.enabled && conflict === undefined,
    position: raw.depth === null ? 'ordered' : 'depth',
    depth: raw.depth ?? 0,
    content: raw.content
  }
  if (raw.wrapXml) block.wrapXml = raw.wrapXml === 'auto' ? tagFrom(raw.name) : raw.wrapXml
  if (conflict !== undefined) block.conflict = conflict
  return block
}

/** True when a prompt says nothing once its notes and dividers are removed. */
export function isBlank(content: string): boolean {
  return withoutAnnotations(content).trim() === ''
}

/** A number off a parsed file, or undefined. */
export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** The samplers worth keeping: a top-k of 0 and a repetition penalty of 1 mean "off" and are left out. */
export function samplingFrom(raw: {
  temperature?: unknown
  topP?: unknown
  topK?: unknown
  repetitionPenalty?: unknown
}): PresetSampling | undefined {
  const sampling: PresetSampling = {}
  const temperature = finiteNumber(raw.temperature)
  const topP = finiteNumber(raw.topP)
  const topK = finiteNumber(raw.topK)
  const repetition = finiteNumber(raw.repetitionPenalty)
  if (temperature !== undefined) sampling.temperature = temperature
  if (topP !== undefined) sampling.topP = topP
  if (topK !== undefined && topK > 0) sampling.topK = topK
  if (repetition !== undefined && repetition !== 1) sampling.repetitionPenalty = repetition
  return Object.keys(sampling).length > 0 ? sampling : undefined
}

/**
 * The preset's rows with the game's parts filled in: each part the preset mentions keeps its
 * place, the rest are added, and the main block (when there is one) sits right after the persona.
 * The rows come back grouped by section.
 */
export function finishBlocks(blocks: PresetBlock[], main: PresetBlock | null): PresetBlock[] {
  const all = withGameParts(blocks)
  if (main) all.splice(all.findIndex((b) => b.marker === 'persona') + 1, 0, main)
  return bySection(all)
}

/** The marker rows a foreign marker becomes, skipping parts a row already stands for. */
export function markerBlocks(mapping: readonly GameMarker[], enabled: boolean, taken: Set<GameMarker>): PresetBlock[] {
  const rows: PresetBlock[] = []
  for (const marker of mapping) {
    if (taken.has(marker)) continue
    taken.add(marker)
    rows.push(gamePartBlock(marker, enabled))
  }
  return rows
}

/** The macro names in enabled blocks that this build does not resolve, for a warning. */
export function unsupportedMacros(blocks: readonly PresetBlock[]): string[] {
  const names = new Set<string>()
  for (const block of blocks) {
    if (block.marker || !block.enabled) continue
    for (const name of macroNames(block.content)) if (name !== '//' && !KNOWN_MACROS.has(name)) names.add(name)
  }
  return [...names].sort()
}

/** The import warnings every format shares, from what the importer counted. */
export function commonWarnings(
  blocks: readonly PresetBlock[],
  counts: { droppedExamples: boolean; regex: number }
): string[] {
  const warnings: string[] = []
  const conflicts = blocks.filter((b) => b.conflict !== undefined).length
  if (conflicts > 0) warnings.push(`${conflicts} block${conflicts === 1 ? '' : 's'} turned off; each says why.`)
  if (counts.droppedExamples) warnings.push('Dialogue examples are not used by the game and were left out.')
  if (counts.regex > 0) warnings.push(`${counts.regex} regex script${counts.regex === 1 ? '' : 's'} kept, turned off.`)
  const unknown = unsupportedMacros(blocks)
  if (unknown.length > 0) warnings.push(`Macros this game does not fill in, sent as written: ${unknown.slice(0, 8).join(', ')}.`)
  return warnings
}

/** Builds the preset record an importer returns. */
export function buildPreset(
  id: string,
  name: string,
  source: PresetSource,
  blocks: PresetBlock[],
  main: PresetBlock | null,
  extras: { sampling?: PresetSampling; regex?: RegexScript[]; notes?: string }
): Preset {
  const preset: Preset = { id, name, source, blocks, mainReplacesPersona: false }
  if (main) {
    preset.mainBlockId = main.id
  } else {
    delete preset.mainReplacesPersona
  }
  if (extras.sampling) preset.sampling = extras.sampling
  if (extras.regex && extras.regex.length > 0) preset.regex = extras.regex
  if (extras.notes) preset.notes = extras.notes
  return preset
}
