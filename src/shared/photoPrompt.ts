import {
  pronounsOf,
  genderOf,
  genderedTags,
  photoRuleText,
  photoSubject
} from './photoGender'
import { maleTopBare, type PhotoTier } from './photoGate'
import {
  DORM_IDS,
  dormLabel,
  LOCATIONS,
  NARRATIVE_LOCATIONS,
  type Character
} from '@vx/modkit/shared'
import { bodyAppearance, bodyNegative, bodyOf } from './characterBody'
import {
  bodyTagsFor,
  describesNothingOn,
  partialExposureIn,
  type PartialPhotoExposure
} from './photoBody'
import { framingInTags, framingOf, type Framing } from './photoFraming'
import {
  PHOTO_CLAUSE_END,
  photoPose,
  withoutCameraHold,
  isMirrorSelfie,
  withoutHeldObject,
  withoutMirrorWords,
  withoutSelfieWord
} from './photoPose'
// Carries Photo's message and post augmentations into whatever imports this module. The
// project's `include` would reach it for the app, but `tsconfig.test.json` lists only the tests
// and pulls in what they import — so the feature brings its own types rather than relying on a
// tsconfig line, which would be one more thing to re-add on a sync.
import type { PhotoCouple, PhotoOrientation } from './photoTypes'
import {
  photoWardrobe,
  photoWardrobeNames,
  photoWardrobeFromGarment,
  filterPhotoWardrobe
} from './photoWardrobe'
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

function photoBase(character: Character): string {
  return [...photoSubject(character), 'solo', 'depth_of_field'].join(', ')
}

/** Count bans follow the actual cast; SFW anatomy guards are added separately. */
function peopleNegative(people: readonly Character[], bare: boolean): string {
  const boys = people.filter((person) => genderOf(person) === 'male').length
  const girls = people.length - boys
  const tags =
    people.length === 1
      ? boys
        ? ['1girl', 'breasts', 'multiple_boys', 'multiple_girls', '2boys', '2girls']
        : ['1boy', 'multiple_boys', 'multiple_girls', '2girls']
      : boys === 0
        ? ['1boy', 'multiple_boys']
        : girls === 0
          ? ['1girl', 'breasts', 'multiple_girls', '3boys']
          : ['2girls', '2boys', 'multiple_girls', 'multiple_boys', '3girls', '3boys']
  return [...tags, 'hetero', ...(!bare || boys === 0 ? ['penis'] : []), 'sex'].join(', ')
}

/** What no phone photo may be. A sprite's white cut-out background is the enemy here. */
const PHOTO_NEGATIVE =
  'worst_quality, bad_quality, lowres, simple_background, white_background, transparent_background, ' +
  'multiple_views, reference_sheet, english_text, speech_bubble, artist_name, watermark, signature, ' +
  // Count bans are filled from the actual cast.
  '__PEOPLE__, ' +
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
function dressedNegative(text: string, everyday: boolean, strict = false): string[] {
  const kept = DRESSED_NEGATIVE.filter(([, said]) => strict || !said.test(text)).map(([tag]) => tag)
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
  'raincoat',
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

/** These go with her set rather than replacing it. */
const ACCESSORIES = [
  'hat',
  'beanie',
  'cap',
  'scarf',
  'glasses',
  'sunglasses',
  'earrings',
  'necklace',
  'choker',
  'bracelet',
  'ring',
  'bag',
  'purse',
  'backpack',
  'hair clip',
  'ribbon',
  'headphones',
  'watch'
]

/** A garment or outfit, apart from words that can introduce an accessory alone. */
const GARMENT_WORDS = CLOTHING_WORDS.filter((word) => word !== 'wearing' && word !== 'dressed')

/** Whether her description dresses her, in which case her everyday wardrobe stays out of it. */
function describesClothing(photoPrompt: string): boolean {
  // "on top of the bed" is a place, not something she has on.
  const text = photoPrompt.toLowerCase().replace(/\btop of\b/g, '')
  return (
    saysAny(text, GARMENT_WORDS) ||
    (!saysAny(text, ACCESSORIES) && saysAny(text, ['wearing', 'dressed']))
  )
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
  return (
    [
      `${character.firstName} ${character.lastName}`,
      character.firstName,
      character.lastName,
      ...DORM_IDS.map(dormLabel),
      ...places
    ]
      .filter((name) => name.length > 2)
      // Longest first, so a full name goes before either half of it does.
      .sort((a, b) => b.length - a.length)
  )
}

/** Escapes a name for use inside a regular expression. */
function escaped(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Her appearance with her body in it, as a photo draws it. A guy's chest is said only as
 * `pectorals` where he has them: `flat_chest` in his prompt is a tag for a girl's chest.
 */
function photoAppearance(character: Character): string[] {
  const appearance = bodyAppearance(character, 'photo')
  return genderOf(character) === 'male'
    ? appearance.filter((tag) => tag !== 'flat_chest')
    : appearance
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
  if (/\b(?:her|his|a|film)\s+camera\b|\bpolaroid\b/i.test(scene)) return scene
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
  const person =
    '(?:friend|roommate|bestie|best friend|boyfriend|girlfriend|brother|sister|mom|dad)'
  const taker = `(?:(?:a|her|my|his|the)\\s+${person}|somebody|someone)`
  const takenBy = new RegExp(`\\s*,?\\s*(?:taken|shot|snapped)\\s+by\\s+${taker}\\b`, 'gi')
  const tookOf = new RegExp(
    `\\b(?:that\\s+)?${taker}\\s+(?:took|snapped|shot)(?:\\s+of\\s+(?:her|him|me))?\\s*`,
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

/** A named outfit has already become tags; keep the place and action around its name. */
function withoutOutfitName(scene: string, names: readonly string[]): string {
  if (names.length === 0) return scene
  const named = names
    .map(escaped)
    .sort((a, b) => b.length - a.length)
    .join('|')
  const reference = new RegExp(
    `\\b(?:(?:dressed\\s+in|wearing|in|of)\\s+)?(?:(?:her|his|their)\\s+)?(?:own\\s+)?` +
      `(?:["“])?(?:${named})(?:s|es)?(?![a-z0-9])(?:["”])?` +
      '(?:\\s+(?:clothes|cloth|outfit)\\b)?',
    'gi'
  )
  return scene
    .replace(reference, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
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
  const scene = shopNotDrink(
    drinkNotLiquid(plainColours(withoutNames(character, senderAsHer(character, photoPrompt.trim()))))
  )
  // The one question the rest is answered from, and the gate alone decides it.
  const bare = tier === 'explicit'
  const dressed = describesClothing(scene)

  const pose = photoPose(scene, tier, genderOf(character))
  // An everyday photo is seen by everyone: a hoodie slipping off a shoulder there is how she
  // wears it, not her undressing, and the tags pulled the picture towards it.
  if (tier === 'everyday') pose.tags = pose.tags.filter((tag) => !EVERYDAY_DROPS.has(tag))
  // Her body as far as the shot reaches: a selfie from the waist up names no hips.
  const selected = wardrobeForPhoto(character, tier, scene, dressed, framingInTags(pose.tags))
  const body = bodyTagsFor(
    bodyOf(character),
    scene,
    bare,
    framingInTags(pose.tags),
    selected.exposure,
    genderOf(character)
  )
  const caption = withoutOutfitName(scene, selected.names)

  // A close-up of her face: her outfit pulled the camera back to show it, so only her top stays,
  // unweighted, to keep her dressed at the neckline.
  const face = !bare && saysAny(photoRuleText(scene), FACE_SHOT_CUES)
  const shown = face ? faceShotTags(pose.tags) : pose.tags
  const worn = face ? faceShotTop(selected.tags) : selected.tags
  const wardrobe = plainColours((face ? worn : worn.map(heldColour)).join(', '))

  // Her appearance, with her build and her chest in it while the body switch is on. It opens on
  // the subject tag where she has one, so the base does not say it a second time.
  const appearance = photoAppearance(character)
  const base = photoBase(character)
    .split(', ')
    .filter((tag) => !appearance.includes(tag))
    .join(', ')

  // Read off everything the picture will be told she wears, her own tags and outfit included.
  const told = `${appearance.join(' ')} ${wardrobe} ${scene}`

  // A pose tag her clothes already carry, "clothes_pull" from a pulled neckline, is said once.
  const earlier = new Set(
    [...appearance, ...(face ? [] : body), ...wardrobe.split(/,\s*/)].map((tag) =>
      tag.replace(/^\(|:[\d.]+\)$/g, '').trim()
    )
  )
  // Knees up is drawn with `cowboy_shot` only standing; on the floor, a bed or a chair it is left
  // to the sentence. The framing still decides what of her outfit and body is in shot.
  const notStanding = shown.some((tag) => NOT_STANDING.has(tag))
  const posed = shown.filter((tag) => !earlier.has(tag) && !(notStanding && tag === 'cowboy_shot'))

  const positive = [
    `${PHOTO_QUALITY}, ${base}`,
    appearance.join(', '),
    face ? '' : genderedTags(body, genderOf(character)).join(', '),
    wardrobe,
    // The sentence's own full stop would sit in front of the tags that follow it.
    [
      lookingAtViewer(
        withoutMirrorWords(
          withoutSelfieWord(withoutHeldObject(withoutCameraHold(withoutWhoTookIt(caption))))
        )
      ).replace(/[.!?]+$/, ''),
      posed.join(', ')
    ]
      .filter((part) => part.length > 0)
      .join(', ')
  ]
    .filter((group) => group.length > 0)
    .join(',\n\n')

  const negative = [
    PHOTO_NEGATIVE.replace('__PEOPLE__', peopleNegative([character], bare)),
    ...(bare
      ? []
      : dressedNegative(
          told.toLowerCase().replace(/_/g, ' '),
          tier === 'everyday',
          genderOf(character) === 'male'
        )),
    ...SPILL_NEGATIVE.filter(([, said]) => !said.test(photoRuleText(scene))).map(([tag]) => tag),
    ...pose.negative,
    ...bodyNegative(character),
    ...(character.negativeTags ?? []).filter(
      (tag) =>
        !photoSubject(character).includes(tag) &&
        !(bare && genderOf(character) === 'male' && tag === 'penis')
    )
  ].join(', ')
  return { positive, negative }
}

/** A caption asking for her face itself, filling the picture; a plain "close-up" is not one. */
const FACE_SHOT_CUES = [
  'close-up of her face',
  'close up of her face',
  'closeup of her face',
  'close-up selfie of her face',
  'her face up close',
  'face shot',
  'face only',
  'just her face',
  'headshot',
  'her face filling'
]

/** Poses that are not standing: `cowboy_shot` is a standing framing and is kept off them. */
const NOT_STANDING: ReadonlySet<string> = new Set([
  'sitting',
  'kneeling',
  'lying',
  'on_back',
  'on_side',
  'on_stomach',
  'all_fours',
  'squatting',
  'seiza',
  'indian_style'
])

/** Where the rest of the photo would put her body, her arms and the camera, out of a face shot. */
const NOT_IN_A_FACE_SHOT: ReadonlySet<string> = new Set([
  'close-up',
  'portrait',
  'upper_body',
  '(upper_body:1.3)',
  'cowboy_shot',
  'full_body',
  'lower_body',
  'outstretched_arm',
  '(outstretched_arm:1.2)',
  'foreshortening',
  'hand_up',
  'hands_on_lap',
  'hand_on_own_hip',
  'hands_on_own_thighs',
  'arms_at_sides'
])

/** A face shot's tags: her face, her look and her gesture, framed as close as same-seed checks held. */
function faceShotTags(tags: readonly string[]): string[] {
  return [
    ...tags.filter((tag) => !NOT_IN_A_FACE_SHOT.has(tag)),
    '(close-up:1.4)',
    '(portrait:1.3)',
    'face_focus'
  ]
}

/**
 * The one garment a face shot keeps: what she wears at her neckline, under any jacket or
 * cardigan, unweighted. Her first outfit tag was as often a belt, a choker or `bare_shoulders`.
 */
function faceShotTop(outfit: readonly string[]): string[] {
  const plain = outfit.map(withoutWeight)
  const tops = plain.filter((tag) => TOP_GARMENT.test(tag))
  const under = tops.find((tag) => !/cardigan|hoodie/.test(tag))
  const over = plain.find((tag) => /jacket|blazer|coat|cardigan|hoodie/.test(tag))
  const top = under ?? tops[0] ?? over
  return top ? [top] : []
}

function withoutWeight(tag: string): string {
  return tag.replace(/^\((.*):[\d.]+\)$/, '$1')
}

/** Her set and the reveal it carries, with names removed only when their tags were supplied. */
function wardrobeForPhoto(
  character: Character,
  tier: PhotoTier,
  scene: string,
  captionDressesHer: boolean,
  framing: Framing | null = framingOf(scene)
): { tags: readonly string[]; names: readonly string[]; exposure?: PartialPhotoExposure } {
  const bare = tier === 'explicit'
  const named = photoWardrobeNames(character, scene)
  const reveals = bare
    ? displacedTags(scene).map((tag) =>
        genderOf(character) === 'male' &&
        ['panty_pull', 'panties_aside', 'no_panties'].includes(tag)
          ? 'pants_pull'
          : tag
      )
    : []
  const partial =
    bare &&
    (captionDressesHer || named.length > 0 || reveals.length > 0) &&
    !describesNothingOn(scene)
  const names = !bare || partial ? named : []
  const outfit =
    !bare || names.length > 0
      ? (photoWardrobe(character, scene, captionDressesHer, tier !== 'everyday') ?? [])
      : partial
        ? (photoWardrobeFromGarment(character, scene) ?? [])
        : []
  const exposure = partial ? partialExposureIn(scene, reveals, outfit) : undefined
  const visibleOutfit = filterPhotoWardrobe(outfit, scene, framing)
  const male = genderOf(character) === 'male'
  const shirtless = male && maleTopBare(scene)
  const tags = bare
    ? partial
      ? [
          ...visibleOutfit,
          'partially_undressed',
          ...reveals,
          ...(exposure?.upper ? [male ? 'bare_chest' : 'breasts_out'] : []),
          ...(exposure?.bottomless ? ['bottomless'] : []),
          BARE_POSITIVE
        ]
      : [
          'nude',
          'completely_nude',
          BARE_POSITIVE,
          ...(male ? ['bare_arms', 'bare_legs', 'bare_shoulders', 'barefoot'] : [])
        ]
    : [...visibleOutfit, ...(tier === 'suggestive' ? suggestiveReveals(scene) : [])]
  const gendered = genderedTags(tags, genderOf(character)).filter(
    (tag) => !(male && /^(?:bra|panty|panties|no_panties|underboob)/.test(tag))
  )
  const shown = shirtless
    ? [
        ...gendered.filter(
          (tag) =>
            !/shirt|blouse|hoodie|sweater|cardigan|jacket|coat|top|vest|dress|uniform|clothes/.test(
              tag
            )
        ),
        'bare_chest',
        'bare_arms',
        'bare_shoulders'
      ]
    : gendered
  return { tags: [...new Set(shown)], names, exposure }
}

/** Pose tags an everyday photo never carries. */
const EVERYDAY_DROPS: ReadonlySet<string> = new Set(['undressing', 'clothes_pull'])

/** A few describing words can sit between the garment and what moved it. */
const GARMENT_GAP = "(?:\\s+(?!to\\b|and\\b|while\\b|with\\b|beside\\b)[a-z'’-]+){0,4}?\\s+"
const LOWERED = '(?:pull(?:ing|ed) down|tugg(?:ing|ed) down|lower(?:ing|ed))'
const LIFTED =
  '(?:lift(?:ing|ed)|rais(?:ing|ed)|pull(?:ing|ed) up|push(?:ing|ed) up|' +
  'holding up|hiked up|hitched up|bunched)'
const ASIDE = '(?:pull(?:ing|ed) (?:to the side|aside)|tugg(?:ing|ed) aside|moved aside)'
const TOPS = ['shirt', 'top', 'blouse', 'sweater', 'hoodie', 'tank top', 'crop top']

/** Either word order: "lifting her shirt" or "her shirt lifted". */
function garmentMove(garments: readonly string[], motion: string): RegExp {
  const garment = `(?:${garments.map(escaped).join('|')})(?:s|es)?`
  return new RegExp(
    `\\b(?:${motion})\\b${GARMENT_GAP}${garment}\\b|` +
      `\\b${garment}\\b${GARMENT_GAP}(?:${motion})\\b`
  )
}

interface RevealRule {
  readonly words: RegExp
  readonly tags: readonly string[]
  readonly needs?: readonly string[]
}

/** What she has moved aside or opened, with the direction deciding the reveal. */
const DISPLACEMENTS: readonly RevealRule[] = [
  { words: garmentMove([...TOPS, 'neckline', 'dress'], LOWERED), tags: ['clothes_pull'] },
  { words: garmentMove(TOPS, LIFTED), tags: ['shirt_lift'] },
  { words: garmentMove(['skirt', 'dress'], LIFTED), tags: ['skirt_lift'] },
  { words: garmentMove(['skirt', 'dress'], ASIDE), tags: ['skirt_lift'] },
  {
    words: garmentMove(['thong', 'panties', 'underwear', 'g-string', 'bikini bottom'], ASIDE),
    tags: ['panties_aside']
  },
  {
    words: garmentMove(['thong', 'panties', 'underwear', 'g-string', 'bikini bottom'], LOWERED),
    tags: ['panty_pull']
  },
  {
    words: garmentMove(['shorts', 'pants', 'trousers', 'boxers', 'briefs'], LOWERED),
    tags: ['pants_pull']
  },
  { words: garmentMove(['bra', 'bikini top'], LIFTED), tags: ['bra_lift'] },
  { words: garmentMove(['bra', 'bikini top'], LOWERED), tags: ['bra_pull'] },
  {
    words: garmentMove(['shirt', 'blouse'], '(?:open|unbuttoned|unbuttoning)'),
    tags: ['open_shirt']
  },
  { words: /\b(?:unbuttoned|unbuttoning|open clothes|clothes open)\b/, tags: ['open_clothes'] },
  {
    words: new RegExp(
      '\\b(?:bare|baring|bared|show(?:ing|n)?|expos(?:e|ing|ed)|' +
        'reveal(?:ing|ed)?|uncover(?:ing|ed)?)\\b' +
        "(?:\\s+[a-z'’-]+){0,3}\\s+(?:breasts?|boobs?|chest)\\b|" +
        "\\b(?:breasts?|boobs?|chest)\\b(?:\\s+[a-z'’-]+){0,3}\\s+" +
        '(?:bare|bared|shown|exposed|uncovered)\\b'
    ),
    tags: ['breasts_out']
  },
  { words: /\bunderboob\b/, tags: ['underboob'] },
  { words: /\btopless\b/, tags: ['breasts_out'] },
  { words: /\bbottomless\b/, tags: ['bottomless'] },
  {
    words: garmentMove(
      ['panties', 'underwear', 'thong'],
      '(?:removed|removing|took off|taken off|no)'
    ),
    tags: ['no_panties']
  },
  {
    words: /\bpanties\b(?:\s+[a-z'’-]+){0,2}\s+around (?:her |one )?(?:ankles?|knees?|legs?)\b/,
    tags: ['panty_pull']
  },
  {
    words: /\bpanties\b(?:\s+[a-z'’-]+){0,2}\s+around (?:her )?one leg\b/,
    tags: ['panties_around_one_leg']
  },
  {
    words: new RegExp(
      "\\b(?:bare|expos(?:e|ing|ed)|show(?:ing|n)?)(?:\\s+[a-z'’-]+){0,3}\\s+(?:slit|pussy)\\b|" +
        "\\b(?:slit|pussy)\\b(?:\\s+[a-z'’-]+){0,3}\\s+(?:bare|showing|shown|exposed)\\b"
    ),
    tags: ['pussy']
  }
]

/** The non-explicit reveals allowed beside a suggestive photo's outfit. */
const SUGGESTIVE_REVEALS: readonly RevealRule[] = [
  {
    words: new RegExp(
      '\\boff[- ]shoulder\\b|\\b(?:sweater|top|shirt|blouse)\\b' +
        "(?:\\s+[a-z'’-]+){0,4}\\s+off(?:\\s+[a-z'’-]+){0,3}\\s+shoulder\\b"
    ),
    tags: ['off_shoulder']
  },
  {
    words: /\bstraps?\b(?:\s+[a-z'’-]+){0,3}\s+(?:slipp(?:ing|ed)|slid(?:ing)?)\s+down\b/,
    tags: ['strap_slip']
  },
  {
    words: garmentMove(TOPS, LIFTED),
    needs: ['bra', 'stomach', 'midriff', 'belly'],
    tags: ['shirt_lift', 'bra']
  },
  { words: garmentMove(['neckline'], '(?:tugg(?:ing|ed)|pull(?:ing|ed))'), tags: ['clothes_pull'] },
  {
    words: garmentMove(['skirt'], `(?:${LIFTED}|flipp(?:ing|ed))`),
    needs: ['panties', 'underwear', 'thong'],
    tags: ['skirt_lift', 'panties']
  }
]

/** Every matching reveal from the tier's own table. */
function revealTags(scene: string, table: readonly RevealRule[]): string[] {
  const text = photoRuleText(scene)
  return [
    ...new Set(
      table
        .filter((row) => row.words.test(text) && (!row.needs || saysAny(text, row.needs)))
        .flatMap((row) => row.tags)
    )
  ]
}

/** The garments a caption has her wearing but out of the way, as tags. */
function displacedTags(scene: string): string[] {
  const tags = revealTags(scene, DISPLACEMENTS)
  // A movement without a named garment still asks for clothes pulled out of the way.
  const moved = new RegExp(
    `\\b(?:${LOWERED}|${LIFTED}|${ASIDE}|pull(?:ing|ed)|tugg(?:ing|ed)|pushed aside)\\b`,
    'i'
  )
  if (!tags.some((tag) => tag !== 'breasts_out' && tag !== 'underboob') && moved.test(scene)) {
    tags.push('clothes_pull')
  }
  return tags
}

/** Suggestive reveals come only from the clothed subset. */
function suggestiveReveals(scene: string): string[] {
  return revealTags(scene, SUGGESTIVE_REVEALS)
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
  // A kiss she blows at the camera touches nobody, and goes to her half as a gesture.
  '\\s*,?\\s*\\b(?:hugg\\w*|hugs?|cuddl\\w*|snuggl\\w*|embrac\\w*|(?<!blowing a |blows a )kiss\\w*|' +
    'holding hands|hand in hand|' +
    'arm in arm|arms? (?:around|linked|wrapped)|leaning (?:on|against) (?:each other|her)|' +
    'cheek to cheek|head on (?:her|each other)\\S*\\s+shoulder)' +
    `[^,.;]*?(?=\\s+and\\s|${PHOTO_CLAUSE_END})`,
  'gi'
)

/** The sentence without the two of them touching. */
export function withoutTouching(scene: string): string {
  return scene
    .replace(TOUCHING, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim()
}

/**
 * What a sentence says they wear, taken out of a picture of two: said over the whole picture, the
 * two split it between them, and one in an open shirt over another's camisole was left in nothing
 * under it. Each half is dressed from her own wardrobe instead.
 */
const WORN_CLAUSE = new RegExp(
  ',?\\s*\\b(?:wearing|dressed in|in (?:their|her|his|matching)\\b)' +
    `[^,.;]*?(?=\\s+(?:wearing|dressed in)\\b|${PHOTO_CLAUSE_END})`,
  'gi'
)

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
  [/\bsmil/i, ['smile']],
  [/\beyes closed|\bclosed eyes|\bclosing her eyes/i, ['closed_eyes']],
  [/\bhead tilt|\btilts? her head|\btilting her head/i, ['head_tilt']]
]

/**
 * The hands a caption gives one of them, by the same split as her face. Each held to its own half
 * in testing; a gesture said for both is drawn on both. Not `head_rest`: tagged, her elbow came
 * into her friend's half and the two of them merged. Untagged, her chin on her hand is mostly left
 * out of the picture, which is the lesser fault.
 */
const DUO_GESTURES: readonly [RegExp, readonly string[]][] = [
  [/\bpeace sign|\bv sign|\btwo fingers (?:up|raised)|\braising two fingers/i, ['v']],
  [/\bthumbs? up/i, ['thumbs_up']],
  [
    /\bhand on her cheek|\bhand to her cheek|\bcheek in her hand|\bresting a hand on her cheek/i,
    ['hand_on_own_cheek']
  ],
  [/\bheart with her hands|\bheart hands|\bhand heart/i, ['heart_hands']],
  [/\bwaving|\bwaves\b/i, ['waving']],
  [/\barms crossed|\bcrossed arms|\bcrossing her arms/i, ['crossed_arms']],
  [/\bblow(?:s|ing) a kiss/i, ['blowing_kiss']]
]

/** The faces one stretch of caption names, or none. */
function facesIn(text: string): string[] {
  text = photoRuleText(text)
  const said = DUO_EXPRESSIONS.filter(([words]) => words.test(text)).flatMap(([, tags]) => tags)
  return said.length > 0 ? [...new Set(said)] : []
}

/** The gestures one stretch of caption names, or none. */
function gesturesIn(text: string): string[] {
  text = photoRuleText(text)
  return [
    ...new Set(DUO_GESTURES.filter(([words]) => words.test(text)).flatMap(([, tags]) => tags))
  ]
}

function withBlush(faces: readonly string[], text: string): string[] {
  return [...faces, ...(/\bblush/i.test(text) ? ['blush'] : [])]
}

/** "Her …" and "… her friend …" joined in one clause: each girl's own words. */
const FRIEND_CLAUSE = /([^,.;]*?)\s*\b(?:while|and|as|with|but)\s+her friend\b([^,.;]*)/gi

/**
 * Each girl's face and hands, left (hers) and right (her friend's). A caption that gives her
 * friend a face or a gesture of her own, "her smiling softly while her friend grins", is split
 * there; otherwise both carry whatever the caption names, and a smile where it names none.
 */
function duoExpressions(text: string): { left: string[]; right: string[] } {
  // "Her and her friend sitting…" opens most captions; the clause that gives her friend a face is
  // the one that splits them.
  const own = (part: string): string[] => [
    ...facesIn(part),
    ...gesturesIn(part),
    ...(/\bblush/i.test(part) ? ['blush'] : [])
  ]
  // "Her and her friend", "a photo of me and her friend": the two of them together wherever it
  // stands, not a split. Only a later "while her friend …" gives her friend words of her own.
  const shared = text
    .replace(/\b(?:her|she|me|i)\s+and\s+her friend\b/gi, 'the two of them')
    .replace(/\bher friend\s+and\s+(?:her|me|i)\b/gi, 'the two of them')
  // "her friend gives an awkward, shy smile", "her friend, cheeks red, grins": the short runs
  // after a comma still describe her friend, up to two, as long as they name nobody else.
  const clauses = [...shared.matchAll(FRIEND_CLAUSE)].map((one) => {
    let theirs = one[2]
    let after = shared.slice((one.index ?? 0) + one[0].length)
    for (let step = 0; step < 2 && own(theirs).length === 0; step++) {
      const next = /^,([^,.;]*)/.exec(after)?.[1]
      if (next === undefined || next.trim().split(/\s+/).length > 3) break
      if (/\b(?:her|she|both|they|them|me|i)\b/i.test(next)) break
      theirs = `${theirs},${next}`
      after = after.slice(next.length + 1)
    }
    return { hers: one[1], theirs }
  })
  // Either one's own words split them: "her waving while her friend gives a shy look".
  const clause = clauses.find((one) => own(one.theirs).length > 0 || own(one.hers).length > 0)
  if (clause) {
    const rest = shared.replace(clause.theirs, '')
    // "…, both laughing" and "her and her friend laughing…" are said of the two of them, whoever
    // else has words of her own; the latter only up to where one of them is singled out.
    const together = rest
      .split(/[,.;]/)
      .map((part) =>
        /\bboth\b/i.test(part)
          ? part
          : /\bthe two of them\b/i.test(part)
            ? part.split(/\b(?:with|while|her|me|i)\b/i)[0]
            : ''
      )
      .join(',')
    const hers = facesIn(clause.hers).length > 0 ? facesIn(clause.hers) : facesIn(rest)
    const hands = gesturesIn(clause.hers).length > 0 ? gesturesIn(clause.hers) : gesturesIn(rest)
    const theirs = [...new Set([...facesIn(clause.theirs), ...facesIn(together)])]
    const mine = [...new Set([...hers, ...facesIn(together)])]
    return {
      left: withBlush([...(mine.length > 0 ? mine : ['smile']), ...hands], clause.hers),
      right: withBlush(
        [
          ...(theirs.length > 0 ? theirs : ['smile']),
          ...new Set([...gesturesIn(clause.theirs), ...gesturesIn(together)])
        ],
        clause.theirs
      )
    }
  }
  const both = withBlush(
    [...(facesIn(text).length > 0 ? facesIn(text) : ['smile']), ...gesturesIn(text)],
    text
  )
  return { left: both, right: both }
}

/**
 * What is at or below her waist: out of a picture of two drawn from the waist up. A skirt, jeans
 * or a belt in either half drew both of them down to the hips, where their sides met and fused.
 */
const BELOW_WAIST =
  /(?:thigh[_\s-]?high|socks?|stockings?|pantyhose|tights|legwear|leggings|shoes|sneakers|boots|heels|loafers|sandals|mary_janes|skirt|jeans|pants|trousers|shorts|bottoms?|buruma|bloomers|belt|^navel$|^midriff$|^thighs$|^bare_legs$)/i

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
function duoFraming(text: string, armOut = false): { tags: string[]; scene: string[] } {
  if (
    saysAny(text, ['from behind', 'back view', 'backs to', 'looking back', 'over her shoulder'])
  ) {
    // Each half turns on its own, and one of them faced the camera unless both were told.
    return {
      tags: ['(from_behind:1.3)', 'looking_back', '(upper_body:1.3)'],
      scene: ['both with their backs to the viewer']
    }
  }
  // A close-up needed the framing weighted in both halves before either was drawn close.
  if (framingOf(text) === 'face') {
    return { tags: ['(close-up:1.3)', '(portrait:1.3)'], scene: [] }
  }
  // A held-out arm needs room: waist up cropped it out of the picture. A close-up stays close.
  if (armOut && !saysAny(text, ['close-up', 'close up', 'closeup'])) {
    return { tags: ['cowboy_shot'], scene: ['same height'] }
  }
  // Waist up, always: a whole-body shot of two drew one of them smaller, as if a step behind,
  // and her legs folded to fit her half. A close-up keeps the weighted framing; any other shot
  // takes it plain. No room is asked between them: the words fenced each into a boxed-off corner.
  if (saysAny(text, ['close-up', 'close up', 'closeup'])) {
    return { tags: ['(upper_body:1.3)'], scene: ['same height'] }
  }
  return { tags: ['upper_body'], scene: ['same height'] }
}

/**
 * A dress said without its length. Beside a friend in a top, "long dress" drew her down to the
 * thighs while her friend stopped at the waist, as if a step behind.
 */
function waistUpDress(tag: string): string {
  if (!/dress|gown/i.test(tag)) return tag
  return tag
    .replace(/(?<![a-z])(?:long|maxi|floor[-_ ]length|ankle[-_ ]length)[-_ ]?/gi, '')
    .replace(/([(_ ])[-_ ]+/g, '$1')
}

/**
 * One person's half under ppm's attention mask, opening on their own subject: `1girl` or `1boy`,
 * never `solo`. The picture's head count is the scene's alone; said in both halves it named no
 * side, and a guy's looks could land on her body and hers on his.
 */
function duoHalf(
  girl: Character,
  tier: PhotoTier,
  scene: string,
  posture: readonly string[],
  extra: readonly string[]
): { prompt: string; worn: string; names: readonly string[] } {
  const bare = tier === 'explicit'
  const dressed = bare && describesClothing(scene)
  const alone = (tag: string): boolean =>
    tag === '1girl' || tag === '1boy' || SOLO_TAGS.has(tag)
  // Her hair colour weighted: two people under one attention, it held only weighted, the
  // other's colour landing on her otherwise. Length and style tags stay as they are.
  const appearance = photoAppearance(girl)
    .filter((tag) => !alone(tag))
    .map((tag) => (isHairColourTag(tag) ? `(${tag}:1.3)` : tag))
  const selected = wardrobeForPhoto(girl, tier, scene, dressed)
  const body = bodyTagsFor(
    bodyOf(girl),
    scene,
    bare,
    'waist',
    selected.exposure,
    genderOf(girl)
  ).filter((tag) => bare || !BELOW_WAIST.test(tag))
  const wardrobe = selected.tags
    .filter((tag) => bare || !BELOW_WAIST.test(tag))
    .map((tag) => (bare ? tag : waistUpDress(tag)))
    .map(heldColour)
  return {
    prompt: plainColours(
      [
        PHOTO_QUALITY,
        genderOf(girl) === 'male' ? '1boy' : '1girl',
        ...appearance,
        ...photoSubject(girl).filter((tag) => !alone(tag) && !appearance.includes(tag)),
        ...genderedTags(body, genderOf(girl)),
        ...wardrobe,
        ...posture,
        ...extra
      ].join(', ')
    ),
    worn: `${appearance.join(' ')} ${wardrobe.join(' ')}`,
    names: selected.names
  }
}

/**
 * The caption with her friend said as "her friend" rather than taken out like any other name:
 * "me and Ana at the cafe" read as "me and at the cafe".
 */
function friendAsFriend(friend: Character, scene: string, sender: Character): string {
  return [`${friend.firstName} ${friend.lastName}`, friend.firstName]
    .filter((name) => name.length > 2)
    .reduce(
      (text, name) =>
        text.replace(
          new RegExp(`\\b${escaped(name)}(?:['\u2019]s)?\\b`, 'gi'),
          `${pronounsOf(sender).their} friend`
        ),
      scene
    )
}

/**
 * The caption with the person in the photo said as "her" or "him": "Lia and her friend" taken
 * out like any other name left ", and her friend stand", and "A waist-up shot of Kai sitting"
 * left "A waist-up shot of sitting". A possessive becomes "her" or "his", and a sentence's first
 * word is capitalised.
 */
function senderAsHer(sender: Character, scene: string): string {
  const words = pronounsOf(sender)
  return [`${sender.firstName} ${sender.lastName}`, sender.firstName]
    .filter((name) => name.length > 2)
    .reduce(
      (text, name) =>
        text.replace(
          new RegExp(`\\b${escaped(name)}(['\u2019]s)?\\b`, 'gi'),
          (_said: string, owned: string | undefined, at: number, whole: string) => {
            const first = at === 0 || /[.!?]\s*$/.test(whole.slice(0, at))
            return owned
              ? first ? words.Their : words.their
              : first ? words.Them : words.them
          }
        ),
      scene
    )
}

/** Hair tags that name a length, texture or style rather than a colour. */
const NOT_HAIR_COLOURS: ReadonlySet<string> = new Set([
  ...['very_short', 'short', 'medium', 'long', 'very_long', 'absurdly_long'].map((length) => `${length}_hair`),
  ...['straight', 'wavy', 'curly', 'messy', 'spiked'].map((texture) => `${texture}_hair`),
  'drill_hair', 'parted_hair', 'multicolored_hair', 'two-tone_hair', 'streaked_hair', 'gradient_hair',
  'colored_inner_hair', 'floating_hair', 'wet_hair', 'big_hair'
])

/** Whether a tag names a hair colour, `dark_blue_hair` or `silver_hair` alike. */
function isHairColourTag(tag: string): boolean {
  return tag.endsWith('_hair') && tag.length > '_hair'.length && !NOT_HAIR_COLOURS.has(tag)
}

/** Hair tagged in two colours, kept out of a picture of two whose people are not. */
const TWO_TONE: readonly string[] = ['multicolored_hair', 'two-tone_hair']

/** Tags that say a picture holds one person, which a half seen over the whole picture drops. */
const SOLO_TAGS: ReadonlySet<string> = new Set(['solo', 'male_focus'])

/** Who a picture of these two holds, as a head count: `2girls`, `1girl, 1boy` or `2boys`. */
export function duoHeadCount(sender: Character, friend: Character): string[] {
  const boys = [sender, friend].filter((person) => genderOf(person) === 'male').length
  return boys === 0
    ? ['2girls', 'multiple_girls']
    : boys === 2
      ? ['2boys', 'multiple_boys']
      : ['1girl', '1boy']
}

/**
 * The face pass's own words: the eyes and what is worn over them, then what is on the face's own
 * skin, which a redraw left unsaid smoothed away: its tone, facial hair, marks and makeup.
 */
const FACE_PASS_TAG =
  /(?:^|[_ ])eyes$|^heterochromia$|glasses|eyewear|^monocle$|^tan$|^tanlines$|[_ ]skin$|stubble|beard|mustache|goatee|freckles|^mole|(?:^|[_ ])scar(?:[_ ]|$)|facial[_ ]mark|lipstick|eyeshadow|eyeliner|^makeup$|eyelashes/

/** The expressions a face pass keeps, beside the ones a caption of two is read for. */
const FACE_EXPRESSIONS: ReadonlySet<string> = new Set([
  ...DUO_EXPRESSIONS.flatMap(([, tags]) => tags),
  'blush',
  'seductive_smile',
  'light_smile',
  'frown',
  'surprised',
  'crying',
  'tears'
])

/**
 * One person's prompt cut down to their face, for the face pass of a photo of two: the quality
 * tags, their own subject alone, their eyes and any glasses, what is on the skin of their face,
 * and their expression. Hair, clothes, body and pose stay with the picture's own prompt; the pass
 * only redraws the face.
 */
export function faceHalfOf(half: string, person: Character): string {
  const own = genderOf(person) === 'male' ? ['1boy', 'solo', 'male_focus'] : ['1girl', 'solo']
  const face = half
    .split(/,\s*/)
    .map((tag) => tag.trim())
    .filter((tag) => {
      const bare = tag.replace(/^\(|:[\d.]+\)$/g, '').trim()
      return FACE_PASS_TAG.test(bare) || FACE_EXPRESSIONS.has(bare)
    })
  return [PHOTO_QUALITY, ...own, ...face].join(', ')
}

/** The scene's subject tags: the head count, then the adult tags for who is in it. */
function duoSubjects(sender: Character, friend: Character): string[] {
  const boys = [sender, friend].filter((person) => genderOf(person) === 'male').length
  return [
    ...duoHeadCount(sender, friend),
    ...(boys < 2 && boys > 0 ? ['mature_female'] : []),
    ...(boys > 0 ? ['mature_male'] : [])
  ]
}

/** Builds ppm prompts with each person's tags held to their own side by an attention mask. */
export function buildDuoPhotoPrompt(
  sender: Character,
  friend: Character,
  tier: PhotoTier,
  photoPrompt: string,
  _couple: PhotoCouple = 'ppm'
): DuoPhotoPrompts {
  const named = withoutNames(
    sender,
    senderAsHer(sender, friendAsFriend(friend, photoPrompt.trim(), sender))
  )
  const scene = withoutTouching(shopNotDrink(drinkNotLiquid(plainColours(named))))
  const text = photoRuleText(scene)
  const bare = tier === 'explicit'

  const pose = photoPose(scene, tier, genderOf(sender))
  const posture = pose.tags.filter((tag) => DUO_POSTURE.has(tag))
  // Selfies: the phone is hers, and only her half reaches for it.
  const mirror = isMirrorSelfie(text)
  const selfie = says(text, 'selfie') || mirror
  const lying = posture.includes('lying')
  const armOut = selfie && !mirror && !lying
  const framing = duoFraming(text, armOut)
  const holds = mirror
    ? ['holding_phone']
    : armOut
      ? ['selfie', '(outstretched_arm:1.3)', 'foreshortening']
      : []
  const phoneNegative =
    selfie && !mirror ? ['phone', 'cellphone', 'smartphone', 'holding_phone'] : []

  const shared = [...framing.tags]
  const faces = duoExpressions(photoRuleText(text))
  const left = duoHalf(sender, tier, scene, posture, [...faces.left, ...shared, ...holds])
  const right = duoHalf(friend, tier, scene, posture, [...faces.right, ...shared])
  const dressedScene = withoutOutfitName(scene, [...left.names, ...right.names])
  // A selfie lying down did not hold for two, so it is said as the photo it is drawn as.
  const sentence = lookingAtViewer(
    withoutWhoTookIt(
      withoutCameraHold(lying ? dressedScene.replace(/\bselfie\b/gi, 'photo') : dressedScene)
    )
  )
    // "in her room" is a place, even when a clothing clause follows it.
    .replace(WORN_CLAUSE, (clause) => (describesClothing(clause) ? '' : clause))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/[.!?]+$/, '')

  const sceneTags = [
    `${PHOTO_QUALITY}, ${duoSubjects(sender, friend).join(', ')}, depth_of_field`,
    sentence,
    'side by side',
    ...framing.scene,
    ...(mirror ? ['mirror'] : []),
    ...shared
  ]

  const worn = `${scene} ${left.worn} ${right.worn}`
  const negative = [
    PHOTO_NEGATIVE.replace('__PEOPLE__', peopleNegative([sender, friend], bare)),
    ...(genderOf(sender) === 'female' && genderOf(friend) === 'female' ? ['3girls'] : []),
    // One's colour bled into the other's ends as a streak; kept off unless either is tagged so.
    ...TWO_TONE.filter((tag) => ![sender, friend].some((one) => photoAppearance(one).includes(tag))),
    ...(bare
      ? []
      : dressedNegative(
          worn.toLowerCase().replace(/_/g, ' '),
          tier === 'everyday',
          genderOf(sender) === 'male' || genderOf(friend) === 'male'
        )),
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

/** The share of solo photos drawn wide where the shot fits either shape. */
const SOLO_WIDE_SHARE = 0.5

/**
 * The shape a new solo photo is drawn in, read off its finished prompt: a standing full-body shot
 * or a standing mirror selfie stays portrait, anything else is wide on half the rolls.
 */
export function soloOrientationOf(positive: string, roll: number): PhotoOrientation {
  const tags = new Set(positive.split(/,\s*/).map((tag) => tag.trim()))
  const standingTall = tags.has('standing') && (tags.has('full_body') || tags.has('mirror'))
  return !standingTall && roll < SOLO_WIDE_SHARE ? 'wide' : 'portrait'
}
