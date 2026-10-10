import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ChatMessage, GameSave, HangoutClassifierResponse, StructuredRequest } from '@shared/types'
import { SAVE_READ } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, stubApi } from './fixtures'
import { readHangoutDecision } from '../src/renderer/mods/strictSchema/hangoutPolicy'
import type { HangoutContext } from '../src/renderer/mods/hooks'

let hooks: typeof import('../src/renderer/mods/hooks')
let game: typeof import('../src/renderer/stores/gameStore')['useGameStore']
let phone: typeof import('../src/renderer/stores/bunnyboardStore')['useBunnyboardStore']
let texting: typeof import('../src/renderer/stores/textingLoop')
let enabled: boolean
let prefetch = vi.fn(async (_charId: string, _description: string) => {})

const message = (sender: ChatMessage['sender'], text: string): ChatMessage => ({ id: text, sender, text, date: 7, time: 0 })
const response = (outcome: string, playerQuote: string, replyQuote: string, description = 'Coffee with Sarah.') => ({
  playerAsked: outcome === 'accepted', characterOffered: outcome === 'new_offer', description,
  outcome, playerQuote, replyQuote
})

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  hooks = await import('../src/renderer/mods/hooks')
  await import('../src/renderer/modEntries/strict-schema')
  game = (await import('../src/renderer/stores/gameStore')).useGameStore
  phone = (await import('../src/renderer/stores/bunnyboardStore')).useBunnyboardStore
  texting = await import('../src/renderer/stores/textingLoop')
  const loopHooks = await import('../src/renderer/stores/loop/hooks')
  prefetch = vi.fn(async (_charId: string, _description: string) => {})
  loopHooks.registerHangoutEntry({ prefetchHangoutScene: prefetch, startHangoutScene: async () => {} })
  enabled = true
  hooks.setHookRules({ isOn: id => id === 'strict-schema' && enabled, order: () => 0 })
  game.getState().reset()
  phone.getState().reset()
  const sarah = character({ charId: 'a' })
  game.setState({ date: 7, time: 0, chars: ['a'], characters: charactersById(sarah),
    charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo({ nameKnown: true }) },
    bunnyboard: { ...game.getState().bunnyboard, conversations: { a: {
      charId: 'a', messages: [{ ...message('contact', 'Coffee now?'), date: 1, invite: true }], unread: 0, summary: null,
      pendingHangout: { description: 'Coffee with Sarah.' }
    } } }
  })
})

afterEach(() => { vi.useRealTimers(); restoreApi() })

async function exchange(text: string, reply: string, classified: HangoutClassifierResponse): Promise<void> {
  stubApi({ llm: {
    onTextingDelta: () => () => {},
    completeTexting: async () => ({ ok: true, data: { messages: [reply] } }),
    classifyHangout: async () => ({ ok: true, data: classified })
  } })
  const pending = texting.sendMessage('a', text)
  await vi.advanceTimersByTimeAsync(60_000)
  await pending
}

it('classifies the complete reply during typing but arms the hangout only after the final bubble', async () => {
  const sent = 'Can I come over now?'
  const replies = [
    'Yes, I would like that. I am just finishing up here and putting my books away.',
    'Come over to my room now. I will leave the door open and we can have coffee together.'
  ]
  const classify = vi.fn(async (_request: StructuredRequest) => ({ ok: true as const, data: response('accepted', sent, replies[1]) }))
  stubApi({ llm: {
    onTextingDelta: () => () => {},
    completeTexting: async () => ({ ok: true, data: { messages: replies } }),
    classifyHangout: classify
  } })
  const before = game.getState().bunnyboard.conversations.a!.messages.length
  const pending = texting.sendMessage('a', sent)
  await vi.advanceTimersByTimeAsync(0)
  expect(classify).toHaveBeenCalledOnce()
  const request = classify.mock.calls[0][0]
  // Both bubbles, including the agreement in the second, are available before either lands.
  expect(request.user).toContain(replies[1])
  expect(game.getState().bunnyboard.conversations.a!.messages).toHaveLength(before + 1)
  expect(phone.getState().armedHangout).toBeNull()
  expect(prefetch).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(6000)
  expect(game.getState().bunnyboard.conversations.a!.messages).toHaveLength(before + 2)
  expect(phone.getState().armedHangout).toBeNull()
  await vi.advanceTimersByTimeAsync(3000)
  await pending
  expect(phone.getState().armedHangout?.charId).toBe('a')
  expect(prefetch).toHaveBeenCalledOnce()
})

it('waits for the complete response rather than classifying a streamed first bubble alone', async () => {
  let emit: ((group: string, delta: string) => void) | undefined
  let finish!: (reply: { ok: true; data: { messages: string[] } }) => void
  const classify = vi.fn(async () => ({ ok: true as const, data: response('none', '', '') }))
  stubApi({ llm: {
    onTextingDelta: listener => { emit = listener; return () => {} },
    completeTexting: () => new Promise(resolve => { finish = resolve }),
    classifyHangout: classify
  } })
  const pending = texting.sendMessage('a', 'Coffee now?')
  await vi.advanceTimersByTimeAsync(0)
  emit!('texting:a', '{"messages":["I would like to.",')
  await vi.advanceTimersByTimeAsync(6000)
  expect(classify).not.toHaveBeenCalled()
  finish({ ok: true, data: { messages: ['I would like to.', 'But I cannot meet you now.'] } })
  await vi.advanceTimersByTimeAsync(0)
  expect(classify).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(6000)
  await pending
  expect(phone.getState().armedHangout).toBeNull()
})

it('defers classifier errors until typing ends and retries the identical request', async () => {
  const reply = 'I am still considering what you said, but I need to finish this thought first.'
  const classify = vi.fn()
    .mockRejectedValueOnce(new Error('transport unavailable'))
    .mockResolvedValueOnce({ ok: true, data: response('none', '', '') })
  stubApi({ llm: {
    onTextingDelta: () => () => {},
    completeTexting: async () => ({ ok: true, data: { messages: [reply] } }),
    classifyHangout: classify
  } })
  const pending = texting.sendMessage('a', 'How are you?')
  await vi.advanceTimersByTimeAsync(0)
  expect(classify).toHaveBeenCalledOnce()
  expect(game.getState().classifierError).toBeNull()
  await vi.advanceTimersByTimeAsync(6000)
  expect(game.getState().classifierError?.message).toBe('transport unavailable')
  texting.retryHangoutClassify()
  await vi.advanceTimersByTimeAsync(0)
  await pending
  expect(classify).toHaveBeenCalledTimes(2)
  expect(classify.mock.calls[1][0]).toBe(classify.mock.calls[0][0])
})

it('records No once, survives actual save hydration, blocks repeated offers, and allows a later player agreement', async () => {
  texting.answerHangout('a', false)
  texting.answerHangout('a', false)
  const refused = game.getState().bunnyboard.conversations.a!
  expect(refused.messages.filter(m => m.sender === 'player')).toHaveLength(1)
  expect(refused.pendingHangout).toBeUndefined()
  expect(refused.declined).toBe(1)
  expect(refused.declinedAt).toBe(14)
  const anchors = await import('../src/renderer/stores/slotAskers')
  expect(anchors.lastInvitationResponseSlotOf(refused)).toBe(14)
  expect(anchors.lastInviteSlotOf(refused)).toBe(2)
  expect(texting.expireHangoutInvitations([]).ignored).toEqual([])

  const saved = { ...game.getState().toGameSave(), saveDate: 1, playthroughId: 'p', saveId: 'autosave' }
  const parsed = validateRecord<GameSave>(JSON.parse(JSON.stringify(saved)), 'test-save', SAVE_READ)
  const characters = game.getState().characters
  game.getState().reset()
  game.getState().loadSave(parsed, playthroughRecord({ chars: ['a'] }), characters)
  expect(hooks.hangoutOfferAllowed('a')).toBe(false)
  texting.deliverSlotHangouts([{ char: 'sarah_rose', text: 'Coffee now?', description: 'Coffee' }])
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout).toBeUndefined()

  await exchange('How was your day?', 'Come meet me for coffee now.', response('new_offer', '', 'Come meet me for coffee now.'))
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout).toBeUndefined()
  expect(phone.getState().armedHangout).toBeNull()
  expect(game.getState().bunnyboard.conversations.a?.declined).toBe(1)

  await exchange("Actually, let's meet now.", 'Yes, see you at the cafe.', response('accepted', "Actually, let's meet now.", 'Yes, see you at the cafe.'))
  expect(phone.getState().armedHangout?.charId).toBe('a')
  expect(game.getState().bunnyboard.conversations.a?.declined).toBeUndefined()
  expect(game.getState().bunnyboard.conversations.a?.declinedAt).toBeUndefined()
  expect(prefetch).toHaveBeenCalledTimes(1)
})

it.each(['No thanks', 'Not now', 'Maybe later'])('protects %s even if the model claims another offer or agreement', async text => {
  await exchange(text, 'Come anyway, coffee now?', response('accepted', text, 'Come anyway, coffee now?'))
  expect(phone.getState().armedHangout).toBeNull()
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout).toBeUndefined()
  expect(game.getState().bunnyboard.conversations.a?.declined).toBe(1)
  expect(hooks.hangoutOfferAllowed('a')).toBe(false)
})

it('rejects forged or old quotes while accepting a new agreement despite an old refusal', () => {
  const ctx: HangoutContext = { character: character(), sent: message('player', "Actually, let's meet now."),
    replies: [message('contact', 'Yes, see you there.')], invited: null,
    conversation: { charId: 'a', messages: [message('player', 'No thanks')], unread: 0, summary: null }
  }
  expect(readHangoutDecision(response('accepted', 'Sure', 'Yes, see you there.'), ctx).kind).toBe('none')
  expect(readHangoutDecision(response('accepted', ctx.sent.text, 'Sure, come over'), ctx).kind).toBe('none')
  expect(readHangoutDecision(response('declined', 'No thanks', ''), ctx).kind).toBe('none')
  expect(readHangoutDecision({ ...response('accepted', ctx.sent.text, 'Yes, see you there.'), playerAsked: false }, ctx).kind).toBe('none')
  expect(readHangoutDecision(response('accepted', ctx.sent.text, 'Yes, see you there.'), ctx).kind).toBe('accepted')
})

it('honors an evidenced future deferral without arming a hangout', async () => {
  await exchange("Let's meet tomorrow instead.", 'Okay, tomorrow.', response('deferred', "Let's meet tomorrow instead.", ''))
  expect(phone.getState().armedHangout).toBeNull()
  expect(game.getState().bunnyboard.conversations.a?.declined).toBe(1)
})

it('does not count a new future proposal as refusing an invitation that never existed', async () => {
  game.getState().setPendingHangout('a', null)
  await exchange("Let's meet tomorrow.", 'Tomorrow sounds good.', response('deferred', "Let's meet tomorrow.", ''))
  expect(game.getState().bunnyboard.conversations.a?.declined).toBeUndefined()
  expect(phone.getState().armedHangout).toBeNull()
})

it('keeps an unrelated answer from silently declining an outstanding invitation', async () => {
  await exchange("No, I didn't finish my homework.", 'Oh okay.', response('none', '', '', ''))
  expect(game.getState().bunnyboard.conversations.a?.declined).toBeUndefined()
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout?.description).toBe('Coffee with Sarah.')
})

it('does not apply an abandoned classifier result to a newly loaded game', async () => {
  let finish!: (value: { ok: true; data: HangoutClassifierResponse }) => void
  stubApi({ llm: {
    onTextingDelta: () => () => {},
    completeTexting: async () => ({ ok: true, data: { messages: ['Okay.'] } }),
    classifyHangout: () => new Promise(resolve => { finish = resolve })
  } })
  const pending = texting.sendMessage('a', 'No thanks')
  await vi.advanceTimersByTimeAsync(60_000)
  texting.resetTextingLoop()
  game.getState().reset()
  finish({ ok: true, data: response('declined', 'No thanks', '') })
  await pending
  expect(game.getState().bunnyboard.conversations).toEqual({})
})

it('allows new offers after the cooldown and preserves reminders for an already agreed plan', () => {
  texting.answerHangout('a', false)
  game.setState({ events: [{ id: 'e', date: 7, time: 0, charIds: ['a'], title: 'Coffee', description: 'Coffee', madeOn: { date: 6, time: 0 } }] })
  texting.deliverSlotHangouts([{ char: 'sarah_rose', text: 'See you soon.', description: 'Coffee' }])
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout?.description).toBe('Coffee')
  game.getState().setPendingHangout('a', null)
  game.setState({ date: 10, events: [] })
  expect(hooks.hangoutOfferAllowed('a')).toBe(true)
  texting.deliverSlotHangouts([{ char: 'sarah_rose', text: 'Coffee now?', description: 'Coffee' }])
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout?.description).toBe('Coffee')
})

it('keeps the original button and classifier behavior while the mod is off', async () => {
  enabled = false
  texting.answerHangout('a', false)
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout?.dismissed).toBe(true)
  expect(game.getState().bunnyboard.conversations.a?.messages.filter(m => m.sender === 'player')).toEqual([])
  expect(game.getState().bunnyboard.conversations.a?.declined).toBeUndefined()
  await exchange('Hello', 'Coffee now?', { playerAsked: false, characterOffered: true, description: 'Coffee' })
  expect(game.getState().bunnyboard.conversations.a?.pendingHangout?.description).toBe('Coffee')
})

it('captures enabled classifier handlers until that request finishes and preserves extension fields', () => {
  const sent = message('player', 'No thanks')
  const ctx: HangoutContext = { character: game.getState().characters.a!, sent, replies: [message('contact', 'Coffee?')],
    conversation: game.getState().bunnyboard.conversations.a, invited: { description: 'Coffee' } }
  const original: StructuredRequest = { system: 'other mod', user: 'exchange', minThinking: 'low', schema: {
    name: 'hangout', schema: { required: ['extension'], properties: { extension: { type: 'string' } } }
  } }
  const request = hooks.modRequest('hangout-classifier', ctx, original)
  expect(request.schema.schema.required).toEqual(expect.arrayContaining(['extension', 'outcome', 'playerQuote', 'replyQuote']))
  expect(request.schema.schema.properties).toHaveProperty('extension')
  expect(request.minThinking).toBeUndefined()
  const finish = hooks.captureHangoutResult(ctx)
  enabled = false
  const result = finish(response('new_offer', '', 'Coffee?'), { verdict: { initiatedBy: 'contact', description: 'Coffee' }, settled: false })
  expect(result).toMatchObject({ verdict: null, settled: true })
  expect(game.getState().bunnyboard.conversations.a?.declined).toBe(1)
})
