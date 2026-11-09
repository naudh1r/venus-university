/**
 * Prompt macros: the `{{…}}` forms a SillyTavern or Marinara preset writes into its blocks, resolved
 * inner-first and left to right against one shared variable map. A macro it does not know is left
 * as written, and a value a macro produces is never resolved again.
 */

/** What a resolution reads and writes. `vars` is updated in place. */
export interface MacroContext {
  vars: Map<string, string> | Record<string, string>
  user: string
  char: string
  group: string
  rand: () => number
}

/** The macro names this resolver evaluates. */
export const KNOWN_MACROS: ReadonlySet<string> = new Set([
  'user', 'char', 'group', 'setvar', 'getvar', 'addvar', 'incvar', 'decvar', 'roll', 'random', 'trim'
])

/** Macros whose output never changes between calls, so a block holding only these stays cacheable. */
const STATIC_MACROS: ReadonlySet<string> = new Set(['user', 'char', 'group', 'trim', '//'])

const MAX_EVALUATIONS = 5000
const MAX_DICE = 100
const MAX_SIDES = 1000
/** Stand-ins for the braces of text a macro has already produced, so it is not resolved again. */
const OPEN = ''
const CLOSE = ''

/** Hides the braces of produced text from later passes. */
function escapeBraces(text: string): string {
  return text.replace(/\{/g, OPEN).replace(/\}/g, CLOSE)
}

/** Restores braces hidden by {@link escapeBraces}. */
function unescapeBraces(text: string): string {
  return text.replace(//g, '{').replace(//g, '}')
}

/** True for a string that reads as a finite number. */
function isNumeric(text: string): boolean {
  return text.trim() !== '' && Number.isFinite(Number(text))
}

/** Reads one variable from either shape of map; unset reads as undefined. */
function readVar(vars: MacroContext['vars'], name: string): string | undefined {
  if (vars instanceof Map) return vars.get(name)
  return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : undefined
}

/** Writes one variable to either shape of map. */
function writeVar(vars: MacroContext['vars'], name: string, value: string): void {
  if (vars instanceof Map) vars.set(name, value)
  else Object.defineProperty(vars, name, { value, enumerable: true, writable: true, configurable: true })
}

/** Rolls `NdM`, `dM`, `M` or any of those plus or minus a constant; null when the text is not dice. */
function rollDice(spec: string, rand: () => number): number | null {
  const match = /^(\d*)d?(\d+)([+-]\d+)?$/i.exec(spec.trim())
  if (!match) return null
  const hasD = /d/i.test(spec)
  const count = hasD ? (match[1] === '' ? 1 : Number(match[1])) : 1
  const sides = Number(match[2])
  if (count < 1 || count > MAX_DICE || sides < 1 || sides > MAX_SIDES) return null
  let total = match[3] ? Number(match[3]) : 0
  for (let i = 0; i < count; i++) total += 1 + Math.floor(rand() * sides)
  return total
}

/** Evaluates one macro body (the text between the braces) to its output, or null when it is not one this resolver knows. */
function evaluate(body: string, ctx: MacroContext): string | null {
  if (body.startsWith('//')) return ''

  const named = /^\s*([A-Za-z]+)\s*(::|:)?([\s\S]*)$/.exec(body)
  if (!named) return null
  const name = named[1].toLowerCase()
  if (!KNOWN_MACROS.has(name)) return null
  const bare = named[2] === undefined
  const rest = unescapeBraces(named[3])
  const parts = rest.split('::')

  switch (name) {
    case 'user':
      return bare && named[3].trim() === '' ? ctx.user : null
    case 'char':
      return bare && named[3].trim() === '' ? ctx.char : null
    case 'group':
      return bare && named[3].trim() === '' ? ctx.group : null
    case 'trim':
      return null
    case 'setvar': {
      if (bare || parts.length < 2) return null
      writeVar(ctx.vars, parts[0].trim(), parts.slice(1).join('::'))
      return ''
    }
    case 'getvar': {
      if (bare) return null
      const current = readVar(ctx.vars, parts[0].trim())
      return current ?? (parts.length > 1 ? parts.slice(1).join('::') : '')
    }
    case 'addvar': {
      if (bare || parts.length < 2) return null
      const key = parts[0].trim()
      const value = parts.slice(1).join('::')
      const current = readVar(ctx.vars, key) ?? ''
      writeVar(ctx.vars, key, isNumeric(current) && isNumeric(value) ? String(Number(current) + Number(value)) : current + value)
      return ''
    }
    case 'incvar':
    case 'decvar': {
      if (bare) return null
      const key = parts[0].trim()
      const current = readVar(ctx.vars, key)
      const base = current !== undefined && isNumeric(current) ? Number(current) : 0
      const next = String(name === 'incvar' ? base + 1 : base - 1)
      writeVar(ctx.vars, key, next)
      return next
    }
    case 'roll': {
      if (bare) return null
      const total = rollDice(rest, ctx.rand)
      return total === null ? null : String(total)
    }
    case 'random': {
      if (bare) return null
      const options = named[2] === ':' && !rest.includes('::') ? rest.split(',') : parts
      if (options.length === 0) return ''
      return options[Math.min(options.length - 1, Math.floor(ctx.rand() * options.length))].trim()
    }
  }
  return null
}

/**
 * Resolves every macro in `text`, innermost first and left to right. `{{trim}}` also removes the
 * line breaks around it. Variables persist in `ctx.vars`, so blocks resolved one after another
 * share them.
 */
export function resolveMacros(text: string, ctx: MacroContext): string {
  const inner = /\{\{((?:(?!\{\{|\}\})[\s\S])*)\}\}/
  let s = text
  for (let i = 0; i < MAX_EVALUATIONS; i++) {
    const match = inner.exec(s)
    if (!match) break
    let start = match.index
    let end = start + match[0].length
    const body = match[1]
    let output: string
    if (body.trim().toLowerCase() === 'trim') {
      while (start > 0 && (s[start - 1] === '\n' || s[start - 1] === '\r')) start--
      while (end < s.length && (s[end] === '\n' || s[end] === '\r')) end++
      output = ''
    } else {
      const result = evaluate(body, ctx)
      output = escapeBraces(result ?? match[0])
    }
    s = s.slice(0, start) + output + s.slice(end)
  }
  return unescapeBraces(s)
}

/** The macro names written in `text`, lowercased, comments as `//`. */
export function macroNames(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(/\{\{\s*(\/\/|[A-Za-z_][A-Za-z0-9_]*)/g)) names.push(match[1].toLowerCase())
  return names
}

/** True when `text` holds a macro whose output can change between calls, which a cached system prompt cannot carry. */
export function hasDynamicMacros(text: string): boolean {
  return macroNames(text).some((name) => !STATIC_MACROS.has(name))
}
