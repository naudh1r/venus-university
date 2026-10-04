import { existsSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { join } from 'path'
import { BACKUP_ZIP_LIMITS } from '@shared/backup'
import { SAFE_CHAR_ID } from '@shared/characterRules'
import { isPhotoFile } from '@shared/photoFiles'
import { SAFE_NUMERIC_ID } from '@shared/saveRules'
import { getPlaythroughPath, getSavesPath } from './paths'
import { getPhotoPath } from './photoProtocol'
import {
  copyInto,
  createZip,
  discard,
  extractZip,
  relPathsUnder,
  scratchDir
} from './services/archiveService'
import { sniffImageFile } from './services/imageFiles'

/**
 * Her DM and feed photos, kept beside a backup rather than in it.
 *
 * A restore refuses a whole backup over one file it does not know, so photos packed into the
 * build's own zip would make that backup unreadable to any build without this feature, which is
 * every official build after an update. They go in a second zip next to it instead, named after
 * it: `venus-university-backup-<date>.zip` and `venus-university-backup-<date>.photos.zip`. The
 * backup itself is the build's, byte for byte, and a restore without the second file is a
 * restore without her photos, and nothing worse.
 *
 * Inside the second zip a photo sits at `<playthroughId>/<charId>/<file>`, the same three names
 * its path under `/data/saves` is made of.
 */

/** The photos zip that belongs to `backupPath`. */
export function localPhotosBackupPath(backupPath: string): string {
  return backupPath.replace(/(\.zip)?$/i, '.photos.zip')
}

/** The names of the folders under `dir` that `pattern` accepts; none where there is no `dir`. */
async function foldersIn(dir: string, pattern: RegExp): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Writes every playthrough's DM and feed photos beside the backup just written to `backupPath`.
 * A photos zip already there under that name goes first, so it can never be an older one; none is
 * written where there are no photos. A failure here leaves the backup itself as it was written.
 */
export async function exportLocalPhotos(backupPath: string): Promise<void> {
  const target = localPhotosBackupPath(backupPath)
  const scratch = scratchDir('local-photos')
  try {
    await rm(target, { force: true })
    let count = 0
    for (const playthroughId of await foldersIn(getSavesPath(), SAFE_NUMERIC_ID)) {
      const photos = join(getPlaythroughPath(playthroughId), 'photos')
      for (const charId of await foldersIn(photos, SAFE_CHAR_ID)) {
        for (const file of await readdir(join(photos, charId))) {
          const from = getPhotoPath(playthroughId, charId, file)
          // Only a picture named as one of ours: the build's own photos sit beside these folders.
          if (!isPhotoFile(file) || !(await sniffImageFile(from))) continue
          await copyInto(from, join(scratch, playthroughId, charId, file))
          count++
        }
      }
    }
    if (count > 0) await createZip(scratch, target)
  } catch (err) {
    await rm(target, { force: true }).catch(() => {})
    console.warn('[backup] could not write the DM and feed photos beside the backup:', err)
  } finally {
    await discard(scratch)
  }
}

/**
 * Puts back the DM and feed photos kept beside the backup just restored from `backupPath`. Each
 * goes back only into a playthrough the restore brought back, and only as a picture named as one
 * of ours; anything else in the zip is left out. No photos zip there is no photos to put back.
 */
export async function importLocalPhotos(backupPath: string): Promise<void> {
  const source = localPhotosBackupPath(backupPath)
  if (!existsSync(source)) return

  const scratch = scratchDir('local-photos')
  try {
    await extractZip(source, scratch, BACKUP_ZIP_LIMITS)
    for (const rel of await relPathsUnder(scratch)) {
      const [playthroughId, charId, file, ...rest] = rel.split('/')
      const ours =
        rest.length === 0 &&
        SAFE_NUMERIC_ID.test(playthroughId ?? '') &&
        SAFE_CHAR_ID.test(charId ?? '') &&
        isPhotoFile(file ?? '') &&
        existsSync(getPlaythroughPath(playthroughId)) &&
        (await sniffImageFile(join(scratch, rel))) !== null
      if (!ours) {
        console.warn(`[backup] leaving out ${rel} from the photos beside the backup`)
        continue
      }
      await copyInto(join(scratch, rel), getPhotoPath(playthroughId, charId, file))
    }
  } catch (err) {
    console.warn('[backup] could not put back the DM and feed photos beside the backup:', err)
  } finally {
    await discard(scratch)
  }
}
