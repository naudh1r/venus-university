import type { ModSet } from './boundaryScan'

/**
 * Each in-repo mod's files beyond its entries, by id: globs from the repo's root, and the mods it
 * requires where its entry does not say. The boundary test holds every file listed here to the
 * kit, and keeps the game's own files from importing them. On `core` there are no mods and this
 * is empty; on `main` each author lists their own mod's files, and a mod has moved out when its
 * entry here is gone.
 */
export const MOD_FILES: Record<string, ModSet> = {
  'scene-notes': { globs: ['src/shared/sceneNotes.ts', 'src/renderer/sceneNotes/**'] }
}
