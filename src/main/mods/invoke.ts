import { randomUUID } from 'crypto'
import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import { appError } from '@shared/errors'
import { runAbortable } from '@shared/jobQueue'
import type { ModSessionTable } from '@shared/modSession'

/** The main-side context of one mod call, owned by the loader. */
export interface InvokeContext {
  readonly id: string
  readonly signal: AbortSignal
}

/** One named function exported by a trusted main.js. */
export type InvokeHandler = (context: InvokeContext, ...args: unknown[]) => unknown

/** Method names follow the protocol route vocabulary. */
export const INVOKE_NAME_RULE = /^[a-z0-9]+(-[a-z0-9]+)*$/

interface Call {
  readonly id: string
  readonly owner: number
  readonly handlers: ReadonlyMap<string, InvokeHandler>
  readonly handler: InvokeHandler
  readonly args: unknown[]
  readonly controller: AbortController
  readonly lease: ReturnType<typeof setTimeout>
  claimed: boolean
}

/** Refuses an id before it can become part of main's request namespace. */
function checkedId(id: unknown): string {
  if (typeof id !== 'string' || !MOD_ID_RULE.test(id)) {
    throw appError('MOD_ID_INVALID', 'A main call was asked for without a mod id.', String(id))
  }
  return id
}

/** Main's namespace for one request; neither the group nor its request id comes from the caller. */
function keyOf(id: string, requestId: string): string {
  return `mod:${id}:invoke:${requestId}`
}

/** The cancellation answer shared by aborted calls, including handlers that finish late. */
function cancelled(): ReturnType<typeof appError> {
  return appError('CANCELLED', 'The mod call was cancelled.')
}

/** Loader-owned handlers and live calls. Only a loaded mod's own named handler can run. */
export class ModInvocations {
  private table: ModSessionTable | null = null
  private handlers: ReadonlyMap<string, ReadonlyMap<string, InvokeHandler>> = new Map()
  private readonly calls = new Map<string, Call>()

  /** Replaces the loaded handlers and aborts calls whose owner lost its loaded registration. */
  replace(table: ModSessionTable, handlers: ReadonlyMap<string, ReadonlyMap<string, InvokeHandler>>): void {
    this.table = table
    this.handlers = handlers
    for (const call of this.calls.values()) {
      if (!this.loaded(call.id) || handlers.get(call.id) !== call.handlers) call.controller.abort()
    }
  }

  /** Whether the installed mod is currently loaded, including safe-start and loader failure. */
  private loaded(id: string): boolean {
    return this.table?.safeStart === null && this.table.loaderError === null &&
      this.table.mods.some((mod) => mod.id === id && mod.def !== null && mod.status === 'loaded') === true
  }

  /** Reads the two operations on the fixed invoke channel, rejecting malformed envelopes. */
  dispatch(owner: number, modId: unknown, request: unknown): unknown {
    const id = checkedId(modId)
    const call = request as { kind?: unknown; name?: unknown; args?: unknown; requestId?: unknown } | null
    if (call?.kind === 'start') return this.start(owner, id, call.name, call.args)
    if (call?.kind === 'result') return this.finish(owner, id, call.requestId)
    throw appError('MOD_INVOKE_UNKNOWN', 'That mod call has no such operation.')
  }

  /** Checks the mod and method before allocating a main-generated request id. */
  start(owner: number, modId: unknown, name: unknown, args: unknown): string {
    const id = checkedId(modId)
    const row = this.table?.mods.find((mod) => mod.id === id && mod.def !== null)
    if (!row) throw appError('MOD_INVOKE_UNKNOWN', 'That mod has no main handler.', id)
    if (!this.loaded(id)) throw appError('MOD_INVOKE_NOT_LOADED', 'That mod is not loaded.', id)
    const handlers = this.handlers.get(id)
    const handler = typeof name === 'string' && INVOKE_NAME_RULE.test(name) && handlers?.get(name)
    if (!handler || !handlers) throw appError('MOD_INVOKE_UNKNOWN', 'That mod has no such main handler.', String(name))
    if (!Array.isArray(args)) throw appError('MOD_INVOKE_ARGS_INVALID', 'A mod call needs a list of arguments.')
    const requestId = randomUUID()
    const key = keyOf(id, requestId)
    // A window that disappears before claiming its result leaves no permanent reservation.
    const lease = setTimeout(() => {
      this.calls.get(key)?.controller.abort()
      this.calls.delete(key)
    }, 30_000)
    lease.unref()
    this.calls.set(key, { id, owner, handlers, handler, args, controller: new AbortController(), lease, claimed: false })
    return requestId
  }

  /** Claims a request once, then answers its result or cancellation under core's abortable queue. */
  async finish(owner: number, modId: unknown, requestId: unknown): Promise<unknown> {
    const id = checkedId(modId)
    const key = typeof requestId === 'string' ? keyOf(id, requestId) : ''
    const call = this.calls.get(key)
    if (!call || call.owner !== owner || call.claimed) {
      throw appError('MOD_INVOKE_UNKNOWN', 'That mod has no such main request.')
    }
    call.claimed = true
    clearTimeout(call.lease)
    try {
      if (call.controller.signal.aborted) throw cancelled()
      return await runAbortable(key, async (queueSignal) => {
        const signal = AbortSignal.any([queueSignal, call.controller.signal])
        return new Promise<unknown>((resolve, reject) => {
          const abort = (): void => reject(cancelled())
          signal.addEventListener('abort', abort, { once: true })
          // Both resolution and rejection stay observed even if the abort wins first.
          Promise.resolve().then(() => {
            if (signal.aborted) throw cancelled()
            const handler = call.handler
            return handler(Object.freeze({ id, signal }), ...call.args)
          }).then(
            (value) => signal.aborted ? reject(cancelled()) : resolve(value),
            (error: unknown) => signal.aborted ? reject(cancelled()) : reject(error)
          ).finally(() => signal.removeEventListener('abort', abort))
        })
      })
    } finally {
      this.calls.delete(key)
    }
  }

  /** Cancels only this sender's request in the checked mod's namespace; a foreign id reaches none. */
  cancel(owner: number, modId: unknown, requestId: unknown): void {
    const id = checkedId(modId)
    if (typeof requestId !== 'string') return
    const call = this.calls.get(keyOf(id, requestId))
    if (call?.owner === owner) call.controller.abort()
  }

  /** Drops a window's unclaimed reservations and cancels its in-flight calls when it leaves. */
  dropOwner(owner: number): void {
    for (const [key, call] of this.calls) {
      if (call.owner !== owner) continue
      call.controller.abort()
      clearTimeout(call.lease)
      this.calls.delete(key)
    }
  }
}
