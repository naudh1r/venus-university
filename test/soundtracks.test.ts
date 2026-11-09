import { createHash } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SoundtrackLibrary, type SoundtrackStorage } from '@shared/soundtrackLibrary'
import { assertSoundtrackBytes, assertSoundtrackDuration, prepareSoundtrackSnapshot, readSoundtrackMap, type SoundtrackMap } from '@shared/soundtracks'
import { classifyBackupEntry } from '@shared/backup'

const hash = async (bytes: Uint8Array): Promise<string> => createHash('sha256').update(bytes).digest('hex')
const bytes = new Uint8Array([1, 2, 3])
function fixture() {
  let map: SoundtrackMap = {}, enabled = true
  const files: Record<string, Uint8Array> = {}
  const port: SoundtrackStorage = {
    map: async () => structuredClone(map), read: async name => files[name], hash,
    enabled: async () => enabled,
    write: vi.fn(async (next, added) => { Object.assign(files, added); map = structuredClone(next) }),
    names: async () => Object.keys(files), delete: async file => { delete files[file] }
  }
  const library = new SoundtrackLibrary(port)
  const add = async (key = 'title', audio = bytes) => {
    const picked = await library.pick('song.wav', audio, 7)
    return library.commit(key, picked.token, 12, 7)
  }
  return { library, port, files, add, off: () => { enabled = false } }
}
afterEach(() => vi.useRealTimers())

describe('custom soundtrack storage', () => {
  it('registers its original switch when storage loads before the mod catalogue', async () => {
    vi.resetModules()
    const { SOUNDTRACK_DEF, SOUNDTRACK_MOD } = await import('@shared/soundtracks')
    const { modById } = await import('@vx/modkit/shared')
    expect(modById(SOUNDTRACK_MOD)).toBe(SOUNDTRACK_DEF)
    expect(SOUNDTRACK_DEF).toMatchObject({ id: 'custom-soundtracks', scope: 'anytime', defaultOn: true })
  })

  it('assigns the dungeon without changing question or victory tracks',async()=>{
    const {library,add}=fixture()
    await add('reckoning');await add('reckoning_victory')
    const map=await add('reckoning_dungeon',new Uint8Array([8,9]))
    expect(map.reckoning_dungeon?.loop).toBe(true)
    expect(await library.read('reckoning_dungeon')).toEqual(new Uint8Array([8,9]))
    expect(await library.read('reckoning')).toEqual(bytes)
    expect((await library.remove('reckoning_dungeon')).reckoning_victory?.loop).toBe(false)
  })
  it('keeps victory separate and defaults its replacement to one play, with looping optional',async()=>{
    const {library,add}=fixture()
    await add('reckoning');const map=await add('reckoning_victory')
    expect(map.reckoning?.loop).toBe(true)
    expect(map.reckoning_victory?.loop).toBe(false)
    expect(await library.read('reckoning_victory')).toEqual(bytes)
    await library.loop('reckoning_victory',true)
    expect((await add('reckoning_victory')).reckoning_victory?.loop).toBe(true)
    expect(await library.remove('reckoning_victory')).toHaveProperty('reckoning')
  })
  it('imports, reads and removes a Reckoning track through the normal soundtrack library', async () => {
    const {library,add}=fixture()
    const map=await add('reckoning')
    expect(readSoundtrackMap(map).reckoning?.name).toBe('song.wav')
    expect(await library.read('reckoning')).toEqual(bytes)
    expect(await library.remove('reckoning')).not.toHaveProperty('reckoning')
  })
  it('copies selected bytes and consumes a token only for its owner', async () => {
    const { library } = fixture()
    const source = bytes.slice()
    const picked = await library.pick('C:\\Music\\song.wav', source, 7)
    source[0] = 9
    await expect(library.commit('title', picked.token, 12, 8)).rejects.toMatchObject({ code: 'SOUNDTRACK_PICK' })
    const map = await library.commit('title', picked.token, 12, 7)
    expect(map.title).toMatchObject({ name: 'song.wav', loop: true })
    expect(await library.read('title')).toEqual(bytes)
    await expect(library.commit('title', picked.token, 12, 7)).rejects.toMatchObject({ code: 'SOUNDTRACK_PICK' })
  })
  it('keeps the prior assignment when a write fails, then recovers its write queue', async () => {
    const { library, port, add } = fixture()
    const original = await add()
    const picked = await library.pick('next.ogg', new Uint8Array([9]), 7)
    vi.mocked(port.write).mockRejectedValueOnce(Error('disk full'))
    await expect(library.commit('title', picked.token, 8, 7)).rejects.toThrow('disk full')
    expect(await library.list()).toEqual(original)
    await library.commit('landing_day', picked.token, 8, 7)
    await Promise.all([library.loop('title', false), library.remove('landing_day')])
    expect(await library.list()).toEqual({ title: { ...original.title, loop: false } })
  })
  it('expires cancelled and old picks', async () => {
    vi.useFakeTimers()
    const { library } = fixture()
    const picked = await library.pick('song.wav', bytes, 7)
    await vi.advanceTimersByTimeAsync(60_001)
    await expect(library.commit('title', picked.token, 8, 7)).rejects.toMatchObject({ code: 'SOUNDTRACK_PICK' })
    const next = await library.pick('song.wav', bytes, 7)
    library.cancelPick()
    await expect(library.commit('title', next.token, 8, 7)).rejects.toMatchObject({ code: 'SOUNDTRACK_PICK' })
  })
  it('keeps choices and backups readable while off but blocks mutations', async () => {
    const { library, add, off } = fixture()
    const map = await add()
    off()
    expect(await library.list()).toEqual(map)
    expect((await library.snapshot()).map).toEqual(map)
    await expect(library.remove('title')).rejects.toMatchObject({ code: 'MOD_DISABLED' })
    await expect(library.cleanup()).rejects.toMatchObject({ code: 'MOD_DISABLED' })
    await library.restore(await library.snapshot())
    expect(await library.read('title')).toEqual(bytes)
  })
  it('deletes only unassigned imported copies, including files shared by several slots', async () => {
    const { library, files, add } = fixture()
    await add('title'); await add('landing_day'); await add('ending', new Uint8Array([8]))
    await library.remove('ending'); await library.remove('title')
    files['personal.wav'] = bytes
    files['tracks.json'] = bytes
    expect(await library.cleanup()).toEqual({ count: 1 })
    expect(await library.read('landing_day')).toEqual(bytes)
    expect(files['personal.wav']).toBe(bytes)
    expect(files['tracks.json']).toBe(bytes)
  })
  it('rejects invalid slots, durations and oversized files before storage writes', async () => {
    const { library, port } = fixture()
    for (const key of ['__proto__', '../title', 'amb_outdoor_day']) {
      await expect(library.remove(key)).rejects.toMatchObject({ code: 'SOUNDTRACK_KEY' })
    }
    for (const seconds of [0, NaN, Infinity, 1201]) expect(() => assertSoundtrackDuration(seconds)).toThrow()
    expect(() => assertSoundtrackBytes(new Uint8Array(50 * 1024 * 1024 + 1))).toThrow()
    expect(port.write).not.toHaveBeenCalled()
  })
})

describe('soundtrack backup integrity', () => {
  it('normalizes old loop flags and ignores a missing extension without inventing choices', async () => {
    const file = await hash(bytes) + '.wav'
    const map = readSoundtrackMap({ title: { file, name: 'old.wav' } })
    expect(map.title?.loop).toBe(true)
    expect(await prepareSoundtrackSnapshot(undefined, async () => bytes, hash)).toBeNull()
    expect(classifyBackupEntry('exMusic/' + file)).toBe('audio')
    expect(classifyBackupEntry('exMusic/../../settings.json')).toBe('reject')
  })
  it('rejects missing bytes, hash mismatches and path traversal before restoring anything', async () => {
    const { library, port } = fixture()
    const file = await hash(bytes) + '.wav'
    const map = { title: { file, name: 'song.wav', loop: true } }
    await expect(library.restore({ map, files: {} })).rejects.toMatchObject({ code: 'SOUNDTRACK_SIZE' })
    await expect(library.restore({ map, files: { [file]: new Uint8Array([8]) } })).rejects.toMatchObject({ code: 'SOUNDTRACK_INTEGRITY' })
    expect(() => readSoundtrackMap({ title: { file: '../song.wav', name: 'song', loop: true } })).toThrow()
    expect(port.write).not.toHaveBeenCalled()
  })
})
