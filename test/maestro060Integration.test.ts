import './fixtures/maestroModelKit'
import { afterEach, describe, expect, it } from 'vitest'
import { calendarOf } from '@shared/semesters'
import { projectProgress } from '@shared/academics'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { READER_SPEAKER, type ClassRecord } from '@shared/types'
import { courseStandingOf, projectPeriodOf, projectSceneContextOf, workedOn } from '../src/renderer/prompts/classProgress'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { canBreakthrough } from '../src/renderer/stores/breakthrough'
import { talentSceneOpen } from '../src/renderer/stores/talentActions'
import { classEntry, character, charactersById, charInfo, sceneLines } from './fixtures'

afterEach(() => { useGameStore.getState().reset(); useModsStore.setState({ switches: { on: {}, options: {} } }) })

describe('Campus Talents with native 0.6.0 grade checks', () => {
  it.each([undefined, 1.5, 2, 3])('reports earned project credit consistently (%s units)', units => {
    const calendar = calendarOf('spring', [], {}), entry = classEntry({ kind: 'project', slot: 0 })
    const period = projectPeriodOf(entry, 7, calendar)!
    const record: ClassRecord = {
      meetings: [{ date: period.assignmentDate, attended: true }],
      midtermProject: { sessions: [{ date: 7, time: 0, ...(units === undefined ? {} : { talentWorkUnits: units }) }] }
    }
    const before = JSON.stringify(record), expected = units ?? 1
    expect(workedOn(record, 'midterm')).toBe(expected)
    expect(courseStandingOf(entry, 7, record, 0, calendar)).toMatchObject({ kind: 'project', worked: expected })
    expect(projectSceneContextOf(entry, 7, record, calendar)?.progress).toEqual(projectProgress(expected, period.needed))
    expect(JSON.stringify(record)).toBe(before)
  })
})

it('Breakthrough and talent actions respect the new secret opening lock, then reopen normally', () => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: { breakthrough: true, 'campus-talents': true }, options: {} } })
  const girl = character({ charId: 'a' })
  const lines = [{ speaker: READER_SPEAKER, text: 'Hello' }, ...sceneLines('She begins her secret.', 'She continues.')]
  useGameStore.setState({ playthroughId: 'p', date: 7, time: 0, cast: ['a'], chars: ['a'],
    characters: charactersById(girl), charInfo: { a: charInfo({ nameKnown: true }) },
    sceneSecret: 'A private confession', awaitingInput: false, busy: true, streaming: true,
    currentSceneTranscript: lines, sceneLog: lines.slice(0, 2), currentLine: lines[1], pendingLines: [lines[2]],
    exBreakthrough: normalizeBreakthrough({ meters: { a: 100 } }) })
  expect(canBreakthrough(useGameStore.getState(), 'a')).toBe(false)
  expect(talentSceneOpen(useGameStore.getState())).toBe(false)
  expect(useGameStore.getState().exBreakthrough.meters.a).toBe(100)
  useGameStore.setState({ awaitingInput: true, busy: false, streaming: false, pendingLines: [] })
  expect(canBreakthrough(useGameStore.getState(), 'a')).toBe(true)
  expect(talentSceneOpen(useGameStore.getState())).toBe(true)
})
