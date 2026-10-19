import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expressionRel, profileRel } from '@shared/characterFiles'
import { character } from './fixtures'

/**
 * The browser build's shipped cast. What is defended here is the copy a first write makes: after
 * it her stored copy is what is read in place of her pack, and resetting her deletes it.
 */

const SHIPPED = 'shipped-1'

/** Enough of a WebP header for the byte sniffer; the content is the test's own. */
function webp(tag: number): Uint8Array {
  const bytes = new Uint8Array(32)
  bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
  bytes[20] = tag
  return bytes
}

vi.mock('../src/web/packs', () => ({
  isShipped: (charId: string) => charId === 'shipped-1',
  shippedCharIds: () => ['shipped-1'],
  shippedCharacter: (charId: string) => ({
    ...JSON.parse(JSON.stringify(shippedRecord)),
    charId
  }),
  shippedCharacters: () => [{ ...shippedRecord, charId: 'shipped-1' }],
  shippedRels: () => new Set(['expressions/neutral.png']),
  shippedProfileUrl: () => 'blob:profile',
  packImages: async () => new Map([['expressions/neutral.png', webp(1)]]),
  packBytes: async () => new Uint8Array(),
  buildPack: () => new Uint8Array()
}))

const shippedRecord = character({ charId: SHIPPED, firstName: 'Shipped' })

type Chars = typeof import('../src/web/chars')
type Files = typeof import('../src/web/files')
let chars: Chars
let files: Files

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  vi.stubGlobal('fetch', async () => new Response(webp(9).buffer as ArrayBuffer))
  vi.resetModules()
  chars = await import('../src/web/chars')
  files = await import('../src/web/files')
})

describe('a shipped character', () => {
  it('is read from her stored copy once a write has made one, until she is reset', async () => {
    expect((await chars.getCharacter(SHIPPED)).firstName).toBe('Shipped')
    expect(await chars.listCharacters()).toHaveLength(1)

    await chars.writeCharacter({ ...(await chars.getCharacter(SHIPPED)), firstName: 'Edited' })

    expect((await chars.getCharacter(SHIPPED)).firstName).toBe('Edited')
    const listed = await chars.listCharacters()
    expect(listed.map((c) => c.firstName)).toEqual(['Edited'])
    expect((await chars.getDefaultsStatus()).edited).toEqual([SHIPPED])
    // Her pack's images and her portrait came across with the record.
    expect(await files.imageBytes(SHIPPED, expressionRel('neutral'))).toEqual(webp(1))
    expect(await files.imageBytes(SHIPPED, profileRel())).toEqual(webp(9))

    expect((await chars.resetDefault(SHIPPED)).firstName).toBe('Shipped')
    expect((await chars.getCharacter(SHIPPED)).firstName).toBe('Shipped')
    expect((await chars.getDefaultsStatus()).edited).toEqual([])
    expect(await files.imageRels(SHIPPED)).toEqual(new Set(['expressions/neutral.png']))
  })
})
