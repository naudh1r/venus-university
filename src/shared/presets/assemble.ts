import { bySection, withGameParts } from './gameParts'
import { resolveMacros } from './macros'
import {
  GAME_MARKERS,
  PROTECTED_MARKERS,
  SYSTEM_MARKERS,
  type GameMarker,
  type GamePart,
  type Preset,
  type PresetBlock
} from './types'

/**
 * Applying a preset to a scene request: the game's own parts are found again inside the final
 * `system` and `user` strings, reordered or switched off as the preset says, and the preset's blocks
 * are put between them. Text the game's mods added after the parts were built stays where it was.
 */

/** A reply schema envelope, as a builder returns it. */
export interface SchemaEnvelope {
  name: string
  schema: Record<string, unknown>
}

/** What a preset is applied to. `parts` is what the scene builder emitted; without it the request is treated as two opaque texts. */
export interface PresetInput {
  system: string
  user: string
  schema: SchemaEnvelope
  parts?: GamePart[]
}

/** The names a preset's macros fill in. */
export interface PresetContext {
  user: string
  char: string
  group: string
  rand: () => number
}

export interface PresetOutput {
  system: string
  user: string
  schema: SchemaEnvelope
  /** The variables after the preset's `setvar`-style macros ran. */
  vars: Record<string, string>
}

/** The blank line between a preset block and what it sits beside. */
const BLOCK_GAP = '\n\n'

/** One run of text in a side's final string, with the separator that followed it in the original. */
interface Unit {
  text: string
  sepAfter: string
  /** Set on a game part's own text; extras and preset blocks leave it unset. */
  part?: GameMarker
  /** Set on a preset block, which is always set off from its neighbours by a blank line. */
  block?: true
}

/** A side's string cut into its parts, the text mods added around them, and the whitespace at its ends. */
interface Layout {
  lead: string
  startUnits: Unit[]
  segments: Map<GameMarker, Unit[]>
  /** Parts in the order they stand in the string. */
  physical: GameMarker[]
  tail: string
}

/** The `vars` property a scene reply may carry; Gemini-safe, so no item bounds. */
const VARS_PROPERTY = {
  type: 'array',
  description: "Changes to the story's tracked variables. Leave empty unless the instructions name a variable to update.",
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'op', 'value'],
    properties: {
      name: { type: 'string' },
      op: { type: 'string', enum: ['set', 'add', 'append'] },
      value: { type: 'string' }
    }
  }
}

/** The schema with an optional `vars` property added last, so the properties before it keep their streaming order. */
export function addVarsToSchema(schema: SchemaEnvelope): SchemaEnvelope {
  const properties = schema.schema.properties
  if (typeof properties !== 'object' || properties === null || 'vars' in properties) return schema
  return { ...schema, schema: { ...schema.schema, properties: { ...properties, vars: VARS_PROPERTY } } }
}

/** The leading and trailing whitespace of `text` and what lies between. */
function splitSpace(text: string): { lw: string; core: string; tw: string } {
  const core = text.trim()
  if (core === '') return { lw: text, core, tw: '' }
  const start = text.indexOf(core)
  return { lw: text.slice(0, start), core, tw: text.slice(start + core.length) }
}

/**
 * Finds `parts` in order inside `text` and cuts it around them; null when one is missing or
 * out of order. Text before the first part counts as the story recall when `recallAllowed`.
 */
function layoutSide(text: string, parts: readonly GamePart[], recallAllowed: boolean): Layout | null {
  const found: { part: GamePart; start: number; end: number }[] = []
  let cursor = 0
  const seen = new Set<GameMarker>()
  for (const part of parts) {
    if (part.text === '') continue
    if (seen.has(part.id)) return null
    const start = text.indexOf(part.text, cursor)
    if (start < 0) return null
    seen.add(part.id)
    found.push({ part, start, end: start + part.text.length })
    cursor = start + part.text.length
  }

  const layout: Layout = { lead: '', startUnits: [], segments: new Map(), physical: [], tail: '' }
  const prefix = splitSpace(text.slice(0, found.length > 0 ? found[0].start : text.length))
  layout.lead = prefix.lw
  if (found.length === 0) {
    if (prefix.core !== '') layout.startUnits.push({ text: prefix.core, sepAfter: '' })
    layout.tail = prefix.tw
    return layout
  }
  if (prefix.core !== '') {
    if (recallAllowed) {
      layout.segments.set('storyRecall', [{ text: prefix.core, sepAfter: prefix.tw, part: 'storyRecall' }])
      layout.physical.push('storyRecall')
    } else {
      layout.startUnits.push({ text: prefix.core, sepAfter: prefix.tw })
    }
  }

  found.forEach((entry, i) => {
    const next = found[i + 1]
    const gap = splitSpace(text.slice(entry.end, next ? next.start : text.length))
    const units: Unit[] = [{ text: entry.part.text, sepAfter: gap.lw, part: entry.part.id }]
    if (gap.core === '') {
      if (!next) {
        units[0].sepAfter = ''
        layout.tail = gap.lw
      }
    } else {
      units.push({ text: gap.core, sepAfter: next ? gap.tw : '' })
      if (!next) layout.tail = gap.tw
    }
    layout.segments.set(entry.part.id, units)
    layout.physical.push(entry.part.id)
  })
  return layout
}

/** Joins a side's units back into the string it was cut from; nothing when no unit is left. */
function joinUnits(units: readonly Unit[], lead: string, tail: string): string {
  if (units.length === 0) return ''
  return lead + units.map((u, i) => u.text + (i < units.length - 1 ? (u.block || units[i + 1].block ? BLOCK_GAP : u.sepAfter) : '')).join('') + tail
}

/** A block's resolved text, wrapped and labelled; null when it came to nothing. */
function renderBlock(block: PresetBlock, vars: Map<string, string>, ctx: PresetContext): string | null {
  let text = resolveMacros(block.content, { ...ctx, vars }).trim()
  if (text === '') return null
  const tag = (block.wrapXml ?? '').replace(/[^A-Za-z0-9_.-]/g, '_')
  if (tag !== '') text = `<${tag}>\n${text}\n</${tag}>`
  // A single user message has no assistant turn; the block goes in as a labelled user block.
  if (block.role === 'assistant') text = `[assistant]\n${text}`
  return text
}

/** The side of the request a block's role puts it on. */
function sideOf(block: PresetBlock): 'system' | 'user' {
  return block.role === 'system' ? 'system' : 'user'
}

/** True when the parts are listed in the shipped relative order. */
function isShippedOrder(markers: readonly GameMarker[]): boolean {
  const ranks = markers.map((m) => GAME_MARKERS.indexOf(m))
  return ranks.every((rank, i) => i === 0 || rank > ranks[i - 1])
}

/** The first row for each game part. */
function partRows(blocks: readonly PresetBlock[]): Map<GameMarker, PresetBlock> {
  const rows = new Map<GameMarker, PresetBlock>()
  for (const block of blocks) if (block.marker && !rows.has(block.marker)) rows.set(block.marker, block)
  return rows
}

/** Inserts depth blocks into `units`: depth 0 at the end, depth N in front of the Nth part from the end. */
function insertDepth(units: readonly Unit[], depthUnits: readonly { depth: number; unit: Unit }[]): Unit[] {
  const partAt = units.flatMap((u, i) => (u.part ? [i] : []))
  const before = new Map<number, Unit[]>()
  const atEnd: Unit[] = []
  for (const { depth, unit } of depthUnits) {
    if (depth <= 0 || partAt.length === 0) {
      atEnd.push(unit)
      continue
    }
    const index = partAt[Math.max(0, partAt.length - depth)]
    before.set(index, [...(before.get(index) ?? []), unit])
  }
  const out: Unit[] = []
  units.forEach((u, i) => out.push(...(before.get(i) ?? []), u))
  return [...out, ...atEnd]
}

/**
 * The fallback arrangement for a request whose parts are not known: each string is one block;
 * preset blocks standing before the side's first part go in front of it and the rest behind it.
 */
function arrangeWhole(
  input: PresetInput,
  blocks: readonly PresetBlock[],
  ordered: readonly PresetBlock[],
  depthBlocks: readonly PresetBlock[],
  unitOf: (block: PresetBlock) => Unit
): { system: string; user: string } {
  const systemSide: ReadonlySet<GameMarker> = new Set(SYSTEM_MARKERS)
  const sides = {
    system: { before: [] as Unit[], after: [] as Unit[] },
    user: { before: [] as Unit[], after: [] as Unit[] }
  }
  const seenMarker = { system: false, user: false }
  for (const block of blocks) {
    if (block.marker) {
      seenMarker[systemSide.has(block.marker) ? 'system' : 'user'] = true
    } else if (ordered.includes(block)) {
      const side = sideOf(block)
      sides[side][seenMarker[side] ? 'after' : 'before'].push(unitOf(block))
    }
  }
  for (const block of depthBlocks) {
    const side = sideOf(block)
    sides[side][side === 'user' && block.depth > 0 ? 'before' : 'after'].push(unitOf(block))
  }

  const join = (text: string, side: { before: Unit[]; after: Unit[] }): string => {
    const game: Unit[] = text === '' ? [] : [{ text, sepAfter: BLOCK_GAP }]
    return joinUnits([...side.before, ...game, ...side.after], '', '')
  }
  return { system: join(input.system, sides.system), user: join(input.user, sides.user) }
}

/**
 * Applies `preset` to one scene request, its rows taken system first, then user, then depth, so
 * their order across sides counts for nothing. Preset blocks resolve their macros in that order against
 * `vars` (never the game's own text); `jsonRules` is always kept and stays in `system`; with
 * `mainReplacesPersona` and its main block present the persona part is dropped. A part the preset
 * turns off takes the text mods pinned after it along. When `parts` is absent or cannot be found in
 * the final strings the two strings are arranged whole, so neither the persona switch nor a depth
 * can reach inside them. The default preset returns both strings unchanged.
 */
export function applyPreset(
  input: PresetInput,
  preset: Preset,
  vars: Readonly<Record<string, string>>,
  ctx: PresetContext
): PresetOutput {
  const blocks = bySection(withGameParts(preset.blocks))
  const rows = partRows(blocks)
  const map = new Map(Object.entries(vars))

  // Macros run in section order across every enabled block, so a later block reads an earlier one's variables.
  const rendered = new Map<PresetBlock, string>()
  for (const block of blocks) {
    if (block.marker || !block.enabled) continue
    const text = renderBlock(block, map, ctx)
    if (text !== null) rendered.set(block, text)
  }
  const unitOf = (block: PresetBlock): Unit => ({ text: rendered.get(block) ?? '', sepAfter: BLOCK_GAP, block: true })
  const ordered = blocks.filter((b) => rendered.has(b) && b.position === 'ordered')
  const depthBlocks = blocks.filter((b) => rendered.has(b) && b.position === 'depth')

  const schema = addVarsToSchema(input.schema)
  const finish = (arranged: { system: string; user: string }): PresetOutput => ({
    ...arranged,
    schema,
    vars: Object.fromEntries(map)
  })

  const parts = input.parts ?? []
  const systemLayout = input.parts
    ? layoutSide(input.system, parts.filter((p) => p.role === 'system'), false)
    : null
  const userParts = parts.filter((p) => p.role === 'user')
  const userLayout = input.parts
    ? layoutSide(input.user, userParts, !userParts.some((p) => p.id === 'storyRecall'))
    : null
  if (!systemLayout || !userLayout) return finish(arrangeWhole(input, blocks, ordered, depthBlocks, unitOf))

  const mainBlock = preset.mainReplacesPersona && preset.mainBlockId
    ? blocks.some((b) => b.id === preset.mainBlockId)
    : false
  const enabledPart = (marker: GameMarker): boolean => {
    if (PROTECTED_MARKERS.includes(marker)) return true
    if (marker === 'persona' && mainBlock) return false
    return rows.get(marker)?.enabled === true
  }

  const presetMarkers = blocks.flatMap((b) => (b.marker && rows.get(b.marker) === b ? [b.marker] : []))
  const shipped = isShippedOrder(presetMarkers)

  const build = (side: 'system' | 'user', layout: Layout): string => {
    const base = shipped ? layout.physical : presetMarkers
    const emitted = base.filter((m) => layout.segments.has(m) && enabledPart(m))
    const shown = new Set(emitted)

    // Each block follows the nearest preceding part this side still shows.
    const anchored = new Map<GameMarker | null, Unit[]>()
    let current: GameMarker | null = null
    for (const block of blocks) {
      if (block.marker) {
        if (rows.get(block.marker) === block && shown.has(block.marker)) current = block.marker
      } else if (ordered.includes(block) && sideOf(block) === side) {
        anchored.set(current, [...(anchored.get(current) ?? []), unitOf(block)])
      }
    }

    let units: Unit[] = [...layout.startUnits, ...(anchored.get(null) ?? [])]
    for (const marker of emitted) {
      units.push(...(layout.segments.get(marker) ?? []), ...(anchored.get(marker) ?? []))
    }
    const depthOnSide = depthBlocks.filter((b) => sideOf(b) === side)
    if (side === 'user') {
      units = insertDepth(units, depthOnSide.map((b) => ({ depth: b.depth, unit: unitOf(b) })))
    } else {
      units.push(...depthOnSide.map(unitOf))
    }
    return joinUnits(units, layout.lead, layout.tail)
  }

  return finish({ system: build('system', systemLayout), user: build('user', userLayout) })
}
