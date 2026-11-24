import { KNOWN_MACROS } from './macros'
import type { Preset } from './types'

/** Macros that read or write a named variable, whose first argument is that name. */
const VAR_MACROS: ReadonlySet<string> = new Set(['setvar', 'getvar', 'addvar', 'incvar', 'decvar'])

/** One macro a preset writes, where it writes it, and the variables it names. */
export interface MacroUse {
  /** Lowercased, as the resolver reads it. */
  name: string
  known: boolean
  /** How many of the preset's own blocks hold it. */
  blocks: number
  /** How many of the preset's scene text edits hold it, where macros are sent as written. */
  sceneTexts: number
  /** The variables it names, sorted. */
  vars: string[]
  /** The macro exactly as it is most often written bare, e.g. `{{char}}`; absent when it always takes arguments. */
  bare?: string
}

/** Every macro opening in `text`, with its name lowercased and the variable it names where it names one. */
function macrosIn(text: string): { name: string; variable?: string; bare?: string }[] {
  const found: { name: string; variable?: string; bare?: string }[] = []
  for (const match of text.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(::\s*([^:{}]+))?(\}\})?/g)) {
    const name = match[1].toLowerCase()
    const variable = VAR_MACROS.has(name) ? match[3]?.trim() : undefined
    found.push({ name, ...(variable ? { variable } : {}), ...(match[4] && !match[2] ? { bare: match[0] } : {}) })
  }
  return found
}

/**
 * The macros a preset writes in its own blocks and its scene text edits, comments left out: the
 * ones the resolver knows first in its order, then the rest by name.
 */
export function presetMacros(preset: Preset): MacroUse[] {
  const uses = new Map<string, { use: MacroUse; vars: Set<string>; bares: Map<string, number> }>()

  /** Counts one text's macros against `field`, once per macro per text. */
  const scan = (text: string, field: 'blocks' | 'sceneTexts'): void => {
    const seen = new Set<string>()
    for (const { name, variable, bare } of macrosIn(text)) {
      let entry = uses.get(name)
      if (!entry) {
        entry = {
          use: { name, known: KNOWN_MACROS.has(name), blocks: 0, sceneTexts: 0, vars: [] },
          vars: new Set(),
          bares: new Map()
        }
        uses.set(name, entry)
      }
      if (!seen.has(name)) entry.use[field]++
      seen.add(name)
      if (variable) entry.vars.add(variable)
      if (bare) entry.bares.set(bare, (entry.bares.get(bare) ?? 0) + 1)
    }
  }

  for (const block of preset.blocks) if (!block.marker) scan(block.content, 'blocks')
  for (const text of Object.values(preset.overrides ?? {})) if (typeof text === 'string') scan(text, 'sceneTexts')

  const order = [...KNOWN_MACROS]
  return [...uses.values()]
    .map(({ use, vars, bares }) => {
      const bare = [...bares.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      return { ...use, vars: [...vars].sort(), ...(bare ? { bare } : {}) }
    })
    .sort((a, b) => {
      const ra = a.known ? order.indexOf(a.name) : order.length
      const rb = b.known ? order.indexOf(b.name) : order.length
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name)
    })
}

/** How many times `find` appears in the preset's own blocks, their names included, and its scene text edits. */
export function countMatches(preset: Preset, find: string): number {
  if (find === '') return 0
  const count = (text: string): number => text.split(find).length - 1
  let total = 0
  for (const block of preset.blocks) if (!block.marker) total += count(block.name) + count(block.content)
  for (const text of Object.values(preset.overrides ?? {})) if (typeof text === 'string') total += count(text)
  return total
}

/** Swaps every match of `find` in `text`; a blank `find` changes nothing. */
function replaced(text: string, find: string, replacement: string): string {
  return find === '' ? text : text.split(find).join(replacement)
}

/** The preset with `find` swapped for `replacement` in its own blocks' names and text and in its scene text edits. */
export function presetWithReplacement(preset: Preset, find: string, replacement: string): Preset {
  const overrides = preset.overrides
    ? Object.fromEntries(
        Object.entries(preset.overrides).map(([id, text]) => [
          id,
          typeof text === 'string' ? replaced(text, find, replacement) : text
        ])
      )
    : undefined
  return {
    ...preset,
    blocks: preset.blocks.map((block) =>
      block.marker
        ? block
        : {
            ...block,
            name: replaced(block.name, find, replacement),
            content: replaced(block.content, find, replacement)
          }
    ),
    ...(overrides ? { overrides } : {})
  }
}
