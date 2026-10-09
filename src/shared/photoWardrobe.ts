import { CUSTOM_OUTFIT_SLOTS, outfitTagsFor } from './outfits'
import { saysAny } from './photoWords'
import type { Character, CustomOutfitSlot } from './types'

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
  'everyday clothes',
  'everyday outfit',
  'usual clothes',
  'usual outfit',
  'her clothes',
  'her outfit'
]

/**
 * Where she would be in her swimsuit; used only when the caption names no clothes of its own, and
 * only where the picture may be suggestive — a swimsuit is, so an everyday picture at the pool is
 * of her in her ordinary clothes rather than one past what the gate allowed.
 */
const SWIM_PLACES = ['pool', 'poolside', 'beach', 'swimming', 'swim']

/** What she would be doing in her PE kit; the same rule. */
const PE_PLACES = ['pe', 'gym', 'workout', 'working out', 'running', 'jogging', 'training', 'yoga']

/** The custom set whose name the caption says, if any. */
function namedCustomSet(character: Character, text: string): CustomOutfitSlot | null {
  for (const slot of CUSTOM_OUTFIT_SLOTS) {
    const name = character.customOutfits?.[slot]?.name?.trim().toLowerCase()
    if (name && saysAny(text, [name])) return slot
  }
  return null
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

  const custom = namedCustomSet(character, text)
  if (custom) return outfitTagsFor(character, custom)
  if (saysAny(text, SWIM_GARMENTS)) return outfitTagsFor(character, 'swim')
  if (saysAny(text, PE_GARMENTS)) return outfitTagsFor(character, 'pe')
  if (saysAny(text, MAIN_NAMES)) return character.outfit

  if (captionDressesHer) return null
  if (swimwearAllowed && saysAny(text, SWIM_PLACES)) return outfitTagsFor(character, 'swim')
  if (saysAny(text, PE_PLACES)) return outfitTagsFor(character, 'pe')
  return character.outfit
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
    ...CUSTOM_OUTFIT_SLOTS.flatMap((slot) => {
      const set = character.customOutfits?.[slot]
      const name = set?.name?.trim()
      return name && set && set.tags.length > 0 ? [`"${name}" — ${spoken(set.tags)}`] : []
    })
  ]
  return `${character.firstName}'s clothes: ${sets.join('; ')}. If the picture has her in one of these, say which — "her everyday clothes", "her PE kit", "her swimsuit"${sets.length > 3 ? ', or the name of the set' : ''} — rather than describing it.`
}
