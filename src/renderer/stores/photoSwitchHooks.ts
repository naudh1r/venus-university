import {
  explicitPhotosAllowed,
  photoSwitches,
  photosVisible,
  PHOTO_FEATURE_ID,
  type PhotoSwitches
} from '../../shared/photoSwitches'
import { useModOn, useModOption, useNoNsfwImages } from '@vx/modkit/renderer'

/** Photo Feature's switches in a component, which redraws when one moves. */
export function usePhotoSwitches(): PhotoSwitches {
  useModOn(PHOTO_FEATURE_ID)
  useModOption(PHOTO_FEATURE_ID, 'photos')
  useModOption(PHOTO_FEATURE_ID, 'explicit')
  useModOption(PHOTO_FEATURE_ID, 'webp')
  useModOption(PHOTO_FEATURE_ID, 'body')
  useModOption(PHOTO_FEATURE_ID, 'duo')
  useModOption(PHOTO_FEATURE_ID, 'loader-bunny')
  useModOption(PHOTO_FEATURE_ID, 'loader-shimmer')
  useModOption(PHOTO_FEATURE_ID, 'loader-dots')
  return photoSwitches()
}

/** Whether what the mod has already made is on screen: always while it is on. */
export function usePhotosVisible(): boolean {
  return photosVisible(usePhotoSwitches())
}

/**
 * Whether an undressed photo is shut away: the game's "No NSFW images" or the mod's own option.
 * A photo she has already sent stays covered, and cannot be uncovered, while it is.
 */
export function useExplicitBlocked(): boolean {
  const noNsfw = useNoNsfwImages()
  return !explicitPhotosAllowed(noNsfw, usePhotoSwitches())
}
