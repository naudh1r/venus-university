import { createHash } from 'crypto'
import { open, mkdir, readFile, readdir, lstat, unlink } from 'fs/promises'
import { basename, join } from 'path'
import { appError } from '@shared/errors'
import { modOn } from '@vx/modkit/shared'
import { requiredBackupPart } from '@vx/modkit/main'
import { SoundtrackLibrary } from '../../shared/soundtrackLibrary'
import { SOUNDTRACK_FILE, SOUNDTRACK_MAX_BYTES, SOUNDTRACK_MOD } from '../../shared/soundtracks'
import { getDataPath } from '../paths'
import { getModSwitches } from './modsService'
import { writeAtomicBytes, writeAtomicJson } from './jsonFile'
import { soundtrackBackupPart } from './soundtrackBackup'

const WRITE_ERROR = { code: 'SOUNDTRACK_WRITE', message: 'Could not save soundtrack choices.' }
export const soundtrackDirectory = (): string => join(getDataPath(), 'ex-music')
export const soundtrackHash = async (bytes: Uint8Array): Promise<string> => createHash('sha256').update(bytes).digest('hex')

/** Bound the actual read, including a file that grew after it was selected. */
export async function readSoundtrackFile(path: string): Promise<Uint8Array> {
  const handle = await open(path, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size <= 0 || stat.size > SOUNDTRACK_MAX_BYTES) {
      throw appError('SOUNDTRACK_SIZE', 'Choose a nonempty audio file up to 50 MB.')
    }
    const bytes = Buffer.alloc(stat.size + 1)
    let size = 0
    while (size < bytes.length) {
      const read = await handle.read(bytes, size, bytes.length - size, size)
      if (!read.bytesRead) break
      size += read.bytesRead
    }
    if (size !== stat.size) throw appError('SOUNDTRACK_CHANGED', 'The audio file changed while it was being read. Choose it again.')
    return new Uint8Array(bytes.buffer, bytes.byteOffset, size)
  } finally { await handle.close() }
}
function pathOf(file: string): string {
  if (!SOUNDTRACK_FILE.test(file)) throw appError('SOUNDTRACK_PATH', 'Invalid soundtrack file.')
  return join(soundtrackDirectory(), file)
}

export const soundtrackLibrary = new SoundtrackLibrary({
  enabled: async () => modOn(await getModSwitches(), SOUNDTRACK_MOD),
  hash: soundtrackHash,
  map: async () => {
    try { return JSON.parse(await readFile(join(soundtrackDirectory(), 'tracks.json'), 'utf8')) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error }
  },
  read: file => readSoundtrackFile(pathOf(file)),
  write: async (map, files) => {
    await mkdir(soundtrackDirectory(), { recursive: true })
    for (const [file, bytes] of Object.entries(files)) await writeAtomicBytes(pathOf(file), bytes, WRITE_ERROR)
    await writeAtomicJson(join(soundtrackDirectory(), 'tracks.json'), map, WRITE_ERROR)
  },
  names: async () => {
    try {
      const names = await readdir(soundtrackDirectory())
      const safe: string[] = []
      for (const file of names) {
        if (!SOUNDTRACK_FILE.test(file)) continue
        const stat = await lstat(pathOf(file))
        if (stat.isFile() && !stat.isSymbolicLink()) safe.push(file)
      }
      return safe
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  },
  delete: file => unlink(pathOf(file))
})

requiredBackupPart(SOUNDTRACK_MOD, soundtrackBackupPart(soundtrackLibrary, soundtrackHash, readSoundtrackFile))

/** Called only with the native dialog's answer, never a renderer-provided path. */
export async function pickSoundtrack(path: string, sender: number) {
  return soundtrackLibrary.pick(basename(path), await readSoundtrackFile(path), sender)
}
