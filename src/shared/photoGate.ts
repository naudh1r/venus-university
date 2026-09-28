import { saysAny } from './photoWords'
import { dispositionOf } from './relationship'
import { hasTrait } from './traits'
import type { CharFlags, Character } from './types'

/**
 * What a character will photograph of herself, and for whom.
 *
 * Two rules hold this together. The gate is decided from the save, never from the reply: her
 * flags and her feeling toward the reader say how far she would go before the model is asked
 * anything. And the reply is never taken at its word — what a picture *is* comes from reading
 * the prompt she wrote, so a model that answers "just a selfie" and then describes something
 * else is measured by the description.
 */

/** How far a photo goes, in the order a relationship reaches them. */
export const PHOTO_TIERS = ['none', 'everyday', 'suggestive', 'explicit'] as const
export type PhotoTier = (typeof PHOTO_TIERS)[number]

/** Guard for a tier that crossed a process boundary. */
export function isPhotoTier(value: string): value is PhotoTier {
  return (PHOTO_TIERS as readonly string[]).includes(value)
}

/** Where `tier` sits in {@link PHOTO_TIERS}; how two tiers are compared. */
function rankOf(tier: PhotoTier): number {
  return PHOTO_TIERS.indexOf(tier)
}

/** What the save says she is willing to send him right now. */
export function allowedPhotoTier(input: {
  flags: CharFlags | undefined
  /** Her affection as the ledger has it, which `dispositionOf` reads as a feeling. */
  affection: number
  /** Her traits: who she is decides this as much as what they are to each other. */
  traits: Character['traits'] | undefined
  /** The player's own switch: with it on, no picture of her is ever undressed. */
  noNsfwImages: boolean
  /**
   * Whether a picture can be drawn at all — the local renderer, which is optional. Without it
   * nothing here is about her: a photo she offers cannot arrive, and a thread that talks about
   * one is a thread about a picture that will never exist. So she is never told she may send
   * one, and never asked.
   */
  canRender: boolean
}): PhotoTier {
  const { flags, affection, traits, noNsfwImages, canRender } = input
  if (!canRender) return 'none'
  // Nobody photographs for a stranger, and a blocked number reaches nobody at all.
  if (!flags?.gaveContactInfo || flags.blocked) return 'none'

  /**
   * A `Promiscuous` girl sends what she likes to whoever has her number. She is not being
   * won over, so nothing here is earned: not the milestones, not the affection. The player's
   * own switch still binds her, and a blocked number still reaches nobody.
   */
  if (hasTrait(traits ? { traits } : undefined, 'Promiscuous')) {
    return noNsfwImages ? 'suggestive' : 'explicit'
  }

  // Out of sorts with him: she is not in the mood to be photographed for anybody.
  const feeling = dispositionOf(affection)
  if (feeling === 'hostile' || feeling === 'annoyed') return 'none'

  // Undressed needs both a reason of hers and the player's consent to see it.
  const intimate = flags.hadSex || flags.benefits || flags.isLover
  if (intimate && !noNsfwImages) return 'explicit'

  // Teasing comes earlier than nudity, and earlier than being lovers: they have kissed.
  if (flags.hasKissed || flags.benefits || flags.isLover) return 'suggestive'

  return 'everyday'
}

/**
 * What a picture posted to the feed may show. Flat, because a post is public: there is no
 * relationship to read, no one reader it is for, and nothing she has been through with anybody
 * changes what her whole year gets to see. A swimsuit is ordinary on a feed; nothing past it is.
 */
export function allowedPostTier(noNsfwImages: boolean): PhotoTier {
  return noNsfwImages ? 'everyday' : 'suggestive'
}

/** Words that make a picture explicit whatever it claims to be. */
const EXPLICIT_WORDS = [
  'nude',
  'naked',
  'topless',
  'bottomless',
  'undressed',
  // The same phrases `photoBody` strips her on, so the two cannot disagree about what bare is:
  // a caption the builder would draw undressed must read as undressed here first.
  'nothing on',
  'wearing nothing',
  'no clothes',
  'without clothes',
  'fully exposed',
  'nipple',
  'breasts out',
  'bare breasts',
  'pussy',
  'vagina',
  'genital*',
  'masturbat*',
  'spread legs',
  'cum',
  'cumming',
  'sex',
  // Ways of saying it that carry no word from the list above. She wrote "bare-chested and
  // wearing only black lace panties" and it read as suggestive, because every word naming what
  // was bare was one nobody had thought of.
  'bare-chested',
  'bare chested',
  'bare chest',
  'bare torso',
  'bare front',
  'bare from the waist up',
  'chest bare',
  'breasts bare',
  'exposed breasts',
  'exposed chest',
  'uncovered breasts',
  'shirtless',
  'braless',
  'no bra',
  'without a bra',
  'nothing covering',
  // "wearing only <one thing>" says what is not there without naming it.
  'wearing only',
  'wearing nothing but',
  'dressed in only',
  'in only her',
  'clad only in'
]

/** Words that make it suggestive: skin and intent, with nothing on show. */
const SUGGESTIVE_WORDS = [
  'underwear',
  'lingerie',
  'bra',
  'panties',
  'bikini',
  'swimsuit',
  'swimwear',
  'towel',
  'lace',
  'cleavage',
  'thigh',
  'bare shoulder',
  'tease',
  'teasing',
  'seductive',
  'suggestive',
  'in bed',
  'bedroom eyes',
  'shower',
  'bath',
  'changing room',
  'skimpy',
  'revealing'
]

/**
 * What the picture she described actually is. Read off her own words rather than a flag she
 * set beside them: the flag is what she says, this is what she wrote.
 */
export function describedPhotoTier(photoPrompt: string): PhotoTier {
  const text = photoPrompt.toLowerCase()
  if (!text.trim()) return 'none'
  if (saysAny(text, EXPLICIT_WORDS)) return 'explicit'
  if (saysAny(text, SUGGESTIVE_WORDS)) return 'suggestive'
  return 'everyday'
}

/**
 * Words that put somebody else in the picture, or something anal. Every photo is her alone, taken
 * by her — the renderer is asked for one girl and nobody else — so a caption describing a partner
 * or an act with one cannot be drawn as written. Taking the words out would leave a caption that
 * still implies somebody, so a picture that says any of these is not sent at all.
 *
 * Only acts and other bodies: "his hoodie" and "a selfie for him" are pictures of her alone.
 */
const NOT_SOLO_WORDS = [
  // Another body in it.
  'his hand',
  'his fingers',
  'his mouth',
  'his tongue',
  'his lap',
  'his chest',
  'his arms',
  'on top of him',
  'riding him',
  'straddling him',
  'with him',
  'boyfriend',
  'another girl',
  'other girl',
  'two girls',
  'threesome',
  'couple',
  // Acts that take two.
  'blowjob',
  'fellatio',
  'handjob',
  'titjob',
  'paizuri',
  'deepthroat*',
  'intercourse',
  'creampie',
  'fucking him',
  'fucked by',
  'sucking him',
  'kissing him',
  // Anal, which the feature does not draw.
  'anal',
  'anus',
  'asshole',
  'butthole',
  'butt plug',
  'buttplug',
  'anal beads'
]

/** The words for a man's body, which mean somebody else is there unless a toy is being named. */
const PARTNER_BODY_WORDS = ['penis', 'cock', 'dick']

/** What a caption calls the toy she is using by herself: "a dildo shaped like a cock" is hers. */
const TOY_WORDS = ['dildo', 'vibrator', 'toy', 'magic wand']

/** Whether a caption puts anybody but her in the picture, or anything anal. */
export function describesSomebodyElse(photoPrompt: string): boolean {
  const text = photoPrompt.toLowerCase()
  if (saysAny(text, NOT_SOLO_WORDS)) return true
  return saysAny(text, PARTNER_BODY_WORDS) && !saysAny(text, TOY_WORDS)
}

/** One photo request, once the gate has had its say. */
export interface PhotoVerdict {
  /** Whether it is rendered at all. */
  send: boolean
  /** What it will be drawn as — never above what {@link allowedPhotoTier} allows. */
  tier: PhotoTier
  /** Why it was refused or held back, for the log. */
  note?: string
}

/**
 * Settles one reply's photo against the gate. A picture the relationship does not reach is
 * refused outright rather than softened: a girl who would not send it does not send a tamer
 * version of it, she sends nothing, and the reply's own words carry the moment instead.
 */
export function settlePhoto(input: {
  sendPhoto: boolean
  photoPrompt: string
  allowed: PhotoTier
  /**
   * What she says the picture is, where she was asked. It may only *raise* the reading, never
   * lower it: a word list can be written around by a caption nobody anticipated, and a model
   * can under-report what it drew, so whichever of the two says more is the one taken.
   */
  stated?: PhotoTier
}): PhotoVerdict {
  const { sendPhoto, photoPrompt, allowed, stated } = input
  if (!sendPhoto || !photoPrompt.trim()) return { send: false, tier: 'none' }
  if (allowed === 'none') return { send: false, tier: 'none', note: 'she sends him nothing' }
  if (describesSomebodyElse(photoPrompt)) {
    return { send: false, tier: 'none', note: 'the picture is not of her alone' }
  }

  const described = describedPhotoTier(photoPrompt)
  const tier =
    stated && rankOf(stated) > rankOf(described) ? stated : described
  if (rankOf(tier) > rankOf(allowed)) {
    return {
      send: false,
      tier: 'none',
      note: `read as ${tier} (described ${described}, said ${stated ?? 'nothing'}), allowed ${allowed}`
    }
  }
  return { send: true, tier }
}
