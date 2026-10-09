import type { PhotoTier } from './photoGate'
import { DORM_IDS, dormLabel } from './dorms'
import { bodyAppearance, bodyNegative } from './characterBody'
import { bodyTagsFor, describesNothingOn } from './photoBody'
import { framingInTags } from './photoFraming'
import { photoPose, withoutCameraHold } from './photoPose'
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

/** What can be on her legs, as the words a caption says it with. */
const LEG_ITEMS = [
  'thigh[- ]?highs?',
  'thighhighs?',
  'stockings?',
  'pantyhose',
  'tights',
  'leggings',
  'kneehighs?',
  'knee[- ]highs?',
  'over[- ]the[- ]knee',
  'socks?',
  'legwear',
  'fishnets?'
].join('|')

/**
 * What a picture with her dressed keeps out: the checkpoint can undress a pose it was not asked
 * to (a sweater slipping, a skirt riding up), and a feed photo is seen by the whole campus. A
 * same-seed check showed these change nothing in a picture that was not slipping. The wider set
 * (cleavage, bra straps, underwear) toned down what the caption had asked for, so it is not here.
 * Each is dropped where the caption names it.
 */
const DRESSED_NEGATIVE: readonly (readonly [string, RegExp])[] = [
  ['nude', /\b(?:nude|naked)\b/],
  ['nipples', /\bnipples?\b/],
  ['areolae', /\bareola/],
  ['pussy', /\bpussy\b/],
  ['pantyshot', /\b(?:pantyshot|panties|underwear|knickers)\b/]
]

/**
 * What shows her chest: in the caption, or in the outfit and body tags the prompt already holds
 * (her coverage writes `cleavage` for a top that shows it).
 */
const SHOWS_CLEAVAGE = new RegExp(
  '\\b(?:cleavage|unbuttoned|open[- ]shirt|low[- ]cut|plunging|off[- ]shoulder|strapless|' +
    'tube top|bikini|swimsuit|bra|lingerie|towel|deep v)\\b'
)

/**
 * In an everyday photo the sweater fell open onto her chest on some seeds, and the set above
 * did not stop it. `cleavage` with `downblouse` (her top hanging open toward the camera) closed
 * three seeds of four and narrowed the fourth; weighting either made it worse, a bra showing.
 * Only where nothing she wears shows it. A suggestive photo keeps it allowed: there it is often
 * what was asked for.
 */
function dressedNegative(text: string, everyday: boolean): string[] {
  const kept = DRESSED_NEGATIVE.filter(([, said]) => !said.test(text)).map(([tag]) => tag)
  return everyday && !SHOWS_CLEAVAGE.test(text) ? [...kept, 'cleavage', 'downblouse'] : kept
}

/** Anything on her legs the picture names. */
const LEGWEAR = new RegExp(`\\b(?:${LEG_ITEMS})\\b`)

/** What she can wear on her legs, each refused unless the caption names it. */
const LEGWEAR_NEGATIVE: readonly (readonly [string, RegExp])[] = [
  ['pantyhose', /\b(?:pantyhose|tights)\b/],
  ['leggings', /\bleggings\b/],
  ['latex', /\blatex\b/],
  ['thighhighs', /\b(?:thigh[- ]?highs?|thighhighs?|stockings?|over[- ]the[- ]knee)\b/]
]

/**
 * The colours Danbooru files legwear under, as `<colour>_legwear`. Black and white are not
 * among the ones refused: they are not "coloured" legwear, and the plain ones she is often in.
 */
const LEG_COLOURS = ['pink', 'red', 'blue', 'green', 'purple', 'yellow', 'orange', 'brown', 'grey']

/** A colour on what is on her legs: then that colour is what she asked for there. */
function legColour(text: string, colour: string): boolean {
  return new RegExp(`\\b${colour}\\b(?:\\s+[a-z-]+){0,2}\\s+(?:${LEG_ITEMS})\\b`).test(text)
}

/**
 * Legwear she was never given. A colour anywhere else in the prompt bleeds onto her legs: a
 * pink ribbon and pink loafers put pink latex leggings on her in game, and in a same-seed
 * check `bare_legs` and these negatives stopped it. So every colour the prompt names is
 * refused on her legs, unless the caption put that colour there. Bare legs only where the
 * caption names nothing on them and something short above: under jeans there are no legs.
 */
function legwear(text: string): { positive: string[]; negative: string[] } {
  const named = LEGWEAR.test(text)
  const short =
    /\b(?:skirt|shorts|dress|sundress|swimsuit|bikini|towel|nightie|nightgown)\b/.test(text)
  const negative = LEGWEAR_NEGATIVE.filter(([, said]) => !said.test(text)).map(([tag]) => tag)
  const coloured = LEG_COLOURS.filter((colour) => legColour(text, colour))
  if (coloured.length === 0) negative.push('colored_legwear')
  for (const colour of LEG_COLOURS) {
    if (new RegExp(`\\b${colour}\\b`).test(text) && !coloured.includes(colour)) {
      negative.push(`${colour}_legwear`)
    }
  }
  return { positive: !named && short ? ['bare_legs'] : [], negative }
}
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

/**
 * Colours named after something you can eat or pour, and the plain colour each one means.
 * The checkpoint reads the noun: "an unbuttoned cream silk shirt" came back with cream poured
 * on her chest, in a photo posted to her feed.
 */
const FOOD_COLOURS: Readonly<Record<string, string>> = {
  cream: 'ivory',
  milk: 'white',
  vanilla: 'off-white',
  latte: 'beige',
  butter: 'pale yellow',
  honey: 'amber',
  caramel: 'light brown',
  cinnamon: 'brown',
  coffee: 'brown',
  mocha: 'brown',
  chocolate: 'dark brown',
  wine: 'burgundy',
  cherry: 'red',
  strawberry: 'pink',
  peach: 'light orange',
  lemon: 'yellow',
  mint: 'light green'
}

/** What a colour word in a caption is the colour of: what she wears, her hair, her room. */
const COLOURED_THINGS = [
  'shirt',
  'blouse',
  'top',
  'sweater',
  'cardigan',
  'hoodie',
  'jacket',
  'coat',
  'dress',
  'sundress',
  'skirt',
  'shorts',
  'jeans',
  'trousers',
  'pants',
  'socks',
  'stockings',
  'thighhighs',
  'tights',
  'bra',
  'panties',
  'lingerie',
  'underwear',
  'bikini',
  'swimsuit',
  'towel',
  'robe',
  'pajamas',
  'pyjamas',
  'nightie',
  'sheets',
  'blanket',
  'pillow',
  'scarf',
  'hat',
  'beanie',
  'ribbon',
  'bow',
  'nails',
  'lipstick',
  'hair',
  'heels',
  'shoes',
  'sneakers',
  'boots',
  'loafers',
  'bag',
  'knit',
  'wall',
  'walls'
].join('|')

const FOOD_COLOUR = new RegExp(
  `\\b(${Object.keys(FOOD_COLOURS).join('|')})(?:[- ]colou?red)?\\b` +
    `(?=(?:[\\s-]+[a-z]+){0,2}?[\\s-]+(?:${COLOURED_THINGS})s?\\b)`,
  'gi'
)

const SHADE_OF = new RegExp(
  `\\b(?:${Object.keys(FOOD_COLOURS).join('|')})[\\s-]+` +
    '(red|pink|blonde|brown|white|black|yellow|orange|green|blue|purple|beige|gold|silver)\\b',
  'gi'
)

/**
 * The caption with every colour named after a food or a drink said plainly: "a cream silk
 * shirt" is "an ivory silk shirt". Only where the word colours something she wears or lies
 * on; "ice cream" and "a coffee in her hand" are what they say.
 */
export function plainColours(scene: string): string {
  // "cherry red", "honey blonde": the colour is already said after it, so the food just goes.
  const shaded = scene.replace(SHADE_OF, '$1')
  return shaded.replace(FOOD_COLOUR, (word: string, food: string) => {
    const plain = FOOD_COLOURS[food.toLowerCase()]
    return word[0] === word[0].toUpperCase() ? plain[0].toUpperCase() + plain.slice(1) : plain
  })
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
  const scene = plainColours(withoutNames(character, photoPrompt.trim()))
  // The one question the rest is answered from, and the gate alone decides it.
  const bare = tier === 'explicit'
  const dressed = describesClothing(scene)

  const pose = photoPose(scene, bare)
  // Her body as far as the shot reaches: a selfie from the waist up names no hips.
  const body = bodyTagsFor(character.body, scene, bare, framingInTags(pose.tags))

  const wardrobe = bare
    ? // Undressed by what she moved aside, where the caption still dresses her; nude otherwise.
      dressed && !describesNothingOn(scene)
      ? ['partially_undressed', ...displacedTags(scene), BARE_POSITIVE].join(', ')
      : `nude, completely_nude, ${BARE_POSITIVE}`
    : // One of her own sets, or nothing where the picture she described dressed her in
      // something none of them is.
      plainColours((photoWardrobe(character, scene, dressed, tier !== 'everyday') ?? []).join(', '))

  // Her appearance, with her build and her chest in it while the body switch is on. It opens on
  // the subject tag where she has one, so the base does not say it a second time.
  const appearance = bodyAppearance(character, 'photo')
  const base = appearance.includes('1girl') ? PHOTO_BASE.replace('1girl, ', '') : PHOTO_BASE

  // Read off everything the picture will be told she wears, her own tags and outfit included.
  const worn = `${appearance.join(' ')} ${wardrobe} ${scene}`
  const legs = legwear(worn.toLowerCase().replace(/_/g, ' '))

  const positive = [
    `${PHOTO_QUALITY}, ${base}`,
    appearance.join(', '),
    body.join(', '),
    [wardrobe, ...legs.positive].filter((part) => part.length > 0).join(', '),
    // The sentence's own full stop would sit in front of the tags that follow it.
    [withoutCameraHold(scene).replace(/[.!?]+$/, ''), pose.tags.join(', ')]
      .filter((part) => part.length > 0)
      .join(', ')
  ]
    .filter((group) => group.length > 0)
    .join(',\n\n')

  const negative = [
    PHOTO_NEGATIVE,
    ...(bare ? [BARE_NEGATIVE] : []),
    ...(bare ? [] : dressedNegative(worn.toLowerCase().replace(/_/g, ' '), tier === 'everyday')),
    ...legs.negative,
    ...pose.negative,
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
