import { describe, expect, it } from 'vitest'
import { busyDrops, normalize } from '../src/shared/afterHours'

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
})
