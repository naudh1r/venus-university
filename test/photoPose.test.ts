import { describe, expect, it } from 'vitest'
import { buildPhotoPrompt } from '../src/shared/photoPrompt'
import { character } from './fixtures'
import {
  photoPose,
  posePhotoTags,
  withoutCameraHold,
  withoutHeldObject,
  withoutSelfieWord
} from '../src/shared/photoPose'

describe('posePhotoTags', () => {
  it('reads the framing off an ordinary caption', () => {
    expect(posePhotoTags('a close-up in her new coat', false)).toEqual(
      expect.arrayContaining(['close-up', 'portrait'])
    )
  })

  it('keeps the undressed vocabulary shut while she is dressed', () => {
    const tags = posePhotoTags('lying on her back, touching herself', false)
    expect(tags).not.toContain('masturbation')
    expect(tags).not.toContain('spread_legs')
  })

  /**
   * The rule the whole table is built around. Her position hands her a placement, the action
   * hands her another, and a prompt carrying both is how a picture grows a third arm.
   */
  it('lets an action take her hands away from the pose that placed them', () => {
    const tags = posePhotoTags('sitting on the floor, fingering herself', true)
    expect(tags).toContain('sitting')
    expect(tags).toContain('fingering')
    expect(tags).not.toContain('hands_on_own_thighs')
    expect(tags).not.toContain('hands_on_own_lap')
  })

  it('lets her position come from what her hands are doing when nothing else says', () => {
    const tags = posePhotoTags('touching herself while she thinks about him', true)
    expect(tags).toContain('lying')
    expect(tags).toContain('on_back')
  })

  it('gives both hands something to do, and no more than both', () => {
    const tags = posePhotoTags(
      'fingering herself while playing with her nipples, biting her lip',
      true
    )
    expect(tags).toContain('fingering')
    expect(tags).toContain('grabbing_own_breast')
    expect(tags).toContain('seductive_smile')
  })

  it('catches nipple play written around the noun', () => {
    expect(posePhotoTags('lying back, teasing her stiff nipples', true)).toContain(
      'grabbing_own_breast'
    )
  })

  it('stacks modifiers but keeps one position', () => {
    const tags = posePhotoTags('naked on all fours, arching her back, blushing hard', true)
    expect(tags).toContain('all_fours')
    expect(tags).toContain('arched_back')
    expect(tags).toContain('blush')
    expect(tags).not.toContain('standing')
  })

  it('falls back to standing when the caption says nothing about her body', () => {
    expect(posePhotoTags('naked in the bathroom light', true)).toContain('standing')
  })

  it('adds no anal or partner position tags of its own, whatever the caption says', () => {
    const tags = posePhotoTags('naked on all fours, doggy, fingering her anus', true)
    expect(tags).not.toContain('anal_fingering')
    expect(tags).not.toContain('anus')
    expect(tags).not.toContain('anal_object_insertion')
  })

  it('reads stems as the start of a word, not letters inside one', () => {
    expect(posePhotoTags('naked, masturbating on the bed', true)).toContain('masturbation')
    expect(posePhotoTags('naked, standing by the display case', true)).not.toContain('spread_legs')
  })

  /** Two positions in one prompt leave the checkpoint to pick, and it picks badly. */
  it('gives an undressed picture one position, never two', () => {
    const couch = posePhotoTags('naked, fingering herself on the couch', true)
    expect(couch).toContain('sitting')
    expect(couch).not.toContain('lying')

    const bed = posePhotoTags('naked, a vibrator between her legs, sitting on the bed', true)
    expect(bed).toContain('sitting')
    expect(bed).not.toContain('lying')

    // With no position written at all, her hands decide it.
    expect(posePhotoTags('masturbating in the bath', true)).toEqual(
      expect.arrayContaining(['lying', 'on_back'])
    )
  })
})

describe('her hands already busy', () => {
  it('leaves her hands to the sentence, without a position of their own', () => {
    const tags = posePhotoTags('standing at the counter holding a coffee', false)
    expect(tags).toContain('standing')
    expect(tags).not.toContain('hand_on_own_hip')
    expect(posePhotoTags('sitting in the library, reading a book', false)).not.toContain(
      'hands_on_lap'
    )
  })

  it('keeps an explicit act her hands are doing', () => {
    const tags = posePhotoTags('naked on the bed, fingering herself, holding a pillow', true)
    expect(tags).toContain('fingering')
  })
})

describe('her hands on an activity', () => {
  const placements = [
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
  ]

  it('puts her hands on the guitar balanced against her hip', () => {
    const tags = posePhotoTags(
      'In her room, sitting cross-legged on an unmade bed with a dark acoustic guitar ' +
        'balanced against her hip, taken from the waist up.',
      false
    )
    expect(tags).toEqual(
      expect.arrayContaining([
        'sitting',
        'indian_style',
        '(upper_body:1.3)',
        'holding_instrument',
        'guitar'
      ])
    )
    expect(tags.some((tag) => placements.includes(tag))).toBe(false)
  })

  it.each([
    ['strumming her guitar on the bed', ['playing_guitar', 'holding_instrument']],
    ['practising her ukulele', ['playing_instrument', 'holding_instrument', 'ukulele']],
    ['practicing her bass', ['playing_bass_guitar', 'holding_instrument']],
    ['playing her violin', ['playing_instrument', 'holding_instrument', 'violin']],
    ['with her ukulele', ['holding_instrument', 'ukulele']],
    ['with her bass', ['holding_instrument', 'bass_guitar']],
    ['with her violin', ['holding_instrument', 'violin']],
    ['with her cello', ['holding_instrument', 'cello']],
    ['with her flute', ['holding_instrument', 'flute']],
    ['at her desk typing on her laptop', ['typing', 'laptop']],
    ['on her laptop', ['typing', 'laptop']],
    ['curled up on the sofa reading a book', ['reading', 'holding_book']],
    ['reading a letter', ['reading']],
    ['writing in her notebook', ['writing', 'holding_pen']],
    ['studying', ['writing', 'holding_pen']],
    ['doing homework', ['writing', 'holding_pen']],
    ['drawing a picture', ['drawing_(action)', 'holding_pencil']],
    ['sketching a landscape', ['drawing_(action)', 'holding_pencil']],
    ['painting a picture', ['painting_(action)', 'holding_paintbrush']],
    ['gaming with a controller', ['playing_games', 'holding_controller']],
    ['playing games on a handheld console', ['playing_games', 'handheld_game_console']],
    ['eating ramen at a counter', ['eating']],
    ['sipping a coffee', ['drinking']],
    ['drinking tea', ['drinking']],
    ['cooking dinner', ['cooking']],
    ['stirring a pot', ['cooking']],
    ['knitting', ['knitting']],
    ['brushing her hair', ['brushing_hair']],
    ['applying makeup', ['applying_makeup']],
    ['applying lipstick', ['applying_makeup']],
    ['hugging a plush', ['hugging_object']],
    ['cuddling a pillow', ['hugging_object']],
    ['singing into a microphone', ['holding_microphone', 'singing']],
    ['singing by the window', ['holding_microphone', 'singing']],
    ['with a mic', ['holding_microphone']],
    ['waving', ['waving']],
    ['pointing at the view', ['pointing']]
  ])('owns her hands while %s', (activity, expected) => {
    const tags = posePhotoTags(`Sitting on the bench, ${activity}.`, false)
    expect(tags).toEqual(expect.arrayContaining(expected))
    expect(tags.some((tag) => placements.includes(tag))).toBe(false)
  })

  it('keeps her hands on the laptop or book in the reported scenes', () => {
    const typing = posePhotoTags('Sitting at her desk typing on her laptop', false)
    expect(typing).toEqual(expect.arrayContaining(['sitting', 'typing', 'laptop']))
    expect(typing.some((tag) => placements.includes(tag))).toBe(false)
    const reading = posePhotoTags('Curled up on the sofa reading a book', false)
    expect(reading).toEqual(expect.arrayContaining(['reading', 'holding_book']))
    expect(reading.some((tag) => placements.includes(tag))).toBe(false)
  })

  it('adds an action without another food, cup, book, controller or instrument', () => {
    expect(posePhotoTags('eating ramen at a counter', false)).toEqual(['eating'])
    expect(posePhotoTags('sipping a coffee', false)).toEqual(['drinking'])
    expect(posePhotoTags('reading a letter', false)).toEqual(['reading'])
    const guitar = posePhotoTags('strumming her guitar', false)
    expect(guitar).not.toContain('guitar')
    const handheld = posePhotoTags('gaming on a handheld game console', false)
    expect(handheld).not.toContain('holding_controller')
    expect(posePhotoTags('painting her nails', false)).not.toContain('painting_(action)')
  })

  it('matches one specific activity and tags her hair gesture', () => {
    const guitar = posePhotoTags('playing her guitar beside a book she was reading', false)
    expect(guitar).toEqual(['playing_guitar', 'holding_instrument'])
    expect(posePhotoTags('Sitting on the bench, playing with her hair', false)).toEqual([
      'sitting',
      'cowboy_shot',
      'hand_in_own_hair'
    ])
  })

  it('seats her at a piano or keyboard only when no position was given', () => {
    for (const [instrument, action] of [
      ['piano', 'playing_piano'],
      ['keyboard', 'keyboard_(instrument)']
    ]) {
      for (const bare of [false, true]) {
        const tags = posePhotoTags(`A close-up at her ${instrument}`, bare)
        expect(tags).toEqual(expect.arrayContaining(['sitting', action]))
        expect(tags).not.toContain('standing')
        const standing = posePhotoTags(`A close-up standing at her ${instrument}`, bare)
        expect(standing).not.toContain('sitting')
      }
    }
  })

  it.each([
    'texting',
    'scrolling',
    'tying',
    'fixing',
    'adjusting',
    'sewing',
    'holding up',
    'showing off'
  ])('clears placements for %s without inventing an activity tag', (activity) => {
    const tags = posePhotoTags(`Standing by the window, ${activity}.`, false)
    expect(tags).toEqual(['standing', 'cowboy_shot'])
  })

  it('matches plural nouns and keeps bass and mic out of other words', () => {
    expect(posePhotoTags('with her guitars', false)).toContain('holding_instrument')
    expect(posePhotoTags('with her microphones', false)).toContain('holding_microphone')
    expect(posePhotoTags('standing by a bassinet under a microscopic pattern', false)).toEqual([
      'standing',
      'cowboy_shot',
      'hand_on_own_hip'
    ])
  })

  it('keeps mirror selfies and their phone hand out of instrument and activity rules', () => {
    const scene = 'A mirror selfie in her room, sitting on the bed'
    const original = photoPose(scene, 'everyday')
    for (const activity of [
      'with her guitar behind her',
      'strumming her guitar',
      'typing on her laptop',
      'gaming with a controller'
    ]) {
      expect(photoPose(`${scene} ${activity}`, 'everyday')).toEqual(original)
    }
    const reading = photoPose(`${scene} reading a book`, 'everyday').tags
    expect(reading).toContain('holding_phone')
    expect(reading).not.toContain('reading')
    expect(reading).not.toContain('holding_book')
    expect(reading.some((tag) => placements.includes(tag))).toBe(false)
    expect(
      photoPose('A mirror selfie in her room with her guitar behind her', 'everyday').tags
    ).not.toContain('holding_instrument')
    for (const gesture of ['waving', 'pointing']) {
      expect(photoPose(`${scene}, ${gesture}`, 'everyday').tags).toEqual(
        expect.arrayContaining(['holding_phone', gesture])
      )
    }
    expect(posePhotoTags('A photo by a mirror with her guitar', false)).toContain(
      'holding_instrument'
    )
  })
})

describe('undressing hands', () => {
  it.each([
    'pulling',
    'pulling down',
    'pulling up',
    'tugging',
    'lifting',
    'lowering',
    'unbuttoning',
    'unzipping',
    'slipping off',
    'sliding off',
    'peeling off',
    'holding up her top',
    'holding up her skirt',
    'holding up her shirt'
  ])('clears placements for %s in a clothed or explicit pose', (action) => {
    for (const bare of [false, true]) {
      const tags = posePhotoTags(`Standing in her room, ${action}.`, bare)
      expect(tags).not.toContain('hand_on_own_hip')
      expect(tags).not.toContain('hands_on_own_thighs')
    }
  })

  it('keeps the existing hand action when she is holding herself open', () => {
    expect(posePhotoTags('Naked, standing, holding herself open', true)).toEqual(
      expect.arrayContaining(['spread_pussy', 'spread_legs'])
    )
  })
})

describe('her free hand', () => {
  it('puts her free hand at her choker and keeps one phone in a mirror selfie', () => {
    const pose = photoPose(
      'A mirror selfie of her in her room, smiling sweetly at the viewer while toying with her choker.',
      'everyday'
    )
    expect(pose.tags).toEqual(expect.arrayContaining(['hand_on_own_neck', 'holding_phone']))
    expect(pose.negative).toEqual(['dual_wielding'])
  })

  it.each([
    ['touching her choker', 'hand_on_own_neck'],
    ['adjusting her necklace', 'hand_on_own_neck'],
    ['fiddling with her necklace', 'hand_on_own_neck'],
    ['twirling her hair and smiling', 'hand_in_own_hair'],
    ['playing with her hair', 'hand_in_own_hair'],
    ['tucking her hair behind her ear', 'hand_in_own_hair'],
    ['running a hand through her hair', 'hand_in_own_hair'],
    ['a hand on her cheek', 'hand_on_own_cheek'],
    ['her cheek resting on her hand', 'hand_on_own_cheek'],
    ['a hand on her face', 'hand_on_own_face'],
    ['a finger to her lips', 'finger_to_mouth'],
    ['biting her finger', 'biting_own_finger'],
    ['biting her nail', 'nail_biting'],
    ['a hand on her chin', 'hand_on_own_chin'],
    ['chin on her hand', 'head_rest'],
    ['a hand over her heart', 'hand_on_own_chest'],
    ['tugging her hem', 'adjusting_clothes'],
    ['tugging her sleeve', 'adjusting_clothes'],
    ['adjusting her clothes', 'adjusting_clothes'],
    ['blowing a kiss', 'blowing_kiss']
  ])('keeps %s across tiers and shots', (caption, tag) => {
    for (const tier of ['everyday', 'suggestive', 'explicit'] as const) {
      for (const shot of ['A photo', 'A selfie', 'A mirror selfie']) {
        const pose = photoPose(`${shot}, sitting at a cafe table, ${caption}.`, tier)
        expect(pose.tags).toContain(tag)
        expect(pose.tags).not.toContain('hands_on_lap')
        if (shot === 'A mirror selfie') expect(pose.tags).toContain('holding_phone')
      }
    }
  })

  it('takes only the first matching gesture', () => {
    const tags = photoPose('A photo, waving while toying with her choker', 'everyday').tags
    expect(tags).toContain('waving')
    expect(tags).not.toContain('hand_on_own_neck')
    const hair = photoPose('A photo, waving while playing with her hair', 'everyday').tags
    expect(hair).toContain('waving')
    expect(hair).not.toContain('hand_in_own_hair')
  })

  it('reserves the free hand for one gesture even when a peace sign is also named', () => {
    for (const shot of ['A photo', 'A selfie', 'A mirror selfie']) {
      const choker = photoPose(
        `${shot}, toying with her choker while flashing a peace sign`, 'everyday'
      ).tags
      expect(choker).toContain('hand_on_own_neck')
      expect(choker).not.toContain('v')
      const breast = photoPose(
        `${shot}, grabbing her breasts while flashing a peace sign`, 'explicit'
      ).tags
      expect(breast).toContain('grabbing_own_breast')
      expect(breast).not.toContain('v')
      if (shot === 'A mirror selfie') {
        expect(choker).toContain('holding_phone')
        expect(breast).toContain('holding_phone')
      }
    }
  })

  it('keeps explicit hand actions ahead of gestures', () => {
    const pose = photoPose(
      'A mirror selfie, grabbing her breasts while twirling her hair',
      'explicit'
    )
    expect(pose.tags).toContain('grabbing_own_breast')
    expect(pose.tags).toContain('holding_phone')
    expect(pose.tags).not.toContain('hand_in_own_hair')
    const neck = photoPose('A close-up, touching her choker', 'explicit').tags
    expect(neck).toContain('hand_on_own_neck')
    expect(neck).not.toContain('hand_on_own_chest')
  })

  it('preserves a mirror peace sign and one-handed body actions', () => {
    const peace = photoPose('A mirror selfie, standing, making a peace sign', 'everyday')
    expect(peace.tags).toEqual(expect.arrayContaining(['v', 'holding_phone']))
    expect(peace.negative).toEqual(['dual_wielding'])
    expect(peace.tags).not.toContain('hand_on_own_hip')
    const breasts = photoPose('A mirror selfie, both hands on her breasts', 'explicit')
    expect(breasts.tags).toEqual(expect.arrayContaining(['grabbing_own_breast', 'holding_phone']))
    expect(breasts.tags).not.toContain('both_hands')
    expect(breasts.negative).toEqual(['dual_wielding'])
    const spread = photoPose('A mirror selfie, spreading her pussy with both hands', 'explicit')
    expect(spread.tags).toEqual(expect.arrayContaining(['spread_pussy', 'holding_phone']))
    expect(spread.tags.some((tag) => /spread_legs/.test(tag))).toBe(false)
    const finger = photoPose('A mirror selfie, a hand between her legs', 'explicit')
    expect(finger.tags).toEqual(expect.arrayContaining(['fingering', 'holding_phone']))
  })

  it('fits only the first explicit hand action beside the mirror phone', () => {
    const caption = 'grabbing her breasts while spreading herself open'
    const mirror = photoPose(`A mirror selfie, ${caption}`, 'explicit')
    expect(mirror.tags).toContain('grabbing_own_breast')
    expect(mirror.tags).toContain('holding_phone')
    expect(mirror.tags).not.toContain('spread_pussy')
    const friend = photoPose(`A photo a friend took, ${caption}`, 'explicit')
    expect(friend.tags).toEqual(expect.arrayContaining(['grabbing_own_breast', 'spread_pussy']))
  })

  it.each([
    ['making a heart with her hands', 'heart_hands'],
    ['her hands behind her back', 'arms_behind_back']
  ])('leaves two-handed gestures out of a mirror: %s', (caption, tag) => {
    const mirror = photoPose(`A mirror selfie, ${caption}`, 'everyday')
    expect(mirror.tags).not.toContain(tag)
    expect(mirror.tags).toContain('holding_phone')
    const friend = photoPose(`A photo a friend took of her, ${caption}`, 'everyday')
    expect(friend.tags).toContain(tag)
    expect(friend.tags).not.toContain('holding_phone')
    expect(friend.negative).not.toContain('dual_wielding')
    const selfie = photoPose(`A selfie, ${caption}`, 'everyday')
    expect(selfie.tags).toContain(tag)
    expect(selfie.tags).not.toContain('holding_phone')
    expect(selfie.tags).not.toContain('outstretched_arm')
    expect(withoutSelfieWord(`A selfie, ${caption}`)).toBe(`A photo, ${caption}`)
  })

  it('leaves covering gestures out of everyday photos and enables them only in higher tiers', () => {
    const girl = character()
    for (const [caption, tag] of [
      ['covering her chest', 'covering_breasts'],
      ['covering herself shyly', 'covering_crotch']
    ]) {
      const scene = `Standing in her room, ${caption}.`
      const everyday = buildPhotoPrompt(girl, 'everyday', scene).positive
      expect(everyday).not.toMatch(/covering_breasts|covering_crotch/)
      for (const tier of ['suggestive', 'explicit'] as const) {
        expect(photoPose(scene, tier).tags).toContain(tag)
        expect(buildPhotoPrompt(girl, tier, scene).positive).toContain(tag)
      }
    }
  })
})

describe('her hands holding clothes', () => {
  it.each([
    ['holding her panties', 'holding_panties'],
    ['dangling her panties', 'holding_panties'],
    ['her panties which she dangles from one trembling finger', 'holding_panties'],
    ['her panties hanging from her finger', 'holding_panties'],
    ['swinging her bra', 'holding_bra'],
    ['holding up her bra', 'holding_bra']
  ])('names %s and clears her hip hand', (caption, tag) => {
    for (const tier of ['everyday', 'suggestive', 'explicit'] as const) {
      const pose = photoPose(`Standing, ${caption}.`, tier)
      expect(pose.tags).toContain(tag)
      expect(pose.tags).not.toContain('hand_on_own_hip')
    }
    const mirror = photoPose(`A mirror selfie, standing, ${caption}.`, 'explicit')
    expect(mirror.tags).toEqual(expect.arrayContaining([tag, 'holding_phone']))
  })
})

describe('a selfie', () => {
  it('keeps the phone out, her arm reaching out of the picture', () => {
    const pose = photoPose('a selfie in the cafe, smiling', 'everyday')
    expect(pose.tags).toEqual(
      expect.arrayContaining(['selfie', 'upper_body', 'outstretched_arm', 'foreshortening'])
    )
    expect(pose.negative).toEqual(expect.arrayContaining(['phone', 'holding_phone', 'camera']))
    expect(pose.negative).not.toContain('v')
    const holding = photoPose('a selfie holding an iced coffee', 'everyday')
    expect(holding.negative).toContain('v')
    expect(photoPose('a selfie holding her film camera', 'everyday').negative).not.toContain('camera')
  })

  it('keeps the peace sign she asked for', () => {
    const pose = photoPose('a selfie flashing a peace sign', 'everyday')
    expect(pose.tags).toContain('v')
    expect(pose.negative).not.toContain('v')
  })

  it('reads a lying selfie from the side, with a thumbs up, as one angle and her own gesture', () => {
    const tags = posePhotoTags('a selfie lying on her bed, giving a thumbs up, from the side', false)
    expect(tags).toEqual(expect.arrayContaining(['from_side', 'thumbs_up']))
    expect(tags).not.toContain('from_above')
  })

  it('sits her on the grass when the caption says sitting', () => {
    expect(posePhotoTags('sitting on the grass on the campus lawn', false)).toContain('sitting')
    expect(posePhotoTags('sitting on the grass on the campus lawn', false)).not.toContain('lying')
    expect(posePhotoTags('on the grass in the park, smiling', false)).toContain('lying')
  })

  it('draws a selfie with two things in her hands as a photo', () => {
    const tags = posePhotoTags('a selfie under an umbrella, eating a crepe', false)
    expect(tags).not.toContain('selfie')
    expect(tags.join(' ')).not.toContain('outstretched_arm')
  })

  it('takes a mirror she only stands near as part of the room, not the picture', () => {
    expect(posePhotoTags('standing angled away from the full-length mirror, looking back', true)).not.toContain('mirror')
    expect(posePhotoTags('posing in the mirror of her room', false)).toContain('mirror')
  })

  it('shows the phone in a mirror selfie', () => {
    const pose = photoPose('a mirror selfie in her new coat', 'everyday')
    expect(pose.tags).toEqual(expect.arrayContaining(['mirror', 'holding_phone']))
    expect(pose.tags).not.toContain('reflection')
    expect(pose.negative).toEqual(['dual_wielding'])
  })

  it('takes a whole-body shot from above without the selfie tag', () => {
    const pose = photoPose('a full body selfie of her outfit, standing', 'everyday')
    expect(pose.tags).toEqual(
      expect.arrayContaining(['full_body', 'from_above', '(outstretched_arm:1.2)'])
    )
    expect(pose.tags).not.toContain('selfie')
    expect(pose.tags).not.toContain('cowboy_shot')
  })

  it('holds her on her stomach, with the camera in front of her face', () => {
    const pose = photoPose('a selfie lying on her stomach on the bed', 'everyday')
    expect(pose.tags).toEqual(
      expect.arrayContaining(['(on_stomach:1.2)', 'outstretched_arm', 'upper_body'])
    )
    expect(photoPose('a full body selfie on her stomach', 'everyday').tags).toContain('(legs_up:1.1)')
    expect(pose.tags).not.toContain('from_above')
    expect(pose.negative).toContain('on_back')
  })

  it('draws the arm out of frame, not a palm at the lens, on her side', () => {
    const pose = photoPose('a selfie lying on her side in bed', 'everyday')
    expect(pose.tags).toEqual(expect.arrayContaining(['on_side', 'selfie', 'from_above']))
    expect(pose.tags).not.toContain('outstretched_arm')
    expect(pose.negative).toEqual(expect.arrayContaining(['open_hand', 'on_stomach']))
  })

  it('frames a selfie on her back from the waist up, unless she asks for all of her', () => {
    const pose = photoPose('a selfie lying on her back in bed', 'everyday')
    expect(pose.tags).toEqual(expect.arrayContaining(['selfie', 'upper_body', 'on_back']))
    expect(photoPose('a full body selfie on her back', 'everyday').tags).toContain('full_body')
  })

  it('keeps how she is lying with the close-up she asked for', () => {
    const side = photoPose('a close-up of her lying on her side in bed', 'everyday')
    expect(side.tags).toEqual(expect.arrayContaining(['lying', 'on_side', 'close-up', 'portrait']))
    expect(side.tags).not.toContain('(upper_body:1.3)')
    expect(side.negative).toEqual(['on_back', 'on_stomach', 'camera'])
    const stomach = photoPose('close up, on her stomach on the bed', 'everyday')
    expect(stomach.tags).toEqual(expect.arrayContaining(['on_stomach', 'close-up', 'portrait']))
  })

  it('keeps a picture somebody else took from flipping her over', () => {
    const side = photoPose('lying on her side in bed', 'everyday')
    expect(side.tags).not.toContain('selfie')
    expect(side.negative).toEqual(['on_back', 'on_stomach', 'camera'])
    expect(photoPose('in a cafe, smiling', 'everyday').negative).toEqual(['camera'])
    expect(photoPose('holding her film camera in the park', 'everyday').negative).toEqual([])
  })
})

describe('a selfie caption that says how she holds the phone', () => {
  /** The first in-game selfie's caption, which drew a camera into her free hand. */
  const caption =
    'A close, slightly blurry stockroom selfie of crouched among stacked boxes, cream ' +
    'off-shoulder sweater and jeans, one hand holding the camera low and angled up while ' +
    'she looks into the lens with a teasing smirk'

  it('drops the holding, keeps the rest, and reads the angle from it first', () => {
    const scene = withoutCameraHold(caption)
    expect(scene).not.toMatch(/camera/)
    expect(scene).toContain('she looks into the lens with a teasing smirk')
    expect(scene).toContain('cream off-shoulder sweater and jeans')
    expect(posePhotoTags(caption, false)).toContain('from_below')
  })

  /** A playtest selfie that came back as its first clause alone, and with an arm out of frame. */
  const beanbag =
    'A relaxed selfie taken in her room wearing her everyday clothes, sitting curled up on a ' +
    'beanbag chair holding a ceramic mug with both hands and smiling warmly at the camera.'

  it('keeps a clause that holds something else and only looks at the camera', () => {
    expect(withoutCameraHold(beanbag)).toBe(beanbag)
    expect(withoutCameraHold('A selfie on her bed, holding her phone up high, smiling')).toBe(
      'A selfie on her bed, smiling'
    )
    expect(withoutCameraHold('A selfie in bed, smiling, camera held low above her face.')).toBe(
      'A selfie in bed, smiling.'
    )
  })

  it('draws a selfie her hands are both full for as a picture somebody else took', () => {
    const pose = photoPose(beanbag, 'everyday')
    expect(pose.tags).not.toContain('full_body')
    expect(pose.tags.join(' ')).not.toMatch(/outstretched_arm/)
    expect(pose.negative).toEqual(expect.arrayContaining(['selfie', 'outstretched_arm']))
    expect(withoutSelfieWord(beanbag)).toMatch(/^A relaxed photo taken/)
  })

  it('keeps the place after a camera hold', () => {
    expect(
      withoutCameraHold('A selfie holding her phone up high beside the arcade cabinets.')
    ).toBe('A selfie beside the arcade cabinets.')
  })

  it('leaves a mirror selfie, a camera of her own, and any other picture alone', () => {
    const mirror = 'a mirror selfie, holding her phone up'
    expect(withoutCameraHold(mirror)).toBe(mirror)
    const film = 'a selfie, holding her film camera up to her eye'
    expect(withoutCameraHold(film)).toBe(film)
    const other = 'holding the camera low, she smiles'
    expect(withoutCameraHold(other)).toBe(other)
  })
})

describe('which way the camera sees her', () => {
  it('turns her side on for a profile, unless she looks into the camera', () => {
    expect(posePhotoTags('standing by the window, in profile', false)).toEqual(
      expect.arrayContaining(['from_side', 'profile'])
    )
    expect(
      posePhotoTags('standing by the window, side view, looking at the camera', false)
    ).not.toContain('profile')
  })

  it('has her look down into a selfie taken from below', () => {
    const pose = photoPose('a selfie from below in her room', 'everyday')
    expect(pose.tags).toEqual(expect.arrayContaining(['from_below', 'looking_down']))
    expect(photoPose('a selfie in her room', 'everyday').tags).not.toContain('looking_down')
  })

  it('shows her front in a mirror, however the caption turned her', () => {
    const pose = photoPose('a mirror selfie from behind, looking back over her shoulder', 'everyday')
    expect(pose.tags).toContain('mirror')
    expect(pose.tags).not.toContain('from_behind')
    expect(pose.tags).not.toContain('looking_back')
  })
})

describe('her hands, one placement at a time', () => {
  it('leaves a captioned hand on her hip to the sentence', () => {
    const tags = posePhotoTags('a naked mirror selfie in the bathroom, one hand on her hip', true)
    expect(tags).not.toContain('hand_on_own_hip')
    expect(tags).not.toContain('hand_on_own_chest')
  })

  it('adds no hand placement where she is leaning on her hands', () => {
    for (const caption of [
      'sitting naked on the edge of the bed, legs spread, leaning back on her hands',
      'naked on all fours on the bed from behind, looking back at the camera'
    ]) {
      expect(posePhotoTags(caption, true)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^(?:hands?_on_own_|hand_on_own_)/)])
      )
    }
  })

  it('does not add a hand on her hip to hands already on her knees', () => {
    const tags = posePhotoTags('naked, bent over the bed from behind, looking back', true)
    expect(tags).toContain('hands_on_own_knees')
    expect(tags).not.toContain('hand_on_own_hip')
  })

  it('keeps a lying selfie from below from also being from above', () => {
    const pose = photoPose('a selfie from below, naked on the bed, fingering herself', 'explicit')
    expect(pose.tags).toContain('from_below')
    expect(pose.tags).not.toContain('from_above')
    expect(pose.tags).toContain('fingering')
  })
})

describe('sitting cross-legged', () => {
  it('folds her legs under her', () => {
    expect(posePhotoTags('sitting cross-legged on her bed', false)).toEqual(
      expect.arrayContaining(['sitting', 'indian_style'])
    )
    expect(posePhotoTags('sitting on her bed', false)).not.toContain('indian_style')
  })
})

describe('a mirror selfie, her other hand empty', () => {
  it('drops what she holds, keeping the rest', () => {
    expect(
      withoutHeldObject(
        'a close mirror selfie, sitting cross-legged on the bed with a glass of pink drink in hand'
      )
    ).toBe('a close mirror selfie, sitting cross-legged on the bed')
    const coffee = 'a mirror selfie in the hallway, holding an iced coffee, smiling'
    expect(withoutHeldObject(coffee)).toBe('a mirror selfie in the hallway, smiling')
  })

  it('keeps the arcade after the held cup', () => {
    expect(
      withoutHeldObject(
        'A mirror selfie of her in her everyday clothes holding an empty token cup ' +
          'beside a row of brightly lit arcade cabinets.'
      )
    ).toBe(
      'A mirror selfie of her in her everyday clothes beside a row of brightly lit arcade cabinets.'
    )
  })

  it.each([
    'beside the cabinets',
    'next to the cabinets',
    'in front of the cabinets',
    'near the cabinets',
    'against the wall',
    'under the awning',
    'outside the arcade',
    'inside the arcade',
    'while smiling',
    'as she smiles',
    'with her friend'
  ])('keeps the place or clause: %s', (place) => {
    expect(withoutHeldObject(`A mirror selfie holding a cup ${place}.`)).toBe(
      `A mirror selfie ${place}.`
    )
    expect(withoutHeldObject(`A mirror selfie holding a cup in her other hand ${place}.`)).toBe(
      `A mirror selfie ${place}.`
    )
  })

  it('drops the held object with its container or position', () => {
    expect(
      withoutHeldObject('A mirror selfie in her room holding an iced coffee in a paper cup.')
    ).toBe('A mirror selfie in her room.')
    expect(
      withoutHeldObject('A mirror selfie of her holding a bouquet at her chest beside the window.')
    ).toBe('A mirror selfie of her beside the window.')
  })

  it('keeps a gesture, the phone, and any picture that is not in a mirror', () => {
    const gesture = 'a mirror selfie, one hand on her hip, flashing a peace sign'
    expect(withoutHeldObject(gesture)).toBe(gesture)
    const phone = 'a mirror selfie, holding her phone up'
    expect(withoutHeldObject(phone)).toBe(phone)
    const plain = 'a selfie in the cafe, holding an iced coffee'
    expect(withoutHeldObject(plain)).toBe(plain)
  })
})

describe('a candid picture', () => {
  it('has her looking away, even where the caption says the camera', () => {
    const tags = posePhotoTags('a candid shot of her reading, not looking at the camera', false)
    expect(tags).toContain('looking_away')
    expect(tags).not.toContain('looking_at_viewer')
    expect(posePhotoTags('smiling at the camera', false)).toContain('looking_at_viewer')
  })
})

describe('angles named for where the camera is', () => {
  it.each([
    ['An overhead shot in her room', 'from_above'],
    ['A photo in her room from overhead', 'from_above'],
    ["A bird's-eye shot in the garden", 'from_above'],
    ['A birds-eye shot in the garden', 'from_above'],
    ["A worm's-eye shot beside a wall", 'from_below'],
    ['A worms-eye shot beside a wall', 'from_below']
  ])('reads %s', (caption, angle) => {
    expect(photoPose(caption, 'everyday').tags).toContain(angle)
  })
})

describe('captioned hands replace position fillers', () => {
  it.each([
    ['resting her chin on one hand, sitting', false, ['head_rest']],
    ['propping her chin on one hand, sitting', false, ['head_rest']],
    ['ribbon around her neck with both hands, kneeling', false, []],
    ['two fingers pressed into her mouth, kneeling', true, ['finger_in_own_mouth']],
    ['one hand cupping the underside of her breast, sitting', true, ['grabbing_own_breast']],
    ['both hands spreading her thighs, sitting', false, []],
    ['leaning over a cart, hands on the handle', false, []],
    ['leaning on the railing, both forearms resting on the rail', false, ['leaning_on_object']],
    ['leaning on the counter, elbows on the counter', false, ['leaning_on_object']],
    ['leaning over her desk, hands flat on the desk', false, ['leaning_on_object']],
    ['leaning against a parked car, hands on the car door', false, ['standing']],
    ['one hand resting on a basket, standing', false, []],
    ['camisole pulled down with one hand, standing', true, ['clothes_pull']],
    ['glancing back over one shoulder', false, ['looking_back', 'from_behind']]
  ])('%s', (caption, bare, actions) => {
    const tags = posePhotoTags(caption, bare)
    expect(tags).toEqual(expect.arrayContaining(actions))
    for (const filler of [
      'hands_on_lap', 'hands_on_own_thighs', 'hand_on_own_hip', 'hand_on_own_chin'
    ]) expect(tags).not.toContain(filler)
    if (caption.includes('mouth')) expect(tags).not.toContain('fingering')
  })

  it.each([
    ['cupping her breast, sitting', true, 'grabbing_own_breast'],
    ['fingers in her mouth, kneeling', true, 'finger_in_own_mouth'],
    ['fingers into her mouth, kneeling', true, 'finger_in_own_mouth'],
    ['pulling down her camisole with one hand', false, 'clothes_pull'],
    ['tugging down her camisole with one hand', false, 'clothes_pull'],
    ['lifting the hem with one hand', false, 'skirt_lift'],
    ['lifting her skirt with one hand', false, 'skirt_lift'],
    ['winking at the camera', false, 'one_eye_closed'],
    ['a playful wink', false, 'one_eye_closed']
  ])('reads the action in %s', (caption, bare, tag) => {
    expect(posePhotoTags(caption, bare)).toContain(tag)
  })

  it.each(['lounging sideways', 'lying sideways', 'on one elbow', 'propped on her elbow'])(
    'keeps %s on her side across tiers', (caption) => {
      for (const bare of [false, true]) {
        expect(posePhotoTags(caption, bare)).toEqual(expect.arrayContaining(['lying', 'on_side']))
      }
    }
  )
})
