import { appError } from '@shared/errors'
import type { Result } from '@shared/types'

/** A mod's own main handler, over the fixed invoke channel; failures always answer as a Result. */
export async function invoke<T>(
  modId: string,
  name: string,
  args: unknown[],
  options: { signal?: AbortSignal } = {}
): Promise<Result<T>> {
  const { signal } = options
  const cancelled = (): Result<T> => ({ ok: false, error: appError('CANCELLED', 'The mod call was cancelled.') })
  if (signal?.aborted) return cancelled()
  let requestId: string | undefined
  const cancel = (): void => {
    try {
      if (requestId !== undefined) void window.api.mods.invokeCancel(modId, requestId).catch(() => undefined)
    } catch { /* A lost bridge cannot prevent the local cancellation answer. */ }
  }
  let abort: (() => void) | undefined
  const aborted = new Promise<Result<T>>((resolve) => {
    if (signal) {
      abort = () => { cancel(); resolve(cancelled()) }
      signal.addEventListener('abort', abort, { once: true })
    }
  })
  const run = async (): Promise<Result<T>> => {
    try {
      const started = await window.api.mods.invokeStart(modId, name, args)
      if (!started.ok) return started
      requestId = started.data
      // An abort before main's acknowledgement still cancels that main-generated id and drains it.
      if (signal?.aborted) await window.api.mods.invokeCancel(modId, requestId)
      return await window.api.mods.invokeResult(modId, requestId) as Result<T>
    } catch {
      cancel()
      // Transport exceptions may contain paths; normal handler errors are redacted in main.
      return { ok: false, error: appError('MOD_INVOKE_FAILED', 'The mod call could not reach the main process.') }
    }
  }
  try {
    return await Promise.race([run(), aborted])
  } finally {
    if (abort) signal?.removeEventListener('abort', abort)
  }
}
