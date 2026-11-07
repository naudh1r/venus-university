import { describe, expect, it } from 'vitest'
import { DOCUMENT_LIMIT, readSceneDocument, restoreSceneDocument, sceneDocumentLines } from '../src/shared/sceneNotes'

describe('shared scene documents', () => {
  it('keeps the complete document up to 2 MB in the AI prompt', () => {
    const text = 'BEGIN\n' + 'x'.repeat(DOCUMENT_LIMIT - 10) + '\nEND'
    const document = readSceneDocument('notes.md', new TextEncoder().encode(text))
    expect(document.text).toBe(text)
    expect(JSON.parse(sceneDocumentLines(document)[1].slice('REFERENCE DOCUMENT '.length)).text).toBe(text)
  })
  it('restores every saved section regardless of the old selection', () => {
    const document = restoreSceneDocument({ name: 'notes.txt', sections: ['first\n', 'middle\n', 'last'] })
    expect(document).toEqual({ name: 'notes.txt', text: 'first\nmiddle\nlast' })
    expect(restoreSceneDocument(document)).toEqual(document)
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
