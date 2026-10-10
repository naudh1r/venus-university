import { useSyncExternalStore } from 'react'
import {
  explicitPhotosAllowed,
  photoSwitches,
  photosVisible,
  setPhotoSwitches,
  subscribePhotoSwitches,
  type PhotoSwitches
} from '@shared/photoSwitches'
import { noNsfwImagesOf, useSettingsStore } from './settingsStore'

/** Photo Feature's switches in a component, which redraws when one moves. */
export function usePhotoSwitches(): PhotoSwitches {
  return useSyncExternalStore(subscribePhotoSwitches, photoSwitches, photoSwitches)
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
  const noNsfw = useSettingsStore(noNsfwImagesOf)
  return !explicitPhotosAllowed(noNsfw, usePhotoSwitches())
}

/**
 * The switches from the developer console, for trying what a mods screen would do on a build that
 * has none: `photoSwitches.set({ on: false })`, `photoSwitches.get()`. The console only opens in
 * a development run, so a player never reaches it. Main keeps its own copy, so renders still draw
 * body details from here; everything on screen and in the prompts follows.
 */
;(globalThis as { photoSwitches?: unknown }).photoSwitches = {
  set: setPhotoSwitches,
  get: photoSwitches
}
