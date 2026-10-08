import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { replayIdOf, type SlotReplay } from '@shared/replays'
import { AUTOSAVE_ID, MAX_SLOT_SAVES, type SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { enrollment, record } from './fixtures'

/**
 * The browser build's saves. What is defended here is what one write does to the rows *beside*
 * the one it is writing: the slot window, the autosave, and the enrollment a record replaces.
 */

type WebSaves = typeof import('../src/web/db/saves')
type WebPhotos = typeof import('../src/web/db/photos')
type WebReplays = typeof import('../src/web/db/replays')
let saves: WebSaves
let photos: WebPhotos
let replays: WebReplays

/** A complete sidecar, as the game would send with a photo write. */
function photoMeta(): import('@shared/photos').PhotoMeta {
  return {
    schemaVersion: 1,
    date: 1,
    time: 0,
    rows: [],
    prompt: 'A photo.',
    options: { aspectRatio: '16:9' }
  }
}

/** A complete draft — every field the loader requires — as a fresh store writes one. */
function draft(over: Partial<SaveDraft> = {}): SaveDraft {
  return { ...useGameStore.getState().toGameSave(), ...over }
}

beforeEach(async () => {
  // A fresh factory is an empty database, and a fresh module is a fresh handle onto it.
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
  saves = await import('../src/web/db/saves')
  photos = await import('../src/web/db/photos')
  replays = await import('../src/web/db/replays')
})

describe('the slot-boundary write', () => {
  it('prunes the window back and leaves the autosave standing', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), playthroughId)
    await saves.writeAutosave(playthroughId, draft())

    for (let i = 0; i < MAX_SLOT_SAVES + 2; i++) {
      await saves.writeSlotSave(playthroughId, draft())
    }

    const listing = await saves.listSaves(playthroughId)
    expect(listing.saves.map((entry) => entry.saveId)).toContain(AUTOSAVE_ID)
    expect(listing.saves).toHaveLength(MAX_SLOT_SAVES + 1)
  })

  it('never counts, and so never prunes, a manual save', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), playthroughId)
    await saves.writeManualSave(playthroughId, 1, draft({ date: 4 }))

    for (let i = 0; i < MAX_SLOT_SAVES + 2; i++) {
      await saves.writeSlotSave(playthroughId, draft())
    }

    await expect(saves.loadSave(playthroughId, 'manual01')).resolves.toMatchObject({ date: 4 })
    const listing = await saves.listSaves(playthroughId)
    expect(listing.saves).toHaveLength(MAX_SLOT_SAVES + 1)
  })
})

describe('manual saves', () => {
  it('round-trip through the listing, after the boundary saves', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    const { save } = await saves.createPlaythrough(record(), draft(), playthroughId)
    await saves.writeManualSave(playthroughId, 12, draft({ date: 5 }))
    await saves.writeManualSave(playthroughId, 2, draft({ date: 4 }))

    const listing = await saves.listSaves(playthroughId)
    expect(listing.saves.map((entry) => entry.saveId)).toEqual([
      save.saveId,
      'manual02',
      'manual12'
    ])
    expect(listing.saves[1].summary).toMatchObject({ date: 4, midScene: false })
    await expect(saves.readSave(playthroughId, 'manual12')).resolves.toMatchObject({
      record: { chars: record().chars },
      save: { saveId: 'manual12', date: 5 }
    })
  })

  it('stand for the playthrough when one was written last', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft({ date: 1 }), playthroughId)
    await saves.writeSlotSave(playthroughId, draft({ date: 2 }))
    await saves.writeAutosave(playthroughId, draft({ date: 3 }))
    // A clock tick, so the manual save's `saveDate` is the newest.
    await new Promise((resolve) => setTimeout(resolve, 5))
    await saves.writeManualSave(playthroughId, 4, draft({ date: 7 }))

    const [summary] = await saves.listPlaythroughs()
    expect(summary).toMatchObject({
      date: 7,
      saveCount: 2,
      manualCount: 1,
      hasAutosave: true,
      unloadable: null
    })
  })
})

describe('starting a playthrough', () => {
  it('replaces the enrollment with the record that answered it', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await expect(saves.readEnrollment(playthroughId)).resolves.toMatchObject({ chars: ['a'] })

    await saves.createPlaythrough(record(), draft(), playthroughId)

    await expect(saves.readEnrollment(playthroughId)).rejects.toMatchObject({
      code: 'ENROLLMENT_NOT_FOUND'
    })
    await expect(saves.readPlaythroughRecord(playthroughId)).resolves.toMatchObject({
      chars: record().chars
    })
  })
})

describe('renaming a playthrough', () => {
  it('changes the record by its name alone, and a blank one gives back its place', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), playthroughId)
    const before = await saves.readPlaythroughRecord(playthroughId)

    await saves.renamePlaythrough(playthroughId, 'Spring run')
    expect(await saves.readPlaythroughRecord(playthroughId)).toEqual({
      ...before,
      name: 'Spring run'
    })
    expect((await saves.listPlaythroughs())[0]).toMatchObject({
      label: 'Spring run',
      position: 1,
      name: 'Spring run'
    })

    await saves.renamePlaythrough(playthroughId, '')
    expect(await saves.readPlaythroughRecord(playthroughId)).toEqual(before)
    expect((await saves.listPlaythroughs())[0].label).toBe('Playthrough 1')
  })

  it('is refused for a playthrough with no record, leaving its row as it was', async () => {
    const { playthroughId, enrollment: waiting } = await saves.writeEnrollment(enrollment())
    await expect(saves.renamePlaythrough(playthroughId, 'Early')).rejects.toMatchObject({
      code: 'PLAYTHROUGH_NOT_FOUND'
    })
    await expect(saves.readEnrollment(playthroughId)).resolves.toEqual(waiting)
  })
})

describe('deleting a playthrough', () => {
  it('takes its record, its saves and both of its pictures with it', async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), playthroughId)
    await saves.writeAutosave(playthroughId, draft())
    await saves.writeEndingArt(playthroughId, new Blob([new Uint8Array([1, 2, 3])]))
    await saves.writeProfilePicture(playthroughId, new Blob([new Uint8Array([4, 5, 6])]))

    const other = await saves.writeEnrollment(enrollment())
    await saves.deletePlaythrough(playthroughId)

    expect((await saves.listPlaythroughs()).map((entry) => entry.playthroughId)).toEqual([
      other.playthroughId
    ])
    expect((await saves.listSaves(playthroughId)).saves).toEqual([])
    expect(await saves.readEndingArt(playthroughId)).toBeNull()
    expect(await saves.readProfilePicture(playthroughId)).toBeNull()
  })

  it("takes its photos with it, and leaves another playthrough's alone", async () => {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), playthroughId)
    await photos.writePhoto(
      playthroughId,
      '1',
      new Blob([new Uint8Array([1, 2, 3])]),
      new Blob([new Uint8Array([4, 5, 6])]),
      photoMeta()
    )

    const other = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), other.playthroughId)
    await photos.writePhoto(
      other.playthroughId,
      '2',
      new Blob([new Uint8Array([7, 8, 9])]),
      new Blob([new Uint8Array([1, 1, 1])]),
      photoMeta()
    )

    await saves.deletePlaythrough(playthroughId)

    expect(await photos.listPhotos(playthroughId)).toEqual([])
    expect(await photos.readPhoto(playthroughId, '1')).toBeNull()
    expect((await photos.listPhotos(other.playthroughId)).map((entry) => entry.photoId)).toEqual([
      '2'
    ])
  })
})

describe('writing a photo', () => {
  it('is refused, and nothing is written, for a playthrough with no row', async () => {
    await expect(
      photos.writePhoto(
        '1700000000000',
        '1',
        new Blob([new Uint8Array([1, 2, 3])]),
        new Blob([new Uint8Array([4, 5, 6])]),
        photoMeta()
      )
    ).rejects.toMatchObject({ code: 'PHOTO_PLAYTHROUGH_GONE' })

    expect(await photos.listPhotos('1700000000000')).toEqual([])
  })
})

describe('replays', () => {
  /** A replay of one short scene; `text` sets its one spoken line, so each text is its own id. */
  function replay(text: string): SlotReplay {
    return {
      schemaVersion: 1,
      date: 8,
      time: 0,
      cast: ['ava'],
      keys: { ava: 'ava' },
      transcript: [
        { speaker: 'reader', text: 'I wave.' },
        { speaker: 'ava', text }
      ]
    }
  }
  const A = replay('A.')
  const B = replay('B.')
  const a = replayIdOf(A)
  const b = replayIdOf(B)

  /** A playthrough whose first slot save after the opening names `a`, written with it. */
  async function withReplay(): Promise<{ playthroughId: string; saveId: string }> {
    const { playthroughId } = await saves.writeEnrollment(enrollment())
    await saves.createPlaythrough(record(), draft(), playthroughId)
    const saved = await saves.writeSlotSave(playthroughId, draft({ replays: { 8: { 0: a } } }), A)
    return { playthroughId, saveId: saved.saveId }
  }

  it('lands the replay with the slot save that names it', async () => {
    const { playthroughId, saveId } = await withReplay()

    expect(await replays.listReplayIds(playthroughId)).toEqual([a])
    await expect(replays.readReplay(playthroughId, a)).resolves.toEqual(A)
    expect((await saves.loadSave(playthroughId, saveId)).replays).toEqual({ 8: { 0: a } })
  })

  it('deletes a replay only pruned saves named, and keeps one another save names', async () => {
    const { playthroughId } = await withReplay()
    await saves.writeSlotSave(playthroughId, draft({ replays: { 9: { 0: b } } }), B)
    await saves.writeAutosave(playthroughId, draft({ replays: { 9: { 0: b } } }))

    for (let i = 0; i < MAX_SLOT_SAVES; i++) await saves.writeSlotSave(playthroughId, draft())

    expect(await replays.listReplayIds(playthroughId)).toEqual([b])
  })

  it('keeps a replay through one deletion and drops it with the overwrite of the last', async () => {
    const { playthroughId, saveId } = await withReplay()
    await saves.writeAutosave(playthroughId, draft({ replays: { 8: { 0: a } } }))

    await saves.deleteSave(playthroughId, saveId)
    expect(await replays.listReplayIds(playthroughId)).toEqual([a])

    await saves.writeAutosave(playthroughId, draft())
    expect(await replays.listReplayIds(playthroughId)).toEqual([])
  })

  it('never deletes a replay the running game keeps', async () => {
    const { playthroughId, saveId } = await withReplay()

    await saves.deleteSave(playthroughId, saveId, [a])

    expect(await replays.listReplayIds(playthroughId)).toEqual([a])
  })

  it("go with their playthrough, and another playthrough's stay", async () => {
    const first = await withReplay()
    const other = await withReplay()

    await saves.deletePlaythrough(first.playthroughId)

    expect(await replays.listReplayIds(first.playthroughId)).toEqual([])
    expect(await replays.listReplayIds(other.playthroughId)).toEqual([a])
  })
})
