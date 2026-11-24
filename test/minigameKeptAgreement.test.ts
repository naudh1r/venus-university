import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, redactSettings } from '../src/shared/settingsRules'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useSettingsStore } from '../src/renderer/stores/settingsStore'
import { keptAgreed, useTableStore } from '../src/renderer/minigames/session'
import { sittingOf } from '../src/renderer/minigames/MiniGamePanel'

// The panel reaches the character store, which subscribes to Electron's job progress at load.
vi.mock('../src/renderer/stores/jobStore', () => ({ useJobStore: {} }))

/** What the browser keeps for the mod across a reload, in memory for the test. */
const kept = new Map<string, string>()
const storage = {
  getItem: (key: string) => kept.get(key) ?? null,
  setItem: (key: string, value: string) => void kept.set(key, value),
  removeItem: (key: string) => void kept.delete(key)
}

function lessNsfwText(on: boolean): void {
  useSettingsStore.setState({ settings: redactSettings({ ...defaultSettings(), lessNsfwText: on }) })
}

beforeEach(() => {
  Object.assign(globalThis, { localStorage: storage })
  kept.clear()
  useGameStore.setState({ playthroughId: 'p', currentSceneTranscript: [] })
})
afterEach(() => {
  useTableStore.getState().setAgreed(null)
  useSettingsStore.setState({ settings: null })
  delete (globalThis as { localStorage?: unknown }).localStorage
})

describe('a game agreed to before a reload', () => {
  it('opens as agreed while the content setting still allows it', () => {
    lessNsfwText(false)
    useTableStore.getState().setAgreed({ gameId: 'truth-or-dare', charIds: ['a'], stake: '', options: { rounds: 3, heat: 4 } })
    useTableStore.getState().dropAgreed()
    const sitting = sittingOf(keptAgreed())
    expect(sitting?.options).toEqual({ rounds: 3, heat: 4 })
  })

  it('falls back to what the game allows now where the setting was turned back in between', () => {
    lessNsfwText(false)
    useTableStore.getState().setAgreed({ gameId: 'truth-or-dare', charIds: ['a'], stake: '', options: { rounds: 3, heat: 4 } })
    useTableStore.getState().dropAgreed()
    // Less NSFW text switched on again before the table opened: heat 4 is no longer a choice.
    lessNsfwText(true)
    const restored = keptAgreed()
    expect(restored?.options.heat).toBe(4)
    const sitting = sittingOf(restored)
    expect(sitting?.game.options?.find((option) => option.id === 'heat')?.max).toBe(3)
    expect(sitting?.options).toEqual({ rounds: 3, heat: 2 })
  })
})
