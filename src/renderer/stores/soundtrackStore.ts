import { create } from 'zustand'
import { assertSoundtrackDuration, SOUNDTRACK_MOD, type SoundtrackKey, type SoundtrackMap } from '../../shared/soundtracks'
import { toAppError } from '@shared/errors'
import type { Result } from '@vx/modkit/shared'
import { modIsOn } from '@vx/modkit/renderer'

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw result.error
  return result.data
}
interface SoundtrackState {
  map: SoundtrackMap
  loaded: boolean
  busy: boolean
  message: string
  errors: Partial<Record<SoundtrackKey, string>>
  load: () => Promise<void>
  choose: (key: SoundtrackKey) => Promise<void>
  remove: (key: SoundtrackKey) => Promise<void>
  loop: (key: SoundtrackKey, value: boolean) => Promise<void>
  cleanup: () => Promise<void>
}
let revision = 0
let loading: Promise<void> | null = null
export const useSoundtrackStore = create<SoundtrackState>((set, get) => {
  async function change(work: () => Promise<string>): Promise<void> {
    if (get().busy || !modIsOn(SOUNDTRACK_MOD)) return
    set({ busy: true, message: '' })
    try { set({ message: await work() }) }
    catch (error) { set({ message: toAppError(error).message }) }
    finally { set({ busy: false }) }
  }
  const update = (map: SoundtrackMap): void => { revision++; set({ map, errors: {}, loaded: true }) }
  return {
    map: {}, loaded: false, busy: false, message: '', errors: {},
    load: async () => {
      if (!loading) loading = (async () => {
        const at = revision
        try {
          const map = unwrap(await window.api.soundtracks.list())
          if (at === revision) update(map)
        } catch (error) {
          if (at === revision) set({ loaded: true, message: toAppError(error).message })
        }
        finally { loading = null }
      })()
      return loading
    },
    choose: key => change(async () => {
      const picked = unwrap(await window.api.soundtracks.pick())
      if (!picked) return ''
      const context = new AudioContext()
      try {
        const buffer = await context.decodeAudioData(new Uint8Array(picked.bytes).buffer)
        assertSoundtrackDuration(buffer.duration)
        update(unwrap(await window.api.soundtracks.commit(key, picked.token, buffer.duration)))
        return `Saved ${picked.name}.`
      } finally { await context.close().catch(() => {}) }
    }),
    remove: key => change(async () => { update(unwrap(await window.api.soundtracks.remove(key))); return 'Original track restored.' }),
    loop: (key, value) => change(async () => { update(unwrap(await window.api.soundtracks.loop(key, value))); return value ? 'Loop enabled.' : 'Plays once each time this cue is entered.' }),
    cleanup: () => change(async () => {
      const result = unwrap(await window.api.soundtracks.cleanup())
      return `Deleted ${result.count} unused imported copies.`
    })
  }
})

/** A broken import falls back once until the assignments are refreshed or changed. */
export function soundtrackActive(key: SoundtrackKey): boolean {
  const state = useSoundtrackStore.getState()
  return modIsOn(SOUNDTRACK_MOD) && Boolean(state.map[key]) && !state.errors[key]
}
export function soundtrackError(key: SoundtrackKey, error: unknown): void {
  useSoundtrackStore.setState(state => ({ errors: { ...state.errors, [key]: `Using original music: ${toAppError(error).message}` } }))
}
