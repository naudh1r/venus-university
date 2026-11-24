import { afterEach, expect, it, vi } from 'vitest'
const wire = vi.hoisted(() => ({ on: true, invoke: vi.fn() }))
vi.mock('@vx/modkit/renderer', () => ({ invoke: (...args: unknown[]) => wire.invoke(...args), modIsOn: () => wire.on }))
const { companionGameApi } = await import('../src/renderer/screenCompanionHook')
afterEach(() => { vi.useRealTimers(); wire.on = true; wire.invoke.mockReset() })
it('reports actual sharing, resumes on pause/disable, and releases when the session closes', async () => {
  vi.useFakeTimers(); const activity = vi.fn()
  wire.invoke.mockResolvedValue({ ok: true, data: { sharing: true, checkpoint: 0, turn: null } })
  const stop = companionGameApi('session').onTurn(vi.fn(), undefined, activity)
  await vi.advanceTimersByTimeAsync(200); expect(activity).toHaveBeenLastCalledWith(true)
  wire.invoke.mockResolvedValue({ ok: true, data: { sharing: false, checkpoint: 0, turn: null } })
  await vi.advanceTimersByTimeAsync(200); expect(activity).toHaveBeenLastCalledWith(false)
  wire.on = false; await vi.advanceTimersByTimeAsync(200); expect(activity).toHaveBeenLastCalledWith(false)
  stop(); expect(activity).toHaveBeenLastCalledWith(false)
})
it('cannot reactivate a closed session from a late poll reply', async () => {
  vi.useFakeTimers(); const activity = vi.fn(); let resolve!: (reply: unknown) => void
  wire.invoke.mockImplementation(() => new Promise(done => { resolve = done }))
  const stop = companionGameApi('session').onTurn(vi.fn(), undefined, activity)
  await vi.advanceTimersByTimeAsync(200); stop()
  resolve({ ok: true, data: { sharing: true, checkpoint: 0, turn: null } })
  await vi.advanceTimersByTimeAsync(200)
  expect(activity.mock.calls).toEqual([[false]])
})
