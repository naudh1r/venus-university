import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, Result } from '@shared/types'
import { restoreApi, stubApi } from './fixtures'

/**
 * That the photo feature's *order of events* is what it has to be.
 *
 * `photoHooks.test.ts` proves each core file still calls in. These prove the calls still do what
 * the calling order depends on — the part a sync can break while leaving every hook in place,
 * and the part that has no compiler to answer to.
 *
 * Every rule checked here is one that was broken at some point while this was being ported, and
 * each one failed silently: a post that stood over an empty frame, a trigger that fired on every
 * turn of a scene rather than the first, and a second picture post in one slot filed as text
 * under replies written for its picture.
 */

stubApi({ jobs: { onProgress: () => () => {} } })

type ReserveName = (
  playthroughId: string,
  character: Character,
  kind: string
) => Promise<Result<string>>

type GeneratePhoto = (
  playthroughId: string,
  character: Character,
  tier: string,
  photoPrompt: string,
  file: string
) => Promise<Result<string>>

/** A render that never resolves, so a test can see what was filed *before* the picture lands. */
function pendingRender(): { reserve: ReserveName; generate: GeneratePhoto } {
  return {
    reserve: vi.fn<ReserveName>(async () => ({ ok: true, data: 'gwen_bunnyboard_001.png' })),
    generate: vi.fn<GeneratePhoto>(() => new Promise<Result<string>>(() => {}))
  }
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  restoreApi()
  vi.restoreAllMocks()
})

describe('a post that carries a picture', () => {
  it('is not filed while the picture is still being drawn', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate }
    })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { beginSlotPhotos, holdPostPhoto, preparePostPhoto, startHeldPostPhoto } = await import(
      '../src/renderer/stores/photoPost'
    )

    useGameStore.setState({ playthroughId: '1', characters: {}, charInfo: {} })
    beginSlotPhotos()
    // No renderer configured in a test environment, so the gate refuses and nothing is prepared:
    // the assertion is that a refused picture reserves no name and files no post either.
    const shot = await preparePostPhoto('c1', 'lying on the grass in a red top')
    expect(shot).toBeNull()
    expect(api.reserve).not.toHaveBeenCalled()

    // And with one prepared by hand, the post still does not reach the feed until it is drawn.
    const appended = vi.fn()
    useGameStore.setState({ appendFeedPost: appended } as never)
    holdPostPhoto(
      'c1',
      { id: 'p1', text: 'hi', date: 0, time: 0, likes: 1 },
      { shot: { tier: 'everyday', scene: 'on the grass' }, file: 'gwen_bunnyboard_001.png' },
      () => {}
    )
    expect(appended).not.toHaveBeenCalled()
    startHeldPostPhoto()
    // The render is in flight and never settles, so the post is still not filed.
    await Promise.resolve()
    expect(appended).not.toHaveBeenCalled()
  })
})

describe('the held render', () => {
  it('fires once, however many turns the scene runs', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate }
    })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { holdPostPhoto, startHeldPostPhoto } = await import(
      '../src/renderer/stores/photoPost'
    )

    useGameStore.setState({
      playthroughId: '1',
      characters: { c1: { charId: 'c1', firstName: 'Gwen' } } as never
    })
    holdPostPhoto(
      'c1',
      { id: 'p1', text: 'hi', date: 0, time: 0, likes: 1 },
      { shot: { tier: 'everyday', scene: 'on the grass' }, file: 'gwen_bunnyboard_001.png' },
      () => {}
    )

    // `submitAction` calls this on every turn of a scene, not only the first.
    startHeldPostPhoto()
    startHeldPostPhoto()
    startHeldPostPhoto()
    await Promise.resolve()
    expect(api.generate).toHaveBeenCalledTimes(1)
  })

  it('draws every post a slot held, one after the other', async () => {
    // Each render waits for the test to finish it, so the order can be watched.
    const finish: Array<() => void> = []
    const generate = vi.fn<GeneratePhoto>(
      () =>
        new Promise<Result<string>>((resolve) => {
          finish.push(() => resolve({ ok: true, data: 'done' }))
        })
    )
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: vi.fn<ReserveName>(), generate },
      // A post that lands is saved on its own.
      saves: { autosave: async () => ({ ok: true, data: {} as never }) }
    })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { beginSlotPhotos, holdPostPhoto, startHeldPostPhoto } = await import(
      '../src/renderer/stores/photoPost'
    )
    const appended = vi.fn()
    useGameStore.setState({
      playthroughId: '1',
      characters: {
        c1: { charId: 'c1', firstName: 'Florentine' },
        c2: { charId: 'c2', firstName: 'April' }
      },
      charInfo: {},
      appendFeedPost: appended
    } as never)

    beginSlotPhotos()
    holdPostPhoto(
      'c1',
      { id: 'p1', text: 'milkshake', date: 0, time: 0, likes: 1 },
      { shot: { tier: 'everyday', scene: 'a milkshake' }, file: 'c1_bunnyboard_001.png' },
      () => {}
    )
    holdPostPhoto(
      'c2',
      { id: 'p2', text: 'fries', date: 0, time: 0, likes: 1 },
      { shot: { tier: 'everyday', scene: 'a booth' }, file: 'c2_bunnyboard_001.png' },
      () => {}
    )

    startHeldPostPhoto()
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1))
    // The second waits for the first: never two renders at once.
    expect(generate.mock.calls[0]?.[4]).toBe('c1_bunnyboard_001.png')
    finish[0]?.()
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2))
    expect(generate.mock.calls[1]?.[4]).toBe('c2_bunnyboard_001.png')
    finish[1]?.()
    await vi.waitFor(() => expect(appended).toHaveBeenCalledTimes(2))
  })

  it('lets a slot nobody acted in go, rather than drawing it late', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate }
    })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { beginSlotPhotos, holdPostPhoto, startHeldPostPhoto } = await import(
      '../src/renderer/stores/photoPost'
    )
    useGameStore.setState({
      playthroughId: '1',
      characters: { c1: { charId: 'c1', firstName: 'Gwen' } } as never
    })

    beginSlotPhotos()
    holdPostPhoto(
      'c1',
      { id: 'p1', text: 'hi', date: 0, time: 0, likes: 1 },
      { shot: { tier: 'everyday', scene: 'on the grass' }, file: 'gwen_bunnyboard_001.png' },
      () => {}
    )
    // The next slot opens before he committed to anything in this one.
    beginSlotPhotos()
    startHeldPostPhoto()
    await Promise.resolve()
    await Promise.resolve()
    expect(api.generate).not.toHaveBeenCalled()
  })

  it('has nothing to fire when the slot prepared no picture', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate }
    })
    const { startHeldPostPhoto } = await import('../src/renderer/stores/photoPost')
    startHeldPostPhoto()
    await Promise.resolve()
    expect(api.generate).not.toHaveBeenCalled()
  })
})

describe('what the crowd said', () => {
  it('keeps nothing where the model wrote nothing, whatever the roll', async () => {
    stubApi({ jobs: { onProgress: () => () => {} } })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { rollComments } = await import('../src/renderer/stores/photoComments')
    useGameStore.setState({ npcRelationships: {}, chars: [] } as never)
    expect(rollComments('c1', undefined)).toEqual([])
    expect(rollComments('c1', ['  ', ''])).toEqual([])
  })

  it('never keeps more replies than the model actually wrote', async () => {
    stubApi({ jobs: { onProgress: () => () => {} } })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { rollComments } = await import('../src/renderer/stores/photoComments')
    // A girl with many friends rolls a high count; only two lines came back.
    useGameStore.setState({
      npcRelationships: {},
      chars: [],
      date: 0,
      time: 0
    } as never)
    const said = rollComments('c1', ['first', 'second'])
    expect(said.length).toBeLessThanOrEqual(2)
    for (const one of said) {
      expect(one.handle).toBeTruthy()
      expect(one.emoji).toBeTruthy()
    }
  })
})
