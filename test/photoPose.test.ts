import { describe, expect, it } from 'vitest'
import { posePhotoTags } from '../src/shared/photoPose'

describe('posePhotoTags', () => {
  it('reads the framing off an ordinary caption', () => {
    expect(posePhotoTags('a mirror selfie in her new coat', false)).toEqual(
      expect.arrayContaining(['close-up', 'upper_body', 'mirror'])
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
