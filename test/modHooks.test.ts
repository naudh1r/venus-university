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

