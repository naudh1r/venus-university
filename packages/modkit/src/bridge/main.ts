/**
 * The bridge for the main process: what core's `src/main` offers a mod, re-exported here and
 * nowhere else in the kit (see `shared.ts`).
 */
export { registerComfyLaunchEnvironment } from '../../../../src/main/services/comfyLaunchEnvironment'
export type { ComfyLaunchContext } from '../../../../src/main/services/comfyLaunchEnvironment'
export { registerFinalRequest } from '../../../../src/main/services/finalRequest'
export type { FinalRequestHook, FinalRequestPlan } from '../../../../src/main/services/finalRequest'
export { readJsonFile, writeAtomicBytes, writeAtomicJson } from '../../../../src/main/services/jsonFile'
export type { ReadJsonOptions, ReadJsonResult } from '../../../../src/main/services/jsonFile'
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
export { modIsOn, modOptionOn } from '../../../../src/main/services/modsService'

export type { InvokeContext, InvokeHandler } from '../../../../src/main/mods/invoke'

export { renderComfyImage } from '../../../../src/main/services/comfyService'
export type { ComfyRenderRequest } from '../../../../src/main/services/comfyService'

export { createDesktopSurface } from '../../../../src/main/mods/desktopSurface'

export { completeModStructured, hasExpressionArt } from '../../../../src/main/mods/structuredRequest'
