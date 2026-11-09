import './fixtures/maestroModelKit'
import { createElement, type ReactNode } from 'react'
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from 'react-dom/server'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { scanMods } from './kit/boundaryScan'
import type { GameMenuItemProps, GameModalProps } from '@vx/modkit/renderer'
import { gameModal, openPanel, setPanelOpener } from '../src/renderer/mods/hooks'
import { ModSlot } from '../src/renderer/mods/ModSlot'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { restoreApi, stubApi } from './fixtures'
import '../src/renderer/modEntries/story-memory'

stubApi({ jobs: { onProgress: () => () => {} } })
await import('../src/renderer/modEntries/plot-twist')
const { PlotTwistMenuEntry, PlotTwistPanel } = await import('../src/renderer/views/PlotTwistEntry')
const { StoryMemoryMenuEntry, StoryMemoryPanel } = await import('../src/renderer/views/StoryMemoryEntry')
const Item = ({ dead, note, onClick, children }: GameMenuItemProps) =>
  createElement('button', { disabled: dead, 'data-note': note, onClick }, children)
const opened = vi.fn()
let unbind: () => void

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
const toggle = (plot: boolean, story: boolean) => useModsStore.setState({
  switches: { on: { 'plot-twist': plot, 'story-memory': story }, options: {} }
})
beforeEach(() => { toggle(true, true); unbind = setPanelOpener(opened) })
afterEach(() => { unbind(); vi.clearAllMocks() })
afterAll(restoreApi)

describe('Maestro menu and panel contributions', () => {
  it('keeps the new UI adapters within the kit and their own mod components', () => {
    const scanned = scanMods(resolve(__dirname, '..'), {
      'plot-twist': { globs: ['src/renderer/views/PlotTwistEntry.tsx', 'src/renderer/views/PlotTwistModal.tsx'] },
      'story-memory': { globs: ['src/renderer/views/StoryMemoryEntry.tsx', 'src/renderer/views/StoryMemoryModal.tsx'] }
    })
    expect(scanned.files).toHaveLength(4)
    expect(scanned.violations.filter(violation => violation.file.endsWith('Entry.tsx'))).toEqual([])
  })

  it.each(['open', 'waiting', 'none'] as const)('keeps Plot Twist gated and Story Memory readable at %s', async saveOffer => {
    const html = await draw(createElement(ModSlot<'gameMenuEntry'>, { slot: 'gameMenuEntry', props: { Item, saveOffer } }))
    expect(html.match(/>Plot Twist<\/button>/g)).toHaveLength(1)
    expect(html.match(/>Story Memory…<\/button>/g)).toHaveLength(1)
    expect(html.match(/disabled=""/g)?.length ?? 0).toBe(saveOffer === 'open' ? 0 : 1)
    expect(html).toContain('Wait for a safe save point')
    PlotTwistMenuEntry({ Item, saveOffer }).props.onClick()
    expect(opened.mock.calls).toEqual(saveOffer === 'open' ? [['plot-twist', undefined]] : [])
    StoryMemoryMenuEntry({ Item, saveOffer }).props.onClick()
    expect(opened.mock.calls.at(-1)).toEqual(['story-memory', undefined])
  })

  it('removes both entries and refuses a stale button when its mod is off', async () => {
    const stale = PlotTwistMenuEntry({ Item, saveOffer: 'open' })
    toggle(false, false)
    expect(await draw(createElement(ModSlot<'gameMenuEntry'>, { slot: 'gameMenuEntry', props: { Item, saveOffer: 'open' } }))).toBe('')
    expect(gameModal('plot-twist')).toBeUndefined()
    expect(gameModal('story-memory')).toBeUndefined()
    stale.props.onClick()
    expect(opened).not.toHaveBeenCalled()
    toggle(true, true)
    expect(gameModal('plot-twist')).toBeDefined()
    expect(gameModal('story-memory')).toBeDefined()
  })

  it('uses the active game view opener, and refuses opens after that view unmounts', () => {
    expect(openPanel('plot-twist')).toBe(true)
    unbind()
    expect(openPanel('plot-twist')).toBe(false)
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it.each(['day', 'night'] as const)('preserves theme and each panel’s return destination (%s)', theme => {
    const onClose = vi.fn(), openGameMenu = vi.fn()
    const props: GameModalProps = { theme, arg: undefined, covered: false, onClose, openGameMenu }
    const plot = PlotTwistPanel(props), story = StoryMemoryPanel(props)
    expect(plot.props.theme).toBe(theme)
    expect(story.props.theme).toBe(theme)
    plot.props.onClose()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(openGameMenu).not.toHaveBeenCalled()
    story.props.onClose()
    expect(openGameMenu).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
