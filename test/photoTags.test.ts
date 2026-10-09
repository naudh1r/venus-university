import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * That every tag the photo feature writes into a prompt is a real Danbooru tag.
 *
 * The checkpoint was trained on Danbooru's vocabulary, so a tag that is not in it — misspelt,
 * deprecated, or simply made up — is read as loose English at best and ignored at worst. Several
 * were: `arms_above_head`, `ass_up`, `hand_between_legs` and `text` among them.
 *
 * Reads the tables as text, like `photoHooks.test.ts`, and checks each tag against a list that
 * was verified by hand against the Danbooru API — present, not deprecated, and in use. A new tag
 * fails here until somebody has looked it up and added it below.
 */

/** Verified against danbooru.donmai.us: each exists, is not deprecated, and has posts. */
const VERIFIED = new Set([
  // The body pools and a petite girl's negatives, looked up on the API for `characterBody`: each
  // present, not deprecated, not an alias, with thousands of posts.
  'petite',
  'curvy',
  'toned',
  'muscular_female',
  'tall_female',
  'flat_chest',
  'small_breasts',
  'medium_breasts',
  'large_breasts',
  'wide_hips',
  'thick_thighs',
  'narrow_waist',
  'long_legs',
  'thigh_gap',
  'huge_ass',
  'flat_ass',
  'female_pubic_hair',
  'sparse_pubic_hair',
  'excessive_pubic_hair',
  'loli',
  'child',
  'aged_down',
  '1boy',
  '1girl',
  '2girls',
  'against_wall',
  'all_fours',
  'anal',
  'anus',
  'arched_back',
  'armpits',
  'arms_at_sides',
  'arms_up',
  'artist_name',
  'ass_focus',
  'bar_censor',
  'bent_over',
  'between_legs',
  'blush',
  'censored',
  'cleavage',
  'clitoris',
  'close-up',
  'clothes_pull',
  'completely_nude',
  'convenient_censoring',
  'cowboy_shot',
  'crossed_arms',
  'cum',
  'depth_of_field',
  'dildo',
  'english_text',
  'female_ejaculation',
  'fingering',
  'from_behind',
  'gold',
  'grabbing_own_ass',
  'grabbing_own_breast',
  'hand_on_own_chest',
  'hand_on_own_chin',
  'hand_on_own_hip',
  'hand_on_own_thigh',
  'hand_up',
  'hands_on_lap',
  'hands_on_own_ass',
  'hands_on_own_knees',
  'hands_on_own_thighs',
  'head_rest',
  'hetero',
  'kneeling',
  'knees_up',
  'leaning_forward',
  'legs_up',
  'looking_at_viewer',
  'looking_back',
  'lowres',
  'lying',
  'masturbation',
  'mirror',
  'mosaic_censoring',
  'multiple_boys',
  'multiple_girls',
  'multiple_views',
  'navel',
  'nipples',
  'nude',
  'on_back',
  'on_bed',
  'on_side',
  'on_stomach',
  'open_mouth',
  'orgasm',
  'penis',
  'photo_(medium)',
  'portrait',
  'pussy',
  'reference_sheet',
  'reflection',
  'rolling_eyes',
  'seductive_smile',
  'sex',
  'sex_toy',
  'signature',
  'simple_background',
  'sitting',
  'solo',
  'speech_bubble',
  'spread_legs',
  'spread_pussy',
  'squatting',
  'standing',
  'sweat',
  'transparent_background',
  'uncensored',
  'undressing',
  'upper_body',
  'vaginal_object_insertion',
  'vibrator',
  'watermark',
  'wet',
  'white_background',
  'wide_hips',
  // Drawn in a same-seed ComfyUI check against a baseline and a made-up tag.
  'bra_lift',
  'crossed_legs',
  'from_above',
  'from_below',
  'panties_aside',
  'partially_undressed',
  'shirt_lift',
  'skirt_lift',
  // Kept out of a dressed picture, from the suggestive check.
  'areolae',
  'nipples',
  'nude',
  'pantyshot',
  'pussy',
  // Legwear, from the colour-bleed checks.
  'bare_legs',
  'colored_legwear',
  'latex',
  'leggings',
  'pantyhose',
  'blue_legwear',
  'brown_legwear',
  'green_legwear',
  'grey_legwear',
  'orange_legwear',
  'pink_legwear',
  'purple_legwear',
  'red_legwear',
  'yellow_legwear',
  'thighhighs',
  // Selfies, drawn in the same same-seed checks.
  'from_behind',
  'from_side',
  'looking_back',
  'looking_down',
  'profile',
  'camera',
  'cellphone',
  'foreshortening',
  'full_body',
  'holding_phone',
  'legs_up',
  'looking_up',
  'on_back',
  'on_side',
  'on_stomach',
  'open_hand',
  'outstretched_arm',
  'phone',
  'reaching_towards_viewer',
  'reflection',
  'selfie',
  'smartphone',
  'spread_fingers',
  'v'
])

/** The checkpoint's own quality vocabulary, which is not Danbooru's and is not checked. */
const QUALITY = new Set([
  'masterpiece',
  'best_quality',
  'very_aesthetic',
  'worst_quality',
  'bad_quality'
])

const ROOT = join(__dirname, '..')

function source(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
}

/** Every quoted string inside the brackets or braces that follow each match of `opener`. */
function quoted(text: string, opener: RegExp): string[] {
  const found: string[] = []
  for (const match of text.matchAll(opener)) {
    found.push(...[...match[1].matchAll(/'([^']+)'/g)].map((one) => one[1]))
  }
  return found
}

/** The comma-separated tags inside one string constant, however it is split across lines. */
function constantTags(text: string, name: string): string[] {
  const start = text.indexOf(`const ${name} =`)
  // A constant ends at a blank line or at the next declaration, whichever comes first.
  const ends = ['\n\n', '\nconst ', '\n/**']
    .map((mark) => text.indexOf(mark, start + 1))
    .filter((at) => at > start)
  const body = text.slice(start, Math.min(...ends)).replace(/\/\/[^\n]*/g, '')
  return [...body.matchAll(/'([^']*)'/g)]
    .map((one) => one[1])
    .join('')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** A weighted tag, `(huge_ass:0.6)`, is its tag at another weight: the tag is what is checked. */
function unweighted(tag: string): string {
  return tag.replace(/^\((.+):[\d.]+\)$/, '$1')
}

function emittedTags(): string[] {
  const pose = source('src/shared/photoPose.ts')
  const body = source('src/shared/photoBody.ts')
  const prompt = source('src/shared/photoPrompt.ts')
  const character = source('src/shared/characterBody.ts')
  const framing = source('src/shared/photoFraming.ts')
  return [
    // Every pool, and the petite negatives: `BUILD_TAGS = [...]` and the rest.
    ...quoted(character, /_TAGS\s*=\s*\[([^\]]*)\]/g).map(unweighted),
    ...quoted(pose, /(?:tags|implies):\s*\[([^\]]*)\]/g).map(unweighted),
    ...quoted(
      pose,
      /(?:const add =|shot\(|PHONE_NEGATIVE =|legs = whole \?|new Set\()\s*\[([^\]]*)\]/g
    ).map(unweighted),
    ...quoted(pose, /frame = [^?]+\?\s*('[^']*')\s*:\s*('[^']*')/g).map(unweighted),
    ...quoted(pose, /frame = [^:]+:\s*('[^']*')/g).map(unweighted),
    ...quoted(pose, /const low = [^?]+\? \[('looking_down')\]/g),
    ...quoted(pose, /const turned = new Set\(\[([^\]]*)\]/g),
    // The side selfie's own negatives, the array after its tags.
    ...quoted(pose, /\? \[\] : \[('camera')\]/g),
    ...quoted(pose, /'from_above'\],\s*\[([^\]]*)\]/g),
    ...quoted(pose, /negative: \[\.\.\.negative, ('on_back')\]/g),
    ...quoted(framing, /tags:\s*\[([^\]]*)\]/g).map(unweighted),
    ...quoted(pose, /BARE_POSITION_DEFAULT[^=]*=\s*\[([^\]]*)\]/g),
    ...quoted(pose, /PLACEMENT_TAGS[^=]*=\s*new Set\(\[([^\]]*)\]/g),
    ...quoted(body, /THROUGH_CLOTH[^=]*=\s*\{([^}]*)\}/g),
    ...quoted(prompt, /tag:\s*('[^']*')/g),
    ...quoted(prompt, /\[('partially_undressed')/g),
    ...quoted(prompt, /LEGWEAR_NEGATIVE[^=]*=\s*\[([^=]*?)\n\]/g).filter((tag) =>
      /^[a-z_]+$/.test(tag)
    ),
    ...quoted(prompt, /DRESSED_NEGATIVE[^=]*=\s*\[([^=]*?)\n\]/g).filter((tag) =>
      /^[a-z_]+$/.test(tag)
    ),
    ...quoted(prompt, /\[\.\.\.kept, ('cleavage')\]/g),
    // Each colour's own legwear tag, `pink_legwear` and the rest.
    ...quoted(prompt, /LEG_COLOURS = \[([^\]]*)\]/g).map((colour) => `${colour}_legwear`),
    ...quoted(prompt, /negative\.push\(([^)]*)\)/g),
    ...quoted(prompt, /short \? \[('bare_legs')\]/g),
    ...quoted(pose, /,\s*('crossed_legs')\]/g),
    ...quoted(body, /BARE_TAGS[^=]*=\s*\{([^}]*)\}/g),
    ...['PHOTO_QUALITY', 'PHOTO_BASE', 'PHOTO_NEGATIVE', 'BARE_POSITIVE', 'BARE_NEGATIVE'].flatMap(
      (name) => constantTags(prompt, name)
    )
  ]
}

describe("the photo feature's tags", () => {
  it('finds the tables it is meant to be checking', () => {
    // A rename that empties the scan would pass everything below; this is what notices.
    expect(emittedTags().length).toBeGreaterThan(80)
  })

  it('writes nothing that is not a verified Danbooru tag', () => {
    const unknown = [...new Set(emittedTags())].filter(
      (tag) => !VERIFIED.has(tag) && !QUALITY.has(tag)
    )
    expect(unknown).toEqual([])
  })
})
