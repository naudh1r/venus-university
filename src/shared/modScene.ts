import type { ModSceneFields } from './types'

/** A deep copy of what mods keep with a scene, or undefined where no mod keeps anything. */
export function savedModScene(fields: Readonly<ModSceneFields>): ModSceneFields | undefined {
  const kept = Object.entries(fields).filter(([, value]) => value !== undefined)
  return kept.length > 0 ? (structuredClone(Object.fromEntries(kept)) as ModSceneFields) : undefined
}
