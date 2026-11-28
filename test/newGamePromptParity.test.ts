import { describe, expect, it } from 'vitest'
import * as classes from '../src/renderer/prompts/classPrompt'
import * as profiles from '../src/renderer/prompts/profilePrompt'
import { defaultBlockText, textingPersonaFor } from '../src/renderer/prompts/promptBlocks'
import fixture from './fixtures/upstream092PromptHashes.json'
import { newGamePromptCases, promptFingerprint } from './fixtures/newGamePromptCases'

describe('unedited prompts match official Venus University 0.9.2', () => {
  const requests = newGamePromptCases({ ...classes, ...profiles })
  it('covers the same pinned upstream cases', () => {
    expect(fixture.upstream).toBe('7615a5a6d3097c642ab07f2cf17167cb0c104bb9')
    expect(requests.map(row => row.name)).toEqual(fixture.cases.map(row => row.name))
  })
  for (const { name, sha256 } of fixture.cases) {
    it(name, () => {
      const actual = requests.find(row => row.name === name)!
      expect(promptFingerprint(actual.request)).toBe(sha256)
    })
  }
  it('keeps the complete texting persona verbatim', () => {
    expect(textingPersonaFor(undefined)).toBe(fixture.textingPersona)
  })
})

describe('persona resets respect the reader', () => {
  for (const readerPronouns of ['he', 'she', 'they'] as const) {
    for (const lessNsfwText of [false, true]) {
      it(`${readerPronouns}, lessNsfwText=${lessNsfwText}`, () => {
        for (const id of ['persona.scene', 'persona.narration'] as const) {
          expect(defaultBlockText(id, { readerPronouns, lessNsfwText }))
            .toContain(`things ${readerPronouns === 'they' ? 'the reader' : readerPronouns} does and says`)
        }
      })
    }
  }
  it('preserves a custom scene persona and the old optional-reader call', () => {
    expect(defaultBlockText('persona.scene', {
      lessNsfwText: false, readerPronouns: 'they', scenePersona: 'Custom persona'
    })).toBe('Custom persona')
    expect(defaultBlockText('persona.narration', { lessNsfwText: false }))
      .toContain('things he does and says')
  })
})
