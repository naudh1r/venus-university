import { describe, expect, it } from 'vitest'
import { createDmLeadReader } from '../src/renderer/stores/textingStream'

describe('the DM reply lead', () => {
  it('returns the lead fields first and only once', () => {
    const reader = createDmLeadReader()
    expect(reader.feed('{"sendPhoto":true,"photoPrompt":"a \\"messages\\" sign","messages":['))
      .toEqual({ sendPhoto: true, photoPrompt: 'a "messages" sign' })
    expect(reader.feed('"hi"]}')).toBeUndefined()
  })
  it('returns nothing when messages comes first', () => {
    expect(createDmLeadReader().feed('{"messages":[],"sendPhoto":true}')).toBeUndefined()
  })
  it('waits for a key split across deltas', () => {
    const reader = createDmLeadReader()
    expect(reader.feed('{"sendPhoto":true,"mess')).toBeUndefined()
    expect(reader.feed('ages":[')).toEqual({ sendPhoto: true })
  })
  it('gives up on an unparseable prefix', () => {
    const reader = createDmLeadReader()
    expect(reader.feed('{"sendPhoto":tru,"messages":[')).toBeUndefined()
    expect(reader.feed(']}')).toBeUndefined()
  })
})
