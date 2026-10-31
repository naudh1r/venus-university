import { afterEach, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from './fixtures'
import { invoke } from '../src/renderer/mods/invoke'

afterEach(restoreApi)

it('cancels a main-generated id even when the abort precedes its acknowledgement', async () => {
  let acknowledge!: (result: { ok: true; data: string }) => void
  const cancel = vi.fn(async () => ({ ok: true as const, data: undefined }))
  const result = vi.fn(async () => ({ ok: false as const, error: { code: 'CANCELLED', message: 'cancelled' } }))
  stubApi({ mods: { invokeStart: () => new Promise(resolve => { acknowledge = resolve }), invokeCancel: cancel, invokeResult: result } })
  const controller = new AbortController()
  const pending = invoke('one', 'say', [], { signal: controller.signal })
  controller.abort()
  expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
  acknowledge({ ok: true, data: 'main-made-id' })
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith('one', 'main-made-id'))
  expect(result).toHaveBeenCalledWith('one', 'main-made-id')
})

it('passes handler error Results through and hides transport exception details', async () => {
  const error = { code: 'MOD_TEST', message: 'handler refused' }
  stubApi({ mods: { invokeStart: async () => ({ ok: false, error }) } })
  expect(await invoke('one', 'say', [])).toEqual({ ok: false, error })
  stubApi({ mods: { invokeStart: async () => { throw new Error('/private/machine/path') } } })
  expect(await invoke('one', 'say', [])).toEqual({ ok: false, error: {
    code: 'MOD_INVOKE_FAILED', message: 'The mod call could not reach the main process.'
  } })
})
