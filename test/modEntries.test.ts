import { describe, expect, it } from 'vitest'
import type { ModDef } from '../src/shared/mods'

/**
 * The mod list is found, not written: each mod's entry is a file named for its id. A file whose
 * name and id disagree would list one mod under another's name, so the two are held together.
 */

const SHARED = import.meta.glob<ModDef>('../src/shared/modEntries/*.ts', {
  eager: true,
  import: 'default'
})
const RENDERER = Object.keys(import.meta.glob('../src/renderer/modEntries/*.ts'))

const idOf = (file: string): string => file.replace(/^.*\//, '').replace(/\.ts$/, '')

describe('mod entries', () => {
  it('name each file for the mod it defines', () => {
    for (const [file, mod] of Object.entries(SHARED)) expect(mod.id).toBe(idOf(file))
  })

  it('give hooks only to mods that have an entry', () => {
    const ids = new Set(Object.values(SHARED).map((mod) => mod.id))
    for (const file of RENDERER) expect(ids.has(idOf(file))).toBe(true)
  })

  it('list the mods by id', async () => {
    const { MODS } = await import('../src/shared/mods')
    const ids = MODS.map((mod) => mod.id)
    expect(ids).toEqual([...ids].sort())
    expect(new Set(ids).size).toBe(ids.length)
  })
})
