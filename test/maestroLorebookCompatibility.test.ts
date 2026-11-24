import { afterEach, describe, expect, it } from 'vitest'
import { setCityLifeEnabled } from '@shared/cityLife'
import { emptyLorebook, normalizedLorebook, withShippedEdit } from '@shared/lorebookRecord'
import { effectiveLorebook, LOREBOOK, lorebookBlock, placeEntryOf, rumorPoolOf } from '../src/renderer/prompts/lorebook'
import { SETTING } from '../src/renderer/prompts/setting'

afterEach(() => setCityLifeEnabled(false, false))

describe('City Life with the editable native lorebook', () => {
  it('keeps player edits on stable venue handles through normalization', () => {
    setCityLifeEnabled(true, false)
    const studio = LOREBOOK.find(entry => entry.id === 'dance_studio')!
    const record = withShippedEdit(emptyLorebook(), studio, {
      keys: ['Twilight Studio'], text: 'Twilight Studio hosts beginner lessons beside the river.'
    })
    const normalized = normalizedLorebook(record, { entries: LOREBOOK, setting: SETTING })
    const book = effectiveLorebook(normalized)
    expect(placeEntryOf(book, 'dance_studio')).toMatchObject({
      handle: 'city_life_dance_studio', text: 'Twilight Studio hosts beginner lessons beside the river.'
    })
    expect(lorebookBlock('Twilight Studio', { book }).join('\n')).toContain('beside the river')
    expect(lorebookBlock('Dance Studio', { book }).join('\n')).not.toContain('beside the river')
  })

  it('hides disabled venues from matches, direct lookups and rumors without deleting edits', () => {
    const studio = LOREBOOK.find(entry => entry.id === 'dance_studio')!
    const record = withShippedEdit(emptyLorebook(), studio, { text: 'A saved studio description.' })
    const book = effectiveLorebook(record), before = JSON.stringify(record)
    setCityLifeEnabled(false, false)
    expect(lorebookBlock('Dance Studio', { book })).toEqual([])
    expect(placeEntryOf(book, 'dance_studio')).toBeNull()
    expect(rumorPoolOf(book).some(entry => entry.id === 'dance_studio')).toBe(false)
    setCityLifeEnabled(true, false)
    expect(lorebookBlock('Dance Studio', { book }).join('\n')).toContain('A saved studio description.')
    expect(rumorPoolOf(book).some(entry => entry.id === 'dance_studio')).toBe(true)
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
