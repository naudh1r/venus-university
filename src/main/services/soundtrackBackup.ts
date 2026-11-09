import { writeFile } from 'fs/promises'
import { basename, join } from 'path'
import type { BackupPart } from '@vx/modkit/main'
import type { SoundtrackLibrary } from '../../shared/soundtrackLibrary'
import {
  prepareSoundtrackBackupPart, prepareSoundtrackSnapshot, SOUNDTRACK_BACKUP_DIR,
  type SoundtrackHash
} from '../../shared/soundtracks'

/** The mod owns its archive format and the migration from old exMusic backups. */
export function soundtrackBackupPart(
  library: SoundtrackLibrary,
  hash: SoundtrackHash,
  read: (path: string) => Promise<Uint8Array>
): BackupPart {
  return {
    export: async ({ scratch }) => {
      const music = await library.snapshotForBackup()
      for (const [file, bytes] of Object.entries(music?.files ?? {})) {
        await writeFile(join(scratch, file), bytes)
      }
      // null means the switch was off: restore must leave the local library alone.
      // An empty tracks map instead explicitly restores original music assignments.
      return { json: { v: 1, tracks: music?.map ?? null }, files: Object.keys(music?.files ?? {}) }
    },
    prepare: async (json, files, legacy) => {
      const legacyDir = legacy.dirs.find(dir => basename(dir) === SOUNDTRACK_BACKUP_DIR)
      const music = json !== undefined || files.list.length > 0
        ? await prepareSoundtrackBackupPart(json, file => read(join(files.dir, file)), hash)
        : await prepareSoundtrackSnapshot(legacy.record.exMusic, async file => {
            if (!legacyDir) throw new Error('The backup is missing its custom music folder.')
            return read(join(legacyDir, file))
          }, hash)
      return {
        commit: async () => { if (music) await library.restore(music) },
        discard: async () => {}
      }
    }
  }
}
