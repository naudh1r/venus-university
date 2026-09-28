
/**
 * Her body as the picture builder needs it: a part at a time. A photo frames her from one
 * side, and her clothes cover her unevenly, so a prompt that names her chest in a shot taken
 * from behind is a prompt describing something the camera cannot see. Writing each region on
 * its own is what lets the builder say only the true half.
 */

/**
 * Her undressed body, one field per region a photograph can frame or cover on its own, each a
 * short run of booru tags like the wardrobes. Anything true of her all over belongs in
 * `bodyType`. Between her legs is not stored: a picture says it with one tag, the same for
 * everybody.
 *
 * It is declared here rather than beside the rest of the save's shapes because nothing outside
 * the photo feature reads it: a build that drops these files loses the type with them, and
 * `types.ts` never learns the feature existed.
 *
 * Read through `bodyTags` below, never off the record: the first characters written with a body
 * kept each region as one comma-separated string.
 */
export interface CharacterBody {
  /** Her build as a whole: frame, height-for-her-weight, muscle, skin. */
  bodyType: string[]
  /** Her chest: size and shape. */
  bust: string[]
  /** Her nipples: size, colour, state. */
  nipples: string[]
  /** Her middle: stomach, waist, navel. */
  stomach: string[]
  /** Her hips, thighs and what joins them. */
  hipsThighs: string[]
  /** Her backside. */
  buttocks: string[]
}

/** Every region, in the order a prompt reads them: top down. */
export const BODY_FIELDS = [
  'bodyType',
  'bust',
  'nipples',
  'stomach',
  'hipsThighs',
  'buttocks'
] as const

export type BodyField = (typeof BODY_FIELDS)[number]

/** What the character call is told to write into each field. */
const BODY_FIELD_BRIEF: Record<BodyField, string> = {
  bodyType: 'her build as a whole — frame, weight, muscle, skin, anything true of her all over',
  bust: 'her chest: size and shape',
  nipples: 'her nipples: size, colour, areola',
  stomach: 'her middle: stomach, waist, navel',
  hipsThighs: 'her hips and thighs, and how they meet',
  buttocks: 'her backside: size and shape'
}

/** The brief as prompt lines, one per field. */
export const BODY_FIELD_LINES: string[] = BODY_FIELDS.map(
  (field) => `${field}: ${BODY_FIELD_BRIEF[field]}.`
)

/**
 * One region's tags. Read through here rather than off the record: the first characters
 * written with a body kept each region as one comma-separated string, and both shapes answer
 * the same list.
 */
export function bodyTags(body: CharacterBody | undefined, field: BodyField): string[] {
  const written = body?.[field] as readonly string[] | string | undefined
  const parts = Array.isArray(written) ? written : typeof written === 'string' ? written.split(',') : []
  return parts.map((tag) => tag.trim()).filter(Boolean)
}

/** Tidies what a reply wrote, and answers nothing unless some region was written at all. */
export function cleanBody(body: CharacterBody | undefined): CharacterBody | undefined {
  if (!body) return undefined
  const cleaned = Object.fromEntries(
    BODY_FIELDS.map((field) => [field, bodyTags(body, field)])
  ) as unknown as CharacterBody
  return BODY_FIELDS.some((field) => cleaned[field].length > 0) ? cleaned : undefined
}
