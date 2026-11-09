import {
  buildPreset,
  commonWarnings,
  finishBlocks,
  isBlank,
  markerBlocks,
  markerMapping,
  samplingFrom,
  toBlock,
  type ImportResult
} from './importCommon'
import type { GameMarker, PresetBlock } from './types'

type Json = Record<string, unknown>

/** True for a plain object. */
function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses a JSON-encoded string field; undefined when it is absent or not JSON. */
function parseField(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

/** Marinara writes booleans as the strings "true" and "false". */
function flag(value: unknown): boolean {
  return value === true || value === 'true'
}

/** A section's text with Marinara's `{{choice}}` variables filled in from the preset's chosen values. */
function withChoices(content: string, choices: Record<string, string>): string {
  return content.replace(/\{\{\s*([^{}:]+?)\s*\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(choices, key) ? choices[key] : whole
  )
}

/** The preset's chosen values for its choice blocks, as `name -> text`. */
function chosenValues(preset: Json): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of [preset.defaultChoices, preset.variableValues]) {
    const parsed = parseField(field)
    if (!isObject(parsed)) continue
    for (const [key, value] of Object.entries(parsed)) if (typeof value === 'string') out[key] = value
  }
  return out
}

/**
 * Reads a Marinara preset export. The section order is `sectionOrder`; string booleans are read as
 * booleans; choice variables are replaced with their chosen text; the section with identifier `main`
 * (Marinara's equivalent of SillyTavern's main prompt) becomes the main block when it has text.
 */
export function importMarinara(json: Json, name: string, id: string): ImportResult {
  const data = json.data
  if (!isObject(data) || !Array.isArray(data.sections)) return { ok: false, error: 'That Marinara preset has no sections.' }
  const preset = isObject(data.preset) ? data.preset : {}
  const sections = data.sections.filter(isObject).filter((s) => typeof s.id === 'string')

  const byId = new Map(sections.map((s) => [s.id as string, s]))
  const orderIds = parseField(preset.sectionOrder)
  const ordered: Json[] = []
  const seen = new Set<string>()
  if (Array.isArray(orderIds)) {
    for (const key of orderIds) {
      const section = typeof key === 'string' ? byId.get(key) : undefined
      if (section && !seen.has(key as string)) {
        seen.add(key as string)
        ordered.push(section)
      }
    }
  }
  for (const section of sections) if (!seen.has(section.id as string)) ordered.push(section)

  const choices = chosenValues(preset)
  const used = new Set<string>()
  const taken = new Set<GameMarker>()
  const blocks: PresetBlock[] = []
  const found: { main: PresetBlock | null } = { main: null }
  let droppedExamples = false
  let emptied = 0

  for (const s of ordered) {
    const identifier = typeof s.identifier === 'string' ? s.identifier : (s.id as string)
    const enabled = flag(s.enabled)

    if (flag(s.isMarker)) {
      const config = parseField(s.markerConfig)
      const type = isObject(config) && typeof config.type === 'string' ? config.type : undefined
      const mapping = markerMapping(identifier, type)
      if (mapping === 'drop') droppedExamples = true
      else if (mapping) blocks.push(...markerBlocks(mapping, enabled, taken))
      continue
    }

    const raw = typeof s.content === 'string' ? s.content : ''
    const content = withChoices(raw, choices)
    if (isBlank(content)) {
      if (!isBlank(raw)) emptied++
      continue
    }
    const wrap = flag(s.wrapInXml)
    const tag = typeof s.xmlTagName === 'string' ? s.xmlTagName.trim() : ''
    const block = toBlock(
      {
        identifier,
        name: typeof s.name === 'string' && s.name.trim() !== '' ? s.name : identifier,
        role: s.role,
        content,
        enabled,
        depth: s.injectionPosition === 'depth' ? Math.max(0, Math.floor(Number(s.injectionDepth) || 0)) : null,
        wrapXml: wrap ? (tag !== '' ? tag : 'auto') : undefined
      },
      used
    )
    if (identifier === 'main' && found.main === null) {
      block.position = 'ordered'
      block.depth = 0
      found.main = block
      continue
    }
    blocks.push(block)
  }

  const finished = finishBlocks(blocks, found.main)
  const warnings = commonWarnings(finished, { droppedExamples, regex: 0 })
  if (emptied > 0) warnings.push(`${emptied} toggle${emptied === 1 ? '' : 's'} with nothing chosen left out.`)

  const parameters = parseField(preset.parameters)
  const description = typeof preset.description === 'string' ? preset.description.trim() : ''
  const result = buildPreset(id, name, 'marinara', finished, found.main, {
    sampling: isObject(parameters) ? samplingFrom(parameters) : undefined,
    notes: description !== '' ? description : undefined
  })
  return { ok: true, preset: result, warnings }
}
