import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectPresetFormat, importPreset } from '../src/shared/presets/detect'
import { nativeDefaultPreset, withGameParts } from '../src/shared/presets/gameParts'
import { GAME_MARKERS, type Preset, type PresetBlock } from '../src/shared/presets/types'

/**
 * Importing SillyTavern and Marinara presets, on files trimmed from real exports: which rows come
 * out, in what order and on or off, how markers become game parts, and what is refused.
 */

function load(file: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'presetFixtures', file), 'utf8')) as unknown
}

function imported(file: string, name = file): { preset: Preset; warnings: string[] } {
  const result = importPreset(load(file), name, 'new-id')
  if (!result.ok) throw new Error(result.error)
  return result
}

const byName = (preset: Preset, part: string): PresetBlock | undefined => preset.blocks.find((b) => b.name.includes(part))
const markers = (preset: Preset): string[] => preset.blocks.flatMap((b) => (b.marker ? [b.marker] : []))

describe('SillyTavern import', () => {
  const { preset, warnings } = imported('sillytavern.json', 'Freaky.json')

  it('names the preset from its file and tags its source and id', () => {
    expect(preset).toMatchObject({ id: 'new-id', name: 'Freaky', source: 'sillytavern' })
  })

  it('takes order and enabled flags from the global prompt_order, which beats a prompt\'s own flag', () => {
    expect(byName(preset, '1st person')?.enabled).toBe(false)
    expect(byName(preset, 'Hybrid POV')?.enabled).toBe(true)
    // The other character's order turns main off; only the global one counts.
    expect(preset.blocks.find((b) => b.id === 'main')?.enabled).toBe(true)
    const names = preset.blocks.map((b) => b.name)
    expect(names.indexOf(byName(preset, 'Cinematic')!.name)).toBeLessThan(names.indexOf(byName(preset, 'Hybrid')!.name))
  })

  it('puts main right after the persona part and records it without replacing the persona', () => {
    const at = preset.blocks.findIndex((b) => b.marker === 'persona')
    expect(preset.blocks[at + 1].id).toBe('main')
    expect(preset.mainBlockId).toBe('main')
    expect(preset.mainReplacesPersona).toBe(false)
  })

  it('maps markers to game parts, splits chat history in two and drops dialogue examples', () => {
    const parts = markers(preset)
    for (const marker of ['lorebook', 'reader', 'cast', 'setting', 'storySoFar', 'sceneSoFar'] as const) {
      expect(parts.filter((m) => m === marker)).toHaveLength(1)
    }
    expect(preset.blocks.some((b) => b.name.includes('Chat Examples'))).toBe(false)
    expect(warnings.some((w) => w.includes('Dialogue examples'))).toBe(true)
  })

  it('adds every game part the file does not mention: persona and rules first, your turn last', () => {
    expect([...markers(preset)].sort()).toEqual([...GAME_MARKERS].sort())
    expect(preset.blocks[0].marker).toBe('persona')
    expect(preset.blocks[2].marker).toBe('jsonRules')
    expect(markers(preset).at(-1)).toBe('yourTurn')
  })

  it('turns off blocks that conflict, with a reason, and keeps the ones that fit', () => {
    for (const name of ['Time and Place', 'Icebreaker', 'Internal States']) {
      const block = byName(preset, name)
      expect(block?.enabled, name).toBe(false)
      expect(block?.conflict, name).toBeTruthy()
    }
    expect(byName(preset, 'Cinematic')).toMatchObject({ enabled: true })
    expect(byName(preset, 'Cinematic')?.conflict).toBeUndefined()
  })

  it('keeps a prompt outside the order, off', () => {
    expect(byName(preset, 'Debug Engine')?.enabled).toBe(false)
  })

  it('imports an in-chat prompt as a depth block in the user role', () => {
    expect(byName(preset, 'BOLT')).toMatchObject({ position: 'depth', depth: 0, role: 'user', enabled: true })
  })

  it('keeps regex scripts off and only the samplers that are set', () => {
    expect(preset.regex?.length).toBe(2)
    expect(preset.regex?.every((r) => !r.enabled)).toBe(true)
    expect(preset.sampling).toEqual({ temperature: 0.85, topP: 0.92 })
  })
})

describe('Marinara import', () => {
  it('reads string booleans, the section order and the marker types', () => {
    const { preset } = imported('marinaraVoyage.json')
    expect(preset).toMatchObject({ name: 'Voyage trimmed', source: 'marinara' })
    expect(byName(preset, 'Second Person')?.enabled).toBe(true)
    expect(byName(preset, 'Third Person')?.enabled).toBe(false)
    expect([...markers(preset)].sort()).toEqual([...GAME_MARKERS].sort())
    const parts = markers(preset)
    expect(parts.indexOf('lorebook')).toBeLessThan(parts.indexOf('reader'))
    expect(preset.blocks.some((b) => b.name.includes('Chat Examples'))).toBe(false)
  })

  it('has no main block when Marinara\'s main section is empty', () => {
    const { preset } = imported('marinaraVoyage.json')
    expect(preset.mainBlockId).toBeUndefined()
    expect(preset.mainReplacesPersona).toBeUndefined()
    expect(preset.blocks.some((b) => b.id === 'main')).toBe(false)
  })

  it('turns off the turn-order rule and hidden-text output as conflicts', () => {
    const { preset } = imported('marinaraVoyage.json')
    expect(byName(preset, 'Turn Order')).toMatchObject({ enabled: false, conflict: expect.any(String) })
    expect(byName(preset, 'Hidden Text')).toMatchObject({ enabled: false, conflict: expect.any(String) })
    expect(byName(preset, 'Gemma Agency')?.enabled).toBe(true)
  })

  it('takes the main section as the main block, fills in chosen variables and drops empty choices', () => {
    const { preset, warnings } = imported('marinaraFrankenstein.json')
    expect(preset.mainBlockId).toBe('main')
    const at = preset.blocks.findIndex((b) => b.marker === 'persona')
    expect(preset.blocks[at + 1].id).toBe('main')
    expect(byName(preset, 'POV')?.content).not.toContain('{{POV}}')
    expect(byName(preset, 'POV')?.content).toContain('POV')
    expect(byName(preset, 'Twitter')).toBeUndefined()
    expect(warnings.some((w) => w.includes('nothing chosen'))).toBe(true)
    expect(preset.sampling).toEqual({ temperature: 1, topP: 1 })
    expect(byName(preset, 'Time and Place')?.enabled).toBe(false)
  })

  it('imports a depth section with its depth', () => {
    const { preset } = imported('marinaraFrankenstein.json')
    expect(byName(preset, 'CHAIN OF THOUGHT')).toMatchObject({ position: 'depth', depth: 0, role: 'user' })
  })
})

describe('importPreset refusals', () => {
  it('reads either format by its shape and refuses anything else without throwing', () => {
    expect(detectPresetFormat(load('sillytavern.json'))).toBe('sillytavern')
    expect(detectPresetFormat(load('marinaraVoyage.json'))).toBe('marinara')
    for (const bad of [null, 'text', 7, [], {}, { prompts: 'x' }, { type: 'marinara_preset' }, { data: { sections: 'x' } }]) {
      const result = importPreset(bad, 'bad.json', 'id')
      expect(result.ok).toBe(false)
    }
  })

  it('survives a preset whose entries are the wrong shape', () => {
    const result = importPreset({ prompts: [null, 3, { identifier: 7 }, { identifier: 'a', content: 4 }], prompt_order: 'x' }, 'odd.json', 'id')
    expect(result.ok).toBe(true)
  })
})

describe('the default preset', () => {
  it('holds every game part in shipped order and nothing else', () => {
    const preset = nativeDefaultPreset('default')
    expect(preset).toMatchObject({ id: 'default', name: 'Default', source: 'native' })
    expect(markers(preset)).toEqual([...GAME_MARKERS])
    expect(preset.blocks).toHaveLength(GAME_MARKERS.length)
    expect(withGameParts(preset.blocks)).toEqual(preset.blocks)
  })
})
