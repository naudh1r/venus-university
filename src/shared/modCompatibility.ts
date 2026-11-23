import { parseRange, satisfies } from '../../packages/modkit/src/shared/range'
import type { ModDef, ModSwitches } from './mods'
import type { PlaythroughRecord } from './types'

/** Author declarations describe support, not proof of testing or a loading restriction. */
export function compatibilityWarning(mod: Pick<ModDef, 'name' | 'game'>, version: string): string | null {
  if (!mod.game) return `${mod.name} has not declared compatibility with Venus University ${version}. It may not work correctly. You can enable it anyway.`
  if (!parseRange(mod.game)) return `${mod.name} has an unreadable compatibility declaration (${mod.game}). Compatibility with Venus University ${version} is unconfirmed.`
  if (!satisfies(version, mod.game)) return `${mod.name} declares support for Venus University ${mod.game}. Your version is ${version}, outside that range. It may not work correctly. You can enable it anyway.`
  return null
}

export async function compatibilityWarnings(mods: readonly ModDef[], switches: ModSwitches, version: string, record?: Pick<PlaythroughRecord, 'mods'>): Promise<string[]> {
  const { modOn } = await import('./mods')
  return mods.filter((mod) => !mod.library && modOn(switches, mod.id, record, mods))
    .map((mod) => compatibilityWarning(mod, version)).filter((line): line is string => line !== null)
}
