import { says, saysAny } from './photoWords'

/**
 * Composition tags read off the sentence she wrote.
 *
 * A checkpoint draws what it is told in its own language, and prose is not that language: a
 * picture asked for in English comes out as a guess. So the caption is read for what it says
 * about her body, and answered in tags — a position, what her hands are doing, and whatever
 * modifiers the words carry.
 *
 * The rule that earns its keep is the last one: a hand doing something takes the hands away
 * from everything else. Two placements in one prompt is how a picture ends up with three arms.
 */

/** A table row: the words that fire it, and the tags it contributes. */
interface Rule {
  readonly cues: readonly string[]
  readonly tags: readonly string[]
}

/** An action her hands are doing, and the way she would be lying to do it. */
interface ActionRule extends Rule {
  /** Used only when the caption said nothing about her position. */
  readonly implies?: readonly string[]
}

/** Whether any of `cues` appears in the caption, which is already lowercased. */
function fires(text: string, cues: readonly string[]): boolean {
  return saysAny(text, cues)
}

/** The first row whose cues appear, or null. Order is precedence: specific before general. */
function firstMatch(text: string, table: readonly Rule[]): Rule | null {
  return table.find((rule) => fires(text, rule.cues)) ?? null
}

/** How she is framed and standing with her clothes on. */
const DRESSED_POSITIONS: readonly Rule[] = [
  {
    cues: ['selfie', 'close-up', 'close up', 'mirror'],
    tags: ['close-up', 'upper_body', 'hand_up']
  },
  { cues: ['face shot', 'face only', 'just her face'], tags: ['close-up', 'portrait'] },
  {
    cues: ['lying', 'laying', 'on the bed', 'on bed', 'on the floor', 'on the grass'],
    tags: ['lying', 'arms_at_sides']
  },
  {
    cues: ['sitting', 'seated', 'cross-legged', 'on the chair', 'on the couch', 'on a bench'],
    tags: ['sitting', 'cowboy_shot', 'hands_on_lap']
  },
  { cues: ['kneeling', 'crouching'], tags: ['kneeling', 'hands_on_own_thighs'] },
  { cues: ['leaning over', 'leaning forward'], tags: ['leaning_forward', 'hand_on_own_chin'] },
  { cues: ['leaning against', 'leaning on'], tags: ['against_wall', 'crossed_arms'] },
  { cues: ['standing', 'walking'], tags: ['standing', 'cowboy_shot', 'hand_on_own_hip'] },
  { cues: ['stretching', 'reaching up'], tags: ['standing', 'arms_up', 'armpits'] }
]

/** Which way she is turned, and whether she is looking at whoever holds the phone. */
const FACING: readonly Rule[] = [
  {
    cues: ['looking back', 'glancing back', 'over her shoulder'],
    tags: ['looking_back', 'from_behind', 'hand_on_own_hip']
  },
  {
    cues: ['from behind', 'back view', 'rear view', 'back turned'],
    tags: ['from_behind', 'hand_on_own_hip']
  }
]

/** How she is lying or standing with nothing on. First match wins; they are exclusive. */
const BARE_POSITIONS: readonly Rule[] = [
  {
    cues: ['on all fours', 'all fours', 'hands and knees'],
    tags: ['all_fours', 'solo']
  },
  {
    cues: ['bent over', 'bending over', 'bent forward'],
    tags: ['bent_over', 'solo', 'hands_on_own_knees']
  },
  { cues: ['from behind'], tags: ['from_behind', 'solo', 'ass_focus'] },
  {
    cues: ['legs up', 'legs in the air', 'legs raised', 'knees to her chest', 'ankles up'],
    tags: ['lying', 'on_back', 'solo', 'legs_up', 'knees_up']
  },
  {
    cues: ['spread eagle', 'spread-eagle', 'splayed out'],
    tags: ['lying', 'on_back', 'solo', 'spread_legs']
  },
  {
    cues: ['on her back', 'onto her back', 'lying on her back', 'lying back', 'on back'],
    tags: ['lying', 'on_back', 'solo', 'arms_up']
  },
  {
    cues: ['on her stomach', 'face down', 'lying on her stomach', 'prone'],
    tags: ['lying', 'on_stomach', 'solo', 'head_rest']
  },
  {
    cues: ['on her side', 'lying on her side', 'side lying'],
    tags: ['on_side', 'solo', 'head_rest']
  },
  { cues: ['squatting', 'squat'], tags: ['squatting', 'solo', 'spread_legs', 'hand_on_own_thigh'] },
  { cues: ['on her knees', 'kneeling'], tags: ['kneeling', 'solo', 'hands_on_own_thighs'] },
  {
    cues: ['against the wall', 'against wall'],
    tags: ['against_wall', 'solo', 'arms_at_sides']
  },
  {
    cues: ['sitting on the bed', 'sitting on her bed'],
    tags: ['sitting', 'on_bed', 'solo', 'hands_on_lap']
  },
  {
    cues: ['sitting', 'seated', 'cross-legged'],
    tags: ['sitting', 'solo', 'spread_legs', 'hands_on_own_thighs']
  },
  { cues: ['standing'], tags: ['standing', 'solo', 'hand_on_own_hip', 'cowboy_shot'] },
  // Lowest priority: whatever the dressed pass would have said, kept consistent with it.
  {
    cues: ['lying', 'laying', 'on the bed', 'on bed', 'on the floor'],
    tags: ['lying', 'solo', 'arms_at_sides']
  }
]

/** Nothing on, and nothing said about how she is lying. */
const BARE_POSITION_DEFAULT: readonly string[] = ['standing', 'solo', 'hand_on_own_hip']

/**
 * Every tag above that places a hand or an arm. When an action below fires, all of these are
 * struck out first: the action owns her hands, and a second placement beside it is the tag
 * that grows the extra limb. Tags about her body rather than her arms are deliberately absent.
 */
const PLACEMENT_TAGS: ReadonlySet<string> = new Set([
  'hand_on_own_hip',
  'hands_on_own_thighs',
  'hand_on_own_thigh',
  'hands_on_lap',
  'hands_on_own_knees',
  'hands_on_own_ass',
  'head_rest',
  'arms_at_sides',
  'arms_up',
  'hand_up',
  'hand_on_own_chin',
  'crossed_arms'
])

/** What her hands are doing. Up to two fire — she has two of them. */
const HAND_ACTIONS: readonly ActionRule[] = [
  {
    cues: [
      'touching herself',
      'playing with herself',
      'fingering',
      'fingers herself',
      'finger herself',
      'rubbing herself',
      'hand between her legs',
      'fingers inside',
      'masturbat*',
      'pleasuring herself',
      'rubbing her clit',
      'playing with her clit',
      'two fingers',
      'slips a finger',
      'slides a finger',
      'working her fingers'
    ],
    tags: ['masturbation', 'fingering', 'between_legs'],
    implies: ['lying', 'on_back', 'solo', 'spread_legs']
  },
  {
    cues: [
      'squeezing her breasts',
      'cupping her breasts',
      'cupping herself',
      'groping',
      'fondling',
      'grabbing her breasts',
      'playing with her nipples',
      'pinching her nipple',
      'tweaking her nipple',
      'hand on her breast',
      'hands on her breasts'
    ],
    tags: ['grabbing_own_breast']
  },
  {
    cues: [
      'spreading her pussy',
      'spreading herself open',
      'holding herself open',
      'spreading her lips',
      'pulling herself open'
    ],
    tags: ['spread_pussy', 'pussy', 'spread_legs'],
    implies: ['lying', 'on_back', 'solo', 'spread_legs']
  },
  {
    cues: [
      'spreading her ass',
      'spreading her cheeks',
      'holding her cheeks apart',
      'grabbing her ass'
    ],
    tags: ['grabbing_own_ass', 'ass_focus'],
    implies: ['bent_over', 'solo']
  },
  {
    cues: ['dildo', 'toy inside her', 'fucking herself with'],
    tags: ['sex_toy', 'dildo', 'vaginal_object_insertion'],
    implies: ['lying', 'on_back', 'solo', 'spread_legs']
  },
  {
    cues: ['vibrator', 'magic wand', 'vibe on her'],
    tags: ['vibrator', 'sex_toy', 'clitoris'],
    implies: ['sitting', 'solo', 'spread_legs']
  }
]

/** Where the breast row sits, for the loose nipple phrasing below. */
const BREAST_ACTION = HAND_ACTIONS[1]

/** Nipple play written around the noun instead of at it: "teasing her stiff nipples". */
const NIPPLE_VERBS = [
  'play*',
  'teas*',
  'pinch*',
  'tweak*',
  'roll*',
  'squeez*',
  'tug*',
  'rub*',
  'flick*'
]

/** No action matched, but her hands are clearly on herself somewhere. */
const VAGUE_TOUCH: Rule = {
  cues: ['touching', 'hand on', 'caressing'],
  tags: ['hand_on_own_chest']
}

/** Everything else the words carry. These stack: each one that fires is added. */
const MODIFIERS: readonly Rule[] = [
  {
    cues: [
      'lifting her skirt',
      'skirt up',
      'panties aside',
      'pulling down her panties',
      'taking off her bra',
      'unbuttoning',
      'unzipping',
      'sliding off',
      'slipping off',
      'lifting her shirt',
      'lifting her top'
    ],
    tags: ['undressing', 'clothes_pull']
  },
  {
    cues: [
      'finger in her mouth',
      'sucking her finger',
      'biting her lip',
      'tongue out',
      'licking her lips',
      'blowing a kiss',
      'come-hither'
    ],
    tags: ['seductive_smile']
  },
  {
    cues: ['orgasm', 'climax', 'cumming', 'ahegao', 'ecstasy', 'eyes rolled', 'trembling with'],
    tags: ['orgasm', 'open_mouth', 'rolling_eyes']
  },
  { cues: ['squirt', 'gushing', 'female ejaculation'], tags: ['female_ejaculation'] },
  {
    cues: ['spread legs', 'legs apart', 'legs open', 'thighs spread', 'legs spread'],
    tags: ['spread_legs']
  },
  { cues: ['arching', 'arched back', 'arches her back'], tags: ['arched_back'] },
  { cues: ['soaking wet', 'dripping', 'soaked'], tags: ['wet', 'sweat'] },
  { cues: ['blushing', 'red cheeks', 'flushed', 'cheeks pink', 'cheeks red'], tags: ['blush'] },
  {
    cues: ['at the camera', 'at the phone', 'looking at viewer', 'eye contact', 'staring at'],
    tags: ['looking_at_viewer']
  },
  { cues: ['mirror'], tags: ['mirror', 'reflection'] }
]

/**
 * The modifiers a dressed picture may still carry, keyed by each row's first tag: her face,
 * the shot, and clothes coming off are all things a photo with clothes in it can show.
 */
const DRESSED_MODIFIERS: ReadonlySet<string> = new Set([
  'undressing',
  'seductive_smile',
  'arched_back',
  'blush',
  'looking_at_viewer',
  'mirror'
])

/**
 * Turns one caption into composition tags. `bare` opens the second half of the vocabulary —
 * the positions and actions that only make sense with nothing on — and is decided by the gate,
 * never by anything read here.
 */
export function posePhotoTags(caption: string, bare: boolean): string[] {
  const text = caption.toLowerCase()
  const tags: string[] = []

  const dressed = firstMatch(text, DRESSED_POSITIONS)
  const facing = firstMatch(text, FACING)

  if (!bare) {
    if (dressed) tags.push(...dressed.tags)
    if (facing) tags.push(...facing.tags)
    for (const modifier of MODIFIERS) {
      if (DRESSED_MODIFIERS.has(modifier.tags[0]) && fires(text, modifier.cues)) {
        tags.push(...modifier.tags)
      }
    }
    return [...new Set(tags)]
  }

  const position = firstMatch(text, BARE_POSITIONS)

  // Both hands, but no more: two actions is a picture, three is a puzzle.
  const matched = HAND_ACTIONS.filter((action) => fires(text, action.cues)).slice(0, 2)
  const looseNipples = matched.length === 0 && says(text, 'nipple') && saysAny(text, NIPPLE_VERBS)
  const hands = looseNipples ? [BREAST_ACTION] : matched

  // One position and never two: the undressed table's, else where the caption put her in the
  // dressed one's words ("on the couch"), else the one her hands imply, else standing. Taking the
  // dressed row as well as another is how a picture came out both sitting and lying on her back.
  const implied = hands.find((action) => action.implies)?.implies
  tags.push(...(position?.tags ?? dressed?.tags ?? implied ?? BARE_POSITION_DEFAULT))
  if (facing) tags.push(...facing.tags)

  for (const modifier of MODIFIERS) {
    if (fires(text, modifier.cues)) tags.push(...modifier.tags)
  }

  if (hands.length > 0) {
    // The action owns her hands: every placement collected so far is struck out first.
    const kept = tags.filter((tag) => !PLACEMENT_TAGS.has(tag))
    return [...new Set([...kept, ...hands.flatMap((action) => action.tags)])]
  }
  if (fires(text, VAGUE_TOUCH.cues)) tags.push(...VAGUE_TOUCH.tags)

  return [...new Set(tags)]
}
