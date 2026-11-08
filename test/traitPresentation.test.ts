/// <reference path="../src/renderer/signalsmith-stretch.d.ts" />
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MotionConfig } from 'motion/react'
import { registerCharacterTrait } from '@shared/traits'
import { setSharedModRules } from '@shared/modRules'
import { emptyFlags } from '@shared/relationship'
import { TagSelect } from '../src/renderer/components/TagSelect'
import { traitOptions } from '../src/renderer/views/characterFields'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { character, charInfo, stubApi, restoreApi } from './fixtures'

// The page reads the real synthetic store; only the subscription is bypassed for SSR.
vi.mock('../src/renderer/stores/gameStore', async importOriginal => {
  const module = await importOriginal<typeof import('../src/renderer/stores/gameStore')>()
  type State = ReturnType<typeof module.useGameStore.getState>
  return {
    ...module,
    useGameStore: Object.assign(<T>(selector: (state: State) => T) => selector(module.useGameStore.getState()), module.useGameStore)
  }
})

stubApi({ jobs: { onProgress: () => () => {} } })
const { ContactPage } = await import('../src/renderer/views/ContactPage')

const dispose: (() => void)[] = []
const traits = ['High Standards', 'Guest Trait']
const drawContact = () => renderToStaticMarkup(createElement(MotionConfig, { isStatic: true },
  createElement(ContactPage, { charId: 'a', theme: 'day', milestonesOffer: 'none' })))
afterAll(restoreApi)

beforeEach(() => {
  useGameStore.getState().reset()
  setSharedModRules(() => false)
  useGameStore.setState({
    characters: { a: character({ charId: 'a', traits }) }, chars: ['a'],
    charInfo: { a: charInfo({ flags: { ...emptyFlags(), knowsTraits: true, gaveContactInfo: true } }) }
  })
})
afterEach(() => {
  dispose.splice(0).forEach(remove => remove())
  vi.restoreAllMocks()
  useGameStore.getState().reset()
})

describe('registered trait presentation', () => {
  it('hides missing-provider contact chips without erasing the saved tag, then restores them on registration', () => {
    expect(drawContact()).toContain('High Standards')
    expect(drawContact()).not.toContain('Guest Trait')
    const remove = registerCharacterTrait('sample', { value: 'Guest Trait', description: 'A guest', tone: 'sample-gold' })
    dispose.push(remove)
    // Presentation remains available with the owner switched off.
    expect(drawContact()).toContain('Guest Trait')
    expect(drawContact()).toContain('data-tone="sample-gold"')
    remove()
    expect(drawContact()).not.toContain('Guest Trait')
    expect(useGameStore.getState().characters.a.traits).toEqual(traits)
  })

  it('does not reveal registered traits before the player discovers them', () => {
    dispose.push(registerCharacterTrait('sample', { value: 'Guest Trait', description: 'A guest' }))
    useGameStore.setState({ charInfo: { a: charInfo({ flags: { ...emptyFlags(), gaveContactInfo: true } }) } })
    expect(drawContact()).toContain('Sarah')
    expect(drawContact()).not.toContain('Guest Trait')
    expect(drawContact()).not.toContain('High Standards')
  })

  it('leaves native chips without tooltips while preserving extension hint and description fallbacks', () => {
    const draw = (value: string) => renderToStaticMarkup(createElement(TagSelect, {
      id: 'traits', values: [value], options: traitOptions(), onChange: () => {}
    }))
    expect(draw('High Standards')).not.toContain('title=')
    dispose.push(registerCharacterTrait('sample', { value: 'Guest Trait', description: 'Description fallback' }))
    dispose.push(registerCharacterTrait('sample', { value: 'Hinted Trait', description: 'Description', hint: 'Explicit hint' }))
    expect(draw('Guest Trait')).toContain('title="Description fallback"')
    expect(draw('Hinted Trait')).toContain('title="Explicit hint"')
  })
})
