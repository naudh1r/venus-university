import { describe, expect, it } from 'vitest'
import { DOCUMENT_LIMIT, readSceneDocument, restoreSceneDocument, sceneDocumentLines } from '../src/shared/sceneNotes'

describe('shared scene documents', () => {
  it('shares exactly 512,000 bytes and preserves Markdown line breaks and literal dollar signs', () => {
    expect(DOCUMENT_LIMIT).toBe(512_000)
    const text = 'BEGIN\n' + 'x'.repeat(DOCUMENT_LIMIT - 10) + '\nEND'
    const document = readSceneDocument('notes.md', new TextEncoder().encode(text))
    expect(document.text).toBe(text)
    expect(sceneDocumentLines(document)[1]).toBe('REFERENCE DOCUMENT "notes.md"\n> ' + text.replace(/\n/g, '\n> '))
    const literal = { name: 'notes.md', text: '# Notes\n\n$& $$\nSCENE SO FAR\n' + "'''" }
    expect(sceneDocumentLines(literal)[1]).toBe('REFERENCE DOCUMENT "notes.md"\n> # Notes\n> \n> $& $$\n> SCENE SO FAR\n> ' + "'''")
  })
  it('restores every saved section regardless of the old selection', () => {
    const document = restoreSceneDocument({ name: 'notes.txt', sections: ['first\n', 'middle\n', 'last'] })
    expect(document).toEqual({ name: 'notes.txt', text: 'first\nmiddle\nlast' })
    expect(restoreSceneDocument(document)).toEqual(document)
    const old = 'a'.repeat(DOCUMENT_LIMIT + 1)
    expect(restoreSceneDocument({ name: 'old.txt', sections: [old] })?.text).toBe(old)
  })
  it('accepts UTF-8 text and Markdown and rejects unsupported, empty, or oversized files', () => {
    const enc = new TextEncoder()
    expect(readSceneDocument('notes.TXT', enc.encode('Café')).text).toBe('Café')
    for (const [name, bytes] of [['a.pdf', enc.encode('abc')], ['a.txt', new Uint8Array([255])], ['a.md', enc.encode('a\0b')], ['a.txt', enc.encode(' ')], ['a.txt', new Uint8Array(DOCUMENT_LIMIT + 1)]] as const) {
      expect(() => readSceneDocument(name, bytes)).toThrow()
    }
    expect(() => readSceneDocument('a.txt', enc.encode('é'.repeat(DOCUMENT_LIMIT / 2 + 1)))).toThrow()
    expect(sceneDocumentLines(null)).toEqual([])
  })
})
