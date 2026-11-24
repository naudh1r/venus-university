import { describe, expect, it } from 'vitest'
import { blockText } from '../src/shared/promptText'

/** A text block is sent as edited only while a non-blank string is stored for it. */

describe('blockText', () => {
  it('uses the edit, else the fallback', () => {
    expect(blockText({ 'scene.opening': 'mine' }, 'scene.opening', 'shipped')).toBe('mine')
    expect(blockText({ 'scene.opening': 'mine' }, 'scene.closing', 'shipped')).toBe('shipped')
    expect(blockText(undefined, 'scene.opening', 'shipped')).toBe('shipped')
  })

  it('ignores a blank or non-string value', () => {
    expect(blockText({ 'scene.opening': '  \n' }, 'scene.opening', 'shipped')).toBe('shipped')
    expect(blockText({ 'scene.opening': 5 as unknown as string }, 'scene.opening', 'shipped')).toBe('shipped')
  })
})
