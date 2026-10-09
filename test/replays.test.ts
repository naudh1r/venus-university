import { describe, expect, it } from 'vitest'
import { replayIdOf, replaysToDelete, type SlotReplay } from '@shared/replays'
import { sha256Hex } from '@shared/sha256'

/** A replay of one short scene; `text` sets its one spoken line. */
function replay(text = 'Hi.'): SlotReplay {
  return {
    schemaVersion: 1,
    date: 8,
    time: 0,
    cast: ['ava'],
    keys: { ava: 'ava' },
    transcript: [
      { speaker: 'reader', text: 'I wave.' },
      { speaker: 'ava', text }
    ]
  }
}

describe('replay ids', () => {
  it('are the SHA-256 of the record, so every build keeps one scene under one name', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expect(replayIdOf(replay())).toBe(sha256Hex(JSON.stringify(replay())).slice(0, 32))
  })

  it('are equal for equal scenes and differ for different ones', () => {
    expect(replayIdOf(replay())).toBe(replayIdOf(replay()))
    expect(replayIdOf(replay('Bye.'))).not.toBe(replayIdOf(replay()))
  })
})

describe('replaysToDelete', () => {
  it('keeps an id another save names or the running game holds, and takes the rest', () => {
    const [a, b, c] = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)]
    expect(replaysToDelete([a, b, c], [new Set([a])], [b])).toEqual([c])
  })
})
