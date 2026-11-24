import './fixtures/maestroModelKit'
import { createElement } from 'react'
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModSlot } from '../src/renderer/mods/ModSlot'
import { screenSlot, type ScreenSlotProps } from '../src/renderer/mods/hooks'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import '../src/renderer/modEntries/reckoning'

// Probe the contribution's wiring; the real request/continuation logic has its own store tests.
vi.mock('../src/renderer/views/ReckoningModal', () => ({
  ReckoningPreparation: () => createElement('i', { 'data-preparation': true }),
  ReckoningContinuation: ({ blocked }: { blocked: boolean }) =>
    createElement('i', { 'data-continuation-blocked': String(blocked) })
}))
vi.mock('../src/renderer/views/UnspokenVoice', () => ({
  UnspokenVoice: ({ hidden }: { hidden: boolean }) =>
    createElement('i', { 'data-voice-hidden': String(hidden) })
}))

const openGameMenu = vi.fn()
const defaults: ScreenSlotProps['panelLayer'] = {
  blocked: false, covered: false, uiHidden: false, cinematic: false, panelOpen: false, openGameMenu
}
const toggle = (reckoning: boolean, breakthrough = true) => useModsStore.setState({
  switches: { on: { reckoning, breakthrough }, options: {} }
})
function draw(over: Partial<ScreenSlotProps['panelLayer']> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    let html = ''
    output.on('data', chunk => { html += chunk.toString() })
    output.on('end', () => resolve(html.replace(/<!--.*?-->/g, '')))
    output.on('error', reject)
    const stream = renderToPipeableStream(createElement(ModSlot<'panelLayer'>, {
      slot: 'panelLayer', props: { ...defaults, ...over }
    }), { onAllReady() { stream.pipe(output) }, onError: reject })
  })
}

beforeEach(() => { resetLoopState(); toggle(true); vi.clearAllMocks() })
afterEach(() => { toggle(false); resetLoopState() })

describe('Breaking Through the Silence panel contribution', () => {
  it('registers one lazy scene contribution with all three services', async () => {
    expect(screenSlot('panelLayer').map(entry => entry.modId)).toEqual(['reckoning'])
    const html = await draw()
    expect(html.match(/data-preparation=/g)).toHaveLength(1)
    expect(html.match(/data-voice-hidden="false"/g)).toHaveLength(1)
    expect(html.match(/data-continuation-blocked="false"/g)).toHaveLength(1)
    expect(openGameMenu).not.toHaveBeenCalled()
  })

  it.each(['blocked', 'covered', 'uiHidden', 'cinematic', 'panelOpen'] as const)(
    'preserves each service’s separate %s rule', async flag => {
      const html = await draw({ [flag]: true })
      expect(html).toContain('data-preparation="true"')
      expect(html).toContain(`data-voice-hidden="${flag !== 'panelOpen'}"`)
      expect(html).toContain(`data-continuation-blocked="${flag === 'blocked' || flag === 'covered'}"`)
      expect(openGameMenu).not.toHaveBeenCalled()
    }
  )

  it.each([false, true])('removes all services when the mod or dependency is off (%s)', async dependency => {
    toggle(dependency, !dependency)
    expect(screenSlot('panelLayer')).toEqual([])
    expect(await draw()).toBe('')
    toggle(true)
    expect((await draw()).match(/data-preparation=/g)).toHaveLength(1)
    expect(screenSlot('panelLayer').map(entry => entry.modId)).toEqual(['reckoning'])
  })
})
