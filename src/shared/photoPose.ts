import { FRAMING_TAGS, framingOf, framingTags, FULL_BODY_CUES } from './photoFraming'
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
  { cues: ['close-up', 'close up'], tags: ['close-up', 'upper_body', 'hand_up'] },
  { cues: ['face shot', 'face only', 'just her face'], tags: ['close-up', 'portrait'] },
  { cues: ['on her stomach', 'face down', 'prone'], tags: ['lying', 'on_stomach'] },
  { cues: ['on her side', 'side lying'], tags: ['lying', 'on_side'] },
  { cues: ['on her back', 'lying back'], tags: ['lying', 'on_back'] },
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
  },
  // `from_side` alone was drawn facing three-quarters on; `profile` is what turns her.
  {
    cues: ['from the side', 'side view', 'in profile', 'side profile', 'profile shot'],
    tags: ['from_side', 'profile']
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

/**
 * Her hands already busy with something the sentence names: a cup, a book, a wave. The
 * checkpoint draws these from the sentence alone, and an object tag beside it only adds a
 * second cup; what does get in the way is a position's own hand, `hand_on_own_hip` beside the
 * cup she is holding. So nothing is added here, and the placements are struck out.
 */
const BUSY_HAND_CUES = [
  'holding',
  'holds',
  'clutching',
  'carrying',
  'sipping',
  'drinking',
  'eating',
  'taking a bite',
  'reading',
  'waving',
  'hugging',
  'cradling',
  'playing with her hair',
  'resting on her hand',
  'cheek on her hand',
  'chin on her hand',
  'chin in her hand',
  'propped',
  'biting',
  'bites',
  'tucking her hair',
  'fixing her hair'
]

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
  { cues: ['mirror'], tags: ['mirror', 'reflection'] },
  // Where the camera is: a caption that says how low or high it was asks for the angle.
  {
    cues: [
      'from below',
      'low angle',
      'from under',
      'shot low',
      'shot from low',
      'looking up at her',
      'angled up',
      'camera low',
      'phone low'
    ],
    tags: ['from_below']
  },
  {
    cues: [
      'from above',
      'high angle',
      'overhead shot',
      'shot from above',
      'looking down at her',
      'angled down',
      'camera high',
      'phone high',
      'held up high'
    ],
    tags: ['from_above']
  }
]

/**
 * The modifiers a dressed picture may still carry, keyed by each row's first tag: her face,
 * the shot, and clothes coming off are all things a photo with clothes in it can show.
 */
const DRESSED_MODIFIERS: ReadonlySet<string> = new Set([
  'from_below',
  'from_above',
  'undressing',
  'seductive_smile',
  'arched_back',
  'blush',
  'looking_at_viewer',
  'mirror'
])

/** The tags {@link posePhotoTags} gives, before what her legs are doing is settled. */
function poseTagsOf(caption: string, bare: boolean): string[] {
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
    return onePlacement([...new Set(tags)])
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
  // Only where nothing has placed her hands yet: "a hand on her hip" is a placement, not a touch.
  if (!tags.some((tag) => PLACEMENT_TAGS.has(tag)) && fires(text, VAGUE_TOUCH.cues)) {
    tags.push(...VAGUE_TOUCH.tags)
  }

  return onePlacement([...new Set(tags)])
}

/** The photo's tags, and what its negative has to keep out of it. */
export interface PhotoPose {
  tags: string[]
  negative: string[]
}

/** A phone held at arm's length is never in its own picture; a mirror is where it shows. */
const PHONE_NEGATIVE = ['phone', 'cellphone', 'smartphone', 'holding_phone']

/**
 * Kept out of a selfie too: without it the checkpoint puts a camera in her free hand, which
 * the same-seed tests never showed only because they all had it in the negative. Allowed where
 * the caption gives her one.
 */
const CAMERA_CUES = ['holding a camera', 'her camera', 'a camera in', 'film camera', 'polaroid']

/**
 * The `selfie` tag adds a peace sign on its own, which is a selfie's own gesture: kept, unless
 * her free hand is holding something, where it would be a third hand. Asked for, always kept.
 */
const PEACE_CUES = ['peace sign', 'v sign', 'v-sign', 'flashing a v']


/**
 * A selfie, as tested on the checkpoint (same seed, one change at a time). Her own arm holds the
 * camera, so it reaches out of the picture and the phone stays out of it; how she is lying
 * decides which tags carry that, since the plain ones fail in some poses:
 * - on her stomach the camera stays in front of her face, and `from_above` is ignored;
 * - on her side `outstretched_arm` draws an open palm at the lens, where `selfie` from above
 *   draws the arm going out of frame;
 * - a whole-body shot loses the `selfie` tag, which pulls the camera in close.
 * Lying down, she is drawn from the waist up unless the caption asks for all of her: the arm
 * only reaches that far. A mirror selfie is the one picture with the phone in it.
 */
function selfieShot(text: string, tags: readonly string[]): PhotoPose | null {
  if (!says(text, 'selfie')) return null
  const has = (tag: string): boolean => tags.includes(tag)
  const peace = saysAny(text, PEACE_CUES)
  if (says(text, 'mirror')) {
    // Her back to a mirror drew her twice, the reflection facing the other way: the mirror
    // shows her front, whichever way the caption turned her.
    const turned = new Set(['from_behind', 'looking_back', 'from_side', 'profile'])
    const kept = tags.filter((tag) => !FRAMING_TAGS.has(tag) && !turned.has(tag))
    const add = ['mirror', 'reflection', 'holding_phone', 'full_body']
    return { tags: [...new Set([...kept, ...add])], negative: [] }
  }
  // The arm holding the phone is not also on her hip.
  const kept = tags.filter((tag) => !FRAMING_TAGS.has(tag) && !PLACEMENT_TAGS.has(tag))
  const camera = saysAny(text, CAMERA_CUES) ? [] : ['camera']
  const busy = !peace && saysAny(text, BUSY_HAND_CUES)
  const negative = [...PHONE_NEGATIVE, ...camera, ...(busy ? ['v'] : [])]
  // `from_below` alone left a selfie at eye level; her looking down into the phone held low
  // is what moved the camera under her.
  const low = has('from_below') ? ['looking_down'] : []
  const shot = (add: string[], extra: string[] = []): PhotoPose => ({
    tags: [...new Set([...kept, ...add, ...low, ...(peace ? ['v'] : [])])],
    negative: [...negative, ...extra]
  })
  const whole = saysAny(text, FULL_BODY_CUES)
  if (has('on_stomach')) {
    const rest = kept.filter((tag) => tag !== 'on_stomach' && tag !== 'from_above')
    const legs = whole ? ['(legs_up:1.1)'] : ['upper_body']
    return {
      tags: [...new Set(['(on_stomach:1.2)', ...legs, ...rest, 'outstretched_arm'])],
      negative: [...negative, 'on_back']
    }
  }
  if (has('on_side')) {
    return shot(['selfie', 'from_above', ...(whole ? [] : ['upper_body'])], [
      'on_back',
      'on_stomach',
      'open_hand',
      'spread_fingers',
      'reaching_towards_viewer'
    ])
  }
  if (has('on_back') && !whole) {
    return shot(['selfie', 'from_above', 'outstretched_arm', 'upper_body'], ['on_stomach'])
  }
  if (whole || has('lying') || has('sitting')) {
    // From above, as tested; a caption that asked for it from below keeps that instead.
    const angle = has('from_below') ? [] : ['from_above', 'looking_up']
    return shot(['full_body', ...angle, '(outstretched_arm:1.2)', 'foreshortening'])
  }
  return shot(['selfie', 'upper_body', 'outstretched_arm', 'foreshortening'])
}

/** A caption asking for her from the waist up, or closer. */
const CLOSE_CUES = ['close-up', 'close up', 'upper body', 'waist up', 'face shot', 'just her face']

/** How she is lying, read off the caption whichever row framed it. */
const LYING_CUES: readonly (readonly [string, readonly string[]])[] = [
  ['on_stomach', ['on her stomach', 'face down', 'prone']],
  ['on_side', ['on her side', 'side lying']],
  ['on_back', ['on her back', 'lying back']]
]

/**
 * Her lying down, drawn close. The close-up row used to win and drop how she was lying; and on
 * her back or side the checkpoint keeps her whole body in shot through `upper_body`, `portrait`
 * and every framing tried but `(upper_body:1.3)`. On her stomach the plain tag already holds.
 */
function closeLying(text: string, tags: readonly string[]): string[] | null {
  if (!saysAny(text, CLOSE_CUES)) return null
  const lying = LYING_CUES.find(([, cues]) => saysAny(text, cues))?.[0]
  if (!lying) return null
  const kept = tags.filter(
    (tag) =>
      !FRAMING_TAGS.has(tag) && tag !== 'hand_up' && !LYING_CUES.some(([pose]) => pose === tag)
  )
  const frame = lying === 'on_stomach' ? 'upper_body' : '(upper_body:1.3)'
  return [...new Set(['lying', lying, frame, ...kept])]
}

/**
 * The framing the caption names, in place of the one her position came with: "standing" alone
 * is shot from the thighs up, "standing, full body" is not.
 */
function withFraming(text: string, tags: readonly string[]): string[] {
  const framing = framingOf(text)
  if (!framing) return [...tags]
  const kept = tags.filter((tag) => !FRAMING_TAGS.has(tag))
  return [...new Set([...kept, ...framingTags(framing)])]
}

/** How she is lying, kept from turning into one of the other two. */
function lyingNegative(tags: readonly string[]): string[] {
  if (tags.includes('on_stomach')) return ['on_back']
  if (tags.includes('on_side')) return ['on_back', 'on_stomach']
  if (tags.includes('on_back')) return ['on_stomach']
  return []
}

/** A part of the sentence about the phone or camera taking the picture. */
const HOLDS_CAMERA = /\b(?:camera|phone|cellphone|smartphone)\b/
const HOLDING_IT =
  /\b(?:hold\w*|rais\w*|angl\w*|aim\w*|lift\w*|tilt\w*|grip\w*|clutch\w*|extend\w*)\b/

/**
 * Her selfie's sentence without how she holds the phone. The model reads "holding the camera
 * low" as a camera to draw in her hand, and the sentence outweighs any negative; the angle in
 * those words has already been read off into `from_below` or `from_above` by then. Only an
 * ordinary selfie: a mirror selfie shows the phone, and a caption that gives her a camera of
 * her own keeps it.
 */
export function withoutCameraHold(scene: string): string {
  const text = scene.toLowerCase()
  if (!says(text, 'selfie') || says(text, 'mirror') || saysAny(text, CAMERA_CUES)) return scene
  return scene
    .split(/,|;|\s+while\s+|\s+as\s+/)
    .map((part) => part.trim())
    .filter((part) => {
      const lower = part.toLowerCase()
      return part.length > 0 && !(HOLDS_CAMERA.test(lower) && HOLDING_IT.test(lower))
    })
    .join(', ')
}

/**
 * One hand placement at most: her position's own, the first one in. Turned away, from behind,
 * adds a hand on her hip of its own, and bent over with her hands on her knees that made two.
 */
function onePlacement(tags: readonly string[]): string[] {
  const first = tags.find((tag) => PLACEMENT_TAGS.has(tag))
  return tags.filter((tag) => !PLACEMENT_TAGS.has(tag) || tag === first)
}

/** Legs held together, which no position may open: the caption's word over the position's. */
const CROSSED_CUES = [
  'legs crossed',
  'crossed legs',
  'crosses her legs',
  'crossing her legs',
  'legs tightly crossed',
  'thighs pressed together',
  'knees together'
]

/**
 * Turns one caption into composition tags. `bare` opens the second half of the vocabulary —
 * the positions and actions that only make sense with nothing on — and is decided by the gate,
 * never by anything read here.
 */
export function posePhotoTags(caption: string, bare: boolean): string[] {
  return photoPose(caption, bare).tags
}

/** {@link posePhotoTags}, with the negative tags the shot needs beside them. */
export function photoPose(caption: string, bare: boolean): PhotoPose {
  const text = caption.toLowerCase()
  let tags = poseTagsOf(caption, bare)
  // A position's default spread, or one her hands imply, never overrules legs she has crossed.
  if (saysAny(text, CROSSED_CUES)) {
    tags = [...new Set([...tags.filter((tag) => tag !== 'spread_legs'), 'crossed_legs'])]
  }
  // Turned to face the camera, she is not side on any more: the profile goes.
  if (tags.includes('looking_at_viewer')) tags = tags.filter((tag) => tag !== 'profile')
  const lying = closeLying(text, tags)
  tags = lying ?? withFraming(text, tags)
  if (saysAny(text, BUSY_HAND_CUES)) tags = tags.filter((tag) => !PLACEMENT_TAGS.has(tag))
  return selfieShot(text, tags) ?? { tags, negative: lyingNegative(tags) }
}
