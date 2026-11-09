import { create } from 'zustand'
import { showError } from '@vx/modkit/renderer'
import type { AppError, StructuredRequest } from '@vx/modkit/shared'
import type { Preset, PresetImport, PresetSummary } from '../../shared/presets/types'
import { EMPTY_STUDIO_PROMPTS, type StudioPrompts } from '../../shared/presets/studioPrompts'
import { mergePrompts, type PresetsMerge } from '../../shared/presets/studioBackup'

/** The Prompt Studio presets: the list, the one in force and what the studio previews. */
interface PromptStudioState {
  /** Every stored preset, by name; empty until the first load. */
  presets: PresetSummary[]
  /** The id in force. */
  activeId?: string
  /** The active preset whole, read by the builders for its scene text edits; absent until one has loaded. */
  active?: Preset
  /** The game's own prompt edits, as last read; empty until the first load or where the read failed. */
  prompts: StudioPrompts
  /** The last scene call as its builder made it, before any preset was applied; what the studio's preview shows. */
  lastSceneRequest?: Readonly<StructuredRequest>

  /** Reads the list and the active preset. A failure is logged and leaves what was loaded. */
  load: () => Promise<void>
  /** Replaces the game's own prompt edits. False when the write failed, or the stored record could not be read to be replaced. */
  savePrompts: (record: StudioPrompts) => Promise<boolean>
  /** Keeps every preset of a restored backup over those of its ids and puts its active one in force. False when a write failed. */
  restorePresets: (merge: PresetsMerge) => Promise<boolean>
  /** Merges a restored backup's record into the stored one, the file winning. False when the write failed, or the stored record could not be read. */
  restorePrompts: (file: StudioPrompts) => Promise<boolean>
  /** Puts a preset in force. False when the write failed. */
  setActive: (id: string) => Promise<boolean>
  /** Keeps a preset under its own id, replacing one already there. False when the write failed. */
  save: (preset: Preset) => Promise<boolean>
  /** Removes one; the last is refused. False when it failed. */
  remove: (id: string) => Promise<boolean>
  /** Keeps a copy of one under a fresh id and returns that id, or null when it failed. */
  duplicate: (id: string) => Promise<string | null>
  /** Gives one a new name. False when it failed. */
  rename: (id: string, name: string) => Promise<boolean>
  /** Reads a file the player picks into a preset that is not yet kept; null where nothing was picked or it failed. */
  importFile: () => Promise<PresetImport | null>
  /** Remembers the last scene request a builder made. */
  noteSceneRequest: (request: Readonly<StructuredRequest>) => void
}

/** The tail of the work lane: each action sees the store as the one before it left it. */
let tail: Promise<unknown> = Promise.resolve()

/** The load in flight, so the boot and a switch turning on share one read. */
let loading: Promise<void> | null = null

/** Runs `work` after everything queued before it. */
function inLane<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.then(work, work)
  tail = next.catch(() => undefined)
  return next
}

export const usePromptStudioStore = create<PromptStudioState>((set, get) => {
  /** Reads the list and the active preset into the store; false where either read failed. */
  async function refresh(): Promise<boolean> {
    const listed = await window.api.presets.list()
    if (!listed.ok) {
      console.error('[presets] the presets could not be read', listed.error)
      return false
    }
    const { active: activeId, presets } = listed.data
    const read = await window.api.presets.get(activeId)
    if (!read.ok) {
      console.error('[presets] the active preset could not be read', read.error)
      set({ presets, activeId })
      return false
    }
    set({ presets, activeId, active: read.data })
    return true
  }

  /** Reads the game's own prompt edits into the store; false where the read failed, leaving the record empty. */
  async function refreshPrompts(): Promise<boolean> {
    const read = await window.api.studioPrompts.get()
    if (!read.ok) {
      console.error('[studio] the prompts could not be read', read.error)
      set({ prompts: EMPTY_STUDIO_PROMPTS })
      return false
    }
    set({ prompts: read.data })
    return true
  }

  /** Runs one write, then refreshes; a failed write is shown to the player. */
  async function write(call: () => Promise<{ ok: true } | { ok: false; error: AppError }>): Promise<boolean> {
    const result = await call()
    if (!result.ok) {
      showError(result.error)
      await refresh()
      return false
    }
    await refresh()
    return true
  }

  return {
    presets: [],
    prompts: EMPTY_STUDIO_PROMPTS,

    load: () => {
      loading ??= inLane(async () => {
        try {
          await refresh()
          await refreshPrompts()
        } catch (error) {
          console.error('[presets] the presets could not be read', error)
        }
      }).finally(() => {
        loading = null
      })
      return loading
    },

    savePrompts: (record) =>
      inLane(async () => {
        // A record that could not be read is not written over: the file may be one a newer build kept.
        if (!(await refreshPrompts())) {
          showError({ code: 'STUDIO_PROMPTS_UNREADABLE', message: 'The stored prompt edits could not be read, so nothing was saved.' })
          return false
        }
        const saved = await window.api.studioPrompts.set(record)
        if (!saved.ok) {
          showError(saved.error)
          return false
        }
        set({ prompts: saved.data })
        return true
      }),

    setActive: (id) => inLane(() => write(() => window.api.presets.setActive(id))),

    restorePresets: (merge) =>
      inLane(() =>
        write(async () => {
          for (const preset of merge.save) {
            const saved = await window.api.presets.save(preset)
            if (!saved.ok) return saved
          }
          return window.api.presets.setActive(merge.active)
        })
      ),

    restorePrompts: (file) =>
      inLane(async () => {
        if (!(await refreshPrompts())) {
          showError({ code: 'STUDIO_PROMPTS_UNREADABLE', message: 'The stored prompt edits could not be read, so nothing was restored.' })
          return false
        }
        const saved = await window.api.studioPrompts.set(mergePrompts(get().prompts, file))
        if (!saved.ok) {
          showError(saved.error)
          return false
        }
        set({ prompts: saved.data })
        return true
      }),

    save: (preset) => inLane(() => write(() => window.api.presets.save(preset))),

    remove: (id) => inLane(() => write(() => window.api.presets.delete(id))),

    duplicate: (id) =>
      inLane(async () => {
        const read = await window.api.presets.get(id)
        if (!read.ok) {
          showError(read.error)
          return null
        }
        const copy: Preset = { ...read.data, id: crypto.randomUUID(), name: `${read.data.name} copy` }
        return (await write(() => window.api.presets.save(copy))) ? copy.id : null
      }),

    rename: (id, name) =>
      inLane(async () => {
        const read = await window.api.presets.get(id)
        if (!read.ok) {
          showError(read.error)
          return false
        }
        return write(() => window.api.presets.save({ ...read.data, name }))
      }),

    importFile: async () => {
      const result = await window.api.presets.import()
      if (!result.ok) {
        showError(result.error)
        return null
      }
      return result.data
    },

    noteSceneRequest: (request) => set({ lastSceneRequest: request })
  }
})
