import { describe, expect, it } from 'vitest'
import { textBubbles } from '../src/shared/textBubbles'

/** A line break in one of her texts is the send button it would be on a phone. */
describe('textBubbles', () => {
  const paragraph = 'omg ok so\n\nthe lecture ran over AGAIN\nand now im starving lol'

  it('sends each line as its own bubble under strictSchema', () => {
    expect(textBubbles(paragraph, true)).toEqual([
      'omg ok so',
      'the lecture ran over AGAIN',
      'and now im starving lol'
    ])
  })

  it('leaves a text whole with the switch off, as this build always has', () => {
    expect(textBubbles(paragraph, false)).toEqual([paragraph])
  })

  it('sends nothing for a text with nothing in it, either way', () => {
    expect(textBubbles('  \n \n', true)).toEqual([])
    expect(textBubbles('   ', false)).toEqual([])
  })
})
