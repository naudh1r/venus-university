import { appError } from '@vx/modkit/shared'
import {
  assertSoundtrackBytes, assertSoundtrackDuration, assertSoundtrackKey, prepareSoundtrackSnapshot,
  readSoundtrackMap, SOUNDTRACK_FILE, soundtrackExtension,
  type SoundtrackHash, type SoundtrackMap, type SoundtrackPick, type SoundtrackSnapshot
} from './soundtracks'

/** Native files and browser blobs have the same assignment and integrity rules. */
export interface SoundtrackStorage {
  map(): Promise<unknown>
  read(file: string): Promise<Uint8Array>
  /** Files first, map last on disk; both together in one transaction in the browser. */
  write(map: SoundtrackMap, files: Record<string, Uint8Array>): Promise<void>
  names(): Promise<string[]>
  delete(file: string): Promise<void>
  hash: SoundtrackHash
  enabled(): Promise<boolean>
}

export class SoundtrackLibrary {
  private tail: Promise<unknown> = Promise.resolve()
  private pending: (SoundtrackPick & { file: string; owner: number; until: number }) | null = null
  private expiry: ReturnType<typeof setTimeout> | null = null
  private pickRevision = 0
  constructor(private readonly storage: SoundtrackStorage) {}

  exclusive<T>(run: () => Promise<T>): Promise<T> {
    const next = this.tail.then(run, run)
    this.tail = next.catch(() => {})
    return next
  }
  private async requireOn(): Promise<void> {
    if (!await this.storage.enabled()) throw appError('MOD_DISABLED', 'Enable Custom soundtracks in Mods first.')
  }
  list(): Promise<SoundtrackMap> {
    return this.exclusive(async () => readSoundtrackMap(await this.storage.map()))
  }
  cancelPick(): void {
    this.pickRevision++
    this.pending = null
    if (this.expiry) clearTimeout(this.expiry)
    this.expiry = null
  }
  async pick(name: string, bytes: Uint8Array, owner: number): Promise<SoundtrackPick> {
    await this.requireOn()
    this.cancelPick()
    const revision = this.pickRevision
    assertSoundtrackBytes(bytes)
    const copy = new Uint8Array(bytes)
    const ext = soundtrackExtension(name)
    const token = crypto.randomUUID()
    const picked = {
      token, bytes: copy, name: name.split(/[\\/]/).pop()!.replace(/[\x00-\x1f]/g, '').slice(0, 180),
      file: await this.storage.hash(copy) + ext, owner, until: Date.now() + 60_000
    }
    if (revision !== this.pickRevision) throw appError('SOUNDTRACK_PICK', 'A newer file choice replaced this one.')
    this.pending = picked
    this.expiry = setTimeout(() => this.cancelPick(), 60_000)
    ;(this.expiry as unknown as { unref?: () => void }).unref?.()
    return { token, name: picked.name, bytes: picked.bytes.slice() }
  }
  commit(key: string, token: string, duration: number, owner: number): Promise<SoundtrackMap> {
    return this.exclusive(async () => {
      await this.requireOn()
      assertSoundtrackKey(key)
      assertSoundtrackDuration(duration)
      const picked = this.pending
      if (!picked || picked.token !== token || picked.owner !== owner || picked.until <= Date.now()) {
        throw appError('SOUNDTRACK_PICK', 'Choose the audio file again.')
      }
      const map = readSoundtrackMap(await this.storage.map())
        map[key] = { file: picked.file, name: picked.name, loop: map[key]?.loop ?? key !== 'reckoning_victory' }
      await this.storage.write(map, { [picked.file]: picked.bytes })
      if (this.pending === picked) this.cancelPick()
      return map
    })
  }
  remove(key: string): Promise<SoundtrackMap> {
    return this.change(key, map => { delete map[key as keyof SoundtrackMap] })
  }
  loop(key: string, value: boolean): Promise<SoundtrackMap> {
    return this.change(key, map => {
      assertSoundtrackKey(key)
      if (typeof value !== 'boolean' || !map[key]) throw appError('SOUNDTRACK_LOOP', 'Choose a replacement track first.')
      map[key] = { ...map[key]!, loop: value }
    })
  }
  private change(key: string, edit: (map: SoundtrackMap) => void): Promise<SoundtrackMap> {
    return this.exclusive(async () => {
      await this.requireOn()
      assertSoundtrackKey(key)
      const map = readSoundtrackMap(await this.storage.map())
      edit(map)
      await this.storage.write(map, {})
      return map
    })
  }
  read(key: string): Promise<Uint8Array | null> {
    return this.exclusive(async () => {
      assertSoundtrackKey(key)
      const map = readSoundtrackMap(await this.storage.map())
      if (!map[key]) return null
      const snapshot = await prepareSoundtrackSnapshot({ [key]: map[key] }, file => this.storage.read(file), this.storage.hash)
      return snapshot!.files[map[key]!.file]
    })
  }
  snapshot(): Promise<SoundtrackSnapshot> {
    return this.exclusive(async () => (await prepareSoundtrackSnapshot(
      await this.storage.map(), file => this.storage.read(file), this.storage.hash
    ))!)
  }
  /** Disabled music stays local and contributes no extension metadata or files to a backup. */
  snapshotForBackup(): Promise<SoundtrackSnapshot | null> {
    return this.exclusive(async () => {
      if (!await this.storage.enabled()) return null
      return prepareSoundtrackSnapshot(
        await this.storage.map(), file => this.storage.read(file), this.storage.hash
      )
    })
  }
  /** Snapshot must already be validated; restoration also works while the feature is off. */
  restore(snapshot: SoundtrackSnapshot): Promise<void> {
    return this.exclusive(async () => {
      const checked = await prepareSoundtrackSnapshot(snapshot.map, async file => snapshot.files[file], this.storage.hash)
      await this.storage.write(checked!.map, checked!.files)
    })
  }
  cleanup(): Promise<{ count: number }> {
    return this.exclusive(async () => {
      await this.requireOn()
      const used = new Set(Object.values(readSoundtrackMap(await this.storage.map())).map(item => item.file))
      let count = 0
      for (const file of await this.storage.names()) {
        if (!SOUNDTRACK_FILE.test(file) || used.has(file)) continue
        await this.storage.delete(file)
        count++
      }
      return { count }
    })
  }
}
