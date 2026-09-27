import {
  buildClassifierFormat,
  normalizeVerdict,
  verdictSummary,
  type ClassifierPromptRequest,
  type ClassifierVerdict
} from '../classifier'
import { completeStructured } from './cloudLlm'
import { readSettings } from './settingsPort'

/** Runs the classifier on the configured cloud model. */
export async function classifyCloud(
  request: ClassifierPromptRequest,
  charKeys: readonly string[],
  signal?: AbortSignal
): Promise<ClassifierVerdict> {
  // Same shape as the hangout classifier: a fixed judgement, not a piece of writing — so under
  // `strictSchema` it is capped as well as floored.
  const strict = (await readSettings()).strictSchema === true
  // `completeStructured` logs the request pair; only the verdict line is added here.
  const parsed = await completeStructured<unknown>(
    {
      system: request.system,
      user: request.user,
      schema: { name: 'classifier', schema: buildClassifierFormat(request.classCodes) },
      cacheKey: 'classifier',
      // The classifier is judged better at a floor of low.
      minThinking: 'low',
      ...(strict ? { maxThinking: 'low' as const } : {})
    },
    signal
  )

  const verdict = normalizeVerdict(parsed, charKeys, request.classCodes)
  console.log(`[classify] = ${verdictSummary(verdict)}`)
  return verdict
}
