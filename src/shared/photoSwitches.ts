import { PHOTO_FEATURE_ID } from './photoDefinition'
export { PHOTO_FEATURE_ID, PHOTO_FEATURE_MOD } from './photoDefinition'
import { sharedModOn } from '@vx/modkit/shared'
import { PHOTO_LOADERS, type PhotoLoader } from './photoLoader'

/** Photo's gates read the live rules; each entry supplies its process's option reader. */
export interface PhotoSwitches {
  /** The mod itself. */
  on: boolean
  /** New photos are made. Off, the mod stays on and what it already made stays visible. */
  photos: boolean
  /** Undressed photos may be sent; the game's own "No NSFW images" can still forbid them. */
  explicit: boolean
  /** What a DM photo still being drawn waits behind. */
  loader: PhotoLoader
  /** New photos are stored as WebP rather than PNG. */
  webp: boolean
  /** Her build, chest, hips, backside and hair are asked for, edited and drawn. */
  body: boolean
  /** A photo of two girls, never more, on one's feed: her own post with a friend, or from a scene. Experimental. */
  duo: boolean
}

/** Before the Mods screen's switches are read: the mod on, nothing forbidden, the bunny. */
export const DEFAULT_PHOTO_SWITCHES: PhotoSwitches = {
  on: true,
  photos: true,
  explicit: true,
  loader: 'bunny',
  webp: true,
  body: false,
  duo: false
}

type OptionReader = (optionId: string) => boolean
let readOption: OptionReader | null = null
let snapshot = DEFAULT_PHOTO_SWITCHES

/** Plugs in the synchronous option reader owned by this process's entry. */
export function bindPhotoOptionReader(reader: OptionReader | null): void {
  readOption = reader
}

/** Reads every switch live, retaining identity only while the answers stay the same. */
export function photoSwitches(): PhotoSwitches {
  const option = readOption
  if (!option) return DEFAULT_PHOTO_SWITCHES
  const next: PhotoSwitches = {
    on: sharedModOn(PHOTO_FEATURE_ID),
    photos: option('photos'),
    explicit: option('explicit'),
    webp: option('webp'),
    body: option('body'),
    duo: option('duo'),
    loader: PHOTO_LOADERS.find(loader => option(loaderOptionId(loader.value)))?.value ?? 'bunny'
  }
  if ((Object.keys(next) as (keyof PhotoSwitches)[]).some(key => next[key] !== snapshot[key])) snapshot = next
  return snapshot
}

/** Whether the running mod acts, with the pre-entry default retained during boot. */
export function photoFeatureOn(): boolean {
  return readOption ? sharedModOn(PHOTO_FEATURE_ID) : DEFAULT_PHOTO_SWITCHES.on
}

/**
 * Whether what the mod has already made is on screen: its photos, its gallery and its feed
 * comments. Whenever the mod is on, whether or not it makes new photos.
 */
export function photosVisible(switches: PhotoSwitches = photoSwitches()): boolean {
  return switches.on
}

/** Whether new photos are made: the mod on, and its "Photo generation" option. */
export function photoGenerationOn(switches: PhotoSwitches = photoSwitches()): boolean {
  return switches.on && switches.photos
}

/**
 * Whether an undressed photo may be sent or uncovered: the mod's own option, and the game's
 * "No NSFW images". Either one is enough to forbid it; neither can allow what the other forbids.
 */
export function explicitPhotosAllowed(
  noNsfwImages: boolean,
  switches: PhotoSwitches = photoSwitches()
): boolean {
  return switches.explicit && !noNsfwImages
}

/** Whether a shared scene brings a group photo: new photos made, and its option. */
export function duoPhotosOn(switches: PhotoSwitches = photoSwitches()): boolean {
  return photoGenerationOn(switches) && switches.duo
}

/** The option that picks one loading animation. */
export function loaderOptionId(loader: PhotoLoader): string {
  return `loader-${loader}`
}
