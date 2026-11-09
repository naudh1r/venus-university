import { describe, expect, it } from 'vitest'
import { readStudioPrompts, studioPromptsToKeep, withBlockText } from '../src/shared/presets/studioPrompts'

describe('readStudioPrompts', () => {
  it('refuses a record of another schema version', () => {
    expect(() => readStudioPrompts({ schemaVersion: 2 }, 'prompts.json')).toThrow(/schemaVersion/)
  })
})

describe('studioPromptsToKeep', () => {
  it('drops blank blocks, keeps unknown ids, and clamps the pool sizes to whole numbers in range', () => {
    const kept = studioPromptsToKeep({
      blocks: { 'persona.solo': '   ', 'persona.texting': 'Mine.', future: 'Kept.' } as never,
      classCatalog: { pe: 99, filler: -3, perMajor: 2.6 }
    })
    expect(kept.blocks).toEqual({ 'persona.texting': 'Mine.', future: 'Kept.' })
    expect(kept.classCatalog).toEqual({ pe: 20, filler: 0, perMajor: 3 })
  })

  it('drops an emptied map, and clearing the last block leaves a bare record', () => {
    const record = withBlockText({ schemaVersion: 1 }, 'persona.solo', 'Mine.')
    expect(withBlockText(record, 'persona.solo', undefined)).toEqual({ schemaVersion: 1 })
  })
})
