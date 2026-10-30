import './fixtures/maestroModelKit'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pairKeyOf } from '@shared/npcRelationships'
import { STOCK_POSITIONS } from '@shared/positions'
import { emptyFlags } from '@shared/relationship'
import { SCENE_EVENT_IDS } from '@shared/sceneEvents'
import type {
  BankedOpening,
  Character,
  CharMemory,
  GameSave,
  LedgerResponse,
  ModSceneFields,
  PlaythroughRecord,
  SaveDraft,
  SceneState
} from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { fileLatePost } from '../src/renderer/stores/loop/feed'
import { memoryEditRows, memoryEditsOf } from '../src/renderer/stores/loop/memoryEdit'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { failTurn } from '../src/renderer/stores/loop/turn'
import { carryOf } from '../src/renderer/stores/semesterCarry'
import { continuedStartOf } from '../src/renderer/stores/semesterStart'
import { semesterOf } from '@shared/semesters'
import {
  calendarEvent,
  character,
  charactersById,
  charJob,
  classEntry,
  enrollment,
  playthroughRecord,
  restoreApi,
  stubApi
} from './fixtures'

/**
 * A key core does not know — a mod's, or a later build's — rides through every copy core makes
 * of a save and of the records inside it, untouched. A copy that rebuilds a record from a fixed
 * list of fields drops it, and nothing throws: the mod finds its data gone on the next load. And
 * a save with nothing foreign on it is written exactly as before, byte for byte.
 */

let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

/** The stranger: nested, so a copy that keeps the key but not its depth fails too. */
const STRANGER = { deep: { n: 1, list: [1, 2] } }

type Path = readonly (string | number)[]

const PAIR = pairKeyOf('a', 'b')

/** Every record the stranger is planted on, as a path from the top of the save. */
const PLANTED: readonly Path[] = [
  [],
  ['charInfo', 'a'],
  ['charInfo', 'b'],
  ['charInfo', 'a', 'memories', 0],
  ['charInfo', 'a', 'memories', 1],
  ['charInfo', 'a', 'jealousyMemories', 0],
  ['charInfo', 'a', 'giftMemories', 0],
  ['charInfo', 'a', 'textMemory'],
  ['charInfo', 'a', 'feed', 0],
  ['charInfo', 'a', 'feed', 0, 'comments', 0],
  ['bunnyboard'],
  ['bunnyboard', 'conversations', 'a'],
  ['bunnyboard', 'conversations', 'a', 'messages', 0],
  ['classRecords', 'BIO 210'],
  ['classRecords', 'BIO 210', 'midtermProject', 'sessions', 0],
  ['inventory', 0],
  ['events', 0],
  ['job'],
  ['scene'],
  ['scene', 'mods'],
  ['scene', 'transcript', 0],
  ['scene', 'quiz'],
  // Not a mod record: the semester carry keeps `affinity` alone here on purpose, so only the
  // load/save round trip is held to it.
  ['npcRelationships', PAIR]
]

const SCENE_PATHS = PLANTED.filter((path) => path[0] === 'scene')
const SAVE_PATHS = PLANTED.filter((path) => path[0] !== 'scene')
/** What the semester carry hands on, at the same paths on the carry and the next save. */
const CARRIED_PATHS = PLANTED.filter(
  (path) => path[0] === 'charInfo' || path[0] === 'bunnyboard' || path[0] === 'inventory'
)

/** The value at `path`, or undefined where any step is missing. */
function at(value: unknown, path: Path): unknown {
  let here = value
  for (const step of path) {
    if (typeof here !== 'object' || here === null) return undefined
    here = (here as Record<string | number, unknown>)[step]
  }
  return here
}

/** `save` with a fresh copy of the stranger on every record `paths` names. */
function planted<T>(save: T, paths: readonly Path[]): T {
  const copy = structuredClone(save)
  for (const path of paths) {
    const record = at(copy, path)
    if (typeof record !== 'object' || record === null) {
      throw new Error(`fixture has no record at ${JSON.stringify(path)}`)
    }
    ;(record as Record<string, unknown>).zz = structuredClone(STRANGER)
  }
  return copy
}

/** `value` with the stranger taken off every record `paths` names, wherever it survived. */
function unplanted<T>(value: T, paths: readonly Path[]): T {
  const copy = structuredClone(value)
  for (const path of paths) {
    const record = at(copy, path)
    if (typeof record === 'object' && record !== null) delete (record as { zz?: unknown }).zz
  }
  return copy
}

/** Asserts the stranger is on every record `paths` names, listing every one it is missing from. */
function expectStrangers(value: unknown, paths: readonly Path[]): void {
  const lost = paths
    .filter((path) => JSON.stringify(at(value, [...path, 'zz'])) !== JSON.stringify(STRANGER))
    .map((path) => (path.length > 0 ? path.join('.') : '(top level)'))
  expect(lost).toEqual([])
}

const CHARACTERS: Record<string, Character> = charactersById(
  character({ charId: 'a' }),
  character({ charId: 'b', firstName: 'Ana', lastName: 'Lee' })
)

const PROFILES = {
  a: { year: 2, dorm: 'lowrise_1' as const, major: 'Biology', schedule: { 0: 'BIO 210' } },
  b: { year: 1, dorm: 'lowrise_2' as const, major: 'History', schedule: {} }
}

/** A record holding the save's semester, a fall, with both girls' settled halves. */
const RECORD: PlaythroughRecord = playthroughRecord({
  chars: ['a', 'b'],
  profiles: PROFILES,
  semesters: {
    '200': {
      index: 1,
      chars: ['a', 'b'],
      alumni: [],
      classes: { 'BIO 210': classEntry() },
      occasions: [],
      jobClosures: {},
      weather: [],
      profiles: PROFILES,
      before: { history: {}, playerSchedule: {}, events: [] }
    }
  }
})

const memory = (date: number, desc: string): CharMemory => ({ date, type: 'liked', desc })

/** A scene with every optional field `captureScene` writes back. */
const SCENE: SceneState = {
  activity: { owner: 'mod', id: 'drill', label: 'Drill', location: 'gym', stat: 'body', status: 'pending' },
  mods: { fixtureMod: { n: 1 } } as ModSceneFields,
  cast: ['a'],
  transcript: [{ speaker: 'sarah_rose', text: 'Hi.' }],
  summary: 'They met.',
  summaries: [{ at: 1, summary: 'They met.' }],
  bg: 'quad',
  slots: ['a', null, null],
  emotions: { a: 'happy' },
  flipped: { a: true },
  departed: ['b'],
  offStage: { b: 2 },
  stageOverride: { a: true },
  bgOverride: 'quad',
  outfitLock: { a: 'default' },
  cgLock: { charId: 'a', position: STOCK_POSITIONS[0] },
  sceneLog: [{ speaker: 'sarah_rose', text: 'Hi.' }],
  classCode: 'BIO 210',
  projectClass: 'BIO 210',
  jobId: 'cutetea',
  jobStats: ['body'],
  farewell: 'b',
  textLedgerSkip: 'b',
  textLedger: { key: 'k', reply: {} as LedgerResponse },
  ignoredInvites: ['b'],
  turnedDownInvites: ['b'],
  visitJobId: 'cutetea',
  mentions: ['b'],
  location: 'the quad',
  inPublic: false,
  gifts: [{ charId: 'a', itemId: 'rose', repeat: false, reaction: 'liked', at: 0 }],
  secret: 'She sings.',
  event: { id: SCENE_EVENT_IDS[0], charId: 'a' },
  receivedGift: { itemId: 'rose', charId: 'a' },
  quiz: {
    code: 'BIO 210',
    exam: 'midterm',
    questions: [{ question: 'Q?', a: '1', b: '2', c: '3', d: '4', correct: 'A' }],
    index: 0,
    correct: 0
  },
  currentLine: { speaker: 'sarah_rose', text: 'Hi.' },
  pendingLines: []
}

/** The fields the loop, not `captureScene`, adds to a scene as it writes it. */
const LOOP_SCENE_FIELDS: Partial<SceneState> = {
  resumeOnLine: true,
  endPending: true,
  ledger: {} as LedgerResponse,
  opening: { lines: [], hangouts: [], events: [], cancellations: [] } as unknown as BankedOpening
}

/**
 * Today's save as core writes it, every optional field present: explicit values loaded through
 * the store, the scene restored, and the store's own `toGameSave()` taken. No strangers.
 */
function referenceDraft(): SaveDraft {
  const game = useGameStore.getState()
  game.reset()
  const base: GameSave = {
    ...game.toGameSave(),
    playthroughId: 'p1',
    saveId: 'manual01',
    saveDate: 0,
    semester: '200',
    bio: 'A runner.',
    tallies: { moneyEarned: 80, kisses: 1, sex: 0, shiftsWorked: 2, tokensGenerated: 500 },
    date: 10,
    time: 1,
    charInfo: {
      a: {
        memories: [memory(3, 'the reader was kind'), memory(5, 'the reader brought coffee')],
        flags: { ...emptyFlags(), hasMet: true, gaveContactInfo: true },
        nameKnown: true,
        job: charJob(),
        gifts: ['rose'],
        // Dated with the first memory, so one boundary's question can stand for both.
        textMemory: memory(3, 'the reader texted late'),
        jealousyMemories: [{ date: 7, type: 'disliked', desc: 'the reader kissed Ana' }],
        giftMemories: [memory(8, 'the reader gave her a rose')],
        feed: [
          {
            id: 'post-1',
            text: 'Coffee.',
            date: 4,
            time: 0,
            likes: 3,
            comments: [{ id: 'c-1', handle: 'ana', emoji: '☕', text: 'Same.', at: 8 }]
          }
        ],
        notes: 'Likes coffee.'
      },
      b: { memories: [], flags: emptyFlags(), nameKnown: false, gifts: [] }
    },
    playerSchedule: { 0: 'BIO 210' },
    history: { 3: { 0: 'They met.' } },
    replays: { 3: { 0: 'replay-1' } },
    bunnyboard: {
      conversations: {
        a: {
          charId: 'a',
          messages: [{ id: 'm-1', sender: 'contact', text: 'Hey.', date: 9, time: 0 }],
          unread: 1,
          summary: null
        }
      },
      requestsSent: [],
      requestsReceived: [],
      contactsBadge: 0,
      suggestions: ['b']
    },
    events: [calendarEvent({ id: 'e-1', date: 12, charIds: ['a'] })],
    job: {
      jobId: 'cutetea',
      shifts: [1],
      shiftsWorked: 2,
      earned: 80,
      raises: 0,
      streak: 2,
      strikes: 0,
      sickUsed: false,
      settledThrough: 19,
      workedSlots: [3, 17]
    },
    formerJobs: { fast_eats: { raises: 1, left: 'quit' } },
    transcript: { gradePoints: [3], aced: 1, attended: 10, held: 12 },
    inventory: [{ itemId: 'rose', count: 1 }],
    sceneEventsFired: { [SCENE_EVENT_IDS[0]]: 4 },
    readerCold: { strain: 6, since: 6, incubation: 2 },
    readerColdsHad: [6],
    classRecords: {
      'BIO 210': {
        meetings: [{ date: 0, attended: true, summary: 'Cells.' }],
        midtermProject: { sessions: [{ date: 2, time: 1, summary: 'Built a model.' }] }
      }
    },
    // Past the first-post nudge, so filing a contact's post texts nobody.
    bunnybotFirstPostNudgeSent: true,
    bunnybotSeenTipSent: true,
    npcRelationships: { [PAIR]: { affinity: 5 } },
    npcFriendships: [{ a: 'a', b: 'b', date: 2, time: 0 }],
    occasionsDeclined: ['occasion-1'],
    slotRumor: { date: 10, time: 1, placeId: 'quad', sentence: 'A band is playing.' },
    homecomingVisitor: 'b',
    scene: SCENE,
    thumbnail: 'AAAA'
  }
  game.loadSave(base, RECORD, CHARACTERS)
  useGameStore.getState().restoreScene(SCENE)
  return structuredClone(useGameStore.getState().toGameSave())
}

/** The reference as a file holds it: the service's own fields, a thumbnail, the loop's scene fields. */
function fileOf(draft: SaveDraft): GameSave {
  return {
    ...structuredClone(draft),
    playthroughId: 'p1',
    saveId: 'manual01',
    saveDate: 0,
    thumbnail: 'AAAA',
    scene: draft.scene && { ...structuredClone(draft.scene), ...LOOP_SCENE_FIELDS }
  }
}

/** Loads `save` as entering the game does — the save, then its scene — and writes it straight back. */
function loadAndSave(save: GameSave): SaveDraft {
  useGameStore.getState().reset()
  useGameStore.getState().loadSave(structuredClone(save), RECORD, CHARACTERS)
  useGameStore.getState().restoreScene(save.scene)
  return structuredClone(useGameStore.getState().toGameSave())
}

/** The full save with a stranger on every record. */
function strangerSave(): GameSave {
  return planted(fileOf(referenceDraft()), PLANTED)
}

beforeEach(() => {
  resetLoopState()
  useGameStore.getState().reset()
})

afterEach(() => {
  resetLoopState()
  useGameStore.getState().reset()
  restoreApi()
})

describe('a stranger’s key on a save', () => {
  it('survives a load and a save, and the core keys come out as without it', () => {
    const out = loadAndSave(strangerSave())
    // Core's own keys first, so a lost stranger cannot hide a changed core field.
    expect(unplanted(out, PLANTED)).toEqual(loadAndSave(fileOf(referenceDraft())))
    // The scene's own strangers are the next two checks'; here the rest of the save is held.
    expectStrangers(out, SAVE_PATHS)
  })

  it('survives the scene being restored and captured', () => {
    const scene = strangerSave().scene
    useGameStore.getState().restoreScene(scene)
    expectStrangers({ scene: useGameStore.getState().captureScene() }, SCENE_PATHS)
  })

  it('goes with its scene: the next scene cast carries none of it', () => {
    useGameStore.getState().restoreScene(strangerSave().scene)
    useGameStore.getState().setCast(['a'])
    expect(useGameStore.getState().captureScene()).not.toHaveProperty('zz')
  })

  it('goes with its save: the next save loaded carries none of it', () => {
    const plain = fileOf(referenceDraft())
    useGameStore.getState().loadSave(strangerSave(), RECORD, CHARACTERS)
    useGameStore.getState().loadSave(plain, RECORD, CHARACTERS)
    expect(useGameStore.getState().toGameSave()).not.toHaveProperty('zz')
  })

  it('survives a failed turn rewinding the scene', () => {
    const scene = strangerSave().scene
    useGameStore.getState().reset()
    failTurn({ code: 'LLM_TIMEOUT', message: 'Timed out.' }, { scene, action: 'Wave.' })
    expectStrangers({ scene: useGameStore.getState().captureScene() }, SCENE_PATHS)
  })

  it('survives the semester carry into the next semester’s first save', () => {
    const save = strangerSave()
    useGameStore.getState().loadSave(save, RECORD, CHARACTERS)
    const game = useGameStore.getState()
    const handoff = carryOf(game, semesterOf(RECORD, '200'))
    expectStrangers(handoff.carry, CARRIED_PATHS)

    const next = continuedStartOf(
      enrollment({
        chars: ['a', 'b'],
        continued: {
          id: '300',
          index: 2,
          parent: '200',
          alumni: handoff.alumni,
          priorProfiles: handoff.priorProfiles,
          pursuits: {},
          carry: handoff.carry
        }
      }),
      {},
      Object.values(CHARACTERS)
    )
    expectStrangers(next.save, CARRIED_PATHS)
  })

  it('survives a memory edit, on the edited memories and the untouched ones', () => {
    const save = strangerSave()
    useGameStore.getState().loadSave(save, RECORD, CHARACTERS)
    const a = save.charInfo.a
    const [first] = a.memories
    const text = a.textMemory!
    // The question as the boundary asks it: rows off the ledger, answers rewriting two of them.
    const rows = memoryEditRows(
      ['a'],
      [
        { charId: 'a', type: first.type, desc: first.desc },
        { charId: 'a', type: text.type, desc: text.desc }
      ],
      first.date
    )
    const answers = [
      { type: 'loved' as const, desc: 'the reader was very kind' },
      { type: 'loved' as const, desc: 'the reader texted all night' }
    ]
    const edits = memoryEditsOf(rows, answers, save.date)
    expect(edits).toHaveLength(2)
    // What the boundary's filing does with each edit.
    for (const { charId, match, next } of edits) {
      if (match) useGameStore.getState().replaceMemory(charId, match, next)
      else if (next) useGameStore.getState().recordMemory(charId, next)
    }
    expect(useGameStore.getState().charInfo.a.memories[0].type).toBe('loved')
    expectStrangers(
      useGameStore.getState().toGameSave(),
      SAVE_PATHS.filter((path) => path[0] === 'charInfo' && path[1] === 'a')
    )
  })

  it('survives a message appended to the conversation', () => {
    useGameStore.getState().loadSave(strangerSave(), RECORD, CHARACTERS)
    useGameStore
      .getState()
      .appendChatMessage('a', { id: 'm-2', sender: 'player', text: 'Hi.', date: 10, time: 1 }, 0)
    const out = useGameStore.getState().toGameSave()
    expect(out.bunnyboard.conversations.a.messages).toHaveLength(2)
    expectStrangers(
      out,
      SAVE_PATHS.filter((path) => path[0] === 'bunnyboard')
    )
  })

  it('survives a feed post filed beside the existing ones', async () => {
    stubApi({})
    useGameStore.getState().loadSave(strangerSave(), RECORD, CHARACTERS)
    const key = Object.keys(useGameStore.getState().charKeyToId).find(
      (charKey) => useGameStore.getState().charKeyToId[charKey] === 'a'
    )!
    await fileLatePost({ char: key, text: 'Another coffee.' })
    const out = useGameStore.getState().toGameSave()
    expect(out.charInfo.a.feed).toHaveLength(2)
    expectStrangers(
      out,
      SAVE_PATHS.filter((path) => path[0] === 'charInfo' && path[2] === 'feed')
    )
  })

  it('does not bring back a key core cleared', () => {
    useGameStore.getState().loadSave(fileOf(referenceDraft()), RECORD, CHARACTERS)
    useGameStore.setState({ homecomingVisitor: null, readerCold: null })
    const out = useGameStore.getState().toGameSave()
    expect(out).not.toHaveProperty('homecomingVisitor')
    expect(out).not.toHaveProperty('readerCold')
  })

  it('writes a save with no strangers exactly as it read it, key order included', () => {
    const expected = referenceDraft()
    const out = loadAndSave(fileOf(expected))
    expect(JSON.stringify(out)).toBe(JSON.stringify(expected))
  })
})

describe('a stranger’s key on a character file', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'venus-university-passthrough-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('survives a write and a read', async () => {
    const { getCharacter, writeCharacter } = await import(
      '../src/main/services/characterService'
    )
    const { getCharacterFilePath } = await import('../src/main/paths')
    // A character's own folder, as creating her makes it.
    await mkdir(dirname(getCharacterFilePath('passthrough-1')), { recursive: true })
    const written = { ...character({ charId: 'passthrough-1' }), zz: structuredClone(STRANGER) }
    await writeCharacter(written)
    expectStrangers(await getCharacter('passthrough-1'), [[]])
  })
})
