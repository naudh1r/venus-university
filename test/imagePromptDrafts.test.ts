import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character } from '@shared/types'
import { SHIPPED_DEFAULT_TAGS as TAGS } from '@shared/defaultTags'
import { character } from './fixtures'

/** What mods add to sprite and CG drafts: in order, only while on, and her own negatives last. */

type Drafts = typeof import('../src/shared/imagePromptDrafts')
type Prompt = typeof import('../src/shared/imagePrompt')
type Regen = typeof import('../src/shared/regenTags')

let on: Record<string, boolean> = {}

async function fresh(): Promise<{ drafts: Drafts; prompt: Prompt; regen: Regen }> {
  vi.resetModules()
  const rules = await import('../src/shared/modRules')
  rules.setSharedModRules((id) => on[id] ?? false)
  return {
    drafts: await import('../src/shared/imagePromptDrafts'),
    prompt: await import('../src/shared/imagePrompt'),
    regen: await import('../src/shared/regenTags')
  }
}

const her: Character = { ...character(), baseAppearance: ['red_hair'], negativeTags: ['hers'] }

describe('mods in a sprite or CG draft', () => {
  beforeEach(() => {
    on = { first: true, second: true, off: false }
  })
  afterEach(() => vi.resetModules())

  it('add their tags in id order whatever order they registered, only while on, before her own negatives', async () => {
    const { drafts, prompt } = await fresh()
    const kinds: string[] = []
    drafts.registerImagePromptDraft('second', {
      draft: (parts) => ({ appearance: [...parts.appearance, 'second'], negative: parts.negative })
    })
    drafts.registerImagePromptDraft('first', {
      draft: (parts, { kind }) => {
        kinds.push(kind)
        return { appearance: [...parts.appearance, 'first'], negative: [...parts.negative, 'first_no'] }
      }
    })
    drafts.registerImagePromptDraft('off', {
      draft: (parts) => ({ appearance: [...parts.appearance, 'off'], negative: parts.negative })
    })

    const sprite = prompt.spriteDraft(her, [], 'nude', TAGS)
    expect(sprite.appearance).toEqual(['red_hair', 'first', 'second'])
    expect(sprite.negative.slice(-2)).toEqual(['first_no', 'hers'])
    const cgs = prompt.cgSetDraft(her, TAGS)
    expect(cgs.appearance).toEqual(['red_hair', 'first', 'second'])
    expect(cgs.negative.slice(-2)).toEqual(['first_no', 'hers'])
    expect(kinds).toEqual(['nude', 'cg'])
  })

  it("refresh a remembered regenerate through every mod, on or off, told which it is", async () => {
    const { drafts, prompt, regen } = await fresh()
    const told: Array<[string, boolean]> = []
    drafts.registerImagePromptDraft('first', {
      draft: (parts) => parts,
      regen: (kept, _draft, isOn) => (told.push(['first', isOn]), kept)
    })
    drafts.registerImagePromptDraft('off', {
      draft: (parts) => parts,
      regen: (kept, _draft, isOn) => (told.push(['off', isOn]), { ...kept, negative: [] })
    })

    const draft = prompt.cgSetDraft(her, TAGS)
    const kept = regen.withRegenTags(draft, { kind: 'cgs', appearance: ['kept'] }, TAGS)
    expect(told).toEqual([['first', true], ['off', false]])
    if (kept.kind !== 'cgs') throw new Error('a CG set edit')
    expect(kept.appearance).toEqual(['kept'])
    expect(kept.negative).toEqual([])
    // Nothing remembered: the draft as it is, with nobody asked.
    expect(regen.withRegenTags(draft, undefined, TAGS)).toBe(draft)
  })
})
