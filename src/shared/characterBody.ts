import type { PromptEdit } from './imagePrompt'
import type { Character } from './types'

/**
 * Her body, as five picks from fixed pools.
 *
 * The checkpoint was trained on Danbooru, so it draws what a Danbooru tag names and reads
 * anything else as loose English at best. A body the character call wrote in its own words —
 * "soft tummy", "perky", "pink areola" — went into her pictures as noise. So each field is one
 * tag from a pool every entry of which was looked up on the Danbooru API: present, not
 * deprecated, not an alias, and drawn from enough posts to be learned. None means average.
 *
 * Declared here rather than beside the save's shapes because nothing outside this feature reads
 * it: a build that drops these files loses the type with them, and `types.ts` never learns the
 * feature existed.
 */
export interface CharacterBody {
  build?: string
  breasts?: string
  hipsThighs?: string
  buttocks?: string
  pubicHair?: string
}

/** Every field, in the order they are settled: each is checked against the ones before it. */
export const BODY_FIELDS = ['build', 'breasts', 'hipsThighs', 'buttocks', 'pubicHair'] as const

export type BodyField = (typeof BODY_FIELDS)[number]

/**
 * Her frame. `slim` is deprecated and `slender` only an alias; `skinny` drawn beside `petite`
 * read as the same body, so one of the two went.
 */
const BUILD_TAGS = ['petite', 'curvy', 'plump', 'toned', 'muscular_female', 'tall_female']

/** Her chest. Nothing past `large_breasts`: the next size up is a different kind of picture. */
const BREAST_TAGS = ['flat_chest', 'small_breasts', 'medium_breasts', 'large_breasts']

const HIPS_TAGS = ['wide_hips', 'thick_thighs', 'narrow_waist', 'long_legs', 'thigh_gap']

/**
 * Danbooru has two sizes and nothing between: every other name for it is empty or an alias of
 * `huge_ass`. The middle two are the same learned tags at a lighter weight, which the checkpoint
 * reads as less of the same shape rather than as a word it does not know. Smallest first.
 */
const SMALL_ASS = '(flat_ass:0.6)'
const FULL_ASS = '(huge_ass:0.6)'
const BUTTOCKS_TAGS = ['flat_ass', '(flat_ass:0.6)', '(huge_ass:0.6)', 'huge_ass']

/** None is hairless, as her nude sprite is drawn. `trimmed_` and `shaved_` have no posts. */
const PUBIC_TAGS = ['female_pubic_hair', 'sparse_pubic_hair', 'excessive_pubic_hair']

export const BODY_POOLS: Readonly<Record<BodyField, readonly string[]>> = {
  build: BUILD_TAGS,
  breasts: BREAST_TAGS,
  hipsThighs: HIPS_TAGS,
  buttocks: BUTTOCKS_TAGS,
  pubicHair: PUBIC_TAGS
}

/**
 * What cannot be true of one body at once. Two opposite tags do not average out on the
 * checkpoint, they fight: a petite girl with a huge backside is drawn as neither.
 */
const CONFLICTS: readonly {
  field: BodyField
  tag: string
  rules: Partial<Record<BodyField, readonly string[]>>
}[] = [
  {
    field: 'build',
    tag: 'petite',
    rules: {
      hipsThighs: ['wide_hips', 'thick_thighs', 'long_legs'],
      buttocks: [FULL_ASS, 'huge_ass']
    }
  },
  {
    field: 'build',
    tag: 'curvy',
    rules: { breasts: ['flat_chest'], buttocks: ['flat_ass', SMALL_ASS] }
  },
  {
    field: 'build',
    tag: 'plump',
    rules: {
      breasts: ['flat_chest'],
      hipsThighs: ['narrow_waist', 'thigh_gap'],
      buttocks: ['flat_ass', SMALL_ASS]
    }
  },
  { field: 'hipsThighs', tag: 'wide_hips', rules: { buttocks: ['flat_ass', SMALL_ASS] } },
  { field: 'hipsThighs', tag: 'thick_thighs', rules: { buttocks: ['flat_ass', SMALL_ASS] } }
]

/** Whether `tag` may stand in `field` beside what the fields before it already hold. */
export function allowedBeside(body: CharacterBody, field: BodyField, tag: string): boolean {
  if (!BODY_POOLS[field].includes(tag)) return false
  return !CONFLICTS.some(
    (conflict) =>
      conflict.field !== field &&
      body[conflict.field] === conflict.tag &&
      (conflict.rules[field] ?? []).includes(tag)
  )
}

/**
 * The pick a stored field holds, if it is one: a string, or the first pooled tag of a list. The
 * first bodies were written as lists of free tags per region, and read through here they keep
 * whatever in them the pool knows.
 */
function pooled(field: BodyField, written: unknown): string | undefined {
  const tags = Array.isArray(written)
    ? written
    : typeof written === 'string'
      ? written.split(',')
      : []
  return tags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .find((tag) => BODY_POOLS[field].includes(tag))
}

/** Where each field was kept before it had a pool. Nipples and stomach have no field now. */
const LEGACY_FIELD: Readonly<Record<BodyField, string>> = {
  build: 'bodyType',
  breasts: 'bust',
  hipsThighs: 'hipsThighs',
  buttocks: 'buttocks',
  pubicHair: 'pubicHair'
}

/**
 * A stored body as the pools allow it: every field one pooled tag or nothing, and a field that
 * contradicts one before it dropped. `undefined` for a body with nothing left in it.
 */
export function cleanBody(raw: unknown): CharacterBody | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const body: CharacterBody = {}
  for (const field of BODY_FIELDS) {
    const tag = pooled(field, record[field] ?? record[LEGACY_FIELD[field]])
    if (tag && allowedBeside(body, field, tag)) body[field] = tag
  }
  return BODY_FIELDS.some((field) => body[field]) ? body : undefined
}

/** How the dev's appearance names her chest, and what that is in the pool. */
const APPEARANCE_BREASTS: Readonly<Record<string, string>> = {
  small_breasts: 'small_breasts',
  // `big_breasts` is only an alias of `large_breasts` on Danbooru, with no posts of its own.
  big_breasts: 'large_breasts',
  medium_breasts: 'medium_breasts',
  large_breasts: 'large_breasts',
  flat_chest: 'flat_chest'
}

/** Every chest tag an appearance might carry, which a body's own pick replaces. */
const ANY_BREAST_TAG = /^(flat_chest|[a-z]+_breasts)$/

/** Her chest as her appearance has it, in the pool: medium where it says nothing. */
export function appearanceBreasts(baseAppearance: readonly string[]): string {
  for (const tag of baseAppearance) {
    const mapped = APPEARANCE_BREASTS[tag]
    if (mapped) return mapped
  }
  return 'medium_breasts'
}

/**
 * The fields the engine draws once, at creation, and how often each pick comes up. The character
 * call chooses her build, the one field her personality decides; a model asked to vary the rest
 * across a cast converges on the same answers, and a draw does not.
 */
const DRAW_WEIGHTS: Readonly<Partial<Record<BodyField, Readonly<Record<string, number>>>>> = {
  hipsThighs: {
    '': 3,
    wide_hips: 1,
    thick_thighs: 1,
    narrow_waist: 1,
    long_legs: 1,
    thigh_gap: 1
  },
  // The in-between sizes more often than the ends.
  buttocks: { '': 4, [SMALL_ASS]: 2, [FULL_ASS]: 2, flat_ass: 1, huge_ass: 1 },
  pubicHair: { '': 3, female_pubic_hair: 3, sparse_pubic_hair: 1, excessive_pubic_hair: 1 }
}

/** One weighted pick among what `allowed` lets through; `''` is none. */
function draw(
  weights: Readonly<Record<string, number>>,
  allowed: (tag: string) => boolean,
  rand: () => number
): string {
  const options = Object.entries(weights).filter(([tag]) => tag === '' || allowed(tag))
  const total = options.reduce((sum, [, weight]) => sum + weight, 0)
  let at = rand() * total
  for (const [tag, weight] of options) {
    at -= weight
    if (at < 0) return tag
  }
  return ''
}

/**
 * A new character's body: the build she was written with, her chest as her appearance already
 * says it, and the rest drawn so that nothing contradicts what came before it.
 */
export function drawBody(
  build: string | undefined,
  baseAppearance: readonly string[],
  rand: () => number = Math.random
): CharacterBody {
  const body: CharacterBody = {}
  if (build && allowedBeside(body, 'build', build)) body.build = build
  const breasts = appearanceBreasts(baseAppearance)
  if (allowedBeside(body, 'breasts', breasts)) body.breasts = breasts
  for (const field of ['hipsThighs', 'buttocks', 'pubicHair'] as const) {
    const tag = draw(DRAW_WEIGHTS[field] ?? {}, (one) => allowedBeside(body, field, one), rand)
    if (tag) body[field] = tag
  }
  return body
}

/** The weighted picks, which read as nothing like their tag. */
const WEIGHTED_LABELS: Readonly<Record<string, string>> = {
  [SMALL_ASS]: 'small ass',
  [FULL_ASS]: 'full ass'
}

/** What a pick is called where a person reads it: `thick_thighs` is "thick thighs". */
export function bodyTagLabel(tag: string): string {
  return WEIGHTED_LABELS[tag] ?? tag.replace(/_/g, ' ')
}

/**
 * The character as the body switch has her: with it off, no body at all, which every builder
 * reads as the build it has always been; with it on, the body she has, filtered to the pools,
 * or an empty one — which still means something, since her chest is then read off her
 * appearance under its real tag.
 */
export function gateBody(character: Character, on: boolean): Character {
  const { body, ...rest } = character
  if (!on) return rest
  return { ...rest, body: cleanBody(body) ?? {} }
}

/** Which picture a body is being written into, and so which of her fields it can show. */
export type BodyScope = 'sprite' | 'nude' | 'cg' | 'photo'

/**
 * Her appearance with her body in it. No body — the switch off — is her appearance untouched,
 * exactly as the build writes it.
 *
 * Her chest replaces whatever her appearance calls it, so the two never disagree. Her frame and
 * her hips are on every picture; her backside only where the picture may be of it, which a
 * standing sprite facing forward is not; and hair between her legs only where she is undressed.
 * A photo adds its regions itself, by what is in shot (`photoBody`).
 */
export function bodyAppearance(character: Character, scope: BodyScope): string[] {
  const body = character.body
  if (!body) return [...character.baseAppearance]
  const kept = character.baseAppearance.filter((tag) => !ANY_BREAST_TAG.test(tag))
  const breasts = body.breasts ?? appearanceBreasts(character.baseAppearance)
  const tags = [breasts, body.build]
  if (scope !== 'photo') tags.push(body.hipsThighs)
  if (scope === 'cg') tags.push(body.buttocks)
  if (scope === 'nude' || scope === 'cg') tags.push(body.pubicHair)
  return [...kept, ...tags.filter((tag): tag is string => Boolean(tag))]
}

/**
 * What a petite frame is kept from being drawn as. `petite` pulls the checkpoint toward a
 * younger look, and these are the tags it learned that look from; they go to her negatives and
 * nobody else's, so the dev's own negatives stay as he tuned them.
 */
const PETITE_NEGATIVE_TAGS = ['loli', 'child', 'aged_down']

/** Her own extra negatives: none, unless her frame is `petite`. */
export function bodyNegative(character: Character): string[] {
  return character.body?.build === 'petite' ? [...PETITE_NEGATIVE_TAGS] : []
}

/** Every tag that is hers only while the switch is on: every pool but her chest's. */
const BODY_ONLY_TAGS: ReadonlySet<string> = new Set([
  ...BUILD_TAGS,
  ...HIPS_TAGS,
  ...BUTTOCKS_TAGS,
  ...PUBIC_TAGS
])

/**
 * A regenerate's remembered tags, with her body in them as it is now.
 *
 * The regenerate dialog reopens on what its button last sent, group by group, so a set rendered
 * before she had a body — or before her build was rerolled — would go on being drawn with that
 * body. Her body's tags are taken out of the remembered Appearance and Negative groups and hers
 * from the fresh draft put back; every other tag the player wrote by hand stays where it was.
 *
 * With the switch off only the body's own tags come out. Her chest is left as remembered, since
 * a chest tag in an old edit may be the player's own and not the body's.
 */
export function withBodyTags(kept: PromptEdit, draft: PromptEdit, on: boolean): PromptEdit {
  if (kept === draft || kept.kind === 'expression' || draft.kind === 'expression') return kept
  const owned = (tag: string): boolean =>
    BODY_ONLY_TAGS.has(tag) || (on && ANY_BREAST_TAG.test(tag))
  const appearance = [
    ...kept.appearance.filter((tag) => !owned(tag)),
    ...draft.appearance.filter(owned)
  ]
  const petite = new Set(PETITE_NEGATIVE_TAGS)
  const negative = [
    ...kept.negative.filter((tag) => !petite.has(tag)),
    ...draft.negative.filter((tag) => petite.has(tag))
  ]
  return { ...kept, appearance, negative }
}
