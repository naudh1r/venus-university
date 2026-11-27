import { createElement, isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScreenSlot, ScreenSlotProps } from '../src/renderer/mods/hooks'

/** The places on screen: each draws the mods that are on, in list order, each kept to itself. */

type Hooks = typeof import('../src/renderer/mods/hooks')
type Slots = typeof import('../src/renderer/mods/ModSlot')

async function fresh(on: Record<string, boolean>, order: string[]): Promise<{ hooks: Hooks; slots: Slots }> {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const slots = await import('../src/renderer/mods/ModSlot')
  hooks.setHookRules({ isOn: (id) => on[id] ?? true, order: (id) => order.indexOf(id) })
  return { hooks, slots }
}

const PROPS: { [S in ScreenSlot]: ScreenSlotProps[S] } = {
  settingsSection: { theme: 'day', busy: false },
  portraitOverlay: { charId: 'c1' },
  phoneOverlay: {},
  conversationFoot: { charId: 'c1' },
  chatsHeader: { theme: 'day' },
  mapOverlay: { canTravel: true, close: () => {} },
  photosPageSection: { theme: 'night' },
  editCharacterImages: { charId: 'c1', name: 'Mina', theme: 'day', height: 1 },
  stageLayer: {
    sceneMode: true,
    cinematic: false,
    covered: false,
    uiHidden: false,
    rowShown: true,
    blocked: false,
    quiz: false,
    interjectRow: null,
    awaitingInput: true
  },
  panelLayer: {
    cinematic: false,
    covered: false,
    uiHidden: false,
    blocked: false,
    panelOpen: false,
    openGameMenu: () => {}
  },
  messageAttachment: { message: { id: 'm1', sender: 'contact', text: 'hi', date: 0, time: 0 } },
  contactPostExtra: { charId: 'c1', post: { id: 'p1', text: 'hi', date: 0, time: 0, likes: 0 } },
  railButton: { Seat: () => null, visible: true, dead: false },
  landingTool: { Tool: () => null, visible: true },
  gameMenuEntry: { Item: () => null, saveOffer: 'open' },
  advancedSettingsEntry: { theme: 'day', busy: false }
}

const SLOTS = Object.keys(PROPS) as ScreenSlot[]

/** A component that draws its mod's id and the props it was handed. */
function marker(modId: string): (props: object) => ReactElement {
  return (props) => createElement('i', { 'data-mod': modId }, JSON.stringify(props))
}

describe('a place on screen', () => {
  it.each(SLOTS)('%s draws the mods that are on, in list order, and not the one that is off', async (slot) => {
    const { hooks, slots } = await fresh({ off: false }, ['first', 'second', 'off'])
    // Registered out of order, to show the list decides.
    hooks.registerHooks('second', { [slot]: marker('second') })
    hooks.registerHooks('off', { [slot]: marker('off') })
    hooks.registerHooks('first', { [slot]: marker('first') })
    const html = renderToStaticMarkup(
      createElement(slots.ModSlot<typeof slot>, { slot, props: PROPS[slot] })
    )
    expect([...html.matchAll(/data-mod="([^"]+)"/g)].map((match) => match[1])).toEqual(['first', 'second'])
    expect(html).toContain(JSON.stringify(PROPS[slot]).replace(/"/g, '&quot;'))
  })

  it('draws nothing where no mod that is on has a component', async () => {
    const { hooks, slots } = await fresh({ off: false }, ['off'])
    hooks.registerHooks('off', { mapOverlay: marker('off') })
    const html = renderToStaticMarkup(
      createElement(slots.ModSlot<'mapOverlay'>, { slot: 'mapOverlay', props: PROPS.mapOverlay })
    )
    expect(html).toBe('')
  })
})

describe('a playthrough-scoped mod', () => {
  it('is drawn once a game is entered with it in the record, and not once the game is left', async () => {
    vi.resetModules()
    const mods = await import('../src/shared/mods')
    const { useModsStore } = await import('../src/renderer/stores/modsStore')
    const { loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')
    const hooks = await import('../src/renderer/mods/hooks')
    const slots = await import('../src/renderer/mods/ModSlot')
    const { playthroughRecord } = await import('./fixtures')
    const list = mods.MODS as import('../src/shared/mods').ModDef[]
    const fixture = {
      id: 'enrolled', name: 'Enrolled', author: 'fixture', version: '1',
      scope: 'playthrough' as const, defaultOn: false, blurb: ''
    }
    list.push(fixture)
    // Its switch is off, so only the record can put it on screen.
    useModsStore.setState({ switches: { on: { [fixture.id]: false }, options: {} } })
    hooks.registerHooks(fixture.id, { phoneOverlay: marker(fixture.id) })
    const drawn = (): string =>
      renderToStaticMarkup(
        createElement(slots.ModSlot<'phoneOverlay'>, { slot: 'phoneOverlay', props: PROPS.phoneOverlay })
      )
    // What ModSlot subscribes to, so each call is a redraw.
    const redraw = vi.fn()
    const stop = hooks.subscribeHookRules(redraw)

    try {
      expect(drawn()).toBe('')
      loopState.record = playthroughRecord({ mods: [fixture.id] })
      expect(redraw).toHaveBeenCalledOnce()
      expect(drawn()).toContain(`data-mod="${fixture.id}"`)
      resetLoopState()
      expect(redraw).toHaveBeenCalledTimes(2)
      expect(drawn()).toBe('')
    } finally {
      stop()
      list.splice(list.indexOf(fixture), 1)
      resetLoopState()
    }
  })
})

describe('a component that throws', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sits in a boundary of its own, apart from every other mod drawn there', async () => {
    const { hooks, slots } = await fresh({}, ['throws', 'draws'])
    const Throws = (): null => {
      throw new Error('broken mod')
    }
    const Draws = marker('draws')
    hooks.registerHooks('throws', { stageLayer: Throws })
    hooks.registerHooks('draws', { stageLayer: Draws })
    const elements = slots.slotElements('stageLayer', PROPS.stageLayer)
    expect(elements.map((element) => [element.type, element.key])).toEqual([
      [slots.SlotBoundary, 'throws'],
      [slots.SlotBoundary, 'draws']
    ])
    const inner = elements.map((element) => (element.props as { children: ReactElement }).children)
    expect(inner.map((child) => isValidElement(child) && child.type)).toEqual([Throws, Draws])
  })

  it('draws nothing once it has thrown, and the warning names the mod and the place', async () => {
    const { slots } = await fresh({}, [])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const child = createElement('i')
    const boundary = new slots.SlotBoundary({ slot: 'panelLayer', modId: 'broken', children: child })
    expect(boundary.render()).toBe(child)
    boundary.state = slots.SlotBoundary.getDerivedStateFromError()
    expect(boundary.render()).toBeNull()
    boundary.componentDidCatch(new Error('broken mod'), { componentStack: '' })
    expect(warn).toHaveBeenCalledOnce()
    expect(String(warn.mock.calls[0][0])).toContain("broken's panelLayer")
  })
})
