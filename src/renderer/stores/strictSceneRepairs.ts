import { BG_UNCHANGED } from '@shared/backgroundSets'
import { parseAction } from '@shared/sceneActions'
import type { SceneLine, SceneResponse } from '@shared/types'

/**
 * Two replies in the wrong shape that an endpoint which cannot enforce the schema sends, each
 * read as what the model meant rather than dropped. Both run under `strictSchema` only; with it
 * off the reply is read exactly as this build always has.
 */

/**
 * Stage directions a model wrote as the line's own text — `{"speaker": "", "text": "cg:sex"}`
 * instead of putting it in `actions`. The cost is double: the direction never reaches the stage,
 * and the reader is shown a line of narration reading "cg:sex".
 *
 * Answers the actions to lift, or null when the text is ordinary prose.
 */
function actionsWrittenAsText(text: string): string[] | null {
  const written = text.trim()
  if (!written) return null

  // One per line, since a `sprite:` action carries a comma of its own.
  const parts = written
    .split(/[\n;]+/)
    .map((part) => part.trim())
    // "cg: sex" is the same instruction as "cg:sex" and is written both ways.
    .map((part) =>
      part.replace(
        /^(show|hide|sprite|cg)\s*:\s*/i,
        (_all, verb: string) => `${verb.toLowerCase()}:`
      )
    )
    .filter((part) => part.length > 0)

  if (parts.length === 0 || !parts.every((part) => parseAction(part) !== null)) return null
  console.warn(`[scene] a stage direction was written as a line of text — lifting it: ${written}`)
  return parts
}

/**
 * The line with any stage direction written as its text moved into its actions, behind the ones
 * it already carried. The line itself is left blank and attributed to nobody, which makes it a
 * silent line: its actions apply and playback runs straight through it, which is what the model
 * meant by writing it on its own. A line of ordinary prose comes back as it went in.
 */
export function liftWrittenActions(
  raw: Partial<SceneLine> | undefined
): Partial<SceneLine> | undefined {
  const lifted = actionsWrittenAsText(raw?.text ?? '')
  if (!lifted) return raw
  return {
    ...raw,
    speaker: '',
    text: '',
    actions: [...(raw?.actions ?? []), ...lifted]
  }
}

/**
 * The reply's lines, with a background written beside `lines` moved onto the first of them.
 * Some models put it there although the schema describes it on each line; taken as the opening
 * background and fed through the same validator, so a valid location is not lost merely because
 * the model chose the other shape. A first line that names a background of its own keeps it.
 */
export function linesWithOpeningBg(response: SceneResponse): SceneLine[] {
  const lines = response.lines ?? []
  // Not a field of the schema, so not a field of the type: read off the reply as it came.
  const openingBg = (response as { bg?: string | null }).bg
  const first = lines[0]
  if (openingBg === undefined || openingBg === null || !first) return lines
  // Covers every way a line can decline to name one: missing, null, or the enum's sentinel.
  if (first.bg != null && first.bg !== BG_UNCHANGED) return lines
  return [{ ...first, bg: openingBg }, ...lines.slice(1)]
}
