import { isSoundtrackKey, assertSoundtrackDuration, SOUNDTRACK_MOD, SOUNDTRACK_LABELS, type SoundtrackKey } from '../../shared/soundtracks'
import type { AudioKey } from '@shared/audio'
import { modIsOn } from '@vx/modkit/renderer'
import { soundtrackActive, soundtrackError, useSoundtrackStore } from './soundtrackStore'

/** Decoded imports stay separate from the shipped-file cache; at most 128 MiB is retained. */
const cache = new Map<string, AudioBuffer>()
const pending = new Map<string, Promise<AudioBuffer | null>>()
const generations = new Map<SoundtrackKey, number>()
export function clearSoundtrackAudio(keys = Object.keys(SOUNDTRACK_LABELS) as SoundtrackKey[]): void {
  for (const key of keys) {
    generations.set(key, (generations.get(key) ?? 0) + 1)
    for (const entry of cache.keys()) if (entry.startsWith(key + ':')) cache.delete(entry)
    for (const entry of pending.keys()) if (entry.startsWith(key + ':')) pending.delete(entry)
  }
}

export async function customSoundtrackBuffer(key: AudioKey, context: AudioContext): Promise<AudioBuffer | null> {
  if (!isSoundtrackKey(key) || !modIsOn(SOUNDTRACK_MOD)) return null
  const state = useSoundtrackStore.getState()
  if (!state.loaded) await state.load()
  if (!soundtrackActive(key)) return null
  const item = useSoundtrackStore.getState().map[key]!
  const identity = key + ':' + item.file
  if (cache.has(identity)) return cache.get(identity)!
  if (pending.has(identity)) return pending.get(identity)!
  const revision = generations.get(key) ?? 0
  const current = (): boolean => revision === (generations.get(key) ?? 0)
  const load = (async () => {
    try {
      const result = await window.api.soundtracks.read(key)
      if (!result.ok) throw result.error
      if (!result.data) throw Error('The imported track is missing.')
      const decoded = await context.decodeAudioData(new Uint8Array(result.data).buffer)
      assertSoundtrackDuration(decoded.duration)
      if (!current()) return null
      const size = (buffer: AudioBuffer): number => buffer.length * buffer.numberOfChannels * 4
      const limit = 128 * 1024 * 1024
      let used = [...cache.values()].reduce((sum, buffer) => sum + size(buffer), 0)
      for (const [entry, buffer] of cache) {
        if (used + size(decoded) <= limit) break
        cache.delete(entry); used -= size(buffer)
      }
      if (size(decoded) <= limit) cache.set(identity, decoded)
      return decoded
    } catch (error) {
      if (current()) soundtrackError(key, error)
      return null
    } finally { if (current()) pending.delete(identity) }
  })()
  pending.set(identity, load)
  return load
}
