import { describe, expect, it } from 'vitest'
import { introLines } from '../src/renderer/prompts/slotIntroPrompt'

/**
 * The schema asks for `{ text }` objects. An endpoint that answered with bare strings took a
 * whole slot down: `line.text.trim()` threw on a string, the throw escaped an async path with no
 * catch, the boundary never crossed, and the reader went on playing a scene the loop believed
 * was over.
 */
describe('introLines', () => {
  it('reads the shape the schema asks for', () => {
    expect(introLines([{ text: 'The quad is loud.' }, { text: 'She waves.' }])).toEqual([
      'The quad is loud.',
      'She waves.'
    ])
  })

  it('reads bare strings the same way', () => {
    expect(introLines(['The quad is loud.', 'She waves.'])).toEqual([
      'The quad is loud.',
      'She waves.'
    ])
  })

  it('takes a reply that mixes the two', () => {
    expect(introLines([{ text: 'One.' }, 'Two.'])).toEqual(['One.', 'Two.'])
  })

  it('drops what is neither, rather than throwing on it', () => {
    const lines = [{ text: 'Kept.' }, null, undefined, {}, 42, '  ', { text: 42 }]
    expect(introLines(lines as unknown as Parameters<typeof introLines>[0])).toEqual(['Kept.'])
  })

  it('answers nothing for a reply with no lines at all', () => {
    expect(introLines(undefined)).toEqual([])
    expect(introLines([])).toEqual([])
  })
})
