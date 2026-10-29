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

describe('when a post came out', () => {
  it("is the first answer from a mod that is on, and the slot's start where none answers", async () => {
    const on = { held: true, late: true }
    const hooks = await fresh(on, ['held', 'late'])
    hooks.registerHooks('late', { postOutAt: () => 20 })
    hooks.registerHooks('held', { postOutAt: (one) => (one.id === 'p1' ? 10 : undefined) })

    expect(hooks.postOutAt(post)).toBe(10)
    expect(hooks.postOutAt({ ...post, id: 'p2' })).toBe(20)

    on.held = on.late = false
    expect(hooks.postOutAt(post)).toBe(0)
  })
})

describe("the slot's closing report", () => {
  it("takes each line from the mods that are on, in list order, handed the next slot", async () => {
    const on = { first: true, second: true, off: false }
    const hooks = await fresh(on, ['first', 'second', 'off'])
    const line = (text: string) => ({ speaker: null, text }) as never
    hooks.registerHooks('second', { slotStatusLines: ({ nextSlot }) => [line(`second ${nextSlot}`)] })
    hooks.registerHooks('off', { slotStatusLines: () => [line('off')] })
    hooks.registerHooks('first', { slotStatusLines: () => [line('first')] })

    const texts = hooks.slotStatusLines({ nextSlot: 7 }).map((one: { text: string }) => one.text)
    expect(texts).toEqual(['first', 'second 7'])
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

describe('fields in the character editor', () => {
  const Field = () => null
  const field = (tag: string) => ({ read: () => tag, write: () => ({}), Field })

  it('come from the mods that are on, in list order, under each mod', async () => {
    const hooks = await fresh({ off: false }, ['body', 'notes', 'off'])
    hooks.registerHooks('notes', { editorField: field('notes') })
    hooks.registerHooks('off', { editorField: field('off') })
    hooks.registerHooks('body', { editorField: field('body') })

    expect(hooks.editorFields().map(({ modId }: { modId: string }) => modId)).toEqual(['body', 'notes'])
  })

  it("put each field's write on her, and every mod's slice in her ex beside the others'", async () => {
    const hooks = await fresh({}, ['body', 'notes'])
    const slice = (data: unknown) => ({ v: '1.0.0', data })
    hooks.registerHooks('body', { editorField: { ...field('body'), write: (value: unknown) => ({ ex: { body: slice(value) } }) } })
    hooks.registerHooks('notes', {
      editorField: { ...field('notes'), write: (value: unknown) => ({ backstory: String(value), ex: { notes: slice(value) } }) }
    })
    const her = { ex: { body: slice('old'), other: slice('kept') } } as unknown as Parameters<typeof hooks.editorWrites>[0]
    expect(hooks.editorWrites(her, (modId: string) => `${modId}!`)).toEqual({
      backstory: 'notes!',
      ex: { body: slice('body!'), other: slice('kept'), notes: slice('notes!') }
    })
    // Where no field carries `ex`, hers is left alone, not copied.
    const plain = await fresh({}, ['plain'])
    plain.registerHooks('plain', { editorField: field('plain') })
    expect(plain.editorWrites(her, () => null)).not.toHaveProperty('ex')
  })

  it("keep every mod's slice when a draft is written onto her, the ones she has included", async () => {
    const hooks = await fresh({}, ['body', 'notes'])
    const slice = (data: unknown) => ({ v: '1.0.0', data })
    hooks.registerHooks('body', { characterFromDraft: () => ({ ex: { body: slice('drawn') } }) })
    hooks.registerHooks('notes', { characterFromDraft: () => ({ backstory: 'written', ex: { notes: slice('noted') } }) })
    const her = { ex: { other: slice('kept') } }
    expect(hooks.characterFromDraft({}, { baseAppearance: [] }, her)).toEqual({
      backstory: 'written',
      ex: { body: slice('drawn'), other: slice('kept'), notes: slice('noted') }
    })
  })
})

describe('updates tabs and option previews', () => {
  const Page = () => null
  const Preview = () => null

  it('lists one page per id from the mods on, and offers a preview whether its mod is on or off', async () => {
    const on = { notes: true, copy: true, faces: false }
    const hooks = await fresh(on, ['notes', 'copy', 'faces'])
    hooks.registerHooks('copy', { updatesTab: { id: 'notes', word: 'Copy', Page } })
    hooks.registerHooks('notes', { updatesTab: { id: 'notes', word: 'Notes', Page } })
    hooks.registerHooks('faces', { optionPreviews: { style: Preview } })

    expect(hooks.updatesTabs().map((tab: { word: string }) => tab.word)).toEqual(['Notes'])
    expect(hooks.optionPreview('faces', 'style')).toBe(Preview)
    expect(hooks.optionPreview('faces', 'other')).toBeUndefined()

    on.notes = false
    expect(hooks.updatesTabs().map((tab: { word: string }) => tab.word)).toEqual(['Copy'])
  })
})

describe('tabs on her contact page', () => {
  const Panel = () => null

  it('come one per id from the mods that are on, in list order, where each says it stands', async () => {
    const on = { gallery: true, notes: true, copy: true, hidden: true, off: false }
    const hooks = await fresh(on, ['gallery', 'notes', 'copy', 'hidden', 'off'])
    hooks.registerHooks('copy', { contactTab: { id: 'gallery', label: 'Copy', Panel } })
    hooks.registerHooks('notes', { contactTab: { id: 'notes', label: 'Notes', Panel, shown: ({ isContact }) => isContact } })
    hooks.registerHooks('gallery', { contactTab: { id: 'gallery', label: 'Gallery', Panel } })
    hooks.registerHooks('hidden', { contactTab: { id: 'profile', label: 'Mine', Panel } })
    hooks.registerHooks('off', { contactTab: { id: 'off', label: 'Off', Panel } })

    const labels = (isContact: boolean) =>
      hooks.contactTabs({ charId: 'c1', isContact }).map(({ tab }: { tab: { label: string } }) => tab.label)
    // Profile is the page's own, and a tab whose mod says it does not stand for her is left out.
    expect(labels(true)).toEqual(['Gallery', 'Notes'])
    expect(labels(false)).toEqual(['Gallery'])
  })
})

describe("a mod's panels by id", () => {
  const Mine = () => null
  const Copy = () => null

  it('open only while a game view is up, and only where a mod that is on has the id', async () => {
    const on = { mine: true, copy: true }
    const hooks = await fresh(on, ['mine', 'copy'])
    hooks.registerHooks('copy', { gameModals: { notes: Copy } })
    hooks.registerHooks('mine', { gameModals: { notes: Mine } })
    const opened = vi.fn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(hooks.openPanel('notes')).toBe(false)
    const unbind = hooks.setPanelOpener(opened)
    expect(hooks.gameModal('notes')).toBe(Mine)
    // Two mods on with the same id: the first wins, and the clash is said once, naming both.
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toMatch(/mine and copy .*"notes"/)
    expect(hooks.openPanel('notes', 'c1')).toBe(true)
    expect(opened).toHaveBeenLastCalledWith('notes', 'c1')
    expect(hooks.openPanel('other')).toBe(false)

    on.mine = false
    expect(hooks.gameModal('notes')).toBe(Copy)
    on.copy = false
    expect(hooks.openPanel('notes')).toBe(false)

    // A view that has gone does not unbind the one that came up after it.
    const next = vi.fn()
    hooks.setPanelOpener(next)
    unbind()
    on.mine = true
    expect(hooks.openPanel('notes')).toBe(true)
    expect(next).toHaveBeenCalledOnce()
    expect(opened).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
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

describe('emoji tool and sent text', () => {
  const Tool = () => null
  const Other = () => null
  const Text = () => null

  it('are drawn by the first mod on that draws them, and by none once it is off', async () => {
    const on = { picker: true, plain: true }
    const hooks = await fresh(on, ['picker', 'plain'])
    hooks.registerHooks('plain', { emojiTool: Other })
    hooks.registerHooks('picker', { emojiTool: Tool, sentText: { Text } })

    expect(hooks.emojiTool()).toBe(Tool)
    expect(hooks.sentText()?.Text).toBe(Text)

    on.picker = false
    expect(hooks.emojiTool()).toBe(Other)
    expect(hooks.sentText()).toBeNull()
  })
})

describe('slot activity offers', () => {
  it('accepts only enabled owners, the requested stat, and currently available offers', async () => {
    const hooks = await fresh({ disabled: false }, ['pack', 'disabled'])
    const offer = { owner: 'pack', id: 'memory', label: 'Memory', location: 'cutetea', stat: 'brain' as const }
    hooks.registerHooks('pack', {
      statActivities: () => [offer, { ...offer, owner: 'someone-else' }, { ...offer, stat: 'body' }],
      slotActivityAvailable: o => o.id === 'memory'
    })
    hooks.registerHooks('disabled', { statActivities: () => [{ ...offer, owner: 'disabled' }], slotActivityAvailable: () => true })
    expect(hooks.statActivities('brain')).toEqual([offer])
    expect(hooks.slotActivityAvailable({ ...offer, id: 'removed' })).toBe(false)
    expect(hooks.slotActivityAvailable({ ...offer, owner: 'disabled' })).toBe(false)
  })
})

describe('scene stat settlement', () => {
  const zero = { brain: 0, body: 0, heart: 0 }
  const settlement = { ledger: { brain: true }, ctx: { solo: true, classScene: false, classOutcome: null, jobOutcome: null } }
  it("hands each mod that is on what the hour exercised as the one before left it, and the ledger's own where none answers", async () => {
    const hooks = await fresh({ off: false }, ['first', 'second', 'off'])
    // A training session replaces the exercise; a later mod reads it as the ledger.
    hooks.registerHooks('first', { exercisedStats: (ledger, ctx) => (ctx.solo ? { body: true } : ledger) })
    hooks.registerHooks('second', { exercisedStats: (ledger) => ({ ...ledger, heart: ledger?.body === true }) })
    hooks.registerHooks('off', { exercisedStats: () => ({ brain: true, body: true, heart: true }) })
    expect(hooks.exercisedStats({ brain: true }, settlement.ctx)).toEqual({ body: true, heart: true })
    expect(hooks.exercisedStats(undefined, { ...settlement.ctx, solo: false })).toEqual({ heart: false })
    hooks.setHookRules({ isOn: () => false, order: () => 0 })
    expect(hooks.exercisedStats({ brain: true }, settlement.ctx)).toEqual({ brain: true })
    expect(hooks.exercisedStats(undefined, settlement.ctx)).toBeUndefined()
  })
  it('hands each mod that is on what the one before it left, in list order', async () => {
    const hooks = await fresh({ off: false }, ['first', 'second', 'off'])
    hooks.registerHooks('second', { settleSceneStats: (resolved) => ({ ...resolved, deltas: { ...resolved.deltas, body: resolved.deltas.brain * 10 } }) })
    hooks.registerHooks('first', { settleSceneStats: (resolved, s) => ({ ...resolved, deltas: { ...resolved.deltas, brain: s.ledger?.brain ? 1 : 0 } }) })
    hooks.registerHooks('off', { settleSceneStats: () => ({ deltas: { brain: 9, body: 9, heart: 9 }, lines: [] }) })
    const resolved = { deltas: zero, lines: [] }
    expect(hooks.settleSceneStats(resolved, settlement).deltas).toEqual({ brain: 1, body: 10, heart: 0 })
    expect(resolved.deltas).toEqual(zero)
  })
  it("takes the first floor a mod that is on gives, and the game's own where none does", async () => {
    const hooks = await fresh({ off: false }, ['first', 'second', 'off'])
    hooks.registerHooks('off', { statFloor: () => -100 })
    hooks.registerHooks('second', { statFloor: () => -20 })
    hooks.registerHooks('first', { statFloor: (key) => (key === 'heart' ? -5 : undefined) })
    expect(hooks.statFloor('heart')).toBe(-5)
    expect(hooks.statFloor('brain')).toBe(-20)
    hooks.setHookRules({ isOn: () => false, order: () => 0 })
    expect(hooks.statFloor('brain')).toBeUndefined()
  })
})
