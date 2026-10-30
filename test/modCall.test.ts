import { describe, expect, it } from 'vitest'
import { cancelGroup } from '../src/shared/jobQueue'
import { cancelModCalls, completeModRequest } from '../src/shared/llm/modCall'
import type { StructuredRequest } from '../src/shared/llm/cloudLlm'

const request = { schema: { name: 'test' } } as StructuredRequest

/** A call that stays out until its signal aborts, and says whether it did. */
function heldCall(modId: unknown, group: unknown): { aborted: () => boolean; done: Promise<unknown> } {
  let signalSeen: AbortSignal | undefined
  const done = completeModRequest(
    (_request, signal) =>
      new Promise((resolve) => {
        signalSeen = signal
        signal?.addEventListener('abort', () => resolve('aborted'))
      }),
    modId,
    request,
    group
  )
  return { aborted: () => signalSeen?.aborted ?? false, done }
}

describe("a mod's own model calls", () => {
  it("are cancelled by the mod's own group alone, never by another mod's or the game's of that name", async () => {
    const mine = heldCall('my-mod', 'turn')
    const theirs = heldCall('their-mod', 'turn')

    await cancelGroup('turn')
    await cancelModCalls('their-mod', 'other')
    expect(mine.aborted()).toBe(false)
    expect(theirs.aborted()).toBe(false)

    await cancelModCalls('my-mod', 'turn')
    expect(mine.aborted()).toBe(true)
    expect(theirs.aborted()).toBe(false)
    await expect(mine.done).resolves.toBe('aborted')

    await cancelModCalls('their-mod', 'turn')
    await expect(theirs.done).resolves.toBe('aborted')
  })

  it('refuses an id no mod can have, or a group that is not a string, before anything is sent', () => {
    expect(() => heldCall('../core', 'turn')).toThrow(expect.objectContaining({ code: 'MOD_ID_INVALID' }))
    expect(() => heldCall('my-mod', 7)).toThrow(expect.objectContaining({ code: 'MOD_GROUP_INVALID' }))
    expect(() => cancelModCalls(undefined, 'turn')).toThrow(expect.objectContaining({ code: 'MOD_ID_INVALID' }))
  })
})
