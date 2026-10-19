import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocialPost } from '@shared/types'

/** The game's hooks: asked in list order, and never for a mod that is off. */

type Hooks = typeof import('../src/renderer/mods/hooks')

async function fresh(on: Record<string, boolean>, order: string[]): Promise<Hooks> {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: (id) => on[id] ?? true, order: (id) => order.indexOf(id) })
  return hooks
}

const post: SocialPost = { id: 'p1', text: 'hi', date: 1, time: 0, likes: 3 }

describe('mod hooks', () => {
  let hooks: Hooks
  beforeEach(async () => {
    hooks = await fresh({ off: false }, ['first', 'second', 'off'])
    // Registered out of order, to show the list decides.
    hooks.registerHooks('second', {
      prompts: { dm: { lines: () => ['second'], fields: () => ({ b: 2 }), required: () => ['b'] } },
      postVisible: () => true
    })
    hooks.registerHooks('first', {
      prompts: { dm: { lines: () => ['first'], fields: () => ({ a: 1 }), required: () => ['a'] } },
      postLikes: (ask) => (ask.kind === 'stranger' ? 99 : undefined)
    })
    hooks.registerHooks('off', {
      prompts: { dm: { lines: () => ['off'] } },
      postVisible: () => false,
      postLikes: () => 1
    })
  })

  it('asks the mods that are on, in the order the list names them', () => {
    const ctx = {} as import('../src/renderer/mods/hooks').PromptSpots['dm']
    expect(hooks.promptLines('dm', ctx)).toEqual(['first', 'second'])
    expect(hooks.promptFields('dm')).toEqual({ a: 1, b: 2 })
    expect(hooks.promptRequired('dm')).toEqual(['a', 'b'])
  })

  it('leaves a post visible unless a mod that is on holds it back', () => {
    expect(hooks.postVisible(post)).toBe(true)
  })

  it("takes the first mod's likes, and the game's own when none answers", () => {
    const own = (): number => 7
    expect(hooks.postLikes({ kind: 'stranger', author: 'x', friends: 0 }, own)).toBe(99)
    expect(hooks.postLikes({ kind: 'ending', author: 'x', friends: 0 }, own)).toBe(7)
  })

  it('stops handing a post on once a mod has taken it to file itself', async () => {
    const after = vi.fn()
    hooks.registerHooks('first', {
      fileFeedPost: (filing) => {
        filing.held = true
      }
    })
    hooks.registerHooks('second', { fileFeedPost: after })
    const filed = await hooks.fileFeedPost(
      { charId: 'c1', post, reply: {}, held: false, featured: false },
      { nudge: () => {} }
    )
    expect(filed.held).toBe(true)
    expect(after).not.toHaveBeenCalled()
  })
})

describe('ways on', () => {
  it('offers the first answer from a mod that is on, and none from a mod that is off', async () => {
    const hooks = await fresh({ off: false }, ['off', 'quiet', 'semesters', 'later'])
    const prepare = async (): Promise<null> => null
    hooks.registerHooks('later', { endingChoice: () => ({ label: 'later', prepare }) })
    hooks.registerHooks('semesters', {
      endingChoice: (ctx) =>
        ctx.reason === 'gameComplete' ? { label: 'next semester', prepare } : undefined
    })
    hooks.registerHooks('quiet', { endingChoice: () => undefined })
    hooks.registerHooks('off', { endingChoice: () => ({ label: 'off', prepare }) })

    expect(hooks.endingChoice({ reason: 'gameComplete', playthroughId: 'p' })?.label).toBe(
      'next semester'
    )
    expect(hooks.endingChoice({ reason: 'expulsion', playthroughId: 'p' })?.label).toBe('later')
  })

  it('offers nothing for a save where no mod answers', async () => {
    const hooks = await fresh({}, ['a'])
    hooks.registerHooks('a', { saveChoice: () => undefined })
    const save = {} as Parameters<typeof hooks.saveChoice>[0]['save']
    expect(hooks.saveChoice({ playthroughId: 'p', save })).toBeUndefined()
  })
})


describe('preparing a way on', () => {
  /** A prepare the test answers by hand, so the screen can be closed while it waits. */
  function deferred(): {
    choice: { prepare: () => Promise<(() => 'mainMenu') | null> }
    answer: (enter: (() => 'mainMenu') | null) => void
  } {
    let answer!: (enter: (() => 'mainMenu') | null) => void
    const pending = new Promise<(() => 'mainMenu') | null>((resolve) => (answer = resolve))
    return { choice: { prepare: () => pending }, answer }
  }

  it('hands back where to go when the mod is ready and the screen is still up', async () => {
    const hooks = await fresh({}, [])
    const { choice, answer } = deferred()
    const enter = vi.fn((): 'mainMenu' => 'mainMenu')
    const ready = hooks.prepareWayOn(choice, () => true)
    answer(enter)
    expect(await ready).toBe(enter)
    expect(enter).not.toHaveBeenCalled()
  })

  it('opens nothing when the screen closed before the mod was ready', async () => {
    const hooks = await fresh({}, [])
    const { choice, answer } = deferred()
    let open = true
    const enter = vi.fn((): 'mainMenu' => 'mainMenu')
    const ready = hooks.prepareWayOn(choice, () => open)
    open = false
    answer(enter)
    expect(await ready).toBeNull()
    expect(enter).not.toHaveBeenCalled()
  })

  it('opens nothing when the mod declines', async () => {
    const hooks = await fresh({}, [])
    const { choice, answer } = deferred()
    const ready = hooks.prepareWayOn(choice, () => true)
    answer(null)
    expect(await ready).toBeNull()
  })
})

describe('the scene hooks', () => {
  const Nothing = (): null => null

  it('offers the scene places of the mods that are on, in list order, under their ids', async () => {
    const hooks = await fresh({ off: false }, ['first', 'second', 'off'])
    const play = { Seat: Nothing, Panel: Nothing }
    hooks.registerHooks('second', { scenePlay: play })
    hooks.registerHooks('off', { scenePlay: play })
    hooks.registerHooks('first', { scenePlay: play })
    hooks.registerHooks('first', { playerActs: () => undefined })
    expect(hooks.scenePlays().map((entry) => entry.modId)).toEqual(['first', 'second'])
  })

  it('hands a landed scene reply to the mods that are on', async () => {
    const hooks = await fresh({ off: false }, ['first', 'off'])
    const seen = vi.fn()
    hooks.registerHooks('first', { afterSceneReply: (ctx) => seen(ctx.reply.extra) })
    hooks.registerHooks('off', { afterSceneReply: () => seen('off') })
    hooks.afterSceneReply({ reply: { lines: [], extra: 'kept' }, cast: [], solo: false, ending: false })
    expect(seen.mock.calls).toEqual([['kept']])
  })
})

describe('a mod that throws reading a scene reply', () => {
  it('costs the scene nothing, and the mods after it still read the reply', async () => {
    const hooks = await fresh({}, ['throws', 'reads'])
    const seen: string[] = []
    hooks.registerHooks('throws', {
      afterSceneReply: () => {
        throw new Error('broken mod')
      }
    })
    hooks.registerHooks('reads', { afterSceneReply: () => void seen.push('read') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      hooks.afterSceneReply({ reply: { lines: [] }, cast: [], solo: false, ending: false })
    ).not.toThrow()
    warn.mockRestore()
    expect(seen).toEqual(['read'])
  })
})

describe("a mod's own page on the Mods screen", () => {
  it('comes from the first mod that is on and has one for the mod picked', async () => {
    const hooks = await fresh({ off: false }, ['off', 'frame', 'other'])
    const Page = (): null => null
    const Unseen = (): null => null
    const mod = (id: string) => ({ id }) as import('../src/shared/mods').ModDef
    hooks.registerHooks('off', { modDetail: () => Unseen })
    hooks.registerHooks('frame', { modDetail: (picked) => (picked.id === 'pack' ? Page : undefined) })
    hooks.registerHooks('other', { modDetail: () => Unseen })
    expect(hooks.modDetail(mod('pack'))).toBe(Page)
    expect(hooks.modDetail(mod('else'))).toBe(Unseen)
  })

  it('is none where no mod has one', async () => {
    const hooks = await fresh({}, [])
    expect(hooks.modDetail({ id: 'pack' } as import('../src/shared/mods').ModDef)).toBeUndefined()
  })
})

describe('post comments', () => {
  const comment = (id: string, mine?: boolean) =>
    ({ id, handle: 'h', emoji: '', text: 'hi', at: 0, ...(mine ? { mine } : {}) }) as never
  const View = () => null

  it('are drawn by the first mod on that draws them, without what another mod claims', async () => {
    const on = { threads: true, plain: true }
    const hooks = await fresh(on, ['plain', 'threads'])
    hooks.registerHooks('threads', {
      postComments: { View, claims: (c) => (c as { mine?: boolean }).mine === true }
    })
    hooks.registerHooks('plain', { postComments: { View } })
    const all = [comment('a'), comment('b', true)]

    expect(hooks.postCommentsOwner()?.modId).toBe('plain')
    expect(hooks.ownsPostComments('threads')).toBe(false)
    // The other mod's comments stay out while it is not drawing them, on or off.
    expect(hooks.ownedComments(all, 'plain').map((c: { id: string }) => c.id)).toEqual(['a'])
    expect(hooks.ownedComments(all, 'threads')).toHaveLength(2)

    on.plain = false
    expect(hooks.postCommentsOwner()?.modId).toBe('threads')
  })
})
