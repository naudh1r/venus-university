import { describe, expect, it, vi } from 'vitest'
import { ModInvocations, type InvokeContext, type InvokeHandler } from '../src/main/mods/invoke'
import { EMPTY_SESSION, type ModSessionTable } from '../src/shared/modSession'
import { modDefOf } from '@vx/modkit/host/shared'
import { parseManifest } from '@vx/modkit/host/shared'

/** A minimal installed session; no store or Electron object is passed to a handler. */
function table(): ModSessionTable {
  const parsed = parseManifest({ manifest: 1, id: 'one', name: 'One', author: 'test', version: '1.0.0',
    blurb: 'A test mod.', source: 'https://example.com/mod', kit: '^0.6.0', hooks: ['invoke'], main: true,
    scope: 'anytime', defaultOn: false })
  if (!parsed.ok) throw new Error(parsed.error)
  const row = { id: 'one', manifest: parsed.manifest, def: modDefOf(parsed.manifest), status: 'loaded' as const,
    message: null, warnings: [], folder: '/mod', dev: true, renderer: null, style: null }
  return { ...EMPTY_SESSION, mods: [row, { ...row, id: 'two' }, { ...row, id: 'off', status: 'failed' }], order: ['one', 'two'] }
}

/** Gives each named mod its own handler map, including an export for a failed mod. */
function server(handler: InvokeHandler): { calls: ModInvocations; session: ModSessionTable; maps: Map<string, Map<string, InvokeHandler>> } {
  const calls = new ModInvocations(), session = table()
  const maps = new Map(['one', 'two', 'off'].map(id => [id, new Map([['say', handler]])]))
  calls.replace(session, maps)
  return { calls, session, maps }
}

/** Settles pending microtasks so a deferred handler has received its context. */
const turn = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve() }

describe('main-owned mod invocations', () => {
  it('calls only the named mod, even when its switch defaults off, with an id and abort signal', async () => {
    const one = vi.fn((ctx: InvokeContext, value: unknown) => ({ id: ctx.id, value, keys: Object.keys(ctx) }))
    const two = vi.fn()
    const { calls, session, maps } = server(one)
    maps.set('two', new Map([['say', two]])); calls.replace(session, maps)
    const id = calls.start(1, 'one', 'say', ['hello'])
    expect(await calls.finish(1, 'one', id)).toEqual({ id: 'one', value: 'hello', keys: ['id', 'signal'] })
    expect(one.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
    expect(two).not.toHaveBeenCalled()
  })

  it('refuses bad ids, absent methods, failed mods and malformed arguments before calling a handler', () => {
    const handler = vi.fn(), { calls } = server(handler)
    for (const [id, name, args, code] of [
      ['one:two', 'say', [], 'MOD_ID_INVALID'], ['missing', 'say', [], 'MOD_INVOKE_UNKNOWN'],
      ['one', 'toString', [], 'MOD_INVOKE_UNKNOWN'], ['one', 'bad/name', [], 'MOD_INVOKE_UNKNOWN'],
      ['off', 'say', [], 'MOD_INVOKE_NOT_LOADED'], ['one', 'say', null, 'MOD_INVOKE_ARGS_INVALID']
    ] as const) expect(() => calls.start(1, id, name, args)).toThrow(expect.objectContaining({ code }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('keeps cancellation in the checked mod and sender namespace, and ignores a late success', async () => {
    const contexts = new Map<string, InvokeContext>(), finish = new Map<string, (value: unknown) => void>()
    const { calls } = server((ctx) => {
      contexts.set(ctx.id, ctx)
      return new Promise(resolve => finish.set(ctx.id, resolve))
    })
    const one = calls.start(1, 'one', 'say', []), two = calls.start(1, 'two', 'say', [])
    const result = calls.finish(1, 'one', one), other = calls.finish(1, 'two', two)
    const rejected = expect(result).rejects.toMatchObject({ code: 'CANCELLED' })
    await turn()
    calls.cancel(1, 'two', one); calls.cancel(2, 'one', one)
    expect(contexts.get('one')!.signal.aborted).toBe(false)
    calls.cancel(1, 'one', one)
    await rejected
    expect(contexts.get('one')!.signal.aborted).toBe(true)
    expect(contexts.get('two')!.signal.aborted).toBe(false)
    finish.get('one')!('too late'); finish.get('two')!('other')
    expect(await other).toBe('other')
  })

  it('cancels before the result handshake, on unload and when the window leaves', async () => {
    const handler = vi.fn(() => new Promise(() => {})), { calls, session, maps } = server(handler)
    const reserved = calls.start(1, 'one', 'say', [])
    calls.cancel(1, 'one', reserved)
    await expect(calls.finish(1, 'one', reserved)).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(handler).not.toHaveBeenCalled()
    const live = calls.finish(1, 'one', calls.start(1, 'one', 'say', []))
    const cancelled = expect(live).rejects.toMatchObject({ code: 'CANCELLED' })
    await turn(); session.mods[0].status = 'failed'; maps.delete('one'); calls.replace(session, maps)
    await cancelled
    const other = calls.finish(2, 'two', calls.start(2, 'two', 'say', []))
    const gone = expect(other).rejects.toMatchObject({ code: 'CANCELLED' })
    await turn(); calls.dropOwner(2); await gone
  })

  it('propagates synchronous and asynchronous handler errors to the IPC Result wrapper', async () => {
    for (const handler of [() => { throw new Error('bad') }, () => Promise.reject(new Error('bad'))]) {
      const { calls } = server(handler)
      await expect(calls.finish(1, 'one', calls.start(1, 'one', 'say', []))).rejects.toThrow('bad')
    }
  })
})
