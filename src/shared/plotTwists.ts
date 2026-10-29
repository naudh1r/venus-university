import type { ModDef, Result } from '@vx/modkit/shared'

/** Stable across the compiled mod and this source port. */
declare module './types' {
  interface GameSave {
    /** Legacy saves only; the current value lives in ex['plot-twist']. */
    exPlotTwist?: string
  }
}

export const PLOT_TWIST_MOD = 'plot-twist'
export const PLOT_TWIST_LIMIT = 10_000

export const PLOT_TWIST_DEF: ModDef = {
  id: PLOT_TWIST_MOD,
  name: 'Plot Twist',
  author: 'Maestro Leeds',
  version: '1.1.1',
  scope: 'anytime',
  defaultOn: true,
  blurb: 'Give future scenes a new story direction. Edit one ongoing twist per save from the game menu.',
  offNote: 'Your saved twist stays in the save. Turning this off stops adding it to new scene requests.'
}

/** Preserve legacy text verbatim on load, including text longer than today's editor allows. */
export function savedPlotTwist(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** New edits are bounded, never silently cut down. An empty edit clears the direction. */
export function validatePlotTwist(value: unknown): Result<string> {
  if (typeof value !== 'string' || value.length > PLOT_TWIST_LIMIT) {
    return {
      ok: false,
      error: { code: 'PLOT_TWIST_INVALID', message: 'Keep the plot twist within 10,000 characters.' }
    }
  }
  return { ok: true, data: value.trim() }
}

/** Only the prompt copy is capped; an old save's full text is never overwritten by this read. */
export function activePlotTwist(value: unknown, enabled: boolean): string {
  return enabled ? savedPlotTwist(value).trim().slice(0, PLOT_TWIST_LIMIT) : ''
}
