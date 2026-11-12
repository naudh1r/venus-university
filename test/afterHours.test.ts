import { describe, expect, it } from 'vitest'
import { busyDrops, morningInterlude, nightOwed, normalize } from '../src/shared/afterHours'

describe('Busy invitations', () => {
  const ctx = { startedBy: 'reader' as const, answeringInvite: false }
  const hers = { initiatedBy: 'contact' as const }

  it('drops her new ask in a chat the reader started', () => {
    expect(busyDrops(hers, ctx, true)).toBe(true)
  })

  it('keeps his asks, standing invitations and chats she started', () => {
    expect(busyDrops({ initiatedBy: 'player' }, ctx, true)).toBe(false)
    expect(busyDrops(hers, { ...ctx, answeringInvite: true }, true)).toBe(false)
    expect(busyDrops(hers, { ...ctx, startedBy: 'her' }, true)).toBe(false)
    expect(busyDrops(null, ctx, true)).toBe(false)
  })

  it('keeps every verdict while Online', () => {
    expect(busyDrops(hers, ctx, false)).toBe(false)
    expect(busyDrops({ initiatedBy: 'player' }, ctx, false)).toBe(false)
    expect(busyDrops(null, ctx, false)).toBe(false)
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

  it('drops malformed completed-night markers', () => {
    for (const nightDone of [undefined, null, '14', true, 14.5, NaN, Infinity, -Infinity, {}, []]) {
      expect(normalize({ busy: true, nightDone })).toEqual({ busy: true })
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

describe('night visit save integrity', () => {
  const visit = { charId: 'girl', room: 'herRoom', morning: 14 }

  it('restores pending, slept-over and unsuccessful visits without extra fields', () => {
    for (const extra of [{}, { stayed: true, wake: ['You wake up.'] }, { stayed: false, wake: [] }]) {
      expect(normalize({ busy: true, visit: { ...visit, ...extra, other: 1 } })).toEqual({ busy: true, visit: { ...visit, ...extra } })
    }
    expect(normalize({ visit: { ...visit, room: 'hisRoom' } }).visit?.room).toBe('hisRoom')
  })

  it('drops a visit with any malformed field', () => {
    for (const visit of [null, [], {}, true, 'girl', 14]) expect(normalize({ visit }).visit).toBeUndefined()
    for (const bad of [null, { charId: '' }, { charId: '  ' }, { charId: 1 }, { room: 'elsewhere' },
      { morning: '14' }, { morning: 14.5 }, { morning: NaN }, { morning: Infinity },
      { morning: -2 }, { morning: 15 }, { stayed: 'true' }, { stayed: null }, { wake: 'hello' }, { wake: [null] }]) {
      expect(normalize({ visit: bad && { ...visit, ...bad } }).visit).toBeUndefined()
    }
  })
})

describe('morning interlude decisions after a night visit', () => {
  const morning = { date: 7, time: 0 as const }
  const visit = { charId: 'girl', room: 'herRoom' as const, morning: 14, stayed: true }

  it('holds the night until ended, including the night before graduation', () => {
    expect(morningInterlude(morning, { busy: false }, true, false)).toBe('night')
    expect(morningInterlude(morning, { busy: false }, true, true)).toBe('night')
    expect(morningInterlude(morning, { busy: false, nightDone: 14 }, true, false)).toBeNull()
  })

  it('offers Stay only in her room when free, and Head back otherwise', () => {
    expect(morningInterlude(morning, { busy: false, visit }, true, false)).toBe('stay')
    expect(morningInterlude(morning, { busy: false, visit }, false, false)).toBe('headBack')
    expect(morningInterlude(morning, { busy: false, visit: { ...visit, room: 'hisRoom' } }, true, false)).toBe('startDay')
    for (const room of ['herRoom', 'hisRoom'] as const) {
      expect(morningInterlude(morning, { busy: false, visit: { ...visit, room } }, true, true)).toBe('headBack')
    }
  })

  it('never offers another night for a begun or failed visit this morning', () => {
    for (const stayed of [undefined, false]) {
      expect(morningInterlude(morning, { busy: false, visit: { ...visit, stayed } }, true, false)).toBeNull()
    }
    expect(morningInterlude(morning, { busy: false, visit: { ...visit, morning: 12 } }, true, false)).toBe('night')
    expect(morningInterlude({ date: 0, time: 0 }, { busy: false }, true, false)).toBeNull()
    expect(morningInterlude({ date: 7, time: 1 }, { busy: false, visit }, true, false)).toBeNull()
  })
})
