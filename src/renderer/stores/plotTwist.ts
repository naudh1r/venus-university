import { modState, saveField } from '@vx/modkit/renderer'
import type { Result } from '@vx/modkit/shared'
import { PLOT_TWIST_MOD, savedPlotTwist, validatePlotTwist } from '../../shared/plotTwists'

/** Registered at renderer boot, including when the mod is switched off. */
export const plotTwist = saveField(PLOT_TWIST_MOD, {
  empty: '',
  legacy: ['exPlotTwist'],
  normalize: (stored, legacy) => savedPlotTwist(stored === undefined ? legacy.exPlotTwist : stored),
  carry: value => value
})

// A value comparison alone cannot distinguish two loaded saves with the same twist.
// The kit clears this token on every load/reset, even a reload of the same save.
export const plotTwistEditor = modState<object | null>(PLOT_TWIST_MOD, {
  initial: null,
  lifetime: 'game'
})

export function beginPlotTwistEdit(): object {
  const owner = {}
  plotTwistEditor.set(owner)
  return owner
}

/** The kit owns the save queue, safe point, checkpoint and disk-before-live transaction. */
export async function writePlotTwist(value: string, owner: object, previous: string): Promise<Result<null>> {
  const validated = validatePlotTwist(value)
  if (!validated.ok) return validated
  const stale = (): Result<null> => ({
    ok: false,
    error: { code: 'PLOT_TWIST_STALE', message: 'The loaded game changed. Reopen Plot Twist before trying again.' }
  })
  if (plotTwistEditor.get() !== owner) return stale()
  const result = await plotTwist.write(validated.data, { expect: previous })
  return plotTwistEditor.get() === owner ? result : stale()
}
