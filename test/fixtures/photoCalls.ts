import type { PhotoCalls } from '../../src/renderer/stores/photoInvoke'

/** Exercises the renderer's real invoke handshake with service doubles and original arguments. */
export function photoCalls(handlers: Partial<PhotoCalls>) {
  let next = 0
  const replies = new Map<string, Promise<unknown>>()
  return { mods: {
    invokeStart: async (_id: string, name: string, args: unknown[]) => {
      const key = name.replace(/-([a-z])/g, (_all, letter: string) => letter.toUpperCase()) as keyof PhotoCalls
      const handler = handlers[key] as ((...args: unknown[]) => unknown) | undefined
      if (!handler) return { ok: false as const, error: { code: 'MOD_INVOKE_UNKNOWN', message: name } }
      const request = String(++next)
      replies.set(request, Promise.resolve(handler(...args)))
      return { ok: true as const, data: request }
    },
    invokeResult: async (_id: string, request: string) => await replies.get(request) as never,
    invokeCancel: async () => ({ ok: true as const, data: undefined })
  } }
}
