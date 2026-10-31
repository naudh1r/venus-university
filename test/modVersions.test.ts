import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import { EMPTY_SESSION, type ModSessionEntry, type ModStatus } from '@shared/modSession'
import type { PlaythroughRecord } from '@shared/types'
import { stubApi } from './fixtures'

/**
 * What entering a game says of the mods its record names: a `playthrough` mod that is not running,
 * with the version the game was played with where the installed one is another; and, once a
 * playthrough, that a record holding no versions was started before mods recorded them.
 */

const keptOnDisk = vi.fn(async (_playthroughId: string) => ({ ok: true as const, data: undefined }))
stubApi({ mods: { unversionedSeen: keptOnDisk } })
const { useModSessionStore } = await import('../src/renderer/stores/modSessionStore')

function def(id: string, version: string): ModDef {
  return { id, name: id, author: 'test', version, scope: 'playthrough', defaultOn: true, blurb: '' }
}

function row(id: string, version: string, status: ModStatus): ModSessionEntry {
  return {
    id,
    manifest: { id, name: id, version } as ModSessionEntry['manifest'],
    def: def(id, version),
    status,
    message: status === 'loaded' ? null : 'it failed to start',
    warnings: [],
    folder: '',
    dev: false,
    renderer: null,
    style: null
  }
}

beforeAll(() => installMods([def('work', '2.0.0'), def('places', '1.0.0')]))

beforeEach(() => {
  useModSessionStore.setState({
    table: { ...EMPTY_SESSION, mods: [row('work', '2.0.0', 'failed'), row('places', '1.0.0', 'loaded')], order: ['places'] },
    shiftStart: false,
    notice: null,
    unversionedTold: new Set()
  })
  keptOnDisk.mockClear()
})

const enter = (record: Pick<PlaythroughRecord, 'mods' | 'modVersions'>, id: string, seen: string[] = []): void =>
  useModSessionStore.getState().gameEntered(record, id, seen)
const notice = (): ReturnType<typeof useModSessionStore.getState>['notice'] => useModSessionStore.getState().notice

describe('a game started before mods recorded their versions', () => {
  it('is said once a playthrough and kept on disk, and never refuses the game', () => {
    enter({}, 'p1')
    expect(notice()).toEqual({ kind: 'unversioned', mods: [] })
    useModSessionStore.getState().dismissNotice()
    enter({ mods: ['places'] }, 'p1')
    expect(notice()).toBeNull()
    enter({}, 'p3', ['p3'])
    expect(notice()).toBeNull()
    enter({ mods: ['places'] }, 'p2')
    expect(notice()?.kind).toBe('unversioned')
    expect(keptOnDisk.mock.calls).toEqual([['p1'], ['p2']])
  })

  it('is folded into the game notice when that is up, with no version to name', () => {
    enter({ mods: ['work'] }, 'p1')
    expect(notice()).toEqual({ kind: 'game', mods: [expect.objectContaining({ id: 'work' })], unversioned: true })
  })

  it('waits for a later entry rather than replace a notice already up', () => {
    useModSessionStore.setState({ notice: { kind: 'start', mods: [] } })
    enter({}, 'p1')
    expect(notice()?.kind).toBe('start')
    expect(keptOnDisk).not.toHaveBeenCalled()
    useModSessionStore.getState().dismissNotice()
    enter({}, 'p1')
    expect(notice()?.kind).toBe('unversioned')
  })
})

describe('a game whose record holds the versions', () => {
  it('says nothing when every mod it names is running', () => {
    enter({ mods: ['places'], modVersions: { places: '0.9.0' } }, 'p1')
    expect(notice()).toBeNull()
  })

  it('says nothing of a game started with no mod on', () => {
    enter({ modVersions: {} }, 'p1')
    expect(notice()).toBeNull()
  })

  it('names the version the game was played with where the installed one is another', () => {
    enter({ mods: ['work'], modVersions: { work: '1.4.0', places: '1.0.0' } }, 'p1')
    expect(notice()).toEqual({ kind: 'game', mods: [expect.objectContaining({ id: 'work' })], playedWith: { work: '1.4.0' } })
    enter({ mods: ['work'], modVersions: { work: '2.0.0' } }, 'p1')
    expect(notice()).toEqual({ kind: 'game', mods: [expect.objectContaining({ id: 'work' })] })
  })
})
