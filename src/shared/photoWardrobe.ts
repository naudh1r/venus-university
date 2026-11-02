import {
  customOutfitSlotsIn,
  outfitTagsFor,
  type CustomOutfitSlot,
  type Character
} from '@vx/modkit/shared'
import { says, saysAny } from './photoWords'

/**
 * Which of her own wardrobes a photograph shows.
 *
 * Every character owns a main outfit, a PE kit and a swimsuit, and may own custom sets besides.
 * A picture of her at the pool is a picture of her swimsuit — her tags, not a swimsuit the
 * checkpoint invents — so a caption that names one of her sets, or the place or activity that
 * set is for, is drawn in it.
 */

/** Garments that can only be her swimsuit. Named outright, they win over anything else. */
const SWIM_GARMENTS = ['swimsuit', 'swimwear', 'bikini', 'one-piece', 'bathing suit']

/** Garments that can only be her PE kit. */
const PE_GARMENTS = [
  'pe kit',
  'pe uniform',
  'pe clothes',
  'gym clothes',
  'gym kit',
  'sportswear',
  'tracksuit'
]

/** Her main outfit, called what the brief calls it. */
const MAIN_NAMES = [
  ...['everyday', 'usual'].flatMap((kind) =>
    ['clothes', 'cloth', 'outfit'].map((garment) => `${kind} ${garment}`)
  ),
  ...['her', 'their'].flatMap((who) =>
    ['clothes', 'cloth', 'outfit'].flatMap((garment) => [
      `${who} ${garment}`,
      `${who} own ${garment}`
    ])
  )
]

/**
 * Where she would be in her swimsuit; used only when the caption names no clothes of its own, and
 * only where the picture may be suggestive — a swimsuit is, so an everyday picture at the pool is
 * of her in her ordinary clothes rather than one past what the gate allowed.
 */
const SWIM_PLACES = ['pool', 'poolside', 'beach', 'swimming', 'swim']

/** What she would be doing in her PE kit; the same rule. */
const PE_PLACES = [
  'pe',
  'gym',
  'workout',
  'working out',
  'running',
  'jogging',
  'training',
  'yoga',
  'stadium',
  'turf',
  'track',
  'practice'
]

/** The custom set whose name the caption says, if any. */
function namedCustomSet(character: Character, text: string): CustomOutfitSlot | null {
  for (const slot of customOutfitSlotsIn(Object.keys(character.customOutfits ?? {}))) {
    const name = character.customOutfits?.[slot]?.name?.trim().toLowerCase()
    if (name && saysAny(text, [name])) return slot
  }
  return null
}

/** A set named in the caption, with the words that stand for its tags. */
function namedWardrobe(
  character: Character,
  text: string
): { tags: readonly string[]; names: readonly string[] } | null {
  const custom = namedCustomSet(character, text)
  const name = custom && character.customOutfits?.[custom]?.name?.trim()
  if (custom && name) {
    return {
      tags: outfitTagsFor(character, custom),
      names: [name]
    }
  }
  if (saysAny(text, SWIM_GARMENTS)) {
    return { tags: outfitTagsFor(character, 'swim'), names: SWIM_GARMENTS }
  }
  if (saysAny(text, PE_GARMENTS)) {
    return { tags: outfitTagsFor(character, 'pe'), names: PE_GARMENTS }
  }
  return saysAny(text, MAIN_NAMES) ? { tags: character.outfit, names: MAIN_NAMES } : null
}

/** Only a named set whose tags dress her can replace its name in the prompt. */
export function photoWardrobeNames(character: Character, caption: string): readonly string[] {
  const set = namedWardrobe(character, caption.toLowerCase())
  return set && set.tags?.length > 0 ? set.names : []
}

/**
 * Her own wardrobe for this picture as tags, or null where the caption dresses her in something
 * none of her sets is — a towel, a bra, pyjamas — which its own words then describe.
 *
 * In order: a custom set named by its name; her swimsuit, PE kit or everyday clothes named
 * outright; the place or activity one of them is for, where the caption names no clothes of its
 * own; and otherwise her main outfit, unless the caption has dressed her itself.
 */
export function photoWardrobe(
  character: Character,
  caption: string,
  captionDressesHer: boolean,
  swimwearAllowed: boolean
): readonly string[] | null {
  const text = caption.toLowerCase()

  const named = namedWardrobe(character, text)
  if (named) return named.tags

  if (captionDressesHer) return null
  if (swimwearAllowed && saysAny(text, SWIM_PLACES)) return outfitTagsFor(character, 'swim')
  if (saysAny(text, PE_PLACES)) return outfitTagsFor(character, 'pe')
  return character.outfit
}

/** Garments a described item can identify within a set; accessories alone do not select one. */
const GARMENT_NOUNS = [
  'skirt',
  'shirt',
  'blouse',
  'sweater',
  'cardigan',
  'hoodie',
  'top',
  'dress',
  'coat',
  'jacket',
  'raincoat',
  'shorts',
  'pants',
  'trousers',
  'jeans',
  'bra',
  'panties',
  'bikini',
  'swimsuit',
  'uniform',
  'camisole',
  'leggings',
  'robe'
]
const GARMENT_FILLER = new Set(['her', 'their', 'own', 'the', 'and', 'with', 'clothes', 'clothing'])
const GARMENT_BREAK = [
  'and',
  'with',
  'beside',
  'near',
  'on',
  'under',
  'over',
  'above',
  'below',
  'next',
  'wearing',
  'dressed',
  ...GARMENT_NOUNS
].join('|')

/** Weights and separators carry no clothing description. */
function garmentWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(([^():]+):[\d.]+\)/g, '$1')
    .replace(/[_()-]/g, ' ')
    .replace(/\bminiskirt(s?)\b/g, 'mini skirt$1')
}

/** A garment noun and one of that garment's colour or style words identify its set. */
export function photoWardrobeFromGarment(
  character: Character,
  caption: string
): readonly string[] | null {
  const text = garmentWords(caption)
  const sets = [
    character.outfit,
    character.peOutfit,
    character.swimOutfit,
    ...customOutfitSlotsIn(Object.keys(character.customOutfits ?? {})).map((slot) =>
      outfitTagsFor(character, slot)
    )
  ]
  for (const tags of sets) {
    if (!tags) continue
    for (const tag of tags) {
      const words = garmentWords(tag)
      for (const noun of GARMENT_NOUNS) {
        if (!says(words, noun) || !says(text, noun)) continue
        const modifiers = words
          .split(/[^a-z]+/)
          .filter((word) => word.length >= 3 && !GARMENT_FILLER.has(word) && !says(word, noun))
        const word = `(?!(?:${GARMENT_BREAK})\\b)[a-z]+`
        const phrase = new RegExp(
          `(?:\\b${word}\\s+){0,5}\\b${noun}(?:s|es)?\\b(?:\\s+${word}){0,3}`,
          'g'
        )
        if ([...text.matchAll(phrase)].some((match) => saysAny(match[0], modifiers))) return tags
      }
    }
  }
  return null
}

/** A wardrobe's tags as words a caption can use: `pink_cardigan` is "pink cardigan". */
function spoken(tags: readonly string[]): string {
  return tags.map((tag) => tag.replace(/_/g, ' ')).join(', ')
}

/**
 * Her wardrobe as one line of the brief, so a caption can put her in clothes she owns rather than
 * invent some. Every set she has, by the name a caption would use for it.
 */
export function wardrobeLine(character: Character): string {
  const sets = [
    `everyday — ${spoken(character.outfit)}`,
    `PE kit — ${spoken(character.peOutfit)}`,
    `swimsuit — ${spoken(character.swimOutfit)}`,
    ...customOutfitSlotsIn(Object.keys(character.customOutfits ?? {})).flatMap((slot) => {
      const set = character.customOutfits?.[slot]
      const name = set?.name?.trim()
      return name && set && set.tags.length > 0 ? [`"${name}" — ${spoken(set.tags)}`] : []
    })
  ]
  return `${character.firstName}'s clothes: ${sets.join('; ')}. If the picture has her in one of these, say which — "her everyday clothes", "her PE kit", "her swimsuit"${sets.length > 3 ? ', or the name of the set' : ''} — rather than describing it. For something else, or a picture from another day, say what she is wearing and its colour in a few words, as she would dress for it, in her own style: not an oversized knit sweater, cardigan or hoodie unless one is hers.`
}
