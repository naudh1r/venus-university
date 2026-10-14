import { afterEach, expect, it, vi } from 'vitest'
import { classEntry, restoreApi, stubApi } from './fixtures'
import { strictQuizResult } from '../src/renderer/mods/strictSchema/quiz'

afterEach(restoreApi)

const ctx = { className: 'Biology', facts: ['Mitochondria generate ATP.'] }
const question = () => ({ question: 'Which organelle generates ATP?', a: 'Mitochondria', b: 'Nucleus', c: 'Ribosome', d: 'Golgi apparatus', correct: 'A' })

it.each([
  ['missing paper', undefined],
  ['missing question', { questions: [] }],
  ['extra question', { questions: [question(), question()] }],
  ['non-object question', { questions: [null] }],
  ['blank question', { questions: [{ ...question(), question: ' ' }] }],
  ['non-string option', { questions: [{ ...question(), b: 42 }] }],
  ['invalid letter', { questions: [{ ...question(), correct: 'E' }] }],
  ['missing letter', { questions: [{ ...question(), correct: undefined }] }],
  ['duplicate options', { questions: [{ ...question(), b: ' MITOCHONDRIA ' }] }]
])('rejects an unusable paper: %s', (_name, draft) => {
  expect(() => strictQuizResult(draft, ctx)).toThrow('invalid exam paper')
})

it('rejects repeated questions and keeps valid answers correct after the engine shuffles', async () => {
  expect(() => strictQuizResult({ questions: [question(), { ...question(), question: ' WHICH organelle generates ATP? ' }] },
    { ...ctx, facts: [...ctx.facts, 'Another fact.'] })).toThrow('invalid exam paper')
  const { normalizeQuiz } = await import('../src/renderer/prompts/quizPrompt')
  const draft = { questions: [question()], extension: 'other mod data' }
  expect(strictQuizResult(draft, ctx)).toBe(draft)
  const [result] = normalizeQuiz(draft, 1)
  const options = { A: result.a, B: result.b, C: result.c, D: result.d }
  expect(options[result.correct]).toBe('Mitochondria')
})

it('tightens the actual quiz request, preserves extensions, and captures enabled result handlers', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const { buildQuizPrompt } = await import('../src/renderer/prompts/quizPrompt')
  const { strictQuizRequest } = await import('../src/renderer/mods/strictSchema/requests')
  await import('../src/renderer/modEntries/strict-schema')
  let enabled = false
  hooks.setHookRules({ isOn: id => id === 'strict-schema' && enabled, order: () => 0 })
  const base = buildQuizPrompt(ctx.className, ctx.facts)
  const snapshot = structuredClone(base)
  const offResult = hooks.captureQuizResult(ctx)
  enabled = true
  const on = buildQuizPrompt(ctx.className, ctx.facts)
  const questions = (on.schema.schema.properties as Record<string, { minItems: number; maxItems: number; items: { properties: Record<string, { minLength?: number }> } }>).questions
  expect(questions).toMatchObject({ minItems: 1, maxItems: 1 })
  for (const key of ['question', 'a', 'b', 'c', 'd']) expect(questions.items.properties[key].minLength).toBe(1)
  expect(on).toMatchObject({ user: base.user, cacheKey: base.cacheKey, kind: base.kind })
  const onResult = hooks.captureQuizResult(ctx)
  enabled = false
  expect(buildQuizPrompt(ctx.className, ctx.facts)).toEqual(base)
  const invalid = { questions: [{ ...question(), correct: 'E' }] }
  expect(offResult(invalid)).toBe(invalid)
  expect(() => onResult(invalid)).toThrow('invalid exam paper')
  const fields = (base.schema.schema.properties as Record<string, { items: { properties: Record<string, unknown>; required: string[] } }>).questions.items
  fields.properties.extension = { type: 'string' }
  fields.required.push('extension')
  const extension = strictQuizRequest(base, ctx)
  expect((extension.schema.schema.properties as typeof base.schema.schema.properties)).toMatchObject({ questions: { items: {
    properties: { extension: { type: 'string' } }, required: expect.arrayContaining(['extension'])
  } } })
  delete fields.properties.extension
  fields.required.pop()
  expect(base).toEqual(snapshot)
})

it('keeps a rejected exam out of quiz state and the grade record, even if the mod is switched off in flight', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const { startExam } = await import('../src/renderer/stores/loop/exams')
  const { useGameStore: game } = await import('../src/renderer/stores/gameStore')
  await import('../src/renderer/modEntries/strict-schema')
  let enabled = true
  hooks.setHookRules({ isOn: id => id === 'strict-schema' && enabled, order: () => 0 })
  const entry = classEntry()
  game.getState().reset()
  game.setState({ classes: { [entry.code]: entry }, classRecords: { [entry.code]: {
    meetings: [{ date: 1, attended: true, factoid: ctx.facts[0] }]
  } } })
  const before = structuredClone(game.getState().classRecords)
  stubApi({ llm: { generateQuiz: async <T>() => {
    enabled = false
    return { ok: true, data: { questions: [{ ...question(), correct: 'E' }] } as T }
  } } })
  await startExam(entry, 'midterm', { scene: null, action: 'Take the midterm' })
  expect(game.getState().turnError).toMatchObject({ code: 'LLM_MALFORMED' })
  expect(game.getState().sceneQuiz).toBeNull()
  expect(game.getState().classRecords).toEqual(before)
})
