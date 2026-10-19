import { coldStageAt, type ColdStage } from '@shared/colds'
import type { ColdCase } from '@shared/types'

/** What the writer is told of somebody's cold: one line a stage, and nothing while it incubates. */

/** A girl's cold at each stage that shows, filled with her name. */
const HER_COLD: Readonly<Record<Exclude<ColdStage, 'incubating'>, string>> = {
  comingDown:
    "{name} is coming down with a cold: her throat is scratchy, she keeps sneezing, and she's more tired than usual.",
  worst:
    "{name} is in the worst of a cold: a blocked nose, sneezing fits, a headache and a low fever. She's staying in today and would rather be in bed.",
  gettingBetter:
    "{name} is getting over a cold: she's still stuffy and coughs now and then, but her energy is coming back.",
  cough: '{name} is nearly over a cold, with only a dry cough that comes and goes.'
}

/** The reader's cold at each stage that shows. */
const READER_COLD: Readonly<Record<Exclude<ColdStage, 'incubating'>, string>> = {
  comingDown:
    'The reader is coming down with a cold: a scratchy throat, sneezing and tiredness. He coughs and sneezes now and then.',
  worst:
    'The reader is in the worst of a cold: a blocked nose, sneezing fits, a headache and a low fever. He coughs and sneezes now and then.',
  gettingBetter:
    'The reader is getting over a cold: still stuffy, and coughing now and then.',
  cough: 'The reader is nearly over a cold, with a dry cough that comes and goes.'
}

/**
 * The line saying how a girl's cold stands in global slot `slot`, or null where it does not show.
 * `phone` is a prompt that writes her texts, which may otherwise have her call off a plan the app
 * is still holding her to.
 */
export function herColdLine(
  firstName: string,
  cold: ColdCase | undefined,
  slot: number,
  phone = false
): string | null {
  const stage = coldStageAt(cold, slot)
  if (stage === null || stage === 'incubating') return null
  let line = HER_COLD[stage].replace('{name}', firstName)
  if (cold?.fromReader) line += ' She thinks she caught it from the reader.'
  if (phone && stage === 'worst') line += ' She still means to keep any plans she has with the reader.'
  return line
}

/** The line saying how the reader's cold stands in global slot `slot`, or null where it does not show. */
export function readerColdLine(cold: ColdCase | null | undefined, slot: number): string | null {
  const stage = coldStageAt(cold ?? undefined, slot)
  return stage === null || stage === 'incubating' ? null : READER_COLD[stage]
}
