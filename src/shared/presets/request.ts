import type { SceneSpotTag, StructuredRequest } from '@vx/modkit/shared'
import { applyPreset } from './assemble'
import { applyVarOps, readPresetVars } from './varOps'
import type { GamePart, Preset, PresetRequest, PresetSampling } from './types'

/** One scene call made ready for the provider: the request with the preset applied, and how its reply is read. */
export interface PresetPlan {
  request: StructuredRequest
  /** The preset's samplers; the call sends them to a custom endpoint alone. */
  sampling: PresetSampling
  /**
   * Reads the reply's `vars` ops onto the variables the call began with, takes `vars` out of the
   * reply and returns the variables that result. The ops' warnings go to the log.
   */
  finish: (reply: Record<string, unknown>) => Record<string, string>
}

/**
 * What the active preset is applied with for one scene call: the variables as they stand now and
 * the names its macros fill in. A scene with no save carries `unsaved`.
 */
export function presetRequestOf(
  spot: SceneSpotTag,
  playthroughId: string | null,
  vars: Record<string, string>,
  readerName: string
): PresetRequest {
  return {
    spot: spot.spot,
    playthroughId: playthroughId ?? 'unsaved',
    vars: { ...vars },
    names: { user: readerName, char: spot.cast[0] ?? '', group: spot.cast.join(', ') }
  }
}

/** Applies a preset to a scene request, and says how its reply is read back. */
export function planPresetRequest(
  request: StructuredRequest,
  tag: PresetRequest,
  preset: Preset,
  rand: () => number = Math.random
): PresetPlan {
  const { names, vars } = tag
  const out = applyPreset(
    { system: request.system, user: request.user, schema: request.schema, parts: request.parts as GamePart[] | undefined },
    preset,
    readPresetVars(vars),
    { user: names.user, char: names.char, group: names.group, rand }
  )
  // The preset moves the user text, so an offset into the old one points at nothing.
  const { logFrom: _logFrom, ...rest } = request
  return {
    request: { ...rest, system: out.system, user: out.user, schema: out.schema },
    sampling: preset.sampling ?? {},
    finish: (reply) => {
      const result = applyVarOps(out.vars, reply.vars)
      delete reply.vars
      for (const warning of result.warnings) console.warn(`[presets] ${warning}`)
      return result.vars
    }
  }
}
