import { afterEach, describe, expect, it, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { setSharedModRules } from '@shared/modRules'
import { readCharacterRecord } from '@shared/characterRules'
import { portableOf } from '@shared/characterTransfer'
import {
  CHARACTER_TRAITS, TRAIT_DESCRIPTIONS, characterTraitOptions, editedCharacterTraits,
  generatedCharacterTraits, hasTrait, isCharacterTrait, registerCharacterTrait,
  selectedTraitHints, traitDescription, traitTone, type CharacterTraitDefinition
} from '@shared/traits'
// Import BEFORE registration: these consumers must not cache a partial registry at startup.
import { traitOptions } from '../src/renderer/views/characterFields'
import { TagSelect } from '../src/renderer/components/TagSelect'
import { buildCharacterPrompt, draftToCharacter, type CharacterDraft } from '../src/renderer/prompts/characterPrompt'
import { buildCharacterCard } from '../src/renderer/prompts/characterCard'
import { SUBJECT_TAGS } from '@shared/defaultTags'
import { character } from './fixtures'

const cleanups: (() => void)[] = []
function register(owner: string, definition: CharacterTraitDefinition): void {
  cleanups.push(registerCharacterTrait(owner, definition))
}
afterEach(() => { cleanups.splice(0).reverse().forEach(dispose => dispose()); setSharedModRules(() => false); vi.unstubAllGlobals() })
const poses = { standing: { tags: ['standing'], description: 'standing' } }
function request(traits = generatedCharacterTraits()) {
  return buildCharacterPrompt('Sarah', 'Rose', '', poses, 'seed', false, undefined, traits)
}
function parse(values: string[], traits = generatedCharacterTraits()) {
  return draftToCharacter(character(), { traits: values } as CharacterDraft, poses, SUBJECT_TAGS, traits).traits
}

describe('character trait registration', () => {
  it('keeps native vocabulary, descriptions and order with no registrations', () => {
    expect(generatedCharacterTraits().map(t => t.value)).toEqual(CHARACTER_TRAITS)
    expect(characterTraitOptions().map(t => t.value)).toEqual(CHARACTER_TRAITS)
    for (const value of CHARACTER_TRAITS) expect(traitDescription(value)).toBe(TRAIT_DESCRIPTIONS[value])
    expect(parse(['High Standards', 'made up', ''])).toEqual(['High Standards'])
  })

  it('reads editor options at render time and keeps an editor-only trait out of all generation paths', () => {
    // Core's current test transform uses classic JSX; the desktop build uses automatic JSX.
    vi.stubGlobal('React', React)
    setSharedModRules(() => true)
    register('sample', { value: 'Rare', description: 'An opt-in trait', tone: 'sample-gold', hint: 'Choose this deliberately.' })
    expect(traitOptions()).toContainEqual({ value: 'Rare', label: 'Rare', tone: 'sample-gold', hint: 'Choose this deliberately.' })
    expect(JSON.stringify(request())).not.toContain('Rare')
    expect(parse(['Rare', 'High Standards'])).toEqual(['High Standards'])
    expect(selectedTraitHints(['Rare'])).toEqual(['Choose this deliberately.'])
    const html = renderToStaticMarkup(createElement(TagSelect, {
      id: 'traits', values: ['Rare'], options: traitOptions(), onChange: () => {}
    }))
    expect(html).toContain('data-tone="sample-gold"')
    expect(html).toContain('Choose this deliberately.')
    expect(html).toContain('Remove Rare')
  })

  it('allows generation only with explicit permission and an active owner', () => {
    register('sample', { value: 'Inventive', description: 'Finds new approaches', generated: true })
    expect(JSON.stringify(request())).not.toContain('Inventive')
    setSharedModRules(id => id === 'sample')
    const prompt = JSON.stringify(request())
    expect(prompt).toContain('Inventive: Finds new approaches')
    expect(prompt).toContain('"Inventive"')
    expect(parse(['Inventive'])).toEqual(['Inventive'])
    setSharedModRules(() => false)
    expect(parse(['Inventive'])).toEqual([])
    expect(traitOptions().some(t => t.value === 'Inventive')).toBe(true)
  })

  it('uses the same generation snapshot after disable/unregister, without admitting a later registration', () => {
    setSharedModRules(() => true)
    const dispose = registerCharacterTrait('sample', { value: 'Offered', description: 'Offered at request time', generated: true })
    cleanups.push(dispose)
    const snapshot = generatedCharacterTraits()
    expect(JSON.stringify(request(snapshot))).toContain('Offered')
    dispose()
    register('other', { value: 'Too Late', description: 'Registered while request was pending', generated: true })
    setSharedModRules(() => false)
    expect(parse(['Offered', 'Too Late'], snapshot)).toEqual(['Offered'])
    expect(JSON.stringify(request())).not.toContain('Offered')
  })

  it('rejects duplicate values with both owners named and never replaces native definitions', () => {
    register('first', { value: 'Unique', description: 'Original' })
    expect(() => register('second', { value: 'Unique', description: 'Replacement' })).toThrow(/first; second/)
    expect(() => register('second', { value: 'High Standards', description: 'Replacement' })).toThrow(/core; second/)
    expect(traitDescription('Unique')).toBe('Original')
  })

  it('orders extensions by owner and value, and copies registration metadata', () => {
    const input = { value: 'Zulu', description: 'Original' }
    register('z-mod', input)
    register('a-mod', { value: 'Beta', description: 'B' })
    register('a-mod', { value: 'Alpha', description: 'A' })
    input.value = 'Changed'; input.description = 'Changed'
    expect(traitOptions().slice(-3).map(t => t.value)).toEqual(['Alpha', 'Beta', 'Zulu'])
    expect(traitDescription('Zulu')).toBe('Original')
  })

  it('an old disposer cannot unregister a new owner of the same value', () => {
    const dispose = registerCharacterTrait('first', { value: 'Reusable', description: 'First' })
    dispose()
    register('second', { value: 'Reusable', description: 'Second' })
    dispose()
    expect(traitDescription('Reusable')).toBe('Second')
  })

  it('retains unknown saved traits through read, edit, export and provider removal/reinstall', () => {
    const who = character({ traits: ['Missing Trait', 'High Standards'] })
    const { character: read } = readCharacterRecord(JSON.parse(JSON.stringify(who)), 'character.json')
    expect(read.traits).toEqual(who.traits)
    expect(editedCharacterTraits(read.traits, [...read.traits, 'Good-natured', 'invented'])).toEqual([...who.traits, 'Good-natured'])
    expect(portableOf(read).traits).toEqual(who.traits)
    expect(isCharacterTrait('Missing Trait')).toBe(false)
    expect(hasTrait(read, 'Missing Trait')).toBe(true)
    const dispose = registerCharacterTrait('sample', { value: 'Missing Trait', description: 'Restored metadata', tone: 'sample' })
    cleanups.push(dispose)
    expect(traitTone('Missing Trait')).toBe('sample')
    dispose()
    expect(read.traits).toEqual(who.traits)
    const card = buildCharacterCard(read, new Date(0), SUBJECT_TAGS).v2.data.description
    expect(card).toContain('Missing Trait')
    expect(card).not.toContain('undefined')
  })

  it('hides editor-disabled additions while preserving already-selected metadata and explicit removal', () => {
    register('sample', { value: 'Hidden', description: 'Saved elsewhere', editor: false, tone: 'sample' })
    expect(traitOptions().some(t => t.value === 'Hidden')).toBe(false)
    expect(traitOptions(['Hidden']).find(t => t.value === 'Hidden')?.tone).toBe('sample')
    expect(editedCharacterTraits(['Hidden'], ['Hidden', 'Mood-swings'])).toEqual(['Hidden', 'Mood-swings'])
    expect(editedCharacterTraits([], ['Hidden'])).toEqual([])
    expect(editedCharacterTraits(['Hidden'], [])).toEqual([])
  })
})
