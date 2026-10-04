import { describe, expect, it, vi } from 'vitest'
import {
  bgNameProblem,
  isSafeBgName,
  normalizeBgName,
  readCustomBackground,
  typedBgName
} from '@shared/customBackgrounds'

/**
 * The player's own backgrounds: the name, which is a folder and a file stem on disk, a key
 * every save naming the place holds and the word the writer is offered, and the record read
 * back off disk or out of a backup.
 */

/** The code a refusal carries, or undefined where nothing was refused. */
function refusalOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (err) {
    return (err as { code?: string }).code
  }
  return undefined
}

describe('the background name', () => {
  it('is lowercased with spaces turned to underscores, and a symbol refuses it', () => {
    expect(typedBgName('Rooftop Garden ')).toBe('rooftop_garden_')
    expect(normalizeBgName('  Rooftop   Garden _')).toBe('rooftop_garden')
    expect(bgNameProblem('Rooftop Garden', new Set())).toBeNull()

    // Refused rather than stripped, so the name kept is the name typed.
    expect(bgNameProblem("Bob's Bar", new Set())).not.toBeNull()
    expect(bgNameProblem('café', new Set())).not.toBeNull()
    expect(bgNameProblem('', new Set())).not.toBeNull()
    expect(bgNameProblem('1999', new Set())).not.toBeNull()
    expect(bgNameProblem('x'.repeat(33), new Set())).not.toBeNull()
  })

  it('refuses one taken, a Windows device and one every lookup already answers to', () => {
    expect(bgNameProblem('Quad', new Set(['quad']))).not.toBeNull()
    expect(bgNameProblem('Con', new Set())).not.toBeNull()
    expect(bgNameProblem('constructor', new Set())).not.toBeNull()
  })

  it('lets through only names the path check takes', () => {
    for (const typed of ['Rooftop Garden', 'a1', 'night club 2']) {
      expect(bgNameProblem(typed, new Set())).toBeNull()
      expect(isSafeBgName(normalizeBgName(typed))).toBe(true)
    }
    for (const unsafe of ['__proto__', 'constructor', 'nul', '../x', 'a/b', 'A', '_a', 'a__b', '']) {
      expect(isSafeBgName(unsafe)).toBe(false)
    }
  })
})

describe('readCustomBackground', () => {
  const record = {
    schemaVersion: 1,
    name: 'rooftop',
    kind: 'exterior',
    music: 'venue_edm',
    createdAt: 1
  }

  it('reads a whole record, reading a song this build lacks as none', () => {
    expect(readCustomBackground(record, 'here')).toEqual(record)

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A song a later build added costs the place nothing but its song.
    expect(readCustomBackground({ ...record, music: 'venue_jazz', extra: 1 }, 'here')).toEqual({
      schemaVersion: 1,
      name: 'rooftop',
      kind: 'exterior',
      createdAt: 1
    })
    vi.restoreAllMocks()
  })

  it('refuses a wrong version, a missing field, an unsafe name or an unknown kind', () => {
    const malformed = { code: 'BACKUP_MALFORMED', message: 'Not a backup.' }
    expect(refusalOf(() => readCustomBackground({ ...record, schemaVersion: 2 }, 'here'))).toBe(
      'BACKGROUND_SCHEMA_VERSION'
    )
    const { createdAt: _missing, ...noTime } = record
    expect(refusalOf(() => readCustomBackground(noTime, 'here'))).toBe('BACKGROUND_MALFORMED')
    expect(refusalOf(() => readCustomBackground({ ...record, name: '../x' }, 'here'))).toBe(
      'BACKGROUND_MALFORMED'
    )
    expect(
      refusalOf(() => readCustomBackground({ ...record, kind: 'rooftop' }, 'here', malformed))
    ).toBe('BACKUP_MALFORMED')
  })
})
