import { describe, expect, it } from 'vitest'
import { charKeyOf } from '@vx/modkit/shared'
import { character } from './fixtures'
import { busyPromptApplies, nightOwed, normalize, stayOverOf } from '../src/shared/afterHours'

describe('Busy restrictions on chats the reader starts', () => {
  it('restricts his chat while Busy and leaves her chat unchanged', () => {
    expect(busyPromptApplies(true, 'reader')).toBe(true)
    expect(busyPromptApplies(true, 'her')).toBe(false)
  })

  it('leaves either opener unrestricted while Online', () => {
    expect(busyPromptApplies(false, 'reader')).toBe(false)
    expect(busyPromptApplies(false, 'her')).toBe(false)
  })
})

describe('saved status', () => {
  it('reads missing or malformed data as Online', () => {
    for (const stored of [undefined, null, false, true, 1, 'busy', [], {}, { busy: 'true' }, { busy: 1 }]) {
      expect(normalize(stored)).toEqual({ busy: false })
    }
  })

  it('keeps an explicit Busy or Online status', () => {
    expect(normalize({ busy: true })).toEqual({ busy: true })
    expect(normalize({ busy: false })).toEqual({ busy: false })
  })

  it('keeps a whole-number completed night alongside the phone status', () => {
    expect(normalize({ busy: true, nightDone: 14 })).toEqual({ busy: true, nightDone: 14 })
    expect(normalize({ nightDone: 0 })).toEqual({ busy: false, nightDone: 0 })
  })

  it('drops an old visit while keeping the phone status and completed night', () => {
    expect(normalize({ busy: true, nightDone: 14, visit: {
      charId: 'girl', room: 'herRoom', morning: 14, stayed: true, scened: true
    } })).toEqual({ busy: true, nightDone: 14 })
  })

  it('drops malformed completed-night markers', () => {
    for (const nightDone of [undefined, null, '14', true, 14.5, NaN, Infinity, -Infinity, {}, []]) {
      expect(normalize({ busy: true, nightDone })).toEqual({ busy: true })
    }
  })

  it('keeps a well-formed stay-over for the morning it ends on', () => {
    const stayOver = { charId: 'mia', room: 'herRoom', morning: 16 }
    expect(normalize({ busy: false, nightDone: 16, stayOver })).toEqual({ busy: false, nightDone: 16, stayOver })
    expect(normalize({ stayOver: { charId: 'mia', room: 'hisRoom', morning: 16, extra: 1 } }))
      .toEqual({ busy: false, stayOver: { charId: 'mia', room: 'hisRoom', morning: 16 } })
  })

  it('drops a malformed stay-over and keeps the rest', () => {
    for (const stayOver of [null, 'mia', { charId: '', room: 'herRoom', morning: 16 },
      { charId: 'mia', room: 'library', morning: 16 }, { charId: 'mia', room: 'herRoom', morning: 16.5 },
      { charId: 'mia', room: 'herRoom' }]) {
      expect(normalize({ busy: true, nightDone: 16, stayOver })).toEqual({ busy: true, nightDone: 16 })
    }
  })
})

describe('the night owed before a morning opens', () => {
  const morning = { date: 7, time: 0 as const }

  it('is owed after an evening until that night is ended', () => {
    expect(nightOwed(morning, { busy: false })).toBe(true)
    expect(nightOwed(morning, { busy: true, nightDone: 12 })).toBe(true)
    expect(nightOwed(morning, { busy: false, nightDone: 14 })).toBe(false)
  })

  it('is not owed before an evening or on the first morning of a semester', () => {
    expect(nightOwed({ date: 7, time: 1 }, { busy: false })).toBe(false)
    expect(nightOwed({ date: 0, time: 0 }, { busy: false })).toBe(false)
  })
})

describe('the stay-over named by the ending ledger', () => {
  const girl = character({ charId: 'girl', firstName: 'Sarah', lastName: 'Adams' })
  const other = character({ charId: 'other', firstName: 'Mina', lastName: 'Lee' })
  const key = charKeyOf(girl.firstName, girl.lastName)

  it('finds a girl of the cast in either room', () => {
    for (const room of ['herRoom', 'hisRoom'] as const) {
      expect(stayOverOf({ stayedOverWith: key, stayedOverIn: room }, [other, girl])).toEqual({ girl, room })
    }
  })

  it('keeps no stay-over when either field says none', () => {
    expect(stayOverOf({ stayedOverWith: 'none', stayedOverIn: 'herRoom' }, [girl])).toBeNull()
    expect(stayOverOf({ stayedOverWith: key, stayedOverIn: 'none' }, [girl])).toBeNull()
  })

  it('rejects an unknown key and a girl outside the cast', () => {
    expect(stayOverOf({ stayedOverWith: 'unknown', stayedOverIn: 'herRoom' }, [girl])).toBeNull()
    expect(stayOverOf({ stayedOverWith: key, stayedOverIn: 'herRoom' }, [other])).toBeNull()
  })

  it('keeps no stay-over with missing or malformed fields', () => {
    for (const ledger of [undefined, null, {}, { stayedOverWith: key }, { stayedOverIn: 'herRoom' },
      { stayedOverWith: 1, stayedOverIn: 'herRoom' }, { stayedOverWith: key, stayedOverIn: 'elsewhere' }]) {
      expect(stayOverOf(ledger, [girl])).toBeNull()
    }
  })
})
