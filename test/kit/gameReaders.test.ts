import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { character as girl, charInfo, restoreApi, stubApi } from '../fixtures'

// Exercise the hook's external-store contract without a DOM or a renderer test harness.
const hook = vi.hoisted(() => ({ current: null as null | {
  subscribe: (onChange: () => void) => () => void; read: () => unknown
} }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useCallback: <T,>(fn: T): T => fn,
  useSyncExternalStore: (subscribe: (fn: () => void) => () => void, read: () => unknown) => {
    hook.current = { subscribe, read }
    return read()
  }
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const readers = await import('../../src/renderer/mods/gameReaders')
const { useGameStore: game } = await import('../../src/renderer/stores/gameStore')
const { useCharacterStore: images, profileUrl } = await import('../../src/renderer/stores/characterStore')
const { sceneActiveOf } = await import('../../src/renderer/stores/textingLoop')
const { reader: nativeReader } = await import('../../src/renderer/stores/loop/promptState')
const state = () => game.getState()
function marker(value: number) {
  game.setState({ bunnyboard: { ...state().bunnyboard, feedReadThrough: value } as never })
}
beforeEach(() => {
  stubApi({ platform: 'desktop', jobs: { onProgress: () => () => {} } })
  game.getState().reset()
  images.setState({ spriteVersion: {} })
  game.setState({ playthroughId: '1', chars: ['a', 'b'], alumni: ['c', 'a'],
    characters: { a: girl({ charId: 'a' }), b: girl({ charId: 'b' }) },
    charInfo: { a: charInfo({ feed: [{ id: 'p', text: 'Post', date: 0, time: 0, likes: 1,
      comments: [{ id: 'c', text: 'Comment', handle: 'h', emoji: '', at: 0 }] }] }), b: charInfo() },
    npcRelationships: { 'a:b': { affinity: 4 } } as never,
    profilePicture: 'data:first'
  })
  game.setState({ bunnyboard: { ...state().bunnyboard, conversations: {
    a: { messages: [{ id: 'm', text: 'Hi', sender: 'contact', date: 0, time: 0 }] },
    b: { messages: [] }
  } } as never })
  marker(2)
  hook.current = null
})
afterEach(() => { restoreApi(); vi.restoreAllMocks() })

const cases = [
  { name: 'character', read: () => readers.character('a'), native: () => state().characters.a,
    subscribe: (fn: () => void) => readers.subscribeCharacter('a', fn),
    change: () => game.setState({ characters: { ...state().characters,
      a: { ...state().characters.a, firstName: 'Lia' } } }) },
  { name: 'character info', read: () => readers.characterInfo('a'), native: () => state().charInfo.a,
    subscribe: (fn: () => void) => readers.subscribeCharacterInfo('a', fn),
    change: () => game.setState({ charInfo: { ...state().charInfo,
      a: { ...state().charInfo.a, nameKnown: true } } }) },
  { name: 'roster', read: () => readers.rosterIds({ alumni: true }),
    native: () => [...new Set([...state().chars, ...state().alumni])],
    subscribe: (fn: () => void) => readers.subscribeRosterIds(fn, { alumni: true }),
    change: () => game.setState({ alumni: [...state().alumni, 'd'] }) },
  { name: 'conversation', read: () => readers.conversation('a'),
    native: () => state().bunnyboard.conversations.a,
    subscribe: (fn: () => void) => readers.subscribeConversation('a', fn),
    change: () => game.setState({ bunnyboard: { ...state().bunnyboard, conversations: {
      ...state().bunnyboard.conversations, a: { ...state().bunnyboard.conversations.a, unread: 1 }
    } } }) },
  { name: 'feed', read: () => readers.feed('a'), native: () => state().charInfo.a.feed,
    subscribe: (fn: () => void) => readers.subscribeFeed('a', fn),
    change: () => game.setState({ charInfo: { ...state().charInfo, a: { ...state().charInfo.a,
      feed: state().charInfo.a.feed!.map(post => ({ ...post, likes: post.likes + 1 })) } } }) },
  { name: 'relationships', read: readers.npcRelationships, native: () => state().npcRelationships,
    subscribe: readers.subscribeNpcRelationships,
    change: () => game.setState({ npcRelationships: { 'a:b': { affinity: 5 } } as never }) },
  { name: 'clock', read: readers.clock,
    native: () => ({ date: state().date, time: state().time, season: state().calendar.season }),
    subscribe: readers.subscribeClock, change: () => game.setState({ date: state().date + 1 }) },
  { name: 'stats', read: readers.playerStats, native: () => state().stats,
    subscribe: readers.subscribePlayerStats,
    change: () => game.setState({ stats: { ...state().stats, heart: state().stats.heart + 1 } }) },
  { name: 'picture', read: readers.playerProfilePicture, native: () => state().profilePicture,
    subscribe: readers.subscribePlayerProfilePicture,
    change: () => game.setState({ profilePicture: 'data:second' }) },
  { name: 'legacy marker', read: readers.feedReadThrough, native: () => 2,
    subscribe: readers.subscribeFeedReadThrough, change: () => marker(3) },
  { name: 'scene ownership', read: readers.sceneActive, native: () => sceneActiveOf(state()),
    subscribe: readers.subscribeSceneActive, change: () => game.setState({ busy: true }) },
  { name: 'reader block', read: readers.readerPromptText, native: () => nativeReader(),
    subscribe: readers.subscribeReaderPromptText,
    change: () => game.setState({ bio: 'plays chess and likes coffee' }) }
]
it.each(cases)('$name reads current native data and notifies only for its own changes', ({
  read, native, subscribe, change
}) => {
  expect(read()).toEqual(native())
  const before = read()
  expect(read()).toBe(before)
  const notify = vi.fn()
  const stop = subscribe(notify)
  game.setState({ money: state().money + 1 })
  expect(notify).not.toHaveBeenCalled()
  expect(read()).toBe(before)
  change()
  expect(notify).toHaveBeenCalledOnce()
  expect(read()).not.toEqual(before)
  stop()
  game.setState({ playthroughId: null })
  expect(notify).toHaveBeenCalledTimes(1)
})

it('records and their nested arrays are detached and frozen without freezing native game data', () => {
  const character = readers.character('a')!
  const info = readers.characterInfo('a')!
  const chat = readers.conversation('a')!
  const posts = readers.feed('a')
  const pairs = readers.npcRelationships()!
  const stats = readers.playerStats()!
  const time = readers.clock()!
  expect(() => { character.baseAppearance.push('changed') }).toThrow()
  expect(() => { info.flags.blocked = true }).toThrow()
  expect(() => { chat.messages[0].text = 'changed' }).toThrow()
  expect(() => { posts[0].comments![0].text = 'changed' }).toThrow()
  expect(() => { pairs['a:b'].affinity = -5 }).toThrow()
  expect(() => { (stats as { heart: number }).heart = 9 }).toThrow()
  expect(() => { (time as { date: number }).date = 999 }).toThrow()
  expect(() => { (readers.rosterIds() as string[]).push('changed') }).toThrow()
  expect(readers.character('a')).toEqual(state().characters.a)
  expect(readers.characterInfo('a')).toEqual(state().charInfo.a)
  expect(readers.conversation('a')).toEqual(state().bunnyboard.conversations.a)
  expect(readers.feed('a')).toEqual(state().charInfo.a.feed)
  expect(readers.npcRelationships()).toEqual(state().npcRelationships)
  expect(readers.playerStats()).toEqual(state().stats)
  expect(Object.isFrozen(state().characters.a)).toBe(false)
  expect(Object.isFrozen(state().charInfo.a.flags)).toBe(false)
})

it('fences every reader before a playthrough loads, even if other stores still hold data', () => {
  game.setState({ busy: true, playthroughId: null })
  expect(readers.character('a')).toBeUndefined()
  expect(readers.characterInfo('a')).toBeUndefined()
  expect(readers.rosterIds()).toEqual([])
  expect(readers.rosterIds({ alumni: true })).toEqual([])
  expect(readers.conversation('a')).toBeUndefined()
  expect(readers.feed('a')).toEqual([])
  expect(readers.npcRelationships()).toBeUndefined()
  expect(readers.clock()).toBeUndefined()
  expect(readers.playerStats()).toBeUndefined()
  expect(readers.playerProfilePicture()).toBeNull()
  expect(readers.feedReadThrough()).toBeUndefined()
  expect(readers.readerPromptText()).toBeUndefined()
  expect(readers.sceneActive()).toBe(false)
  expect(readers.useProfileImageUrl('a')).toBeUndefined()
})

it('filters each selected record and roster option independently', () => {
  const events = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()]
  const stops = [readers.subscribeCharacter('a', events[0]),
    readers.subscribeCharacterInfo('a', events[1]), readers.subscribeConversation('a', events[2]),
    readers.subscribeFeed('a', events[3]), readers.subscribeRosterIds(events[4])]
  game.setState({ characters: { ...state().characters, b: girl({ charId: 'b', firstName: 'Other' }) },
    charInfo: { ...state().charInfo, b: charInfo({ nameKnown: true }) }, alumni: ['changed'] })
  game.setState({ bunnyboard: { ...state().bunnyboard, conversations: {
    ...state().bunnyboard.conversations, b: { ...state().bunnyboard.conversations.b, unread: 1 }
  } } })
  for (const event of events) expect(event).not.toHaveBeenCalled()
  for (const stop of stops) stop()
  expect(readers.character('missing')).toBeUndefined()
  expect(readers.characterInfo('missing')).toBeUndefined()
  expect(readers.conversation('missing')).toBeUndefined()
  expect(readers.feed('missing')).toEqual([])
})

it('filters composite clock and scene projections when their outputs stay the same', () => {
  const time = readers.clock()
  const clockChanged = vi.fn(), sceneChanged = vi.fn()
  const stopClock = readers.subscribeClock(clockChanged)
  const stopScene = readers.subscribeSceneActive(sceneChanged)
  game.setState({ calendar: { ...state().calendar }, currentSceneTranscript: [] })
  expect(readers.clock()).toBe(time)
  expect(clockChanged).not.toHaveBeenCalled()
  expect(sceneChanged).not.toHaveBeenCalled()
  game.setState({ currentSceneTranscript: [{ text: 'A scene', speaker: 'NARRATOR' }] as never })
  expect(readers.sceneActive()).toBe(sceneActiveOf(state()))
  expect(sceneChanged).toHaveBeenCalledOnce()
  game.setState({ sceneSummary: 'Summary' })
  expect(sceneChanged).toHaveBeenCalledOnce()
  game.setState({ time: 1, calendar: { ...state().calendar, season: 'fall' } })
  expect(clockChanged).toHaveBeenCalledOnce()
  expect(readers.clock()).toEqual({ date: state().date, time: 1, season: 'fall' })
  stopClock(); stopScene()
})

it('profile image hooks follow only the selected native image version and game availability', () => {
  expect(readers.useProfileImageUrl('a')).toBe(profileUrl('a', 0))
  const { read, subscribe } = hook.current!
  const changed = vi.fn(), stop = subscribe(changed)
  images.setState({ spriteVersion: { b: 1 } })
  game.setState({ money: state().money + 1 })
  expect(changed).not.toHaveBeenCalled()
  images.setState({ spriteVersion: { a: 2, b: 1 } })
  expect(changed).toHaveBeenCalledOnce()
  expect(read()).toBe(profileUrl('a', 2))
  expect(readers.profileImageUrl('a')).toBe(profileUrl('a', 2))
  const plain = vi.fn(), stopPlain = readers.subscribeProfileImageUrl('a', plain)
  images.setState({ spriteVersion: { a: 3, b: 1 } })
  expect(plain).toHaveBeenCalledOnce()
  stopPlain()
  // The hook's own subscription also heard that version change.
  expect(changed).toHaveBeenCalledTimes(2)
  game.setState({ playthroughId: null })
  expect(read()).toBeUndefined()
  expect(changed).toHaveBeenCalledTimes(3)
  stop()
  game.setState({ playthroughId: '1' })
  expect(changed).toHaveBeenCalledTimes(3)
})

it('every component hook uses the corresponding stable snapshot and filtered subscription', () => {
  const hooks = [() => readers.useCharacter('a'), () => readers.useCharacterInfo('a'),
    () => readers.useRosterIds({ alumni: true }), () => readers.useConversation('a'),
    () => readers.useFeed('a'), readers.useNpcRelationships, readers.useClock,
    readers.usePlayerStats, readers.usePlayerProfilePicture, readers.useFeedReadThrough,
    readers.useSceneActive, readers.useReaderPromptText]
  for (const use of hooks) {
    const value = use()
    expect(hook.current!.read()).toBe(value)
    const changed = vi.fn(), stop = hook.current!.subscribe(changed)
    game.setState({ money: state().money + 1 })
    expect(changed).not.toHaveBeenCalled()
    stop()
  }
})

it('answers nothing for an id that is only an inherited key', () => {
  for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    expect(readers.character(id)).toBeUndefined()
    expect(readers.characterInfo(id)).toBeUndefined()
    expect(readers.conversation(id)).toBeUndefined()
    expect(readers.feed(id)).toEqual([])
    expect(readers.profileImageUrl(id)).toBeUndefined()
  }
})
