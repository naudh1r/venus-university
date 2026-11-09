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
import type { GameMarker, PresetBlock, RegexScript } from './types'

/** The prompt_order entry SillyTavern's global order lives under. */
const GLOBAL_ORDER_ID = 100001

type Json = Record<string, unknown>

/** True for a plain object. */
function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The order list to use: the global one, else the first that is a list. */
function pickOrder(raw: unknown): { identifier: string; enabled: boolean | undefined }[] | null {
  if (!Array.isArray(raw)) return null
  const entries = raw.filter(isObject)
  const chosen = entries.find((e) => e.character_id === GLOBAL_ORDER_ID) ?? entries.find((e) => Array.isArray(e.order))
  if (!chosen || !Array.isArray(chosen.order)) return null
  return chosen.order.filter(isObject).flatMap((o) =>
    typeof o.identifier === 'string' ? [{ identifier: o.identifier, enabled: typeof o.enabled === 'boolean' ? o.enabled : undefined }] : []
  )
}

/** SillyTavern's regex scripts as disabled reference entries. */
function regexScripts(json: Json): RegexScript[] {
  const extensions = json.extensions
  const scripts = isObject(extensions) ? extensions.regex_scripts : undefined
  if (!Array.isArray(scripts)) return []
  return scripts.filter(isObject).flatMap((s) =>
    typeof s.findRegex === 'string'
      ? [{
          name: typeof s.scriptName === 'string' ? s.scriptName : 'Script',
          find: s.findRegex,
          replace: typeof s.replaceString === 'string' ? s.replaceString : '',
          enabled: false
        }]
      : []
  )
}

/**
 * Reads a SillyTavern chat-completion preset. Order and enabled flags come from the global
 * `prompt_order` (which beats each prompt's own flag); markers become game parts; `main` becomes a
 * block right after the persona; in-chat prompts become depth blocks; prompts that ask for output
 * the game cannot use are imported off.
 */
export function importSillyTavern(json: Json, name: string, id: string): ImportResult {
  if (!Array.isArray(json.prompts)) return { ok: false, error: 'That SillyTavern preset has no prompts.' }
  const prompts = new Map<string, Json>()
  for (const p of json.prompts) if (isObject(p) && typeof p.identifier === 'string') prompts.set(p.identifier, p)

  const order = pickOrder(json.prompt_order)
  const sequence: { identifier: string; enabled: boolean | undefined }[] = order
    ? order.filter((o) => prompts.has(o.identifier))
    : [...prompts.keys()].map((identifier) => ({ identifier, enabled: undefined }))
  const listed = new Set(sequence.map((o) => o.identifier))
  const unlisted = order ? [...prompts.keys()].filter((identifier) => !listed.has(identifier)) : []

  const used = new Set<string>()
  const taken = new Set<GameMarker>()
  const blocks: PresetBlock[] = []
  const found: { main: PresetBlock | null } = { main: null }
  let droppedExamples = false

  const add = (identifier: string, enabledByOrder: boolean | undefined, forceOff: boolean): void => {
    const p = prompts.get(identifier)
    if (!p) return
    const enabled = !forceOff && (enabledByOrder ?? (typeof p.enabled === 'boolean' ? p.enabled : true))

    const mapping = markerMapping(identifier, undefined)
    if (mapping === 'drop') {
      droppedExamples = true
      return
    }
    if (mapping) {
      blocks.push(...markerBlocks(mapping, enabled, taken))
      return
    }
    if (p.marker === true) return

    const content = typeof p.content === 'string' ? p.content : ''
    if (isBlank(content)) return
    const block = toBlock(
      {
        identifier,
        name: typeof p.name === 'string' && p.name.trim() !== '' ? p.name : identifier,
        role: p.role,
        content,
        enabled,
        depth: p.injection_position === 1 ? Math.max(0, Math.floor(Number(p.injection_depth) || 0)) : null
      },
      used
    )
    if (identifier === 'main' && found.main === null) {
      block.position = 'ordered'
      block.depth = 0
      found.main = block
      return
    }
    blocks.push(block)
  }

  for (const entry of sequence) add(entry.identifier, entry.enabled, false)
  for (const identifier of unlisted) add(identifier, undefined, true)

  const finished = finishBlocks(blocks, found.main)
  const regex = regexScripts(json)
  const warnings = commonWarnings(finished, { droppedExamples, regex: regex.length })
  if (unlisted.length > 0) warnings.push(`${unlisted.length} prompt${unlisted.length === 1 ? '' : 's'} outside the prompt order kept, turned off.`)

  const preset = buildPreset(id, name, 'sillytavern', finished, found.main, {
    sampling: samplingFrom({
      temperature: json.temperature,
      topP: json.top_p,
      topK: json.top_k,
      repetitionPenalty: json.repetition_penalty
    }),
    regex
  })
  return { ok: true, preset, warnings }
}
