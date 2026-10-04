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
  'wide_hips'
])

/** The checkpoint's own quality vocabulary, which is not Danbooru's and is not checked. */
const QUALITY = new Set([
  'masterpiece',
  'best_quality',
  'very_aesthetic',
  'worst_quality',
  'bad_quality',
  // The Niji style LoRA's trigger word, which leads the photo prompt on this branch.
  'SemiRrealism'
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

function emittedTags(): string[] {
  const pose = source('src/shared/photoPose.ts')
  const body = source('src/shared/photoBody.ts')
  const prompt = source('src/shared/photoPrompt.ts')
  const character = source('src/shared/characterBody.ts')
  return [
    // Every pool, and the petite negatives: `BUILD_TAGS = [...]` and the rest.
    // A weighted pick, `(huge_ass:0.6)`, is its tag at a lighter weight: the tag is what is checked.
    ...quoted(character, /_TAGS\s*=\s*\[([^\]]*)\]/g).map((tag) =>
      tag.replace(/^\((.+):[\d.]+\)$/, '$1')
    ),
    ...quoted(pose, /(?:tags|implies):\s*\[([^\]]*)\]/g),
    ...quoted(pose, /BARE_POSITION_DEFAULT[^=]*=\s*\[([^\]]*)\]/g),
    ...quoted(pose, /PLACEMENT_TAGS[^=]*=\s*new Set\(\[([^\]]*)\]/g),
    ...quoted(body, /THROUGH_CLOTH[^=]*=\s*\{([^}]*)\}/g),
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
