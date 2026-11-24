import { describe, expect, it } from 'vitest'
import { defaultSettings } from '@shared/settingsRules'
import { reasoningToSend } from '@shared/providers'
import { emptyFlags, memoryStatusLine } from '@shared/relationship'
import { readerize } from '@shared/readerVoice'
import type { StructuredRequest } from '@shared/types'
import { memoryLines, profileLines } from '../src/renderer/prompts/scenePrompt'
import { relationshipLines } from '../src/renderer/prompts/relationship'
import { character } from './fixtures'

describe('0.8.0 mod prompt calls on 0.9.2', () => {
  it('keeps old profile and relationship positional arguments usable', () => {
    const who = character()
    expect(profileLines(who, emptyFlags(), 3)).toEqual([who.personality])
    expect(profileLines(who, emptyFlags())).toContain(who.personality)
    const stats = { brain: 0, body: 0, heart: 0 }
    expect(
      relationshipLines(who, emptyFlags(), true, 0, undefined, stats, undefined, undefined, false)
    ).toEqual(
      relationshipLines(who, emptyFlags(), true, 0, undefined, {
        stats,
        romanceable: true,
        readerPronouns: 'he',
        attractionGate: false
      })
    )
  })

  it('preserves legacy second-person memory status and accepts explicit new pronouns', () => {
    const entry = { type: 'liked' as const, desc: 'the reader was kind' }
    expect(memoryStatusLine('Sarah', entry).text).toContain('you were kind')
    expect(memoryStatusLine('Sam', entry, 'Alex', 'male', 'they').text).toContain('Alex was kind')
    expect(readerize('you hurt yourself')).toBe('the reader hurt himself')
    expect(readerize('you hurt yourself', 'male', 'she')).toBe('the reader hurt herself')
    expect(memoryLines(character(), [{ ...entry, date: 1 }], undefined, 'fall')).toHaveLength(2)
  })

  it('keeps legacy request reasoning floors and lets new requests select a settings row', () => {
    const settings = {
      ...defaultSettings(),
      apiProvider: 'openai' as const,
    reasoningEffort: 'low' as const,
      reasoningEfforts: { texts: 'high' as const }
    }
    const old: StructuredRequest = {
      system: '',
      user: '',
      schema: { name: 'fixture', schema: {} },
      minThinking: 'medium'
    }
    expect(reasoningToSend(settings, 'custom', old.thinking, old.minThinking)).toBe('medium')
    expect(reasoningToSend(settings, 'custom')).toBe('low')
    expect(reasoningToSend(settings, 'custom', 'texts')).toBe('high')
  })
})
