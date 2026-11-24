import { parseRange, satisfies } from '../../packages/modkit/src/shared/range'
import type { ModDef, ModSwitches } from './mods'
import { andList } from './sentences'
import type { PlaythroughRecord } from './types'

/** Author declarations describe support, not proof of testing or a loading restriction. */
export function compatibilityWarning(mod: Pick<ModDef, 'name' | 'game'>, version: string): string | null {
  if (!mod.game) return `${mod.name} has not declared compatibility with Venus University ${version}. It may not work correctly. You can enable it anyway.`
  if (!parseRange(mod.game)) return `${mod.name} has an unreadable compatibility declaration (${mod.game}). Compatibility with Venus University ${version} is unconfirmed.`
  if (!satisfies(version, mod.game)) return `${mod.name} declares support for Venus University ${mod.game}. Your version is ${version}, outside that range. It may not work correctly. You can enable it anyway.`
  return null
}

/**
 * The warnings for every enabled mod, one per reason rather than one per mod: the mods that
 * declare nothing share a message, as do those declaring the same range. A lone mod reads as
 * {@link compatibilityWarning} does.
 */
export async function compatibilityWarnings(mods: readonly ModDef[], switches: ModSwitches, version: string, record?: Pick<PlaythroughRecord, 'mods'>): Promise<string[]> {
  const { modOn } = await import('./mods')
  const flagged = mods.filter((mod) => !mod.library && modOn(switches, mod.id, record, mods))
    .filter((mod) => compatibilityWarning(mod, version) !== null)
  // Undeclared first, then each readable range in the order its first mod comes; an unreadable
  // declaration keeps its own line, since it quotes what the mod wrote.
  const groups = new Map<string, Pick<ModDef, 'name' | 'game'>[]>()
  const unreadable: string[] = []
  for (const mod of flagged) {
    if (mod.game && !parseRange(mod.game)) { unreadable.push(compatibilityWarning(mod, version)!); continue }
    const key = mod.game ?? ''
    groups.set(key, [...(groups.get(key) ?? []), mod])
  }
  const undeclared = groups.get('')
  const ranges = [...groups].filter(([key]) => key !== '')
  return [
    ...(undeclared ? [groupWarning(undeclared, version)] : []),
    ...ranges.map(([, group]) => groupWarning(group, version)),
    ...unreadable
  ]
}

/** One warning naming every mod in a group that shares its declaration, or declares none. */
function groupWarning(group: readonly Pick<ModDef, 'name' | 'game'>[], version: string): string {
  if (group.length === 1) return compatibilityWarning(group[0], version)!
  const names = andList(group.map((mod) => mod.name))
  const game = group[0].game
  if (!game) return `${names} have not declared compatibility with Venus University ${version}. They may not work correctly. You can enable them anyway.`
  return `${names} declare support for Venus University ${game}. Your version is ${version}, outside that range. They may not work correctly. You can enable them anyway.`
}
