import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Her DM and feed photos, kept in a zip beside the build's backup. The zip itself is 7-Zip's,
 * which this suite stands in for with a folder copy: what is tested is which files go in, where
 * they come back to, and that a backup with no photos beside it is still restored.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
vi.mock('../src/main/services/archiveService', async (original) => ({
  ...(await original<typeof import('../src/main/services/archiveService')>()),
  createZip: (sourceDir: string, archivePath: string) =>
    cp(sourceDir, archivePath, { recursive: true }),
  extractZip: (archivePath: string, destDir: string) =>
    cp(archivePath, destDir, { recursive: true })
}))

const { exportLocalPhotos, importLocalPhotos, localPhotosBackupPath } =
  await import('../src/main/localPhotoBackup')

/** Enough of a PNG for the sniffer: its signature, then anything. */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32)
])

const saves = (): string => join(root, 'data', 'saves')

async function put(rel: string, bytes: Buffer | string = PNG): Promise<void> {
  const path = join(saves(), rel)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

/** Every file under `dir`, `/`-joined and sorted. */
async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(dir.length + 1)
        .replace(/\\/g, '/')
    )
    .sort()
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-local-photos-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('localPhotosBackupPath', () => {
  it('names the photos zip after the backup', () => {
    expect(localPhotosBackupPath('/b/venus-university-backup-2026-10-03.zip')).toBe(
      '/b/venus-university-backup-2026-10-03.photos.zip'
    )
    expect(localPhotosBackupPath('/b/backup.ZIP')).toBe('/b/backup.photos.zip')
    expect(localPhotosBackupPath('/b/backup')).toBe('/b/backup.photos.zip')
  })
})

describe('exportLocalPhotos', () => {
  it("takes her photos and nothing else, not the build's own camera roll", async () => {
    await put('123/photos/winter/winter_chat_001.png')
    await put('123/photos/winter/winter_bunnyboard_002.png')
    await put('456/photos/livvie/livvie_chat_001.png')
    // The build's own photos sit beside her folders, under a number.
    await put('123/photos/1790000000000.png')
    await put('123/photos/1790000000000.json', '{}')
    // Named as one of hers but not a picture, and a picture not named as one.
    await put('123/photos/winter/winter_chat_003.png', 'not a picture')
    await put('123/photos/winter/notes.png')
    await put('123/save_auto.json', '{}')

    const backup = join(root, 'out', 'backup.zip')
    await exportLocalPhotos(backup)

    expect(await filesUnder(localPhotosBackupPath(backup))).toEqual([
      '123/winter/winter_bunnyboard_002.png',
      '123/winter/winter_chat_001.png',
      '456/livvie/livvie_chat_001.png'
    ])
  })

  it('writes nothing where there are no photos, and never leaves an older zip behind', async () => {
    await put('123/save_auto.json', '{}')
    const backup = join(root, 'out', 'backup.zip')
    // A zip from an earlier backup under the same name.
    await mkdir(join(root, 'out'), { recursive: true })
    await writeFile(localPhotosBackupPath(backup), 'an older zip')

    await exportLocalPhotos(backup)

    expect(existsSync(localPhotosBackupPath(backup))).toBe(false)
  })
})

describe('importLocalPhotos', () => {
  it('puts her photos back into the playthroughs the restore brought back', async () => {
    await put('123/photos/winter/winter_chat_001.png')
    const backup = join(root, 'out', 'backup.zip')
    await exportLocalPhotos(backup)

    // The restore replaced the saves folder: playthrough 123 is back, without her photos.
    await rm(saves(), { recursive: true, force: true })
    await put('123/save_auto.json', '{}')

    await importLocalPhotos(backup)

    expect(await readFile(join(saves(), '123/photos/winter/winter_chat_001.png'))).toEqual(PNG)
  })

  it('leaves out a photo for a playthrough the backup did not bring back, and anything not hers', async () => {
    const backup = join(root, 'out', 'backup.zip')
    const zip = localPhotosBackupPath(backup)
    for (const rel of [
      '123/winter/winter_chat_001.png',
      '999/winter/winter_chat_001.png',
      '123/winter/../escape.png',
      '123/winter/readme.txt',
      '123/winter/extra/winter_chat_002.png'
    ]) {
      const path = join(zip, rel)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, PNG)
    }
    await put('123/save_auto.json', '{}')

    await importLocalPhotos(backup)

    expect(await filesUnder(saves())).toEqual([
      '123/photos/winter/winter_chat_001.png',
      '123/save_auto.json'
    ])
  })

  it('does nothing when there is no photos zip beside the backup', async () => {
    await put('123/save_auto.json', '{}')
    await importLocalPhotos(join(root, 'out', 'backup.zip'))
    expect(await filesUnder(saves())).toEqual(['123/save_auto.json'])
  })
})
