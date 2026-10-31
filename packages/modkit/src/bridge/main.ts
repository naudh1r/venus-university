/**
 * The bridge for the main process: what core's `src/main` offers a mod, re-exported here and
 * nowhere else in the kit (see `shared.ts`).
 */
export { registerComfyLaunchEnvironment } from '../../../../src/main/services/comfyLaunchEnvironment'
export type { ComfyLaunchContext } from '../../../../src/main/services/comfyLaunchEnvironment'
export { modDataPath } from '../../../../src/main/services/modDataService'
export { backupPart, requiredBackupPart, characterTransferPart } from '../../../../src/main/services/modParts'
export type {
  BackupPart,
  BackupPartContext,
  BackupPartExport,
  BackupPartLegacy,
  BackupPartRestore,
  CharacterTransferPart
} from '../../../../src/main/services/modParts'

export { extractZip } from '../../../../src/main/services/archiveService'
export { sniffImageFile } from '../../../../src/main/services/imageFiles'
export { modOptionOn } from '../../../../src/main/services/modsService'

export type { InvokeContext, InvokeHandler } from '../../../../src/main/mods/invoke'
