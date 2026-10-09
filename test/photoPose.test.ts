import { describe, expect, it } from 'vitest'
import { photoPose, posePhotoTags } from '../src/shared/photoPose'

describe('posePhotoTags', () => {
  it('reads the framing off an ordinary caption', () => {
    expect(posePhotoTags('a close-up in her new coat', false)).toEqual(
      expect.arrayContaining(['close-up', 'upper_body'])
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

describe('a selfie', () => {
  it('keeps the phone out, her arm reaching out of the picture', () => {
    const pose = photoPose('a selfie in the cafe, smiling', false)
    expect(pose.tags).toEqual(
      expect.arrayContaining(['selfie', 'upper_body', 'outstretched_arm', 'foreshortening'])
    )
    expect(pose.negative).toEqual(
      expect.arrayContaining(['phone', 'holding_phone', 'camera', 'v'])
    )
    expect(photoPose('a selfie holding her film camera', false).negative).not.toContain('camera')
  })

  it('keeps the peace sign she asked for', () => {
    const pose = photoPose('a selfie flashing a peace sign', false)
    expect(pose.tags).toContain('v')
    expect(pose.negative).not.toContain('v')
  })

  it('shows the phone in a mirror selfie', () => {
    const pose = photoPose('a mirror selfie in her new coat', false)
    expect(pose.tags).toEqual(expect.arrayContaining(['mirror', 'reflection', 'holding_phone']))
    expect(pose.negative).toEqual([])
  })

  it('takes a whole-body shot from above without the selfie tag', () => {
    const pose = photoPose('a full body selfie of her outfit, standing', false)
    expect(pose.tags).toEqual(
      expect.arrayContaining(['full_body', 'from_above', '(outstretched_arm:1.2)'])
    )
    expect(pose.tags).not.toContain('selfie')
    expect(pose.tags).not.toContain('cowboy_shot')
  })

  it('holds her on her stomach, with the camera in front of her face', () => {
    const pose = photoPose('a selfie lying on her stomach on the bed', false)
    expect(pose.tags).toEqual(
      expect.arrayContaining(['(on_stomach:1.2)', 'outstretched_arm', 'upper_body'])
    )
    expect(photoPose('a full body selfie on her stomach', false).tags).toContain('(legs_up:1.1)')
    expect(pose.tags).not.toContain('from_above')
    expect(pose.negative).toContain('on_back')
  })

  it('draws the arm out of frame, not a palm at the lens, on her side', () => {
    const pose = photoPose('a selfie lying on her side in bed', false)
    expect(pose.tags).toEqual(expect.arrayContaining(['on_side', 'selfie', 'from_above']))
    expect(pose.tags).not.toContain('outstretched_arm')
    expect(pose.negative).toEqual(expect.arrayContaining(['open_hand', 'on_stomach']))
  })

  it('frames a selfie on her back from the waist up, unless she asks for all of her', () => {
    const pose = photoPose('a selfie lying on her back in bed', false)
    expect(pose.tags).toEqual(expect.arrayContaining(['selfie', 'upper_body', 'on_back']))
    expect(photoPose('a full body selfie on her back', false).tags).toContain('full_body')
  })

  it('keeps how she is lying in a close-up, closer on her side or back', () => {
    const side = photoPose('a close-up of her lying on her side in bed', false)
    expect(side.tags).toEqual(expect.arrayContaining(['lying', 'on_side', '(upper_body:1.3)']))
    expect(side.tags).not.toContain('close-up')
    expect(side.negative).toEqual(['on_back', 'on_stomach'])
    const stomach = photoPose('close up, on her stomach on the bed', false)
    expect(stomach.tags).toEqual(expect.arrayContaining(['on_stomach', 'upper_body']))
  })

  it('keeps a picture somebody else took from flipping her over', () => {
    const side = photoPose('lying on her side in bed', false)
    expect(side.tags).not.toContain('selfie')
    expect(side.negative).toEqual(['on_back', 'on_stomach'])
    expect(photoPose('in a cafe, smiling', false).negative).toEqual([])
  })
})
