import type { PhotoTier } from './photoGate'
import { DORM_IDS, dormLabel } from './dorms'
import { bodyAppearance, bodyNegative } from './characterBody'
import { bodyTagsFor, describesNothingOn } from './photoBody'
import { posePhotoTags } from './photoPose'
import { LOCATIONS, NARRATIVE_LOCATIONS } from './locations'
import type { Character } from './types'
// Carries the `Character.body` augmentation into whatever program imports this module. The
// project's `include` would reach it for the app, but `tsconfig.test.json` lists only the tests
// and pulls in what they import — so the feature brings its own types rather than relying on a
// tsconfig line, which would be one more thing to re-add on a sync.
import type {} from './photoTypes'
import { photoWardrobe } from './photoWardrobe'
import { saysAny } from './photoWords'

/**
 * The prompt one phone photo is drawn from. Built like the CG prompt — her appearance tags
 * carry who she is, since nothing else does — with the picture she described in the middle.
 *
 * What separates a photo from a sprite is everything around her: a sprite is a cut-out on
 * white that the stage composites, a photo is a whole picture with a room in it. So the
 * background tags a sprite forbids are exactly the ones a photo needs.
 */

/**
 * What every phone photo is, before anything about her.
 *
 * `depth_of_field` alone: this is a booru vocabulary, and a tag it has never been trained on is
 * not a style hint — it is a noun. `casual_photo` and `phone_camera` drew a camera and a phone
 * into the picture rather than making the picture look like one.
 */
/**
 * What every picture asks for before anything else. Kept here rather than read off
 * `imagePrompt`, whose own quality run is private to it and carries whatever style trigger the
 * sprite checkpoint wants: a photo is a different picture on a different graph, and a feature
 * that borrows the sprites' prefix breaks the day someone retunes it.
 */
const PHOTO_QUALITY = 'masterpiece, best_quality, very_aesthetic'

const PHOTO_BASE = '1girl, solo, depth_of_field'

/** What no phone photo may be. A sprite's white cut-out background is the enemy here. */
const PHOTO_NEGATIVE =
  'worst_quality, bad_quality, lowres, simple_background, white_background, transparent_background, ' +
  'multiple_views, reference_sheet, english_text, speech_bubble, artist_name, watermark, signature, ' +
  // Every photo is her alone: nobody else is drawn into it, whoever took it.
  '1boy, multiple_boys, multiple_girls, 2girls, hetero, penis, sex, ' +
  // `photo_(medium)` holds the illustration against photographic realism the checkpoint drifts
  // toward; the rest are what it adds to a body unasked.
  'gold, photo_(medium), cum'

/**
 * What an uncovered picture has to say, and what it has to refuse.
 *
 * Danbooru is full of censored explicit art — `censored` is on nearly as many posts as `nude`
 * itself, and mosaics and bars on hundreds of thousands more — so a checkpoint trained on it
 * has learned to draw the censoring alongside the thing being censored. Asking for the one
 * without refusing the other is how a render comes back with a mosaic in the middle of it.
 */
const BARE_POSITIVE = 'uncensored'
const BARE_NEGATIVE = 'censored, mosaic_censoring, bar_censor, convenient_censoring'

/** Words in her description that say she is already dressed for the picture. */
const CLOTHING_WORDS = [
  'wearing',
  'dressed',
  'outfit',
  'clothes',
  // Everything the coverage tables in `photoBody` know as clothing, so the two agree on what
  // dresses her.
  'dress',
  'sundress',
  'gown',
  'coat',
  'jacket',
  'hoodie',
  'sweater',
  'cardigan',
  'shirt',
  'blouse',
  'top',
  'tank top',
  'crop top',
  'uniform',
  'pyjamas',
  'pajamas',
  'jeans',
  'trousers',
  'pants',
  'shorts',
  'skirt',
  'towel',
  'bra',
  'bralette',
  'bikini',
  'swimsuit',
  'swimwear',
  'one-piece',
  'lingerie',
  'negligee',
  'corset',
  'panties',
  'underwear',
  'thong',
  'g-string',
  'leggings',
  'stockings',
  'robe',
  'bathrobe',
  'kimono',
  'yukata',
  'apron',
  'costume'
]

/** Whether her description dresses her, in which case her everyday wardrobe stays out of it. */
function describesClothing(photoPrompt: string): boolean {
  // "on top of the bed" is a place, not something she has on.
  const text = photoPrompt.toLowerCase().replace(/\btop of\b/g, '')
  return saysAny(text, CLOTHING_WORDS)
}

/**
 * Every proper name the game knows, which is every proper name a picture cannot show. A
 * caption that says "Lowrise 3" or "the Agora" spends its words on something no camera
 * records, and a name in a prompt is drawn as lettering often enough to be worth removing.
 */
function properNames(character: Character): string[] {
  const places = [...LOCATIONS, ...NARRATIVE_LOCATIONS].flatMap((place) => [
    place.label,
    // "the Agora" is also written bare, and the article would be left dangling otherwise.
    place.label.replace(/^the /i, '')
  ])
  return [
    `${character.firstName} ${character.lastName}`,
    character.firstName,
    character.lastName,
    ...DORM_IDS.map(dormLabel),
    ...places
  ]
    .filter((name) => name.length > 2)
    // Longest first, so a full name goes before either half of it does.
    .sort((a, b) => b.length - a.length)
}

/** Escapes a name for use inside a regular expression. */
function escaped(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Strikes those names out of what she wrote, leaving the description around them: "her
 * Lowrise 3 room" becomes "her room", which is what the picture shows anyway. The prompt
 * asks her not to write them; this is what happens when she does.
 */
function withoutNames(character: Character, scene: string): string {
  const stripped = properNames(character).reduce(
    (text, name) => text.replace(new RegExp(`\\b${escaped(name)}(?:['\u2019]s)?\\b`, 'gi'), ''),
    scene
  )
  // Whatever the names left behind: doubled spaces, and a space before the punctuation that
  // used to follow them.
  return stripped
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/^[\s,]+/, '')
    .trim()
}

/** The two strings one photo render needs. */
export interface PhotoPrompts {
  positive: string
  negative: string
}

/**
 * Assembles one photo's prompts. The tier has already been settled by `photoGate`; everything
 * here only draws what it allows.
 *
 * Five groups, in the order a checkpoint reads them best: what kind of picture this is, who
 * she is, what is left of her body in shot, what she is wearing, and last the caption itself
 * with the composition it implies. Her caption stays in the prompt as written — it carries the
 * room, the light and the moment, which no table has tags for — but it is no longer asked to
 * carry her pose on its own.
 */
export function buildPhotoPrompt(
  character: Character,
  tier: PhotoTier,
  photoPrompt: string
): PhotoPrompts {
  const scene = withoutNames(character, photoPrompt.trim())
  // The one question the rest is answered from, and the gate alone decides it.
  const bare = tier === 'explicit'
  const dressed = describesClothing(scene)

  const body = bodyTagsFor(character.body, scene, bare)
  const pose = posePhotoTags(scene, bare)

  const wardrobe = bare
    ? // Undressed by what she moved aside, where the caption still dresses her; nude otherwise.
      dressed && !describesNothingOn(scene)
      ? ['partially_undressed', ...displacedTags(scene), BARE_POSITIVE].join(', ')
      : `nude, completely_nude, ${BARE_POSITIVE}`
    : // One of her own sets, or nothing where the picture she described dressed her in
      // something none of them is.
      (photoWardrobe(character, scene, dressed, tier !== 'everyday') ?? []).join(', ')

  // Her appearance, with her build and her chest in it while the body switch is on. It opens on
  // the subject tag where she has one, so the base does not say it a second time.
  const appearance = bodyAppearance(character, 'photo')
  const base = appearance.includes('1girl') ? PHOTO_BASE.replace('1girl, ', '') : PHOTO_BASE

  const positive = [
    `${PHOTO_QUALITY}, ${base}`,
    appearance.join(', '),
    body.join(', '),
    wardrobe,
    // The sentence's own full stop would sit in front of the tags that follow it.
    [scene.replace(/[.!?]+$/, ''), pose.join(', ')].filter((part) => part.length > 0).join(', ')
  ]
    .filter((group) => group.length > 0)
    .join(',\n\n')

  const negative = [
    PHOTO_NEGATIVE,
    ...(bare ? [BARE_NEGATIVE] : []),
    ...bodyNegative(character),
    ...(character.negativeTags ?? [])
  ].join(', ')
  return { positive, negative }
}

/** What she has moved out of the way, as the checkpoint's own words for it. */
const DISPLACEMENTS: readonly { garments: readonly string[]; tag: string }[] = [
  { garments: ['thong', 'panties', 'g-string', 'underwear', 'bikini bottom'], tag: 'panties_aside' },
  { garments: ['skirt', 'dress'], tag: 'skirt_lift' },
  { garments: ['shirt', 'top', 'blouse', 'sweater', 'hoodie', 'tank top', 'crop top'], tag: 'shirt_lift' },
  { garments: ['bra', 'bikini top'], tag: 'bra_lift' }
]

const MOVED =
  '(?:pulled (?:to the side|aside|down|up|off)|bunched|hiked up|hitched up|lifted|pushed (?:up|aside|down)|moved aside|tugged (?:aside|down))'

/** The garments a caption has her wearing but out of the way, as tags. */
function displacedTags(scene: string): string[] {
  const text = scene.toLowerCase()
  const tags = DISPLACEMENTS.filter(({ garments }) =>
    garments.some((garment) => new RegExp(`\\b${garment}\\b(?:\\s+[a-z'-]+){0,2}?\\s+${MOVED}`).test(text))
  ).map(({ tag }) => tag)
  // Something moved and named in no row: the general word for clothes pulled out of the way.
  if (tags.length === 0 && new RegExp(`\\b${MOVED}`).test(text)) tags.push('clothes_pull')
  return tags
}
