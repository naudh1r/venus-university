import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import { writeAtomicBytes } from '@vx/modkit/main'
import { appError, messageOf } from '@vx/modkit/shared'
import {
  assertStudioBackupSize,
  assertStudioBackupText,
  type StudioBackupFile
} from '../../shared/presets/studioBackup'

/** Prompt Studio's section backups as files the player keeps: written where the save dialog points, read from where the open dialog does. */

/** `studioBackup:save` — writes the backup text to `targetPath` once it is sniffed as a studio backup. */
export async function saveStudioBackup(targetPath: string, text: string): Promise<void> {
  assertStudioBackupText(text)
  await writeAtomicBytes(targetPath, Buffer.from(text, 'utf-8'), {
    code: 'STUDIO_BACKUP_UNWRITABLE',
    message: 'Could not write the backup.'
  })
}

/** `studioBackup:pick` — reads the file at `path` as text, with its name; nothing is parsed or kept. */
export async function readStudioBackupFile(path: string): Promise<StudioBackupFile> {
  let text: string
  try {
    assertStudioBackupSize((await stat(path)).size)
    text = await readFile(path, 'utf-8')
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'STUDIO_BACKUP_TOO_LARGE') throw err
    throw appError('STUDIO_BACKUP_UNREADABLE', 'Could not read that file.', messageOf(err))
  }
  return { text, fileName: basename(path) }
}
