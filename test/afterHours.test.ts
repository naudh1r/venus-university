import { describe, expect, it, vi } from 'vitest'
import { registerHooks } from '@vx/modkit/renderer'
import { charKeyOf } from '@vx/modkit/shared'
import { character } from './fixtures'
import { asleepTonight, idleAtHome, nightOwed, normalize, stagedUntil, stayOverOf } from '../src/shared/afterHours'
import '../src/renderer/mods/afterHours'

const busyStatus = vi.hoisted(() => ({ enabled: true, busy: false }))
vi.mock('@vx/modkit/renderer', () => ({
  fadeIn: () => ({}),
  modOptionOn: () => busyStatus.enabled,
  registerHooks: vi.fn(),
  saveField: () => ({ read: () => ({ busy: busyStatus.busy }) })
}))

describe('Busy restrictions on outgoing texts', () => {
  it.each(['reader', 'her'] as const)('reads the current status in a chat started by %s', startedBy => {
    const hooks = vi.mocked(registerHooks).mock.calls[0]?.[1]
    const ctx = { charId: 'contact', startedBy }

    busyStatus.enabled = true
    busyStatus.busy = false
    expect(hooks?.hangoutCheck?.(ctx)).toBe(true)

    busyStatus.busy = true
    expect(hooks?.hangoutCheck?.(ctx)).toBe(false)

    busyStatus.enabled = false
    expect(hooks?.hangoutCheck?.(ctx)).toBe(true)
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

  it.each([girl, character({ charId: 'guy', firstName: 'Alex', lastName: 'Jones', gender: 'male' })])(
    'finds $firstName in the cast in either saved room', partner => {
      const partnerKey = charKeyOf(partner.firstName, partner.lastName)
      for (const room of ['herRoom', 'hisRoom'] as const) {
        expect(stayOverOf({ stayedOverWith: partnerKey, stayedOverIn: room }, [other, partner])).toEqual({ partner, room })
      }
    }
  )

  it('keeps no stay-over when either field says none', () => {
    expect(stayOverOf({ stayedOverWith: 'none', stayedOverIn: 'herRoom' }, [girl])).toBeNull()
    expect(stayOverOf({ stayedOverWith: key, stayedOverIn: 'none' }, [girl])).toBeNull()
  })

  it('rejects an unknown key and a character outside the cast', () => {
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

describe('where the staged morning after a night together ends', () => {
  const her = (text: string) => ({ speaker: 'mia_lee', text, emotion: 'happy' })
  const lines = ['You wake beside her.', her('Pull the door shut.'), 'You walk home.', 'Campus wakes.']

  it('ends on the line the reply names as parted', () => {
    expect(stagedUntil({ lines, homeLine: 2 }, 'mia_lee')).toBe(2)
  })

  it('falls back to the line after her last words when the named line is missing or before them', () => {
    expect(stagedUntil({ lines }, 'mia_lee')).toBe(2)
    expect(stagedUntil({ lines, homeLine: 1 }, 'mia_lee')).toBe(2)
    expect(stagedUntil({ lines, homeLine: 2.5 }, 'mia_lee')).toBe(2)
    expect(stagedUntil({ lines, homeLine: 9 }, 'mia_lee')).toBe(2)
  })

  it('stages only the waking line when she says nothing', () => {
    expect(stagedUntil({ lines: ['You wake beside her.', 'You walk home.'] }, 'mia_lee')).toBe(1)
    expect(stagedUntil({ lines: ['You wake beside her.'] }, 'mia_lee')).toBe(1)
    expect(stagedUntil({}, 'mia_lee')).toBe(0)
  })
})

describe('who stays awake through the night', () => {
  it('keeps the same roll for the same character and evening', () => {
    const evenings = Array.from({ length: 32 }, (_, date) => date)
    const rolls = () => evenings.map(date => asleepTonight('sarah_adams', date, { metThisEvening: false, close: true }))
    expect(rolls()).toEqual(rolls())
  })

  it('uses the evening scene before the relationship when weighting the roll', () => {
    const evenings = Array.from({ length: 5000 }, (_, date) => date)
    const awake = (metThisEvening: boolean, close: boolean) =>
      evenings.map(date => !asleepTonight('sarah_adams', date, { metThisEvening, close }))
    const rate = (rolls: boolean[]) => rolls.filter(Boolean).length / rolls.length
    expect(rate(awake(false, false))).toBeCloseTo(0.5, 1)
    expect(rate(awake(false, true))).toBeCloseTo(0.6, 1)
    expect(rate(awake(true, true))).toBeCloseTo(0.8, 1)
    expect(awake(true, true)).toEqual(awake(true, false))
  })
})

describe('weekend availability at home', () => {
  const roll = (slot: number) => idleAtHome('sarah_adams', Math.floor(slot / 2), slot % 2 === 0 ? 0 : 1)

  it('repeats the roll for the same character and slot', () => {
    const slots = Array.from({ length: 32 }, (_, slot) => slot)
    expect(slots.map(roll)).toEqual(slots.map(roll))
  })

  it('rolls close to forty percent idle', () => {
    const slots = Array.from({ length: 5000 }, (_, slot) => slot)
    expect(slots.filter(roll).length / slots.length).toBeCloseTo(0.4, 1)
  })
})
