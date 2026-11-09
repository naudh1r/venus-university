import './fixtures/maestroModelKit'
import { beforeEach, describe, expect, it } from 'vitest'
import { READER_SPEAKER, type SceneLine } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { endSceneOpenOf, interjectOfferOf, replyRowOfferOf } from '../src/renderer/stores/loop/playback'

const reader = (text: string): SceneLine => ({ speaker: READER_SPEAKER, text })
const line = (text: string): SceneLine => ({ speaker: '', text })

beforeEach(() => {
  useGameStore.getState().reset()
  const lines = [reader('I say hello.'), line('A friendly reply.'), line('Not read yet.')]
  useGameStore.setState({ date: 8, time: 0, cast: ['a'], currentSceneTranscript: lines,
    sceneLog: lines.slice(0, 2), currentLine: lines[1], pendingLines: lines.slice(2) })
})

describe('manual scene ending gates', () => {
  it('allows a read ordinary scene, including a streaming reply', () => {
    expect(endSceneOpenOf(useGameStore.getState())).toBe(true)
    useGameStore.setState({ streaming: true, busy: true })
    expect(endSceneOpenOf(useGameStore.getState())).toBe(true)
  })

  it('refuses an opening whose first reply has not reached the screen', () => {
    const s = useGameStore.getState()
    useGameStore.setState({ pendingLines: s.currentSceneTranscript.slice(1), sceneLog: s.currentSceneTranscript.slice(0, 1) })
    expect(endSceneOpenOf(useGameStore.getState())).toBe(false)
  })

  it('keeps exams, replays, status sequences and completed scenes out', () => {
    const s = useGameStore.getState()
    expect(endSceneOpenOf({ ...s, replaying: {} })).toBe(false)
    expect(endSceneOpenOf({ ...s, statusShown: true })).toBe(false)
    expect(endSceneOpenOf({ ...s, sceneEnding: true })).toBe(false)
    expect(endSceneOpenOf({ ...s, sceneQuiz: {} as NonNullable<typeof s.sceneQuiz> })).toBe(false)
    expect(endSceneOpenOf({ ...s, date: 0, semesterIndex: 0 })).toBe(false)
    expect(endSceneOpenOf({ ...s, date: 123 })).toBe(false)
  })

  it('honors an opening secret lock and prevents re-interjecting after a cut', () => {
    const s = useGameStore.getState()
    expect(endSceneOpenOf({ ...s, sceneSecret: 'a' })).toBe(false)
    useGameStore.getState().setSceneEnding(true, true)
    expect(interjectOfferOf(useGameStore.getState())).toBe('none')
    expect(replyRowOfferOf(useGameStore.getState())).toBe('none')
    useGameStore.getState().setSceneEnding(false)
    expect(useGameStore.getState().sceneEndedByHand).toBe(false)
  })
})

describe('manual cut keeps only earned scene state', () => {
  it('drops unread dialogue and the summary belonging to it', () => {
    const game = useGameStore.getState()
    game.setSceneSummary('Read recap', 2)
    game.setSceneSummary('Unread recap', 3)
    game.cutToRead()
    expect(useGameStore.getState()).toMatchObject({
      currentSceneTranscript: [reader('I say hello.'), line('A friendly reply.')],
      pendingLines: [], sceneSummary: 'Read recap'
    })
  })

  it('keeps already-read lines when called while rewound', () => {
    const game = useGameStore.getState()
    game.advanceLine()
    game.rewindLine()
    game.cutToRead()
    expect(useGameStore.getState().currentSceneTranscript).toHaveLength(3)
    expect(useGameStore.getState().sceneLog.at(-1)?.text).toBe('Not read yet.')
    expect(useGameStore.getState().reread).toBe(0)
  })

  it('refunds a gift on an action whose reply never began, once only', () => {
    const read = [reader('I say hello.'), line('A friendly reply.')]
    const all = [...read, reader('I offer a rose.')]
    useGameStore.setState({ currentSceneTranscript: all, sceneLog: all, pendingLines: [], inventory: [],
      sceneGifts: [{ charId: 'a', itemId: 'rose', repeat: false, reaction: 'neutral', at: 2 }] })
    const game = useGameStore.getState()
    game.cutToRead()
    game.cutToRead()
    expect(useGameStore.getState()).toMatchObject({ currentSceneTranscript: read, sceneLog: read,
      sceneGifts: [], inventory: [{ itemId: 'rose', count: 1 }] })
  })
})
