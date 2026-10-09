import { describe, expect, it } from 'vitest'
import {
  BUILD,
  buildLine,
  cleanSwitches,
  missingRequirement,
  modNames,
  modOn,
  MODS,
  modsOn,
  NO_SWITCHES,
  optionOn,
  PHOTO_FEATURE,
  photoSwitchesOf,
  playthroughMods,
  switchedOn,
  withMod,
  withOption,
  withPhotoSettingsCarried,
  type ModDef
} from '@shared/mods'

const base = { author: 'a', version: '1.0.0', blurb: '' }

/** A small list with each shape a mod can have. */
const LIST: readonly ModDef[] = [
  { ...base, id: 'free', name: 'Free', scope: 'anytime', defaultOn: true },
  { ...base, id: 'quiet', name: 'Quiet', scope: 'anytime', defaultOn: false },
  { ...base, id: 'places', name: 'Places', scope: 'playthrough', defaultOn: true },
  {
    ...base,
    id: 'work',
    name: 'Work',
    scope: 'playthrough',
    defaultOn: true,
    requires: ['places'],
    options: [{ id: 'raises', label: 'Raises', hint: '', default: true }]
  },
  {
    ...base,
    id: 'look',
    name: 'Look',
    scope: 'anytime',
    defaultOn: false,
    options: [
      { id: 'red', label: 'Red', hint: '', default: true, group: 'colour' },
      { id: 'blue', label: 'Blue', hint: '', default: false, group: 'colour' },
      { id: 'big', label: 'Big', hint: '', default: false }
    ]
  }
]

describe('the shipped list', () => {
  it('gives every mod an id of its own that can go in a file', () => {
    const ids = MODS.map((mod) => mod.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('only requires mods it has', () => {
    for (const mod of MODS) {
      for (const needed of mod.requires ?? []) expect(MODS.some((m) => m.id === needed)).toBe(true)
    }
  })

  it('has the Photo Feature on until it is switched off', () => {
    expect(modOn(NO_SWITCHES, 'photo-feature')).toBe(true)
    expect(modOn(withMod(NO_SWITCHES, 'photo-feature', false), 'photo-feature')).toBe(false)
  })
})

describe('modOn', () => {
  it('answers a default until the switch is touched', () => {
    expect(modOn(NO_SWITCHES, 'free', null, LIST)).toBe(true)
    expect(modOn(NO_SWITCHES, 'quiet', null, LIST)).toBe(false)
    expect(modOn(withMod(NO_SWITCHES, 'quiet', true), 'quiet', null, LIST)).toBe(true)
  })

  it('is off for a mod the build does not have', () => {
    expect(modOn(withMod(NO_SWITCHES, 'gone', true), 'gone', null, LIST)).toBe(false)
  })

  it('is off while something it requires is off, and back when that returns', () => {
    const without = withMod(NO_SWITCHES, 'places', false)
    expect(switchedOn(without, 'work', LIST)).toBe(true)
    expect(modOn(without, 'work', null, LIST)).toBe(false)
    expect(missingRequirement(without, 'work', LIST)?.id).toBe('places')
    expect(modOn(withMod(without, 'places', true), 'work', null, LIST)).toBe(true)
  })

  it('reads a playthrough mod off the playthrough it is asked about', () => {
    const off = withMod(NO_SWITCHES, 'places', false)
    // Started with it: on, whatever the switch says now.
    expect(modOn(off, 'places', { mods: ['places'] }, LIST)).toBe(true)
    // Started without it, or before the list existed: off, whatever the switch says now.
    expect(modOn(NO_SWITCHES, 'places', { mods: [] }, LIST)).toBe(false)
    expect(modOn(NO_SWITCHES, 'places', {}, LIST)).toBe(false)
    // No playthrough in hand: what a new one would get.
    expect(modOn(NO_SWITCHES, 'places', null, LIST)).toBe(true)
  })

  it('reads an anytime mod off its switch, whatever the playthrough names', () => {
    expect(modOn(withMod(NO_SWITCHES, 'free', false), 'free', { mods: ['free'] }, LIST)).toBe(false)
  })

  it('does not hang on mods that require each other', () => {
    const circle: ModDef[] = [
      { ...base, id: 'a', name: 'A', scope: 'anytime', defaultOn: true, requires: ['b'] },
      { ...base, id: 'b', name: 'B', scope: 'anytime', defaultOn: true, requires: ['a'] }
    ]
    expect(modOn(NO_SWITCHES, 'a', null, circle)).toBe(true)
  })
})

describe('options', () => {
  it('answers a default until set, and off for one nobody declared', () => {
    expect(optionOn(NO_SWITCHES, 'work', 'raises', LIST)).toBe(true)
    expect(optionOn(withOption(NO_SWITCHES, 'work', 'raises', false), 'work', 'raises', LIST)).toBe(false)
    expect(optionOn(NO_SWITCHES, 'work', 'nothing', LIST)).toBe(false)
  })

  it('keeps one of a group on: picking one turns the others off', () => {
    const blue = withOption(NO_SWITCHES, 'look', 'blue', true, LIST)
    expect(optionOn(blue, 'look', 'blue', LIST)).toBe(true)
    expect(optionOn(blue, 'look', 'red', LIST)).toBe(false)
    expect(optionOn(blue, 'look', 'big', LIST)).toBe(false)
    expect(withOption(blue, 'look', 'blue', false, LIST)).toBe(blue)
  })
})

describe("Photo Feature's switches", () => {
  it('are on, generating, and the bunny until touched', () => {
    expect(photoSwitchesOf(NO_SWITCHES)).toEqual({
      on: true,
      photos: true,
      explicit: true,
      loader: 'bunny',
      webp: true
    })
  })

  it('follow the Mods screen', () => {
    let switches = withMod(NO_SWITCHES, PHOTO_FEATURE, false)
    switches = withOption(switches, PHOTO_FEATURE, 'photos', false)
    switches = withOption(switches, PHOTO_FEATURE, 'loader-dots', true)
    switches = withOption(switches, PHOTO_FEATURE, 'webp', false)
    expect(photoSwitchesOf(switches)).toEqual({
      on: false,
      photos: false,
      explicit: true,
      loader: 'dots',
      webp: false
    })
  })

  it('carry over what Settings had, until the Mods screen has its own', () => {
    const carried = withPhotoSettingsCarried(NO_SWITCHES, { photos: false, photoLoader: 'shimmer' })
    expect(photoSwitchesOf(carried)).toMatchObject({ photos: false, loader: 'shimmer' })
    const moved = withOption(withOption(NO_SWITCHES, PHOTO_FEATURE, 'photos', true), PHOTO_FEATURE, 'loader-dots', true)
    expect(withPhotoSettingsCarried(moved, { photos: false, photoLoader: 'shimmer' })).toBe(moved)
    expect(withPhotoSettingsCarried(NO_SWITCHES, {})).toBe(NO_SWITCHES)
  })
})

describe('a new playthrough', () => {
  it('names the playthrough mods that are on, and no others', () => {
    expect(playthroughMods(NO_SWITCHES, LIST)).toEqual(['places', 'work'])
    expect(playthroughMods(withMod(NO_SWITCHES, 'places', false), LIST)).toEqual([])
    expect(playthroughMods(NO_SWITCHES)).toEqual([])
  })
})

describe('what the build says of itself', () => {
  it('counts the mods that are on', () => {
    expect(modsOn(NO_SWITCHES, LIST).map((mod) => mod.id)).toEqual(['free', 'places', 'work'])
    expect(buildLine(NO_SWITCHES, LIST)).toBe(`${BUILD.name} ${BUILD.version} · 3 mods on · unofficial`)
    expect(buildLine(withMod(withMod(NO_SWITCHES, 'places', false), 'quiet', false), LIST)).toBe(
      `${BUILD.name} ${BUILD.version} · 1 mod on · unofficial`
    )
  })

  it('names every mod for the log', () => {
    expect(modNames(LIST.slice(0, 2))).toBe('Free 1.0.0, Quiet 1.0.0')
  })
})

describe('cleanSwitches', () => {
  it('keeps yes and no, and drops everything else', () => {
    expect(cleanSwitches({ on: { a: true, b: 'yes', c: false }, options: { 'a:x': false, y: 1 }, more: 1 })).toEqual({
      on: { a: true, c: false },
      options: { 'a:x': false }
    })
  })

  it('makes an empty set of anything that is not one', () => {
    for (const value of [null, undefined, 3, 'on', [], { on: [true] }]) {
      expect(cleanSwitches(value)).toEqual({ on: {}, options: {} })
    }
  })
})
