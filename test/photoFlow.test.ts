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
 * turn of a scene rather than the first, a second picture post in one slot filed as text under
 * replies written for its picture, and a post lost because the slot moved on before its picture
 * was drawn.
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

type Landed = (playthroughId: string, charId: string, file: string) => Promise<Result<boolean>>

/** Nothing on disk yet: every held post has to be drawn. */
const notLanded = vi.fn<Landed>(async () => ({ ok: true, data: false }))

/** A save write that succeeds, since a post that comes out is saved on its own. */
const saves = { autosave: async () => ({ ok: true as const, data: {} as never }) }

/** The one post the tests hold, and the picture it was written for. */
function heldPost(id = 'p1'): {
  written: { id: string; text: string; date: number; time: 0; likes: number }
  prepared: { shot: { tier: 'everyday'; scene: string }; file: string }
} {
  return {
    written: { id, text: 'hi', date: 0, time: 0, likes: 1 },
    prepared: { shot: { tier: 'everyday', scene: 'on the grass' }, file: `gwen_${id}.png` }
  }
}

/**
 * Photos switched on, with a renderer that says it is ready — what `canSendPhotos` asks. `on`
 * false is the player's switch turned off.
 */
async function photosSwitched(on: boolean): Promise<void> {
  const { useSettingsStore } = await import('../src/renderer/stores/settingsStore')
  const { useSetupStore } = await import('../src/renderer/stores/setupStore')
  useSettingsStore.setState({ settings: { photos: on, comfyDeferred: false } as never })
  useSetupStore.setState({ status: { comfyReady: true } as never })
}

/** A fresh store with one character in it, and the feature's modules loaded against it. */
async function loaded(): Promise<{
  useGameStore: typeof import('../src/renderer/stores/gameStore').useGameStore
  post: typeof import('../src/renderer/stores/photoPost')
  photoOf: (postId?: string) => Record<string, unknown> | undefined
}> {
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const post = await import('../src/renderer/stores/photoPost')
  await photosSwitched(true)
  useGameStore.setState({
    playthroughId: '1',
    characters: { c1: { charId: 'c1', firstName: 'Gwen' } } as never,
    charInfo: {}
  })
  const photoOf = (postId = 'p1'): Record<string, unknown> | undefined =>
    useGameStore.getState().charInfo.c1?.feed?.find((one) => one.id === postId)
      ?.photo as unknown as Record<string, unknown> | undefined
  return { useGameStore, post, photoOf }
}

describe('a post that carries a picture', () => {
  it('reserves nothing for a picture the gate refuses', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate }
    })
    const { post } = await loaded()
    await photosSwitched(false)
    // Photos switched off, so the gate refuses and nothing is prepared.
    expect(await post.preparePostPhoto('c1', 'lying on the grass in a red top')).toBeNull()
    expect(api.reserve).not.toHaveBeenCalled()
  })

  it('is filed held, in the save and off every list, while the picture is being drawn', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate, landed: notLanded }
    })
    const { useGameStore, post, photoOf } = await loaded()
    const { postIsOut } = await import('../src/shared/heldPosts')
    const { contactFeedPosts } = await import('../src/renderer/stores/feedView')
    const { written, prepared } = heldPost()

    post.holdPostPhoto('c1', written, prepared, () => {})
    expect(photoOf()).toEqual({
      tier: 'everyday',
      scene: 'on the grass',
      file: 'gwen_p1.png',
      held: true
    })
    const game = useGameStore.getState()
    expect(game.charInfo.c1?.feed?.every(postIsOut)).toBe(false)
    // Even a contact's: the Updates tab lists nothing that is still held.
    game.charInfo.c1!.flags = { gaveContactInfo: true } as never
    expect(contactFeedPosts(['c1'], game.charInfo)).toEqual([])

    post.startHeldPostPhoto()
    // The render is in flight and never settles, so the post is still held.
    await vi.waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1))
    expect(photoOf()?.held).toBe(true)
  })
})

describe('the held render', () => {
  it('fires once, however many turns the scene runs', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate, landed: notLanded }
    })
    const { post } = await loaded()
    const { written, prepared } = heldPost()
    post.holdPostPhoto('c1', written, prepared, () => {})

    // `submitAction` calls this on every turn of a scene, not only the first.
    post.startHeldPostPhoto()
    post.startHeldPostPhoto()
    post.startHeldPostPhoto()
    await vi.waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(api.generate).toHaveBeenCalledTimes(1)
  })

  it('draws every held post, one after the other, and lets each out as it lands', async () => {
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
      photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
      saves
    })
    const { post, photoOf } = await loaded()
    const one = heldPost('p1')
    const two = heldPost('p2')
    post.holdPostPhoto('c1', one.written, one.prepared, () => {})
    post.holdPostPhoto('c1', two.written, two.prepared, () => {})

    post.startHeldPostPhoto()
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1))
    // The second waits for the first: never two renders at once.
    expect(generate.mock.calls[0]?.[4]).toBe('gwen_p1.png')
    finish[0]?.()
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2))
    expect(generate.mock.calls[1]?.[4]).toBe('gwen_p2.png')
    expect(photoOf('p1')).toEqual({ tier: 'everyday', scene: 'on the grass', file: 'gwen_p1.png' })
    finish[1]?.()
    await vi.waitFor(() => expect(photoOf('p2')?.held).toBeUndefined())
  })

  it('keeps a post held over a reload or into the next slot, and draws it then', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate, landed: notLanded }
    })
    const first = await loaded()
    const { written, prepared } = heldPost()
    first.post.holdPostPhoto('c1', written, prepared, () => {})
    const charInfo = first.useGameStore.getState().charInfo

    // A reload: every module fresh, the save's feed all that is left.
    vi.resetModules()
    const again = await loaded()
    again.useGameStore.setState({ charInfo })
    again.post.startHeldPostPhoto()
    await vi.waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.generate).mock.calls[0]?.[4]).toBe('gwen_p1.png')
  })

  it('lets out a post whose picture landed before the save said so, without drawing it', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: {
        reserveName: api.reserve,
        generate: api.generate,
        landed: vi.fn<Landed>(async () => ({ ok: true, data: true }))
      },
      saves
    })
    const { post, photoOf } = await loaded()
    const { written, prepared } = heldPost()
    post.holdPostPhoto('c1', written, prepared, () => {})
    post.startHeldPostPhoto()
    await vi.waitFor(() => expect(photoOf()?.held).toBeUndefined())
    expect(api.generate).not.toHaveBeenCalled()
  })

  it('has nothing to fire when no post is held', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate, landed: notLanded }
    })
    const { post } = await loaded()
    post.startHeldPostPhoto()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(api.generate).not.toHaveBeenCalled()
  })
})

describe('photos switched off', () => {
  it('keeps a held post held and undrawn, and draws it once they are back on', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate, landed: notLanded }
    })
    const { post, photoOf } = await loaded()
    const { written, prepared } = heldPost()
    post.holdPostPhoto('c1', written, prepared, () => {})

    await photosSwitched(false)
    post.startHeldPostPhoto()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(api.generate).not.toHaveBeenCalled()
    expect(photoOf()?.held).toBe(true)

    await photosSwitched(true)
    post.startHeldPostPhoto()
    await vi.waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1))
  })

  it('does not reroll a failed picture', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: api.reserve, generate: api.generate, landed: notLanded }
    })
    const { useGameStore, post, photoOf } = await loaded()
    useGameStore.getState().appendFeedPost('c1', {
      ...heldPost().written,
      photo: { tier: 'everyday', scene: 'on the grass', file: 'gwen_p1.png', failed: true }
    })
    await photosSwitched(false)
    post.rerollPostPhoto('c1', 'p1')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(api.generate).not.toHaveBeenCalled()
    expect(photoOf()?.failed).toBe(true)
  })
})

describe('a picture that does not come', () => {
  it('lets the post out saying so when the render fails', async () => {
    const generate = vi.fn<GeneratePhoto>(async () => ({
      ok: false,
      error: { code: 'COMFY_OFFLINE', message: 'ComfyUI is not running' }
    }))
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
      saves
    })
    const { post, photoOf } = await loaded()
    const { written, prepared } = heldPost()
    post.holdPostPhoto('c1', written, prepared, () => {})
    post.startHeldPostPhoto()
    await vi.waitFor(() => expect(photoOf()?.failed).toBe(true))
    expect(photoOf()?.held).toBeUndefined()
    // The name and the scene stay, so it can be drawn again.
    expect(photoOf()).toMatchObject({ file: 'gwen_p1.png', scene: 'on the grass' })
  })

  it('lets the post out when the render does not answer in time, and fills it in if it lands later', async () => {
    vi.useFakeTimers()
    try {
      let finish: (() => void) | undefined
      const generate = vi.fn<GeneratePhoto>(
        () =>
          new Promise<Result<string>>((resolve) => {
            finish = () => resolve({ ok: true, data: 'done' })
          })
      )
      stubApi({
        jobs: { onProgress: () => () => {} },
        photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
        saves
      })
      const { post, photoOf } = await loaded()
      const { written, prepared } = heldPost()
      post.holdPostPhoto('c1', written, prepared, () => {})
      post.startHeldPostPhoto()
      await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1))

      await vi.advanceTimersByTimeAsync(post.RENDER_PATIENCE_MS - 1000)
      expect(photoOf()?.held).toBe(true)
      await vi.advanceTimersByTimeAsync(2000)
      expect(photoOf()?.failed).toBe(true)

      finish?.()
      await vi.waitFor(() => expect(photoOf()?.failed).toBeUndefined())
      expect(photoOf()).toEqual({ tier: 'everyday', scene: 'on the grass', file: 'gwen_p1.png' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('draws a failed picture again on a reroll, under the same name', async () => {
    let fail = true
    const generate = vi.fn<GeneratePhoto>(async () =>
      fail
        ? { ok: false, error: { code: 'COMFY_OFFLINE', message: 'down' } }
        : { ok: true, data: 'done' }
    )
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
      saves
    })
    const { post, photoOf } = await loaded()
    const { written, prepared } = heldPost()
    post.holdPostPhoto('c1', written, prepared, () => {})
    post.startHeldPostPhoto()
    await vi.waitFor(() => expect(photoOf()?.failed).toBe(true))

    fail = false
    post.rerollPostPhoto('c1', 'p1')
    // The frame waits while it draws.
    expect(photoOf()?.pending).toBe(true)
    await vi.waitFor(() => expect(photoOf()?.pending).toBeUndefined())
    expect(photoOf()).toEqual({ tier: 'everyday', scene: 'on the grass', file: 'gwen_p1.png' })
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[1]?.[4]).toBe('gwen_p1.png')
  })
})

describe('a picture on a text that does not come', () => {
  /** A thread with one text from her, carrying a picture in whatever state the test gives it. */
  async function thread(photo: Record<string, unknown>): Promise<{
    turn: typeof import('../src/renderer/stores/photoTurn')
    photoOf: () => Record<string, unknown> | undefined
  }> {
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const turn = await import('../src/renderer/stores/photoTurn')
    await photosSwitched(true)
    useGameStore.setState({
      playthroughId: '1',
      characters: { c1: { charId: 'c1', firstName: 'Gwen' } } as never,
      bunnyboard: {
        ...useGameStore.getState().bunnyboard,
        conversations: {
          c1: {
            charId: 'c1',
            unread: 0,
            summary: null,
            messages: [{ id: 'm1', sender: 'contact', text: 'look', photo }]
          }
        }
      } as never
    })
    const photoOf = (): Record<string, unknown> | undefined =>
      useGameStore.getState().bunnyboard.conversations.c1?.messages[0]?.photo as unknown as
        | Record<string, unknown>
        | undefined
    return { turn, photoOf }
  }

  const failed = {
    tier: 'everyday',
    scene: 'on the grass',
    file: 'gwen_chat_001.png',
    failed: true
  }

  it('draws it again on a reroll, under the same name, and fills the bubble in', async () => {
    const generate = vi.fn<GeneratePhoto>(async () => ({ ok: true, data: 'done' }))
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
      saves
    })
    const { turn, photoOf } = await thread(failed)
    turn.rerollMessagePhoto('c1', 'm1')
    // The bubble waits while it draws.
    expect(photoOf()?.pending).toBe(true)
    await vi.waitFor(() => expect(photoOf()?.pending).toBeUndefined())
    expect(photoOf()).toEqual({
      tier: 'everyday',
      scene: 'on the grass',
      file: 'gwen_chat_001.png'
    })
    expect(generate.mock.calls[0]?.[4]).toBe('gwen_chat_001.png')
  })

  it('says so again when the reroll fails too', async () => {
    const generate = vi.fn<GeneratePhoto>(async () => ({
      ok: false,
      error: { code: 'COMFY_OFFLINE', message: 'down' }
    }))
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
      saves
    })
    const { turn, photoOf } = await thread(failed)
    turn.rerollMessagePhoto('c1', 'm1')
    await vi.waitFor(() => expect(photoOf()?.failed).toBe(true))
    expect(photoOf()?.pending).toBeUndefined()
  })

  it('gives up waiting in time, and fills the bubble in if the picture lands later', async () => {
    vi.useFakeTimers()
    try {
      let finish: (() => void) | undefined
      const generate = vi.fn<GeneratePhoto>(
        () =>
          new Promise<Result<string>>((resolve) => {
            finish = () => resolve({ ok: true, data: 'done' })
          })
      )
      stubApi({
        jobs: { onProgress: () => () => {} },
        photo: { reserveName: vi.fn<ReserveName>(), generate, landed: notLanded },
        saves
      })
      const { turn, photoOf } = await thread(failed)
      const { RENDER_PATIENCE_MS } = await import('../src/renderer/stores/photoPost')
      turn.rerollMessagePhoto('c1', 'm1')
      await vi.advanceTimersByTimeAsync(RENDER_PATIENCE_MS - 1000)
      expect(photoOf()?.pending).toBe(true)
      await vi.advanceTimersByTimeAsync(2000)
      expect(photoOf()?.failed).toBe(true)

      finish?.()
      await vi.waitFor(() => expect(photoOf()?.failed).toBeUndefined())
      expect(photoOf()).toEqual({
        tier: 'everyday',
        scene: 'on the grass',
        file: 'gwen_chat_001.png'
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("BunnyBot's photo tip", () => {
  it('comes with her first picture, and never again', async () => {
    const api = pendingRender()
    stubApi({
      jobs: { onProgress: () => () => {} },
      photo: {
        reserveName: vi.fn<ReserveName>(async () => ({ ok: true, data: 'gwen_chat_001.png' })),
        generate: api.generate,
        landed: notLanded
      },
      saves
    })
    const { useGameStore } = await import('../src/renderer/stores/gameStore')
    const { sendPhoto } = await import('../src/renderer/stores/photoTurn')
    const { BUNNYBOT_CHAT_ID } = await import('../src/renderer/prompts/bunnybot')
    await photosSwitched(true)
    const gwen = { charId: 'c1', firstName: 'Gwen' } as never
    useGameStore.setState({
      playthroughId: '1',
      characters: { c1: gwen },
      charInfo: { c1: { flags: { gaveContactInfo: true }, memories: [] } } as never,
      bunnyboard: {
        ...useGameStore.getState().bunnyboard,
        conversations: {
          c1: {
            charId: 'c1',
            unread: 0,
            summary: null,
            messages: [{ id: 'm1', sender: 'contact', text: 'look' }]
          }
        }
      } as never
    })
    const tips = (): number =>
      useGameStore.getState().bunnyboard.conversations[BUNNYBOT_CHAT_ID]?.messages.length ?? 0

    await sendPhoto('c1', gwen, { sendPhoto: true, photoPrompt: 'me at the library' } as never)
    const told = tips()
    expect(told).toBeGreaterThan(0)
    expect(
      useGameStore
        .getState()
        .bunnyboard.conversations[BUNNYBOT_CHAT_ID]?.messages.some((m) => m.text.includes('gwen'))
    ).toBe(true)

    // A second text from her, and a second picture: nothing more from BunnyBot.
    const chat = useGameStore.getState().bunnyboard.conversations.c1!
    useGameStore.setState({
      bunnyboard: {
        ...useGameStore.getState().bunnyboard,
        conversations: {
          ...useGameStore.getState().bunnyboard.conversations,
          c1: {
            ...chat,
            messages: [...chat.messages, { id: 'm2', sender: 'contact', text: 'again' } as never]
          }
        }
      }
    })
    await sendPhoto('c1', gwen, { sendPhoto: true, photoPrompt: 'me at the cafe' } as never)
    expect(tips()).toBe(told)
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
