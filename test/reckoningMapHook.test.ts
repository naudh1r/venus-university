import { createElement, type ReactNode } from 'react'
import { PassThrough } from 'node:stream'
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeReckoning } from '@shared/reckoning'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { screenSlot } from '../src/renderer/mods/hooks'
import { ModSlot } from '../src/renderer/mods/ModSlot'
import { character, charInfo, restoreApi, stubApi } from './fixtures'

// Read the current synthetic stores during SSR instead of their initial snapshots.
vi.mock('../src/renderer/stores/gameStore', async importOriginal => {
  const module = await importOriginal<typeof import('../src/renderer/stores/gameStore')>()
  type State = ReturnType<typeof module.useGameStore.getState>
  return { ...module, useGameStore: Object.assign(<T>(selector: (state: State) => T) =>
    selector(module.useGameStore.getState()), module.useGameStore) }
})
vi.mock('../src/renderer/stores/modsStore', async importOriginal => {
  const module = await importOriginal<typeof import('../src/renderer/stores/modsStore')>()
  return { ...module, useModOn: module.modIsOn }
})

stubApi({ jobs: { onProgress: () => () => {} } })
await import('../src/renderer/modEntries/reckoning')
const { ReckoningDungeonMapPin } = await import('../src/renderer/views/ReckoningDungeon')

function draw(element: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    let html = ''
    output.on('data', chunk => { html += chunk.toString() })
    output.on('end', () => resolve(html.replace(/<!--.*?-->/g, '')))
    output.on('error', reject)
    const stream = renderToPipeableStream(element, {
      onAllReady() { stream.pipe(output) }, onError: reject
    })
  })
}
const close = vi.fn()
const drawPin = (canTravel = true) => draw(createElement(ModSlot<'mapOverlay'>, {
  slot: 'mapOverlay', props: { canTravel, close }
}))
const switches = (reckoning: boolean, breakthrough = true) => useModsStore.setState({
  switches: { on: { reckoning, breakthrough, echo: false }, options: {} }
})

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  switches(true)
  useGameStore.setState({
    playthroughId: 'map-hook-test', date: 15, time: 1, chars: ['a'], cast: [], awaitingInput: true,
    characters: { a: character({ charId: 'a', firstName: 'Nina' }) },
    charInfo: { a: charInfo({ nameKnown: true }) },
    exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } }),
    exReckoning: normalizeReckoning({ dungeon: {
      id: 'map-link', charId: 'a', aspect: 'wildspark', unlockedByReckoning: true,
      phase: 'unlocked', needsSpirit: true, lines: [], replies: 0, farewellReplies: 0,
      context: { name: 'Nina Rose', reader: 'Sam', evidence: [
        { id: 'profile-a', kind: 'profile', text: 'Nina values her friends.' }
      ] }
    } })
  })
})
afterEach(() => { vi.clearAllMocks(); useGameStore.getState().reset(); resetLoopState() })
afterAll(restoreApi)

describe('Breaking Through the Silence map contribution', () => {
  it('registers exactly one entrance with the former markup and spirit cost', async () => {
    expect(screenSlot('mapOverlay').map(entry => entry.modId)).toEqual(['reckoning'])
    const html = await drawPin()
    expect(html).toBe(renderToStaticMarkup(createElement(ReckoningDungeonMapPin, { canTravel: true, onEnter: close })))
    expect(html.match(/aria-label="The Unspoken entrance"/g)).toHaveLength(1)
    expect(html).toContain('Follow her voice · 100 spirit')
    expect(html).not.toContain('disabled=""')
    expect(close).not.toHaveBeenCalled()
  })

  it.each(['read-only', 'daytime', 'spirit', 'scene', 'replay'] as const)('preserves the %s entry guard', async reason => {
    if (reason === 'daytime') useGameStore.setState({ time: 0 })
    if (reason === 'spirit') useGameStore.setState({ exBreakthrough: normalizeBreakthrough({ meters: { a: 99 } }) })
    if (reason === 'scene') useGameStore.setState({ cast: ['a'], currentSceneTranscript: [{ speaker: 'a', text: 'Wait.' }] })
    if (reason === 'replay') useGameStore.setState({ replaying: {} })
    const html = await drawPin(reason !== 'read-only')
    expect(html).toContain('disabled=""')
    if (reason === 'daytime') expect(html).toContain('Follow after dark')
    if (reason === 'spirit') expect(html).toContain('Needs 100 spirit')
    expect(close).not.toHaveBeenCalled()
  })

  it.each([false, true])('removes the entrance when Reckoning or its required mod is off (%s)', async disableRequirement => {
    const saved = useGameStore.getState().exReckoning
    switches(disableRequirement, !disableRequirement)
    expect(await drawPin()).toBe('')
    switches(true)
    expect((await drawPin()).match(/aria-label="The Unspoken entrance"/g)).toHaveLength(1)
    expect(useGameStore.getState().exReckoning).toBe(saved)
  })

  it('does not create an entrance for an absent or already-entered link', async () => {
    const saved = useGameStore.getState().exReckoning
    useGameStore.setState({ exReckoning: { ...saved, dungeon: { ...saved.dungeon!, phase: 'inside' } } })
    expect(await drawPin()).toBe('')
    useGameStore.setState({ exReckoning: normalizeReckoning({}) })
    expect(await drawPin()).toBe('')
  })
})
