import { describe, expect, it, vi } from 'vitest'
import type { FileStamp } from '@shared/types'

/**
 * Whether a shipped character was edited in place before copies existed: the listing of her
 * folder, with what the last update parked, against the manifests of the builds either side.
 */
vi.mock('electron', () => ({
  app: { isPackaged: true, getAppPath: () => '', getPath: () => '', getVersion: () => '0' },
  safeStorage: {}
}))

const { isEditedCast } = await import('../src/main/services/castMigration')

const file = (size: number, sha256: string | null = null) => ({ size, sha256 })
const stamp = (rel: string, size: number, sha256: string): FileStamp => ({ rel, size, sha256 })

/** The two sprites and the record the build shipped. */
const PREV: FileStamp[] = [
  stamp('character.json', 10, 'aa'),
  stamp('expressions/happy.webp', 20, 'bb'),
  stamp('room_day.webp', 30, 'cc')
]

/** The folder as shipped, hashes taken. */
const shipped = () =>
  new Map([
    ['character.json', file(10, 'aa')],
    ['expressions/happy.webp', file(20, 'bb')],
    ['room_day.webp', file(30, 'cc')]
  ])

describe('isEditedCast', () => {
  it('reads an untouched folder as unedited, whatever stray files sit in it', () => {
    const assets = shipped()
    assets.set('Thumbs.db', file(99))
    assets.set('staging/expressions/happy.webp', file(5))
    assets.set('room_night.webp.tmp', file(5))
    expect(isEditedCast(assets, new Map(), PREV, PREV)).toBe(false)
  })

  it('catches a changed file by size, and by hash where the sizes match', () => {
    const resized = shipped().set('expressions/happy.webp', file(21, 'bb'))
    expect(isEditedCast(resized, new Map(), PREV, PREV)).toBe(true)

    const rewritten = shipped().set('character.json', file(10, 'zz'))
    expect(isEditedCast(rewritten, new Map(), PREV, PREV)).toBe(true)
  })

  it('catches a file the player added or took away', () => {
    const added = shipped().set('room_night.webp', file(40, 'dd'))
    expect(isEditedCast(added, new Map(), PREV, PREV)).toBe(true)

    const missing = shipped()
    missing.delete('room_day.webp')
    expect(isEditedCast(missing, new Map(), PREV, PREV)).toBe(true)
  })

  it('reads the parked file as the player’s when an update replaced an edited one', () => {
    // The update put a new record in place; the one it parked is what the player had, edited.
    const cur = [stamp('character.json', 11, 'a2'), ...PREV.slice(1)]
    const assets = shipped().set('character.json', file(11, 'a2'))
    const parked = new Map([['character.json', file(10, 'zz')]])
    expect(isEditedCast(assets, parked, cur, PREV)).toBe(true)

    const untouched = new Map([['character.json', file(10, 'aa')]])
    expect(isEditedCast(assets, untouched, cur, PREV)).toBe(false)
  })

  it('does not count a file the update itself added', () => {
    const cur = [...PREV, stamp('room_night.webp', 40, 'dd')]
    const assets = shipped().set('room_night.webp', file(40, 'dd'))
    expect(isEditedCast(assets, new Map(), cur, PREV)).toBe(false)
  })
})
