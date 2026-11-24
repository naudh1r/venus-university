import { describe, expect, it } from 'vitest'
import { nativeDefaultPreset } from '@shared/presets/gameParts'
import { listingOf, repairedLibrary, withoutPreset } from '@shared/presets/presetLibrary'
import { toPresetFile } from '@shared/presets/presetRules'
import { planPresetRequest, presetRequestOf } from '@shared/presets/request'
import type { StructuredRequest } from '@shared/types'

const request = (): StructuredRequest => ({
  system: 'PERSONA\n\nRULES',
  user: 'NOW\n\nYOUR TURN',
  schema: { name: 'scene', schema: { type: 'object', properties: { lines: { type: 'array' } } } },
  parts: [
    { id: 'persona', role: 'system', text: 'PERSONA' },
    { id: 'jsonRules', role: 'system', text: 'RULES' },
    { id: 'now', role: 'user', text: 'NOW' },
    { id: 'yourTurn', role: 'user', text: 'YOUR TURN' }
  ],
  sceneSpot: { spot: 'opening', cast: ['Ada'] },
  logFrom: 3
})

const tag = presetRequestOf({ spot: 'opening', cast: ['Ada'] }, 'p', { mood: 'wary' }, 'Sam')

describe('a scene request with a preset applied', () => {
  it('applies the preset, then reads the model\'s variable ops back into the variables', () => {
    const plan = planPresetRequest(request(), tag, nativeDefaultPreset('default'))
    expect(plan.request).not.toHaveProperty('logFrom')
    expect(Object.keys(plan.request.schema.schema.properties as object).at(-1)).toBe('vars')
    expect(plan.request.system).toBe('PERSONA\n\nRULES')

    const reply: Record<string, unknown> = { lines: [], vars: [{ name: 'trust', op: 'add', value: '2' }, { name: '', op: 'set', value: 'x' }] }
    expect(plan.finish(reply)).toEqual({ mood: 'wary', trust: '2' })
    expect(reply).not.toHaveProperty('vars')
  })
})

describe('the preset library', () => {
  it('creates Default in an empty store and moves an active id that names nothing', () => {
    const fresh = repairedLibrary([], null)
    expect(fresh.presets).toHaveLength(1)
    expect(fresh.active).toBe(fresh.presets[0].id)
    const other = toPresetFile({ ...nativeDefaultPreset('b'), name: 'B' })
    expect(repairedLibrary([other], 'gone').active).toBe('b')
  })

  it('refuses to delete the last preset and moves the active one when it is deleted', () => {
    const a = toPresetFile({ ...nativeDefaultPreset('a'), name: 'A' })
    const b = toPresetFile({ ...nativeDefaultPreset('b'), name: 'B' })
    expect(() => withoutPreset({ active: 'a', presets: [a] }, 'a')).toThrow()
    const next = withoutPreset({ active: 'a', presets: [a, b] }, 'a')
    expect(next.active).toBe('b')
    expect(listingOf(next).presets.map((p) => p.id)).toEqual(['b'])
  })
})
