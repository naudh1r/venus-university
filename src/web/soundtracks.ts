import { modOn } from '@shared/mods'
import { appError } from '@shared/errors'
import { SoundtrackLibrary } from '@shared/soundtrackLibrary'
import { SOUNDTRACK_MAX_BYTES, SOUNDTRACK_MOD } from '@shared/soundtracks'
import { database, storage } from './db/open'
import { readModSwitches } from './mods'
import { pickFile } from './transfer'

export async function soundtrackHash(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}
export const soundtrackLibrary = new SoundtrackLibrary({
  enabled: async () => modOn(readModSwitches(), SOUNDTRACK_MOD),
  hash: soundtrackHash,
  map: () => storage('read soundtrack choices', async () => (await (await database()).get('soundtrackMeta', 'tracks')) ?? {}),
  read: file => storage('read the custom soundtrack', async () => {
    const blob = await (await database()).get('soundtrackFiles', file)
    if (!blob || blob.size > SOUNDTRACK_MAX_BYTES) throw appError('SOUNDTRACK_MISSING', 'The imported track is missing or too large.')
    return new Uint8Array(await blob.arrayBuffer())
  }),
  write: (map, files) => storage('save soundtrack choices', async () => {
    const tx = (await database()).transaction(['soundtrackMeta', 'soundtrackFiles'], 'readwrite')
    for (const [file, bytes] of Object.entries(files)) void tx.objectStore('soundtrackFiles').put(new Blob([new Uint8Array(bytes)]), file)
    void tx.objectStore('soundtrackMeta').put(map, 'tracks')
    await tx.done
  }),
  names: () => storage('list imported music', async () => (await database()).getAllKeys('soundtrackFiles')),
  delete: file => storage('delete an unused imported copy', async () => { await (await database()).delete('soundtrackFiles', file) })
})
export async function pickSoundtrack() {
  soundtrackLibrary.cancelPick()
  const file = await pickFile('.mp3,.ogg,.wav')
  if (!file) return null
  if (file.size > SOUNDTRACK_MAX_BYTES) throw appError('SOUNDTRACK_SIZE', 'Choose an audio file up to 50 MB.')
  return soundtrackLibrary.pick(file.name, new Uint8Array(await file.arrayBuffer()), 0)
}
