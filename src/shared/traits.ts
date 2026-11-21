import type { Character } from './types'
import { sharedModOn } from './modRules'

/**
 * Native trait vocabulary plus installed registrations. Stored strings remain open; generated
 * assignments are constrained to the request's snapshot, separately from editor presentation.
 */

/** Native traits only. Use generatedCharacterTraits() for a request, not this constant. */
export const CHARACTER_TRAITS = [
  'Mood-swings',
  'Disagreeable',
  'Good-natured',
  'Materialist',
  'Terminally Online',
  'Promiscuous',
  'High Standards'
] as const

export type NativeCharacterTrait = (typeof CHARACTER_TRAITS)[number]
/** Saved strings are open: a character must survive a missing trait provider. */
export type CharacterTrait = NativeCharacterTrait | (string & {})

/** What each trait means, shown to the character-generation call so it can judge the fit. */
export const TRAIT_DESCRIPTIONS: Readonly<Record<NativeCharacterTrait, string>> = {
  'Mood-swings':
    'affected by both positive and negative emotions more than normally',
  Disagreeable:
    'hard to get along with',
  'Good-natured':
    'easy to get along with',
  Materialist:
    'loves gifts and dislikes cheap presents',
  'Terminally Online':
    'addicted to social media or online content',
  Promiscuous:
    'hooks-up frequently and doesn\'t get jealous of their partners',
  'High Standards':
    'picky about who they\'re attracted to'
}

/** A trait's stored value and presentation. Gameplay effects use their own hooks. */
export interface CharacterTraitDefinition {
  /** Exact, permanent string stored in character.json; also its displayed label. */
  value: string
  description: string
  /** Available in the editor when installed; defaults to true, independent of its switch. */
  editor?: boolean
  /** May be assigned by generation while the owning mod is on; defaults to false. */
  generated?: boolean
  /** data-tone token; a mod supplies its matching CSS, not core. */
  tone?: string
  /** Explanation under the selected trait in the editor, and the chip's title. */
  hint?: string
}

const nativeTraits: readonly Readonly<CharacterTraitDefinition>[] = CHARACTER_TRAITS.map(value =>
  Object.freeze({ value, description: TRAIT_DESCRIPTIONS[value], editor: true, generated: true })
)
const registered = new Map<string, { modId: string; definition: Readonly<CharacterTraitDefinition> }>()

/** Register at boot, before requests/screens. Duplicate values fail loudly, never first-wins. */
export function registerCharacterTrait(modId: string, definition: CharacterTraitDefinition): () => void {
  if (!modId.trim() || !definition.value.trim() || definition.value !== definition.value.trim() ||
      !definition.description.trim()) throw new Error('A character trait needs an owner, value and description.')
  if (definition.tone !== undefined && !/^[a-z][a-z0-9-]*$/.test(definition.tone)) {
    throw new Error(`Invalid character trait tone: ${definition.tone}`)
  }
  const owner = nativeTraits.some(trait => trait.value === definition.value)
    ? 'core' : registered.get(definition.value)?.modId
  if (owner) throw new Error(`Character trait "${definition.value}" is already owned by ${owner}; ${modId} cannot register it.`)
  const entry = { modId, definition: Object.freeze({ ...definition }) }
  const value = entry.definition.value
  registered.set(value, entry)
  // Unregister metadata only. Never rewrite any saved character or relationship.
  return () => { if (registered.get(value) === entry) registered.delete(value) }
}

/** Native order, then stable owner/value order: load order cannot change the prompt prefix. */
function extensions(): { modId: string; definition: Readonly<CharacterTraitDefinition> }[] {
  return [...registered.values()].sort((a, b) => {
    const left = `${a.modId}\0${a.definition.value}`, right = `${b.modId}\0${b.definition.value}`
    return left < right ? -1 : left > right ? 1 : 0
  })
}

/** Read per generation request, then retain this snapshot through draft parsing. */
export function generatedCharacterTraits(): readonly Readonly<CharacterTraitDefinition>[] {
  return [...nativeTraits, ...extensions()
    .filter(entry => entry.definition.generated === true && sharedModOn(entry.modId))
    .map(entry => entry.definition)]
}

/** Metadata is installed even when effects are off, so saved tags retain their presentation. */
export function characterTrait(value: string): Readonly<CharacterTraitDefinition> | undefined {
  return nativeTraits.find(trait => trait.value === value) ?? registered.get(value)?.definition
}

export function traitDescription(value: string): string | undefined { return characterTrait(value)?.description }
export function traitTone(value: string): string | undefined { return characterTrait(value)?.tone }

/** Read on each editor render; never cache at module import before mod registration. */
export function characterTraitOptions(selected: readonly string[] = []): { value: string; label: string; tone?: string; hint?: string }[] {
  return [...nativeTraits, ...extensions().map(entry => entry.definition)]
    .filter(trait => trait.editor !== false || selected.includes(trait.value))
    .map(trait => ({
      value: trait.value,
      label: trait.value,
      tone: trait.tone,
      // Native chips never had description tooltips; extensions may supply their own hint.
      hint: trait.hint ?? (registered.has(trait.value) ? trait.description : undefined)
    }))
}

export function selectedTraitHints(values: readonly string[]): string[] {
  return [...new Set(values.map(value => characterTrait(value)?.hint).filter((hint): hint is string => Boolean(hint)))]
}

/** Allow offered additions; retain unknown or hidden saved tags unless the player removes them. */
export function editedCharacterTraits(current: readonly string[], next: readonly string[]): CharacterTrait[] {
  const allowed = new Set([...current, ...characterTraitOptions().map(trait => trait.value)])
  return [...new Set(next.filter(value => typeof value === 'string' && allowed.has(value)))]
}

/** A known installed trait, NOT an import/save filter or an AI-assignment policy. */
export function isCharacterTrait(value: unknown): value is CharacterTrait {
  return typeof value === 'string' && characterTrait(value) !== undefined
}

/** Does this character carry the trait? The one place a trait is tested. */
export function hasTrait(
  character: Pick<Character, 'traits'> | undefined,
  trait: CharacterTrait
): boolean {
  return Boolean(character?.traits?.includes(trait))
}
