import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureWhisperAuthor, observeWhisperSlot, whisperPeople, type WhisperIssue } from '@shared/venusWhisper'
import { carryModFields } from '@shared/modCarry'
import '@shared/whisperCarry'
import type { GameSave, Result, SaveDraft, StructuredRequest } from '@shared/types'
import { READER_SPEAKER } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { replyOnWhisper, useWhisperActivity } from '../src/renderer/stores/venusWhisper'
import { recordWhisperConfession } from '../src/renderer/stores/whisperIdentity'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const issue: WhisperIssue = { id: 'whisper:0:9', term: 0, day: 9, weekly: true,
  title: 'A quiet campus', body: 'Everyone enjoys a quiet morning.', subjects: [], comments: [], answered: [] }

beforeEach(() => {
  game().reset(); useBunnyboardStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  useWhisperActivity.setState({ working: false })
  useGameStore.setState({ playthroughId: 'qa-social', date: 9, time: 0, chars: ['a', 'b', 'c'],
    characters: charactersById(character({ charId: 'a' }), character({ charId: 'b', firstName: 'Mina' }), character({ charId: 'c', firstName: 'Robin' })),
    charInfo: { a: charInfo({ nameKnown: true, memories: Array.from({ length: 20 }, (_, i) => ({ date: 8, type: 'loved', desc: `Kindness ${i}` })) }),
      b: charInfo({ nameKnown: true }), c: charInfo({ nameKnown: true }) } })
  useGameStore.setState({ exVenusWhisper: { ...ensureWhisperAuthor(game(), () => 0), issues: [structuredClone(issue)] } })
})

afterEach(async () => { await writesSettled(); restoreApi(); vi.restoreAllMocks(); vi.useRealTimers() })

function deferredReply() {
  let finish!: () => void
  const complete = vi.fn((_modId: string, request: StructuredRequest) => new Promise<Result<{ comments: { speaker: string; text: string }[] }>>(resolve => {
    const profiles = JSON.parse(request.user).profiles as { id: string }[]
    finish = () => resolve({ ok: true, data: { comments: profiles.map(p => ({ speaker: p.id, text: 'A lovely morning indeed.' })) } })
  }))
  const save = vi.fn(async (_p: string, draft: SaveDraft): Promise<Result<GameSave>> => ({ ok: true, data: { ...draft, playthroughId: 'qa-social', saveId: 'autosave', saveDate: 0 } }))
  stubApi({ llm: { completeMod: complete }, saves: { autosave: save } })
  return { complete, save, finish: () => finish() }
}

describe('QA2 background Hare & Quill reply lifecycle', () => {
  it('rebases after waiting for a checkpoint, retaining read state and other issues', async () => {
    vi.useFakeTimers()
    const api = deferredReply()
    const pending = replyOnWhisper(issue.id, undefined, 'qa-social', () => true, true)
    useGameStore.setState({ sceneEnding: true })
    api.finish()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.save).not.toHaveBeenCalled()
    const other = { ...structuredClone(issue), id: 'whisper:0:2', day: 2 }
    useGameStore.setState(s => ({ sceneEnding: false, exVenusWhisper: {
      ...s.exVenusWhisper, issues: [{ ...s.exVenusWhisper.issues[0], read: true }, other]
    } }))
    await vi.advanceTimersByTimeAsync(100)
    await pending
    expect(game().exVenusWhisper.issues.find(i => i.id === issue.id)?.read).toBe(true)
    expect(game().exVenusWhisper.issues.find(i => i.id === other.id)).toEqual(other)
  })

  it.each(['removed', 'answered', 'full'] as const)('discards a generated batch when the discussion is %s', async change => {
    const api = deferredReply()
    const pending = replyOnWhisper(issue.id, undefined, 'qa-social', () => true, true)
    const comment = { id: 'new', person: { id: 'b', name: 'Mina', handle: 'mina' }, player: false, text: 'Already answered.', mentions: [] }
    useGameStore.setState(s => ({ exVenusWhisper: { ...s.exVenusWhisper,
      issues: change === 'removed' ? [] : [{ ...s.exVenusWhisper.issues[0],
        comments: change === 'full' ? Array.from({ length: 100 }, (_, n) => ({ ...comment, id: `new-${n}`, player: true })) : [comment]
      }]
    } }))
    const held = game().exVenusWhisper
    api.finish()
    await expect(pending).rejects.toThrow()
    expect(api.save).not.toHaveBeenCalled()
    expect(game().exVenusWhisper).toBe(held)
  })

  it('keeps live changes when the comment save fails', async () => {
    const api = deferredReply()
    api.save.mockResolvedValueOnce({ ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'disk full' } })
    const pending = replyOnWhisper(issue.id, undefined, 'qa-social', () => true, true)
    useGameStore.setState(s => ({ exVenusWhisper: { ...s.exVenusWhisper, issues: [{ ...s.exVenusWhisper.issues[0], read: true }] } }))
    const held = game().exVenusWhisper
    api.finish()
    await expect(pending).rejects.toThrow('disk full')
    expect(game().exVenusWhisper).toBe(held)
  })
  it('retains observations collected while the initial reply batch is outstanding', async () => {
    const api = deferredReply()
    const pending = replyOnWhisper(issue.id, undefined, 'qa-social', () => true, true)
    expect(api.complete).toHaveBeenCalledOnce()
    const observed = observeWhisperSlot({ ...game(), npcRelationships: {
      'b|c': { affinity: 2, encounter: { date: 9, kind: 'hangout', ref: 'green_hill_park', positive: true } }
    } }, {}, { location: 'green_hill_park' })
    expect(observed.observations).toHaveLength(1)
    useGameStore.setState({ exVenusWhisper: observed, time: 1 })
    api.finish(); await pending
    expect.soft(game().exVenusWhisper.observations).toEqual(observed.observations)
    expect.soft(api.save.mock.calls[0][1].exVenusWhisper?.observations).toEqual(observed.observations)
  })

  it('retains a real privately confessed author discovery when delayed comments commit after a scene', async () => {
    const api = deferredReply()
    const pending = replyOnWhisper(issue.id, undefined, 'qa-social', () => true, true)
    const claim = { author: 'sarah_rose', asked: true, admitted: true, private: true,
      question: 'Are you Lady Harewood?', quote: 'Yes, I write the column.' }
    useGameStore.setState({ cast: ['a'], currentSceneTranscript: [
      { speaker: READER_SPEAKER, text: claim.question }, { speaker: 'sarah_rose', text: claim.quote }
    ] })
    recordWhisperConfession({ before: game(), ledger: { exWhisperConfession: claim }, closingCast: [game().characters.a] })
    const discovery = game().exVenusWhisper.discovery
    expect(discovery).toEqual({ author: 'a', term: 0, day: 9, time: 0 })
    useGameStore.setState({ cast: [], currentSceneTranscript: [], time: 1 })
    api.finish(); await pending
    expect.soft(game().exVenusWhisper.discovery).toEqual(discovery)
    expect.soft(api.save.mock.calls[0][1].exVenusWhisper?.discovery).toEqual(discovery)
  })

  it.each(['load', 'off', 'close'] as const)('rejects a delayed batch after %s without writing', async mode => {
    const api = deferredReply(); let active = true
    const pending = replyOnWhisper(issue.id, undefined, 'qa-social', () => active, true)
    if (mode === 'load') useGameStore.setState(s => ({ loads: s.loads + 1 }))
    if (mode === 'off') useModsStore.setState({ switches: { on: { 'venus-whisper': false }, options: {} } })
    if (mode === 'close') active = false
    api.finish()
    await expect(pending).rejects.toThrow('changed')
    expect(api.save).not.toHaveBeenCalled()
    expect(game().exVenusWhisper.issues[0].comments).toEqual([])
  })

  it('keeps the ordinary identity of an author learned while disabled when she leaves the next roster', () => {
    useGameStore.setState(s => ({ exVenusWhisper: { ...s.exVenusWhisper, people: [], author: { ...s.exVenusWhisper.author!, known: false } } }))
    useModsStore.setState({ switches: { on: { 'venus-whisper': false }, options: {} } })
    const save = { ...game().toGameSave(), playthroughId: 'qa-social', saveId: 'graduated', saveDate: 0 } as GameSave
    expect(save.charInfo.a.nameKnown).toBe(true)
    const carried = carryModFields(save, { term: 0, back: 120, characters: game().characters }).exVenusWhisper!
    const after = { ...game(), date: 0, semesterIndex: 1, chars: [], characters: {}, charInfo: {}, exVenusWhisper: carried }
    expect(whisperPeople(after).map(p => p.id)).toContain('a')
  })
})
