import { afterEach, describe, expect, it } from 'vitest'
import type { ChatMessage, Conversation } from '@shared/types'
import { buildTextingPrompt, type TextingPromptState } from '../src/renderer/prompts/textingPrompt'
import { registerHooks, setHookRules } from '../src/renderer/mods/hooks'
import { character } from './fixtures'

const owner = 'history-window-fixture'
let enabled = false
setHookRules({ isOn: id => enabled && id === owner, order: () => 0 })
registerHooks(owner, {
  dmHistoryNote: () => ' [history attachment]',
  prompts: { dm: {
    lines: () => ['A fixture DM instruction.'],
    fields: () => ({ fixtureReply: { type: 'string' } }),
    required: () => ['fixtureReply']
  } },
  requests: { dm: request => ({ ...request, system: request.system + '\nA fixture request addition.' }) }
})
afterEach(() => { enabled = false })

function state(historyLimit?: number): TextingPromptState {
  return {
    romance: { male: 'sexuality', female: 'sexuality' }, readerPronouns: 'he',
    historyLimit, date: 7, time: 0, roster: [], lorebook: [], charInfo: {},
    npcRelationships: {}, classes: {}, playerSchedule: {}, classRosters: {},
    playerJob: null, calendar: { season: 'fall', generated: [], fixedEdits: {} }, memoryBudget: 10, history: {}
  }
}

function thread(count = 200): Conversation {
  const messages: ChatMessage[] = Array.from({ length: count }, (_, i) => ({
    id: `history-${i}`, text: `HISTORY_${i}_END`, sender: i % 2 ? 'contact' : 'player',
    date: i < count - 10 ? 6 : 7, time: 0
  }))
  return { charId: 'char-1', messages, summary: null, unread: 3 }
}

function build(conversation: Conversation | undefined, input = state()) {
  return buildTextingPrompt(character(), undefined, conversation, 'PENDING_TEXT', input, 'The reader.')
}

function historyIds(user: string): number[] {
  const recent = user.split('RECENT MESSAGES\n')[1].split('\nYOUR TURN')[0]
  return [...recent.matchAll(/HISTORY_(\d+)_END/g)].map(match => Number(match[1]))
}

describe('bounded DM request history', () => {
  it.each<[number | undefined, number]>([
    [undefined, 20], [20, 20], [80, 80], [160, 160], [200, 160], [1e9, 160],
    [0, 20], [-1, 20], [19, 20], [40.9, 40], [NaN, 20], [Infinity, 20], [-Infinity, 20]
  ])('a request for %s includes the newest %s stored messages, then the pending text', (limit, count) => {
    const request = build(thread(), state(limit))
    expect(historyIds(request.user)).toEqual(Array.from({ length: count }, (_, i) => 200 - count + i))
    expect(request.user.match(/PENDING_TEXT/g)).toHaveLength(1)
    expect(request.user.indexOf('HISTORY_199_END')).toBeLessThan(request.user.indexOf('PENDING_TEXT'))
    expect(request.kind).toBe('texting')
    expect(request.cacheKey).toBe('texting')
  })

  it('keeps the ordinary request unchanged when the default is explicit', () => {
    expect(build(thread(), state(20))).toEqual(build(thread()))
  })

  it('handles a short or missing thread without padding or dropping the pending text', () => {
    expect(historyIds(build(thread(3), state(160)).user)).toEqual([0, 1, 2])
    const request = build(undefined, state(160))
    expect(historyIds(request.user)).toEqual([])
    expect(request.user.match(/PENDING_TEXT/g)).toHaveLength(1)
  })

  it('uses only the supplied pre-reply snapshot, without changing it or the saved thread', () => {
    const saved = thread()
    saved.summary = 'REJECTED_SUMMARY'
    saved.messages.push({ id: 'rejected', sender: 'contact', text: 'REJECTED_REPLY', date: 7, time: 0 })
    const prior = { ...saved, summary: 'PRIOR_SUMMARY', messages: saved.messages.slice(0, -1) }
    const before = JSON.stringify({ saved, prior })
    const request = build(prior, state(160))
    expect(request.user).toContain('PRIOR_SUMMARY')
    expect(request.user).not.toContain('REJECTED_')
    expect(historyIds(request.user)).toHaveLength(160)
    expect(JSON.stringify({ saved, prior })).toBe(before)
  })

  it('uses the expanded window for native lorebook matching and existing DM hooks', () => {
    enabled = true
    const input = state(160)
    input.lorebook = [{ handle: 'fixture', custom: true, keys: ['HISTORY_41_END'], text: 'A remembered rooftop promise.' }]
    const request = build(thread(), input)
    expect(request.user).toContain('A remembered rooftop promise.')
    expect(request.user).toContain('A fixture DM instruction.')
    expect(request.user.match(/\[history attachment\]/g)).toHaveLength(80)
    expect(request.system).toContain('A fixture request addition.')
    expect(request.schema.schema).toMatchObject({
      properties: { fixtureReply: { type: 'string' } }, required: expect.arrayContaining(['fixtureReply'])
    })
    const ordinary = build(thread(), { ...input, historyLimit: undefined })
    expect(ordinary.user).not.toContain('A remembered rooftop promise.')
    expect(ordinary.user.match(/\[history attachment\]/g)).toHaveLength(10)
  })
})
