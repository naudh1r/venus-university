import type { CharacterBody } from './characterBody'
import type { Framing } from './photoFraming'
import { says, saysAny } from './photoWords'

/**
 * Which parts of her a photograph actually shows.
 *
 * Two questions, asked of the caption and answered before her body is written into a prompt.
 * What can the camera see from there — a picture taken from behind has no chest in it, and
 * naming one puts a second woman in the frame. And what is still covering her — a bra is not
 * nothing, so her chest is a shape rather than her nipples.
 *
 * Both answers narrow what gets said. Nothing here decides whether she is undressed at all:
 * that is the gate's, and arrives as `bare`.
 */

/**
 * The parts a photograph can frame or cover on its own. Her build and her chest are not among
 * them: they are how she is shaped, true of every picture of her, and ride in her appearance.
 */
type Region = 'bust' | 'nipples' | 'stomach' | 'hipsThighs' | 'buttocks' | 'pubic'
const REGIONS: readonly Region[] = ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic']

/** Always in shot, whatever the pose: the middle of her. */
const ALWAYS_SEEN: readonly Region[] = ['stomach']

/** What the front of her offers when the caption says nothing about which way she is turned. */
const SEEN_BY_DEFAULT: readonly Region[] = ['bust', 'nipples', 'pubic', 'hipsThighs']

/** A framing or a facing, and the parts it leaves in shot. First match wins. */
const FRAMING: readonly { cues: readonly string[]; seen: readonly Region[] }[] = [
  {
    // Shoulders up: nothing below her chest is in the picture at all.
    cues: ['waist up', 'upper body', 'bust shot', 'headshot', 'portrait', 'close-up', 'close up'],
    seen: ['bust', 'nipples']
  },
  {
    // Turned away and offered: her back, and what being bent over shows past it.
    cues: [
      'all fours',
      'hands and knees',
      'bent over',
      'bending over',
      'ass up',
      'presenting',
      'spreading her ass',
      'spreading her cheeks',
      'grabbing her ass'
    ],
    seen: ['buttocks', 'hipsThighs', 'pubic']
  },
  {
    // Turned away and upright: her back only.
    cues: ['from behind', 'back view', 'rear view', 'back turned', 'over her shoulder'],
    seen: ['buttocks', 'hipsThighs']
  },
  {
    // On her back with her legs up: everything, from underneath.
    cues: [
      'legs up',
      'legs in the air',
      'legs raised',
      'knees to her chest',
      'ankles up',
      'spread eagle',
      'spread-eagle'
    ],
    seen: ['bust', 'nipples', 'pubic', 'hipsThighs', 'buttocks']
  },
  {
    cues: ['on her back', 'onto her back', 'lying on her back', 'lying back', 'lying down'],
    seen: ['bust', 'nipples', 'pubic', 'hipsThighs']
  },
  {
    // Waist down: her face is not even in it.
    cues: ['waist down', 'lower body', 'bottomless', 'no bottoms'],
    seen: ['pubic', 'hipsThighs', 'buttocks']
  }
]

/** Her legs apart puts her between them in shot, whatever the base framing said. */
const SPREAD_CUES = [
  'spread legs',
  'legs apart',
  'legs open',
  'thighs spread',
  'legs spread',
  'spreading her pussy',
  'spread pussy'
]

/** Anything about her behind puts it in shot the same way. */
const REAR_CUES = ['spreading her ass', 'spreading her cheeks', 'holding her cheeks apart']

/** What a shot from the waist up, or of her face, leaves in it. */
const FRAMED_SEEN: Partial<Record<Framing, readonly Region[]>> = {
  face: [],
  waist: ['bust', 'nipples']
}

/**
 * The parts of her this picture contains. `framing` is the shot the pose settled on, a selfie's
 * included: a close one is all the caption's own words get to say about what is in it.
 */
function seenIn(caption: string, framing: Framing | null): Set<Region> {
  const text = caption.toLowerCase()
  const close = framing ? FRAMED_SEEN[framing] : undefined
  const row = FRAMING.find((rule) => saysAny(text, rule.cues))
  const seen = new Set<Region>(close ?? row?.seen ?? SEEN_BY_DEFAULT)

  if (saysAny(text, SPREAD_CUES)) seen.add('pubic')
  if (saysAny(text, REAR_CUES)) seen.add('buttocks')
  // A face alone has nothing of her body in it, not even the middle of her.
  if (framing !== 'face') for (const field of ALWAYS_SEEN) seen.add(field)
  return seen
}

/** How much of a part is left: covered, shaped through cloth, or bare. */
type Coverage = 'hidden' | 'shape' | 'exposed'

/** Clothing words in the caption, and which parts each one puts away entirely. */
const HIDES: Readonly<Record<string, readonly Region[]>> = {
  dress: ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic'],
  sundress: ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic'],
  gown: ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic'],
  coat: ['bust', 'nipples', 'stomach'],
  jacket: ['bust', 'nipples', 'stomach'],
  hoodie: ['bust', 'nipples', 'stomach'],
  sweater: ['bust', 'nipples', 'stomach'],
  cardigan: ['bust', 'nipples', 'stomach'],
  shirt: ['bust', 'nipples', 'stomach'],
  blouse: ['bust', 'nipples', 'stomach'],
  'tank top': ['bust', 'nipples', 'stomach'],
  'crop top': ['bust', 'nipples'],
  uniform: ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic'],
  pyjamas: ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic'],
  pajamas: ['bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks', 'pubic'],
  jeans: ['hipsThighs', 'buttocks', 'pubic'],
  trousers: ['hipsThighs', 'buttocks', 'pubic'],
  pants: ['hipsThighs', 'buttocks', 'pubic'],
  shorts: ['buttocks', 'pubic'],
  skirt: ['buttocks', 'pubic'],
  towel: ['bust', 'nipples', 'stomach', 'pubic', 'buttocks'],
  // Dressed, without saying in what: her top half is covered, and what is under her waist is
  // left to the garments the caption does name.
  clothes: ['bust', 'nipples', 'stomach'],
  outfit: ['bust', 'nipples', 'stomach']
}

/** What a garment can be doing that leaves what it would cover in shot. */
const DISPLACED =
  '(?:pulled (?:to the side|aside|down|up|off)|bunched|hiked up|hitched up|lifted|pushed (?:up|aside|down)|moved aside|tugged (?:aside|down)|around her (?:ankles|knees))'

/**
 * Whether the caption has this garment on her but out of the way: "her thong pulled aside",
 * "her skirt hiked up". At most two words between them, so "her clothes with her skirt bunched"
 * moves the skirt and not the clothes.
 */
function displaced(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b(?:\\s+[a-z'-]+){0,2}?\\s+${DISPLACED}`).test(text)
}

/** Clothing that keeps the shape and gives away the rest: what suggestive is made of. */
const SHAPES: Readonly<Record<string, readonly Region[]>> = {
  bra: ['bust', 'nipples'],
  bralette: ['bust', 'nipples'],
  'bikini top': ['bust', 'nipples'],
  bikini: ['bust', 'nipples', 'pubic', 'buttocks'],
  swimsuit: ['bust', 'nipples', 'pubic', 'buttocks'],
  'one-piece': ['bust', 'nipples', 'pubic', 'buttocks'],
  lingerie: ['bust', 'nipples', 'pubic'],
  negligee: ['bust', 'nipples'],
  corset: ['bust', 'nipples', 'stomach'],
  lace: ['bust', 'nipples'],
  panties: ['pubic', 'buttocks'],
  underwear: ['bust', 'nipples', 'pubic', 'buttocks'],
  thong: ['pubic'],
  'g-string': ['pubic'],
  leggings: ['hipsThighs', 'buttocks', 'pubic'],
  stockings: []
}

/** Words that say there is nothing left on her, whatever else the caption mentions. */
const BARE_CUES = [
  'naked',
  'nude',
  'no clothes',
  'undressed',
  'without clothes',
  'fully exposed',
  'topless',
  'bottomless',
  'wearing nothing',
  'nothing on',
  // The same phrasings `photoGate` reads as explicit, and for the same reason: a caption that
  // says "bare-chested and wearing only black lace panties" was drawn with her chest covered,
  // because nothing in the list above appears in it. The two lists answer one question and
  // must not disagree about it.
  'bare-chested',
  'bare chested',
  'bare chest',
  'bare torso',
  'bare front',
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
  'wearing only',
  'wearing nothing but',
  'dressed in only',
  'in only her',
  'clad only in'
]

/**
 * What is covering each part. `bare` is the gate's verdict, and overrules the caption: a
 * picture allowed to be undressed and described as undressed has nothing on it to detect.
 */
function coverageIn(caption: string, bare: boolean): Record<Region, Coverage> {
  const text = caption.toLowerCase()
  const stripped = bare && saysAny(text, BARE_CUES)

  const coverage = Object.fromEntries(REGIONS.map((field) => [field, 'exposed'])) as Record<
    Region,
    Coverage
  >
  if (stripped) return coverage

  for (const [word, fields] of Object.entries(SHAPES)) {
    if (!says(text, word) || displaced(text, word)) continue
    for (const field of fields) coverage[field] = 'shape'
  }
  // Second, so a shirt over a bra still hides what the bra only shaped.
  for (const [word, fields] of Object.entries(HIDES)) {
    if (!says(text, word) || displaced(text, word)) continue
    for (const field of fields) coverage[field] = 'hidden'
  }
  return coverage
}

/**
 * How a part reads through what is still on her. Only the parts with a plain tag for it: the
 * `*_visible_through_clothes` tags and `cameltoe` asked the checkpoint to draw a part and to hide
 * it at once, and it did neither well — a covered part says nothing rather than something
 * confusing.
 */
const THROUGH_CLOTH: Partial<Record<Region, string>> = {
  bust: 'cleavage',
  hipsThighs: 'wide_hips'
}

/**
 * The region her body names on its own, where it names one: her hips and her backside are a
 * shape a picture shows dressed or not, and the hair between her legs only undressed.
 */
function ownTag(body: CharacterBody, region: Region, bare: boolean): string | undefined {
  if (region === 'hipsThighs') return body.hipsThighs
  if (region === 'buttocks') return body.buttocks
  if (region === 'pubic') return bare ? body.pubicHair : undefined
  return undefined
}

/**
 * Her body as this one picture may describe it: only the parts in shot, and only as far as
 * what she is wearing allows. A picture with nothing of her in it answers an empty list,
 * which is a photograph of her face and her room — still a photograph.
 *
 * `body` is absent while the body switch is off, and then nothing of hers is named: only the
 * nude sprite's words for what is bare, and what cloth does to a shape.
 */
export function bodyTagsFor(
  body: CharacterBody | undefined,
  caption: string,
  bare: boolean,
  framing: Framing | null = null
): string[] {
  const seen = seenIn(caption, framing)
  const coverage = coverageIn(caption, bare)

  const tags: string[] = []
  for (const region of REGIONS) {
    if (!seen.has(region)) continue
    const state = coverage[region]
    if (state === 'hidden') continue

    // The same words her nude sprite is drawn with, for the parts of her this picture shows.
    const nude = BARE_TAGS[region]
    if (state === 'exposed' && bare && nude) tags.push(nude)

    const own = body ? ownTag(body, region, bare && state === 'exposed') : undefined
    if (own) {
      tags.push(own)
      continue
    }
    // Her own hips say what cloth over them shows, where she has them: the generic shape is
    // only for a picture that knows nothing of her.
    if (state === 'shape') {
      const through = region === 'hipsThighs' && body ? undefined : THROUGH_CLOTH[region]
      if (through) tags.push(through)
    }
  }
  return tags
}

/**
 * What a bare part is called, in the vocabulary the game's nude sprite and solo CG already use,
 * so a photograph of her undressed matches the rest of her art. Between her legs is `pussy`, and
 * her hair there is her body's own, where she has any.
 */
const BARE_TAGS: Partial<Record<Region, string>> = {
  nipples: 'nipples',
  stomach: 'navel',
  pubic: 'pussy'
}

/** Whether the caption has nothing left on her at all, rather than something moved aside. */
export function describesNothingOn(caption: string): boolean {
  return saysAny(caption.toLowerCase(), [
    'naked',
    'nude',
    'no clothes',
    'undressed',
    'without clothes',
    'wearing nothing',
    'nothing on'
  ])
}
