import { afterEach, describe, expect, it } from 'vitest'
import { setCityLifeEnabled } from '@shared/cityLife'
import { emptyLorebook, normalizedLorebook, withShippedEdit } from '@shared/lorebookRecord'
import { effectiveLorebook, LOREBOOK, lorebookBlock, placeEntryOf, rumorPoolOf } from '../src/renderer/prompts/lorebook'
import { SETTING } from '../src/renderer/prompts/setting'

afterEach(() => setCityLifeEnabled(false, false))

describe('City Life with the editable native lorebook', () => {
  it('keeps player edits on stable venue handles through normalization', () => {
    setCityLifeEnabled(true, false)
    const venue = LOREBOOK.find(entry => entry.id === 'cat_cafe')!
    const record = withShippedEdit(emptyLorebook(), venue, {
      keys: ['Moonlight Cafe'], text: 'Moonlight Cafe has a quiet upstairs reading room.'
    })
    const normalized = normalizedLorebook(record, { entries: LOREBOOK, setting: SETTING })
    const book = effectiveLorebook(normalized)
    expect(placeEntryOf(book, 'cat_cafe')).toMatchObject({
      handle: 'city_life_cat_cafe', text: 'Moonlight Cafe has a quiet upstairs reading room.'
    })
    expect(lorebookBlock('Moonlight Cafe', { book }).join('\n')).toContain('upstairs reading room')
    expect(lorebookBlock('Purr & Pour', { book }).join('\n')).not.toContain('upstairs reading room')
  })

  it('hides disabled venues from matches, direct lookups and rumors without deleting edits', () => {
    const venue = LOREBOOK.find(entry => entry.id === 'cat_cafe')!
    const record = withShippedEdit(emptyLorebook(), venue, { text: 'A saved cafe description.' })
    const book = effectiveLorebook(record), before = JSON.stringify(record)
    setCityLifeEnabled(false, false)
    expect(lorebookBlock('Purr & Pour', { book })).toEqual([])
    expect(placeEntryOf(book, 'cat_cafe')).toBeNull()
    expect(rumorPoolOf(book).some(entry => entry.id === 'cat_cafe')).toBe(false)
    setCityLifeEnabled(true, false)
    expect(lorebookBlock('Purr & Pour', { book }).join('\n')).toContain('A saved cafe description.')
    expect(rumorPoolOf(book).some(entry => entry.id === 'cat_cafe')).toBe(true)
    expect(JSON.stringify(record)).toBe(before)
  })

  it('preserves native and custom lore while City Life is disabled', () => {
    setCityLifeEnabled(false, false)
    const record = emptyLorebook()
    record.custom.push({ id: 'custom1', keys: ['Moon Club'], text: 'Moon Club meets every Thursday.' })
    const book = effectiveLorebook(record)
    expect(lorebookBlock('Moon Club at Kendall Library', { book }).join('\n')).toContain('every Thursday')
    expect(placeEntryOf(book, 'kendall_library')).not.toBeNull()
    expect(rumorPoolOf(book).some(entry => entry.handle === 'custom1')).toBe(false)
  })
})
