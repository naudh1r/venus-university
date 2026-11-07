import type { ModSet } from './boundaryScan'

/**
 * Each in-repo mod's files beyond its two entries, by id: globs from the repo's root, and the mods
 * it requires where its entry does not say. The boundary test holds every file listed here to the
 * kit. On `core` there are no mods and this is empty; on `main` each author lists their own mod's
 * files, and a mod has moved out when its entry here is gone.
 */
export const MOD_FILES: Record<string, ModSet> = {
  'scene-notes': { globs: ['src/shared/sceneNotes.ts', 'src/renderer/sceneNotes/**'] },
  'screen-companion': {
    globs: [
      'src/shared/screenCompanion.ts', 'src/shared/companionPointer.ts',
      'src/renderer/screenCompanion*', 'src/renderer/ScreenCompanionEntry.tsx',
      'src/renderer/Companion*.tsx', 'src/renderer/companionMedia.ts', 'src/renderer/companionCapture.ts',
      'src/renderer/stores/screenCompanion.ts', 'src/renderer/companionSurface.ts',
      'src/renderer/vu_styles/ScreenCompanion.css', 'src/main/screenCompanion.ts',
      'src/main/services/companion*.ts', 'src/main/modEntries/screen-companion.ts'
    ]
  }
}
