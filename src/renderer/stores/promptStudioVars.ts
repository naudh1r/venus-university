import { saveField, sceneField } from '@vx/modkit/renderer'
import { PROMPT_STUDIO_MOD } from '../../shared/presets/types'
import { presetVarsWithin, readPresetVarMarks, readPresetVars, type PresetVarsMark } from '../../shared/presets/varOps'

/** The variables the model's replies keep, by name: saved with the game and carried into the next semester. */
export const presetVars = saveField<Record<string, string>>(PROMPT_STUDIO_MOD, {
  empty: {},
  legacy: ['presetVars'],
  normalize: (stored, legacy) => readPresetVars(stored ?? legacy.presetVars),
  carry: (value) => (Object.keys(value).length > 0 ? value : undefined)
})

/** Each reply of the scene being played that changed the variables, so a cut of the transcript can take them back. */
const presetVarMarks = sceneField<PresetVarsMark[]>(PROMPT_STUDIO_MOD, { empty: [] })

/** Keeps the variables a scene reply left, noting `at`, the transcript length its lines start at, and what they were before. */
export function commitPresetVars(vars: unknown, at: number): void {
  if (typeof vars !== 'object' || vars === null || Array.isArray(vars)) return
  presetVarMarks.set([...readPresetVarMarks(presetVarMarks.read()), { at, before: { ...presetVars.read() } }])
  presetVars.set(readPresetVars(vars))
}

/** Takes back what the replies past a cut of the transcript to `length` changed. */
export function cutPresetVars(length: number): void {
  const cut = presetVarsWithin(readPresetVarMarks(presetVarMarks.read()), length)
  if (!cut) return
  presetVars.set(cut.vars)
  presetVarMarks.set(cut.marks)
}
