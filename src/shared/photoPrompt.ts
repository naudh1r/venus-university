import type { PhotoTier } from './photoGate'
import { DORM_IDS, dormLabel } from './dorms'
import { bodyAppearance, bodyNegative } from './characterBody'
import { bodyTagsFor, describesNothingOn } from './photoBody'
import { framingInTags, framingOf } from './photoFraming'
import { photoPose, withoutCameraHold, withoutHeldObject, withoutSelfieWord } from './photoPose'
import { LOCATIONS, NARRATIVE_LOCATIONS } from './locations'
import type { Character } from './types'
// Carries the `Character.body` augmentation into whatever program imports this module. The
// project's `include` would reach it for the app, but `tsconfig.test.json` lists only the tests
// and pulls in what they import — so the feature brings its own types rather than relying on a
// tsconfig line, which would be one more thing to re-add on a sync.
import type {} from './photoTypes'
import { photoWardrobe } from './photoWardrobe'
import { says, saysAny } from './photoWords'

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
  'gold, photo_(medium), cum, ' +
  // Her fingers, cleaner on a phone and a glass in a same-seed check of a mirror selfie.
  'bad_hands, extra_digits, fewer_digits'

/**
 * What an uncovered picture has to say.
 *
 * Danbooru is full of censored explicit art — `censored` is on nearly as many posts as `nude`
 * itself, and mosaics and bars on hundreds of thousands more — so a checkpoint trained on it
 * has learned to draw the censoring alongside the thing being censored. `uncensored` alone keeps
 * it out: refusing the censoring as well (`censored`, `mosaic_censoring`, `bar_censor`,
 * `convenient_censoring`) smudged something between her legs on four seeds of twelve, and
 * without them none of twelve was censored.
 */
const BARE_POSITIVE = 'uncensored'

/**
 * What a picture with her dressed keeps out: the checkpoint can undress a pose it was not asked
 * to (a sweater slipping, a skirt riding up), and a feed photo is seen by the whole campus. A
 * same-seed check showed these change nothing in a picture that was not slipping. The wider set
 * (cleavage, bra straps, underwear) toned down what the caption had asked for, so it is not here.
 * Nor is `pantyshot`: sitting in a short skirt, it smeared something between her legs on two
 * seeds of sixteen and on none without it, and showed no more of her underwear for being gone.
 * Each is dropped where the caption names it.
 */
const DRESSED_NEGATIVE: readonly (readonly [string, RegExp])[] = [
  ['nude', /\b(?:nude|naked)\b/],
  ['nipples', /\bnipples?\b/],
  ['areolae', /\bareola/],
  ['pussy', /\bpussy\b/]
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

// A tag's words are joined by underscores where a caption's are by spaces: both are read.
const FOOD_COLOUR = new RegExp(
  `(?<![a-z])(${Object.keys(FOOD_COLOURS).join('|')})(?:[-_ ]colou?red)?(?![a-z])` +
    `(?=(?:[\\s_-]+[a-z]+){0,4}?[\\s_-]+(?:${COLOURED_THINGS})s?(?![a-z]))`,
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
  return shaded.replace(FOOD_COLOUR, (word: string, food: string, at: number, text: string) => {
    // Inside a tag, a two-word colour is joined the way the tag's own words are.
    const said = FOOD_COLOURS[food.toLowerCase()]
    const plain = text[at + word.length] === '_' ? said.replace(/ /g, '_') : said
    return word[0] === word[0].toUpperCase() ? plain[0].toUpperCase() + plain.slice(1) : plain
  })
}

/**
 * Where she looks, said without the thing that took the picture: "looking at the camera" put a
 * camera on her pillow whatever the negative said. The pose already reads the same words as
 * `looking_at_viewer`; a caption about her own camera is left as it is.
 */
export function lookingAtViewer(scene: string): string {
  if (/\b(?:her|a|film)\s+camera\b|\bpolaroid\b/i.test(scene)) return scene
  return scene.replace(
    /\b(at|into|toward|towards|to)\s+the\s+(?:camera|lens|phone)\b/gi,
    (_whole, word: string) => `${word} the viewer`
  )
}

/**
 * A drink said as a liquid is drawn as one, spilt: "a glass of pink liquid in hand" splashed pink
 * across her chest and the bed. Said as a drink, it stays in the glass.
 */
export function drinkNotLiquid(scene: string): string {
  return scene.replace(/\bliquid\b/gi, (word) => (word[0] === 'L' ? 'Drink' : 'drink'))
}

/**
 * A shop named after its drink puts that drink in her hand: "a bubble tea shop" drew a cup at her
 * lips on every seed, and no negative (cup, drinking_straw, bubble_tea, holding_cup) moved it.
 * "Tea shop" keeps the room and leaves her hands free. A drink she does hold is left alone.
 */
export function shopNotDrink(scene: string): string {
  if (/\b(?:holding|holds|sipping|drinking|cup of|glass of|mug of)\b/i.test(scene)) return scene
  return scene.replace(/\b(?:bubble tea|boba)\s+(shop|caf[eé]|bar|place|store)\b/gi, 'tea $1')
}

/**
 * Splashes and stains nobody asked for, in every photo: a coloured drink in the caption, or a
 * colour anywhere in it, came back as paint spattered over her and the sheets.
 */
const SPILL_NEGATIVE: readonly (readonly [string, RegExp])[] = [
  ['paint_splatter', /\b(?:paint|splatter)/],
  ['splashing', /\bsplash/],
  ['stain', /\bstain/]
]

/**
 * The sentence without who took the picture: a friend named in it is a second person the model
 * can draw, whatever the negative says. Her brief offers "a photo somebody took of her" as one
 * kind of picture; what is left is the picture itself.
 */
export function withoutWhoTookIt(scene: string): string {
  const person = '(?:friend|roommate|bestie|best friend|boyfriend|sister|mom)'
  const taker = `(?:(?:a|her|my|his|the)\\s+${person}|somebody|someone)`
  const takenBy = new RegExp(`\\s*,?\\s*(?:taken|shot|snapped)\\s+by\\s+${taker}\\b`, 'gi')
  const tookOf = new RegExp(
    `\\b(?:that\\s+)?${taker}\\s+(?:took|snapped|shot)(?:\\s+of\\s+(?:her|me))?\\s*`,
    'gi'
  )
  return scene
    .replace(takenBy, '')
    .replace(tookOf, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim()
}

/** A colour a garment can be named in. */
const GARMENT_COLOUR = new RegExp(
  '(?:^|[_\\s-])(?:pink|red|blue|green|purple|yellow|orange|brown|grey|gray|black|white|beige|' +
    'navy|teal|cream|ivory|lavender|violet|maroon|burgundy|gold|silver|tan|khaki|olive)(?:$|[_\\s-])'
)

/** What she wears on her top half: the garment a scene's light takes the colour off. */
const TOP_GARMENT = new RegExp(
  '(?:^|[_\\s-])(?:top|shirt|t-shirt|blouse|sweater|cardigan|hoodie|bra|bralette|camisole|' +
    'bandeau|dress|sundress|tank)s?(?:$|[_\\s-])'
)

/**
 * One of her garments, weighted where it is her top and names a colour. A dark or neon-lit scene
 * took the colour off it: her pink sports bra came back black or white on every seed, and pink on
 * every seed at 1.2. Only her top: every coloured garment weighted put her sneakers on the bed
 * beside her and turned her hair the colour of her clothes, and 1.1 did not hold the shoes back.
 * A negative for the colour it turned did nothing, and saying the colour twice changed the garment.
 */
function heldColour(tag: string): string {
  const text = tag.toLowerCase()
  return GARMENT_COLOUR.test(text) && TOP_GARMENT.test(text) && !tag.startsWith('(')
    ? `(${tag}:1.2)`
    : tag
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
  const scene = shopNotDrink(drinkNotLiquid(plainColours(withoutNames(character, photoPrompt.trim()))))
  // The one question the rest is answered from, and the gate alone decides it.
  const bare = tier === 'explicit'
  const dressed = describesClothing(scene)

  const pose = photoPose(scene, bare)
  // An everyday photo is seen by everyone: a hoodie slipping off a shoulder there is how she
  // wears it, not her undressing, and the tags pulled the picture towards it.
  if (tier === 'everyday') pose.tags = pose.tags.filter((tag) => !EVERYDAY_DROPS.has(tag))
  // Her body as far as the shot reaches: a selfie from the waist up names no hips.
  const body = bodyTagsFor(character.body, scene, bare, framingInTags(pose.tags))

  const wardrobe = bare
    ? // Undressed by what she moved aside, where the caption still dresses her; nude otherwise.
      dressed && !describesNothingOn(scene)
      ? ['partially_undressed', ...displacedTags(scene), BARE_POSITIVE].join(', ')
      : `nude, completely_nude, ${BARE_POSITIVE}`
    : // One of her own sets, or nothing where the picture she described dressed her in
      // something none of them is.
      plainColours(
        (photoWardrobe(character, scene, dressed, tier !== 'everyday') ?? []).map(heldColour).join(', ')
      )

  // Her appearance, with her build and her chest in it while the body switch is on. It opens on
  // the subject tag where she has one, so the base does not say it a second time.
  const appearance = bodyAppearance(character, 'photo')
  const base = appearance.includes('1girl') ? PHOTO_BASE.replace('1girl, ', '') : PHOTO_BASE

  // Read off everything the picture will be told she wears, her own tags and outfit included.
  const worn = `${appearance.join(' ')} ${wardrobe} ${scene}`

  const positive = [
    `${PHOTO_QUALITY}, ${base}`,
    appearance.join(', '),
    body.join(', '),
    wardrobe,
    // The sentence's own full stop would sit in front of the tags that follow it.
    [
      lookingAtViewer(
        withoutSelfieWord(withoutHeldObject(withoutCameraHold(withoutWhoTookIt(scene))))
      ).replace(
        /[.!?]+$/,
        ''
      ),
      pose.tags.join(', ')
    ]
      .filter((part) => part.length > 0)
      .join(', ')
  ]
    .filter((group) => group.length > 0)
    .join(',\n\n')

  const negative = [
    PHOTO_NEGATIVE,
    ...(bare ? [] : dressedNegative(worn.toLowerCase().replace(/_/g, ' '), tier === 'everyday')),
    ...SPILL_NEGATIVE.filter(([, said]) => !said.test(scene.toLowerCase())).map(([tag]) => tag),
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

/** Pose tags an everyday photo never carries. */
const EVERYDAY_DROPS: ReadonlySet<string> = new Set(['undressing', 'clothes_pull'])

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

/** The four strings a picture of two girls needs: the shared scene, and each girl's own half. */
export interface DuoPhotoPrompts {
  /** The whole picture: where they are and what the shot is. */
  scene: string
  /** The girl who sends it, drawn in the left half. */
  left: string
  /** Her friend, drawn in the right half. */
  right: string
  negative: string
}

/**
 * Words for the two of them touching. Wherever they met, their bodies merged and hands came out
 * on the wrong girl, so a picture of two is drawn with them side by side and the words go.
 */
const TOUCHING = new RegExp(
  '\\s*,?\\s*\\b(?:hugg\\w*|hugs?|cuddl\\w*|snuggl\\w*|embrac\\w*|kiss\\w*|holding hands|hand in hand|' +
    'arm in arm|arms? (?:around|linked|wrapped)|leaning (?:on|against) (?:each other|her)|' +
    'cheek to cheek|head on (?:her|each other)\\S*\\s+shoulder)[^,.;]*?(?=\\s+and\\s|[,.;]|$)',
  'gi'
)

/** The sentence without the two of them touching. */
export function withoutTouching(scene: string): string {
  return scene.replace(TOUCHING, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim()
}

/**
 * What a sentence says they wear, taken out of a picture of two: said over the whole picture, the
 * two split it between them, and one in an open shirt over another's camisole was left in nothing
 * under it. Each half is dressed from her own wardrobe instead.
 */
const WORN_CLAUSE = /,?\s*\b(?:wearing|dressed in|in (?:their|her|matching)\b)[^,.;]*/gi

/**
 * The faces a caption asks of the two, as tags each half carries: the face pass redraws each face
 * from her half's prompt alone, and with no expression in it every face came out serious. A
 * caption that names none gets a smile.
 */
const DUO_EXPRESSIONS: readonly [RegExp, readonly string[]][] = [
  [/\blaugh/i, ['laughing', 'open_mouth']],
  [/\bgrin/i, ['grin']],
  [/\bwink/i, ['one_eye_closed']],
  [/\bpout/i, ['pout']],
  [/\btongue/i, ['tongue_out']],
  [/\bsleepy|\bdrowsy|\byawn/i, ['sleepy']],
  [/\bsmirk/i, ['smirk']],
  [/\bsmil/i, ['smile']]
]

function duoExpression(text: string): string[] {
  const said = DUO_EXPRESSIONS.filter(([words]) => words.test(text)).flatMap(([, tags]) => tags)
  return [...new Set(said.length > 0 ? said : ['smile']), ...(/\bblush/i.test(text) ? ['blush'] : [])]
}

/**
 * What is at or below her waist: out of a picture of two drawn from the waist up. A skirt, jeans
 * or a belt in either half drew both of them down to the hips, where their sides met and fused.
 */
const BELOW_WAIST =
  /(?:thigh[_\s-]?high|socks?|stockings?|pantyhose|tights|legwear|leggings|shoes|sneakers|boots|heels|loafers|sandals|mary_janes|skirt|jeans|pants|trousers|shorts|buruma|bloomers|belt|^navel$|^midriff$|^thighs$|^bare_legs$)/i

/** How each half may hold herself: her pose, never a hand placement or a framing. */
const DUO_POSTURE: ReadonlySet<string> = new Set([
  'standing',
  'sitting',
  'lying',
  'on_back',
  'on_side',
  'on_stomach',
  'kneeling',
  'from_above',
  'looking_at_viewer',
  'looking_away',
  'indian_style',
  'crossed_legs'
])

/** Where the two of them are drawn, from what the caption asks for. */
function duoFraming(text: string): { tags: string[]; scene: string[] } {
  if (saysAny(text, ['from behind', 'back view', 'backs to', 'looking back', 'over her shoulder'])) {
    // Each half turns on its own, and one of them faced the camera unless both were told.
    return {
      tags: ['(from_behind:1.3)', 'looking_back', '(upper_body:1.3)'],
      scene: ['both with their backs to the viewer']
    }
  }
  // A close-up needed the framing weighted in both halves before either was drawn close.
  if (framingOf(text) === 'face' || saysAny(text, ['close-up', 'close up', 'closeup'])) {
    return { tags: ['(close-up:1.3)', '(portrait:1.3)'], scene: [] }
  }
  // Waist up, always: a whole-body shot of two drew one of them smaller, as if a step behind,
  // and her legs folded to fit her half.
  return { tags: ['(upper_body:1.3)'], scene: ['same height'] }
}

/** One girl's half: who she is, what of her the shot shows, and what she wears. */
function duoHalf(
  girl: Character,
  tier: PhotoTier,
  scene: string,
  posture: readonly string[],
  extra: readonly string[]
): { prompt: string; worn: string } {
  const bare = tier === 'explicit'
  const dressed = bare && describesClothing(scene)
  const appearance = bodyAppearance(girl, 'photo').filter((tag) => tag !== '1girl')
  const body = bodyTagsFor(girl.body, scene, bare, 'waist').filter(
    (tag) => bare || !BELOW_WAIST.test(tag)
  )
  const wardrobe = bare
    ? dressed && !describesNothingOn(scene)
      ? ['partially_undressed', ...displacedTags(scene), BARE_POSITIVE]
      : ['nude', 'completely_nude', BARE_POSITIVE]
    : (photoWardrobe(girl, scene, false, tier !== 'everyday') ?? [])
        .filter((tag) => !BELOW_WAIST.test(tag))
        .map(heldColour)
  return {
    prompt: plainColours(
      [PHOTO_QUALITY, '1girl, solo', ...appearance, ...body, ...wardrobe, ...posture, ...extra].join(
        ', '
      )
    ),
    worn: `${appearance.join(' ')} ${wardrobe.join(' ')}`
  }
}

/**
 * The caption with her friend said as "her friend" rather than taken out like any other name:
 * "me and Ana at the cafe" read as "me and at the cafe".
 */
function friendAsFriend(friend: Character, scene: string): string {
  return [`${friend.firstName} ${friend.lastName}`, friend.firstName]
    .filter((name) => name.length > 2)
    .reduce(
      (text, name) =>
        text.replace(new RegExp(`\\b${escaped(name)}(?:['\u2019]s)?\\b`, 'gi'), 'her friend'),
      scene
    )
}

/**
 * The caption with the girl who posted it said as "her": "Lia and her friend" taken out like any
 * other name left ", and her friend stand".
 */
function senderAsHer(sender: Character, scene: string): string {
  return [`${sender.firstName} ${sender.lastName}`, sender.firstName]
    .filter((name) => name.length > 2)
    .reduce(
      (text, name) =>
        text.replace(new RegExp(`\\b${escaped(name)}(?:['\u2019]s)?\\b`, 'gi'), (_said: string, at: number) =>
          at === 0 ? 'Her' : 'her'
        ),
      scene
    )
}

/**
 * Assembles a picture of two girls side by side: `sender` on the left, who sent it, `friend` on
 * the right. Each is drawn in her own half from her own tags, and the scene over the whole picture.
 *
 * Told as one prompt, the checkpoint swapped their hair, glasses and clothes between them; drawn
 * in halves, each kept her own. The tier has been settled for the pair already.
 */
export function buildDuoPhotoPrompt(
  sender: Character,
  friend: Character,
  tier: PhotoTier,
  photoPrompt: string
): DuoPhotoPrompts {
  const named = withoutNames(sender, senderAsHer(sender, friendAsFriend(friend, photoPrompt.trim())))
  const scene = withoutTouching(shopNotDrink(drinkNotLiquid(plainColours(named))))
  const text = scene.toLowerCase()
  const bare = tier === 'explicit'

  const pose = photoPose(scene, bare)
  const posture = pose.tags.filter((tag) => DUO_POSTURE.has(tag))
  const framing = duoFraming(text)

  // Selfies: the phone is hers, and only her half reaches for it.
  const selfie = says(text, 'selfie')
  const mirror = selfie && says(text, 'mirror')
  const lying = posture.includes('lying')
  const holds = mirror
    ? ['holding_phone']
    : selfie && !lying
      ? ['selfie', 'outstretched_arm']
      : []
  const phoneNegative = selfie && !mirror ? ['phone', 'cellphone', 'smartphone', 'holding_phone'] : []

  // A selfie lying down did not hold for two, so it is said as the photo it is drawn as.
  const sentence = lookingAtViewer(
    withoutWhoTookIt(withoutCameraHold(lying ? scene.replace(/\bselfie\b/gi, 'photo') : scene))
  )
    .replace(WORN_CLAUSE, '')
    .replace(/[.!?]+$/, '')

  const shared = [...framing.tags]
  const sceneTags = [
    `${PHOTO_QUALITY}, 2girls, multiple_girls, depth_of_field`,
    sentence,
    'side by side',
    ...framing.scene,
    ...(mirror ? ['mirror', 'reflection'] : []),
    ...shared
  ]

  const faces = duoExpression(text)
  const left = duoHalf(sender, tier, scene, posture, [...faces, ...shared, ...holds])
  const right = duoHalf(friend, tier, scene, posture, [...faces, ...shared])
  const worn = `${scene} ${left.worn} ${right.worn}`
  const negative = [
    PHOTO_NEGATIVE.replace('multiple_girls, 2girls, ', ''),
    '3girls',
    ...(bare ? [] : dressedNegative(worn.toLowerCase().replace(/_/g, ' '), tier === 'everyday')),
    ...SPILL_NEGATIVE.filter(([, said]) => !said.test(text)).map(([tag]) => tag),
    ...phoneNegative,
    ...(mirror || saysAny(text, ['camera']) ? [] : ['camera']),
    ...new Set([...bodyNegative(sender), ...bodyNegative(friend)])
  ].join(', ')

  return {
    scene: sceneTags.filter((part) => part.length > 0).join(', '),
    left: left.prompt,
    right: right.prompt,
    negative
  }
}
