import { describe, expect, it } from 'vitest'
import { busyDrops, nightOwed, normalize } from '../src/shared/afterHours'

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
