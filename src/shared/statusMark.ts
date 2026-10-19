import type { Polarity, SceneLine, TextMark } from './types'

/** The polarity a run's tone carries; a stat-key tone says which stat, not which way. */
const TONE_POLARITY: Partial<Record<TextMark['tone'], Polarity>> = {
  gain: 'positive',
  loss: 'negative'
}

/**
 * Assembles the sentence from its parts rather than searching for the runs afterwards, so the
 * offsets can't drift from the wording: a reworded line and its marks are the same edit. Every
 * odd-numbered segment is a run, all of them in `tone`.
 */
export function markedRuns(segments: readonly string[], tone: TextMark['tone']): SceneLine {
  const marks: TextMark[] = []
  let at = 0
  segments.forEach((segment, i) => {
    if (i % 2 === 1) marks.push({ start: at, end: at + segment.length, tone })
    at += segment.length
  })
  const polarity = TONE_POLARITY[tone]
  return {
    speaker: '',
    text: segments.join(''),
    status: { marks, ...(polarity ? { polarity } : {}) }
  }
}

/** {@link markedRuns} with the one run between `before` and `after`. */
export function markedLine(
  before: string,
  run: string,
  after: string,
  tone: TextMark['tone']
): SceneLine {
  return markedRuns([before, run, after], tone)
}
