import { afterEach, describe, expect, it, vi } from 'vitest'
import { postIsOut } from '../src/shared/heldPosts'
import {
  DEFAULT_PHOTO_SWITCHES,
  explicitPhotosAllowed,
  PHOTO_FEATURE_MOD,
  photoFeatureOn,
  photoGenerationOn,
  photoSwitches,
  photosVisible,
  setPhotoSwitches,
  subscribePhotoSwitches
} from '../src/shared/photoSwitches'
import { postCommentLines } from '../src/renderer/prompts/photoBrief'
import type { SocialPost } from '../src/shared/types'

/** Photo Feature's own switches, as the Mods screen sets them. */

afterEach(() => setPhotoSwitches(DEFAULT_PHOTO_SWITCHES))

const held: SocialPost = {
  id: 'p1',
  text: 'beach day',
  date: 3,
  time: 0,
  likes: 4,
  photo: { tier: 'everyday', scene: 'on the sand', file: 'a.png', pending: true, held: true }
} as SocialPost

describe('photo switches', () => {
  it('leave the mod fully on before anything sets them', () => {
    expect(photoFeatureOn()).toBe(true)
    expect(photoGenerationOn()).toBe(true)
    expect(photoSwitches().loader).toBe('bunny')
    expect(photosVisible()).toBe(true)
    expect(explicitPhotosAllowed(false)).toBe(true)
    expect(explicitPhotosAllowed(true)).toBe(false)
    expect(postIsOut(held)).toBe(false)
  })

  it('hide what exists while off', () => {
    setPhotoSwitches({ on: false })
    expect(photoFeatureOn()).toBe(false)
    expect(photosVisible()).toBe(false)
    expect(photoGenerationOn()).toBe(false)
  })

  it('keep what exists on screen with photo generation off, and make nothing new', () => {
    setPhotoSwitches({ photos: false })
    expect(photoFeatureOn()).toBe(true)
    expect(photosVisible()).toBe(true)
    expect(photoGenerationOn()).toBe(false)
  })

  it('let either switch forbid an explicit photo, and neither allow what the other forbids', () => {
    expect(explicitPhotosAllowed(false, { ...DEFAULT_PHOTO_SWITCHES, explicit: false })).toBe(false)
    expect(explicitPhotosAllowed(true, { ...DEFAULT_PHOTO_SWITCHES, explicit: true })).toBe(false)
    expect(explicitPhotosAllowed(false, { ...DEFAULT_PHOTO_SWITCHES, explicit: true })).toBe(true)
  })

  it('show a post still waiting for its picture while off, without touching it', () => {
    setPhotoSwitches({ on: false })
    expect(postIsOut(held)).toBe(true)
    expect(held.photo?.held).toBe(true)
    setPhotoSwitches({ on: true })
    expect(postIsOut(held)).toBe(false)
  })

  it('tell the slot opening to write no comments while off', () => {
    expect(postCommentLines(true).length).toBeGreaterThan(1)
    expect(postCommentLines(false)).toEqual(['Leave "comments" empty on every post.'])
    setPhotoSwitches({ on: false })
    expect(postCommentLines()).toEqual(['Leave "comments" empty on every post.'])
  })

  it('tell whoever is listening only when something moved', () => {
    const heard = vi.fn()
    const stop = subscribePhotoSwitches(heard)
    setPhotoSwitches({ on: true })
    expect(heard).not.toHaveBeenCalled()
    const before = photoSwitches()
    setPhotoSwitches({ explicit: false })
    expect(heard).toHaveBeenCalledTimes(1)
    expect(photoSwitches()).not.toBe(before)
    stop()
    setPhotoSwitches({ explicit: true })
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('describe itself for a mods screen with options whose defaults match this build', () => {
    expect(PHOTO_FEATURE_MOD.id).toBe('photo-feature')
    const defaults = Object.fromEntries(PHOTO_FEATURE_MOD.options.map((o) => [o.id, o.default]))
    expect(defaults).toEqual({
      photos: DEFAULT_PHOTO_SWITCHES.photos,
      explicit: DEFAULT_PHOTO_SWITCHES.explicit,
      'loader-bunny': true,
      'loader-shimmer': false,
      'loader-dots': false
    })
  })
})
