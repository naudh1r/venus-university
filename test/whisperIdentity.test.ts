import './fixtures/maestroModelKit'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { charKeyOf, READER_SPEAKER, type GameSave, type SceneLine, type StructuredRequest } from '@shared/types'
import { carryWhisper, ensureWhisperAuthor, normalizeWhisper, whisperRecall, type WhisperIssue } from '@shared/venusWhisper'
import { settleWhisperConfession, whisperCanConfess, whisperIdentityKnown, whisperIdentityLines,
  type WhisperConfession, type WhisperIdentityContext } from '@shared/whisperIdentity'
import { recordWhisperConfession, whisperConfessionRequest, whisperIdentityContext } from '../src/renderer/stores/whisperIdentity'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { buildWhisperReplies } from '../src/renderer/prompts/venusWhisperPrompt'
import { mergeLedgerReplies } from '../src/renderer/prompts/textLedgerPrompt'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { promptState } = await import('../src/renderer/stores/loop/promptState')
afterAll(restoreApi)

const author = character({ charId: 'a' }), other = character({ charId: 'b', firstName: 'Mina' })
const key = charKeyOf(author.firstName, author.lastName), game = () => useGameStore.getState()
const affection = (count: number) => charInfo({ nameKnown: true, memories: Array.from({ length: count }, (_, n) =>
  ({ date: 7, type: 'loved' as const, desc: `shared a kind moment ${n}` })) })
const claim: WhisperConfession = { author: key, asked: true, admitted: true, private: true,
  question: 'Are you Lady Harewood?', quote: 'Yes. I write the column.' }
const lines: SceneLine[] = [{ speaker: READER_SPEAKER, text: claim.question }, { speaker: key, text: claim.quote }]
const ctx = (): WhisperIdentityContext => ({ whisper: game().exVenusWhisper, term: 0, date: 7, time: 0,
  cast: [author], charInfo: game().charInfo })
const issue: WhisperIssue = { id: 'whisper:0:7', term: 0, day: 7, title: 'A quiet campus', body: 'Even the park was quiet.',
  subjects: ['b'], comments: [], answered: [] }

beforeEach(() => {
  game().reset()
  useGameStore.setState({ playthroughId: 'p', date: 7, time: 0, chars: ['a', 'b'], cast: ['a'],
    characters: charactersById(author, other), charInfo: { a: affection(20), b: affection(20) }, currentSceneTranscript: lines })
  useGameStore.setState({ exVenusWhisper: ensureWhisperAuthor(game(), () => 0) })
})

describe('private columnist discovery', () => {
  it('requires the true author, native trusted tier, and a one-to-one scene outside class or shifts', () => {
    expect(whisperCanConfess(ctx())).toBe(true)
    for (const over of [{ cast: [other] }, { cast: [author, other] }, { cast: [] }, { classCode: 'BIO 210' },
      { jobId: 'cutetea' }, { visitJobId: 'cutetea' }, { charInfo: { a: affection(3) } }]) {
      const locked = { ...ctx(), ...over }
      expect(whisperCanConfess(locked)).toBe(false)
      expect(settleWhisperConfession(locked, claim, lines)).toBe(locked.whisper)
      expect(whisperIdentityLines(locked).join(' ')).not.toContain(author.firstName)
      expect(whisperIdentityLines(locked).join(' ')).not.toContain(key)
    }
    expect(whisperCanConfess({ ...ctx(), charInfo: { a: affection(4) } })).toBe(true)
  })

  it('files only an actual, correctly attributed question then admission, including overflow-split dialogue', () => {
    const split = [lines[0], { speaker: key, text: 'Yes.' }, { speaker: key, text: 'I write the column.' }]
    const result = settleWhisperConfession(ctx(), claim, split)
    expect(result.discovery).toEqual({ author: 'a', term: 0, day: 7, time: 0 })
    expect(game().exVenusWhisper.discovery).toBeUndefined()
    expect(settleWhisperConfession({ ...ctx(), whisper: result }, claim, lines)).toBe(result)
    const badClaims: unknown[] = [null, {}, { ...claim, author: 'mina_rose' }, { ...claim, asked: false },
      { ...claim, admitted: false }, { ...claim, private: false }, { ...claim, quote: '' },
      { ...claim, quote: 'Invented admission' }, { ...claim, question: 'Invented question' },
      { ...claim, quote: 'x'.repeat(601) }]
    for (const bad of badClaims) expect(settleWhisperConfession(ctx(), bad, lines)).toBe(game().exVenusWhisper)
    for (const transcript of [[], [...lines].reverse(), [{ speaker: key, text: claim.question }, lines[1]],
      [lines[0], { speaker: READER_SPEAKER, text: claim.quote }],
      [lines[0], { speaker: 'narrator', text: claim.quote }], [lines[0], { speaker: 'mina_rose', text: claim.quote }]]) {
      expect(settleWhisperConfession(ctx(), claim, transcript)).toBe(game().exVenusWhisper)
    }
  })

  it('retains knowledge through save/load and repeated carryover, while rewinds and new games keep their own state', () => {
    const original = structuredClone(game().exVenusWhisper)
    const discovered = settleWhisperConfession(ctx(), claim, lines)
    useGameStore.setState({ exVenusWhisper: discovered })
    const save = { ...game().toGameSave(), playthroughId: 'p', saveId: 's', saveDate: 0 } as GameSave
    game().loadSave(save, playthroughRecord({ chars: ['a', 'b'] }), charactersById(author, other))
    expect(game().exVenusWhisper).toEqual(discovered)
    const nextTerm = carryWhisper(carryWhisper(discovered, 0, 120), 1, 120)
    expect(nextTerm.discovery).toEqual(discovered.discovery)
    expect(whisperIdentityKnown({ ...ctx(), whisper: nextTerm, term: 2, date: 0, charInfo: { a: affection(0) } })).toBe(true)
    expect(whisperIdentityKnown({ ...ctx(), whisper: discovered, date: 6, time: 1 })).toBe(false)
    expect(carryWhisper(discovered, 0, 6).discovery).toBeUndefined()
    game().loadSave({ ...save, exVenusWhisper: original }, playthroughRecord({ chars: ['a', 'b'] }), charactersById(author, other))
    expect(game().exVenusWhisper.discovery).toBeUndefined()
    game().reset()
    expect(game().exVenusWhisper.discovery).toBeUndefined()
    expect(game().exVenusWhisper.author).toBeUndefined()
  })

  it('normalizes discovery independently and rejects malformed or mismatched imported identities', () => {
    const discovery = settleWhisperConfession(ctx(), claim, lines).discovery!
    for (const over of [{ author: 'b' }, { term: -1 }, { day: NaN }, { day: 1.2 }, { time: 2 }]) {
      const result = normalizeWhisper({ ...ctx().whisper, issues: [issue], discovery: { ...discovery, ...over } })
      expect(result.discovery).toBeUndefined()
      expect(result.issues).toEqual([issue])
    }
    expect(normalizeWhisper({ ...ctx().whisper, discovery, author: undefined }).discovery).toBeUndefined()
    const future = normalizeWhisper({ ...ctx().whisper, discovery: { ...discovery, time: 1 } })
    expect(whisperIdentityKnown({ ...ctx(), whisper: future })).toBe(false)
    expect(whisperIdentityKnown({ ...ctx(), whisper: future, time: 1 })).toBe(true)
  })

  it('does not pass private discovery into articles, ordinary replies, public recall or scenes without the author', () => {
    const before = { ...ctx().whisper, issues: [issue] }
    const after = settleWhisperConfession({ ...ctx(), whisper: before }, claim, lines)
    expect(whisperRecall(before, 0, 7, ['b'])).toEqual(whisperRecall(after, 0, 7, ['b']))
    const publicReply = JSON.parse(buildWhisperReplies(issue, [before.author!]).user)
    expect(publicReply).not.toHaveProperty('discovery')
    expect(publicReply).not.toHaveProperty('author')
    expect(publicReply.profiles[0]).toEqual(before.author)
    const unknownCast = whisperIdentityLines({ ...ctx(), whisper: after, cast: [other] }).join(' ')
    expect(unknownCast).not.toContain(author.firstName)
    expect(unknownCast).not.toContain(key)
    // A fall in affection does not erase the true author's private continuity.
    expect(whisperIdentityLines({ ...ctx(), whisper: after, charInfo: { a: affection(0) } }).join(' ')).toContain(key)
  })
})

describe('native ledger and save boundary integration', () => {
  const request: StructuredRequest = { system: 'Bookkeeping', user: 'Scene transcript', cacheKey: 'p',
    schema: { name: 'ledger', schema: { type: 'object', required: ['existing'], properties: { existing: { type: 'boolean' } } } } }

  it('extends the existing ledger without losing other fields and ignores inactive, stale and replay contexts', () => {
    const state = promptState()
    const enriched = whisperConfessionRequest(request, { state, charKeys: [key] })
    expect(enriched.cacheKey).toBe(request.cacheKey)
    expect(enriched.schema.schema.required).toEqual(['existing', 'exWhisperConfession'])
    expect(enriched.schema.schema.properties).toHaveProperty('existing', { type: 'boolean' })
    expect(request.schema.schema.required).toEqual(['existing'])
    expect(whisperConfessionRequest(request, { state, charKeys: ['mina_rose'] })).toBe(request)
    for (const stale of [{ ...state, date: 6 }, { ...state, time: 1 as const }, { ...state, playthroughId: 'different' }]) {
      expect(whisperConfessionRequest(request, { state: stale, charKeys: [key] })).toBe(request)
    }
    useGameStore.setState({ replaying: {} })
    expect(whisperIdentityContext(state, [author])).toBeNull()
    useGameStore.setState({ replaying: null, playthroughId: null })
    expect(whisperConfessionRequest(request, { state, charKeys: [key] })).toBe(request)
  })

  it('persists only a live accepted scene confession, and texting cannot inject or overwrite it', () => {
    const before = game()
    const ledger = mergeLedgerReplies({ exWhisperConfession: claim }, {})
    expect(ledger.exWhisperConfession).toEqual(claim)
    expect(mergeLedgerReplies({}, { exWhisperConfession: claim }).exWhisperConfession).toBeUndefined()
    recordWhisperConfession({ before, ledger: null, closingCast: [author] })
    expect(game().exVenusWhisper.discovery).toBeUndefined()
    useGameStore.setState({ loads: before.loads + 1 })
    recordWhisperConfession({ before, ledger, closingCast: [author] })
    expect(game().exVenusWhisper.discovery).toBeUndefined()
    useGameStore.setState({ loads: before.loads })
    recordWhisperConfession({ before, ledger, closingCast: [other] })
    expect(game().exVenusWhisper.discovery).toBeUndefined()
    recordWhisperConfession({ before, ledger, closingCast: [author] })
    expect(game().toGameSave().exVenusWhisper?.discovery).toEqual({ author: 'a', term: 0, day: 7, time: 0 })
    expect(game().charInfo).toBe(before.charInfo)
    expect(whisperConfessionRequest(request, { state: promptState(), charKeys: [key] })).toBe(request)
  })
})
