import type { RendererSettings } from '../src/shared/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { character, stubApi } from './fixtures'
import { setRendererPhotoSwitches } from './fixtures/photoSwitchState'
import { describedPhotoTier } from '../src/shared/photoGate'

// SSR normally reads Zustand’s boot snapshot; use the kit’s synchronous readers for this save.
vi.mock('@vx/modkit/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vx/modkit/renderer')>()
  return {
    ...actual,
    useGameFacts: actual.gameFacts,
    useCharacter: actual.character,
    useNoNsfwImages: actual.noNsfwImages
  }
})

stubApi({ jobs: { onProgress: () => () => {} } })
const { MessagePhoto } = await import('../src/renderer/components/PhotoBubble')
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { useSettingsStore } = await import('../src/renderer/stores/settingsStore')
const { DEFAULT_PHOTO_SWITCHES } = await import('../src/shared/photoSwitches')

beforeEach(() => {
  useGameStore.setState({
    playthroughId: '1',
    characters: {
      male: character({ charId: 'male', gender: 'male' }),
      female: character({ charId: 'female' })
    }
  })
})

describe('covers on male photos', () => {
  it.each([
    [true, false],
    [false, false],
    [true, true],
    [false, true]
  ] as const)(
    'uses the same cover for both genders with explicit %s / No NSFW %s',
    (explicit, noNsfwImages) => {
      setRendererPhotoSwitches({ ...DEFAULT_PHOTO_SWITCHES, on: true, explicit })
      useSettingsStore.setState({ settings: { noNsfwImages } as RendererSettings })
      for (const charId of ['male', 'female']) {
        const html = renderToStaticMarkup(
          createElement(MessagePhoto, {
            charId,
            photo: { tier: 'explicit', scene: 'nude', file: 'photo_chat_001.webp' }
          })
        )

        expect(html).toContain('vu-bb-photo--veiled')
        expect(html.includes('vu-bb-photo-eye')).toBe(explicit && !noNsfwImages)
      }
      const tier = describedPhotoTier('shirtless in his shorts', 'male')
      const ordinary = renderToStaticMarkup(
        createElement(MessagePhoto, {
          charId: 'male',
          photo: { tier, scene: 'shirtless in his shorts', file: 'photo_chat_002.webp' }
        })
      )

      expect(ordinary).not.toContain('vu-bb-photo--veiled')
      expect(ordinary).not.toContain('vu-bb-photo-eye')
    }
  )
})

const { BODY_EDITOR_FIELD } = await import('../src/renderer/views/bodyFields')
const { useSetupStore } = await import('../src/renderer/stores/setupStore')
const { feedFriendFor, withFeedPicturesRequest, withGroupPhotoRequest } = await import('../src/renderer/stores/photoGroup')
const { postPhoto } = await import('../src/renderer/stores/photoRecords')
const { preparePostPhoto } = await import('../src/renderer/stores/photoPost')
const { photoCalls } = await import('./fixtures/photoCalls')

describe('male editor and feed integration', () => {
  beforeEach(() => {
    stubApi({ jobs: { onProgress: () => () => {} } })
    useGameStore.setState({ chars: ['male', 'female'], date: 1, time: 0, npcRelationships: {} })
    useSettingsStore.setState({
      settings: { noNsfwImages: true, comfyDeferred: false } as RendererSettings
    })
    useSetupStore.setState({ status: { comfyReady: true } as never })
    setRendererPhotoSwitches({
      ...DEFAULT_PHOTO_SWITCHES,
      on: true,
      explicit: false,
      body: true,
      duo: true
    })
  })

  it('round-trips male editor picks without storing its gender context or changing the source', () => {
    const body = { build: 'muscular_male', breasts: 'pectorals', pubicHair: 'male_pubic_hair' }
    const guy = character({ gender: 'male', ex: { 'photo-feature': { v: '1.8.0', data: body } } })
    const before = structuredClone(guy)
    const form = BODY_EDITOR_FIELD.read(guy)

    const written = BODY_EDITOR_FIELD.write(form)

    expect(written.ex?.['photo-feature'].data).toEqual(body)
    expect(written.ex?.['photo-feature'].data).not.toHaveProperty('gender')
    expect(guy).toEqual(before)
  })

  /** The slot's opening as the kit hands it over: two posters, Adam placed with Bea. */
  function opening(withBea: boolean) {
    const { male: adam, female: bea } = useGameStore.getState().characters
    return {
      date: 10,
      time: 0 as const,
      posters: [
        { character: adam, charKey: 'adam', ...(withBea ? { whereabouts: { companions: { knownNames: ['Bea'] } } } : {}) },
        { character: bea, charKey: 'bea' }
      ]
    }
  }
  const request = { system: '', user: 'OPENING\nYOUR TURN\nwrite', schema: { name: 'x', schema: {} } } as never

  /** Two named, known friends; `sharedOn` files an earlier picture of the two on that date. */
  function friends(sharedOn?: number): void {
    const { male, female } = useGameStore.getState().characters
    const post = { id: 'p', date: sharedOn ?? 0, time: 0, text: 'x', likes: 0, comments: [] }
    useGameStore.setState({
      date: 10,
      time: 0,
      characters: {
        male: { ...male, firstName: 'Adam' },
        female: { ...female, firstName: 'Bea' }
      },
      charInfo: {
        male: { nameKnown: true, feed: sharedOn === undefined ? [] : [postPhoto.with(post as never, { tier: 'casual', with: 'female' })] },
        female: { nameKnown: true, feed: [] }
      } as never,
      npcRelationships: { 'female|male': { affinity: 0, dating: 0 } }
    })
  }

  it('gives the slot one picture alone and one of a poster with the friend they are with', () => {
    friends()
    const asked = withFeedPicturesRequest(request, opening(true))
    const block = (asked as { user: string }).user.split('FEED PICTURES')[1] ?? ''
    expect(block).toContain('- adam:')
    expect(block).toContain('- bea:')
    expect(feedFriendFor('male')).toBe('female')
    expect(feedFriendFor('female')).toBeUndefined()
  })

  it('makes both pictures alone without a friend there, inside the cooldown, or with duos off', () => {
    friends()
    withFeedPicturesRequest(request, opening(false))
    expect(feedFriendFor('male')).toBeUndefined()

    friends(8)
    withFeedPicturesRequest(request, opening(true))
    expect(feedFriendFor('male')).toBeUndefined()

    friends(2)
    withFeedPicturesRequest(request, opening(true))
    expect(feedFriendFor('male')).toBe('female')

    friends()
    setRendererPhotoSwitches({ ...DEFAULT_PHOTO_SWITCHES, on: true, duo: false })
    const asked = withFeedPicturesRequest(request, opening(true))
    expect(feedFriendFor('male')).toBeUndefined()
    const block = (asked as { user: string }).user.split('FEED PICTURES')[1] ?? ''
    expect(block).toContain('- adam:')
    expect(block).toContain('- bea:')
  })

  it('asks the scene for a picture of one of them alone when the pair shared one lately', () => {
    friends(8)
    const { male, female } = useGameStore.getState().characters
    const asked = withGroupPhotoRequest(request, [male, female]) as { user: string; schema: { schema: { required?: string[] } } }
    expect(asked.schema.schema.required).toContain('groupPost')
    expect(asked.user).not.toContain('and Bea')
    expect(asked.user).not.toContain('and Adam')
  })

  it('files a shirtless male feed photo under No NSFW, and refuses a shirtless mixed pair', async () => {
    const reserveName = vi.fn(async () => ({ ok: true as const, data: 'adam_bunnyboard_001.webp' }))
    stubApi({ jobs: { onProgress: () => () => {} }, ...photoCalls({ reserveName }) })

    const male = await preparePostPhoto('male', 'shirtless in his shorts')
    const mixed = await preparePostPhoto(
      'male',
      'Him and his friend shirtless in their shorts',
      'female'
    )
    const explicit = await preparePostPhoto('male', 'naked in his room')

    const hands = await preparePostPhoto(
      'male',
      'Him and his friend in their everyday clothes, his hand waving while his friend smiles',
      'female'
    )

    expect(hands?.with).toBe('female')
    expect(male?.shot.tier).toBe('everyday')
    expect(mixed).toBeNull()
    expect(explicit).toBeNull()
    expect(reserveName).toHaveBeenCalledTimes(2)
  })
})
