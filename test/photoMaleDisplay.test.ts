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
const { feedFriendLines, feedFriendFor, feedPictureLines } = await import('../src/renderer/stores/photoGroup')
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

  it('keeps the existing feed chance and revokes a cached partner after a breakup', () => {
    const guy = useGameStore.getState().characters.male
    useGameStore.setState({ npcRelationships: { 'female|male': { affinity: 0, dating: 0 } } })
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      expect(feedFriendLines(guy, 1, 0)).toEqual([])
      useGameStore.setState({ date: 2 })
      random.mockReturnValue(0)

      expect(feedFriendLines(guy, 2, 0).length).toBeGreaterThan(0)
      expect(feedFriendFor('male')).toBe('female')
      useGameStore.setState({ npcRelationships: { 'female|male': { affinity: 0, ended: 2 } } })
      expect(feedFriendFor('male')).toBeUndefined()
      expect(feedFriendLines(guy, 2, 0)).toEqual([])
    } finally {
      random.mockRestore()
    }
  })

  it('rolls a picture for male and female posters alike, once a slot, and leaves a duo poster to its friend line', () => {
    const { male: guy, female: girl } = useGameStore.getState().characters
    const random = vi.spyOn(Math, 'random')
    try {
      random.mockReturnValue(0.99)
      const words = feedPictureLines(girl, 5, 0)
      expect(feedPictureLines(guy, 5, 0)).toEqual(words)

      random.mockReturnValue(0)
      // Rolled once a slot: the same posters keep their words.
      expect(feedPictureLines(girl, 5, 0)).toEqual(words)
      expect(feedPictureLines(guy, 5, 0)).toEqual(words)

      // A new slot rolls again, and the same roll gives both genders a picture.
      const hers = feedPictureLines(girl, 6, 0)
      const his = feedPictureLines(guy, 6, 0)
      expect(hers).toHaveLength(1)
      expect(his).toHaveLength(1)
      expect(hers).not.toEqual(words)
      expect(his).not.toEqual(words)

      // A poster whose post is a picture with a friend gets no second picture line.
      useGameStore.setState({ npcRelationships: { 'female|male': { affinity: 0, dating: 0 } } })
      expect(feedFriendLines(guy, 7, 0).length).toBeGreaterThan(0)
      expect(feedPictureLines(guy, 7, 0)).toEqual([])
    } finally {
      random.mockRestore()
    }
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
