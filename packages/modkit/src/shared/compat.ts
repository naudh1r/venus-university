import { DEPRECATED_HOOKS, HOOKS, KIT_APIS, REMOVED_HOOKS, type DeprecatedHook, type RemovedHook } from './hookTable'

/**
 * The per-hook compatibility check. Once a hook is in use it never changes, so the only thing
 * that can break a built mod is a hook being removed; a mod's manifest names every hook and kit
 * API it uses, and this compares that list with what core has. Pure: the loader reads the
 * manifests and acts on the answer (switching a mod off for the session, with its data kept).
 */

/** What core offers, as the check reads it; `CORE_SURFACE` is this build's. */
export interface CoreSurface {
  readonly hooks: readonly string[]
  readonly apis: readonly string[]
  readonly deprecated: readonly DeprecatedHook[]
  readonly removed: readonly RemovedHook[]
}

export const CORE_SURFACE: CoreSurface = {
  hooks: HOOKS.map((hook) => hook.name),
  apis: KIT_APIS,
  deprecated: DEPRECATED_HOOKS,
  removed: REMOVED_HOOKS
}

/** A hook or API the manifest names that core does not have. */
export interface MissingHook {
  readonly name: string
  /** The build's release that dropped it (`BUILD.version`); absent for a name core never had. */
  readonly removedIn?: string
  readonly replacedBy?: string
}

export type Compat =
  /** Every name present. `deprecated` names the ones going, for the Mods screen to warn about. */
  | { readonly status: 'loads'; readonly deprecated: readonly DeprecatedHook[] }
  /** A name missing: the mod is switched off with its data kept, and `message` says why. */
  | { readonly status: 'needs-update'; readonly missing: readonly MissingHook[]; readonly message: string }
  /** The mod registers a hook its manifest does not declare: the build and the manifest disagree. */
  | { readonly status: 'refused'; readonly undeclared: readonly string[]; readonly message: string }

/**
 * Checks a manifest's `hooks` list against core. `registered`, when the loader has it, is what
 * the mod actually registered (`hookNamesOf`), and a hook there that the manifest leaves out
 * refuses the mod.
 */
export function checkCompat(
  declared: readonly string[],
  registered?: readonly string[],
  core: CoreSurface = CORE_SURFACE
): Compat {
  const missing = declared
    .filter((name) => !core.hooks.includes(name) && !core.apis.includes(name))
    .map((name): MissingHook => {
      const removed = core.removed.find((hook) => hook.name === name)
      return removed ? { name, removedIn: removed.removedIn, replacedBy: removed.replacedBy } : { name }
    })
  if (missing.length > 0) return { status: 'needs-update', missing, message: needsUpdate(missing) }
  const undeclared = (registered ?? []).filter((name) => !declared.includes(name))
  if (undeclared.length > 0) {
    return {
      status: 'refused',
      undeclared,
      message: `registers ${names(undeclared)} but does not declare ${undeclared.length === 1 ? 'it' : 'them'}: the build and the manifest disagree`
    }
  }
  return { status: 'loads', deprecated: core.deprecated.filter((hook) => declared.includes(hook.name)) }
}

function needsUpdate(missing: readonly MissingHook[]): string {
  const reasons = missing.map(({ name, removedIn, replacedBy }) => {
    const gone = removedIn ? `\`${name}\` no longer exists in core ${removedIn}` : `\`${name}\` is not in this core`
    return replacedBy ? `${gone} (replaced by \`${replacedBy}\`)` : gone
  })
  return `needs an update: ${reasons.join('; ')}`
}

function names(list: readonly string[]): string {
  return list.map((name) => `\`${name}\``).join(', ')
}

/**
 * The names a `registerHooks` call registers, as the manifest spells them: each key with a value,
 * and `prompts`, `requests` and `promptState` spelt out per spot. Takes the object loosely so the main process
 * can read a manifest's claim without the renderer's types.
 */
export function hookNamesOf(hooks: object): string[] {
  return Object.entries(hooks as Record<string, unknown>).flatMap(([key, value]) => {
    if (value === undefined) return []
    if ((key === 'prompts' || key === 'requests' || key === 'promptState') && value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, spot]) => spot !== undefined)
        .map(([spot]) => `${key}.${spot}`)
    }
    return [key]
  })
}

/**
 * A manifest's `hooks` field as the check takes it: an array of names, each a non-empty string
 * with nothing to trim, no name twice. Null where the field is not that, so the loader can refuse
 * a manifest it cannot read rather than guess.
 */
export function manifestHooks(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const hooks: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() !== entry || entry === '' || hooks.includes(entry)) return null
    hooks.push(entry)
  }
  return hooks
}
