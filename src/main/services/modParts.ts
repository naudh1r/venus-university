import { assertModId } from './modDataService'

/**
 * What a mod adds to the archives the game writes: its own share of a backup, and of a character
 * export. Registered from a mod's `main.js`, one of each per mod id, and run by the backup and
 * character transfer services in registration order.
 */

/** What a part's export is handed. */
export interface BackupPartContext {
  /** The part's own folder in the backup being written, created; what it writes there goes in the zip. */
  scratch: string
  /** Every playthrough the backup carries. */
  playthroughIds: readonly string[]
}

/** What a part's export answers. */
export interface BackupPartExport {
  /** Carried in the backup's record beside the files. Plain JSON. */
  json?: unknown
  /** The files it wrote, as paths under `scratch`, with `/` or the platform's separator; without it, every file it wrote is carried. */
  files?: readonly string[]
}

/** A restore a part has prepared and not yet made. */
export interface BackupPartRestore {
  /** Makes the restore, once the game's own share of the backup has been written. */
  commit(): Promise<void>
  /** Drops it, writing nothing. */
  discard(): Promise<void>
}

/** What a backup's arriving data holds that the game itself does not read. */
export interface BackupPartLegacy {
  /** The backup record's keys the game does not own, with their values as read. */
  record: Readonly<Record<string, unknown>>
  /** The zip's top-level folders the game does not claim, as unpacked: absolute paths. */
  dirs: readonly string[]
  /** The backup file being read, by the path it was given: for a share an older build kept beside it. */
  archive: string
}

/** A mod's own share of a backup. */
export interface BackupPart {
  /** Writes the mod's share into `context.scratch`, after the game has gathered its own. */
  export(context: BackupPartContext): Promise<BackupPartExport>
  /**
   * Reads the mod's share out of an arriving backup before anything is written, and answers how
   * to restore it. A throw stops the whole restore with nothing written.
   * Called even when the backup has no entry for this mod, so legacy keys/folders can be read.
   * In that case json is undefined and files.dir still exists. With no data to restore, return
   * a no-op commit/discard pair.
   */
  prepare(
    json: unknown,
    files: { dir: string; list: readonly string[] },
    legacy: BackupPartLegacy
  ): Promise<BackupPartRestore>
}

interface RegisteredBackupPart {
  part: BackupPart
  exportRequired: boolean
}

const backups = new Map<string, RegisteredBackupPart>()

/** Adds the mod's share to every backup from now on; one per mod id. */
export function backupPart(modId: string, part: BackupPart): void {
  registerBackupPart(modId, part, false)
}

/**
 * A backup part whose export must succeed. If it throws or returns invalid data, no backup is
 * written and any existing target archive stays intact. Import has the same two-phase contract
 * as backupPart. Declare main:requiredBackupPart so older cores cannot silently omit this data.
 */
export function requiredBackupPart(modId: string, part: BackupPart): void {
  registerBackupPart(modId, part, true)
}

function registerBackupPart(modId: string, part: BackupPart, exportRequired: boolean): void {
  assertModId(modId)
  if (backups.has(modId)) throw new Error(`[mods] ${modId}: registered a second backup part`)
  backups.set(modId, { part, exportRequired })
}

/** Every registered backup part, by mod id, in registration order. */
export function backupParts(): ReadonlyMap<string, RegisteredBackupPart> {
  return backups
}

/** A mod's own share of a character export. */
export interface CharacterTransferPart {
  /** The mod's data on the character, for the export's manifest; `dir` is the mod's own folder in the export. */
  export(charId: string, dir: string): Promise<unknown>
  /**
   * Checks the mod's share of an arriving export before anything is adopted; a throw refuses the
   * import. `json` is undefined where the export carries none; `legacy` is the manifest's keys
   * the game does not own.
   */
  validate(json: unknown, dir: string, legacy: Readonly<Record<string, unknown>>): Promise<void>
  /** Takes the mod's share in for the adopted character, answering how to take it back out. */
  adopt(
    charId: string,
    json: unknown,
    dir: string,
    legacy: Readonly<Record<string, unknown>>
  ): Promise<() => Promise<void>>
  /** Copies the mod's data on one character to her duplicate, answering how to take it back out. */
  duplicate(fromId: string, toId: string): Promise<() => Promise<void>>
}

const transfers = new Map<string, CharacterTransferPart>()

/** Adds the mod's share to every character export, import and duplicate from now on; one per mod id. */
export function characterTransferPart(modId: string, part: CharacterTransferPart): void {
  assertModId(modId)
  if (transfers.has(modId)) throw new Error(`[mods] ${modId}: registered a second character transfer part`)
  transfers.set(modId, part)
}

/** Every registered character transfer part, by mod id, in registration order. */
export function characterTransferParts(): ReadonlyMap<string, CharacterTransferPart> {
  return transfers
}

/** Takes every part away again; the tests register their own. */
export function clearModParts(): void {
  backups.clear()
  transfers.clear()
}
