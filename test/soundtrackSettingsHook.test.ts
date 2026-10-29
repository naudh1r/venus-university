import { createElement, type ReactNode } from 'react'
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { MotionConfig } from 'motion/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SOUNDTRACK_MOD } from '@shared/soundtracks'
import { ModSlot } from '../src/renderer/mods/ModSlot'
import { screenSlot, subscribeHookRules } from '../src/renderer/mods/hooks'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useSoundtrackStore } from '../src/renderer/stores/soundtrackStore'
import '../src/renderer/modEntries/custom-soundtracks'

// This server render has no Electron host. Use the real motion presets without
// starting the renderer bridge's stores; the kit contract tests check identity.
vi.mock('@vx/modkit/renderer', () => import('../src/renderer/views/motion'))

function draw(busy = false): Promise<string> {
  const element: ReactNode = createElement(MotionConfig, { isStatic: true },
    createElement(ModSlot<'settingsSection'>, { slot: 'settingsSection', props: { theme: 'night', busy } }))
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
const toggle = (on: boolean) => useModsStore.setState({ switches: { on: { [SOUNDTRACK_MOD]: on }, options: {} } })

beforeEach(() => { toggle(true) })
afterEach(() => { vi.restoreAllMocks(); toggle(true) })

describe('Custom Soundtracks settings contribution', () => {
  it('provides one familiar button without opening or loading the soundtrack library', async () => {
    const load = vi.spyOn(useSoundtrackStore.getState(), 'load')
    expect(screenSlot('settingsSection').map(entry => entry.modId)).toEqual([SOUNDTRACK_MOD])
    const html = await draw()
    expect(html.match(/id="settings-soundtracks"/g)).toHaveLength(1)
    expect(html).toContain('class="vu-pill"')
    expect(html).toContain('Custom soundtracks')
    expect(html).not.toContain('role="dialog"')
    expect(load).not.toHaveBeenCalled()
  })

  it.each([false, true])('preserves the backup/restore busy guard (%s)', async busy => {
    expect((await draw(busy)).includes('disabled=""')).toBe(busy)
  })

  it('removes and restores the settings contribution without changing the library', async () => {
    const before = useSoundtrackStore.getState().map
    const redraw = vi.fn(), stop = subscribeHookRules(redraw)
    try {
      toggle(false)
      expect(await draw()).toBe('')
      expect(screenSlot('settingsSection')).toEqual([])
      toggle(true)
      expect((await draw()).match(/id="settings-soundtracks"/g)).toHaveLength(1)
      expect(redraw).toHaveBeenCalledTimes(2)
      expect(useSoundtrackStore.getState().map).toBe(before)
    } finally { stop() }
  })
})
