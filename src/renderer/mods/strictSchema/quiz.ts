import { appError } from '@shared/errors'
import { QUIZ_LETTERS } from '@shared/academics'
import type { RequestSpots } from '../hooks'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function normalized(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Reject the whole unusable paper before any answer or exam score can be saved. */
export function strictQuizResult(draft: unknown, ctx: RequestSpots['quiz']): unknown {
  const questions = record(draft)?.questions
  const invalid = (reason: string): never => {
    throw appError('LLM_MALFORMED', 'The model returned an invalid exam paper. Retry the exam.', reason)
  }
  if (!Array.isArray(questions) || questions.length !== ctx.facts.length) {
    return invalid(`Expected ${ctx.facts.length} questions, one per selected fact.`)
  }
  const seen = new Set<string>()
  for (const [index, raw] of questions.entries()) {
    const entry = record(raw)
    if (!entry) return invalid(`Question ${index + 1} is not an object.`)
    const fields = ['question', 'a', 'b', 'c', 'd'] as const
    if (fields.some(key => typeof entry[key] !== 'string' || !(entry[key] as string).trim())) {
      invalid(`Question ${index + 1} has a missing, blank, or non-string question or option.`)
    }
    if (!QUIZ_LETTERS.includes(entry.correct as typeof QUIZ_LETTERS[number])) {
      invalid(`Question ${index + 1} has an invalid correct-answer letter.`)
    }
    const options = ['a', 'b', 'c', 'd'].map(key => normalized(entry[key] as string))
    if (new Set(options).size !== 4) invalid(`Question ${index + 1} has duplicate answer options.`)
    const question = normalized(entry.question as string)
    if (seen.has(question)) invalid(`Question ${index + 1} repeats another question.`)
    seen.add(question)
  }
  return draft
}
